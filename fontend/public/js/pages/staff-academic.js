// ==========================================
// งานวิชาการ: จัดการคะแนน / จัดการรายวิชา / จัดการตารางเรียน
// ==========================================

let academicToastTimer = null;
function showActivitiesToast(message, isSuccess) {
    const toast = document.getElementById('activities-toast');
    const messageEl = toast?.querySelector('.welcome-toast-message');
    const bar = toast?.querySelector('.welcome-toast-bar');
    if (!toast || !messageEl || !bar) return;

    toast.classList.remove('show');
    messageEl.textContent = message;
    toast.className = 'welcome-toast ' +
        (isSuccess ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200');
    void toast.offsetWidth;
    toast.classList.add('show');

    // แถบโหลดนับถอยหลัง - รีเซ็ตแล้วบังคับ reflow ก่อนใส่คลาส running กลับ กัน toast เด้งซ้อนกันถี่ ๆ แล้วแอนิเมชันเดิมไม่ยอมรีสตาร์ท (แพทเทิร์นเดียวกับ showFormToast ใน form.js)
    bar.classList.remove('running');
    bar.style.transform = 'scaleX(0)';
    void bar.offsetWidth;
    bar.style.transform = '';
    bar.classList.add('running');

    clearTimeout(academicToastTimer);
    academicToastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

const EDIT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
</svg>`;
const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
</svg>`;
const DOWNLOAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 12m0 0l4.5-4.5M12 12V3" />
</svg>`;

// คะแนนภาพรวม (0-100) = ผลรวมคะแนนที่แต่ละวิชา (เฉพาะที่ requiresScoring) "แบ่ง" มาจากสัดส่วนกลาง (scoreWeightSetting เช่น 70:30) ตามสัดส่วนหน่วยกิตเทียบกับผลรวมหน่วยกิตของวิชาที่เก็บคะแนนทั้งหมด
// คะแนนอธิบาย/คะแนนสอบเป็นคะแนนดิบ แปลงเป็นสัดส่วนด้วยคะแนนเต็มของวิชานั้น (explanationMaxScore/achievementMaxScore) ก่อนคูณส่วนแบ่งข้างต้น - ตั้งค่าได้ที่แท็บ "จัดการรายวิชา"
// สูตรต้องตรงกับ backend (subjectScoreController.js) เป๊ะ ๆ เพื่อให้ preview ตอนพิมพ์ตรงกับค่าที่บันทึกจริง
// subjects ที่ส่งเข้ามาต้องเป็นวิชาที่ requiresScoring แล้วเท่านั้น (rosterSubjects จาก /api/subject-scores/roster กรองมาให้แล้ว)
// bands ต้องเรียงจากคะแนนสูงไปต่ำและครอบคลุม 0-100 ครบ (ดู gradeBands ด้านล่าง)
// totalCreditsOverride: ใช้ตอนคำนวณ preview สดของผู้สอน ที่ subjects ที่มองเห็นถูกกรองเหลือแค่วิชาตัวเอง (ไม่ใช่ทุกวิชาที่เก็บคะแนนจริง)
// ต้องส่งฐานหน่วยกิตจริงทั้งคอร์สมาแทน ไม่งั้นสัดส่วน % จะพองเกินจริง (ดู totalCredits จาก /api/subject-scores/roster)
function computeSubjectScoreSummary(subjects, scoreBySubjectId, bands, weights, totalCreditsOverride) {
    const totalCredits = totalCreditsOverride ?? subjects.reduce((sum, s) => sum + s.credits, 0);

    const perSubject = subjects.map((s) => {
        const score = scoreBySubjectId.get(s.id);
        const explanationScore = score?.explanationScore || 0;
        const achievementScore = score?.achievementScore || 0;
        const creditShare = totalCredits ? s.credits / totalCredits : 0;
        const explanationQuota = weights.explanationWeight * creditShare;
        const achievementQuota = weights.achievementWeight * creditShare;
        const explanationPart = (explanationScore / s.explanationMaxScore) * explanationQuota;
        const achievementPart = (achievementScore / s.achievementMaxScore) * achievementQuota;
        const subjectScore = Math.round((explanationPart + achievementPart) * 100) / 100;
        return { subjectId: s.id, subjectScore };
    });

    const grandTotal = Math.round(perSubject.reduce((sum, p) => sum + p.subjectScore, 0) * 100) / 100;

    // เช็คแค่ minScore เหมือนฝั่ง backend (gradeBands.js resolveGrade) - grandTotal เป็นทศนิยมได้ ถ้าเช็ค maxScore ด้วยจะมีช่องว่างระหว่างช่วง (เช่น 59.22)
    const band = bands.find((b) => grandTotal >= b.minScore);
    const grade = band ? band.label : '';
    const gradeColorKey = band ? band.colorKey : GRADE_BADGE_DEFAULT_COLOR;

    return { perSubject, grandTotal, grade, gradeColorKey };
}

// สีเลือกเองได้อิสระผ่านวงล้อสี (input type="color") ไม่ได้จำกัดเป็นชุดสีตายตัวอีกต่อไป - เก็บเป็น hex ตรง ๆ จึงต้อง render ด้วย inline style แทน CSS class ตายตัว
const GRADE_BADGE_DEFAULT_COLOR = '#64748b';

function normalizeGradeColor(colorKey) {
    return /^#[0-9a-fA-F]{6}$/.test(colorKey) ? colorKey : GRADE_BADGE_DEFAULT_COLOR;
}

// ป้ายผลการประเมิน: พื้นหลังเป็นสีที่เลือกแบบจาง ๆ (เติม alpha ~10% ต่อท้าย hex ด้วยเลขฐาน 16 "1a") ตัวหนังสือใช้สีเข้มเต็ม
function gradeBadgeStyle(colorKey) {
    const color = normalizeGradeColor(colorKey);
    return `background-color:${color}1a;color:${color}`;
}

// สีตัวเลขคะแนนรวมให้ตรงกับสีผลการประเมินที่ได้ (สีเดียวกับ grade-badge แต่เอาแค่สีตัวหนังสือ ไม่มีพื้นหลัง)
function gradeTextColorStyle(colorKey) {
    return `color:${normalizeGradeColor(colorKey)}`;
}

// ==========================================
// สิทธิ์ 3 ระดับ: manager (หัวหน้าฝ่ายวิชาการ/ผู้บริหารค่าย) / instructor (ผู้สอนวิชาที่ได้รับมอบหมาย) / viewer (ดูอย่างเดียว)
// ==========================================
let academicTier = 'viewer';
let mySubjects = [];
let mySubjectIds = [];

// ช่วงคะแนนของแต่ละระดับผลการประเมิน (กำหนดเองได้ที่แท็บ "จัดการคะแนน") ค่าเริ่มต้นนี้ตรงกับ default ฝั่ง backend (gradeBands.js)
// ใช้ตอน preview ระหว่างพิมพ์คะแนน (recomputeRowPreview) ก่อนโหลดค่าจริงจากเซิร์ฟเวอร์เสร็จ - เรียงจากคะแนนสูงไปต่ำ
let gradeBands = [
    { minScore: 80, maxScore: 100, label: 'ดีเยี่ยม', colorKey: 'amber' },
    { minScore: 70, maxScore: 79, label: 'ดีมาก', colorKey: 'blue' },
    { minScore: 60, maxScore: 69, label: 'ดี', colorKey: 'emerald' },
    { minScore: 1, maxScore: 59, label: 'เข้าร่วม', colorKey: 'slate' },
    { minScore: 0, maxScore: 0, label: 'ไม่ผ่าน', colorKey: 'rose' },
];

// สัดส่วนคะแนนอธิบาย:คะแนนสอบโดยรวม ใช้ร่วมกันทุกวิชาที่ requiresScoring (กำหนดเองได้ที่แท็บ "จัดการคะแนน") ค่าเริ่มต้นตรงกับ default ฝั่ง backend (scoreWeightSetting.js)
let scoreWeightSetting = { explanationWeight: 70, achievementWeight: 30 };

// ต้องให้ผลตรงกับ isAcademicManager() ฝั่ง backend (requireAuth.js) เป๊ะ ๆ - reuse LEADERSHIP_POSITIONS ที่มีอยู่แล้วจาก auth.js แทนการประกาศซ้ำ
function computeAcademicTier(user, myAssignedSubjects) {
    // Owner ไม่มีตำแหน่ง/ฝ่ายจริงให้อิงสิทธิ์ตามปกติ แต่ได้สิทธิ์ manager เสมอ (ตรงกับ isAcademicManager() ฝั่ง backend)
    if (user && user.role === 'WEBMANAGER') return 'manager';
    const isLeadership = !!(user && user.position && LEADERSHIP_POSITIONS.includes(user.position.name));
    const isAcademicHead = !!(user && user.position?.name === 'หัวหน้าฝ่าย' && user.department?.name === 'ฝ่ายวิชาการ');
    if (isLeadership || isAcademicHead) return 'manager';
    return myAssignedSubjects.length > 0 ? 'instructor' : 'viewer';
}

// data-tier="manager-instructor" เห็นได้ทั้ง manager และ instructor (ต่างจาก data-tier="instructor" เฉย ๆ ที่ manager เห็นด้วยเฉพาะตอนสอนวิชาตัวเองอยู่ด้วยเท่านั้น)
// ใช้กับระบบสอบอธิบาย: backend อนุญาตให้ manager เปิด/ประเมินได้ทุกวิชาอยู่แล้วไม่ต้องรอเป็นผู้สอนก่อน หน้าตาจึงต้องเปิดให้ manager เข้าถึงได้เสมอ
function matchesAcademicTier(tierAttr, showInstructorTabsToo) {
    return tierAttr === academicTier
        || (tierAttr === 'instructor' && showInstructorTabsToo)
        || (tierAttr === 'manager-instructor' && (academicTier === 'manager' || academicTier === 'instructor'));
}

// ตารางคะแนนรวมทั้งคอร์สเป็น element เดียว (id ซ้ำไม่ได้) ต้องย้าย DOM จริงไปมาระหว่าง 2 หน้าตามแท็บที่กำลังเปิดอยู่ แทนที่จะ render ซ้ำ 2 ชุด
// "จัดการคะแนน"/"ตารางคะแนน" (page-scores) = บริบท "full": เห็นทุกวิชาทั้งคอร์ส, manager แก้ไขได้, instructor/viewer ดูได้อย่างเดียว (เพิ่งเปิดให้ instructor เข้าถึงหน้านี้แบบอ่านอย่างเดียวได้ด้วย)
// "จัดการรายวิชาของตัวเอง" (page-mysubject) = บริบท "own": เห็นเฉพาะวิชาตัวเอง, instructor แก้ไขได้ (manager ไม่ใช้ตารางที่นี่ แก้ผ่าน page-scores เหมือนเดิม)
let currentScoreContext = 'full';

function goToScoreTab(tabId) {
    switchTab(tabId);
    syncScoreTableForActiveTab();
}

function syncScoreTableForActiveTab() {
    const section = document.getElementById('score-table-section');
    const activePage = document.querySelector('.tab-content.active');
    if (!section || !activePage || (activePage.id !== 'page-scores' && activePage.id !== 'page-mysubject')) return;

    currentScoreContext = (activePage.id === 'page-mysubject' && academicTier === 'instructor') ? 'own' : 'full';
    const targetContainer = activePage.querySelector('.max-w-7xl');
    if (targetContainer && section.parentElement !== targetContainer) {
        targetContainer.appendChild(section);
    }

    const descEl = document.getElementById('score-table-desc');
    if (descEl) {
        descEl.textContent = currentScoreContext === 'own' ? 'ตารางแสดงคะแนนในรายวิชาที่รับผิดชอบ' : 'ตารางแสดงคะแนนในแต่ละรายวิชา';
    }

    const formats = getScoreTabCourseFormats();
    if (!selectedScoreCourseId || !formats.some((f) => f.id === selectedScoreCourseId)) {
        selectedScoreCourseId = formats[0]?.id ?? null;
    }
    renderCourseTabBar('score-course-tab-bar', selectedScoreCourseId, handleScoreCourseSelect, formats);
    if (selectedScoreCourseId) loadScoreRoster();
}

// เปลี่ยนเฉพาะข้อความของปุ่มเมนู ไม่แตะลูกอื่น ๆ ข้างใน - ปุ่มเมนูมือถือมีไอคอน <svg> อยู่ด้วย
// ถ้า set textContent ตรง ๆ ไอคอนจะถูกลบทิ้งไปพร้อมกับข้อความเดิม
function setNavButtonLabel(el, label) {
    if (!el) return;
    const labelNode = Array.from(el.childNodes).reverse()
        .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (labelNode) labelNode.textContent = label;
    else el.textContent = label;
}

function applyAcademicTier() {
    // แท็บ data-tier="instructor" ปกติเห็นเฉพาะ tier instructor แต่ถ้าเป็นหัวหน้าฝ่าย (manager) ที่ตัวเองก็สอนวิชาอยู่ด้วย ให้เห็นแท็บฝั่งผู้สอนของตัวเองเพิ่มด้วย (จัดการได้ทั้ง 2 มุมมอง)
    const showInstructorTabsToo = academicTier === 'manager' && mySubjectIds.length > 0;
    document.querySelectorAll('[data-tier]').forEach((el) => {
        el.classList.toggle('hidden', !matchesAcademicTier(el.dataset.tier, showInstructorTabsToo));
    });

    // nav.js คืนแท็บที่เปิดค้างไว้จาก sessionStorage แบบ sync ก่อนที่ auth.me ด้านล่างจะ resolve จึงอาจดันแท็บที่ tier ปัจจุบันดูไม่ได้ให้ active ค้างไว้ (เช่น เคยเป็นหัวหน้าฝ่ายอยู่แท็บ "จัดการรายวิชา" แล้วสิทธิ์เปลี่ยน) กลายเป็นเห็นหน้าที่ไม่ควรเห็น
    // สลับไปแท็บที่ tier ปัจจุบันเข้าได้แน่ ๆ แทน - "จัดการคะแนน" ไม่มี data-tier แล้ว (ทุก tier เข้าได้) จึงไม่โดน fallback นี้อีก เหลือแค่แท็บอื่นที่ยังจำกัด tier
    const activePage = document.querySelector('.tab-content.active');
    if (activePage && activePage.dataset.tier && !matchesAcademicTier(activePage.dataset.tier, showInstructorTabsToo)) {
        switchTab(academicTier === 'instructor' ? 'mysubject' : 'scores');
    }

    // ต้องเรียกหลัง redirect แท็บด้านบนเสร็จแล้วเสมอ เพื่ออ่านแท็บที่ active จริงหลังสลับ (ไม่ใช่แท็บเก่าก่อน redirect)
    syncScoreTableForActiveTab();

    const scoresLabel = academicTier === 'manager' ? 'จัดการคะแนน' : 'ตารางคะแนน';
    const scheduleLabel = academicTier === 'manager' ? 'จัดการตารางเรียน' : 'ตารางเรียน';
    ['nav-scores', 'm-nav-scores', 'footer-nav-scores'].forEach((id) => {
        setNavButtonLabel(document.getElementById(id), scoresLabel);
    });
    const scoresPageTitleEl = document.getElementById('scores-page-title');
    if (scoresPageTitleEl) scoresPageTitleEl.textContent = scoresLabel;
    const scoresPageSubtitleEl = document.getElementById('scores-page-subtitle');
    if (scoresPageSubtitleEl) scoresPageSubtitleEl.textContent = academicTier === 'manager' ? 'บันทึกคะแนนวิชาการ แยกตามคอร์สเรียน' : 'ตารางคะแนนในแต่ละรายวิชา';
    ['nav-schedule', 'm-nav-schedule', 'footer-nav-schedule'].forEach((id) => {
        setNavButtonLabel(document.getElementById(id), scheduleLabel);
    });
    const schedulePageTitleEl = document.getElementById('schedule-page-title');
    if (schedulePageTitleEl) schedulePageTitleEl.textContent = scheduleLabel;
    const schedulePageSubtitleEl = document.getElementById('schedule-page-subtitle');
    if (schedulePageSubtitleEl) schedulePageSubtitleEl.textContent = academicTier === 'manager' ? 'กำหนดตารางเรียนของแต่ละคอร์ส' : 'ตารางเรียนในแต่ละคอร์ส';

    // ซ่อนฟอร์มเพิ่มรายการตารางเรียน ถ้าไม่ใช่ manager
    const scheduleFormCard = document.getElementById('schedule-create-form')?.closest('.activity-card');
    if (scheduleFormCard) scheduleFormCard.classList.toggle('hidden', academicTier !== 'manager');
}

// ==========================================
// คอร์สเรียน (ใช้ร่วมกันทั้งแท็บคะแนนและตารางเรียน)
// ==========================================
let courseFormats = [];
let selectedScoreCourseId = null;
let selectedScheduleCourseId = null;
// ครั้งที่จัดค่ายปัจจุบัน ใช้แสดงในหัวกระดาษรายงานคะแนน (ดู buildScoreReportHtml) ไม่ใช่ค่าที่ผูกกับรหัสประจำตัวรายคน (นั่นมาจาก participant.code ที่ backend สร้างไว้แล้ว)
let currentGenerationNo = 1;

function loadCourseFormats() {
    return fetch('/api/lookups/course-formats')
        .then((res) => res.json())
        .then((items) => {
            courseFormats = items;
            const scoreTabCourseFormats = getScoreTabCourseFormats();
            if (items.length) {
                // ผู้สอนที่เห็นแค่บางคอร์ส ต้องเลือกคอร์สแรกจากรายการที่ตัวเองสอนได้จริง ไม่ใช่คอร์สแรกของทั้งค่าย (อาจไม่ใช่คอร์สที่ตัวเองสอนเลย)
                selectedScoreCourseId = (scoreTabCourseFormats[0] ?? items[0]).id;
                selectedScheduleCourseId = items[0].id;
            }
            renderCourseTabBar('score-course-tab-bar', selectedScoreCourseId, handleScoreCourseSelect, scoreTabCourseFormats);
            renderCourseTabBar('schedule-course-tab-bar', selectedScheduleCourseId, handleScheduleCourseSelect);
            renderDocumentCourseSelect();
            renderSubjectFormatSelect();
            renderOralExamCourseSelect();
            restoreOralExamSubjectSelection();
        })
        .catch((error) => console.error('โหลดรายชื่อคอร์สเรียนไม่สำเร็จ:', error));
}

function loadCurrentGeneration() {
    return fetch('/api/lookups/current-generation')
        .then((res) => res.json())
        .then((data) => { currentGenerationNo = data.generationNo; })
        .catch((error) => console.error('โหลดครั้งที่จัดค่ายไม่สำเร็จ:', error));
}

function handleScoreCourseSelect(id) {
    selectedScoreCourseId = id;
    renderCourseTabBar('score-course-tab-bar', selectedScoreCourseId, handleScoreCourseSelect, getScoreTabCourseFormats());
    loadScoreRoster();
}

function handleScheduleCourseSelect(id) {
    selectedScheduleCourseId = id;
    renderCourseTabBar('schedule-course-tab-bar', selectedScheduleCourseId, handleScheduleCourseSelect);
    renderScheduleSubjectSelect();
    loadSchedule();
}

function renderCourseTabBar(containerId, selectedId, onSelect, formats = courseFormats) {
    const bar = document.getElementById(containerId);
    if (!bar) return;
    bar.innerHTML = formats.map((c) => `
        <button type="button" class="course-tab-btn ${c.id === selectedId ? 'active' : ''}" data-course-id="${c.id}">${c.name}</button>
    `).join('');
    bar.querySelectorAll('.course-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => onSelect(Number(btn.dataset.courseId)));
    });
}

// บริบท "own" (แท็บ "จัดการรายวิชาของตัวเอง") เท่านั้นที่จำกัดคอร์สเหลือแค่ที่ผู้สอนสอนอยู่จริง (หรือทุกคอร์สถ้ามีวิชาที่ courseFormatId: null ใช้ร่วมทุกคอร์ส)
// บริบท "full" (แท็บ "ตารางคะแนน"/"จัดการคะแนน") เห็นทุกคอร์สเสมอไม่ว่า tier ไหน (manager แก้ไขได้, instructor/viewer ดูอย่างเดียว) - ใช้เฉพาะกับตารางคะแนนเท่านั้น ไม่กระทบแท็บตารางเรียนซึ่งใช้ courseFormats ทั้งหมดเสมอ
function getScoreTabCourseFormats() {
    if (currentScoreContext !== 'own' || academicTier !== 'instructor' || mySubjects.length === 0) return courseFormats;
    const myCourseFormatIds = new Set(mySubjects.map((s) => s.courseFormatId));
    if (myCourseFormatIds.has(null)) return courseFormats;
    return courseFormats.filter((c) => myCourseFormatIds.has(c.id));
}

// ==========================================
// แท็บ: จัดการรายวิชา
// ==========================================
let subjects = [];

function loadSubjects() {
    Loader.renderSkeletonCards(document.getElementById('subject-list'), 3);
    return fetch('/api/subjects')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            subjects = items;
            renderSubjectList();
            renderScheduleSubjectSelect();
            renderOralExamSubjectSelect();
            restoreOralExamSubjectSelection();
        })
        .catch((error) => {
            console.error('โหลดรายวิชาไม่สำเร็จ:', error);
            showActivitiesToast('โหลดรายวิชาไม่สำเร็จ', false);
        });
}

// select เลือกคอร์สในฟอร์ม "เพิ่มรายวิชาใหม่" - รูปแบบเดียวกับ renderDocumentCourseSelect (ฟอร์มอัปโหลดเอกสาร) ทุกจุด
function renderSubjectFormatSelect() {
    const select = document.getElementById('subject-course-format-select');
    if (!select) return;
    // value="both" สื่อว่าเป็นวิชาที่ใช้ร่วมกันทุกคอร์ส (courseFormatId: null ฝั่ง backend) แยกจาก value="" ของตัวเลือกแรกที่เป็นแค่ placeholder บังคับให้ต้องเลือกจริง
    select.innerHTML = '<option value="">-- เลือกคอร์ส --</option>' +
        '<option value="both">ปรับพื้นฐาน/เตรียมสอบ</option>' +
        courseFormats.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
}

// แบ่งหน้ารายการ "จัดการรายวิชา" - แบ่งตามจำนวนวิชารวมทุกคอร์ส (ไม่ใช่แบ่งแยกทีละคอร์ส) กัน 1 คอร์สที่มีวิชาเยอะมากดันหน้าอื่นจนสับสน
const SUBJECT_LIST_PAGE_SIZE = 5;
let subjectListCurrentPage = 1;

function renderSubjectList() {
    const list = document.getElementById('subject-list');
    const empty = document.getElementById('subject-list-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    empty.classList.toggle('hidden', subjects.length !== 0);

    // แยกรายวิชาเป็นกลุ่มตามคอร์สก่อน (เหมือนเดิม) แล้วเรียงเป็นลิสต์เดียวยาว ๆ ตามลำดับกลุ่ม เพื่อแบ่งหน้าทีละ SUBJECT_LIST_PAGE_SIZE รายการได้
    // group จาก subjects ตรง ๆ (ไม่ loop courseFormats ก่อน) เพราะ loadSubjects()/loadCourseFormats() ยิงพร้อมกันตอนโหลดหน้า courseFormats อาจยังว่างตอนเรียกครั้งแรก - ชื่อคอร์สจะโผล่ถูกทันทีที่ loadCourseFormats() resolve แล้วเรียกฟังก์ชันนี้ซ้ำ
    // null = "ทั้งคู่" (ใช้ร่วมกันทุกคอร์ส) เรียงไว้ท้ายสุดเสมอ กัน a - b พังตอนเจอ null (NaN)
    const courseFormatIds = [...new Set(subjects.map((s) => s.courseFormatId))]
        .sort((a, b) => {
            if (a === null) return 1;
            if (b === null) return -1;
            return a - b;
        });
    const courseNameOf = (courseFormatId) => (courseFormatId === null
        ? 'ปรับพื้นฐาน/เตรียมสอบ'
        : (courseFormats.find((c) => c.id === courseFormatId)?.name || `คอร์ส #${courseFormatId}`));
    const flatEntries = courseFormatIds.flatMap((courseFormatId) => subjects
        .filter((s) => s.courseFormatId === courseFormatId)
        .map((subject) => ({ subject, courseFormatId })));

    const totalPages = Math.max(1, Math.ceil(flatEntries.length / SUBJECT_LIST_PAGE_SIZE));
    subjectListCurrentPage = Math.min(Math.max(1, subjectListCurrentPage), totalPages);
    const start = (subjectListCurrentPage - 1) * SUBJECT_LIST_PAGE_SIZE;
    const pageEntries = flatEntries.slice(start, start + SUBJECT_LIST_PAGE_SIZE);

    // หัวข้อคั่นกลุ่มคอร์สโผล่เฉพาะตอนที่หน้านี้มีวิชาจากคอร์สนั้นจริง ๆ (courseFormatId เปลี่ยนจากตัวก่อนหน้าในหน้าเดียวกัน) ไม่ใช่ทุกกลุ่มเสมอเหมือนตอนไม่แบ่งหน้า
    let lastCourseFormatId;
    pageEntries.forEach(({ subject, courseFormatId }, index) => {
        if (index === 0 || courseFormatId !== lastCourseFormatId) {
            const heading = document.createElement('p');
            heading.className = 'profile-section-title';
            heading.style.marginTop = '1.5rem';
            heading.textContent = courseNameOf(courseFormatId);
            list.appendChild(heading);
            lastCourseFormatId = courseFormatId;
        }

        const item = document.createElement('div');
        item.className = 'activity-item';
        // จัดการผู้สอนรวมมาไว้ในการ์ดวิชาเลย (เดิมเป็นแท็บแยก) เฉพาะ manager เท่านั้นที่มอบหมายผู้สอนได้
        const instructorSectionHtml = academicTier === 'manager' ? buildSubjectInstructorSectionHtml(subject) : '';
        item.innerHTML = `
            <div style="flex: 1; min-width: 0;">
                <div class="activity-item-header-row">
                    <div>
                        <p class="activity-item-name">${subject.name}</p>
                        <p class="activity-item-desc">${subject.requiresScoring ? `เก็บคะแนน &nbsp;|&nbsp; คะแนนเต็มอธิบาย ${subject.explanationMaxScore} / คะแนนสอบ ${subject.achievementMaxScore}` : 'ไม่เก็บคะแนน'} &nbsp;|&nbsp; ${subject.credits} หน่วยกิต</p>
                    </div>
                    <div class="activity-item-actions">
                        <button type="button" class="activity-icon-btn edit" title="แก้ไข">${EDIT_ICON}</button>
                        <button type="button" class="activity-icon-btn delete" title="ลบ">${TRASH_ICON}</button>
                    </div>
                </div>
                ${instructorSectionHtml}
            </div>
        `;
        item.querySelector('.edit').addEventListener('click', () => openSubjectEditForm(item, subject));
        item.querySelector('.delete').addEventListener('click', () => deleteSubject(subject));
        if (academicTier === 'manager') wireSubjectInstructorSection(item, subject);
        list.appendChild(item);
    });

    renderSubjectListPagination(totalPages);
}

function renderSubjectListPagination(totalPages) {
    const bar = document.getElementById('subject-list-pagination-bar');
    const prevButton = document.getElementById('subject-list-pagination-prev');
    const nextButton = document.getElementById('subject-list-pagination-next');
    const pagesContainer = document.getElementById('subject-list-pagination-pages');
    if (!bar || !prevButton || !nextButton || !pagesContainer) return;

    bar.classList.toggle('hidden', totalPages <= 1);
    prevButton.disabled = subjectListCurrentPage === 1;
    nextButton.disabled = subjectListCurrentPage === totalPages;

    pagesContainer.innerHTML = '';
    for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pagination-page';
        button.textContent = String(page);
        button.classList.toggle('active', page === subjectListCurrentPage);
        button.setAttribute('aria-current', page === subjectListCurrentPage ? 'page' : 'false');
        button.addEventListener('click', () => goToSubjectListPage(page));
        pagesContainer.appendChild(button);
    }
}

