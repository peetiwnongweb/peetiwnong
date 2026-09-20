// ==========================================
// งานกิจกรรมและสันทนาการ: สร้างกิจกรรม / บันทึกคะแนน / จัดการกลุ่ม
// ==========================================

let activitiesToastTimer = null;
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

    clearTimeout(activitiesToastTimer);
    activitiesToastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
</svg>`;
const EDIT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
</svg>`;
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
</svg>`;

// ==========================================
// แท็บ: สร้างกิจกรรม
// ==========================================
let campActivities = [];

function loadCampActivities() {
    Loader.renderSkeletonCards(document.getElementById('activity-list'), 3);
    return fetch('/api/camp-activities')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            campActivities = items;
            renderActivityList();
            renderScoreActivitySelect();
        })
        .catch((error) => {
            console.error('โหลดรายการกิจกรรมไม่สำเร็จ:', error);
            showActivitiesToast('โหลดรายการกิจกรรมไม่สำเร็จ', false);
        });
}

// แบ่งหน้ารายการ "สร้างกิจกรรมและสันทนาการ" - รูปแบบเดียวกับ .pagination-bar ของลิสต์ข่าวสาธารณะหน้าแรก (ดู public/js/pages/news.js)
const ACTIVITY_LIST_PAGE_SIZE = 5;
let activityListCurrentPage = 1;

function renderActivityList() {
    const list = document.getElementById('activity-list');
    const empty = document.getElementById('activity-list-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    empty.classList.toggle('hidden', campActivities.length !== 0);

    const totalPages = Math.max(1, Math.ceil(campActivities.length / ACTIVITY_LIST_PAGE_SIZE));
    activityListCurrentPage = Math.min(Math.max(1, activityListCurrentPage), totalPages);
    const start = (activityListCurrentPage - 1) * ACTIVITY_LIST_PAGE_SIZE;
    const pageActivities = campActivities.slice(start, start + ACTIVITY_LIST_PAGE_SIZE);

    pageActivities.forEach((activity) => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div>
                <p class="activity-item-name">${activity.name}</p>
                ${activity.description ? `<p class="activity-item-desc">${activity.description}</p>` : ''}
            </div>
            <div class="activity-item-actions">
                <button type="button" class="activity-icon-btn edit" title="แก้ไข">${EDIT_ICON}</button>
                <button type="button" class="activity-icon-btn delete" title="ลบ">${TRASH_ICON}</button>
            </div>
        `;
        item.querySelector('.edit').addEventListener('click', () => openActivityEditForm(item, activity));
        item.querySelector('.delete').addEventListener('click', () => deleteCampActivity(activity));
        list.appendChild(item);
    });

    renderActivityListPagination(totalPages);
}

function renderActivityListPagination(totalPages) {
    const bar = document.getElementById('activity-list-pagination-bar');
    const prevButton = document.getElementById('activity-list-pagination-prev');
    const nextButton = document.getElementById('activity-list-pagination-next');
    const pagesContainer = document.getElementById('activity-list-pagination-pages');
    if (!bar || !prevButton || !nextButton || !pagesContainer) return;

    bar.classList.toggle('hidden', totalPages <= 1);
    prevButton.disabled = activityListCurrentPage === 1;
    nextButton.disabled = activityListCurrentPage === totalPages;

    pagesContainer.innerHTML = '';
    for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pagination-page';
        button.textContent = String(page);
        button.classList.toggle('active', page === activityListCurrentPage);
        button.setAttribute('aria-current', page === activityListCurrentPage ? 'page' : 'false');
        button.addEventListener('click', () => goToActivityListPage(page));
        pagesContainer.appendChild(button);
    }
}

