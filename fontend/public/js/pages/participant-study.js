// เตือนเฉพาะตอนยังไม่ได้เลือกคอร์ส (ข้อความนี้ชี้ทางแก้ให้ - ไปตั้งคอร์สที่โปรไฟล์) ส่วนตอนเลือกคอร์สแล้วไม่ต้องมีข้อความบอกซ้ำว่ากรองตามคอร์สไหนอยู่ เพราะรายการเอกสารที่กรองมาให้แล้วบอกในตัวอยู่แล้ว
function applyDocCourseFilter(courseName) {
    const hint = document.getElementById('doc-course-hint');
    if (hint) {
        hint.textContent = courseName
            ? ''
            : 'ยังไม่ได้เลือกคอร์สเรียน ไปที่โปรไฟล์เพื่อเลือกคอร์สและดูเอกสารของคอร์สตัวเอง';
    }
}

const DOC_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
</svg>`;

// ลูกศรชี้ลงเข้าถาด - ไอคอนปุ่ม "ดาวน์โหลด" ท้ายการ์ดเอกสาร (สไตล์เดียวกับปุ่ม export CSV ที่อื่นในเว็บ)
const DOC_DOWNLOAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v13m0 0l-4.5-4.5M12 16l4.5-4.5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>`;

// ==========================================
// แท็บ: เอกสาร
// ==========================================
// การ์ดเป็น div เฉย ๆ (ไม่ใช่ <a> ครอบทั้งใบเหมือนเดิม) เพราะปุ่มดาวน์โหลดข้างในต้องเป็น <a> ของตัวเองแยกต่างหาก - ซ้อน <a> ใน <a> ไม่ได้ตามสเปก HTML
function buildDocCard(doc) {
    const card = document.createElement('div');
    card.className = 'doc-card';
    card.innerHTML = `
        <a class="doc-card-download-btn" href="${doc.fileUrl}" target="_blank" rel="noopener noreferrer" title="ดาวน์โหลด" aria-label="ดาวน์โหลด">${DOC_DOWNLOAD_ICON}</a>
        <div class="doc-card-icon">${DOC_ICON}</div>
        <h3 class="doc-card-title">${doc.title}</h3>
        ${doc.description ? `<p class="doc-card-desc">${doc.description}</p>` : ''}
    `;
    return card;
}

function loadMyDocuments() {
    const generalGroup = document.getElementById('doc-group-general');
    const generalGrid = document.getElementById('doc-grid-general');
    const courseGroup = document.getElementById('doc-group-course');
    const courseGrid = document.getElementById('doc-grid-course');
    const empty = document.getElementById('doc-grid-empty');
    if (!generalGrid || !courseGrid || !empty) return;

    Loader.renderSkeletonCards(generalGrid, 3);
    return fetch('/api/study-documents/me')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((documents) => {
            generalGrid.innerHTML = '';
            courseGrid.innerHTML = '';
            empty.classList.toggle('hidden', documents.length !== 0);

            // แยก "เอกสารทั่วไป" (courseFormat เป็น null ใช้ร่วมกันทุกคอร์ส เช่นกำหนดการค่าย) ออกจาก "เอกสารประกอบการเรียน" (ผูกกับคอร์สของตัวเอง) ให้เห็นชัดว่าอันไหนคือเอกสารเรียนจริง ๆ
            const generalDocs = documents.filter((doc) => !doc.courseFormat);
            const courseDocs = documents.filter((doc) => doc.courseFormat);

            generalGroup.classList.toggle('hidden', generalDocs.length === 0);
            courseGroup.classList.toggle('hidden', courseDocs.length === 0);

            // ต่อชื่อคอร์สของตัวเองท้ายหัวข้อกลุ่ม ให้รู้ชัดว่า "เอกสารประกอบการเรียน" นี้คือของคอร์สไหน (เอกสารกลุ่มนี้ผูกกับคอร์สเดียวกับตัวเองเสมออยู่แล้ว จาก backend ที่กรองด้วย courseFormatId ของตัวเอง)
            const courseGroupTitle = document.querySelector('#doc-group-course .doc-group-title');
            if (courseGroupTitle) {
                const courseName = courseDocs[0]?.courseFormat?.name;
                courseGroupTitle.textContent = courseName ? `เอกสารประกอบการเรียน (${courseName})` : 'เอกสารประกอบการเรียน';
            }

            generalDocs.forEach((doc) => generalGrid.appendChild(buildDocCard(doc)));
            courseDocs.forEach((doc) => courseGrid.appendChild(buildDocCard(doc)));
        })
        .catch((error) => console.error('โหลดเอกสารไม่สำเร็จ:', error));
}