function goToSubjectListPage(page) {
    subjectListCurrentPage = page;
    renderSubjectList();
    document.getElementById('subject-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ส่วนจัดการผู้สอนภายในการ์ดวิชา (เดิมเป็นแท็บ "จัดการผู้สอน" แยกต่างหาก ย้ายมารวมในนี้)
function buildSubjectInstructorSectionHtml(subject) {
    const chips = subject.instructors.length
        ? subject.instructors.map((i) => `
            <span class="instructor-chip" data-user-id="${i.userId}">
                ${i.name}${i.nickname ? ` (${i.nickname})` : ''}
                <button type="button" class="instructor-chip-remove" title="เอาออก">&times;</button>
            </span>
        `).join('')
        : '<p class="instructor-assign-empty-hint">ยังไม่มีผู้สอน</p>';

    const availableCandidates = instructorCandidates.filter((c) => !subject.instructorUserIds.includes(c.id));
    const options = ['<option value="">-- เลือกผู้สอนเพิ่ม --</option>']
        .concat(availableCandidates.map((c) => `<option value="${c.id}">${c.name}${c.nickname ? ` (${c.nickname})` : ''}</option>`))
        .join('');

    return `
        <div class="instructor-assign-item">
            <p class="form-label" style="margin-bottom: 0.4rem;">ผู้สอน</p>
            <div class="instructor-chip-list">${chips}</div>
            <div class="instructor-assign-add-row">
                <select class="form-input instructor-assign-add-select">${options}</select>
                <button type="button" class="btn-primary instructor-assign-add-btn">เพิ่มผู้สอน</button>
            </div>
        </div>
    `;
}

function wireSubjectInstructorSection(item, subject) {
    // ปิดปุ่ม/select ทั้งใบทันทีที่กด กันคลิกรัว ๆ ก่อน fetch+re-render รอบก่อนหน้าจะเสร็จ (จะเขียนทับกันเพราะ endpoint แทนที่ทั้งชุด)
    // การ์ดนี้จะถูกแทนที่ด้วยของใหม่เสมอหลัง loadSubjects() เสร็จ จึงไม่ต้องมา enable กลับเอง
    function disableCardControls() {
        item.querySelectorAll('.instructor-assign-item button, .instructor-assign-item select').forEach((el) => { el.disabled = true; });
    }

    item.querySelectorAll('.instructor-chip-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
            const userId = Number(btn.closest('.instructor-chip').dataset.userId);
            disableCardControls();
            saveInstructorAssignment(subject.id, subject.instructorUserIds.filter((id) => id !== userId));
        });
    });

    const addBtn = item.querySelector('.instructor-assign-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const select = item.querySelector('.instructor-assign-add-select');
            if (!select.value) return;
            disableCardControls();
            saveInstructorAssignment(subject.id, [...subject.instructorUserIds, Number(select.value)]);
        });
    }
}

function openSubjectEditForm(itemEl, subject) {
    itemEl.innerHTML = `
        <form class="activity-edit-form" style="width: 100%;">
            <div class="form-group mb-6">
                <label class="form-label">ชื่อวิชา *</label>
                <input type="text" class="form-input" id="subject-edit-name" value="${subject.name}" required>
            </div>
            <div class="form-group mb-6">
                <label class="form-label">คอร์ส *</label>
                <select class="form-input" id="subject-edit-course-format" required>
                    <option value="both" ${subject.courseFormatId === null ? 'selected' : ''}>ปรับพื้นฐาน/เตรียมสอบ</option>
                    ${courseFormats.map((c) => `<option value="${c.id}" ${c.id === subject.courseFormatId ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group mb-6">
                <label class="toggle-switch-label">
                    <input type="checkbox" id="subject-edit-requires-scoring" class="toggle-switch" ${subject.requiresScoring ? 'checked' : ''}>
                    ต้องเก็บคะแนน (แสดงในตารางคะแนน และนำไปคิดคะแนนรวม)
                </label>
            </div>
            <div id="subject-edit-scoring-fields" class="${subject.requiresScoring ? '' : 'hidden'}">
                <div class="form-grid mb-6">
                    <div class="form-group">
                        <label class="form-label">คะแนนเต็ม (อธิบาย)</label>
                        <input type="number" min="1" step="1" class="form-input" id="subject-edit-explanation-max" value="${subject.explanationMaxScore}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">คะแนนเต็ม (คะแนนสอบ)</label>
                        <input type="number" min="1" step="1" class="form-input" id="subject-edit-achievement-max" value="${subject.achievementMaxScore}">
                    </div>
                </div>
                <div class="form-group mb-6" style="max-width: 12rem;">
                    <label class="form-label">หน่วยกิต</label>
                    <input type="number" min="0.5" step="0.5" class="form-input" id="subject-edit-credits" value="${subject.credits}">
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-outline" id="subject-edit-cancel">ยกเลิก</button>
                <button type="submit" class="btn-primary">บันทึก</button>
            </div>
        </form>
    `;
    itemEl.querySelector('#subject-edit-cancel').addEventListener('click', () => renderSubjectList());
    itemEl.querySelector('#subject-edit-requires-scoring').addEventListener('change', (event) => {
        handleSubjectRequiresScoringToggle(event.target, itemEl.querySelector('#subject-edit-scoring-fields'));
    });
    itemEl.querySelector('.activity-edit-form').addEventListener('submit', (event) => {
        event.preventDefault();
        updateSubject(subject.id, {
            name: itemEl.querySelector('#subject-edit-name').value.trim(),
            courseFormatId: (() => {
                const v = itemEl.querySelector('#subject-edit-course-format').value;
                return v === 'both' ? null : Number(v);
            })(),
            requiresScoring: itemEl.querySelector('#subject-edit-requires-scoring').checked,
            explanationMaxScore: Number(itemEl.querySelector('#subject-edit-explanation-max').value),
            achievementMaxScore: Number(itemEl.querySelector('#subject-edit-achievement-max').value),
            credits: Number(itemEl.querySelector('#subject-edit-credits').value),
        });
    });
}

function updateSubject(id, payload) {
    fetch(`/api/subjects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            showActivitiesToast('บันทึกรายวิชาสำเร็จ', true);
            loadSubjects();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'บันทึกรายวิชาไม่สำเร็จ', false);
        });
}

