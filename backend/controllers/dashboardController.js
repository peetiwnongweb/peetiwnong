const { getPrisma } = require('../lib/prisma');
const { isDriveConfigured } = require('../lib/googleDrive');
const { isConfigured: isImageStorageConfigured } = require('../lib/driveImageStorage');
const { readLiveDbMetrics } = require('../lib/usageSnapshot');
const { toBangkokDay, TIMEZONE } = require('../middleware/usageTracker');
const { getCampState } = require('../lib/campState');

// ==========================================
// แดชบอร์ด WebManager - รวมตัวเลขจากทุกส่วนของระบบ (ดู fontend/webmanager/js/webmanager-dashboard.js)
// ทุก endpoint เป็นการ "นับ/รวมยอด" ไม่ดึงรายการเต็ม ใช้ Promise.all ยิงขนานในคำขอเดียว ให้หน้าเว็บเรียกครั้งเดียวต่อแท็บ
// ตัวเลขภาพรวม (summary) cache ไว้สั้น ๆ ใน memory กันกดรีเฟรชรัว ๆ แล้วยิง 40 query ซ้ำทุกครั้ง
// ==========================================

const SUMMARY_CACHE_MS = 15 * 1000;
let summaryCache = { at: 0, data: null };

const DAY_MS = 24 * 60 * 60 * 1000;

function toFullName(profile) {
  const prefixedFirstName = `${profile?.prefix || ''}${profile?.firstName || ''}`;
  return [prefixedFirstName, profile?.lastName].filter(Boolean).join(' ') || '-';
}

// วัน (YYYY-MM-DD เวลาไทย) -> Date ที่ตรงกับเที่ยงคืนเวลาไทย (ไทยเป็น UTC+7 ตายตัว ไม่มี DST)
function bangkokDayStart(day) {
  return new Date(`${day}T00:00:00+07:00`);
}

// วัน (YYYY-MM-DD) -> Date เที่ยงคืน UTC ตรงกับที่ Prisma เก็บคอลัมน์ @db.Date
function toDateColumn(day) {
  return new Date(`${day}T00:00:00.000Z`);
}