function goToActivityListPage(page) {
    activityListCurrentPage = page;
    renderActivityList();
    document.getElementById('activity-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openActivityEditForm(itemEl, activity) {
    itemEl.innerHTML = `
        <form class="activity-edit-form" style="width: 100%;">
            <div class="form-group mb-6">
                <label class="form-label">ชื่อกิจกรรม *</label>
                <input type="text" class="form-input" id="activity-edit-name" value="${activity.name}" required>
            </div>
            <div class="form-group">
                <label class="form-label">รายละเอียด</label>
                <textarea class="form-input" id="activity-edit-desc" rows="3">${activity.description || ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-outline" id="activity-edit-cancel">ยกเลิก</button>
                <button type="submit" class="btn-primary">บันทึก</button>
            </div>
        </form>
    `;
    itemEl.querySelector('#activity-edit-cancel').addEventListener('click', () => renderActivityList());
    itemEl.querySelector('.activity-edit-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const name = itemEl.querySelector('#activity-edit-name').value.trim();
        const description = itemEl.querySelector('#activity-edit-desc').value.trim();
        updateCampActivity(activity.id, { name, description });
    });
}

function updateCampActivity(id, payload) {
    fetch(`/api/camp-activities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showActivitiesToast('บันทึกกิจกรรมสำเร็จ', true);
            loadCampActivities();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('บันทึกกิจกรรมไม่สำเร็จ', false);
        });
}

async function deleteCampActivity(activity) {
    const confirmed = await showConfirm(`ลบกิจกรรม "${activity.name}" ใช่หรือไม่? คะแนนของกิจกรรมนี้จะถูกลบไปด้วย`, {
        title: 'ยืนยันการลบ',
        confirmText: 'ลบ',
    });
    if (!confirmed) return;

    fetch(`/api/camp-activities/${activity.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showActivitiesToast('ลบกิจกรรมสำเร็จ', true);
            loadCampActivities();
            loadLeaderboard();
            loadScoreHistoryLog();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('ลบกิจกรรมไม่สำเร็จ', false);
        });
}

function handleActivityCreateSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById('activity-name-input');
    const descInput = document.getElementById('activity-desc-input');
    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const btn = event.target.querySelector('button[type="submit"]');

    Loader.setButtonLoading(btn, 'กำลังเพิ่ม...');

    fetch('/api/camp-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            nameInput.value = '';
            descInput.value = '';
            showActivitiesToast('เพิ่มกิจกรรมสำเร็จ', true);
            loadCampActivities();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('เพิ่มกิจกรรมไม่สำเร็จ', false);
        })
        .finally(() => {
            Loader.clearButtonLoading(btn);
        });
}

// ==========================================
// แท็บ: บันทึกคะแนน
// ==========================================
let groupsCache = [];

function renderScoreActivitySelect() {
    const select = document.getElementById('score-activity-select');
    if (!select) return;

    const previousValue = select.value;
    select.innerHTML = '<option value="">-- เลือกกิจกรรม --</option>' +
        campActivities.map((a) => `<option value="${a.id}">${a.name}</option>`).join('');
    if (campActivities.some((a) => String(a.id) === previousValue)) {
        select.value = previousValue;
    }
}

function loadLeaderboard() {
    Loader.renderSkeletonCards(document.getElementById('leaderboard-list'), 3);
    return fetch('/api/camp-activities/scores/summary')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((summary) => {
            const list = document.getElementById('leaderboard-list');
            const empty = document.getElementById('leaderboard-empty');
            if (!list || !empty) return;

            list.innerHTML = '';
            empty.classList.toggle('hidden', summary.length !== 0);

            // แถบคะแนนเทียบสัดส่วนกับอันดับ 1 (ให้เห็นภาพรวมว่าใครนำใครอยู่แค่ไหน) - ใช้ Math.max(...,1) กันหาร 0/0 เป็น NaN ตอนทุกกลุ่มยังไม่มีคะแนนเลย (แสดงเป็นแถบว่างทุกแถวแทน)
            const maxScore = Math.max(...summary.map((row) => row.totalScore), 1);
            // อันดับ 1-3 ให้ธีมสี ทอง/เงิน/ทองแดง เด่นกว่าอันดับอื่น (rank class ตั้งชื่อสั่งจาก 0-index ในลูปตรง ๆ)
            const RANK_CLASSES = ['leaderboard-row--gold', 'leaderboard-row--silver', 'leaderboard-row--bronze'];

            summary.forEach((row, index) => {
                const rowEl = document.createElement('div');
                rowEl.className = `leaderboard-row ${RANK_CLASSES[index] || ''}`;
                const barPct = Math.round((row.totalScore / maxScore) * 100);
                rowEl.innerHTML = `
                    <span class="leaderboard-rank">${index + 1}</span>
                    <div class="leaderboard-info">
                        <span class="leaderboard-name">${row.groupName}</span>
                        <div class="leaderboard-bar-track"><div class="leaderboard-bar-fill" style="width: ${barPct}%"></div></div>
                    </div>
                    <span class="leaderboard-score">${row.totalScore} คะแนน</span>
                `;
                list.appendChild(rowEl);
            });
        })
        .catch((error) => console.error('โหลดอันดับคะแนนไม่สำเร็จ:', error));
}