// ==========================================
// แท็บ: คะแนน
// ==========================================
const ORAL_EXAM_STATUS_LABEL_ME = { PENDING: 'รอประเมิน', PASSED: 'ผ่าน', FAILED: 'ไม่ผ่าน' };

function loadMyScores() {
    const totalEl = document.getElementById('my-score-total');
    const gradeEl = document.getElementById('my-score-grade');
    const list = document.getElementById('subject-score-breakdown-list');
    const empty = document.getElementById('subject-score-breakdown-empty');
    if (!totalEl || !list || !empty) return;

    Loader.renderSkeletonCards(list, 3);
    // ดึงคะแนนกับประวัติสอบอธิบายพร้อมกัน กันปัญหาถ้าโหลดแยกกันแล้วอันไหนเสร็จก่อน-หลังไม่แน่นอน (ตารางคะแนนต้อง render ครั้งเดียวพร้อมประวัติเสมอ)
    return Promise.all([
        fetch('/api/subject-scores/me').then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        }),
        fetch('/api/oral-exam-sessions/me/history').then((res) => (res.ok ? res.json() : { history: [] })).catch(() => ({ history: [] })),
    ])
        .then(([{ subjectScores, summary }, { history }]) => {
            totalEl.textContent = summary.grandTotal;
            if (gradeEl) {
                gradeEl.textContent = summary.grade;
                gradeEl.className = 'grade-badge';
                // สีเลือกเองได้อิสระผ่านวงล้อสี (เก็บเป็น hex ตรง ๆ) จึงต้อง render ด้วย inline style แทน CSS class ตายตัว - พื้นหลังจาง ๆ (alpha ~10%) + ตัวหนังสือสีเข้มเต็ม
                const color = /^#[0-9a-fA-F]{6}$/.test(summary.gradeColorKey) ? summary.gradeColorKey : '#64748b';
                gradeEl.style.cssText = `background-color:${color}1a;color:${color}`;
            }

            const examHistoryBySubjectId = new Map(history.map((h) => [h.subjectId, h]));

            list.innerHTML = '';
            empty.classList.toggle('hidden', subjectScores.length !== 0);

            subjectScores.forEach((s) => {
                const row = document.createElement('div');
                row.className = 'subject-score-breakdown-row';

                const exam = examHistoryBySubjectId.get(s.subjectId);
                const examHistoryHtml = exam && exam.attempts.length ? `
                    <div class="subject-score-exam-history">
                        <span class="subject-score-exam-history-label">สอบอธิบายแล้ว ${exam.attempts.length} ครั้ง</span>
                        <div class="subject-score-exam-history-attempts">
                            ${exam.attempts.map((a) => `
                                <span class="subject-score-exam-attempt-badge subject-score-exam-attempt-badge--${a.status.toLowerCase()}">
                                    ครั้งที่ ${a.attemptNumber}: ${ORAL_EXAM_STATUS_LABEL_ME[a.status] || a.status}${a.status === 'PASSED' ? ` (${a.awardedScore} คะแนน)` : ''}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : '';

                row.innerHTML = `
                    <div class="subject-score-breakdown-header-row">
                        <span class="subject-score-breakdown-name">${s.subjectName}</span>
                        <div class="subject-score-breakdown-scores">
                            <div class="subject-score-breakdown-item subject-score-breakdown-item--explanation">
                                <span class="subject-score-breakdown-item-label">คะแนนอธิบาย</span>
                                <span class="subject-score-breakdown-item-value">${s.explanationScore ?? 0}<span class="subject-score-breakdown-item-max">/${s.explanationMaxScore}</span></span>
                            </div>
                            <div class="subject-score-breakdown-item subject-score-breakdown-item--achievement">
                                <span class="subject-score-breakdown-item-label">คะแนนสอบ</span>
                                <span class="subject-score-breakdown-item-value">${s.achievementScore ?? 0}<span class="subject-score-breakdown-item-max">/${s.achievementMaxScore}</span></span>
                            </div>
                        </div>
                    </div>
                    ${examHistoryHtml}
                `;
                list.appendChild(row);
            });
        })
        .catch((error) => console.error('โหลดคะแนนไม่สำเร็จ:', error));
}