async function deleteSubject(subject) {
    const confirmed = await showConfirm(`ลบรายวิชา "${subject.name}" ใช่หรือไม่? คะแนนของวิชานี้จะถูกลบไปด้วย`, {
        title: 'ยืนยันการลบ',
        confirmText: 'ลบ',
    });
    if (!confirmed) return;

    fetch(`/api/subjects/${subject.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showActivitiesToast('ลบรายวิชาสำเร็จ', true);
            loadSubjects();
            loadScoreRoster();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('ลบรายวิชาไม่สำเร็จ', false);
        });
}

function handleSubjectRequiresScoringToggle(checkboxEl, fieldsWrapEl) {
    fieldsWrapEl.classList.toggle('hidden', !checkboxEl.checked);
}

function handleSubjectCreateSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById('subject-name-input');
    const courseFormatSelect = document.getElementById('subject-course-format-select');
    const requiresScoringInput = document.getElementById('subject-requires-scoring-input');
    const explanationMaxInput = document.getElementById('subject-explanation-max-input');
    const achievementMaxInput = document.getElementById('subject-achievement-max-input');
    const creditsInput = document.getElementById('subject-credits-input');
    const btn = event.target.querySelector('button[type="submit"]');

    if (!courseFormatSelect.value) {
        showActivitiesToast('กรุณาเลือกคอร์ส', false);
        return;
    }

    Loader.setButtonLoading(btn, 'กำลังเพิ่ม...');

    fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: nameInput.value.trim(),
            courseFormatId: courseFormatSelect.value === 'both' ? null : Number(courseFormatSelect.value),
            requiresScoring: requiresScoringInput.checked,
            explanationMaxScore: Number(explanationMaxInput.value) || 100,
            achievementMaxScore: Number(achievementMaxInput.value) || 100,
            credits: Number(creditsInput.value) || 1,
        }),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            nameInput.value = '';
            requiresScoringInput.checked = true;
            handleSubjectRequiresScoringToggle(requiresScoringInput, document.getElementById('subject-scoring-fields'));
            explanationMaxInput.value = '100';
            achievementMaxInput.value = '100';
            creditsInput.value = '1';
            showActivitiesToast('เพิ่มรายวิชาสำเร็จ', true);
            loadSubjects();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'เพิ่มรายวิชาไม่สำเร็จ', false);
        })
        .finally(() => {
            Loader.clearButtonLoading(btn);
        });
}

// ==========================================
// แท็บ: จัดการคะแนน
// ==========================================
function loadScoreWeightSetting() {
    return fetch('/api/score-weight-setting')
        .then((res) => (res.ok ? res.json() : null))
        .then((setting) => {
            if (!setting) return;
            scoreWeightSetting = { explanationWeight: setting.explanationWeight, achievementWeight: setting.achievementWeight };
            const explanationInput = document.getElementById('score-weight-explanation-input');
            const achievementInput = document.getElementById('score-weight-achievement-input');
            if (explanationInput) explanationInput.value = scoreWeightSetting.explanationWeight;
            if (achievementInput) achievementInput.value = scoreWeightSetting.achievementWeight;
        })
        .catch((error) => console.error('โหลดสัดส่วนคะแนนโดยรวมไม่สำเร็จ:', error));
}

async function handleScoreWeightFormSubmit(event) {
    event.preventDefault();
    const explanationWeight = Number(document.getElementById('score-weight-explanation-input').value);
    const achievementWeight = Number(document.getElementById('score-weight-achievement-input').value);

    if (explanationWeight + achievementWeight !== 100) {
        showActivitiesToast('สัดส่วนคะแนนอธิบาย + คะแนนสอบ ต้องรวมกันเท่ากับ 100', false);
        return;
    }

    const confirmed = await showConfirm(
        `บันทึกสัดส่วนคะแนนอธิบาย:คะแนนสอบเป็น ${explanationWeight}:${achievementWeight} มีผลกับทุกวิชาที่ต้องเก็บคะแนนทันที ใช่หรือไม่?`,
        { title: 'ยืนยันการบันทึกสัดส่วนคะแนน', confirmText: 'บันทึก' }
    );
    if (!confirmed) return;

    fetch('/api/score-weight-setting', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explanationWeight, achievementWeight }),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            scoreWeightSetting = { explanationWeight, achievementWeight };
            showActivitiesToast('บันทึกสัดส่วนคะแนนโดยรวมสำเร็จ', true);
            loadScoreRoster();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'บันทึกสัดส่วนคะแนนโดยรวมไม่สำเร็จ', false);
        });
}

function loadGradeBands() {
    return fetch('/api/grade-bands')
        .then((res) => (res.ok ? res.json() : null))
        .then((bands) => {
            if (!bands) return;
            gradeBands = bands;
            renderGradeBandRows();
        })
        .catch((error) => console.error('โหลดเกณฑ์ผลการประเมินไม่สำเร็จ:', error));
}

// สีเริ่มต้นไล่ตามลำดับตอนเพิ่มแถวใหม่ (ผู้ใช้เปลี่ยนเองได้อิสระทีหลังผ่านวงล้อสี ชุดนี้แค่กันแถวใหม่เริ่มจากสีเทาซ้ำ ๆ กันหมด)
const GRADE_COLOR_DEFAULTS = ['#b45309', '#1d4ed8', '#059669', '#64748b', '#be123c', '#6d28d9', '#0e7490', '#c2410c'];

// แถวของแต่ละช่วงคะแนนในฟอร์ม เพิ่ม/ลบได้ ไม่จำกัดจำนวน (ต่างจากเดิมที่ตายตัว 3 เกณฑ์) - สีของแต่ละช่วงเลือกเองได้อิสระผ่านวงล้อสีของเบราว์เซอร์ (input type="color")
function renderGradeBandRows() {
    const wrap = document.getElementById('grade-band-rows');
    if (!wrap) return;

    wrap.innerHTML = gradeBands.map((b) => {
        const colorKey = normalizeGradeColor(b.colorKey);
        return `
        <div class="grade-band-row">
            <input type="number" min="0" max="100" step="1" class="form-input grade-band-min-input" value="${b.minScore}" aria-label="คะแนนต่ำสุด">
            <span class="grade-band-sep">–</span>
            <input type="number" min="0" max="100" step="1" class="form-input grade-band-max-input" value="${b.maxScore}" aria-label="คะแนนสูงสุด">
            <input type="text" class="form-input grade-band-label-input" placeholder="เช่น ดีเยี่ยม" value="${b.label}" aria-label="ผลการประเมิน">
            <input type="color" class="grade-band-color-input" value="${colorKey}" aria-label="เลือกสี">
            <button type="button" class="activity-icon-btn delete grade-band-remove-btn" title="ลบช่วงนี้">${TRASH_ICON}</button>
        </div>
    `;
    }).join('');

    wrap.querySelectorAll('.grade-band-remove-btn').forEach((btn, index) => {
        btn.addEventListener('click', () => {
            gradeBands.splice(index, 1);
            renderGradeBandRows();
        });
    });
}

async function handleGradeBandFormSubmit(event) {
    event.preventDefault();
    const bands = Array.from(document.querySelectorAll('#grade-band-rows .grade-band-row')).map((row) => ({
        minScore: Number(row.querySelector('.grade-band-min-input').value),
        maxScore: Number(row.querySelector('.grade-band-max-input').value),
        label: row.querySelector('.grade-band-label-input').value.trim(),
        colorKey: row.querySelector('.grade-band-color-input').value,
    }));

    const confirmed = await showConfirm(
        'บันทึกเกณฑ์ผลการประเมินชุดนี้แทนชุดเดิมทันที ใช่หรือไม่?',
        { title: 'ยืนยันการบันทึกเกณฑ์ผลการประเมิน', confirmText: 'บันทึก' }
    );
    if (!confirmed) return;

    fetch('/api/grade-bands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bands }),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            return res.json();
        })
        .then((updated) => {
            gradeBands = updated;
            renderGradeBandRows();
            showActivitiesToast('บันทึกเกณฑ์ผลการประเมินสำเร็จ', true);
            loadScoreRoster();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'บันทึกเกณฑ์ผลการประเมินไม่สำเร็จ', false);
        });
}

function handleGradeBandAddClick() {
    const colorKey = GRADE_COLOR_DEFAULTS[gradeBands.length % GRADE_COLOR_DEFAULTS.length];
    gradeBands.push({ minScore: 0, maxScore: 0, label: '', colorKey });
    renderGradeBandRows();
}

// ตารางคะแนนสอบอธิบายตามครั้งที่สอบ (ค่ากลาง ใช้ร่วมกันทุกวิชา) - ครั้งที่ N มาจากตำแหน่งแถวเสมอ ไม่ใช่กรอกเอง (เหมือนที่ backend คำนวณจาก index ตอนบันทึก)
let oralExamScoreBands = [];

function loadOralExamScoreBands() {
    return fetch('/api/oral-exam-score-bands')
        .then((res) => (res.ok ? res.json() : null))
        .then((bands) => {
            if (!bands) return;
            oralExamScoreBands = bands;
            renderOralExamBandRows();
        })
        .catch((error) => console.error('โหลดตารางคะแนนสอบอธิบายไม่สำเร็จ:', error));
}

function renderOralExamBandRows() {
    const wrap = document.getElementById('oral-exam-band-rows');
    if (!wrap) return;

    wrap.innerHTML = oralExamScoreBands.map((b, index) => {
        // แถวสุดท้าย = คะแนนของ "ครั้งที่ N ขึ้นไป" แบบปลายเปิด (ตรงกับที่ resolveAttemptScorePercent ใน backend/lib/oralExam.js ใช้จริง)
        const isLast = index === oralExamScoreBands.length - 1;
        const label = isLast ? `ครั้งที่ ${index + 1} ขึ้นไป` : `ครั้งที่ ${index + 1}`;
        return `
        <div class="oral-exam-band-row">
            <span class="oral-exam-band-index">${label}</span>
            <input type="number" min="0" max="100" step="1" class="form-input oral-exam-band-percent-input" value="${b.scorePercent}" aria-label="คะแนน (%)">
            <span class="oral-exam-band-percent-suffix">%</span>
            <button type="button" class="activity-icon-btn delete oral-exam-band-remove-btn" title="ลบลำดับนี้">${TRASH_ICON}</button>
        </div>
    `;
    }).join('');

    wrap.querySelectorAll('.oral-exam-band-remove-btn').forEach((btn, index) => {
        btn.addEventListener('click', () => {
            oralExamScoreBands.splice(index, 1);
            renderOralExamBandRows();
        });
    });
}

async function handleOralExamBandFormSubmit(event) {
    event.preventDefault();
    const bands = Array.from(document.querySelectorAll('#oral-exam-band-rows .oral-exam-band-row')).map((row) => ({
        scorePercent: Number(row.querySelector('.oral-exam-band-percent-input').value),
    }));

    const confirmed = await showConfirm(
        'บันทึกตารางคะแนนสอบอธิบายชุดนี้แทนชุดเดิมทันที ใช่หรือไม่?',
        { title: 'ยืนยันการบันทึกตารางคะแนนสอบอธิบาย', confirmText: 'บันทึก' }
    );
    if (!confirmed) return;

    fetch('/api/oral-exam-score-bands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bands }),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            return res.json();
        })
        .then((updated) => {
            oralExamScoreBands = updated;
            renderOralExamBandRows();
            showActivitiesToast('บันทึกตารางคะแนนสอบอธิบายสำเร็จ', true);
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'บันทึกตารางคะแนนสอบอธิบายไม่สำเร็จ', false);
        });
}

function handleOralExamBandAddClick() {
    oralExamScoreBands.push({ scorePercent: 0 });
    renderOralExamBandRows();
}

// เก็บชุดล่าสุดไว้ระดับโมดูล ให้ปุ่ม "พิมพ์ / บันทึกเป็น PDF" ดึงไปสร้างรายงานได้โดยไม่ต้อง fetch ซ้ำ (ดู buildScoreReportHtml)
let currentRosterSubjects = [];
let currentRoster = [];
// ฐานหน่วยกิตรวมของ "ทุกวิชา" ที่เก็บคะแนนในคอร์สนี้ (จาก backend เสมอ) ต่างจาก currentRosterSubjects ที่ผู้สอนเห็นแค่วิชาตัวเอง
// ต้องใช้ตัวนี้คำนวณสัดส่วน % ไม่ใช่ currentRosterSubjects.reduce(...) ไม่งั้นสัดส่วนของผู้สอนจะพองเกินจริง
let currentTotalCredits = 0;

function loadScoreRoster() {
    const wrap = document.getElementById('subject-score-table-wrap');
    const empty = document.getElementById('subject-score-empty');
    if (!wrap || !empty || !selectedScoreCourseId) return;

    Loader.renderSkeletonCards(wrap, 3);
    // บริบท "full" (แท็บ "ตารางคะแนน") ขอข้อมูลแบบไม่กรองเสมอ (เห็นทุกวิชาทั้งคอร์สแบบ viewer) แม้ตัวเองจะเป็น instructor ก็ตาม - บริบท "own" (แท็บ "จัดการรายวิชาของตัวเอง") ปล่อยให้ backend กรองเหลือแค่วิชาตัวเองตามปกติ
    const scopeParam = currentScoreContext === 'full' ? '&scope=full' : '';
    fetch(`/api/subject-scores/roster?courseFormatId=${selectedScoreCourseId}${scopeParam}`)
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(({ subjects: rosterSubjects, roster, totalCredits }) => {
            currentRosterSubjects = rosterSubjects;
            currentRoster = roster;
            currentTotalCredits = totalCredits;
            renderScoreTable(rosterSubjects, roster, totalCredits);
            empty.classList.toggle('hidden', rosterSubjects.length !== 0 && roster.length !== 0);
        })
        .catch((error) => {
            console.error('โหลดตารางคะแนนไม่สำเร็จ:', error);
            showActivitiesToast('โหลดตารางคะแนนไม่สำเร็จ', false);
        });
}

// ร่างคะแนนที่พิมพ์ไว้แต่ยังไม่กดบันทึก เก็บใน localStorage กันหายตอนรีเฟรชหน้า - เก็บเป็นค่าดิบ (string) ตามที่กรอกจริง
// key ด้วย participantId เฉยๆ (ไม่ผูก courseFormatId เพราะผู้เข้าร่วม 1 คนอยู่คอร์สเดียว) ลบทิ้งทันทีที่บันทึกสำเร็จ
const SCORE_DRAFT_STORAGE_KEY = 'academicScoreDrafts';

function loadScoreDrafts() {
    try {
        return JSON.parse(localStorage.getItem(SCORE_DRAFT_STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

function saveScoreDraftForRow(row, rosterSubjects, participantId) {
    const drafts = loadScoreDrafts();
    const draft = {};
    rosterSubjects.forEach((s) => {
        const explanationInput = row.querySelector(`.subject-score-input[data-subject-id="${s.id}"][data-type="explanation"]`);
        const achievementInput = row.querySelector(`.subject-score-input[data-subject-id="${s.id}"][data-type="achievement"]`);
        draft[s.id] = { explanationScore: explanationInput.value, achievementScore: achievementInput.value };
    });
    drafts[participantId] = draft;
    localStorage.setItem(SCORE_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function clearScoreDraftForParticipant(participantId) {
    const drafts = loadScoreDrafts();
    if (!drafts[participantId]) return;
    delete drafts[participantId];
    localStorage.setItem(SCORE_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function renderScoreTable(rosterSubjects, roster, totalCreditsOverride) {
    const wrap = document.getElementById('subject-score-table-wrap');
    if (!wrap) return;

    // บอก CSS ว่าตอนนี้มีตารางจริงอยู่ไหม - จอโทรศัพท์แนวตั้งจะซ่อนตารางแล้วแสดงข้อความให้หมุนจอแทน เฉพาะตอนมีตารางเท่านั้น (ดู .score-table-rotate-notice)
    const hasTable = rosterSubjects.length !== 0 && roster.length !== 0;
    wrap.closest('.score-table-card')?.classList.toggle('has-score-table', hasTable);

    if (!hasTable) {
        wrap.innerHTML = '';
        return;
    }

    // ส่วนแบ่งคะแนนรวมของแต่ละวิชา = สัดส่วนกลาง (scoreWeightSetting) x สัดส่วนหน่วยกิตของวิชานี้เทียบกับผลรวมหน่วยกิตของ "ทุกวิชา" ที่เก็บคะแนนทั้งคอร์ส
    // ไม่ใช่แค่ rosterSubjects.reduce(...) เพราะฝั่งผู้สอนมองเห็นแค่วิชาตัวเอง (rosterSubjects ถูกกรองแล้ว) ต้องใช้ totalCreditsOverride จาก backend (ฐานหน่วยกิตจริงทั้งคอร์ส) แทนเสมอถ้ามีมา
    const totalCredits = totalCreditsOverride ?? rosterSubjects.reduce((sum, s) => sum + s.credits, 0);
    const subjectHeaders = rosterSubjects.map((s) => `
        <th colspan="2" class="subject-score-subject-header">${s.name}<br><span class="subject-score-max-hint">(${s.credits} นก.)</span></th>
    `).join('');
    // แสดงคะแนนเต็มและส่วนแบ่งคะแนนรวมแยกใต้หัวข้อของแต่ละประเภท (อธิบาย/สอบ) เช่น "เต็ม 100 · 14%" แทนที่จะรวมไว้แถวเดียวด้านบน
    const subjectSubHeaders = rosterSubjects.map((s) => {
        const creditShare = totalCredits ? s.credits / totalCredits : 0;
        const explanationSharePct = Math.round(scoreWeightSetting.explanationWeight * creditShare * 10) / 10;
        const achievementSharePct = Math.round(scoreWeightSetting.achievementWeight * creditShare * 10) / 10;
        return `
        <th class="subject-score-subcol subject-score-group-start">คะแนนอธิบาย<br><span class="subject-score-max-hint">เต็ม ${s.explanationMaxScore} · ${explanationSharePct}%</span></th>
        <th class="subject-score-subcol">คะแนนสอบ<br><span class="subject-score-max-hint">เต็ม ${s.achievementMaxScore} · ${achievementSharePct}%</span></th>
    `;
    }).join('');

    // บริบท "own" (แท็บ "จัดการรายวิชาของตัวเอง") เห็นแค่วิชาตัวเองอยู่แล้ว คะแนนรวม/ผลการประเมินสะท้อนภาพรวมทั้งคอร์ส (รวมวิชาที่มองไม่เห็นด้วย) เอาออกกันสับสน - บริบท "full" เห็นครบทุกคอลัมน์เสมอไม่ว่า tier ไหน
    const showOverallColumns = currentScoreContext === 'full';
    // แก้ไขคะแนนได้เฉพาะ manager ในบริบท "full" (จัดการคะแนน) หรือ instructor ในบริบท "own" (จัดการรายวิชาของตัวเอง) เท่านั้น
    // instructor ที่เข้ามาดูบริบท "full" (แท็บ "ตารางคะแนน" ที่เพิ่งเปิดให้เข้าถึงได้) ต้องดูได้อย่างเดียว แก้ไม่ได้ แม้จะเป็นวิชาตัวเองก็ตาม (แก้ผ่าน "จัดการรายวิชาของตัวเอง" แทน)
    const canEditThisView = (currentScoreContext === 'full' && academicTier === 'manager')
        || (currentScoreContext === 'own' && academicTier === 'instructor');
    wrap.innerHTML = `
        <table class="subject-score-table">
            <thead>
                <tr>
                    <th rowspan="2" class="subject-score-code-col">รหัสประจำตัว</th>
                    <th rowspan="2" class="subject-score-name-col">ชื่อ-นามสกุล</th>
                    ${subjectHeaders}
                    ${showOverallColumns ? `
                        <th rowspan="2" class="subject-score-group-start">คะแนนรวม (100%)</th>
                        <th rowspan="2">ผลการประเมิน</th>
                    ` : ''}
                    ${canEditThisView ? '<th rowspan="2" class="subject-score-action-col"></th>' : ''}
                </tr>
                <tr>${subjectSubHeaders}</tr>
            </thead>
            <tbody id="subject-score-table-body"></tbody>
        </table>
    `;

    const tbody = document.getElementById('subject-score-table-body');
    const scoreDrafts = loadScoreDrafts();
    roster.forEach((participant) => {
        const row = document.createElement('tr');
        row.dataset.participantId = participant.id;
        row.dataset.searchText = `${participant.code} ${participant.fullName}`.toLowerCase();
        const draftForParticipant = scoreDrafts[participant.id];

        const scoreCells = rosterSubjects.map((s) => {
            const existing = participant.scores.find((sc) => sc.subjectId === s.id);
            const draft = draftForParticipant?.[s.id];
            // ถ้ามีร่างที่ยังไม่บันทึกไว้ (ตอนพิมพ์ก่อนหน้าแล้วรีเฟรชหน้าไปก่อนกดบันทึก) ใช้ค่าร่างแทนค่าที่บันทึกจริงในการแสดงผล
            const explanationSaved = existing?.explanationScore ?? '';
            const achievementSaved = existing?.achievementScore ?? '';
            const explanationValue = draft ? draft.explanationScore : explanationSaved;
            const achievementValue = draft ? draft.achievementScore : achievementSaved;
            // ไฮไลต์ช่องที่ค่าปัจจุบันต่างจากค่าที่บันทึกจริงไว้แล้ว (ยังไม่ได้กดบันทึก) - ดู .subject-score-input--dirty
            const explanationDirty = String(explanationValue) !== String(explanationSaved) ? 'subject-score-input--dirty' : '';
            const achievementDirty = String(achievementValue) !== String(achievementSaved) ? 'subject-score-input--dirty' : '';
            // แก้ไขได้ตามบริบทของแท็บที่กำลังดูอยู่ (canEditThisView คำนวณไว้แล้วด้านบน) - บริบท "own" ถูกกรองเหลือแค่วิชาตัวเองจาก backend อยู่แล้ว ทุกวิชาที่ปรากฏใน rosterSubjects จึงแก้ได้เท่ากันหมดถ้า canEditThisView เป็นจริง
            const disabledAttr = canEditThisView ? '' : 'disabled';
            // % ที่แสดง = คะแนนดิบ/คะแนนเต็ม คูณส่วนแบ่งคะแนนรวมของประเภทนี้ (ตัวเดียวกับที่ใช้คำนวณคะแนนรวม) ไม่ใช่แค่คะแนนดิบ/คะแนนเต็มเฉย ๆ
            const creditShare = totalCredits ? s.credits / totalCredits : 0;
            const explanationQuota = scoreWeightSetting.explanationWeight * creditShare;
            const achievementQuota = scoreWeightSetting.achievementWeight * creditShare;
            const explanationPercent = `${explanationValue !== '' ? Math.round((Number(explanationValue) / s.explanationMaxScore) * explanationQuota) : 0}%`;
            const achievementPercent = `${achievementValue !== '' ? Math.round((Number(achievementValue) / s.achievementMaxScore) * achievementQuota) : 0}%`;
            return `
                <td class="subject-score-group-start">
                    <div class="subject-score-cell">
                        <input type="number" min="0" max="${s.explanationMaxScore}" step="1" class="subject-score-input ${explanationDirty}" data-subject-id="${s.id}" data-type="explanation" data-saved-value="${explanationSaved}" value="${explanationValue}" ${disabledAttr}>
                        <span class="subject-score-percent" data-subject-id="${s.id}" data-type="explanation">${explanationPercent}</span>
                    </div>
                </td>
                <td>
                    <div class="subject-score-cell">
                        <input type="number" min="0" max="${s.achievementMaxScore}" step="1" class="subject-score-input ${achievementDirty}" data-subject-id="${s.id}" data-type="achievement" data-saved-value="${achievementSaved}" value="${achievementValue}" ${disabledAttr}>
                        <span class="subject-score-percent" data-subject-id="${s.id}" data-type="achievement">${achievementPercent}</span>
                    </div>
                </td>
            `;
        }).join('');

        // ผลการประเมินคำนวณจากคะแนนรวมอัตโนมัติเสมอ (ตามช่วงคะแนนที่ตั้งไว้) แสดงผลอย่างเดียว ปรับเองไม่ได้
        // ปุ่มบันทึกเริ่มเป็นสีเทากดไม่ได้ (ยังไม่มีอะไรเปลี่ยน) ยกเว้นมีร่างที่ยังไม่บันทึกค้างอยู่ (draftForParticipant) ถึงเปิดให้กดได้ทันที
        row.innerHTML = `
            <td class="admin-cell-strong subject-score-code-col">${participant.code}</td>
            <td class="admin-cell-strong subject-score-name-col">${participant.fullName}</td>
            ${scoreCells}
            ${showOverallColumns ? `
                <td class="subject-score-summary-cell subject-score-grandtotal subject-score-group-start" data-field="grandTotal" style="${gradeTextColorStyle(participant.summary.gradeColorKey)}">${participant.summary.grandTotal}</td>
                <td data-field="grade">
                    <span class="grade-badge" style="${gradeBadgeStyle(participant.summary.gradeColorKey)}">${participant.summary.grade}</span>
                </td>
            ` : ''}
            ${canEditThisView ? `<td class="subject-score-action-col"><button type="button" class="score-group-save-btn" ${draftForParticipant ? '' : 'disabled'}>บันทึก</button></td>` : ''}
        `;

        const saveBtn = row.querySelector('.score-group-save-btn');
        row.querySelectorAll('.subject-score-input:not([disabled])').forEach((input) => {
            input.addEventListener('input', () => {
                input.classList.toggle('subject-score-input--dirty', input.value !== input.dataset.savedValue);
                recomputeRowPreview(row, rosterSubjects, totalCredits);
                saveScoreDraftForRow(row, rosterSubjects, participant.id);
                if (saveBtn) saveBtn.disabled = false;
            });
        });
        if (saveBtn) saveBtn.addEventListener('click', () => saveParticipantScoreRow(row, rosterSubjects, participant.id));

        // ถ้าคืนค่าจากร่างที่ยังไม่บันทึกมา คะแนนรวม/ผลการประเมินที่แสดงต้องคำนวณใหม่จากค่าร่าง ไม่ใช่ค่าที่บันทึกจริงจาก server ซึ่งอาจไม่ตรงกันแล้ว
        if (draftForParticipant) recomputeRowPreview(row, rosterSubjects, totalCredits);

        tbody.appendChild(row);
    });

    // คอลัมน์รหัสประจำตัวกว้างไม่เท่า 6rem เป๊ะเสมอ (table-layout:auto ขยายตามความยาวข้อความหัวตาราง "รหัสประจำตัว") ถ้า .subject-score-name-col ปักหมุดที่ left:6rem ตายตัวจะไม่ตรงกับความกว้างจริง
    // ทำให้ตอนเลื่อนตาราง (sticky เริ่มทำงาน) คอลัมน์ชื่อไปทับเส้นขอบขวาของคอลัมน์รหัสพอดี เลยต้องวัดความกว้างจริงแล้วตั้ง left ให้ตรงเป๊ะแทนค่าคงที่
    const codeColEl = wrap.querySelector('.subject-score-code-col');
    if (codeColEl) wrap.style.setProperty('--score-name-col-left', `${codeColEl.getBoundingClientRect().width}px`);

    // ถ้ามีคำค้นหาค้างอยู่ (เช่นสลับคอร์ส/บันทึกคะแนนแล้วตารางถูก render ใหม่) ให้กรองซ้ำทันทีตามคำค้นเดิม
    filterScoreTableRows(scoreTableSearchQuery);
}

// ค้นหาแบบกรองแถวที่ render ไว้แล้วตรง ๆ (ไม่ยิง API ซ้ำ ไม่กระทบค่าที่กำลังกรอกค้างอยู่ในแถวอื่น) แม็ตช์ได้ทั้งรหัสประจำตัวและชื่อ-นามสกุล
let scoreTableSearchQuery = '';
function filterScoreTableRows(query) {
    scoreTableSearchQuery = query;
    const normalizedQuery = query.trim().toLowerCase();
    const rows = document.querySelectorAll('#subject-score-table-body tr');
    let visibleCount = 0;
    rows.forEach((row) => {
        const matches = !normalizedQuery || (row.dataset.searchText || '').includes(normalizedQuery);
        row.classList.toggle('hidden', !matches);
        if (matches) visibleCount += 1;
    });

    const searchEmpty = document.getElementById('subject-score-search-empty');
    if (searchEmpty) searchEmpty.classList.toggle('hidden', !(normalizedQuery && rows.length > 0 && visibleCount === 0));
}

// ==========================================
// รายงานคะแนนสำหรับพิมพ์/บันทึกเป็น PDF (แยกจากตารางแก้ไขจริงด้านบน - อ่านอย่างเดียว ไม่มี input/ปุ่ม)
// ==========================================
const THAI_MONTHS_BE = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const SCORE_REPORT_ROWS_PER_PAGE = 18;
// จุดไข่ปลาพิมพ์จริงด้วยตัวอักษร "." (ไม่ใช้ CSS border-style:dotted เพราะเบราว์เซอร์เรนเดอร์จุดเหลี่ยม/ไม่กลมสม่ำเสมอตอนซูม) พิมพ์เกินความกว้างจริงไว้ แล้วให้ .print-report-signature-blank ตัดส่วนเกินทิ้งด้วย overflow:hidden กันความกว้างเพี้ยน
// ใช้ตัวเดียวกันทั้งเส้นลงชื่อด้านบนและช่องชื่อในวงเล็บด้านล่าง ให้ความหนาแน่นของจุดเท่ากันเป๊ะทั้งสองเส้น (ช่องชื่อเว้นว่างให้เขียนเองเสมอ ไม่ดึงชื่อประธานค่าย/หัวหน้าฝ่ายฯ จากระบบมาใส่อัตโนมัติแล้ว)
const SCORE_REPORT_SIGNATURE_DOTS = '.'.repeat(80);

// +543 แปลงเป็นปีพุทธศักราช (news.js มี formatThaiDate อยู่แล้วแต่ไม่บวก 543 ไม่ตรงสเปกรายงานนี้ เลยแยกฟังก์ชันใหม่)
function formatThaiDateBE(date) {
    return `${date.getDate()} ${THAI_MONTHS_BE[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function buildScoreReportHtml(rosterSubjects, roster, courseName, generationNo, totalCreditsOverride) {
    const totalCredits = totalCreditsOverride ?? rosterSubjects.reduce((sum, s) => sum + s.credits, 0);
    // บริบท "own" (แท็บ "รายวิชาของฉัน") ไม่โชว์คะแนนรวม/ผลการประเมินเหมือนบนจอ (ดู showOverallColumns ใน renderScoreTable) - สะท้อนภาพรวมทั้งคอร์สซึ่งรวมวิชาที่มองไม่เห็นด้วย เอาออกกันสับสน
    const showOverallColumns = currentScoreContext === 'full';
    // บริบท "own" (แท็บ "รายวิชาของฉัน") ต่อท้ายชื่อวิชาที่รายงานนี้ครอบคลุมไว้ในหัวข้อด้วย เพราะเป็นแค่บางวิชา (ไม่ใช่ทุกวิชาทั้งคอร์สเหมือนรายงานของหัวหน้าฝ่าย) ไม่งั้นดูไม่ออกว่าเป็นของวิชาไหน
    const subjectListSuffix = showOverallColumns ? '' : ` ${rosterSubjects.map((s) => `รายวิชา${s.name}`).join(', ')}`;
    const issuedDate = formatThaiDateBE(new Date());
    const totalPages = Math.max(1, Math.ceil(roster.length / SCORE_REPORT_ROWS_PER_PAGE));

    const subjectHeaderRow1 = rosterSubjects.map((s) => `
        <th colspan="4" class="print-report-subject-header">${s.name}<br><span class="print-report-hint">(${s.credits} นก.)</span></th>
    `).join('');
    const subjectHeaderRow2 = rosterSubjects.map(() => `
        <th colspan="2" class="print-report-hint">คะแนนอธิบาย</th>
        <th colspan="2" class="print-report-hint">คะแนนสอบ</th>
    `).join('');
    const subjectHeaderRow3 = rosterSubjects.map((s) => {
        const creditShare = totalCredits ? s.credits / totalCredits : 0;
        const explanationSharePct = Math.round(scoreWeightSetting.explanationWeight * creditShare * 10) / 10;
        const achievementSharePct = Math.round(scoreWeightSetting.achievementWeight * creditShare * 10) / 10;
        return `
        <th class="print-report-hint">เต็ม<br>(${s.explanationMaxScore})</th>
        <th class="print-report-hint">คำนวณ<br>(${explanationSharePct}%)</th>
        <th class="print-report-hint">เต็ม<br>(${s.achievementMaxScore})</th>
        <th class="print-report-hint">คำนวณ<br>(${achievementSharePct}%)</th>
    `;
    }).join('');

    const pageChunks = [];
    for (let i = 0; i < roster.length; i += SCORE_REPORT_ROWS_PER_PAGE) {
        pageChunks.push(roster.slice(i, i + SCORE_REPORT_ROWS_PER_PAGE));
    }
    if (pageChunks.length === 0) pageChunks.push([]);

    return pageChunks.map((pageRoster, pageIndex) => {
        const rows = pageRoster.map((participant) => {
            const scoreCells = rosterSubjects.map((s) => {
                const scoreEntry = participant.scores.find((sc) => sc.subjectId === s.id);
                const explanationScore = scoreEntry?.explanationScore ?? null;
                const achievementScore = scoreEntry?.achievementScore ?? null;
                const creditShare = totalCredits ? s.credits / totalCredits : 0;
                const explanationQuota = scoreWeightSetting.explanationWeight * creditShare;
                const achievementQuota = scoreWeightSetting.achievementWeight * creditShare;
                const explanationPercent = explanationScore !== null ? `${Math.round((explanationScore / s.explanationMaxScore) * explanationQuota)}%` : '-';
                const achievementPercent = achievementScore !== null ? `${Math.round((achievementScore / s.achievementMaxScore) * achievementQuota)}%` : '-';
                return `
                    <td>${explanationScore ?? '-'}</td>
                    <td>${explanationPercent}</td>
                    <td>${achievementScore ?? '-'}</td>
                    <td>${achievementPercent}</td>
                `;
            }).join('');
            return `
                <tr>
                    <td>${participant.code}</td>
                    <td class="print-report-name-col">${participant.fullName}</td>
                    ${scoreCells}
                    ${showOverallColumns ? `
                        <td>${participant.summary.grandTotal}</td>
                        <td>${participant.summary.grade}</td>
                    ` : ''}
                </tr>
            `;
        }).join('');

        return `
            <div class="print-report-page">
                <div class="print-report-meta">วันที่ออกเอกสาร ${issuedDate} หน้าที่ ${pageIndex + 1}/${totalPages}</div>
                <div class="print-report-header">
                    <img src="../assets/images/logo/logo1.png" alt="PTN logo" class="print-report-logo">
                    <h1>รายงานคะแนนผลสัมฤทธิ์คอร์ส${courseName}${subjectListSuffix}</h1>
                    <p>โครงการค่ายวิชาการพี่ติวน้อง ครั้งที่ ${generationNo}</p>
                </div>
                <table class="print-report-table">
                    <thead>
                        <tr>
                            <th rowspan="3">รหัส<br>ประจำตัว</th>
                            <th rowspan="3">ชื่อ-นามสกุล</th>
                            ${subjectHeaderRow1}
                            ${showOverallColumns ? `
                                <th rowspan="3">คะแนนรวม<br>(100%)</th>
                                <th rowspan="3">ผลการ<br>ประเมิน</th>
                            ` : ''}
                        </tr>
                        <tr>${subjectHeaderRow2}</tr>
                        <tr>${subjectHeaderRow3}</tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                ${pageIndex === pageChunks.length - 1 ? `
                    <div class="print-report-signatures">
                        <div class="print-report-signature-box">
                            <span class="print-report-signature-prefix">ลงชื่อ</span><span class="print-report-signature-blank"><span class="print-report-signature-dots-clip">${SCORE_REPORT_SIGNATURE_DOTS}</span><span class="print-report-signature-name">(<span class="print-report-signature-name-dots-clip">${SCORE_REPORT_SIGNATURE_DOTS}</span>)</span></span><span class="print-report-signature-suffix">${showOverallColumns ? 'ประธานค่าย' : 'ผู้รับผิดชอบรายวิชา'}</span>
                        </div>
                        <div class="print-report-signature-box">
                            <span class="print-report-signature-prefix">ลงชื่อ</span><span class="print-report-signature-blank"><span class="print-report-signature-dots-clip">${SCORE_REPORT_SIGNATURE_DOTS}</span><span class="print-report-signature-name">(<span class="print-report-signature-name-dots-clip">${SCORE_REPORT_SIGNATURE_DOTS}</span>)</span></span><span class="print-report-signature-suffix">หัวหน้าฝ่ายวิชาการ</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function recomputeRowPreview(row, rosterSubjects, totalCreditsOverride) {
    const totalCredits = totalCreditsOverride ?? rosterSubjects.reduce((sum, s) => sum + s.credits, 0);
    const scoreBySubjectId = new Map();
    rosterSubjects.forEach((s) => {
        const explanationInput = row.querySelector(`.subject-score-input[data-subject-id="${s.id}"][data-type="explanation"]`);
        const achievementInput = row.querySelector(`.subject-score-input[data-subject-id="${s.id}"][data-type="achievement"]`);
        const explanationScore = explanationInput.value === '' ? 0 : Number(explanationInput.value);
        const achievementScore = achievementInput.value === '' ? 0 : Number(achievementInput.value);
        scoreBySubjectId.set(s.id, { explanationScore, achievementScore });

        // แสดง % สดที่คะแนนดิบนี้จะได้จากคะแนนรวม (คะแนนดิบ/คะแนนเต็ม คูณส่วนแบ่งคะแนนรวมของประเภทนี้) ระหว่างพิมพ์ - สูตรเดียวกับ subjectScore ใน computeSubjectScoreSummary
        const creditShare = totalCredits ? s.credits / totalCredits : 0;
        const explanationQuota = scoreWeightSetting.explanationWeight * creditShare;
        const achievementQuota = scoreWeightSetting.achievementWeight * creditShare;
        const explanationPercentEl = row.querySelector(`.subject-score-percent[data-subject-id="${s.id}"][data-type="explanation"]`);
        const achievementPercentEl = row.querySelector(`.subject-score-percent[data-subject-id="${s.id}"][data-type="achievement"]`);
        if (explanationPercentEl) explanationPercentEl.textContent = `${Math.round((explanationScore / s.explanationMaxScore) * explanationQuota)}%`;
        if (achievementPercentEl) achievementPercentEl.textContent = `${Math.round((achievementScore / s.achievementMaxScore) * achievementQuota)}%`;
    });

    const summary = computeSubjectScoreSummary(rosterSubjects, scoreBySubjectId, gradeBands, scoreWeightSetting, totalCredits);
    // พี่ค่ายที่สอน (instructor) ไม่มีคอลัมน์คะแนนรวม/ผลการประเมินในตาราง (ดู renderScoreTable) เซลล์เหล่านี้เลยไม่มีอยู่จริงในแถว ต้องเช็คก่อนเสมอ
    const grandTotalEl = row.querySelector('[data-field="grandTotal"]');
    if (grandTotalEl) {
        grandTotalEl.textContent = summary.grandTotal;
        grandTotalEl.className = 'subject-score-summary-cell subject-score-grandtotal subject-score-group-start';
        grandTotalEl.style.cssText = gradeTextColorStyle(summary.gradeColorKey);
    }

    const gradeEl = row.querySelector('[data-field="grade"] span');
    if (gradeEl) {
        gradeEl.textContent = summary.grade;
        gradeEl.className = 'grade-badge';
        gradeEl.style.cssText = gradeBadgeStyle(summary.gradeColorKey);
    }
}

function saveParticipantScoreRow(row, rosterSubjects, participantId) {
    const scores = rosterSubjects.map((s) => {
        const explanationInput = row.querySelector(`.subject-score-input[data-subject-id="${s.id}"][data-type="explanation"]`);
        const achievementInput = row.querySelector(`.subject-score-input[data-subject-id="${s.id}"][data-type="achievement"]`);
        return {
            subjectId: s.id,
            explanationScore: explanationInput.value === '' ? null : Number(explanationInput.value),
            achievementScore: achievementInput.value === '' ? null : Number(achievementInput.value),
        };
    });

    fetch(`/api/subject-scores/${participantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores }),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            showActivitiesToast('บันทึกคะแนนสำเร็จ', true);
            // บันทึกสำเร็จแล้ว ไม่ใช่ร่างที่ค้างอยู่อีกต่อไป ลบร่างทิ้งและปิดปุ่มกลับเป็นสีเทาจนกว่าจะแก้ไขใหม่ พร้อมเลิกไฮไลต์ช่องที่เพิ่งบันทึกไป
            clearScoreDraftForParticipant(participantId);
            const saveBtn = row.querySelector('.score-group-save-btn');
            if (saveBtn) saveBtn.disabled = true;
            row.querySelectorAll('.subject-score-input').forEach((input) => {
                input.dataset.savedValue = input.value;
                input.classList.remove('subject-score-input--dirty');
            });
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'บันทึกคะแนนไม่สำเร็จ', false);
        });
}

// ==========================================
// ตารางเรียนแบบกริด (แกนตั้ง = วันที่จริง, แกนนอน = ช่วงเวลารายชั่วโมง) ใช้ร่วมกันทั้งฝั่งพี่ค่าย (แก้ไขได้) และน้องค่าย (ดูอย่างเดียว)
// ==========================================
const TIMETABLE_WEEKDAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TIMETABLE_THAI_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function timetableTimeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function formatTimetableDateLabel(dateKey) {
    // dateKey เป็น "YYYY-MM-DD" ล้วน ๆ (จาก classDate ISO string ตัดแค่ส่วนวันที่) แยกเลขเองแทนใช้ Date object กันปัญหา timezone เพี้ยนวันเลื่อน
    const [y, m, d] = dateKey.split('-').map(Number);
    const utcDate = new Date(Date.UTC(y, m - 1, d));
    return `${TIMETABLE_WEEKDAY_SHORT[utcDate.getUTCDay()]} ${d} ${TIMETABLE_THAI_MONTH_SHORT[m - 1]}`;
}

const TIMETABLE_LANE_HEIGHT_REM = 5.6;
// ความสูงการ์ด (ต้องตรงกับ .timetable-entry { height } ใน CSS) ใช้คำนวณ offset ให้การ์ดอยู่กึ่งกลางช่องแถวย่อย (lane) แนวตั้ง แทนที่จะชิดขอบบน
const TIMETABLE_ENTRY_HEIGHT_REM = 5.2;
const TIMETABLE_LANE_OFFSET_REM = (TIMETABLE_LANE_HEIGHT_REM - TIMETABLE_ENTRY_HEIGHT_REM) / 2;

// จัดคาบที่เวลาซ้อนกันในวันเดียวกันให้ไปอยู่คนละ "แถวย่อย" (lane) กัน ไม่ทับกันเอง - อัลกอริทึมเดียวกับที่ใช้จัดห้องประชุมไม่ให้ชนกัน
// (greedy: เรียงตามเวลาเริ่ม แล้วหา lane แรกที่ว่างพอ ไม่มีก็เปิด lane ใหม่)
function assignTimetableLanes(dayEntries) {
    const sorted = [...dayEntries].sort((a, b) => timetableTimeToMinutes(a.startTime) - timetableTimeToMinutes(b.startTime));
    const laneEndMinutes = [];
    const placements = [];
    sorted.forEach((entry) => {
        const start = timetableTimeToMinutes(entry.startTime);
        const end = timetableTimeToMinutes(entry.endTime);
        let lane = laneEndMinutes.findIndex((endTime) => endTime <= start);
        if (lane === -1) {
            lane = laneEndMinutes.length;
            laneEndMinutes.push(end);
        } else {
            laneEndMinutes[lane] = end;
        }
        placements.push({ entry, lane });
    });
    return { placements, laneCount: laneEndMinutes.length || 1 };
}

// entries: [{ id, classDate (ISO string), startTime, endTime, subject: {name}|null, note, instructors: [...] }]
// options: { editable: boolean, onDelete: (entry) => void }
// วาดเป็นไทม์ไลน์ตำแหน่งตามเปอร์เซนต์ของเวลาจริง (ไม่ใช่ตารางคอลัมน์รายชั่วโมง) เพื่อรองรับเวลาที่ไม่ตรงชั่วโมง/ครึ่งชั่วโมง และคาบที่เวลาซ้อนกันได้แม่นยำ
function renderTimetableGrid(wrap, entries, options = {}) {
    if (!wrap) return;
    if (entries.length === 0) {
        wrap.innerHTML = '';
        return;
    }

    const byDate = new Map();
    entries.forEach((entry) => {
        const dateKey = entry.classDate.slice(0, 10);
        if (!byDate.has(dateKey)) byDate.set(dateKey, []);
        byDate.get(dateKey).push(entry);
    });
    const dateKeys = [...byDate.keys()].sort();

    const minMinutes = Math.min(...entries.map((e) => timetableTimeToMinutes(e.startTime)));
    const maxMinutes = Math.max(...entries.map((e) => timetableTimeToMinutes(e.endTime)));
    // ช่วงเวลาแกนนอนเริ่ม 07:00-22:00 เป็นค่าเริ่มต้นเสมอ (ครอบคลุมตารางเรียนทั่วไปทั้งวัน) ยืดออกได้ถ้ามีคาบนอกช่วงนี้จริง
    const startHour = Math.min(7, Math.floor(minMinutes / 60));
    const endHour = Math.max(22, Math.ceil(maxMinutes / 60));
    const dayStartMinutes = startHour * 60;
    const totalMinutes = (endHour - startHour) * 60;

    const pad2 = (n) => String(n).padStart(2, '0');
    const rulerHours = [];
    for (let h = startHour; h < endHour; h++) rulerHours.push(h);
    const rulerCells = rulerHours.map((h) => `<div class="timetable-ruler-hour">${pad2(h)}:00-${pad2(h + 1)}:00</div>`).join('');
    // ความกว้างขั้นต่ำต่อคอลัมน์ชั่วโมง (7rem - กว้างพอสำหรับการ์ดชื่อวิชายาว ๆ ตามธรรมชาติ ไม่ต้องพึ่ง min-width บวมเกิน slot จนชนคาบข้างเคียงบ่อย ๆ)
    // จอกว้างพอ ruler/track จะยืดแบ่งเท่า ๆ กันเกินนี้เอง (flex:1) แต่จอแคบจะไม่ถูกบีบต่ำกว่านี้ ล้นแล้วเลื่อนแนวนอนแทน
    // ต้องใส่ min-width เดียวกันทั้ง ruler กับทุกแถว track กันไม่ให้ความกว้างจริงเพี้ยนไม่ตรงกัน (การ์ดในแถว track เป็น position:absolute ไม่มีเนื้อหาให้ใช้คำนวณ intrinsic width เองได้)
    const timelineWidthRem = rulerHours.length * 7;

    const dayRows = dateKeys.map((dateKey) => {
        const { placements, laneCount } = assignTimetableLanes(byDate.get(dateKey));

        const entryDivs = placements.map(({ entry, lane }) => {
            const startMin = timetableTimeToMinutes(entry.startTime) - dayStartMinutes;
            const endMin = timetableTimeToMinutes(entry.endTime) - dayStartMinutes;
            const leftPct = (startMin / totalMinutes) * 100;
            const widthPct = ((endMin - startMin) / totalMinutes) * 100;

            const title = entry.subject ? entry.subject.name : (entry.activityName || 'ไม่ระบุกิจกรรม');
            const noteLine = entry.note ? `<p class="timetable-cell-note">${entry.note}</p>` : '';
            // โชว์ทั้งชื่อเล่นและชื่อจริง กันสับสนเวลามีพี่ค่ายชื่อเล่นซ้ำกันหลายคน - ถ้าไม่มีชื่อเล่น (กรอกไม่ครบ) ก็โชว์แค่ชื่อจริงเฉย ๆ ไม่ต้องมีวงเล็บซ้อนชื่อเดียวกัน
            const instructorLine = entry.instructors.length
                ? `<p class="timetable-cell-instructor">${entry.instructors.map((i) => `พี่${i.nickname ? `${i.nickname} (${i.name})` : i.name}`).join(', ')}</p>`
                : '';
            const deleteBtn = options.editable
                ? `<button type="button" class="timetable-cell-delete-btn" data-entry-id="${entry.id}" title="ลบ">${TRASH_ICON}</button>`
                : '';

            const entryTypeClass = entry.subject ? 'timetable-entry--subject' : 'timetable-entry--note';
            const editableClass = options.editable ? 'timetable-entry--editable' : '';

            return `
                <div class="timetable-entry ${entryTypeClass} ${editableClass}"
                     style="left: ${leftPct}%; width: ${widthPct}%; top: ${lane * TIMETABLE_LANE_HEIGHT_REM + TIMETABLE_LANE_OFFSET_REM}rem;"
                     data-entry-id="${entry.id}">
                    <p class="timetable-cell-title">${title}</p>
                    <p class="timetable-cell-time">${entry.startTime}-${entry.endTime}</p>
                    ${noteLine}
                    ${instructorLine}
                    ${deleteBtn}
                </div>
            `;
        }).join('');

        return `
            <div class="timetable-day-row">
                <div class="timetable-grid-date-col">${formatTimetableDateLabel(dateKey)}</div>
                <div class="timetable-day-track" style="height: ${laneCount * TIMETABLE_LANE_HEIGHT_REM}rem; min-width: ${timelineWidthRem}rem;">${entryDivs}</div>
            </div>
        `;
    }).join('');

    wrap.innerHTML = `
        <div class="timetable-timeline">
            <div class="timetable-timeline-header">
                <div class="timetable-grid-date-col"></div>
                <div class="timetable-ruler" style="min-width: ${timelineWidthRem}rem;">${rulerCells}</div>
            </div>
            ${dayRows}
        </div>
    `;

    if (options.editable && options.onDelete) {
        wrap.querySelectorAll('.timetable-cell-delete-btn').forEach((btn) => {
            const entryId = Number(btn.dataset.entryId);
            const entry = entries.find((e) => e.id === entryId);
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                options.onDelete(entry);
            });
        });
    }
}

// ==========================================
// แท็บ: จัดการตารางเรียน
// ==========================================
function renderScheduleSubjectSelect() {
    const select = document.getElementById('schedule-subject-select');
    if (!select) return;
    // กรองเฉพาะวิชาของคอร์สที่แท็บ "จัดการตารางเรียน" กำลังเลือกอยู่ (selectedScheduleCourseId) รวมวิชา "ทั้งคู่" (courseFormatId: null) ด้วยเสมอ กันเลือกวิชาผิดคอร์สมาผูกกับคาบเรียน (backend เช็คซ้ำอีกชั้น)
    const courseSubjects = subjects.filter((s) => s.courseFormatId === selectedScheduleCourseId || s.courseFormatId === null);
    select.innerHTML = '<option value="">-- ไม่ระบุวิชา --</option>' +
        courseSubjects.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
    updateScheduleInstructorOptions();
}

// รายชื่อผู้สอนที่กำลังเลือกไว้สำหรับรายการตารางเรียนที่ "กำลังจะสร้าง" (ยังไม่มี id จริงจนกว่าจะกดเพิ่มรายการ จึงเก็บไว้ฝั่ง client ก่อน)
let scheduleDateSelects = null;
let scheduleStartSelects = null;
let scheduleEndSelects = null;
let scheduleFormInstructorIds = [];
let scheduleFormInstructorPool = [];

// เลือกวิชาในฟอร์มเพิ่มตารางเรียนแล้ว ให้โผล่ช่องเลือกผู้สอน จำกัดตัวเลือกเฉพาะผู้สอนที่ถูกมอบหมายให้วิชานั้นจริง ๆ (จากแท็บ "จัดการผู้สอน")
// และเลือกวิชากับกิจกรรมพร้อมกันไม่ได้ (backend เช็คซ้ำอีกชั้น) - เลือกวิชาแล้วปิดช่องกิจกรรมไว้
function updateScheduleInstructorOptions() {
    const subjectSelect = document.getElementById('schedule-subject-select');
    const activityInput = document.getElementById('schedule-activity-input');
    const group = document.getElementById('schedule-instructor-group');
    if (!subjectSelect || !group) return;

    const subjectId = subjectSelect.value ? Number(subjectSelect.value) : null;
    const subject = subjects.find((s) => s.id === subjectId);

    // ตั้งต้นด้วยผู้สอนที่มอบหมายไว้กับวิชานี้แล้ว (จากแท็บ "จัดการรายวิชา") ไม่ต้องมาเลือกซ้ำทุกครั้งที่เพิ่มคาบเรียน - ยังลบออกจากคาบนี้คาบเดียวได้ตามปกติถ้าคาบนี้ไม่ได้ใช้ทุกคน
    scheduleFormInstructorIds = subject ? [...subject.instructorUserIds] : [];
    scheduleFormInstructorPool = subject ? subject.instructors : [];
    group.classList.toggle('hidden', !subject);
    renderScheduleInstructorChips();

    if (activityInput) {
        activityInput.disabled = Boolean(subject);
        if (subject) activityInput.value = '';
    }
}

// พิมพ์ชื่อกิจกรรมแล้ว เลือกวิชาพร้อมกันไม่ได้ - ล้าง+ปิดช่องเลือกวิชาไว้ระหว่างที่มีข้อความในช่องกิจกรรม
function handleScheduleActivityInput() {
    const activityInput = document.getElementById('schedule-activity-input');
    const subjectSelect = document.getElementById('schedule-subject-select');
    if (!activityInput || !subjectSelect) return;

    const hasActivity = Boolean(activityInput.value.trim());
    subjectSelect.disabled = hasActivity;
    if (hasActivity && subjectSelect.value) {
        subjectSelect.value = '';
        updateScheduleInstructorOptions();
    }
}

function renderScheduleInstructorChips() {
    const chipList = document.getElementById('schedule-instructor-chip-list');
    const select = document.getElementById('schedule-instructor-add-select');
    if (!chipList || !select) return;

    chipList.innerHTML = scheduleFormInstructorIds.length
        ? scheduleFormInstructorIds.map((userId) => {
            const person = scheduleFormInstructorPool.find((i) => i.userId === userId);
            return `
                <span class="instructor-chip" data-user-id="${userId}">
                    ${person ? person.name : ''}${person?.nickname ? ` (${person.nickname})` : ''}
                    <button type="button" class="instructor-chip-remove" title="เอาออก">&times;</button>
                </span>
            `;
        }).join('')
        : '<p class="instructor-assign-empty-hint">ยังไม่ได้เลือกผู้สอน</p>';

    const available = scheduleFormInstructorPool.filter((i) => !scheduleFormInstructorIds.includes(i.userId));
    select.innerHTML = '<option value="">-- เลือกผู้สอนเพิ่ม --</option>' +
        available.map((i) => `<option value="${i.userId}">${i.name}${i.nickname ? ` (${i.nickname})` : ''}</option>`).join('');

    chipList.querySelectorAll('.instructor-chip-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
            const userId = Number(btn.closest('.instructor-chip').dataset.userId);
            scheduleFormInstructorIds = scheduleFormInstructorIds.filter((id) => id !== userId);
            renderScheduleInstructorChips();
        });
    });
}

function handleScheduleInstructorAddClick() {
    const select = document.getElementById('schedule-instructor-add-select');
    if (!select || !select.value) return;
    scheduleFormInstructorIds.push(Number(select.value));
    renderScheduleInstructorChips();
}

// เก็บรายการล่าสุดไว้ระดับโมดูล ให้ popup เต็มจอ (ดูด้านล่าง) วาดซ้ำได้ทันทีโดยไม่ต้องยิง fetch อีกรอบ
let currentScheduleEntries = [];

function loadSchedule() {
    const wrap = document.getElementById('schedule-grid-wrap');
    const empty = document.getElementById('schedule-list-empty');
    if (!wrap || !empty || !selectedScheduleCourseId) return;

    Loader.renderSkeletonCards(wrap, 3);
    fetch(`/api/class-schedules?courseFormatId=${selectedScheduleCourseId}`)
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((entries) => {
            currentScheduleEntries = entries;
            empty.classList.toggle('hidden', entries.length !== 0);
            renderTimetableGrid(wrap, entries, { editable: academicTier === 'manager', onDelete: deleteScheduleEntry });
            renderScheduleFullscreenIfOpen();
            scheduleActivitySuggestions = [...new Set(entries.map((e) => e.activityName).filter(Boolean))];
        })
        .catch((error) => {
            console.error('โหลดตารางเรียนไม่สำเร็จ:', error);
            showActivitiesToast('โหลดตารางเรียนไม่สำเร็จ', false);
        });
}

// ปุ่ม "Full" เปิด popup แสดงตารางเรียนเดียวกันเต็มจอ - ใช้ renderTimetableGrid ซ้ำ ไม่ต้องเขียนใหม่ ข้อมูลชุดเดียวกับตารางปกติเสมอ
function renderScheduleFullscreenIfOpen() {
    const modal = document.getElementById('schedule-fullscreen-modal');
    const fsWrap = document.getElementById('schedule-fullscreen-grid-wrap');
    if (!modal || !fsWrap || modal.classList.contains('hidden')) return;
    renderTimetableGrid(fsWrap, currentScheduleEntries, { editable: academicTier === 'manager', onDelete: deleteScheduleEntry });
}

function openScheduleFullscreen() {
    const modal = document.getElementById('schedule-fullscreen-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderScheduleFullscreenIfOpen();
}

function closeScheduleFullscreen() {
    document.getElementById('schedule-fullscreen-modal')?.classList.add('hidden');
}

// ชื่อกิจกรรมที่เคยกรอกไว้แล้วในคอร์สนี้ (ไม่ซ้ำ) ให้เลือกจาก dropdown ที่ทำเองแทนพิมพ์ซ้ำ - ไม่ใช้ <input list>/<datalist>
// ของเบราว์เซอร์ เพราะ Chrome ใส่ลูกศร dropdown ของตัวเองให้มาซ้อนกับไอคอนที่ออกแบบเอง ซ่อนไม่ได้แน่นอนข้ามเบราว์เซอร์
let scheduleActivitySuggestions = [];

function renderActivityComboboxOptions(filterText) {
    const list = document.getElementById('schedule-activity-suggestions');
    if (!list) return;
    const query = (filterText || '').trim().toLowerCase();
    const matches = scheduleActivitySuggestions.filter((n) => !query || n.toLowerCase().includes(query));

    list.innerHTML = '';
    matches.forEach((name) => {
        const option = document.createElement('div');
        option.className = 'activity-combobox-option';
        option.textContent = name;
        // mousedown (ไม่ใช่ click) กัน blur ของ input ปิด dropdown ไปก่อนที่ event เลือกตัวเลือกจะทำงานทัน
        option.addEventListener('mousedown', (event) => {
            event.preventDefault();
            document.getElementById('schedule-activity-input').value = name;
            list.classList.add('hidden');
            handleScheduleActivityInput();
        });
        list.appendChild(option);
    });
    list.classList.toggle('hidden', matches.length === 0);
}

function initScheduleActivityCombobox() {
    const input = document.getElementById('schedule-activity-input');
    const list = document.getElementById('schedule-activity-suggestions');
    if (!input || !list) return;

    input.addEventListener('focus', () => renderActivityComboboxOptions(input.value));
    input.addEventListener('input', () => {
        renderActivityComboboxOptions(input.value);
        handleScheduleActivityInput();
    });
    input.addEventListener('blur', () => list.classList.add('hidden'));
}

function handleScheduleCreateSubmit(event) {
    event.preventDefault();
    const dateInput = document.getElementById('schedule-date-input');
    const subjectSelect = document.getElementById('schedule-subject-select');
    const startInput = document.getElementById('schedule-start-input');
    const endInput = document.getElementById('schedule-end-input');
    const activityInput = document.getElementById('schedule-activity-input');
    const noteInput = document.getElementById('schedule-note-input');
    const btn = event.target.querySelector('button[type="submit"]');

    // ช่องวันที่/เวลาเป็น input[type=hidden] (ค่ามาจาก dropdown) เบราว์เซอร์ไม่เช็ค required ให้ ต้องเช็คเอง
    if (!dateInput.value) {
        showActivitiesToast('กรุณาเลือกวันที่', false);
        return;
    }
    if (!startInput.value || !endInput.value) {
        showActivitiesToast('กรุณาเลือกเวลาเริ่มและเวลาสิ้นสุด', false);
        return;
    }

    Loader.setButtonLoading(btn, 'กำลังเพิ่ม...');

    fetch('/api/class-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            courseFormatId: selectedScheduleCourseId,
            classDate: dateInput.value,
            subjectId: subjectSelect.value || null,
            instructorUserIds: scheduleFormInstructorIds,
            startTime: startInput.value,
            endTime: endInput.value,
            activityName: activityInput.value.trim(),
            note: noteInput.value.trim(),
        }),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            scheduleDateSelects?.clear();
            subjectSelect.value = '';
            subjectSelect.disabled = false;
            activityInput.value = '';
            activityInput.disabled = false;
            updateScheduleInstructorOptions();
            scheduleStartSelects?.clear();
            scheduleEndSelects?.clear();
            noteInput.value = '';
            showActivitiesToast('เพิ่มรายการตารางเรียนสำเร็จ', true);
            loadSchedule();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'เพิ่มรายการตารางเรียนไม่สำเร็จ', false);
        })
        .finally(() => {
            Loader.clearButtonLoading(btn);
        });
}

async function deleteScheduleEntry(entry) {
    const confirmed = await showConfirm(`ลบรายการเวลา ${entry.startTime}-${entry.endTime} ใช่หรือไม่?`, {
        title: 'ยืนยันการลบ',
        confirmText: 'ลบ',
    });
    if (!confirmed) return;

    fetch(`/api/class-schedules/${entry.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showActivitiesToast('ลบรายการสำเร็จ', true);
            loadSchedule();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('ลบรายการไม่สำเร็จ', false);
        });
}

// นำออกเป็น Excel: ใช้ CSV แทนไลบรารีสร้าง .xlsx จริง (แพ็กเกจ xlsx บน npm มีช่องโหว่ระดับ high ที่ยังไม่ได้แพตช์ - prototype pollution + ReDoS)
// Excel เปิดไฟล์ CSV ได้ตรง ๆ อยู่แล้ว ไม่ต้องพึ่งไลบรารีเพิ่ม ตรงตามธรรมเนียมเดิมของหน้านี้ที่เลี่ยงไลบรารีภายนอกมาตลอด (ดูปุ่มพิมพ์ที่ใช้ window.print() แทน PDF library)
function csvEscapeCell(value) {
    const text = value === null || value === undefined ? '' : String(value);
    // ต้องครอบด้วย " เมื่อมีจุลภาค/ขึ้นบรรทัดใหม่/เครื่องหมาย " เอง (มาตรฐาน CSV) ตัว " ในเนื้อหาต้อง escape เป็น "" ซ้อนกัน
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

// แปลงเลขคอลัมน์ (1=A, 2=B, ..., 27=AA, ...) เป็นตัวอักษรคอลัมน์สเปรดชีต ใช้สร้างเลขที่อ้างอิงเซลล์ในสูตร
function excelColumnLetter(n) {
    let s = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

// นิพจน์ IF ซ้อนไล่จากช่วงคะแนนสูงไปต่ำ ตามเกณฑ์ผลการประเมินจริงที่ตั้งไว้ (gradeBands) อ้างอิงเซลล์คะแนนรวมของแถวนั้น
function buildGradeFormula(totalCellRef) {
    let expr = '""';
    for (let i = gradeBands.length - 1; i >= 0; i--) {
        const b = gradeBands[i];
        expr = `IF(${totalCellRef}>=${b.minScore},"${b.label}",${expr})`;
    }
    return `=${expr}`;
}

function exportScoreTableToExcel() {
    if (currentRoster.length === 0 || currentRosterSubjects.length === 0) {
        showActivitiesToast('ไม่มีข้อมูลให้นำออกในคอร์สนี้', false);
        return;
    }

    const totalCredits = currentTotalCredits;
    const subjectCount = currentRosterSubjects.length;
    // บริบท "own" (แท็บ "รายวิชาของฉัน") ไม่โชว์คะแนนรวม/ผลการประเมินเหมือนบนจอ (ดู showOverallColumns ใน renderScoreTable) - สะท้อนภาพรวมทั้งคอร์สซึ่งรวมวิชาที่มองไม่เห็นด้วย เอาออกกันสับสน
    const showOverallColumns = currentScoreContext === 'full';
    // ตำแหน่งคอลัมน์คะแนนรวม/ผลการประเมิน (คอลัมน์ 1-2 = รหัส/ชื่อ, ตามด้วยวิชาละ 4 คอลัมน์) - ใช้แค่ตอน showOverallColumns เท่านั้น
    const totalCol = 3 + subjectCount * 4;
    const totalColLetter = excelColumnLetter(totalCol);

    // แถวหัวตาราง 3 แถว ให้เค้าโครงตรงกับตารางคะแนนบนจอ (ชื่อวิชา+หน่วยกิต / ประเภทคะแนน / คะแนนเต็ม+สัดส่วน) - CSV รวมเซลล์ไม่ได้ เลยเว้นว่างช่องที่เหลือของกลุ่มแทน colspan
    const headerRow1 = ['รหัสประจำตัว', 'ชื่อ-นามสกุล'];
    const headerRow2 = ['', ''];
    const headerRow3 = ['', ''];
    currentRosterSubjects.forEach((s) => {
        const creditShare = totalCredits ? s.credits / totalCredits : 0;
        const explanationSharePct = Math.round(scoreWeightSetting.explanationWeight * creditShare * 10) / 10;
        const achievementSharePct = Math.round(scoreWeightSetting.achievementWeight * creditShare * 10) / 10;
        headerRow1.push(`${s.name} (${s.credits} นก.)`, '', '', '');
        headerRow2.push('คะแนนอธิบาย', '', 'คะแนนสอบ', '');
        headerRow3.push(`เต็ม ${s.explanationMaxScore} · ${explanationSharePct}%`, '', `เต็ม ${s.achievementMaxScore} · ${achievementSharePct}%`, '');
    });
    if (showOverallColumns) {
        headerRow1.push('คะแนนรวม (100%)', 'ผลการประเมิน');
        headerRow2.push('', '');
        headerRow3.push('', '');
    }

    // ใส่สูตรจริงแทนค่าคำนวณสำเร็จรูป (% แต่ละวิชา / คะแนนรวม / ผลการประเมิน) ให้แก้คะแนนดิบใน Excel แล้วตัวเลขอื่นไหลตามอัตโนมัติเหมือนหน้าเว็บ
    const dataRows = currentRoster.map((participant, rowIdx) => {
        const excelRow = rowIdx + 4; // แถวข้อมูลเริ่มที่ 4 (เว้น 3 แถวหัวตารางด้านบน)
        const row = [participant.code, participant.fullName];
        const subjectPartFormulas = [];

        currentRosterSubjects.forEach((s, subjIdx) => {
            const scoreEntry = participant.scores.find((sc) => sc.subjectId === s.id);
            const explanationScore = scoreEntry?.explanationScore ?? '';
            const achievementScore = scoreEntry?.achievementScore ?? '';
            const creditShare = totalCredits ? s.credits / totalCredits : 0;
            const explanationQuota = scoreWeightSetting.explanationWeight * creditShare;
            const achievementQuota = scoreWeightSetting.achievementWeight * creditShare;

            const baseCol = 3 + subjIdx * 4;
            const explRawRef = `${excelColumnLetter(baseCol)}${excelRow}`;
            const achvRawRef = `${excelColumnLetter(baseCol + 2)}${excelRow}`;

            row.push(
                explanationScore,
                `=ROUND((${explRawRef}/${s.explanationMaxScore})*${explanationQuota},0)&"%"`,
                achievementScore,
                `=ROUND((${achvRawRef}/${s.achievementMaxScore})*${achievementQuota},0)&"%"`,
            );

            subjectPartFormulas.push(`ROUND((${explRawRef}/${s.explanationMaxScore})*${explanationQuota}+(${achvRawRef}/${s.achievementMaxScore})*${achievementQuota},2)`);
        });

        if (showOverallColumns) {
            row.push(`=ROUND(${subjectPartFormulas.join('+')},2)`, buildGradeFormula(`${totalColLetter}${excelRow}`));
        }
        return row;
    });

    // ขึ้นต้นด้วย BOM (﻿) กัน Excel เข้าใจไฟล์ผิดเป็นอักขระอื่นแทน UTF-8 จนภาษาไทยเพี้ยน (ปัญหารู้จักกันดีของ Excel + CSV UTF-8)
    const csvContent = '﻿' + [headerRow1, headerRow2, headerRow3, ...dataRows].map((row) => row.map(csvEscapeCell).join(',')).join('\r\n');

    const courseName = courseFormats.find((c) => c.id === selectedScoreCourseId)?.name || 'ตารางคะแนน';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ตารางคะแนน-${courseName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ==========================================
// แท็บ: จัดการเอกสาร
// ==========================================
const COURSE_DOC_SELECT_ID = 'document-course-select';

// รูปแบบเดียวกับ renderSubjectFormatSelect (ฟอร์ม "เพิ่มรายวิชาใหม่"): บังคับต้องเลือกจริง (placeholder value="" เลือกไม่ได้)
// value="both" สื่อว่าเอกสารนี้ใช้ร่วมกันทุกคอร์ส (courseFormatId: null ฝั่ง backend เหมือนเดิม) - แปลงกลับเป็น '' ก่อนส่งจริงใน uploadStudyDocumentFile
function renderDocumentCourseSelect() {
    const select = document.getElementById(COURSE_DOC_SELECT_ID);
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>-- เลือกคอร์ส --</option>' +
        '<option value="both">ปรับพื้นฐาน/เตรียมสอบ</option>' +
        courseFormats.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
}

function loadStudyDocuments() {
    Loader.renderSkeletonCards(document.getElementById('document-list'), 3);
    return fetch('/api/study-documents')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((documents) => renderDocumentList(documents))
        .catch((error) => {
            console.error('โหลดรายการเอกสารไม่สำเร็จ:', error);
            showActivitiesToast('โหลดรายการเอกสารไม่สำเร็จ', false);
        });
}

// แบ่งหน้ารายการ "จัดการเอกสาร" - เก็บชุดเต็มไว้ระดับโมดูลให้สลับหน้าเรียก render ซ้ำได้โดยไม่ต้อง fetch ใหม่
const DOCUMENT_LIST_PAGE_SIZE = 5;
let documentListCurrentPage = 1;
let currentStudyDocuments = [];

function renderDocumentList(documents) {
    const list = document.getElementById('document-list');
    const empty = document.getElementById('document-list-empty');
    if (!list || !empty) return;

    currentStudyDocuments = documents;
    list.innerHTML = '';
    empty.classList.toggle('hidden', documents.length !== 0);

    const totalPages = Math.max(1, Math.ceil(documents.length / DOCUMENT_LIST_PAGE_SIZE));
    documentListCurrentPage = Math.min(Math.max(1, documentListCurrentPage), totalPages);
    const start = (documentListCurrentPage - 1) * DOCUMENT_LIST_PAGE_SIZE;
    const pageDocuments = documents.slice(start, start + DOCUMENT_LIST_PAGE_SIZE);

    pageDocuments.forEach((doc) => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div>
                <p class="activity-item-name">${doc.title}</p>
                <p class="activity-item-desc">${doc.courseFormat ? doc.courseFormat.name : 'ทั่วไป'}${doc.description ? ` · ${doc.description}` : ''}</p>
            </div>
            <div class="activity-item-actions">
                <a class="activity-icon-btn" title="เปิด/ดาวน์โหลด" href="${doc.fileUrl}" target="_blank" rel="noopener noreferrer">${DOWNLOAD_ICON}</a>
                <button type="button" class="activity-icon-btn edit" title="แก้ไข">${EDIT_ICON}</button>
                <button type="button" class="activity-icon-btn delete" title="ลบ">${TRASH_ICON}</button>
            </div>
        `;
        item.querySelector('.edit').addEventListener('click', () => openDocumentEditForm(item, doc));
        item.querySelector('.delete').addEventListener('click', () => deleteStudyDocumentEntry(doc));
        list.appendChild(item);
    });

    renderDocumentListPagination(totalPages);
}

function renderDocumentListPagination(totalPages) {
    const bar = document.getElementById('document-list-pagination-bar');
    const prevButton = document.getElementById('document-list-pagination-prev');
    const nextButton = document.getElementById('document-list-pagination-next');
    const pagesContainer = document.getElementById('document-list-pagination-pages');
    if (!bar || !prevButton || !nextButton || !pagesContainer) return;

    bar.classList.toggle('hidden', totalPages <= 1);
    prevButton.disabled = documentListCurrentPage === 1;
    nextButton.disabled = documentListCurrentPage === totalPages;

    pagesContainer.innerHTML = '';
    for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pagination-page';
        button.textContent = String(page);
        button.classList.toggle('active', page === documentListCurrentPage);
        button.setAttribute('aria-current', page === documentListCurrentPage ? 'page' : 'false');
        button.addEventListener('click', () => goToDocumentListPage(page));
        pagesContainer.appendChild(button);
    }
}

function goToDocumentListPage(page) {
    documentListCurrentPage = page;
    renderDocumentList(currentStudyDocuments);
    document.getElementById('document-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDocumentEditForm(itemEl, doc) {
    const courseOptions = ['<option value="">-- ทั่วไป --</option>']
        .concat(courseFormats.map((c) => `<option value="${c.id}" ${doc.courseFormatId === c.id ? 'selected' : ''}>-- ${c.name} --</option>`))
        .join('');

    itemEl.innerHTML = `
        <form class="activity-edit-form" style="width: 100%;">
            <div class="form-group mb-6">
                <label class="form-label">ชื่อเอกสาร *</label>
                <input type="text" class="form-input" id="document-edit-title" value="${doc.title}" required>
            </div>
            <div class="form-group mb-6">
                <label class="form-label">คำอธิบาย (ถ้ามี)</label>
                <input type="text" class="form-input" id="document-edit-description" value="${doc.description || ''}">
            </div>
            <div class="form-group mb-6">
                <label class="form-label">คอร์สเรียน</label>
                <select class="form-input" id="document-edit-course">${courseOptions}</select>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-outline" id="document-edit-cancel">ยกเลิก</button>
                <button type="submit" class="btn-primary">บันทึก</button>
            </div>
        </form>
    `;
    itemEl.querySelector('#document-edit-cancel').addEventListener('click', () => loadStudyDocuments());
    itemEl.querySelector('.activity-edit-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const courseValue = itemEl.querySelector('#document-edit-course').value;
        updateStudyDocumentEntry(doc.id, {
            title: itemEl.querySelector('#document-edit-title').value.trim(),
            description: itemEl.querySelector('#document-edit-description').value.trim(),
            courseFormatId: courseValue ? Number(courseValue) : null,
        });
    });
}

function updateStudyDocumentEntry(id, payload) {
    fetch(`/api/study-documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            showActivitiesToast('บันทึกเอกสารสำเร็จ', true);
            loadStudyDocuments();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'บันทึกเอกสารไม่สำเร็จ', false);
        });
}

async function deleteStudyDocumentEntry(doc) {
    const confirmed = await showConfirm(`ลบเอกสาร "${doc.title}" ใช่หรือไม่?`, {
        title: 'ยืนยันการลบ',
        confirmText: 'ลบ',
    });
    if (!confirmed) return;

    fetch(`/api/study-documents/${doc.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showActivitiesToast('ลบเอกสารสำเร็จ', true);
            loadStudyDocuments();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('ลบเอกสารไม่สำเร็จ', false);
        });
}

// อัปโหลดได้ทีละไฟล์ พร้อมชื่อ/คำอธิบายที่กรอกเอง (เว้นชื่อว่างไว้ backend จะตั้งชื่อจากชื่อไฟล์ให้อัตโนมัติ)
function uploadOneStudyDocumentFile(file, courseFormatId, title, description) {
    const formData = new FormData();
    formData.append('courseFormatId', courseFormatId);
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('file', file, file.name);

    return fetch('/api/study-documents/upload', { method: 'POST', body: formData })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        });
}

async function uploadStudyDocumentFile(file) {
    if (!file) return;

    // การ์ดนี้ไม่ได้ครอบด้วย <form> เลย required บนตัว select เองไม่มีผล (บังคับได้แค่ตอน submit ฟอร์มจริง) เช็คมือแทนเหมือนฟอร์ม "เพิ่มรายวิชาใหม่"
    const courseFormatSelect = document.getElementById('document-course-select');
    if (!courseFormatSelect.value) {
        showActivitiesToast('กรุณาเลือกคอร์ส', false);
        return;
    }
    // value="both" สื่อว่าใช้ร่วมกันทุกคอร์ส ฝั่ง backend ตีความ courseFormatId ว่างเป็น null (ทุกคอร์ส) อยู่แล้ว จึงแปลงกลับเป็น '' ก่อนส่ง ไม่ต้องแก้ backend เพิ่ม
    const courseFormatId = courseFormatSelect.value === 'both' ? '' : courseFormatSelect.value;
    const titleInput = document.getElementById('document-title-input');
    const descriptionInput = document.getElementById('document-description-input');

    try {
        await uploadOneStudyDocumentFile(file, courseFormatId, titleInput.value.trim(), descriptionInput.value.trim());
        showActivitiesToast('อัปโหลดเอกสารสำเร็จ', true);
        titleInput.value = '';
        descriptionInput.value = '';
        loadStudyDocuments();
    } catch (error) {
        console.error('อัปโหลดเอกสารไม่สำเร็จ:', file.name, error);
        showActivitiesToast(error.message || 'อัปโหลดเอกสารไม่สำเร็จ', false);
    }
}

function handleDocumentFileInputChange(event) {
    const input = event.target;
    uploadStudyDocumentFile(input.files[0]);
    input.value = '';
}

function handleDocumentDragOver(event) {
    event.preventDefault();
    document.getElementById('document-dropzone').classList.add('dragging');
}

function handleDocumentDragLeave(event) {
    event.preventDefault();
    document.getElementById('document-dropzone').classList.remove('dragging');
}

function handleDocumentDrop(event) {
    event.preventDefault();
    document.getElementById('document-dropzone').classList.remove('dragging');
    uploadStudyDocumentFile(event.dataTransfer.files[0]);
}

// ==========================================
// แท็บ: จัดการผู้สอน (เฉพาะ manager)
// ==========================================
let instructorCandidates = [];

function loadInstructorCandidates() {
    return fetch('/api/subjects/instructor-candidates')
        .then((res) => res.json())
        .then((items) => { instructorCandidates = items; })
        .catch((error) => console.error('โหลดรายชื่อผู้สอนไม่สำเร็จ:', error));
}

function saveInstructorAssignment(subjectId, instructorUserIds) {
    fetch(`/api/subjects/${subjectId}/instructors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorUserIds }),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            showActivitiesToast('บันทึกผู้สอนสำเร็จ', true);
            return loadSubjects();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'บันทึกผู้สอนไม่สำเร็จ', false);
            renderSubjectList(); // fetch ล้มเหลว การ์ดที่ปิดปุ่มไว้จะไม่มี loadSubjects() มาแทนที่ให้ ต้อง render ใหม่เองเพื่อคืนปุ่มให้กดได้อีก
        });
}

// ==========================================
// แท็บ: จัดการรายวิชาของตัวเอง (เฉพาะ instructor)
// ==========================================
function renderMySubjectList() {
    const list = document.getElementById('my-subject-list');
    const empty = document.getElementById('my-subject-list-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    empty.classList.toggle('hidden', mySubjects.length !== 0);

    mySubjects.forEach((subject) => {
        // ชื่อคอร์สโชว์ให้ดูอย่างเดียว แก้ไม่ได้จากแท็บนี้ (เป็น field เชิงโครงสร้าง แก้ได้เฉพาะฝั่งหัวหน้าฝ่ายที่แท็บ "จัดการรายวิชา") - null = ทั้งคู่
        const courseName = subject.courseFormatId === null ? 'ปรับพื้นฐาน/เตรียมสอบ' : (courseFormats.find((c) => c.id === subject.courseFormatId)?.name || '');
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div>
                <p class="activity-item-name">${subject.name}</p>
                <p class="activity-item-desc">${courseName ? `${courseName} &nbsp;|&nbsp; ` : ''}${subject.requiresScoring ? `เก็บคะแนน &nbsp;|&nbsp; คะแนนเต็มอธิบาย ${subject.explanationMaxScore} / คะแนนสอบ ${subject.achievementMaxScore}` : 'ไม่เก็บคะแนน'} &nbsp;|&nbsp; ${subject.credits} หน่วยกิต</p>
            </div>
            <div class="activity-item-actions">
                <button type="button" class="activity-icon-btn edit" title="แก้ไข">${EDIT_ICON}</button>
            </div>
        `;
        item.querySelector('.edit').addEventListener('click', () => openMySubjectEditForm(item, subject));
        list.appendChild(item);
    });
}

function openMySubjectEditForm(itemEl, subject) {
    itemEl.innerHTML = `
        <form class="activity-edit-form" style="width: 100%;">
            <div class="form-group mb-6">
                <label class="form-label">ชื่อวิชา *</label>
                <input type="text" class="form-input form-input-readonly" value="${subject.name}" disabled title="แก้ไขได้เฉพาะหัวหน้าฝ่ายวิชาการ">
            </div>
            <div class="form-group mb-6">
                <label class="toggle-switch-label toggle-switch-label--readonly">
                    <input type="checkbox" class="toggle-switch" ${subject.requiresScoring ? 'checked' : ''} disabled title="แก้ไขได้เฉพาะหัวหน้าฝ่ายวิชาการ">
                    ต้องเก็บคะแนน (แสดงในตารางคะแนน และนำไปคิดคะแนนรวม)
                </label>
            </div>
            <div id="my-subject-edit-scoring-fields" class="${subject.requiresScoring ? '' : 'hidden'}">
                <div class="form-grid mb-6">
                    <div class="form-group">
                        <label class="form-label">คะแนนเต็ม (อธิบาย)</label>
                        <input type="number" min="1" step="1" class="form-input" id="my-subject-edit-explanation-max" value="${subject.explanationMaxScore}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">คะแนนเต็ม (คะแนนสอบ)</label>
                        <input type="number" min="1" step="1" class="form-input" id="my-subject-edit-achievement-max" value="${subject.achievementMaxScore}">
                    </div>
                </div>
                <div class="form-group mb-6" style="max-width: 12rem;">
                    <label class="form-label">หน่วยกิต</label>
                    <input type="number" class="form-input form-input-readonly" value="${subject.credits}" disabled title="แก้ไขได้เฉพาะหัวหน้าฝ่ายวิชาการ">
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-outline" id="my-subject-edit-cancel">ยกเลิก</button>
                <button type="submit" class="btn-primary">บันทึก</button>
            </div>
        </form>
    `;
    itemEl.querySelector('#my-subject-edit-cancel').addEventListener('click', () => renderMySubjectList());
    itemEl.querySelector('.activity-edit-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const payload = {
            explanationMaxScore: Number(itemEl.querySelector('#my-subject-edit-explanation-max').value),
            achievementMaxScore: Number(itemEl.querySelector('#my-subject-edit-achievement-max').value),
        };
        fetch(`/api/subjects/${subject.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
                return res.json();
            })
            .then((updated) => {
                const idx = mySubjects.findIndex((s) => s.id === updated.id);
                if (idx !== -1) mySubjects[idx] = updated;
                showActivitiesToast('บันทึกรายวิชาสำเร็จ', true);
                renderMySubjectList();
            })
            .catch((error) => {
                console.error(error);
                showActivitiesToast(error.message || 'บันทึกรายวิชาไม่สำเร็จ', false);
            });
    });
}

// ==========================================
// แท็บ: ระบบสอบอธิบาย (เปิด QR ให้น้องค่ายสแกนเข้าคิว แล้วประเมินผ่าน/ไม่ผ่าน)
// ==========================================
const ORAL_EXAM_STATUS_LABEL = { PENDING: 'รอประเมิน', PASSED: 'ผ่าน', FAILED: 'ไม่ผ่าน' };

let currentOralExamSubjectId = null;
let selectedOralExamCourseId = null;
let currentOralExamSession = null; // { id, subjectId, status, qrPayload, qrImageDataUrl, attempts }
let oralExamPollTimer = null;
let oralExamPollInFlight = false;

// เติมตัวเลือกคอร์ส (เตรียมสอบ/ปรับพื้นฐาน) ไว้กรองรายวิชาด้านล่างให้สั้นลง - ไม่มีตัวเลือก "ทั้งคู่" ให้เลือกเอง เพราะวิชา "ทั้งคู่" (courseFormatId เป็น null) ถูกรวมเข้าไปให้อัตโนมัติทุกคอร์สอยู่แล้ว (ดู renderOralExamSubjectSelect)
function renderOralExamCourseSelect() {
    const select = document.getElementById('oral-exam-course-select');
    if (!select) return;
    const previousValue = select.value;
    select.innerHTML = '<option value="" disabled' + (previousValue ? '' : ' selected') + '>-- เลือกคอร์ส --</option>' +
        courseFormats.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    if (courseFormats.some((c) => String(c.id) === previousValue)) select.value = previousValue;
}

// manager เห็นทุกวิชาที่เก็บคะแนน (เปิด/ประเมินได้ทุกวิชาอยู่แล้วฝั่ง backend) ส่วนผู้สอนเห็นเฉพาะวิชาที่ตัวเองรับผิดชอบ
// กรองเฉพาะวิชาของคอร์สที่เลือกไว้ (selectedOralExamCourseId) รวมวิชา "ทั้งคู่" (courseFormatId: null) ด้วยเสมอ เหมือนแท็บ "จัดการตารางเรียน" (ดู renderScheduleSubjectSelect) - ต้องเลือกคอร์สก่อนถึงจะเห็นตัวเลือกวิชา
function renderOralExamSubjectSelect() {
    const select = document.getElementById('oral-exam-subject-select');
    if (!select) return;
    const pool = (academicTier === 'manager' ? subjects : mySubjects).filter((s) => s.requiresScoring);
    const options = selectedOralExamCourseId
        ? pool.filter((s) => s.courseFormatId === selectedOralExamCourseId || s.courseFormatId === null)
        : [];
    const previousValue = select.value;
    select.disabled = !selectedOralExamCourseId;
    select.innerHTML = (selectedOralExamCourseId ? '<option value="">-- เลือกวิชา --</option>' : '<option value="">-- เลือกคอร์สก่อน --</option>') +
        options.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
    if (options.some((s) => String(s.id) === previousValue)) select.value = previousValue;
}

// เปลี่ยนคอร์ส - วิชาที่เคยเลือกไว้ (ถ้ามี) ไม่ตรงคอร์สใหม่แน่นอน ต้องเริ่มเลือกวิชาใหม่เสมอเหมือนยังไม่ได้เลือกวิชาเลย (รีใช้ handleOralExamSubjectChange เดิมที่ซ่อนการ์ด/เคลียร์ค่าครบอยู่แล้ว)
function handleOralExamCourseChange() {
    const courseSelect = document.getElementById('oral-exam-course-select');
    selectedOralExamCourseId = Number(courseSelect.value) || null;
    try {
        if (selectedOralExamCourseId) sessionStorage.setItem(ORAL_EXAM_COURSE_STORAGE_KEY, String(selectedOralExamCourseId));
        else sessionStorage.removeItem(ORAL_EXAM_COURSE_STORAGE_KEY);
    } catch (error) { /* private mode ปิด storage ไว้ก็ไม่เป็นไร แค่ไม่จำ */ }
    renderOralExamSubjectSelect();
    document.getElementById('oral-exam-subject-select').value = '';
    handleOralExamSubjectChange();
}

// เรียกหลัง renderOralExamCourseSelect()/renderOralExamSubjectSelect() ที่เติมตัวเลือกครบแล้วจริง ๆ เท่านั้น (courseFormats/subjects/mySubjects โหลดเสร็จ) - ถ้าเคยเลือกคอร์ส+วิชาไว้ก่อนรีเฟรช (จำใน sessionStorage) ให้เลือกกลับให้อัตโนมัติแล้วเช็คต่อว่ามีรอบสอบเปิดค้างอยู่ไหม
// กันปัญหา: รีเฟรชหน้าทิ้งไว้ระหว่างเปิดรอบสอบอยู่ (เช่น เผลอกด F5) แล้ว QR ที่โชว์อยู่หายไปทั้งที่รอบสอบยังเปิดจริงฝั่ง server ต้องมาเลือกคอร์ส/วิชาใหม่เองถึงจะเห็นกลับมา
// เรียกซ้ำได้หลายรอบไม่พัง (courseFormats กับ subjects โหลดเสร็จไม่พร้อมกัน) - รอบแรกที่ยังไม่มีตัวเลือกคอร์สให้เลือกจะไม่ทำอะไรแล้วรอเรียกซ้ำรอบถัดไป
function restoreOralExamSubjectSelection() {
    const courseSelect = document.getElementById('oral-exam-course-select');
    const subjectSelect = document.getElementById('oral-exam-subject-select');
    if (!courseSelect || !subjectSelect) return;
    let savedCourseId = null;
    let savedSubjectId = null;
    try {
        savedCourseId = sessionStorage.getItem(ORAL_EXAM_COURSE_STORAGE_KEY);
        savedSubjectId = sessionStorage.getItem(ORAL_EXAM_SUBJECT_STORAGE_KEY);
    } catch (error) { /* private mode ปิด storage ไว้ก็ไม่เป็นไร แค่ไม่จำ */ }
    if (!savedCourseId || !Array.from(courseSelect.options).some((opt) => opt.value === savedCourseId)) return;

    if (selectedOralExamCourseId !== Number(savedCourseId)) {
        courseSelect.value = savedCourseId;
        selectedOralExamCourseId = Number(savedCourseId);
        renderOralExamSubjectSelect();
        updateOralExamOpenButtonState();
    }

    if (!savedSubjectId || subjectSelect.value === savedSubjectId) return;
    if (!Array.from(subjectSelect.options).some((opt) => opt.value === savedSubjectId)) return;
    subjectSelect.value = savedSubjectId;
    handleOralExamSubjectChange();
}

function stopOralExamPolling() {
    if (oralExamPollTimer) {
        clearInterval(oralExamPollTimer);
        oralExamPollTimer = null;
    }
}

// poll เฉพาะตอนแท็บนี้เปิดอยู่จริงและเบราว์เซอร์มองเห็นอยู่ (ไม่ยิงทิ้งไว้เบื้องหลังเปล่า ๆ) ไม่ผูกกับ switchTab ของ nav.js ตรง ๆ เพราะเป็นไฟล์ที่ใช้ร่วมกันทุกหน้า
function startOralExamPolling() {
    stopOralExamPolling();
    oralExamPollTimer = setInterval(() => {
        const isTabActive = document.getElementById('page-examstub')?.classList.contains('active');
        if (!isTabActive || document.visibilityState !== 'visible' || !currentOralExamSubjectId) return;
        pollOralExamActiveSession();
    }, 4000);
}

// เรียกทั้งจาก interval poll ตอนช่วงรับเช็คอิน (OPEN เท่านั้น) และเรียกตรง ๆ อีกทีหลังกดผ่าน/ไม่ผ่านสำเร็จตอนช่วงกำลังประเมิน (CLOSED) เพื่อรีเฟรชสถานะล่าสุดของคิว
// เช็คด้วย session id แทน status ตรง ๆ เพราะรอบเดิมอาจเป็น CLOSED แล้ว (หลังกด "เริ่ม") แต่ยังต้องรีเฟรชคิวต่อได้จนกว่าจะประเมินครบ ไม่ใช่หยุดรีเฟรชทันทีที่ปิดรับเช็คอิน
function pollOralExamActiveSession() {
    if (oralExamPollInFlight || !currentOralExamSubjectId) return Promise.resolve();
    oralExamPollInFlight = true;
    // withQr=0: poll แค่รายชื่อคิว ไม่ต้องส่งรูป QR ซ้ำทุก 4 วิ (QR วาดไว้แล้วตอนเปิดรอบ)
    return fetch(`/api/oral-exam-sessions/active?subjectId=${currentOralExamSubjectId}&withQr=0`)
        .then((res) => (res.ok ? res.json() : null))
        .then((session) => {
            // session หายไปหรือไม่ใช่รอบเดิมที่กำลังแสดงอยู่ (ปิด/หมดอายุจากที่อื่น หรือประเมินครบแล้วจนไม่มี pending เหลือ) ไม่ต้อง auto ซ่อนของที่ค้างแสดงอยู่ ให้พี่ค่ายกดยกเลิกเอง/รีเฟรชหน้าเองถ้าจะเริ่มใหม่
            if (!session || session.id !== currentOralExamSession?.id) return;
            currentOralExamSession = session;
            renderOralExamQueue(session.attempts);
        })
        .catch((error) => console.error('poll รอบสอบอธิบายไม่สำเร็จ:', error))
        .finally(() => { oralExamPollInFlight = false; });
}

// ปุ่ม "เปิดรอบสอบ" กดได้ก็ต่อเมื่อเลือกวิชาแล้ว "และ" กรอกจำนวนผู้เข้าสอบสูงสุดแล้วเท่านั้น (ไม่ให้เปิดแบบไม่จำกัดจำนวนอีกต่อไป)
function updateOralExamOpenButtonState() {
    const btn = document.getElementById('oral-exam-open-btn');
    if (!btn) return;
    const maxParticipantsInput = document.getElementById('oral-exam-max-participants-input');
    const hasSubject = !!currentOralExamSubjectId;
    const hasCount = !!(maxParticipantsInput?.value && Number(maxParticipantsInput.value) > 0);
    btn.disabled = !(hasSubject && hasCount);
}

// จำคอร์ส/วิชาที่เลือกไว้ล่าสุดใน sessionStorage กันรีเฟรชหน้าแล้ว dropdown เด้งกลับไปว่างจนต้องเลือกใหม่เอง ทั้งที่รอบสอบยังเปิดค้างอยู่จริงฝั่ง server (ดู restoreOralExamSubjectSelection)
const ORAL_EXAM_COURSE_STORAGE_KEY = 'oralExamActiveCourseId';
const ORAL_EXAM_SUBJECT_STORAGE_KEY = 'oralExamActiveSubjectId';

// การ์ด "เลือกวิชาและระบุจำนวนผู้เข้าสอบ" ซ่อนไว้ตลอดตอนมีรอบสอบเปิดอยู่ (โชว์ QR แทน) กันเผลอไปกดเปิดรอบใหม่/เปลี่ยนวิชาระหว่างรอบเดิมยังเปิดอยู่ - โชว์กลับมาก็ต่อเมื่อกด "ยกเลิก" ปิดรอบนั้นแล้วเท่านั้น
function setOralExamPickerVisible(visible) {
    document.getElementById('oral-exam-picker-card')?.classList.toggle('hidden', !visible);
}

// 2 ช่วงของรอบสอบ: "รับเช็คอิน" (status OPEN - โชว์ QR + ปุ่มเริ่ม ซ่อนปุ่มประเมิน) กับ "กำลังประเมิน" (status STARTED หลังกดเริ่ม - ไม่รับเช็คอินเพิ่มแล้ว ซ่อน QR/ปุ่มเริ่ม โชว์ปุ่มประเมินแทน)
// รายชื่อผู้เข้าสอบโชว์ตลอดทั้ง 2 ช่วง (ดู renderOralExamQueue) มีแค่ QR/ปุ่มเริ่ม/ปุ่มประเมินเท่านั้นที่สลับกัน
function applyOralExamPhaseUI() {
    const isCheckinPhase = currentOralExamSession?.status === 'OPEN';
    document.getElementById('oral-exam-qr-block')?.classList.toggle('hidden', !isCheckinPhase);
    document.getElementById('oral-exam-start-btn')?.classList.toggle('hidden', !isCheckinPhase);
    document.getElementById('oral-exam-evaluate-actions')?.classList.toggle('hidden', isCheckinPhase);
    updateOralExamStepper();
}

// แถบขั้นตอน 1.เลือกวิชา 2.เปิดรับเช็คอิน 3.ประเมินผล เหนือการ์ด - แค่สะท้อนสถานะปัจจุบัน (session ยังไม่เปิด/CLOSED = ขั้น 1, OPEN = ขั้น 2, STARTED = ขั้น 3)
function updateOralExamStepper() {
    const stepSelect = document.getElementById('oral-exam-step-select');
    const stepCheckin = document.getElementById('oral-exam-step-checkin');
    const stepEvaluate = document.getElementById('oral-exam-step-evaluate');
    if (!stepSelect || !stepCheckin || !stepEvaluate) return;
    const status = currentOralExamSession?.status;
    const isActive = status === 'OPEN' || status === 'STARTED';
    stepSelect.dataset.state = isActive ? 'done' : 'current';
    stepCheckin.dataset.state = status === 'OPEN' ? 'current' : (status === 'STARTED' ? 'done' : 'todo');
    stepEvaluate.dataset.state = status === 'STARTED' ? 'current' : 'todo';
}

// สลับวิชา - เช็คว่ามีรอบที่เปิดค้างอยู่ของวิชานี้ไหม (เช่น รีเฟรชหน้าทิ้งไว้) ถ้ามีให้แสดงต่อจากเดิมแทนที่จะบังคับเปิดใหม่
function handleOralExamSubjectChange() {
    stopOralExamPolling();
    const select = document.getElementById('oral-exam-subject-select');
    const subjectId = Number(select.value) || null;
    currentOralExamSubjectId = subjectId;
    oralExamKnownAttemptIds = null;
    updateOralExamOpenButtonState();
    try {
        if (subjectId) sessionStorage.setItem(ORAL_EXAM_SUBJECT_STORAGE_KEY, String(subjectId));
        else sessionStorage.removeItem(ORAL_EXAM_SUBJECT_STORAGE_KEY);
    } catch (error) { /* private mode ปิด storage ไว้ก็ไม่เป็นไร แค่ไม่จำ */ }
    currentOralExamSession = null;
    setOralExamPickerVisible(true);
    document.getElementById('oral-exam-session-card')?.classList.add('hidden');
    document.getElementById('oral-exam-history-card')?.classList.add('hidden');
    updateOralExamStepper();
    if (!subjectId) return;

    loadOralExamHistory(subjectId);

    fetch(`/api/oral-exam-sessions/active?subjectId=${subjectId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((session) => {
            if (!session || currentOralExamSubjectId !== subjectId) return;
            currentOralExamSession = session;
            renderOralExamSessionCard(session);
            renderOralExamQueue(session.attempts);
            setOralExamPickerVisible(false);
            applyOralExamPhaseUI();
            document.getElementById('oral-exam-session-card')?.classList.remove('hidden');
            if (session.status === 'OPEN') startOralExamPolling();
        })
        .catch((error) => console.error('เช็ครอบสอบที่เปิดอยู่ไม่สำเร็จ:', error));
}

function handleOralExamOpenClick() {
    const subjectId = currentOralExamSubjectId;
    if (!subjectId) {
        showActivitiesToast('กรุณาเลือกวิชาก่อน', false);
        return;
    }

    const maxParticipantsInput = document.getElementById('oral-exam-max-participants-input');
    const maxParticipants = maxParticipantsInput?.value ? Number(maxParticipantsInput.value) : null;
    // ปุ่มถูก disable ไว้อยู่แล้วถ้ายังไม่กรอก (ดู updateOralExamOpenButtonState) เช็คซ้ำอีกชั้นกันเผื่อ event หลุดมาได้ยังไงก็ตาม
    if (!maxParticipants || maxParticipants < 1) {
        showActivitiesToast('กรุณาระบุจำนวนผู้เข้าสอบก่อน', false);
        return;
    }

    const btn = document.getElementById('oral-exam-open-btn');
    Loader.setButtonLoading(btn, 'กำลังเปิด...');
    fetch('/api/oral-exam-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // คอร์สที่เลือกในขั้นที่ 1 = คอร์สเดียวที่เช็คอินรอบนี้ได้ (backend บังคับ ดู checkIn ใน oralExamSessionController.js)
        body: JSON.stringify({ subjectId, courseFormatId: selectedOralExamCourseId, maxParticipants }),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            return res.json();
        })
        .then((session) => {
            currentOralExamSession = { ...session, attempts: [] };
            renderOralExamSessionCard(currentOralExamSession);
            renderOralExamQueue([]);
            setOralExamPickerVisible(false);
            applyOralExamPhaseUI();
            document.getElementById('oral-exam-session-card')?.classList.remove('hidden');
            if (maxParticipantsInput) maxParticipantsInput.value = '';
            startOralExamPolling();
            showActivitiesToast('เปิดรอบสอบสำเร็จ', true);
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'เปิดรอบสอบไม่สำเร็จ', false);
        })
        .finally(() => {
            Loader.clearButtonLoading(btn);
            // clearButtonLoading เปิด disabled=false ให้เสมอ ต้องเช็คเงื่อนไขจริงซ้ำอีกทีหลังจากนั้น (ไม่งั้นกดเปิดสำเร็จแล้วช่องจำนวนถูกเคลียร์ว่างแต่ปุ่มจะกลับมากดได้อยู่)
            updateOralExamOpenButtonState();
        });
}

function renderOralExamSessionCard(session) {
    const img = document.getElementById('oral-exam-qr-image');
    const fsImg = document.getElementById('oral-exam-qr-fullscreen-image');
    const linkInput = document.getElementById('oral-exam-link-input');
    if (img) img.src = session.qrImageDataUrl;
    if (fsImg) fsImg.src = session.qrImageDataUrl;
    if (linkInput) linkInput.value = session.qrPayload;

    const subjectEl = document.getElementById('oral-exam-session-subject');
    const courseEl = document.getElementById('oral-exam-session-course');
    if (subjectEl) subjectEl.textContent = session.subjectName || '-';
    // backend ส่งชื่อคอร์สจริงมาเสมอ (รอบเก่าที่ไม่ได้ผูกคอร์ส = คอร์สของวิชา หรือทุกคอร์สถ้าเป็นวิชา "ทั้งคู่" ดู resolveSessionCourseName)
    if (courseEl) courseEl.textContent = session.courseFormatName || '-';
}

// กดที่ QR เพื่อขยายเต็มจอ (เผื่อฉายจอโปรเจกเตอร์ให้น้องค่ายที่นั่งไกลสแกนได้ถนัดขึ้น) - แพทเทิร์นเดียวกับ openScheduleFullscreen/closeScheduleFullscreen
function openOralExamQrFullscreen() {
    document.getElementById('oral-exam-qr-fullscreen-modal')?.classList.remove('hidden');
}

function closeOralExamQrFullscreen() {
    document.getElementById('oral-exam-qr-fullscreen-modal')?.classList.add('hidden');
}

// จำ id ของแถวที่เคยเห็นแล้วในรอบปัจจุบัน (null = ยังไม่เคยแสดงเลย เพิ่งเปลี่ยนวิชา/เปิดรอบใหม่ ดู handleOralExamSubjectChange/handleOralExamOpenClick) - ใช้เช็คว่าแถวไหนเพิ่งเข้ามาใหม่ (คนเพิ่งสแกนเข้าคิว) เพื่อให้เด้งเข้ามาอัตโนมัติทั้งตอน poll พื้นหลังและตอนกดปุ่มรีเฟรชเอง
// เป็น null ตอนแสดงครั้งแรกของรอบนี้เสมอ กันไม่ให้แถวเดิมที่มีอยู่แล้วเด้งไปด้วยทั้งที่ไม่ใช่คนเพิ่งเข้ามาใหม่จริง ๆ
let oralExamKnownAttemptIds = null;

function renderOralExamQueue(allAttempts) {
    // ประเมินผ่าน/ไม่ผ่านแล้ว = ออกจากรอบสอบนี้ไปเลย ไม่โชว์ค้างในคิว (ผลยังบันทึกอยู่ในคะแนน/ประวัติการสอบตามปกติ) เหลือแค่คนที่ยังรอประเมิน
    const attempts = (allAttempts || []).filter((a) => a.status === 'PENDING');
    if (currentOralExamSession) currentOralExamSession.attempts = attempts;
    const list = document.getElementById('oral-exam-queue-list');
    const empty = document.getElementById('oral-exam-queue-empty');
    if (!list || !empty) return;

    const newAttemptIds = oralExamKnownAttemptIds === null
        ? new Set()
        : new Set(attempts.filter((a) => !oralExamKnownAttemptIds.has(a.id)).map((a) => a.id));
    oralExamKnownAttemptIds = new Set(attempts.map((a) => a.id));

    // แสดง "(x/y คน)" ต่อท้ายหัวข้อถ้าตั้งจำกัดจำนวนไว้ (maxParticipants) - นับจาก attempt ทั้งหมดในรอบนี้ตรงกับที่ backend ใช้เช็ค (ดู checkIn ใน oralExamSessionController.js)
    const countEl = document.getElementById('oral-exam-queue-count');
    if (countEl) {
        const maxParticipants = currentOralExamSession?.maxParticipants;
        if (maxParticipants) {
            countEl.textContent = `(${attempts.length}/${maxParticipants} คน)`;
            countEl.classList.toggle('oral-exam-queue-count--full', attempts.length >= maxParticipants);
        } else {
            countEl.textContent = '';
            countEl.classList.remove('oral-exam-queue-count--full');
        }
    }

    empty.textContent = currentOralExamSession?.status === 'STARTED' ? 'ประเมินครบทุกคนแล้ว' : 'ยังไม่มีใครสแกนเข้าคิว';
    empty.classList.toggle('hidden', attempts.length > 0);
    list.innerHTML = attempts.map((a) => `
        <div class="oral-exam-queue-row oral-exam-queue-row--${a.status.toLowerCase()}${newAttemptIds.has(a.id) ? ' oral-exam-queue-row--pop-in' : ''}">
            <span class="oral-exam-queue-code">${a.code}</span>
            <span class="oral-exam-queue-name">${a.fullName}${a.nickname ? ` (${a.nickname})` : ''}</span>
            <span class="oral-exam-queue-attempt">ครั้งที่ ${a.attemptNumber}</span>
            <span class="oral-exam-queue-status">${ORAL_EXAM_STATUS_LABEL[a.status] || a.status}</span>
            ${a.status === 'PENDING'
                ? `<button type="button" class="oral-exam-queue-remove-btn" title="นำออกจากคิวสอบ" aria-label="นำ ${a.fullName} ออกจากคิวสอบ" onclick="handleOralExamRemoveAttemptClick(${a.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>`
                : '<span class="oral-exam-queue-remove-spacer" aria-hidden="true"></span>'}
        </div>
    `).join('');
}

// กากบาทท้ายแถว - พี่ค่ายนำน้องค่ายออกจากคิว (เช็คอินผิดวิชา/ไม่มาสอบ) น้องค่ายออกจากคิวเองไม่ได้แล้ว
// ลบได้เฉพาะคนที่ยังรอประเมิน คนที่ประเมินแล้วเป็นประวัติคะแนน (backend กันไว้อีกชั้น ดู removeAttempt)
async function handleOralExamRemoveAttemptClick(attemptId) {
    const session = currentOralExamSession;
    const attempt = session?.attempts?.find((a) => a.id === attemptId);
    if (!attempt) return;

    const confirmed = await showConfirm(`นำ "${attempt.fullName}" ออกจากคิวสอบใช่หรือไม่? ถ้ารอบยังเปิดรับอยู่ น้องค่ายสแกน QR เข้าคิวใหม่ได้`, {
        title: 'ยืนยันการนำออกจากคิว',
        confirmText: 'นำออก',
    });
    if (!confirmed) return;

    fetch(`/api/oral-exam-sessions/${session.id}/attempts/${attemptId}`, { method: 'DELETE' })
        .then(async (res) => {
            if (!res.ok && res.status !== 204) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            if (currentOralExamSession?.id === session.id) {
                renderOralExamQueue(currentOralExamSession.attempts.filter((a) => a.id !== attemptId));
            }
            showActivitiesToast('นำออกจากคิวสอบแล้ว', true);
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'นำออกจากคิวสอบไม่สำเร็จ', false);
        });
}

// ปุ่ม "ผ่าน"/"ไม่ผ่าน" ประเมินทุกคนที่ยังรอผล (PENDING) ในคิวพร้อมกันเสมอ ไม่มีการเลือกเป็นรายคนอีกต่อไป (ผ่านทั้งคิวหรือไม่ผ่านทั้งคิว)
function handleOralExamEvaluateClick(result) {
    if (!currentOralExamSession) return;
    const attemptIds = (currentOralExamSession.attempts || []).filter((a) => a.status === 'PENDING').map((a) => a.id);
    if (attemptIds.length === 0) {
        showActivitiesToast('ยังไม่มีคนรอประเมินผลอยู่ในคิว', false);
        return;
    }

    fetch(`/api/oral-exam-sessions/${currentOralExamSession.id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptIds, result }),
    })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            return res.json();
        })
        .then((evalResult) => {
            // ประเมินแบบหมู่ทีเดียวทุกคนในคิว = จบรอบนี้เลย ปิดรอบแล้วกลับไปหน้าเลือกวิชาให้อัตโนมัติ
            finishOralExamSession(`บันทึกผล${result === 'PASSED' ? 'ผ่าน' : 'ไม่ผ่าน'} ${evalResult.evaluated.length} คน และปิดรอบสอบแล้ว`);
            // อัปเดตสถานะคิวจากผลลัพธ์ที่ได้ตรง ๆ แทนการ fetch "active session" ใหม่ - endpoint นั้นจะคืน null ถ้าประเมินครบไม่มี pending เหลือแล้ว (ตั้งใจออกแบบไว้กันโชว์รอบที่จบแล้วตอนรีเฟรชหน้า)
            // ถ้าเพิ่งประเมิน "คนสุดท้าย" พอดี จะเจอ null กลับมาแทนข้อมูลจริง ทำให้คิวค้างโชว์ "รอประเมิน" ผิด ๆ ถ้าไปพึ่ง endpoint นั้นแทน
            const evaluatedMap = new Map(evalResult.evaluated.map((e) => [e.attemptId, e]));
            currentOralExamSession.attempts = (currentOralExamSession.attempts || []).map((a) => (
                evaluatedMap.has(a.id) ? { ...a, status: evaluatedMap.get(a.id).status } : a
            ));
            renderOralExamQueue(currentOralExamSession.attempts);
            // คะแนนอธิบายอาจเปลี่ยนจากการประเมินนี้ - รีเฟรชตารางคะแนนให้เห็นสด ถ้ากำลังเปิดคอร์สเดียวกับวิชานี้อยู่
            if (selectedScoreCourseId) loadScoreRoster();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast(error.message || 'บันทึกผลไม่สำเร็จ', false);
        });
}

// กด "เริ่ม" = ปิดรับเช็คอินเพิ่ม (OPEN -> STARTED endpoint แยกจากปุ่ม "ยกเลิกรอบสอบ") แต่ไม่ซ่อนการ์ด - สลับไปโหมด "กำลังประเมิน" ต่อในการ์ดเดิมแทน (ซ่อน QR โชว์ปุ่มผ่าน/ไม่ผ่าน)
function handleOralExamStartClick() {
    if (!currentOralExamSession) return;
    const btn = document.getElementById('oral-exam-start-btn');
    Loader.setButtonLoading(btn, 'กำลังเริ่ม...');
    fetch(`/api/oral-exam-sessions/${currentOralExamSession.id}/start`, { method: 'POST' })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            stopOralExamPolling();
            currentOralExamSession.status = 'STARTED';
            applyOralExamPhaseUI();
            showActivitiesToast('เริ่มประเมินได้แล้ว (ปิดรับเช็คอินเพิ่มแล้ว)', true);
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('เริ่มไม่สำเร็จ', false);
        })
        .finally(() => Loader.clearButtonLoading(btn));
}