function handleScoreActivityChange() {
    const select = document.getElementById('score-activity-select');
    const activityId = select.value;
    const list = document.getElementById('score-group-list');
    const empty = document.getElementById('score-group-list-empty');
    if (!list || !empty) return;

    if (!activityId) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    Promise.all([
        fetch(`/api/camp-activities/${activityId}/scores`).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        }),
        groupsCache.length ? Promise.resolve(groupsCache) : fetch('/api/groups').then((res) => res.json()),
    ])
        .then(([scores, groups]) => {
            groupsCache = groups;
            const scoreByGroupId = new Map(scores.map((s) => [s.groupId, s.score]));

            list.innerHTML = '';
            empty.classList.toggle('hidden', groups.length !== 0);

            groups.forEach((group) => {
                const row = document.createElement('div');
                row.className = 'score-group-row';
                row.innerHTML = `
                    <span class="score-group-name">${group.name}</span>
                    <input type="number" min="0" step="1" class="score-group-input" value="${scoreByGroupId.get(group.id) || 0}">
                    <button type="button" class="score-group-save-btn">บันทึก</button>
                `;
                row.querySelector('.score-group-save-btn').addEventListener('click', () => {
                    const input = row.querySelector('.score-group-input');
                    saveGroupScore(activityId, group.id, Number(input.value));
                });
                list.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('โหลดคะแนนของกิจกรรมไม่สำเร็จ:', error);
            showActivitiesToast('โหลดคะแนนของกิจกรรมไม่สำเร็จ', false);
        });
}

function saveGroupScore(activityId, groupId, score) {
    fetch(`/api/camp-activities/${activityId}/scores/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showActivitiesToast('บันทึกคะแนนสำเร็จ', true);
            loadLeaderboard();
            loadScoreHistoryLog();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('บันทึกคะแนนไม่สำเร็จ', false);
        });
}

// ประวัติการบันทึกคะแนนทั้งหมด (ทุกกิจกรรม/ทุกกลุ่ม) เรียงล่าสุดก่อน ลบได้เผื่อบันทึกผิด
function loadScoreHistoryLog() {
    const list = document.getElementById('score-history-log-list');
    const empty = document.getElementById('score-history-log-empty');
    if (!list || !empty) return;

    Loader.renderSkeletonCards(list, 3);
    return fetch('/api/camp-activities/scores/history')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((entries) => {
            list.innerHTML = '';
            empty.classList.toggle('hidden', entries.length !== 0);

            entries.forEach((entry) => {
                const updatedDate = new Date(entry.updatedAt).toLocaleString('th-TH', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                });
                const row = document.createElement('div');
                row.className = 'score-history-log-row';
                row.innerHTML = `
                    <div class="score-history-log-info">
                        <span class="score-history-log-main">${entry.groupName} · ${entry.activityName}</span>
                        <span class="score-history-log-date">บันทึกล่าสุด ${updatedDate}</span>
                    </div>
                    <span class="score-history-log-score">${entry.score} คะแนน</span>
                    <button type="button" class="score-history-log-delete-btn" title="ลบ">${TRASH_ICON}</button>
                `;
                row.querySelector('.score-history-log-delete-btn').addEventListener('click', () => deleteScoreHistoryEntry(entry));
                list.appendChild(row);
            });
        })
        .catch((error) => console.error('โหลดประวัติการบันทึกคะแนนไม่สำเร็จ:', error));
}

async function deleteScoreHistoryEntry(entry) {
    const confirmed = await showConfirm(`ลบคะแนนกลุ่ม "${entry.groupName}" ในกิจกรรม "${entry.activityName}" (${entry.score} คะแนน) ใช่หรือไม่?`, {
        title: 'ยืนยันการลบ',
        confirmText: 'ลบ',
    });
    if (!confirmed) return;

    fetch(`/api/camp-activities/${entry.activityId}/scores/${entry.groupId}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showActivitiesToast('ลบคะแนนสำเร็จ', true);
            loadScoreHistoryLog();
            loadLeaderboard();
            const select = document.getElementById('score-activity-select');
            if (select && select.value === String(entry.activityId)) handleScoreActivityChange();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('ลบคะแนนไม่สำเร็จ', false);
        });
}