// ==========================================
// ตารางเรียนแบบกริด (แกนตั้ง = วันที่จริง, แกนนอน = ช่วงเวลารายชั่วโมง) - ยกมาจาก staff-academic.js ทั้งชุดให้เหมือนกันเป๊ะ ๆ
// (เดิมเป็นเวอร์ชันย่อของตัวเอง หน้าตา/ขนาดไม่ตรงกับฝั่งพี่ค่ายเป๊ะ) ต่างกันแค่ options.editable ไม่มีให้ตั้งเป็น true เลย ปุ่มลบเลยไม่โผล่มาเองโดยธรรมชาติ ไม่ต้องตัดโค้ดส่วนนั้นออก
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
// options: { editable: boolean, onDelete: (entry) => void } - หน้านี้ไม่เคยส่ง editable:true เลย (น้องค่ายดูอย่างเดียว) ปุ่มลบเลยไม่โผล่มาเองโดยธรรมชาติจากโค้ดชุดเดียวกับฝั่งพี่ค่าย
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

    // options.editable ไม่เคยเป็น true บนหน้านี้เลย (น้องค่ายดูอย่างเดียว) if นี้จึงไม่เคยทำงานจริง เก็บไว้เผื่ออนาคตแค่ให้โค้ดตรงกับต้นฉบับฝั่งพี่ค่ายทุกตัวอักษร
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
// แท็บ: ตารางเรียน
// ==========================================
// toast ลอยแจ้งผล - หน้านี้ไม่เคยมี toast มาก่อนเลย (ไม่เคยต้องแจ้งเตือน error ของฟอร์มใด ๆ) แพทเทิร์นเดียวกับ showNewsToast ใน staff-news.js
let timetableToastTimer = null;
function showTimetableToast(message, isSuccess) {
    const toast = document.getElementById('timetable-toast');
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

    clearTimeout(timetableToastTimer);
    timetableToastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// เก็บชุดล่าสุดไว้ระดับโมดูล ให้ popup เต็มจอ + ปุ่มพิมพ์ดึงไปใช้ซ้ำได้โดยไม่ต้อง fetch ใหม่ (แพทเทิร์นเดียวกับ currentScheduleEntries ฝั่งพี่ค่าย)
let currentTimetableEntries = [];
// ชื่อคอร์สของตัวเอง (สำหรับ subtitle ตอนพิมพ์) - ตั้งค่าตอนโหลด /api/auth/me ใน DOMContentLoaded ด้านล่าง
let myCourseFormatName = '';
// ครั้งที่จัดค่าย (สำหรับหัวกระดาษตอนพิมพ์) - ดู loadCurrentGeneration
let currentGenerationNo = null;
function loadCurrentGeneration() {
    return fetch('/api/lookups/current-generation')
        .then((res) => res.json())
        .then((data) => { currentGenerationNo = data.generationNo; })
        .catch((error) => console.error('โหลดครั้งที่จัดค่ายไม่สำเร็จ:', error));
}

function loadMyTimetable() {
    const wrap = document.getElementById('timetable-grid-wrap');
    const empty = document.getElementById('timetable-empty');
    if (!wrap || !empty) return;

    Loader.renderSkeletonCards(wrap, 3);
    return fetch('/api/class-schedules/me')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((entries) => {
            currentTimetableEntries = entries;
            empty.classList.toggle('hidden', entries.length !== 0);
            renderTimetableGrid(wrap, entries);
            renderTimetableFullscreenIfOpen();
        })
        .catch((error) => console.error('โหลดตารางเรียนไม่สำเร็จ:', error));
}

// ปุ่ม "Fullscreen" เปิด popup แสดงตารางเรียนเดียวกันเต็มจอ - ใช้ renderTimetableGrid ซ้ำ ไม่ต้องเขียนใหม่ ข้อมูลชุดเดียวกับตารางปกติเสมอ (แพทเทิร์นเดียวกับฝั่งพี่ค่าย)
function renderTimetableFullscreenIfOpen() {
    const modal = document.getElementById('timetable-fullscreen-modal');
    const fsWrap = document.getElementById('timetable-fullscreen-grid-wrap');
    if (!modal || !fsWrap || modal.classList.contains('hidden')) return;
    renderTimetableGrid(fsWrap, currentTimetableEntries);
}

function openTimetableFullscreen() {
    const modal = document.getElementById('timetable-fullscreen-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderTimetableFullscreenIfOpen();
}

function closeTimetableFullscreen() {
    document.getElementById('timetable-fullscreen-modal')?.classList.add('hidden');
}

// ==========================================
// แท็บ: ระบบสอบอธิบาย (เปิดกล้องสแกน QR เข้าคิวสอบ) - เช็คอินเป็นธุรกรรมจริงเฉพาะน้องค่ายเท่านั้น
// backend บล็อก WebManager ไว้แล้วที่ requireParticipantAccess บน /api/oral-exam-sessions/check-in (ดู routes/oralExamSessionRoutes.js) กันสวมรอยเช็คอินแทนคนอื่นจริง ๆ - ฝั่งนี้ซ่อนแท็บทิ้งไปเลยกันสับสน (ดู DOMContentLoaded ท้ายไฟล์)
// ==========================================
let examScanStream = null;
let examScanRAF = null;

// ครอบ switchTab เดิม (ใช้ร่วมกับทุกหน้า) เพิ่มแค่ปิดกล้องทุกครั้งที่สลับออกจากแท็บนี้ กันกล้องค้างทำงานอยู่เบื้องหลังโดยไม่มีอะไรแสดงผล
function handleStudyTabSwitch(tabId) {
    switchTab(tabId);
    if (tabId !== 'examscan') stopExamScanCamera();
}

function showExamScanState(state) {
    ['idle', 'camera', 'loading', 'success', 'error'].forEach((s) => {
        document.getElementById(`exam-scan-${s}`)?.classList.toggle('hidden', s !== state);
    });
}

function stopExamScanCamera() {
    if (examScanRAF) cancelAnimationFrame(examScanRAF);
    examScanRAF = null;
    if (examScanStream) {
        examScanStream.getTracks().forEach((track) => track.stop());
        examScanStream = null;
    }
    const video = document.getElementById('exam-scan-video');
    if (video) video.srcObject = null;
}

function startExamScanCamera() {
    const errorBox = document.getElementById('exam-scan-camera-error');
    errorBox.classList.add('hidden');

    // Safari (iOS/macOS) ถอด navigator.mediaDevices ออกไปเลยถ้าไม่ได้อยู่ใน secure context (https:// หรือ localhost เท่านั้น) - เช็คแยกจากเคส "ไม่รองรับ" เพื่อบอกสาเหตุที่แท้จริงตรง ๆ กันงงว่าทำไมมือถือคนอื่นเปิดได้แต่ Safari เปิดไม่ได้
    if (!window.isSecureContext) {
        errorBox.textContent = 'เปิดกล้องไม่ได้เพราะเว็บนี้ไม่ได้เข้าผ่าน https:// (Safari บังคับต้องเข้าเว็บแบบปลอดภัยถึงจะขอใช้กล้องได้) กรุณาใช้กล้องของมือถือสแกน QR แทน แล้วเปิดลิงก์ที่ได้ตามปกติ';
        errorBox.classList.remove('hidden');
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        errorBox.textContent = 'เบราว์เซอร์นี้เปิดกล้องสแกนในหน้าเว็บไม่ได้ กรุณาใช้กล้องของมือถือสแกน QR แทน แล้วเปิดลิงก์ที่ได้ตามปกติ';
        errorBox.classList.remove('hidden');
        return;
    }

    // ideal (ไม่ใช่ exact) กันพลาดกรณี Safari บางเครื่อง/macOS ไม่มีกล้องหลัง (environment) แล้วโยน OverconstrainedError ทั้งที่มีกล้องให้ใช้อยู่จริง
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
        .then((stream) => {
            examScanStream = stream;
            const video = document.getElementById('exam-scan-video');
            video.srcObject = stream;
            // Safari คืน promise จาก play() แล้วอาจ reject ได้ (เช่นโดนขัดจังหวะ) ต้องดักไว้กัน unhandled rejection แต่ไม่ต้องแจ้งเตือนซ้ำ (สตรีมเปิดสำเร็จแล้ว แค่เล่นวิดีโอสะดุด)
            video.play().catch((error) => console.error('เล่นวิดีโอกล้องไม่สำเร็จ:', error));
            showExamScanState('camera');
            examScanRAF = requestAnimationFrame(tickExamScan);
        })
        .catch((error) => {
            console.error('เปิดกล้องสแกน QR ไม่สำเร็จ:', error);
            if (error.name === 'NotAllowedError') {
                errorBox.textContent = 'กรุณาอนุญาตให้เว็บไซต์ใช้กล้องก่อนถึงจะสแกนได้ (ถ้าเคยกดปฏิเสธไว้ ต้องเข้าไปแก้ในการตั้งค่าเว็บไซต์ของเบราว์เซอร์)';
            } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
                errorBox.textContent = 'ไม่พบกล้องที่ใช้งานได้บนอุปกรณ์นี้';
            } else if (error.name === 'NotReadableError') {
                errorBox.textContent = 'เปิดกล้องไม่ได้ อาจมีแอปอื่นใช้กล้องอยู่ กรุณาปิดแอปอื่นแล้วลองใหม่';
            } else {
                errorBox.textContent = 'เปิดกล้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
            }
            errorBox.classList.remove('hidden');
        });
}

// อ่านเฟรมวิดีโอทีละเฟรมผ่าน canvas มองหา QR ด้วย jsQR (ดู fontend/public/js/vendor/jsQR.js) - เจอปุ๊บหยุดลูปทันที ไม่ต้องสแกนต่อ
function tickExamScan() {
    const video = document.getElementById('exam-scan-video');
    const canvas = document.getElementById('exam-scan-canvas');
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        examScanRAF = requestAnimationFrame(tickExamScan);
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

    if (code && code.data) {
        handleExamScanDecoded(code.data);
        return;
    }
    examScanRAF = requestAnimationFrame(tickExamScan);
}

// ดึง token จาก URL ที่เข้ารหัสอยู่ใน QR (รูปแบบเดียวกับที่ backend สร้างไว้ - ดู buildCheckinUrl ใน oralExamSessionController.js) แล้วเช็คอินด้วย endpoint เดียวกับหน้า exam-checkin.html ทุกประการ
function handleExamScanDecoded(rawText) {
    stopExamScanCamera();

    let token = null;
    try {
        token = new URL(rawText).searchParams.get('token');
    } catch (error) {
        token = null;
    }

    if (!token) {
        document.getElementById('exam-scan-error-detail').textContent = 'QR นี้ไม่ใช่ QR สำหรับเข้าสอบอธิบาย';
        showExamScanState('error');
        return;
    }

    showExamScanState('loading');
    fetch('/api/oral-exam-sessions/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then((result) => {
            renderExamScanSuccess(result.attemptId, result.subjectName, result.attemptNumber);
        })
        .catch((error) => {
            document.getElementById('exam-scan-error-detail').textContent = error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
            showExamScanState('error');
        });
}