async function handleOralExamCloseClick() {
    if (!currentOralExamSession) return;
    // อยู่ในช่วงกำลังประเมินแล้ว (กด "เริ่ม" ไปแล้ว status เป็น STARTED) แต่ยังมีคนค้างรอผลอยู่ ห้ามยกเลิกรอบทิ้งไปก่อน ต้องกดผ่าน/ไม่ผ่านให้ครบทุกคนก่อน กันข้อมูลค้างประเมินหายไปจากสายตา
    const hasPending = (currentOralExamSession.attempts || []).some((a) => a.status === 'PENDING');
    if (currentOralExamSession.status === 'STARTED' && hasPending) {
        showActivitiesToast('กรุณาประเมินผู้เข้าสอบที่เหลือให้ครบก่อนยกเลิกรอบสอบ', false);
        return;
    }
    const confirmed = await showConfirm(
        'ยกเลิกรอบสอบนี้ใช่หรือไม่? คนที่สแกนเข้าคิวไว้แล้วจะถูกนำออกจากคิว',
        { title: 'ยืนยันการยกเลิกรอบสอบ', confirmText: 'ยกเลิกรอบสอบ' }
    );
    if (!confirmed) return;

    finishOralExamSession('ยกเลิกรอบสอบสำเร็จ');
}