function dateColumnToDay(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function shiftDay(day, deltaDays) {
  return toBangkokDay(new Date(bangkokDayStart(day).getTime() + deltaDays * DAY_MS + 12 * 60 * 60 * 1000));
}

function listDays(startDay, endDay) {
  const days = [];
  let cursor = startDay;
  while (cursor <= endDay) {
    days.push(cursor);
    cursor = shiftDay(cursor, 1);
  }
  return days;
}

// ช่วงเวลาที่แดชบอร์ดการใช้งานเลือกได้ ('today' | '7d' | '30d' | 'camp') คืนเป็นวันแรก-วันสุดท้าย (เวลาไทย) + Date เริ่มต้นแบบ UTC
async function resolveUsageRange(prisma, rangeKey) {
  const today = toBangkokDay(new Date());
  let startDay;
  if (rangeKey === 'today') startDay = today;
  else if (rangeKey === '30d') startDay = shiftDay(today, -29);
  else if (rangeKey === 'camp') {
    const latestCamp = await prisma.camp.findFirst({ orderBy: { generationNo: 'desc' }, select: { createdAt: true } });
    startDay = latestCamp ? toBangkokDay(latestCamp.createdAt) : shiftDay(today, -89);
    // ค่ายที่สร้างมานานมาก (เช่น ยังไม่กดจบค่ายข้ามปี) จำกัดไว้ไม่เกิน 1 ปีเท่ากับอายุข้อมูลรายชั่วโมงที่เก็บ
    const yearAgo = shiftDay(today, -364);
    if (startDay < yearAgo) startDay = yearAgo;
  } else startDay = shiftDay(today, -6);

  return { key: rangeKey, startDay, endDay: today, start: bangkokDayStart(startDay), end: new Date(bangkokDayStart(today).getTime() + DAY_MS) };
}

function avg(total, count) {
  return count > 0 ? Math.round(total / count) : 0;
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

// ==========================================
// ภาพรวม (แท็บแรก)
// ==========================================
async function buildSummary(prisma) {
  const today = toBangkokDay(new Date());
  const todayStart = bangkokDayStart(today);
  const sevenDaysAgo = bangkokDayStart(shiftDay(today, -6));
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);

  const [
    latestCamp, departmentCount, settings,
    pendingStaff, pendingParticipant, rejectedUsers, todayStaffRegs, todayParticipantRegs, weekRegs,
    latestBackup, failedBackups30d,
    pendingNews, ungroupedParticipants, subjectsWithInstructorIds, openExamSessions, pendingExamAttempts,
    participantsByCourse, participantsByStudyPlan, participantTotal, groupedParticipants,
    staffTotal, staffByDepartment, departments, staffAdmins,
    subjects, courseFormats, participantsWithCourse, classScheduleCount, studyDocumentCount, scoreRows, passedAttempts, attemptStatusCounts,
    activityCount, groupCount, activityScores, groupsWithNames, latestScore,
    newsTotal, newsVisible, newsHidden, scheduleCount, committeeCount, galleryCount, logTotal, logToday, recentLogs,
    dau, wau, mau, hourlyToday, sessionCount,
  ] = await Promise.all([
    prisma.camp.findFirst({
      orderBy: { generationNo: 'desc' },
      include: {
        president: { select: { staffProfile: { select: { prefix: true, firstName: true, lastName: true, nickname: true } } } },
        secretary: { select: { staffProfile: { select: { prefix: true, firstName: true, lastName: true, nickname: true } } } },
        _count: { select: { vicePresidents: true, departmentHeads: true } },
      },
    }),
    prisma.campDepartment.count(),
    prisma.siteSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),

    prisma.user.count({ where: { role: 'STAFF', approvalStatus: 'PENDING' } }),
    prisma.user.count({ where: { role: 'PARTICIPANT', approvalStatus: 'PENDING' } }),
    prisma.user.count({ where: { approvalStatus: 'REJECTED' } }),
    prisma.user.count({ where: { role: 'STAFF', createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { role: 'PARTICIPANT', createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { role: { in: ['STAFF', 'PARTICIPANT'] }, createdAt: { gte: sevenDaysAgo } } }),

    prisma.campBackupRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.campBackupRun.count({ where: { status: 'FAILED', startedAt: { gte: thirtyDaysAgo } } }),

    prisma.news.count({ where: { approvalStatus: 'PENDING' } }),
    prisma.participantProfile.count({ where: { groupId: null, user: { approvalStatus: 'APPROVED' } } }),
    prisma.subjectInstructor.findMany({ select: { subjectId: true }, distinct: ['subjectId'] }),
    prisma.oralExamSession.count({ where: { status: { in: ['OPEN', 'STARTED'] } } }),
    prisma.oralExamAttempt.count({ where: { status: 'PENDING' } }),

    prisma.participantProfile.groupBy({ by: ['courseFormatId'], where: { user: { approvalStatus: 'APPROVED' } }, _count: { _all: true } }),
    prisma.participantProfile.groupBy({ by: ['studyPlan'], where: { user: { approvalStatus: 'APPROVED' } }, _count: { _all: true } }),
    prisma.user.count({ where: { role: 'PARTICIPANT', approvalStatus: 'APPROVED' } }),
    prisma.participantProfile.count({ where: { groupId: { not: null }, user: { approvalStatus: 'APPROVED' } } }),

    prisma.user.count({ where: { role: 'STAFF', approvalStatus: 'APPROVED' } }),
    prisma.staffProfile.groupBy({ by: ['departmentId'], where: { user: { approvalStatus: 'APPROVED' } }, _count: { _all: true } }),
    prisma.campDepartment.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.staffProfile.count({ where: { isAdmin: true, user: { approvalStatus: 'APPROVED' } } }),

    prisma.subject.findMany({ select: { id: true, name: true, requiresScoring: true, courseFormatId: true } }),
    prisma.courseFormat.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.participantProfile.findMany({ where: { user: { approvalStatus: 'APPROVED' } }, select: { id: true, courseFormatId: true } }),
    prisma.classSchedule.count(),
    prisma.studyDocument.count(),
    prisma.participantSubjectScore.findMany({
      where: { OR: [{ explanationScore: { not: null } }, { achievementScore: { not: null } }] },
      select: { subjectId: true },
    }),
    prisma.oralExamAttempt.findMany({ where: { status: 'PASSED' }, select: { participantProfileId: true, subjectId: true }, distinct: ['participantProfileId', 'subjectId'] }),
    prisma.oralExamAttempt.groupBy({ by: ['status'], _count: { _all: true } }),

    prisma.campActivity.count(),
    prisma.group.count(),
    prisma.activityScore.groupBy({ by: ['groupId'], _sum: { score: true }, _count: { _all: true } }),
    prisma.group.findMany({ select: { id: true, name: true } }),
    prisma.activityScore.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true, activity: { select: { name: true } } } }),

    prisma.news.count(),
    prisma.news.count({ where: { isVisible: true, approvalStatus: 'APPROVED' } }),
    prisma.news.count({ where: { isVisible: false, approvalStatus: 'APPROVED' } }),
    prisma.schedule.count(),
    prisma.committee.count(),
    prisma.galleryPhoto.count(),
    prisma.activityLog.count(),
    prisma.activityLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),

    prisma.usageDailyActiveUser.count({ where: { day: toDateColumn(today) } }),
    prisma.usageDailyActiveUser.findMany({ where: { day: { gte: toDateColumn(shiftDay(today, -6)) } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.usageDailyActiveUser.findMany({ where: { day: { gte: toDateColumn(shiftDay(today, -29)) } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.usageHourlyStat.aggregate({ where: { bucketStart: { gte: todayStart } }, _sum: { apiRequests: true, pageViews: true, totalDurationMs: true, errorCount: true } }),
    prisma.$queryRawUnsafe('SELECT count(*)::int AS count FROM "session" WHERE expire > now()').then((rows) => Number(rows[0]?.count) || 0).catch(() => 0),
  ]);

  const courseNameById = new Map(courseFormats.map((c) => [c.id, c.name]));
  const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));
  const subjectsWithInstructor = new Set(subjectsWithInstructorIds.map((s) => s.subjectId));
  const subjectsWithoutInstructor = subjects.filter((s) => !subjectsWithInstructor.has(s.id));

  // คะแนนที่ "ควรมี" = น้องแต่ละคน × วิชาที่เก็บคะแนนในคอร์สของตัวเอง (วิชา courseFormatId null = ใช้ร่วมทุกคอร์ส)
  const scoringSubjects = subjects.filter((s) => s.requiresScoring);
  const scoringSubjectsForCourse = (courseId) => scoringSubjects.filter((s) => s.courseFormatId === null || s.courseFormatId === courseId);
  const expectedScores = participantsWithCourse.reduce((sum, p) => sum + scoringSubjectsForCourse(p.courseFormatId).length, 0);
  const scoredSubjectIds = new Set(scoreRows.map((r) => r.subjectId));
  const subjectsWithoutScores = scoringSubjects.filter((s) => !scoredSubjectIds.has(s.id)).map((s) => s.name);

  // น้องที่สอบอธิบายผ่านครบทุกวิชาที่เก็บคะแนนในคอร์สตัวเอง
  const passedBySubjectByParticipant = new Map();
  passedAttempts.forEach((a) => {
    if (!passedBySubjectByParticipant.has(a.participantProfileId)) passedBySubjectByParticipant.set(a.participantProfileId, new Set());
    passedBySubjectByParticipant.get(a.participantProfileId).add(a.subjectId);
  });
  const fullyPassedParticipants = participantsWithCourse.filter((p) => {
    const required = scoringSubjectsForCourse(p.courseFormatId);
    if (required.length === 0) return false;
    const passed = passedBySubjectByParticipant.get(p.id);
    return !!passed && required.every((s) => passed.has(s.id));
  }).length;

  const attemptCount = (status) => attemptStatusCounts.find((r) => r.status === status)?._count._all || 0;

  const groupNameById = new Map(groupsWithNames.map((g) => [g.id, g.name]));
  const leaderboard = activityScores
    .map((row) => ({ groupId: row.groupId, name: groupNameById.get(row.groupId) || `กลุ่ม ${row.groupId}`, total: row._sum.score || 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const staffByDept = staffByDepartment
    .map((row) => ({ name: row.departmentId ? (departmentNameById.get(row.departmentId) || '-') : 'ยังไม่ระบุฝ่าย', count: row._count._all }))
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    camp: latestCamp ? {
      generationNo: latestCamp.generationNo,
      isEnded: latestCamp.isEnded,
      createdAt: latestCamp.createdAt,
      president: latestCamp.president ? toFullName(latestCamp.president.staffProfile) : null,
      presidentNickname: latestCamp.president?.staffProfile?.nickname || null,
      secretary: latestCamp.secretary ? toFullName(latestCamp.secretary.staffProfile) : null,
      vicePresidentCount: latestCamp._count.vicePresidents,
      departmentHeadCount: latestCamp._count.departmentHeads,
      departmentCount,
    } : null,
    settings: {
      staffRegistrationOpen: settings.staffRegistrationOpen,
      participantRegistrationOpen: settings.participantRegistrationOpen,
      staffAutoApprove: settings.staffAutoApprove,
      participantAutoApprove: settings.participantAutoApprove,
    },
    registrations: { todayStaff: todayStaffRegs, todayParticipant: todayParticipantRegs, last7Days: weekRegs, pendingStaff, pendingParticipant, rejected: rejectedUsers },
    backup: {
      configured: isDriveConfigured(),
      intervalHours: Number(process.env.BACKUP_INTERVAL_HOURS) || 12,
      latest: latestBackup,
      failedLast30Days: failedBackups30d,
    },
    attention: {
      pendingStaff,
      pendingParticipant,
      pendingNews,
      ungroupedParticipants,
      subjectsWithoutInstructor: subjectsWithoutInstructor.length,
      subjectsWithoutInstructorNames: subjectsWithoutInstructor.map((s) => s.name),
      openExamSessions,
      pendingExamAttempts,
    },
    people: {
      participants: {
        total: participantTotal,
        grouped: groupedParticipants,
        ungrouped: ungroupedParticipants,
        byCourse: participantsByCourse.map((row) => ({ name: row.courseFormatId ? (courseNameById.get(row.courseFormatId) || '-') : 'ยังไม่ระบุคอร์ส', count: row._count._all })),
        byStudyPlan: participantsByStudyPlan.map((row) => ({ key: row.studyPlan || 'UNKNOWN', count: row._count._all })).sort((a, b) => b.count - a.count),
      },
      staff: { total: staffTotal, admins: staffAdmins, byDepartment: staffByDept },
    },
    academic: {
      subjects: subjects.length,
      scoringSubjects: scoringSubjects.length,
      subjectsByCourse: courseFormats.map((c) => ({ name: c.name, count: subjects.filter((s) => s.courseFormatId === c.id).length }))
        .concat([{ name: 'ทั้งคู่', count: subjects.filter((s) => s.courseFormatId === null).length }]),
      classSchedules: classScheduleCount,
      studyDocuments: studyDocumentCount,
      openExamSessions,
      scoring: { recorded: scoreRows.length, expected: expectedScores, subjectsWithoutScores },
      oralExam: {
        passed: attemptCount('PASSED'),
        failed: attemptCount('FAILED'),
        pending: attemptCount('PENDING'),
        fullyPassedParticipants,
        participantTotal: participantsWithCourse.length,
      },
    },
    activities: {
      activities: activityCount,
      groups: groupCount,
      scoreCells: activityScores.reduce((sum, r) => sum + r._count._all, 0),
      expectedCells: activityCount * groupCount,
      latestScored: latestScore ? { name: latestScore.activity.name, updatedAt: latestScore.updatedAt } : null,
      leaderboard,
    },
    content: {
      news: { total: newsTotal, visible: newsVisible, hidden: newsHidden, pending: pendingNews },
      schedules: scheduleCount,
      committees: committeeCount,
      galleryPhotos: galleryCount,
      activityLogs: { total: logTotal, today: logToday },
    },
    recentActivity: recentLogs,
    usage: {
      dau,
      wau: wau.length,
      mau: mau.length,
      apiRequestsToday: hourlyToday._sum.apiRequests || 0,
      pageViewsToday: hourlyToday._sum.pageViews || 0,
      avgResponseMs: avg(hourlyToday._sum.totalDurationMs || 0, hourlyToday._sum.apiRequests || 0),
      errorsToday: hourlyToday._sum.errorCount || 0,
      sessionCount,
    },
  };
}

async function getSummary(req, res) {
  const force = req.query.refresh === '1';
  if (!force && summaryCache.data && Date.now() - summaryCache.at < SUMMARY_CACHE_MS) {
    return res.json({ ...summaryCache.data, cached: true });
  }
  const prisma = await getPrisma();
  const data = await buildSummary(prisma);
  summaryCache = { at: Date.now(), data };
  res.json(data);
}

// ==========================================
// บุคลากร
// ==========================================
async function getPeople(req, res) {
  const prisma = await getPrisma();
  const [staff, participants, departments, positions, courseFormats, groups, latestCamp, campState] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'STAFF' },
      select: {
        id: true, approvalStatus: true, createdAt: true,
        staffProfile: { select: { prefix: true, firstName: true, lastName: true, nickname: true, departmentId: true, positionId: true, isAdmin: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: 'PARTICIPANT' },
      select: {
        id: true, approvalStatus: true, createdAt: true,
        participantProfile: { select: { id: true, prefix: true, firstName: true, lastName: true, nickname: true, courseFormatId: true, groupId: true, studyPlan: true, interestSubjectGroup: true } },
      },
    }),
    prisma.campDepartment.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.staffPosition.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.courseFormat.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.group.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.camp.findFirst({ orderBy: { generationNo: 'desc' }, select: { generationNo: true } }),
    getCampState(prisma),
  ]);

  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const posName = new Map(positions.map((p) => [p.id, p.name]));
  const courseName = new Map(courseFormats.map((c) => [c.id, c.name]));

  const approvedStaff = staff.filter((u) => u.approvalStatus === 'APPROVED');
  const approvedParticipants = participants.filter((u) => u.approvalStatus === 'APPROVED');

  // ยังไม่มีค่ายที่กำลังดำเนินการ (ยังไม่สร้าง หรือจบค่ายไปแล้ว) - พี่ค่ายทุกคนคือ "ทีมงานค่าย" เหมือนกันหมด ไม่แยกตำแหน่ง (ดู backend/lib/campState.js)
  // ไม่กระทบสิทธิ์ผู้ดูแลระบบ (isAdmin) ซึ่งเป็นคนละฟิลด์ ไม่ผูกกับวงจรชีวิตค่าย
  const byDepartment = departments.map((d) => {
    const members = approvedStaff.filter((u) => u.staffProfile?.departmentId === d.id);
    const positionCounts = new Map();
    members.forEach((u) => {
      const name = campState.isActive ? (posName.get(u.staffProfile?.positionId) || 'ยังไม่ระบุตำแหน่ง') : 'ทีมงานค่าย';
      positionCounts.set(name, (positionCounts.get(name) || 0) + 1);
    });
    return { id: d.id, name: d.name, count: members.length, positions: [...positionCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) };
  });
  const noDepartment = approvedStaff.filter((u) => !u.staffProfile?.departmentId).length;

  const byPosition = campState.isActive
    ? positions.map((p) => ({ name: p.name, count: approvedStaff.filter((u) => u.staffProfile?.positionId === p.id).length }))
      .filter((p) => p.count > 0).sort((a, b) => b.count - a.count)
    : (approvedStaff.length > 0 ? [{ name: 'ทีมงานค่าย', count: approvedStaff.length }] : []);

  const byGroup = groups.map((g) => ({ id: g.id, name: g.name, count: approvedParticipants.filter((u) => u.participantProfile?.groupId === g.id).length }));
  const byCourse = courseFormats.map((c) => ({ name: c.name, count: approvedParticipants.filter((u) => u.participantProfile?.courseFormatId === c.id).length }));
  const studyPlanCounts = new Map();
  const interestCounts = new Map();
  approvedParticipants.forEach((u) => {
    const plan = u.participantProfile?.studyPlan || 'UNKNOWN';
    studyPlanCounts.set(plan, (studyPlanCounts.get(plan) || 0) + 1);
    (u.participantProfile?.interestSubjectGroup || []).forEach((g) => interestCounts.set(g, (interestCounts.get(g) || 0) + 1));
  });

  const serializePending = (u, profile) => ({
    userId: u.id, fullName: toFullName(profile), nickname: profile?.nickname || null, createdAt: u.createdAt,
  });

  res.json({
    generationNo: latestCamp?.generationNo ?? null,
    staff: {
      total: approvedStaff.length,
      pending: staff.filter((u) => u.approvalStatus === 'PENDING').length,
      rejected: staff.filter((u) => u.approvalStatus === 'REJECTED').length,
      admins: approvedStaff.filter((u) => u.staffProfile?.isAdmin).length,
      noDepartment,
      byDepartment,
      byPosition,
      pendingList: staff.filter((u) => u.approvalStatus === 'PENDING').slice(0, 8).map((u) => serializePending(u, u.staffProfile)),
    },
    participants: {
      total: approvedParticipants.length,
      pending: participants.filter((u) => u.approvalStatus === 'PENDING').length,
      rejected: participants.filter((u) => u.approvalStatus === 'REJECTED').length,
      grouped: approvedParticipants.filter((u) => u.participantProfile?.groupId).length,
      ungrouped: approvedParticipants.filter((u) => !u.participantProfile?.groupId).length,
      byGroup,
      byCourse,
      byStudyPlan: [...studyPlanCounts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
      byInterestGroup: [...interestCounts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
      pendingList: participants.filter((u) => u.approvalStatus === 'PENDING').slice(0, 8).map((u) => serializePending(u, u.participantProfile)),
      ungroupedList: approvedParticipants.filter((u) => !u.participantProfile?.groupId).slice(0, 12).map((u) => ({
        userId: u.id, fullName: toFullName(u.participantProfile), nickname: u.participantProfile?.nickname || null,
        course: courseName.get(u.participantProfile?.courseFormatId) || '-',
      })),
    },
  });
}

// ==========================================
// งานวิชาการ (ตารางรายวิชา)
// ==========================================
async function getAcademic(req, res) {
  const prisma = await getPrisma();
  const [subjects, courseFormats, participants, scoreRows, attempts, sessions, classSchedules, documents, scoreWeight, gradeBands, oralBands] = await Promise.all([
    prisma.subject.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        instructors: { select: { user: { select: { staffProfile: { select: { prefix: true, firstName: true, lastName: true, nickname: true } } } } } },
        _count: { select: { scheduleEntries: true } },
      },
    }),
    prisma.courseFormat.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.participantProfile.findMany({ where: { user: { approvalStatus: 'APPROVED' } }, select: { id: true, courseFormatId: true } }),
    prisma.participantSubjectScore.findMany({ select: { subjectId: true, participantProfileId: true, explanationScore: true, achievementScore: true } }),
    prisma.oralExamAttempt.findMany({ select: { subjectId: true, participantProfileId: true, status: true, attemptNumber: true } }),
    prisma.oralExamSession.findMany({ select: { subjectId: true, status: true, startedAt: true } }),
    prisma.classSchedule.groupBy({ by: ['courseFormatId'], _count: { _all: true } }),
    prisma.studyDocument.groupBy({ by: ['courseFormatId'], _count: { _all: true } }),
    prisma.scoreWeightSetting.findUnique({ where: { id: 1 } }),
    prisma.gradeBand.count(),
    prisma.oralExamScoreBand.findMany({ orderBy: { attemptNumber: 'asc' }, select: { attemptNumber: true, scorePercent: true } }),
  ]);

  const courseName = new Map(courseFormats.map((c) => [c.id, c.name]));
  const participantsForSubject = (subject) => participants.filter((p) => subject.courseFormatId === null || p.courseFormatId === subject.courseFormatId);

  const rows = subjects.map((subject) => {
    const eligible = participantsForSubject(subject);
    const eligibleIds = new Set(eligible.map((p) => p.id));
    const subjectScores = scoreRows.filter((r) => r.subjectId === subject.id && eligibleIds.has(r.participantProfileId));
    const explanationRecorded = subjectScores.filter((r) => r.explanationScore !== null).length;
    const achievementRecorded = subjectScores.filter((r) => r.achievementScore !== null).length;
    const subjectAttempts = attempts.filter((a) => a.subjectId === subject.id);
    const passedParticipants = new Set(subjectAttempts.filter((a) => a.status === 'PASSED').map((a) => a.participantProfileId)).size;
    const failedAttempts = subjectAttempts.filter((a) => a.status === 'FAILED').length;
    const pendingAttempts = subjectAttempts.filter((a) => a.status === 'PENDING').length;
    const passedAttemptNumbers = subjectAttempts.filter((a) => a.status === 'PASSED').map((a) => a.attemptNumber);
    const subjectSessions = sessions.filter((s) => s.subjectId === subject.id);
    return {
      id: subject.id,
      name: subject.name,
      course: subject.courseFormatId === null ? 'ทั้งคู่' : (courseName.get(subject.courseFormatId) || '-'),
      requiresScoring: subject.requiresScoring,
      credits: subject.credits,
      explanationMaxScore: subject.explanationMaxScore,
      achievementMaxScore: subject.achievementMaxScore,
      instructors: subject.instructors.map((i) => i.user.staffProfile?.nickname || toFullName(i.user.staffProfile)),
      periods: subject._count.scheduleEntries,
      eligibleParticipants: eligible.length,
      explanationRecorded,
      achievementRecorded,
      oralExam: {
        passedParticipants,
        failedAttempts,
        pendingAttempts,
        avgPassedAttempt: passedAttemptNumbers.length ? Math.round((passedAttemptNumbers.reduce((s, n) => s + n, 0) / passedAttemptNumbers.length) * 10) / 10 : null,
        sessionsRun: subjectSessions.filter((s) => s.startedAt).length,
        activeSession: subjectSessions.some((s) => s.status !== 'CLOSED'),
      },
    };
  });

  res.json({
    subjects: rows,
    byCourse: courseFormats.map((c) => ({
      id: c.id,
      name: c.name,
      participants: participants.filter((p) => p.courseFormatId === c.id).length,
      subjects: subjects.filter((s) => s.courseFormatId === c.id).length,
      sharedSubjects: subjects.filter((s) => s.courseFormatId === null).length,
      classPeriods: classSchedules.find((r) => r.courseFormatId === c.id)?._count._all || 0,
      documents: documents.find((r) => r.courseFormatId === c.id)?._count._all || 0,
    })),
    sharedDocuments: documents.find((r) => r.courseFormatId === null)?._count._all || 0,
    settings: {
      explanationWeight: scoreWeight?.explanationWeight ?? 70,
      achievementWeight: scoreWeight?.achievementWeight ?? 30,
      gradeBands,
      oralExamBands: oralBands,
    },
  });
}