// attempt ที่กำลังรอประเมินอยู่ตอนนี้ (ถ้ามี) - เก็บไว้ให้ปุ่ม "ออกจากการสอบ" รู้ว่าต้องลบ attempt ไหน
// มาจากได้ 2 ทาง: 1) เพิ่งเช็คอินสำเร็จ (ดู handleQrCode) 2) รีเฟรชหน้าแล้วเจอ PENDING ค้างอยู่จาก /me/history (ดู restorePendingExamCheckin)
let currentPendingAttemptId = null;

// แสดงการ์ด "เข้าร่วมแล้ว" ใช้ร่วมกันทั้งตอนเพิ่งเช็คอินสำเร็จสด ๆ และตอนรีเฟรชหน้าแล้วเจอว่ามี PENDING ค้างอยู่ (กันโค้ดสร้าง HTML ซ้ำสองที่)
function renderExamScanSuccess(attemptId, subjectName, attemptNumber) {
    currentPendingAttemptId = attemptId;
    // ชื่อวิชาสีน้ำเงิน + ป้ายครั้งที่สอบสีส้มไฮไลต์ อยู่ติดกันแนบชิด (ตัดประโยคยาว "นี่คือการเข้าสอบ...ของคุณ" ออก ป้ายสั้น ๆ สื่อความเดียวกันชัดกว่า)
    document.getElementById('exam-scan-success-detail').innerHTML =
        `<span class="exam-scan-success-subject">วิชา${subjectName}</span><span class="exam-scan-success-attempt">ครั้งที่ ${attemptNumber}</span>`;
    showExamScanState('success');
    startExamScanWaitPolling();
}