// ปิดรอบสอบแล้วกลับไปหน้าเลือกวิชา (ขั้นที่ 1) ใช้ทั้งตอนกด "ยกเลิกรอบสอบ" และหลังกดผ่าน/ไม่ผ่าน (ประเมินแบบหมู่ครั้งเดียวจบรอบ)
function finishOralExamSession(successMessage) {
    const session = currentOralExamSession;
    if (!session) return Promise.resolve();
    return fetch(`/api/oral-exam-sessions/${session.id}/close`, { method: 'POST' })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            stopOralExamPolling();
            session.status = 'CLOSED';
            setOralExamPickerVisible(true);
            document.getElementById('oral-exam-session-card')?.classList.add('hidden');
            updateOralExamStepper();
            if (currentOralExamSubjectId) loadOralExamHistory(currentOralExamSubjectId);
            showActivitiesToast(successMessage, true);
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('ปิดรอบสอบไม่สำเร็จ กด "ยกเลิกรอบสอบ" อีกครั้ง', false);
        });
}

// กดรีเฟรชรายชื่อผู้เข้าสอบด้วยตัวเอง แทนที่จะรอ interval poll ทุก 4 วิ (ดู startOralExamPolling) - ใช้ pollOralExamActiveSession ตัวเดียวกันเลย ไม่ต้องเขียน fetch ซ้ำ
function handleOralExamRefreshClick() {
    const btn = document.getElementById('oral-exam-refresh-btn');
    if (!btn || btn.classList.contains('is-spinning')) return;
    btn.classList.add('is-spinning');
    pollOralExamActiveSession().finally(() => btn.classList.remove('is-spinning'));
}