// ==========================================
// งานกิจกรรม (ตารางคะแนน กลุ่ม × กิจกรรม)
// ==========================================
async function getActivities(req, res) {
  const prisma = await getPrisma();
  const [activities, groups, scores] = await Promise.all([
    prisma.campActivity.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, createdAt: true } }),
    prisma.group.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, _count: { select: { participantProfiles: { where: { user: { approvalStatus: 'APPROVED' } } } } } } }),
    prisma.activityScore.findMany({ select: { activityId: true, groupId: true, score: true, updatedAt: true } }),
  ]);

  const rows = groups.map((g) => {
    const groupScores = {};
    let total = 0;
    scores.filter((s) => s.groupId === g.id).forEach((s) => {
      groupScores[s.activityId] = s.score;
      total += s.score;
    });
    return { id: g.id, name: g.name, memberCount: g._count.participantProfiles, total, scores: groupScores };
  }).sort((a, b) => b.total - a.total);

  const activityRows = activities.map((a) => {
    const aScores = scores.filter((s) => s.activityId === a.id);
    return {
      id: a.id,
      name: a.name,
      scoredGroups: aScores.length,
      avgScore: aScores.length ? Math.round((aScores.reduce((s, r) => s + r.score, 0) / aScores.length) * 10) / 10 : null,
      lastUpdated: aScores.length ? aScores.reduce((latest, r) => (r.updatedAt > latest ? r.updatedAt : latest), aScores[0].updatedAt) : null,
    };
  });

  res.json({ activities: activityRows, groups: rows, scoredCells: scores.length, expectedCells: activities.length * groups.length });
}