// เปิดหน้านี้ซ้ำ/รีเฟรชแล้วยังมีรายการรอประเมินอยู่ (ยังไม่ได้เช็คอินใหม่ในเซสชันนี้เลย) ต้องโชว์การ์ด "เข้าร่วมแล้ว" ทันที ไม่ใช่ย้อนกลับไปหน้าเปิดกล้องเหมือนไม่เคยเช็คอินมาก่อน
// เรียกครั้งเดียวตอนโหลดหน้า (ดู DOMContentLoaded) - ถ้าไม่มี PENDING ค้างอยู่เลยก็ไม่ทำอะไร ปล่อยเป็นสถานะเริ่มต้น (idle) ตามปกติ
function restorePendingExamCheckin() {
    return fetch('/api/oral-exam-sessions/me/history')
        .then((res) => (res.ok ? res.json() : { history: [] }))
        .then(({ history }) => {
            for (const subjectEntry of history) {
                const pending = subjectEntry.attempts.find((a) => a.status === 'PENDING');
                if (pending) {
                    renderExamScanSuccess(pending.id, subjectEntry.subjectName, pending.attemptNumber);
                    return;
                }
            }
        })
        .catch(() => {});
}

function resetExamScan() {
    currentPendingAttemptId = null;
    stopExamScanWaitPolling();
    showExamScanState('idle');
}

