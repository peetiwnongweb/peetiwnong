// ==========================================
// แดชบอร์ด Admin (4 แท็บ: ภาพรวม/บุคลากร/งานวิชาการ/งานกิจกรรม) - โหลดต่อจาก admin.js จึงใช้ helper ของไฟล์นั้นได้ (escapeHtml, showToast, switchAdminSection, switchAdminTab, Loader)
// ต่างจากแดชบอร์ด WebManager (6 แท็บ) ตรงที่ไม่มี "เว็บไซต์ & ระบบ" กับ "การใช้งานเว็บไซต์" ซึ่งเป็นข้อมูลระดับ Owner เท่านั้น (ดู backend/routes/dashboardRoutes.js)
// แท็บบุคลากร/งานวิชาการ/งานกิจกรรม ก๊อปมาจาก fontend/webmanager/js/webmanager-dashboard.js (ใช้ endpoint เดียวกัน) ปรับปุ่ม "ไปหน้าอนุมัติ" ให้ชี้มาที่หน้า /admin เอง
// แท็บภาพรวมไม่มี endpoint แยก (/api/dashboard/summary เป็นของ WebManager เท่านั้น) แต่ประกอบขึ้นจากข้อมูล 3 แท็บข้างต้นแทน
// ==========================================

const ADMIN_DASHBOARD_TAB_STORAGE_KEY = 'adminDashboardTab';
const ADMIN_DASHBOARD_TABS = ['overview', 'people', 'academic', 'activities'];
const ADMIN_DASHBOARD_TAB_ENDPOINTS = {
    people: '/api/dashboard/people',
    academic: '/api/dashboard/academic',
    activities: '/api/dashboard/activities',
};

const adminDashboardState = {
    tab: 'overview',
    loaded: new Set(),
    data: {},
};

// ==========================================
// helper จัดรูปแบบ (ก๊อปจาก webmanager-dashboard.js เฉพาะที่ใช้ใน 3 แท็บนี้)
// ==========================================
function dashNum(value) {
    return Number(value || 0).toLocaleString('th-TH');
}

function dashDateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
}