// ==========================================
// เว็บไซต์ & ระบบ
// ==========================================
async function getSystem(req, res) {
  const prisma = await getPrisma();
  const todayStart = bangkokDayStart(toBangkokDay(new Date()));
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);
  const [backups, failed30d, usersByRole, logsByRole7d, logsByAction7d, logsByEntity7d, settings, live, latestSnapshot, newsByTag, schedulesUpcoming, committeeVisible, galleryCount] = await Promise.all([
    prisma.campBackupRun.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
    prisma.campBackupRun.count({ where: { status: 'FAILED', startedAt: { gte: new Date(Date.now() - 30 * DAY_MS) } } }),
    prisma.user.groupBy({ by: ['role', 'approvalStatus'], _count: { _all: true } }),
    prisma.activityLog.groupBy({ by: ['actorRole'], where: { createdAt: { gte: sevenDaysAgo } }, _count: { _all: true } }),
    prisma.activityLog.groupBy({ by: ['action'], where: { createdAt: { gte: sevenDaysAgo } }, _count: { _all: true } }),
    prisma.activityLog.groupBy({ by: ['entityType'], where: { createdAt: { gte: sevenDaysAgo } }, _count: { _all: true }, orderBy: { _count: { entityType: 'desc' } }, take: 8 }),
    prisma.siteSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    readLiveDbMetrics().catch(() => null),
    prisma.usageDbSnapshot.findFirst({ orderBy: { day: 'desc' } }),
    prisma.news.groupBy({ by: ['tag'], _count: { _all: true } }),
    prisma.schedule.count({ where: { eventDate: { gte: todayStart } } }),
    prisma.committee.count({ where: { isVisible: true } }),
    prisma.galleryPhoto.count(),
  ]);

  const memory = process.memoryUsage();
  res.json({
    backups: { list: backups, failedLast30Days: failed30d, configured: isDriveConfigured(), intervalHours: Number(process.env.BACKUP_INTERVAL_HOURS) || 12 },
    integrations: {
      googleDrive: isDriveConfigured(),
      mail: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      sessionSecretSet: !!process.env.SESSION_SECRET,
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    users: usersByRole.map((r) => ({ role: r.role, status: r.approvalStatus, count: r._count._all })),
    logs: {
      byRole7d: logsByRole7d.map((r) => ({ role: r.actorRole, count: r._count._all })),
      byAction7d: logsByAction7d.map((r) => ({ action: r.action, count: r._count._all })),
      byEntity7d: logsByEntity7d.map((r) => ({ entityType: r.entityType, count: r._count._all })),
    },
    siteSettings: settings,
    content: {
      newsByTag: newsByTag.map((r) => ({ tag: r.tag, count: r._count._all })),
      upcomingSchedules: schedulesUpcoming,
      committeeVisible,
      galleryPhotos: galleryCount,
    },
    server: {
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      platform: process.platform,
      timezone: TIMEZONE,
    },
    database: live ? {
      databaseBytes: live.databaseBytes,
      totalRows: live.totalRows,
      sessionCount: live.sessionCount,
      connectionCount: live.connectionCount,
      tables: live.tableStats.slice(0, 12),
    } : null,
    latestSnapshot,
  });
}