// กด "ออกจากการสอบ" บนการ์ด "เข้าร่วมแล้ว" - ยกเลิกแถวที่รอประเมินอยู่ (เช่นเช็คอินผิดวิชา/เปลี่ยนใจ) เช็คอินรอบใหม่ได้ทันทีถ้ารอบเดิมยังเปิดอยู่
async function handleLeaveExam() {
    if (!currentPendingAttemptId) {
        resetExamScan();
        return;
    }

    const confirmed = await showConfirm('ต้องการออกจากคิวสอบวิชานี้ใช่หรือไม่? ต้องสแกน QR ใหม่ถ้าต้องการเข้าสอบอีกครั้ง', {
        title: 'ยืนยันการออกจากการสอบ',
        confirmText: 'ออกจากการสอบ',
    });
    if (!confirmed) return;

    fetch(`/api/oral-exam-sessions/me/attempt/${currentPendingAttemptId}`, { method: 'DELETE' })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            showTimetableToast('ออกจากคิวสอบแล้ว', true);
            resetExamScan();
        })
        .catch((error) => {
            showTimetableToast(error.message || 'ออกจากคิวสอบไม่สำเร็จ', false);
        });
}

// ==========================================
// เช็คสถานะระหว่างรอผลบนการ์ด "เข้าร่วมแล้ว" - เผื่อพี่ค่ายปิด/ยกเลิกรอบหรือประเมินผลไปแล้วระหว่างที่น้องค่ายเปิดหน้านี้ค้างไว้เฉย ๆ
// ==========================================
let examScanWaitPollTimer = null;

function stopExamScanWaitPolling() {
    if (examScanWaitPollTimer) {
        clearInterval(examScanWaitPollTimer);
        examScanWaitPollTimer = null;
    }
}

// poll ทุก 5 วิ เฉพาะตอนแท็บนี้เปิดอยู่จริงและเบราว์เซอร์มองเห็นอยู่ เริ่มเมื่อโชว์การ์ด "เข้าร่วมแล้ว" (ดู renderExamScanSuccess) หยุดเมื่อออกจากสถานะนี้ (resetExamScan)
function startExamScanWaitPolling() {
    stopExamScanWaitPolling();
    examScanWaitPollTimer = setInterval(() => {
        const isTabActive = document.getElementById('page-examscan')?.classList.contains('active');
        if (!isTabActive || document.visibilityState !== 'visible' || !currentPendingAttemptId) return;
        pollExamScanWaitStatus();
    }, 5000);
}