function handleOralExamCopyLinkClick() {
    const input = document.getElementById('oral-exam-link-input');
    if (!input) return;
    input.select();
    (navigator.clipboard?.writeText(input.value) || Promise.reject())
        .then(() => showActivitiesToast('คัดลอกลิงก์แล้ว', true))
        .catch(() => showActivitiesToast('คัดลอกลิงก์ไม่สำเร็จ ลองคัดลอกเองจากช่องข้อความ', false));
}

// ประวัติรอบสอบที่ปิดไปแล้วของวิชาที่เลือก (แยกจากรอบที่กำลังเปิดอยู่ใน currentOralExamSession) ลบทิ้งได้ทีละรอบ (ดู deleteSession ฝั่ง backend)
let oralExamHistorySubjectId = null;

function loadOralExamHistory(subjectId) {
    oralExamHistorySubjectId = subjectId;
    fetch(`/api/oral-exam-sessions/history?subjectId=${subjectId}`)
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(({ history }) => {
            if (oralExamHistorySubjectId !== subjectId) return; // สลับวิชาไปแล้วระหว่างรอผลลัพธ์ ไม่ต้องเรนเดอร์ของวิชาเก่าทับ
            renderOralExamHistory(subjectId, history);
        })
        .catch((error) => console.error('โหลดประวัติการเปิดสอบไม่สำเร็จ:', error));
}