// ==========================================
// แท็บ: จัดการกลุ่ม
// ==========================================
let groups = [];
let unassignedParticipants = [];

function loadGroups() {
    Loader.renderSkeletonCards(document.getElementById('group-list'), 3);
    return Promise.all([
        fetch('/api/groups').then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        }),
        fetch('/api/groups/unassigned-participants').then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        }),
    ])
        .then(([groupItems, unassignedItems]) => {
            groups = groupItems;
            groupsCache = groupItems;
            unassignedParticipants = unassignedItems;
            renderGroupList();
        })
        .catch((error) => {
            console.error('โหลดรายชื่อกลุ่มไม่สำเร็จ:', error);
            showActivitiesToast('โหลดรายชื่อกลุ่มไม่สำเร็จ', false);
        });
}

function renderGroupList() {
    const list = document.getElementById('group-list');
    const empty = document.getElementById('group-list-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    empty.classList.toggle('hidden', groups.length !== 0);

    groups.forEach((group) => {
        const card = document.createElement('div');
        card.className = 'group-card';

        const membersHtml = group.members.length
            ? group.members.map((m) => `
                <div class="group-member-row" data-participant-id="${m.id}">
                    <span class="group-member-name">${m.fullName}${m.nickname ? ` (${m.nickname})` : ''}</span>
                    <button type="button" class="group-member-remove-btn" title="ลบออกจากกลุ่ม">${CLOSE_ICON}</button>
                </div>
            `).join('')
            : '<p class="group-member-empty">ยังไม่มีสมาชิกในกลุ่มนี้</p>';

        card.innerHTML = `
            <div class="group-card-header">
                <div class="group-card-title">
                    ${group.name}
                    <span class="group-card-count">${group.members.length} คน</span>
                </div>
                <button type="button" class="group-delete-btn" title="ลบกลุ่ม">${TRASH_ICON}</button>
            </div>
            <div class="group-member-list">${membersHtml}</div>
            <div class="group-add-member-row">
                <div class="member-search-wrap">
                    <input type="text" class="form-input member-search-input" placeholder="พิมพ์ชื่อเพื่อค้นหา...">
                    <div class="member-search-results hidden"></div>
                </div>
                <button type="button" class="group-add-member-btn">เพิ่ม</button>
            </div>
        `;

        card.querySelector('.group-delete-btn').addEventListener('click', () => deleteGroup(group));
        card.querySelectorAll('.group-member-remove-btn').forEach((btn) => {
            const row = btn.closest('.group-member-row');
            const participantId = Number(row.dataset.participantId);
            btn.addEventListener('click', () => removeGroupMember(group, participantId));
        });

        setupMemberSearch(card, group);

        list.appendChild(card);
    });
}

// กล่องค้นหาชื่อ "เพิ่มสมาชิก" ต่อการ์ดกลุ่ม 1 ชุด — พิมพ์กรองรายชื่อน้องค่ายที่ยังไม่มีกลุ่ม แล้วคลิกเลือกจากรายการ
function setupMemberSearch(card, group) {
    const wrap = card.querySelector('.member-search-wrap');
    const input = wrap.querySelector('.member-search-input');
    const results = wrap.querySelector('.member-search-results');
    let selectedParticipantId = null;

    function renderResults(query) {
        const q = query.trim().toLowerCase();
        const matches = unassignedParticipants.filter((p) => {
            const haystack = `${p.fullName} ${p.nickname || ''}`.toLowerCase();
            return haystack.includes(q);
        });

        if (matches.length === 0) {
            results.innerHTML = '<p class="member-search-empty">ไม่พบชื่อที่ค้นหา</p>';
        } else {
            results.innerHTML = matches.map((p) => `
                <button type="button" class="member-search-result-item" data-participant-id="${p.id}">
                    ${p.fullName}${p.nickname ? ` (${p.nickname})` : ''}
                </button>
            `).join('');
            results.querySelectorAll('.member-search-result-item').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const p = unassignedParticipants.find((x) => x.id === Number(btn.dataset.participantId));
                    selectedParticipantId = p.id;
                    input.value = `${p.fullName}${p.nickname ? ` (${p.nickname})` : ''}`;
                    results.classList.add('hidden');
                });
            });
        }
        results.classList.remove('hidden');
    }

    input.addEventListener('focus', () => renderResults(input.value));
    input.addEventListener('input', () => {
        selectedParticipantId = null;
        renderResults(input.value);
    });
    document.addEventListener('click', (event) => {
        if (!wrap.contains(event.target)) results.classList.add('hidden');
    });

    card.querySelector('.group-add-member-btn').addEventListener('click', () => {
        if (!selectedParticipantId) {
            showActivitiesToast('กรุณาเลือกชื่อจากรายการค้นหาก่อน', false);
            return;
        }
        addGroupMember(group, selectedParticipantId);
    });
}

function handleGroupCreateSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('group-name-input');
    const name = input.value.trim();
    const btn = event.target.querySelector('button[type="submit"]');

    Loader.setButtonLoading(btn, 'กำลังเพิ่ม...');

    fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            input.value = '';
            showActivitiesToast('เพิ่มกลุ่มสำเร็จ', true);
            loadGroups();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('เพิ่มกลุ่มไม่สำเร็จ', false);
        })
        .finally(() => {
            Loader.clearButtonLoading(btn);
        });
}

async function deleteGroup(group) {
    const confirmed = await showConfirm(`ลบกลุ่ม "${group.name}" ใช่หรือไม่? สมาชิกในกลุ่มจะไม่ถูกลบ แค่จะไม่มีกลุ่มเท่านั้น`, {
        title: 'ยืนยันการลบ',
        confirmText: 'ลบ',
    });
    if (!confirmed) return;

    fetch(`/api/groups/${group.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showActivitiesToast('ลบกลุ่มสำเร็จ', true);
            loadGroups();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('ลบกลุ่มไม่สำเร็จ', false);
        });
}

function addGroupMember(group, participantId) {
    fetch(`/api/groups/${group.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showActivitiesToast('เพิ่มสมาชิกสำเร็จ', true);
            loadGroups();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('เพิ่มสมาชิกไม่สำเร็จ', false);
        });
}