// ==========================================
// การใช้งานเว็บไซต์ (สถิติจาก usageTracker + snapshot)
// ==========================================
const OTP_ROUTES = ['/api/auth/register/request-otp', '/api/auth/forgot-password'];

async function buildUsage(prisma, rangeKey) {
  const range = await resolveUsageRange(prisma, rangeKey);
  const today = range.endDay;
  const days = listDays(range.startDay, range.endDay);
  const last24hStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    hourlyRows, hourlyLast24h, activeUsersRows, endpointRows, registrations, approvalCounts, otpToday,
    snapshots, live, camps, allTimeActive, campHourly,
  ] = await Promise.all([
    prisma.usageHourlyStat.findMany({ where: { bucketStart: { gte: range.start, lt: range.end } }, orderBy: { bucketStart: 'asc' } }),
    prisma.usageHourlyStat.findMany({ where: { bucketStart: { gte: last24hStart } }, orderBy: { bucketStart: 'asc' } }),
    prisma.usageDailyActiveUser.findMany({ where: { day: { gte: toDateColumn(range.startDay), lte: toDateColumn(range.endDay) } }, select: { day: true, userId: true, role: true } }),
    prisma.usageEndpointDailyStat.findMany({ where: { day: { gte: toDateColumn(range.startDay), lte: toDateColumn(range.endDay) } } }),
    prisma.user.findMany({ where: { role: { in: ['STAFF', 'PARTICIPANT'] }, createdAt: { gte: range.start, lt: range.end } }, select: { role: true, createdAt: true, approvalStatus: true } }),
    prisma.user.groupBy({ by: ['approvalStatus'], where: { role: { in: ['STAFF', 'PARTICIPANT'] } }, _count: { _all: true } }),
    prisma.usageEndpointDailyStat.aggregate({ where: { day: toDateColumn(today), route: { in: OTP_ROUTES }, method: 'POST' }, _sum: { requestCount: true, clientErrorCount: true } }),
    prisma.usageDbSnapshot.findMany({ orderBy: { day: 'asc' } }),
    readLiveDbMetrics().catch(() => null),
    prisma.camp.findMany({ orderBy: { generationNo: 'asc' }, select: { generationNo: true, createdAt: true, isEnded: true } }),
    prisma.usageDailyActiveUser.findMany({ select: { day: true, userId: true } }),
    prisma.usageHourlyStat.findMany({ select: { bucketStart: true, apiRequests: true, pageViews: true, errorCount: true, activeUsers: true }, orderBy: { bucketStart: 'asc' } }),
  ]);

  // ---------- KPI ----------
  const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);
  const apiRequests = sum(hourlyRows, 'apiRequests');
  const pageViews = sum(hourlyRows, 'pageViews');
  const errors5xx = sum(hourlyRows, 'errorCount');
  const errors4xx = sum(hourlyRows, 'clientErrorCount');
  const distinctUsers = new Set(activeUsersRows.map((r) => r.userId)).size;
  const todayUsers = new Set(activeUsersRows.filter((r) => dateColumnToDay(r.day) === today).map((r) => r.userId)).size;

  // ---------- รายวัน ----------
  const activeByDay = days.map((day) => {
    const rows = activeUsersRows.filter((r) => dateColumnToDay(r.day) === day);
    return {
      day,
      total: new Set(rows.map((r) => r.userId)).size,
      participant: rows.filter((r) => r.role === 'PARTICIPANT').length,
      staff: rows.filter((r) => r.role === 'STAFF').length,
    };
  });
  const registrationsByDay = days.map((day) => {
    const rows = registrations.filter((u) => toBangkokDay(u.createdAt) === day);
    return { day, staff: rows.filter((u) => u.role === 'STAFF').length, participant: rows.filter((u) => u.role === 'PARTICIPANT').length };
  });
  const requestsByDay = days.map((day) => {
    const rows = hourlyRows.filter((r) => toBangkokDay(r.bucketStart) === day);
    return { day, apiRequests: sum(rows, 'apiRequests'), pageViews: sum(rows, 'pageViews'), errors: sum(rows, 'errorCount') };
  });

  // ---------- รายชั่วโมง 24 ชม. ล่าสุด (แปลงเป็นชั่วโมงไทย) ----------
  const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false });
  const localHour = (date) => Number(hourFormatter.format(date).replace(/\D/g, '')) % 24;
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' });
  const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

  const hourly24h = hourlyLast24h.map((r) => ({
    bucketStart: r.bucketStart, hour: localHour(r.bucketStart), apiRequests: r.apiRequests, pageViews: r.pageViews, activeUsers: r.activeUsers, errors: r.errorCount,
  }));

  // heatmap วัน × ชั่วโมง (รวมทั้งช่วง) + ชั่วโมงที่ใช้มากสุด
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  const byHour = Array(24).fill(0);
  hourlyRows.forEach((r) => {
    const h = localHour(r.bucketStart);
    const d = WEEKDAY_INDEX[weekdayFormatter.format(r.bucketStart)] ?? 0;
    const total = r.apiRequests + r.pageViews;
    heatmap[d][h] += total;
    byHour[h] += total;
  });
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakActiveUsers = hourlyRows.reduce((m, r) => Math.max(m, r.activeUsers), 0);

  // ---------- สัดส่วน ----------
  const breakdown = {
    roles: { guest: sum(hourlyRows, 'guestRequests'), participant: sum(hourlyRows, 'participantRequests'), staff: sum(hourlyRows, 'staffRequests'), webmanager: sum(hourlyRows, 'webmanagerRequests') },
    devices: { mobile: sum(hourlyRows, 'mobileRequests'), desktop: sum(hourlyRows, 'desktopRequests') },
    browsers: { chrome: sum(hourlyRows, 'chromeRequests'), safari: sum(hourlyRows, 'safariRequests'), line: sum(hourlyRows, 'lineRequests'), other: sum(hourlyRows, 'otherBrowserRequests') },
  };

  // ---------- endpoint ----------
  const endpointTotals = new Map();
  endpointRows.forEach((r) => {
    const key = `${r.method} ${r.route}`;
    const e = endpointTotals.get(key) || { method: r.method, route: r.route, requestCount: 0, totalDurationMs: 0, maxDurationMs: 0, errorCount: 0, clientErrorCount: 0 };
    e.requestCount += r.requestCount;
    e.totalDurationMs += r.totalDurationMs;
    e.maxDurationMs = Math.max(e.maxDurationMs, r.maxDurationMs);
    e.errorCount += r.errorCount;
    e.clientErrorCount += r.clientErrorCount;
    endpointTotals.set(key, e);
  });
  const endpoints = [...endpointTotals.values()].map((e) => ({ ...e, avgDurationMs: avg(e.totalDurationMs, e.requestCount) }));
  const topEndpoints = [...endpoints].sort((a, b) => b.requestCount - a.requestCount).slice(0, 8);
  const slowestEndpoints = endpoints.filter((e) => e.requestCount >= 3).sort((a, b) => b.avgDurationMs - a.avgDurationMs).slice(0, 8);
  const errorEndpoints = endpoints.filter((e) => e.errorCount > 0).sort((a, b) => b.errorCount - a.errorCount).slice(0, 5);

  // ---------- ฐานข้อมูล ----------
  const latestSnapshot = snapshots[snapshots.length - 1] || null;
  const snapshotAtOrBefore = (day) => [...snapshots].reverse().find((s) => dateColumnToDay(s.day) <= day) || null;
  const weekAgoSnapshot = snapshotAtOrBefore(shiftDay(today, -7));
  const monthAgoSnapshot = snapshotAtOrBefore(shiftDay(today, -30));
  const growth = (current, previous, key) => (current && previous ? current[key] - previous[key] : null);
  const dbCurrentBytes = live?.databaseBytes ?? latestSnapshot?.databaseBytes ?? 0;

  // ---------- เทียบข้ามค่าย (จากสถิติที่ไม่ถูกล้าง) ----------
  const campComparison = camps.map((camp, index) => {
    const start = camp.createdAt;
    const end = camps[index + 1] ? camps[index + 1].createdAt : new Date();
    const startDay = toBangkokDay(start);
    const endDay = toBangkokDay(end);
    const hours = campHourly.filter((r) => r.bucketStart >= start && r.bucketStart < end);
    const active = allTimeActive.filter((r) => { const d = dateColumnToDay(r.day); return d >= startDay && d <= endDay; });
    const dauByDay = new Map();
    active.forEach((r) => { const d = dateColumnToDay(r.day); dauByDay.set(d, (dauByDay.get(d) || 0) + 1); });
    const hourTotals = Array(24).fill(0);
    hours.forEach((r) => { hourTotals[localHour(r.bucketStart)] += r.apiRequests + r.pageViews; });
    const firstSnap = snapshotAtOrBefore(endDay) && snapshots.find((s) => dateColumnToDay(s.day) >= startDay);
    const lastSnap = snapshotAtOrBefore(endDay);
    return {
      generationNo: camp.generationNo,
      isEnded: camp.isEnded,
      startDay,
      endDay: camps[index + 1] ? endDay : null,
      uniqueUsers: new Set(active.map((r) => r.userId)).size,
      peakDau: Math.max(0, ...dauByDay.values()),
      apiRequests: sum(hours, 'apiRequests'),
      pageViews: sum(hours, 'pageViews'),
      errors5xx: sum(hours, 'errorCount'),
      peakHour: hours.length ? hourTotals.indexOf(Math.max(...hourTotals)) : null,
      dbGrowthBytes: firstSnap && lastSnap && firstSnap !== lastSnap ? lastSnap.databaseBytes - firstSnap.databaseBytes : null,
      storageGrowthBytes: firstSnap && lastSnap && firstSnap !== lastSnap ? lastSnap.storageBytes - firstSnap.storageBytes : null,
    };
  }).reverse();

  const approved = approvalCounts.find((r) => r.approvalStatus === 'APPROVED')?._count._all || 0;
  const pending = approvalCounts.find((r) => r.approvalStatus === 'PENDING')?._count._all || 0;
  const rejected = approvalCounts.find((r) => r.approvalStatus === 'REJECTED')?._count._all || 0;
  const peakRegistrationDay = registrationsByDay.reduce((best, d) => (d.staff + d.participant > (best ? best.staff + best.participant : 0) ? d : best), null);

  return {
    range: { key: range.key, startDay: range.startDay, endDay: range.endDay, days: days.length },
    trackingSince: campHourly[0]?.bucketStart || null,
    kpi: {
      dau: todayUsers,
      rangeUsers: distinctUsers,
      apiRequests,
      pageViews,
      avgResponseMs: avg(sum(hourlyRows, 'totalDurationMs'), apiRequests),
      maxResponseMs: hourlyRows.reduce((m, r) => Math.max(m, r.maxDurationMs), 0),
      errorRate5xx: pct(errors5xx, apiRequests),
      errorRate4xx: pct(errors4xx, apiRequests),
      errors5xx,
      errors4xx,
      sessionCount: live?.sessionCount ?? latestSnapshot?.sessionCount ?? 0,
      peakHour,
      peakActiveUsers,
      avgDailyUsers: days.length ? Math.round(activeByDay.reduce((s, d) => s + d.total, 0) / days.length) : 0,
    },
    registrations: {
      byDay: registrationsByDay,
      total: registrations.length,
      staff: registrations.filter((u) => u.role === 'STAFF').length,
      participant: registrations.filter((u) => u.role === 'PARTICIPANT').length,
      approved, pending, rejected,
      peakDay: peakRegistrationDay && peakRegistrationDay.staff + peakRegistrationDay.participant > 0 ? peakRegistrationDay : null,
      otpSentToday: otpToday._sum.requestCount || 0,
      otpRejectedToday: otpToday._sum.clientErrorCount || 0,
      otpDailyQuota: 500,
    },
    activeByDay,
    requestsByDay,
    hourly24h,
    heatmap,
    breakdown,
    endpoints: { top: topEndpoints, slowest: slowestEndpoints, errors: errorEndpoints, distinct: endpoints.length },
    database: {
      databaseBytes: dbCurrentBytes,
      totalRows: live?.totalRows ?? latestSnapshot?.totalRows ?? 0,
      connectionCount: live?.connectionCount ?? null,
      sessionCount: live?.sessionCount ?? 0,
      storageFileCount: latestSnapshot?.storageFileCount ?? 0,
      storageBytes: latestSnapshot?.storageBytes ?? 0,
      storageConfigured: isImageStorageConfigured(),
      weeklyGrowthBytes: growth(latestSnapshot, weekAgoSnapshot, 'databaseBytes'),
      monthlyGrowthBytes: growth(latestSnapshot, monthAgoSnapshot, 'databaseBytes'),
      storageWeeklyGrowthBytes: growth(latestSnapshot, weekAgoSnapshot, 'storageBytes'),
      snapshotDay: latestSnapshot ? dateColumnToDay(latestSnapshot.day) : null,
      tables: (live?.tableStats || latestSnapshot?.tableSizes || []).slice(0, 8),
      history: snapshots.slice(-60).map((s) => ({ day: dateColumnToDay(s.day), databaseBytes: s.databaseBytes, storageBytes: s.storageBytes, totalRows: s.totalRows })),
      serverRssBytes: process.memoryUsage().rss,
      uptimeSeconds: Math.round(process.uptime()),
    },
    campComparison,
  };
}