// เช็คว่ารายการที่กำลังรอผลอยู่ (currentPendingAttemptId) ยังรอผลจริงไหม - ถ้ารอบสอบถูกปิด/ยกเลิกไปแล้วทั้งที่ยังไม่ประเมิน หรือประเมินผลออกมาแล้ว (ผ่าน/ไม่ผ่าน) หรือหาแถวนี้ไม่เจอเลย (โดนลบ) ต้องเด้งกลับไปหน้าเริ่มต้นอัตโนมัติ ไม่ปล่อยให้ค้างรอเฉย ๆ ทั้งที่จบไปแล้วจริง
// ไม่แตะต้อง/ลบข้อมูลฝั่ง backend เอง (เผื่อพี่ค่ายปิดรอบแล้วยังตั้งใจประเมินคิวที่ค้างอยู่ต่อ ดู closeSession ฝั่ง backend) แค่ปรับหน้าจอฝั่งน้องค่ายให้ตรงความจริงเท่านั้น
function pollExamScanWaitStatus() {
    const attemptId = currentPendingAttemptId;
    return fetch('/api/oral-exam-sessions/me/history')
        .then((res) => (res.ok ? res.json() : { history: [] }))
        .then(({ history }) => {
            if (attemptId !== currentPendingAttemptId) return; // สลับสถานะไปแล้วระหว่างรอผลลัพธ์ (เช่นกด "ออกจากการสอบ" เอง)
            let found = null;
            for (const subjectEntry of history) {
                found = subjectEntry.attempts.find((a) => a.id === attemptId);
                if (found) break;
            }

            if (!found) {
                showTimetableToast('ไม่พบรายการที่รอผลอยู่แล้ว', false);
                resetExamScan();
                loadExamScanHistory();
                return;
            }
            if (found.status === 'PASSED' || found.status === 'FAILED') {
                showTimetableToast(`ผลสอบออกแล้ว: ${found.status === 'PASSED' ? 'ผ่าน' : 'ไม่ผ่าน'} ดูรายละเอียดได้ที่ประวัติการสอบด้านล่าง`, found.status === 'PASSED');
                resetExamScan();
                loadExamScanHistory();
                return;
            }
            if (found.sessionStatus === 'CLOSED') {
                showTimetableToast('รอบสอบที่คุณเข้าคิวถูกปิดแล้ว กรุณารอรอบถัดไป', false);
                resetExamScan();
            }
        })
        .catch(() => {});
}

// ==========================================
// ประวัติการสอบอธิบาย - เก็บเฉพาะแถวที่ประเมินผลแล้ว (ผ่าน/ไม่ผ่าน) เท่านั้น รายการที่ยังรอประเมิน (PENDING) ดูที่การ์ด "เข้าร่วมแล้ว" แทน ไม่ปนกัน
// ==========================================
function loadExamScanHistory() {
    return fetch('/api/oral-exam-sessions/me/history')
        .then((res) => (res.ok ? res.json() : { history: [] }))
        .then(({ history }) => renderExamScanHistory(history))
        .catch((error) => console.error('โหลดประวัติการสอบไม่สำเร็จ:', error));
}

function renderExamScanHistory(history) {
    const list = document.getElementById('exam-history-list');
    const empty = document.getElementById('exam-history-empty');
    if (!list || !empty) return;

    const rows = [];
    history.forEach((subjectEntry) => {
        subjectEntry.attempts
            .filter((a) => a.status === 'PASSED' || a.status === 'FAILED')
            .forEach((a) => rows.push({ ...a, subjectName: subjectEntry.subjectName }));
    });
    rows.sort((a, b) => new Date(b.evaluatedAt) - new Date(a.evaluatedAt));

    empty.classList.toggle('hidden', rows.length > 0);
    list.innerHTML = rows.map((a) => {
        const evaluatedDate = a.evaluatedAt ? new Date(a.evaluatedAt).toLocaleString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }) : '';
        return `
        <div class="exam-history-row">
            <div class="exam-history-row-info">
                <span class="exam-history-subject">วิชา${a.subjectName}</span>
                <span class="exam-history-meta">ครั้งที่ ${a.attemptNumber}${evaluatedDate ? ` · ${evaluatedDate}` : ''}</span>
            </div>
            <span class="exam-history-status exam-history-status--${a.status.toLowerCase()}">${a.status === 'PASSED' ? 'ผ่าน' : 'ไม่ผ่าน'}</span>
        </div>`;
    }).join('');
}

// สลับแอป/ซ่อนแท็บเบราว์เซอร์ระหว่างเปิดกล้องอยู่ - ปิดกล้องทันที (ประหยัดแบต/เป็นส่วนตัว) ผู้ใช้กดเปิดใหม่เองได้เมื่อกลับมา
document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopExamScanCamera();
});