async function removeGroupMember(group, participantId) {
    const confirmed = await showConfirm('นำสมาชิกคนนี้ออกจากกลุ่มใช่หรือไม่?', { confirmText: 'นำออก' });
    if (!confirmed) return;

    fetch(`/api/groups/${group.id}/members/${participantId}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showActivitiesToast('นำสมาชิกออกจากกลุ่มสำเร็จ', true);
            loadGroups();
        })
        .catch((error) => {
            console.error(error);
            showActivitiesToast('นำสมาชิกออกจากกลุ่มไม่สำเร็จ', false);
        });
}

// ==========================================
// สิทธิ์ 2 ระดับของฝ่ายกิจกรรมฯ: หัวหน้าฝ่าย/ผู้บริหารค่าย (จัดการกลุ่มได้เพิ่ม, tier "manager") กับทีมงานค่ายปกติ (สร้าง/แก้ไข/ลบกิจกรรม + บันทึกคะแนนได้ แต่จัดการกลุ่มไม่ได้, tier "instructor")
// แท็บ "สร้างกิจกรรม"/"บันทึกคะแนน" เปิดให้ทั้ง 2 tier (ไม่มี data-tier) เหลือเฉพาะแท็บ "จัดการกลุ่ม" ที่ยังจำกัด manager เท่านั้น ต้องให้ผลตรงกับฝั่ง backend เป๊ะ ๆ (ดู campActivityRoutes.js: create/update/delete กิจกรรมเปิดให้ staff ทั่วไป, requireGroupManagementAccess เหลือคุมเฉพาะ /api/groups)
// ==========================================
const CAMP_LEADERSHIP_POSITIONS = ['ประธานค่าย', 'รองประธานค่าย', 'เลขานุการ'];
let activitiesTier = 'instructor';

function computeActivitiesTier(user) {
    // Owner ไม่มีตำแหน่ง/ฝ่ายจริงให้อิงสิทธิ์ตามปกติ แต่ได้สิทธิ์ manager เสมอ (ตรงกับ isAcademicManager() ฝั่ง backend)
    if (user && user.role === 'WEBMANAGER') return 'manager';
    const isLeadership = !!(user && user.position && CAMP_LEADERSHIP_POSITIONS.includes(user.position.name));
    const isActivityHead = !!(user && user.position?.name === 'หัวหน้าฝ่าย' && user.department?.name === 'ฝ่ายกิจกรรมและสันทนาการ');
    return (isLeadership || isActivityHead) ? 'manager' : 'instructor';
}

function applyActivitiesTier() {
    document.querySelectorAll('[data-tier]').forEach((el) => {
        el.classList.toggle('hidden', el.dataset.tier !== activitiesTier);
    });
    // nav.js คืนแท็บที่เปิดค้างไว้จาก sessionStorage แบบ sync ตั้งแต่ตอน DOMContentLoaded (ก่อนที่ fetch /api/auth/me ด้านล่างจะ resolve) จึงอาจดันแท็บ "จัดการกลุ่ม" ให้ active ไว้ทั้งที่ tier ปัจจุบันดูไม่ได้แล้ว (เช่น สลับจากมุมมองหัวหน้าฝ่ายมาทีมงานปกติ) กลายเป็นหน้าเปล่าเพราะไม่มีแท็บไหน active เลย - เช็คแล้วสลับไปแท็บ "สร้างกิจกรรม" (เปิดให้ทุก tier) แทนถ้าเจอแบบนี้
    const activePage = document.querySelector('.tab-content.active');
    if (activePage && activePage.dataset.tier && activePage.dataset.tier !== activitiesTier) {
        switchTab('create');
    }
}

// ==========================================
// เริ่มต้นหน้า
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    document.getElementById('activity-create-form')?.addEventListener('submit', handleActivityCreateSubmit);
    document.getElementById('activity-list-pagination-prev')?.addEventListener('click', () => goToActivityListPage(activityListCurrentPage - 1));
    document.getElementById('activity-list-pagination-next')?.addEventListener('click', () => goToActivityListPage(activityListCurrentPage + 1));
    document.getElementById('group-create-form')?.addEventListener('submit', handleGroupCreateSubmit);
    document.getElementById('score-activity-select')?.addEventListener('change', handleScoreActivityChange);

    // เช็คสถานะค่ายก่อนทุกอย่าง: ยังไม่มีค่ายที่กำลังดำเนินการ = ระบบกิจกรรมล็อก (API ทุกเส้นตอบ 409 อยู่แล้ว) โชว์แผงอธิบายแทนแล้วจบ ไม่โหลดข้อมูลอื่นให้เจอ toast error รัว ๆ
    // ต้องรู้ tier ก่อนถึงจะตัดสินใจได้ว่าโหลด loadGroups() ไหม (ไม่งั้นทีมงานปกติจะเจอ toast แจ้งเตือนโหลดไม่สำเร็จโดยไม่จำเป็น เพราะ /unassigned-participants ตอบ 403)
    window.PTN_AUTH_ME
        .then(({ user, camp }) => {
            window.PTN_CAMP_STATE = camp || null;
            if (!isCampActive(camp)) {
                renderCampLockedPage(document.querySelector('main.main-content'), { systemName: 'ระบบกิจกรรม', audience: 'staff', camp });
                return;
            }
            activitiesTier = computeActivitiesTier(user);
            applyActivitiesTier();
            const tierLoaded = activitiesTier === 'manager' ? loadGroups() : Promise.resolve();
            return Promise.allSettled([tierLoaded, loadCampActivities(), loadLeaderboard(), loadScoreHistoryLog()]);
        })
        .finally(() => Loader.hideFullPageLoader());
});