async function getUsage(req, res) {
  const rangeKey = ['today', '7d', '30d', 'camp'].includes(req.query.range) ? req.query.range : '7d';
  const prisma = await getPrisma();
  res.json(await buildUsage(prisma, rangeKey));
}

// ส่งออก CSV (UTF-8 BOM ให้ Excel เปิดภาษาไทยได้) type = hourly | endpoints | users | snapshots
function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sendCsv(res, filename, header, rows) {
  const lines = [header.join(','), ...rows.map((row) => row.map(csvEscape).join(','))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`﻿${lines.join('\n')}`);
}

async function exportUsageCsv(req, res) {
  const rangeKey = ['today', '7d', '30d', 'camp'].includes(req.query.range) ? req.query.range : '30d';
  const type = ['hourly', 'endpoints', 'users', 'snapshots'].includes(req.query.type) ? req.query.type : 'hourly';
  const prisma = await getPrisma();
  const range = await resolveUsageRange(prisma, rangeKey);
  const suffix = `${range.startDay}_${range.endDay}`;
  const localDateTime = new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

  if (type === 'hourly') {
    const rows = await prisma.usageHourlyStat.findMany({ where: { bucketStart: { gte: range.start, lt: range.end } }, orderBy: { bucketStart: 'asc' } });
    return sendCsv(res, `usage-hourly_${suffix}.csv`,
      ['hour_bangkok', 'api_requests', 'page_views', 'errors_5xx', 'errors_4xx', 'avg_response_ms', 'max_response_ms', 'active_users', 'guest', 'participant', 'staff', 'webmanager', 'mobile', 'desktop', 'chrome', 'safari', 'line', 'other_browser'],
      rows.map((r) => [localDateTime.format(r.bucketStart), r.apiRequests, r.pageViews, r.errorCount, r.clientErrorCount, avg(r.totalDurationMs, r.apiRequests), r.maxDurationMs, r.activeUsers,
        r.guestRequests, r.participantRequests, r.staffRequests, r.webmanagerRequests, r.mobileRequests, r.desktopRequests, r.chromeRequests, r.safariRequests, r.lineRequests, r.otherBrowserRequests]));
  }
  if (type === 'endpoints') {
    const rows = await prisma.usageEndpointDailyStat.findMany({ where: { day: { gte: toDateColumn(range.startDay), lte: toDateColumn(range.endDay) } }, orderBy: [{ day: 'asc' }, { requestCount: 'desc' }] });
    return sendCsv(res, `usage-endpoints_${suffix}.csv`,
      ['day', 'method', 'route', 'requests', 'avg_response_ms', 'max_response_ms', 'errors_5xx', 'errors_4xx'],
      rows.map((r) => [dateColumnToDay(r.day), r.method, r.route, r.requestCount, avg(r.totalDurationMs, r.requestCount), r.maxDurationMs, r.errorCount, r.clientErrorCount]));
  }
  if (type === 'users') {
    const rows = await prisma.usageDailyActiveUser.groupBy({ by: ['day', 'role'], where: { day: { gte: toDateColumn(range.startDay), lte: toDateColumn(range.endDay) } }, _count: { _all: true }, orderBy: [{ day: 'asc' }, { role: 'asc' }] });
    return sendCsv(res, `usage-active-users_${suffix}.csv`, ['day', 'role', 'active_users'], rows.map((r) => [dateColumnToDay(r.day), r.role, r._count._all]));
  }
  const rows = await prisma.usageDbSnapshot.findMany({ orderBy: { day: 'asc' } });
  return sendCsv(res, 'usage-db-snapshots.csv',
    ['day', 'camp_generation', 'database_bytes', 'total_rows_estimate', 'active_sessions', 'storage_files', 'storage_bytes'],
    rows.map((r) => [dateColumnToDay(r.day), r.generationNo ?? '', r.databaseBytes, r.totalRows, r.sessionCount, r.storageFileCount, r.storageBytes]));
}

module.exports = { getSummary, getPeople, getAcademic, getActivities, getSystem, getUsage, exportUsageCsv };