document.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    // ยังไม่มีค่ายที่กำลังดำเนินการ (หรือค่ายจบแล้ว) = ระบบการเรียนล็อกทั้งหน้า (API ทุกเส้นตอบ 409 อยู่แล้ว) โชว์แผงอธิบายแทน ไม่โหลดส่วนอื่น
    const campGate = window.PTN_AUTH_ME
        .then(({ user, camp }) => {
            if (!user) return true;
            window.PTN_CAMP_STATE = camp || null;
            if (!isCampActive(camp)) {
                renderCampLockedPage(document.querySelector('main.main-content'), { systemName: 'ระบบการเรียน', audience: 'participant', camp });
                return false;
            }
            if (user.role === 'WEBMANAGER') {
                document.getElementById('nav-examscan')?.classList.add('hidden');
                document.getElementById('m-nav-examscan')?.classList.add('hidden');
                document.getElementById('footer-nav-examscan')?.classList.add('hidden');
            } else {
                applyDocCourseFilter(user.courseFormat && user.courseFormat.name);
                myCourseFormatName = user.courseFormat ? user.courseFormat.name : '';
                // ชื่อคอร์สโชว์ซ้ำ ๆ ไว้เหนือหัวข้อของทุกแท็บในหน้าการเรียน กันสับสนว่าเห็นของคอร์สไหนอยู่ - ใช้คลาส .score-rank-course ร่วมกัน (นิยามใน activity.css)
                // สีป้ายต่างกันตามคอร์ส: "ปรับพื้นฐาน" เขียว, คอร์สอื่น (เช่น "เตรียมสอบ") ฟ้าเป็นค่าเริ่มต้น
                const courseColorClass = myCourseFormatName.includes('ปรับพื้นฐาน') ? 'score-rank-course--basic' : 'score-rank-course--exam';
                ['my-score-course', 'doc-course-label', 'timetable-course-label', 'examscan-course-label'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.textContent = myCourseFormatName;
                    el.classList.remove('score-rank-course--basic', 'score-rank-course--exam');
                    if (myCourseFormatName) el.classList.add(courseColorClass);
                });
            }
            return true;
        });

    document.getElementById('timetable-fullscreen-btn')?.addEventListener('click', openTimetableFullscreen);
    document.getElementById('timetable-print-btn')?.addEventListener('click', async () => {
        if (currentTimetableEntries.length === 0) {
            showTimetableToast('ไม่มีข้อมูลตารางเรียนให้พิมพ์', false);
            return;
        }
        // พิมพ์ตารางเรียนที่เห็นบนจอตรง ๆ เหมือนฝั่งพี่ค่าย (ดู schedule-print-btn ใน staff-academic.js) - ติดคลาสไว้ที่ body ให้ CSS @media print
        // (ใช้กฎ .printing-schedule ชุดเดียวกับหน้าพี่ค่าย แค่ปรับ selector ID เป็น #page-timetable/#timetable-grid-wrap - ดู participant-study.css)
        await loadCurrentGeneration();
        document.getElementById('timetable-print-title').textContent = `ตารางเรียนค่ายวิชาการพี่ติวน้อง ครั้งที่ ${currentGenerationNo}`;
        document.getElementById('timetable-print-subtitle').textContent = `คอร์ส${myCourseFormatName}`;

        // ย่อทั้งตารางให้พอดีหน้ากระดาษเดียวเสมอ (คำนวณสด ๆ จากขนาดจริง) - ตรรกะ/ค่าคงที่เดียวกับฝั่งพี่ค่ายเป๊ะ (ดูคอมเมนต์อธิบายละเอียดที่ schedule-print-btn ใน staff-academic.js)
        const PRINT_TARGET_WIDTH_PX = 1046;
        const PRINT_PAGE_HEIGHT_PX = 718;
        const PRINT_HEADER_HEIGHT_PX = 160;
        const PRINT_SAFETY_MARGIN_PX = 30;
        const PRINT_TARGET_HEIGHT_PX = PRINT_PAGE_HEIGHT_PX - PRINT_HEADER_HEIGHT_PX - PRINT_SAFETY_MARGIN_PX;
        const ruler = document.querySelector('#timetable-grid-wrap .timetable-ruler');
        const dateCol = document.querySelector('#timetable-grid-wrap .timetable-grid-date-col');
        const gridWrap = document.getElementById('timetable-grid-wrap');
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

    campGate
        .then((active) => (active ? Promise.allSettled([loadMyScores(), loadMyTimetable(), loadMyDocuments(), restorePendingExamCheckin(), loadExamScanHistory()]) : null))
        .finally(() => Loader.hideFullPageLoader());
});