function renderOralExamHistory(subjectId, history) {
    const card = document.getElementById('oral-exam-history-card');
    const list = document.getElementById('oral-exam-history-list');
    const empty = document.getElementById('oral-exam-history-empty');
    if (!card || !list || !empty) return;

    card.classList.remove('hidden');
    empty.classList.toggle('hidden', history.length > 0);
    list.innerHTML = history.map((session) => {
        const openedDate = new Date(session.openedAt).toLocaleString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        const closedDate = session.closedAt ? new Date(session.closedAt).toLocaleString('th-TH', {
            hour: '2-digit', minute: '2-digit',
        }) : '';
        const attemptsHtml = session.attempts.length > 0 ? `
            <div class="oral-exam-queue-list">
                ${session.attempts.map((a) => `
                <div class="oral-exam-queue-row oral-exam-queue-row--${a.status.toLowerCase()}">
                    <span class="oral-exam-queue-code">${a.code}</span>
                    <span class="oral-exam-queue-name">${a.fullName}${a.nickname ? ` (${a.nickname})` : ''}</span>
                    <span class="oral-exam-queue-attempt">ครั้งที่ ${a.attemptNumber}</span>
                    <span class="oral-exam-queue-status">${ORAL_EXAM_STATUS_LABEL[a.status] || a.status}</span>
                </div>`).join('')}
            </div>` : '<p class="oral-exam-history-empty-note">ไม่มีใครสแกนเข้าคิวในรอบนี้</p>';

        return `
        <div class="oral-exam-history-item" data-session-id="${session.id}">
            <div class="oral-exam-history-item-header">
                <span class="oral-exam-history-item-date">เปิด ${openedDate}${closedDate ? ` - ปิด ${closedDate}` : ''}</span>
                <span class="oral-exam-history-item-count">${session.attempts.length} คน</span>
                <button type="button" class="activity-icon-btn delete oral-exam-history-delete-btn" data-session-id="${session.id}" title="ลบประวัติรอบนี้">${TRASH_ICON}</button>
            </div>
            ${attemptsHtml}
        </div>`;
    }).join('');

    list.querySelectorAll('.oral-exam-history-delete-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleOralExamHistoryDeleteClick(subjectId, Number(btn.dataset.sessionId)));
    });
}