function dashRelativeTime(value) {
    if (!value) return '-';
    const diffMs = Date.now() - new Date(value).getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return 'เมื่อสักครู่';
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} ชม. ที่แล้ว`;
    const days = Math.round(hours / 24);
    return `${days} วันที่แล้ว`;
}

function dashPct(part, total) {
    return total > 0 ? Math.round((part / total) * 100) : 0;
}

const DASH_ICONS = {
    users: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>',
    staff: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.55 50.55 0 0112 13.489a50.55 50.55 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>',
    book: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>',
    doc: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>',
    flag: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>',
    group: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>',
    clock: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
    bolt: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>',
};

function dashStatCard({ icon, color = 'brand', value, label, suffix = '' }) {
    return `
        <div class="dash-card dash-stat">
            <div class="dash-ico ${color}">${DASH_ICONS[icon] || ''}</div>
            <div>
                <div class="dash-val">${value}${suffix ? ` <small>${suffix}</small>` : ''}</div>
                <div class="dash-lbl">${label}</div>
            </div>
        </div>
    `;
}

// แถบสัดส่วน 1 ชุด - items: [{ name, count, cls? }] ความยาวเทียบกับค่ามากสุด (หรือ max ที่ส่งมา)
function dashBarRows(items, { cls = '', max = null, tight = false, suffix = '', format = dashNum } = {}) {
    if (!items || items.length === 0) return dashEmpty('ยังไม่มีข้อมูล');
    const top = max ?? Math.max(1, ...items.map((i) => i.count));
    return `
        <div class="dash-bars${tight ? ' tight' : ''}">
            ${items.map((item) => `
                <div class="dash-bar-row">
                    <span class="dash-bar-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                    <div class="dash-bar"><i class="${item.cls || cls}" style="width:${Math.min(100, Math.round((item.count / top) * 100))}%"></i></div>
                    <span class="dash-bar-cnt">${format(item.count)}${suffix}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function dashKv(rows) {
    return `<div class="dash-kv">${rows.map(([k, v]) => `<div class="dash-kv-row"><span class="dash-kv-k">${k}</span><span class="dash-kv-v">${v}</span></div>`).join('')}</div>`;
}

function dashTag(text, kind = 'muted') {
    return `<span class="dash-tag ${kind}">${text}</span>`;
}

function dashEmpty(text) {
    return `<div class="dash-empty">${text}</div>`;
}

function dashSkeleton(count = 3) {
    return `<div class="dash-skeleton">${'<div></div>'.repeat(count)}</div>`;
}

// STUDY_PLAN_LABELS/INTEREST_SUBJECT_GROUP_LABELS ประกาศไว้ใน admin.js (โหลดก่อนไฟล์นี้) ใช้ร่วมกับหน้า "การลงทะเบียน" ด้วย

// ==========================================
// แท็บ 1: ภาพรวม (ไม่มี endpoint แยก - ประกอบจากข้อมูล บุคลากร/งานวิชาการ/งานกิจกรรม)
// ==========================================
function renderAdminDashboardOverview(panel, { people, academic, activities }) {
    const s = people.staff;
    const p = people.participants;
    const noInstructor = academic.subjects.filter((sub) => sub.instructors.length === 0).length;
    const openExamSessions = academic.subjects.filter((sub) => sub.oralExam.activeSession).length;

    panel.innerHTML = `
        <div class="dash-section-title">
            บุคลากร
            <span class="dash-chip" style="margin-left:auto"><button type="button" class="dash-link" onclick="switchAdminDashboardTab('people')">ดูรายละเอียด</button></span>
        </div>
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'staff', color: 'brand', value: dashNum(s.total), label: `พี่ค่ายที่อนุมัติแล้ว · รออนุมัติ ${dashNum(s.pending)}` })}
            ${dashStatCard({ icon: 'check', color: 'green', value: dashNum(s.admins), label: 'ได้รับสิทธิ์ผู้ดูแลระบบ (/admin)' })}
            ${dashStatCard({ icon: 'users', color: 'blue', value: dashNum(p.total), label: `น้องค่ายที่อนุมัติแล้ว · รออนุมัติ ${dashNum(p.pending)}` })}
            ${dashStatCard({ icon: 'group', color: p.ungrouped > 0 ? 'rose' : 'green', value: dashNum(p.ungrouped), label: 'น้องค่ายที่ยังไม่ได้จัดกลุ่ม' })}
        </div>

        <div class="dash-section-title">
            งานวิชาการ
            <span class="dash-chip" style="margin-left:auto"><button type="button" class="dash-link" onclick="switchAdminDashboardTab('academic')">ดูรายละเอียด</button></span>
        </div>
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'book', color: 'brand', value: dashNum(academic.subjects.length), label: `รายวิชาทั้งหมด · เก็บคะแนน ${academic.subjects.filter((sub) => sub.requiresScoring).length} วิชา` })}
            ${dashStatCard({ icon: 'clock', color: noInstructor > 0 ? 'rose' : 'green', value: dashNum(noInstructor), label: 'วิชาที่ยังไม่มีผู้สอน' })}
            ${dashStatCard({ icon: 'bolt', color: 'amber', value: dashNum(openExamSessions), label: 'วิชาที่กำลังเปิดสอบอธิบายอยู่' })}
            ${dashStatCard({ icon: 'doc', color: 'green', value: dashNum(academic.sharedDocuments), label: 'เอกสารทั่วไป (ทุกคอร์สเห็น)' })}
        </div>

        <div class="dash-section-title">
            งานกิจกรรม
            <span class="dash-chip" style="margin-left:auto"><button type="button" class="dash-link" onclick="switchAdminDashboardTab('activities')">ดูรายละเอียด</button></span>
        </div>
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'flag', color: 'rose', value: dashNum(activities.activities.length), label: 'กิจกรรมสันทนาการ' })}
            ${dashStatCard({ icon: 'group', color: 'green', value: dashNum(activities.groups.length), label: 'กลุ่มน้องค่าย' })}
            ${dashStatCard({ icon: 'check', color: activities.scoredCells < activities.expectedCells ? 'amber' : 'green', value: `${dashNum(activities.scoredCells)} / ${dashNum(activities.expectedCells)}`, label: `ช่องคะแนนที่บันทึกแล้ว (${dashPct(activities.scoredCells, activities.expectedCells)}%)` })}
            ${dashStatCard({ icon: 'bolt', color: 'brand', value: activities.groups[0] ? escapeHtml(activities.groups[0].name) : '-', label: activities.groups[0] ? `กลุ่มอันดับ 1 · ${dashNum(activities.groups[0].total)} คะแนน` : 'ยังไม่มีคะแนน' })}
        </div>
    `;
}

// ==========================================
// แท็บ 2: บุคลากร (ก๊อปจาก webmanager-dashboard.js - ปรับปุ่ม "ไปหน้าอนุมัติ" ให้ชี้ไปหน้าจัดการผู้ใช้งานของ /admin เอง)
// ==========================================
function renderDashboardPeople(panel, d) {
    const s = d.staff;
    const p = d.participants;
    const pendingList = (list, role, tab) => (list.length === 0 ? dashEmpty('ไม่มีคำขอค้าง') : `<table class="dash-table">${list.map((u) => `
        <tr><td>${escapeHtml(u.fullName)}${u.nickname ? ` <span class="dash-table-sub" style="display:inline">(${escapeHtml(u.nickname)})</span>` : ''}</td><td class="dash-num" style="color:var(--slate-400)">${dashRelativeTime(u.createdAt)}</td></tr>`).join('')}</table>
        <p class="dash-note"><button type="button" class="dash-link" onclick="dashboardGo('user', '${tab}')">ไปหน้าอนุมัติ${role}</button></p>`);

    panel.innerHTML = `
        <div class="dash-section-title">พี่ค่าย</div>
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'staff', color: 'brand', value: dashNum(s.total), label: 'พี่ค่ายที่อนุมัติแล้ว' })}
            ${dashStatCard({ icon: 'clock', color: 'amber', value: dashNum(s.pending), label: `รออนุมัติ · ไม่อนุมัติ ${dashNum(s.rejected)}` })}
            ${dashStatCard({ icon: 'check', color: 'green', value: dashNum(s.admins), label: 'ได้รับสิทธิ์ผู้ดูแลระบบ (/admin)' })}
            ${dashStatCard({ icon: 'users', color: s.noDepartment > 0 ? 'rose' : 'blue', value: dashNum(s.noDepartment), label: 'ยังไม่ระบุฝ่าย' })}
        </div>
        <div class="dash-grid dash-grid-3">
            <div class="dash-card" style="grid-column: span 2">
                <p class="dash-card-h">พี่ค่ายแยกตามฝ่าย · ตำแหน่ง</p>
                ${s.byDepartment.length === 0 ? dashEmpty('ยังไม่มีฝ่าย') : `<div class="dash-table-wrap"><table class="dash-table"><tr><th>ฝ่าย</th><th class="dash-num">จำนวน</th><th>ตำแหน่ง</th></tr>${s.byDepartment.map((dep) => `
                    <tr><td class="dash-strong">${escapeHtml(dep.name)}</td><td class="dash-num dash-strong">${dashNum(dep.count)}</td><td>${dep.positions.length ? dep.positions.map((pos) => `${dashTag(`${escapeHtml(pos.name)} ${pos.count}`, pos.name === 'หัวหน้าฝ่าย' ? 'brand' : 'muted')}`).join(' ') : '<span style="color:var(--slate-300)">-</span>'}</td></tr>`).join('')}</table></div>`}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">คำขอพี่ค่ายรออนุมัติ</p>
                ${pendingList(s.pendingList, 'พี่ค่าย', 'staff-users')}
                <p class="dash-card-h" style="margin-top:1.2rem">ตำแหน่งทั้งหมด</p>
                ${dashBarRows(s.byPosition, { tight: true })}
            </div>
        </div>

        <div class="dash-section-title">น้องค่าย${d.generationNo ? ` <span class="dash-chip">ค่ายครั้งที่ ${d.generationNo}</span>` : ''}</div>
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'users', color: 'blue', value: dashNum(p.total), label: 'น้องค่ายที่อนุมัติแล้ว' })}
            ${dashStatCard({ icon: 'clock', color: 'amber', value: dashNum(p.pending), label: `รออนุมัติ · ไม่อนุมัติ ${dashNum(p.rejected)}` })}
            ${dashStatCard({ icon: 'group', color: 'green', value: dashNum(p.grouped), label: 'จัดกลุ่มแล้ว' })}
            ${dashStatCard({ icon: 'group', color: p.ungrouped > 0 ? 'rose' : 'green', value: dashNum(p.ungrouped), label: 'ยังไม่ได้จัดกลุ่ม' })}
        </div>
        <div class="dash-grid dash-grid-3">
            <div class="dash-card">
                <p class="dash-card-h">สมาชิกต่อกลุ่ม</p>
                ${dashBarRows(p.byGroup, { cls: 'green', tight: true })}
                ${p.byGroup.length ? `<p class="dash-note">เฉลี่ย ${(p.grouped / Math.max(1, p.byGroup.length)).toFixed(1)} คน/กลุ่ม · กลุ่มที่ต่างจากค่าเฉลี่ยมากควรเกลี่ยใหม่</p>` : ''}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">คอร์ส · แผนการเรียน</p>
                ${dashBarRows(p.byCourse, { cls: 'blue', tight: true })}
                <div style="margin-top:1rem">${dashBarRows(p.byStudyPlan.map((sp) => ({ name: sp.key === 'UNKNOWN' ? 'ไม่ระบุ' : (STUDY_PLAN_LABELS[sp.key] || sp.key), count: sp.count })), { cls: 'violet', tight: true })}</div>
            </div>
            <div class="dash-card">
                <p class="dash-card-h">กลุ่มวิชาที่สนใจ (เลือกได้หลายข้อ)</p>
                ${dashBarRows(p.byInterestGroup.map((g) => ({ name: INTEREST_SUBJECT_GROUP_LABELS[g.key] || g.key, count: g.count })), { cls: 'amber', tight: true })}
            </div>
        </div>
        <div class="dash-grid dash-grid-2">
            <div class="dash-card">
                <p class="dash-card-h">คำขอน้องค่ายรออนุมัติ</p>
                ${pendingList(p.pendingList, 'น้องค่าย', 'participant-users')}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">น้องค่ายที่ยังไม่มีกลุ่ม</p>
                ${p.ungroupedList.length === 0 ? dashEmpty('ทุกคนมีกลุ่มแล้ว') : `<table class="dash-table">${p.ungroupedList.map((u) => `
                    <tr><td>${escapeHtml(u.fullName)}${u.nickname ? ` <span style="color:var(--slate-400)">(${escapeHtml(u.nickname)})</span>` : ''}</td><td class="dash-num">${dashTag(escapeHtml(u.course), 'info')}</td></tr>`).join('')}</table>
                    ${p.ungrouped > p.ungroupedList.length ? `<p class="dash-note">และอีก ${p.ungrouped - p.ungroupedList.length} คน</p>` : ''}`}
            </div>
        </div>
    `;
}

// ==========================================
// แท็บ 3: งานวิชาการ (ก๊อปจาก webmanager-dashboard.js ทั้งดุ้น - ไม่มีปุ่มเชื่อมไปหน้าอื่นที่ต้องปรับ)
// ==========================================
function renderDashboardAcademic(panel, d) {
    const scoringRows = d.subjects.filter((s) => s.requiresScoring);
    const subjectRow = (s) => {
        const expl = s.requiresScoring ? `${s.explanationRecorded}/${s.eligibleParticipants}` : '-';
        const ach = s.requiresScoring ? `${s.achievementRecorded}/${s.eligibleParticipants}` : '-';
        const scoreTag = !s.requiresScoring ? dashTag('ไม่เก็บคะแนน', 'muted')
            : s.eligibleParticipants === 0 ? dashTag('ไม่มีน้อง', 'muted')
                : (s.explanationRecorded >= s.eligibleParticipants && s.achievementRecorded >= s.eligibleParticipants) ? dashTag('ครบ', 'ok')
                    : (s.explanationRecorded === 0 && s.achievementRecorded === 0) ? dashTag('ยังไม่เริ่ม', 'bad')
                        : dashTag(`${dashPct(s.explanationRecorded + s.achievementRecorded, s.eligibleParticipants * 2)}%`, 'wait');
        const oral = s.oralExam;
        return `
            <tr>
                <td class="dash-strong">${escapeHtml(s.name)}${oral.activeSession ? ` ${dashTag('เปิดสอบอยู่', 'brand')}` : ''}</td>
                <td>${dashTag(escapeHtml(s.course), s.course === 'ทั้งคู่' ? 'ok' : 'info')}</td>
                <td>${s.instructors.length ? escapeHtml(s.instructors.join(', ')) : dashTag('ยังไม่มีผู้สอน', 'bad')}</td>
                <td class="dash-num">${s.credits}</td>
                <td class="dash-num">${dashNum(s.periods)}</td>
                <td class="dash-num">${expl} <span class="dash-table-sub">เต็ม ${s.explanationMaxScore}</span></td>
                <td class="dash-num">${ach} <span class="dash-table-sub">เต็ม ${s.achievementMaxScore}</span></td>
                <td class="dash-num">${scoreTag}</td>
                <td class="dash-num">${s.requiresScoring ? `${dashNum(oral.passedParticipants)} / ${dashNum(s.eligibleParticipants)}${oral.pendingAttempts ? ` <span class="dash-table-sub">รอ ${oral.pendingAttempts}</span>` : ''}` : '-'}</td>
                <td class="dash-num">${oral.avgPassedAttempt ? `ครั้งที่ ${oral.avgPassedAttempt}` : '-'} <span class="dash-table-sub">${dashNum(oral.sessionsRun)} รอบ · ตก ${dashNum(oral.failedAttempts)}</span></td>
            </tr>
        `;
    };

    panel.innerHTML = `
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'book', color: 'brand', value: dashNum(d.subjects.length), label: `รายวิชาทั้งหมด · เก็บคะแนน ${scoringRows.length} วิชา` })}
            ${d.byCourse.map((c) => dashStatCard({ icon: 'users', color: 'blue', value: dashNum(c.participants), label: `น้องคอร์ส${escapeHtml(c.name)} · ${c.subjects + c.sharedSubjects} วิชา · ${c.classPeriods} คาบ · เอกสาร ${c.documents}` })).join('')}
            ${dashStatCard({ icon: 'doc', color: 'green', value: dashNum(d.sharedDocuments), label: 'เอกสารทั่วไป (ทุกคอร์สเห็น)' })}
        </div>
        <div class="dash-card" style="margin-top:1rem">
            <div class="dash-card-h-row"><p class="dash-card-h">รายวิชาทั้งหมด · ความคืบหน้ารายวิชา</p><span class="dash-chip">คะแนน = จำนวนน้องที่บันทึกแล้ว / น้องในคอร์สนั้น</span></div>
            ${d.subjects.length === 0 ? dashEmpty('ยังไม่มีรายวิชา') : `<div class="dash-table-wrap"><table class="dash-table">
                <tr><th>วิชา</th><th>คอร์ส</th><th>ผู้สอน</th><th class="dash-num">หน่วยกิต</th><th class="dash-num">คาบ</th><th class="dash-num">คะแนนอธิบาย</th><th class="dash-num">คะแนนสอบ</th><th class="dash-num">สถานะ</th><th class="dash-num">สอบอธิบายผ่าน</th><th class="dash-num">ผ่านเฉลี่ย</th></tr>
                ${d.subjects.map(subjectRow).join('')}
            </table></div>`}
        </div>
        <div class="dash-grid dash-grid-3" style="margin-top:1rem">
            <div class="dash-card">
                <p class="dash-card-h">การตั้งค่าคะแนนกลาง</p>
                ${dashKv([
                    ['สัดส่วน อธิบาย : สอบ', `${d.settings.explanationWeight} : ${d.settings.achievementWeight}`],
                    ['ช่วงเกรด (grade band)', `${d.settings.gradeBands} ช่วง`],
                    ['คะแนนสอบอธิบายตามครั้ง', d.settings.oralExamBands.length ? d.settings.oralExamBands.map((b) => `ครั้ง ${b.attemptNumber}=${b.scorePercent}%`).join(' · ') : '-'],
                ])}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">วิชาที่ต้องตามงาน</p>
                ${(() => {
                    const noInstructor = d.subjects.filter((s) => s.instructors.length === 0);
                    const notStarted = scoringRows.filter((s) => s.eligibleParticipants > 0 && s.explanationRecorded === 0 && s.achievementRecorded === 0);
                    const noPeriod = d.subjects.filter((s) => s.periods === 0);
                    const items = [
                        noInstructor.length ? `ไม่มีผู้สอน: ${escapeHtml(noInstructor.map((s) => s.name).join(', '))}` : null,
                        notStarted.length ? `ยังไม่มีคะแนนเลย: ${escapeHtml(notStarted.map((s) => s.name).join(', '))}` : null,
                        noPeriod.length ? `ยังไม่อยู่ในตารางเรียน: ${escapeHtml(noPeriod.map((s) => s.name).join(', '))}` : null,
                    ].filter(Boolean);
                    return items.length ? `<ul style="margin:0;padding-left:1.1rem;font-size:.84rem;color:var(--slate-700);line-height:1.7">${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : `<div class="dash-all-clear">${DASH_ICONS.check.replace('<svg', '<svg style="width:1.25rem;height:1.25rem"')} ทุกวิชามีผู้สอน มีคะแนน และอยู่ในตารางเรียนแล้ว</div>`;
                })()}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">สอบอธิบาย · ผ่านแล้วต่อวิชา</p>
                ${dashBarRows(scoringRows.map((s) => ({ name: s.name, count: s.oralExam.passedParticipants })), { cls: 'green', max: Math.max(1, ...scoringRows.map((s) => s.eligibleParticipants)), tight: true })}
            </div>
        </div>
    `;
}

// ==========================================
// แท็บ 4: งานกิจกรรม (ก๊อปจาก webmanager-dashboard.js ทั้งดุ้น)
// ==========================================
function renderDashboardActivities(panel, d) {
    const matrix = d.activities.length === 0 || d.groups.length === 0
        ? dashEmpty(d.activities.length === 0 ? 'ยังไม่มีกิจกรรม (ฝ่ายกิจกรรมสร้างได้ที่หน้าพี่ค่าย)' : 'ยังไม่มีกลุ่มน้องค่าย')
        : `<div class="dash-table-wrap"><table class="dash-table dash-matrix">
            <tr><th>กลุ่ม</th><th class="dash-num">สมาชิก</th>${d.activities.map((a) => `<th style="text-align:center" title="${escapeHtml(a.name)}">${escapeHtml(a.name.length > 14 ? `${a.name.slice(0, 13)}…` : a.name)}</th>`).join('')}<th class="dash-num">รวม</th></tr>
            ${d.groups.map((g, i) => `<tr>
                <td><span class="dash-rank r${i + 1}">${i + 1}</span> <span class="dash-strong">${escapeHtml(g.name)}</span></td>
                <td class="dash-num">${dashNum(g.memberCount)}</td>
                ${d.activities.map((a) => (g.scores[a.id] === undefined ? '<td class="cell-empty">–</td>' : `<td class="cell-score">${dashNum(g.scores[a.id])}</td>`)).join('')}
                <td class="dash-num dash-strong">${dashNum(g.total)}</td>
            </tr>`).join('')}
        </table></div>`;

    panel.innerHTML = `
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'flag', color: 'rose', value: dashNum(d.activities.length), label: 'กิจกรรมสันทนาการ' })}
            ${dashStatCard({ icon: 'group', color: 'green', value: dashNum(d.groups.length), label: 'กลุ่มน้องค่าย' })}
            ${dashStatCard({ icon: 'check', color: d.scoredCells < d.expectedCells ? 'amber' : 'green', value: `${dashNum(d.scoredCells)} / ${dashNum(d.expectedCells)}`, label: `ช่องคะแนนที่บันทึกแล้ว (${dashPct(d.scoredCells, d.expectedCells)}%)` })}
            ${dashStatCard({ icon: 'bolt', color: 'brand', value: d.groups[0] ? escapeHtml(d.groups[0].name) : '-', label: d.groups[0] ? `กลุ่มอันดับ 1 · ${dashNum(d.groups[0].total)} คะแนน` : 'ยังไม่มีคะแนน' })}
        </div>
        <div class="dash-card" style="margin-top:1rem">
            <div class="dash-card-h-row"><p class="dash-card-h">ตารางคะแนน กลุ่ม × กิจกรรม (เรียงตามคะแนนรวม)</p><span class="dash-chip">– = ยังไม่ได้ให้คะแนน</span></div>
            ${matrix}
        </div>
        <div class="dash-grid dash-grid-2" style="margin-top:1rem">
            <div class="dash-card">
                <p class="dash-card-h">กิจกรรมแต่ละรายการ</p>
                ${d.activities.length === 0 ? dashEmpty('ยังไม่มีกิจกรรม') : `<table class="dash-table"><tr><th>กิจกรรม</th><th class="dash-num">ให้คะแนนแล้ว</th><th class="dash-num">เฉลี่ย</th><th class="dash-num">อัปเดตล่าสุด</th></tr>${d.activities.map((a) => `
                    <tr><td class="dash-strong">${escapeHtml(a.name)}</td><td class="dash-num">${a.scoredGroups} / ${d.groups.length} ${a.scoredGroups >= d.groups.length ? dashTag('ครบ', 'ok') : (a.scoredGroups === 0 ? dashTag('ยังไม่เริ่ม', 'muted') : dashTag('ไม่ครบ', 'wait'))}</td><td class="dash-num">${a.avgScore ?? '-'}</td><td class="dash-num" style="color:var(--slate-400)">${a.lastUpdated ? dashDateTime(a.lastUpdated) : '-'}</td></tr>`).join('')}</table>`}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">คะแนนรวมต่อกลุ่ม</p>
                ${dashBarRows(d.groups.map((g) => ({ name: g.name, count: g.total })), { cls: 'green', tight: true })}
            </div>
        </div>
    `;
}

const ADMIN_DASHBOARD_RENDERERS = {
    people: renderDashboardPeople,
    academic: renderDashboardAcademic,
    activities: renderDashboardActivities,
};

// ==========================================
// glue: สลับแท็บ / โหลดข้อมูล
// ==========================================
function initAdminDashboard() {
    const savedTab = localStorage.getItem(ADMIN_DASHBOARD_TAB_STORAGE_KEY);
    if (ADMIN_DASHBOARD_TABS.includes(savedTab)) adminDashboardState.tab = savedTab;
    applyAdminDashboardTabClasses();
    const loads = [loadAdminDashboardTab('overview')];
    if (adminDashboardState.tab !== 'overview') loads.push(loadAdminDashboardTab(adminDashboardState.tab));
    return Promise.allSettled(loads);
}

// กระโดดจากแดชบอร์ดไปหน้าจัดการผู้ใช้งานจริง (ใช้ในปุ่ม "ไปหน้าอนุมัติ" ของแท็บบุคลากร)
function dashboardGo(section, tab = null) {
    switchAdminSection(section);
    if (tab) switchAdminTab(tab);
}

function applyAdminDashboardTabClasses() {
    document.querySelectorAll('#admin-section-dashboard .dashboard-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.dashboardTab === adminDashboardState.tab));
    document.querySelectorAll('#admin-section-dashboard .dashboard-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `dashboard-panel-${adminDashboardState.tab}`));
}

function switchAdminDashboardTab(tab) {
    if (!ADMIN_DASHBOARD_TABS.includes(tab)) return;
    adminDashboardState.tab = tab;
    localStorage.setItem(ADMIN_DASHBOARD_TAB_STORAGE_KEY, tab);
    applyAdminDashboardTabClasses();
    if (!adminDashboardState.loaded.has(tab)) loadAdminDashboardTab(tab);
}

function setAdminDashboardRefreshSpinning(spinning) {
    const btn = document.getElementById('dashboard-refresh-btn');
    if (btn) {
        btn.classList.toggle('is-spinning', spinning);
        btn.disabled = spinning;
    }
}

function refreshAdminDashboard() {
    setAdminDashboardRefreshSpinning(true);
    loadAdminDashboardTab(adminDashboardState.tab, { force: true }).finally(() => setAdminDashboardRefreshSpinning(false));
}

// ดึงข้อมูล 1 แท็บ (people/academic/activities) เก็บ cache ไว้ใน adminDashboardState.data ให้แท็บภาพรวมเรียกซ้ำได้โดยไม่ยิง fetch ซ้ำ
// เก็บ promise ที่กำลังโหลดอยู่ด้วย (adminDashboardPending) เพราะตอนโหลดหน้าแรก initAdminDashboard() เรียก loadAdminDashboardTab('overview') (ซึ่งขอทั้ง people/academic/activities พร้อมกัน)
// กับแท็บที่จำไว้ล่าสุด (เช่น 'people') พร้อมกันแบบ Promise.allSettled - ถ้าไม่กันจุดนี้ไว้ ทั้งสองฝั่งจะยังไม่เห็น cache ทันเวลากัน เลยยิง fetch ซ้ำกันเอง
const adminDashboardPending = {};
async function fetchAdminDashboardData(tab, force) {
    if (!force && adminDashboardState.data[tab]) return adminDashboardState.data[tab];
    if (!force && adminDashboardPending[tab]) return adminDashboardPending[tab];

    const promise = (async () => {
        const res = await fetch(ADMIN_DASHBOARD_TAB_ENDPOINTS[tab]);
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        adminDashboardState.data[tab] = data;
        return data;
    })();
    adminDashboardPending[tab] = promise;
    try {
        return await promise;
    } finally {
        delete adminDashboardPending[tab];
    }
}

async function loadAdminDashboardTab(tab, { force = false } = {}) {
    const panel = document.getElementById(`dashboard-panel-${tab}`);
    if (!panel) return;
    if (!force && adminDashboardState.loaded.has(tab)) return;

    if (!adminDashboardState.loaded.has(tab)) panel.innerHTML = dashSkeleton(3);

    try {
        if (tab === 'overview') {
            const [people, academic, activities] = await Promise.all([
                fetchAdminDashboardData('people', force),
                fetchAdminDashboardData('academic', force),
                fetchAdminDashboardData('activities', force),
            ]);
            renderAdminDashboardOverview(panel, { people, academic, activities });
        } else {
            const data = await fetchAdminDashboardData(tab, force);
            ADMIN_DASHBOARD_RENDERERS[tab](panel, data);
        }
        adminDashboardState.loaded.add(tab);
        const updated = document.getElementById('dashboard-updated-at');
        if (updated) updated.textContent = `อัปเดตล่าสุด ${dashDateTime(new Date().toISOString())}`;
    } catch (error) {
        console.error(`โหลดแดชบอร์ด (${tab}) ไม่สำเร็จ:`, error);
        panel.innerHTML = `<div class="dash-card dash-error">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}<br><button type="button" class="dash-link" style="margin-top:.5rem" onclick="loadAdminDashboardTab('${tab}', { force: true })">ลองใหม่</button></div>`;
        throw error;
    }
}