async function handleOralExamHistoryDeleteClick(subjectId, sessionId) {
    const confirmed = await showConfirm(
        'ลบประวัติรอบสอบนี้ทั้งหมด? รายชื่อผู้เข้าสอบในรอบนี้จะหายไป และเลขครั้งที่สอบครั้งหลัง ๆ ของแต่ละคนในรอบนี้จะเลื่อนลง 1 (คะแนนที่บันทึกไปแล้วจะไม่เปลี่ยนแปลง)',
        { title: 'ยืนยันการลบประวัติ', confirmText: 'ลบประวัติ' }
    );
    if (!confirmed) return;

    fetch(`/api/oral-exam-sessions/${sessionId}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            loadOralExamHistory(subjectId);
            showActivitiesToast('ลบประวัติรอบสอบแล้ว', true);
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('ลบประวัติรอบสอบไม่สำเร็จ', false);
        });
}

// ==========================================
// เริ่มต้นหน้า
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    document.getElementById('subject-create-form')?.addEventListener('submit', handleSubjectCreateSubmit);
    document.getElementById('subject-list-pagination-prev')?.addEventListener('click', () => goToSubjectListPage(subjectListCurrentPage - 1));
    document.getElementById('subject-list-pagination-next')?.addEventListener('click', () => goToSubjectListPage(subjectListCurrentPage + 1));
    document.getElementById('document-list-pagination-prev')?.addEventListener('click', () => goToDocumentListPage(documentListCurrentPage - 1));
    document.getElementById('document-list-pagination-next')?.addEventListener('click', () => goToDocumentListPage(documentListCurrentPage + 1));
    document.getElementById('subject-requires-scoring-input')?.addEventListener('change', (event) => {
        handleSubjectRequiresScoringToggle(event.target, document.getElementById('subject-scoring-fields'));
    });
    document.getElementById('score-weight-form')?.addEventListener('submit', handleScoreWeightFormSubmit);
    document.getElementById('grade-band-form')?.addEventListener('submit', handleGradeBandFormSubmit);
    document.getElementById('grade-band-add-btn')?.addEventListener('click', handleGradeBandAddClick);
    document.getElementById('oral-exam-band-form')?.addEventListener('submit', handleOralExamBandFormSubmit);
    document.getElementById('oral-exam-band-add-btn')?.addEventListener('click', handleOralExamBandAddClick);
    document.getElementById('oral-exam-course-select')?.addEventListener('change', handleOralExamCourseChange);
    document.getElementById('oral-exam-subject-select')?.addEventListener('change', handleOralExamSubjectChange);
    document.getElementById('oral-exam-max-participants-input')?.addEventListener('input', updateOralExamOpenButtonState);
    document.getElementById('oral-exam-open-btn')?.addEventListener('click', handleOralExamOpenClick);
    document.getElementById('oral-exam-close-btn')?.addEventListener('click', handleOralExamCloseClick);
    document.getElementById('oral-exam-start-btn')?.addEventListener('click', handleOralExamStartClick);
    document.getElementById('oral-exam-copy-link-btn')?.addEventListener('click', handleOralExamCopyLinkClick);
    document.getElementById('oral-exam-refresh-btn')?.addEventListener('click', handleOralExamRefreshClick);
    document.getElementById('oral-exam-qr-expand-btn')?.addEventListener('click', openOralExamQrFullscreen);
    document.getElementById('oral-exam-pass-btn')?.addEventListener('click', () => handleOralExamEvaluateClick('PASSED'));
    document.getElementById('oral-exam-fail-btn')?.addEventListener('click', () => handleOralExamEvaluateClick('FAILED'));
    document.getElementById('score-table-print-btn')?.addEventListener('click', async () => {
        if (currentRoster.length === 0 || currentRosterSubjects.length === 0) {
            showActivitiesToast('ไม่มีข้อมูลให้พิมพ์ในคอร์สนี้', false);
            return;
        }
        // ดึงครั้งที่จัดค่ายสดใหม่ทุกครั้งที่กดพิมพ์ (ไม่ใช้ currentGenerationNo ที่โหลดไว้ตอนเปิดหน้าเฉยๆ) กันปัญหาถ้าเปิดหน้าเว็บค้างไว้นาน ค่าที่โหลดตอนแรกอาจเก่ากว่าข้อมูลจริงในระบบ ณ ตอนพิมพ์
        // ส่วนชื่อประธานค่าย/หัวหน้าฝ่ายฯ ไม่ดึงจากระบบมาใส่อัตโนมัติแล้ว (เว้นว่างเป็นจุดไข่ปลาให้เขียนเองเสมอ)
        await loadCurrentGeneration();
        const courseName = courseFormats.find((c) => c.id === selectedScoreCourseId)?.name || '';
        document.getElementById('score-report-print').innerHTML = buildScoreReportHtml(currentRosterSubjects, currentRoster, courseName, currentGenerationNo, currentTotalCredits);
        window.print();
    });
    document.getElementById('score-table-export-excel-btn')?.addEventListener('click', exportScoreTableToExcel);
    document.getElementById('score-table-search-input')?.addEventListener('input', (event) => filterScoreTableRows(event.target.value));
    document.getElementById('schedule-create-form')?.addEventListener('submit', handleScheduleCreateSubmit);
    scheduleDateSelects = setupDateSelects({ containerId: 'schedule-date-selects', hiddenId: 'schedule-date-input' });
    scheduleStartSelects = setupTimeSelects({ containerId: 'schedule-start-selects', hiddenId: 'schedule-start-input' });
    scheduleEndSelects = setupTimeSelects({ containerId: 'schedule-end-selects', hiddenId: 'schedule-end-input' });
    document.getElementById('schedule-subject-select')?.addEventListener('change', updateScheduleInstructorOptions);
    document.getElementById('schedule-instructor-add-btn')?.addEventListener('click', handleScheduleInstructorAddClick);
    document.getElementById('schedule-fullscreen-btn')?.addEventListener('click', openScheduleFullscreen);
    document.getElementById('schedule-print-btn')?.addEventListener('click', async () => {
        if (currentScheduleEntries.length === 0) {
            showActivitiesToast('ไม่มีข้อมูลให้พิมพ์ในคอร์สนี้', false);
            return;
        }
        // พิมพ์ตารางเรียนที่เห็นบนจอตรง ๆ (ไม่ได้แปลงเป็นรายงานแบบตารางคะแนน) - ติดคลาสไว้ที่ body ให้ CSS @media print
        // (ดู body.printing-schedule ใน staff-academic.css) ซ่อนส่วนอื่นของหน้าเหลือแค่ #schedule-grid-wrap แล้วลบคลาสออกหลังพิมพ์เสร็จ

        // หัวกระดาษ (โลโก้/ชื่อตาราง/คอร์ส) เติมข้อความสดทุกครั้งที่กดพิมพ์ เหมือนรายงานคะแนน
        await loadCurrentGeneration();
        const courseName = courseFormats.find((c) => c.id === selectedScheduleCourseId)?.name || '';
        document.getElementById('schedule-print-title').textContent = `ตารางเรียนค่ายวิชาการพี่ติวน้อง ครั้งที่ ${currentGenerationNo}`;
        document.getElementById('schedule-print-subtitle').textContent = `คอร์ส${courseName}`;

        // ตารางกว้าง/สูงกว่าพื้นที่กระดาษ (ruler ล้นได้ถึงหลักพันพิกเซล ยิ่งมีหลายวันยิ่งสูง) ถ้าไม่ทำอะไรเลยจะโดนตัดขอบขวาหาย หรือแถวท้าย ๆ ล้นไปหน้าถัดไปทิ้งช่องว่างเปล่าไว้หน้าแรก
        // เลยต้องคำนวณตัวคูณย่อทั้งก้อน (zoom) สด ๆ จากขนาดจริงทั้งกว้าง-สูง เอาด้านที่ตึงกว่า (เลขน้อยกว่า) ให้พอดีหน้ากระดาษเดียวเสมอ โดยไม่แตะโครงสร้าง/สัดส่วนภายในตารางเลย (แค่เล็กลงทั้งก้อนเท่า ๆ กัน)
        const PRINT_TARGET_WIDTH_PX = 1046; // ความกว้างใช้พิมพ์จริงของ A4 แนวนอน หักขอบ 1cm สองข้างตาม @page ที่ตั้งไว้ (~96dpi)
        const PRINT_PAGE_HEIGHT_PX = 718; // ความสูงใช้พิมพ์จริงของ A4 แนวนอน หักขอบ 1cm บน-ล่าง (~96dpi)
        // ความสูงหัวกระดาษ (โลโก้ 60px + ขอบ/ชื่อเรื่อง 2 บรรทัด) ใช้ค่าประมาณคงที่แทนการวัดจริง เพราะ .print-report-logo{width:60px}
        // เป็นกฎที่อยู่ใน @media print เท่านั้น วัดตอนนี้ (นอก print context) โลโก้จะยังไม่ถูกบังคับขนาด ได้ความสูงธรรมชาติของรูปที่ใหญ่เกินจริงมาก
        const PRINT_HEADER_HEIGHT_PX = 160;
        const PRINT_SAFETY_MARGIN_PX = 30; // เผื่อความคลาดเคลื่อนของเครื่องพิมพ์/เบราว์เซอร์แต่ละเครื่อง กันขอบพอดีเป๊ะจนล้นไปแค่เส้นเดียว

        const PRINT_TARGET_HEIGHT_PX = PRINT_PAGE_HEIGHT_PX - PRINT_HEADER_HEIGHT_PX - PRINT_SAFETY_MARGIN_PX;
        const ruler = document.querySelector('#schedule-grid-wrap .timetable-ruler');
        const dateCol = document.querySelector('#schedule-grid-wrap .timetable-grid-date-col');
        const gridWrap = document.getElementById('schedule-grid-wrap');
        const naturalWidth = ruler ? ruler.scrollWidth + (dateCol?.offsetWidth || 0) : PRINT_TARGET_WIDTH_PX;
        const naturalHeight = gridWrap.scrollHeight || PRINT_TARGET_HEIGHT_PX;
        const zoom = Math.min(1, PRINT_TARGET_WIDTH_PX / naturalWidth, PRINT_TARGET_HEIGHT_PX / naturalHeight);
        document.documentElement.style.setProperty('--schedule-print-zoom', zoom);

        document.body.classList.add('printing-schedule');
        window.print();
    });
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('printing-schedule');
    });
    initScheduleActivityCombobox();

    // เช็คสถานะค่ายก่อนทุกอย่าง: ยังไม่มีค่ายที่กำลังดำเนินการ = ระบบวิชาการล็อก (API ทุกเส้นตอบ 409 อยู่แล้ว) โชว์แผงอธิบายแทนแล้วจบ ไม่โหลดข้อมูลอื่นให้เจอ error รัว ๆ
    // ต้องรู้ tier ก่อนถึงจะ render ตารางคะแนน/ตารางเรียนได้ถูกต้อง (ช่องไหนแก้ได้ ปุ่มไหนเห็น) จึงรอ auth.me + subjects/mine ก่อนโหลดส่วนอื่น
    window.PTN_AUTH_ME.then(({ user, camp }) => {
        window.PTN_CAMP_STATE = camp || null;
        if (!isCampActive(camp)) {
            renderCampLockedPage(document.querySelector('main.main-content'), { systemName: 'ระบบวิชาการ', audience: 'staff', camp });
            return;
        }
        return Promise.all([
            fetch('/api/subjects/mine').then((res) => (res.ok ? res.json() : [])).catch(() => []),
            loadGradeBands(),
            loadOralExamScoreBands(),
            loadScoreWeightSetting(),
            loadCurrentGeneration(),
        ]).then(([mine]) => {
            mySubjects = mine;
            mySubjectIds = mine.map((s) => s.id);
            academicTier = computeAcademicTier(user, mine);
            applyAcademicTier();
            renderOralExamSubjectSelect();

            const subjectsLoaded = loadSubjects();
            if (academicTier === 'manager') {
                loadStudyDocuments();
                Promise.all([subjectsLoaded, loadInstructorCandidates()]).then(() => renderSubjectList());
            }
            // หัวหน้าฝ่าย (manager) ที่ตัวเองก็ได้รับมอบหมายเป็นผู้สอนวิชาใดวิชาหนึ่งด้วย ให้ใช้แท็บ "จัดการรายวิชาของตัวเอง" ได้เหมือนผู้สอนทั่วไป (ดู applyAcademicTier ที่เปิดแท็บนี้ให้เห็นในเงื่อนไขเดียวกัน)
            if (academicTier === 'instructor' || (academicTier === 'manager' && mySubjectIds.length > 0)) {
                renderMySubjectList();
            }
            loadCourseFormats().then(() => {
                loadScoreRoster();
                loadSchedule();
                renderSubjectList();
                renderScheduleSubjectSelect();
                renderMySubjectList();
            });
        });
    }).finally(() => Loader.hideFullPageLoader());
});
