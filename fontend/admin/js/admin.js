// escape ก่อน render ผ่าน innerHTML - ใช้กับข้อความที่มาจาก activity log (summary) ซึ่งบางครั้งเป็น error message ที่ต่อมาจากปลายทางภายนอก (เช่น Google API ตอบ HTML ดิบตอน 502)
// ป้องกัน tag ที่หลุดมา (โดยเฉพาะ <style>) ไปกระทบ layout ทั้งหน้า เพราะ <style> มีผลข้ามตำแหน่งที่มันอยู่ใน DOM เสมอไม่ว่าจะซ้อนอยู่ใน element ไหน
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

const STUDY_PLAN_LABELS = {
    SCIENCE_MATH: 'วิทย์-คณิต',
    ARTS_MATH: 'ศิลป์-คำนวณ',
    ARTS_LANGUAGE: 'ศิลป์-ภาษา',
    ARTS_SOCIAL: 'ศิลป์-สังคม',
    OTHER: 'อื่น ๆ',
};

// แผนการเรียนเป็น "อื่น ๆ" ต้องต่อท้ายด้วยข้อความที่ระบุเพิ่มเติม (studyPlanOther) ไม่งั้นเห็นแค่ "อื่น ๆ" เฉย ๆ ไม่รู้ว่าคืออะไร
function formatStudyPlanLabel(item) {
    if (!item.studyPlan) return '-';
    const label = STUDY_PLAN_LABELS[item.studyPlan] || item.studyPlan;
    return item.studyPlan === 'OTHER' && item.studyPlanOther ? `${label} (${item.studyPlanOther})` : label;
}

const INTEREST_SUBJECT_GROUP_LABELS = {
    ENGINEERING_TECH: 'วิศวกรรมศาสตร์',
    SCIENCE: 'วิทยาศาสตร์',
    HEALTH: 'สุขภาพ',
    EDUCATION: 'ศึกษาศาสตร์',
    HUMANITIES_SOCIAL: 'มนุษยศาสตร์และสังคม',
    ART_DESIGN: 'ศิลปกรรมศาสตร์',
    MEDIA_DIGITAL_TECH: 'สื่อและเทคโนโลยีดิจิทัล',
    BUSINESS: 'บริหารธุรกิจ',
    OTHER: 'อื่น ๆ',
};

// กลุ่มวิชาที่สนใจเลือกได้หลายข้อ ถ้ามี "อื่น ๆ" รวมอยู่ด้วยต้องต่อท้ายด้วยข้อความที่ระบุเพิ่มเติม (interestSubjectGroupOther)
function formatInterestSubjectGroupLabel(item) {
    const values = Array.isArray(item.interestSubjectGroup) ? item.interestSubjectGroup : [];
    if (values.length === 0) return '-';
    return values
        .map((value) => {
            const label = INTEREST_SUBJECT_GROUP_LABELS[value] || value;
            return value === 'OTHER' && item.interestSubjectGroupOther ? `${label} (${item.interestSubjectGroupOther})` : label;
        })
        .join(', ');
}

const NEWS_TAG_LABELS = {
    ANNOUNCE: 'ประกาศค่าย',
    ACTIVITY: 'ประชาสัมพันธ์การรับสมัคร',
    SCHOLAR: 'กิจกรรม',
    OTHER: 'อื่น ๆ',
};

const ACTIVITY_ACTION_LABELS = {
    CREATE: { text: 'เพิ่มข้อมูล', className: 'admin-badge-create' },
    UPDATE: { text: 'แก้ไขข้อมูล', className: 'admin-badge-update' },
    DELETE: { text: 'ลบข้อมูล', className: 'admin-badge-delete' },
};

const ACTIVITY_ENTITY_LABELS = {
    COMMITTEE: 'ทำเนียบประธานค่าย',
    NEWS: 'ประชาสัมพันธ์',
    SCHEDULE: 'กำหนดการ',
    USER: 'ผู้ใช้งาน',
    SITE_SETTING: 'ตั้งค่าเว็บไซต์',
    GALLERY_PHOTO: 'ประมวลภาพ',
    CAMP_ACTIVITY: 'กิจกรรมค่าย',
    GROUP: 'กลุ่มน้องค่าย',
    ACTIVITY_SCORE: 'คะแนนกิจกรรม',
    SUBJECT: 'รายวิชา',
    CLASS_SCHEDULE: 'ตารางเรียน',
    STUDY_DOCUMENT: 'เอกสารประกอบการเรียน',
};

const ACTIVITY_ROLE_LABELS = {
    HOST: 'Host', // ค่าเก่าก่อนเปลี่ยนชื่อ role เป็น WEBMANAGER ยังต้องเก็บไว้แสดงผลประวัติการดำเนินการเก่า
    WEBMANAGER: 'WebManager',
    ADMIN: 'แอดมิน',
    STAFF: 'พี่ค่าย',
    PARTICIPANT: 'น้องค่าย',
};

// ตำแหน่งผู้บริหารค่าย: มองเห็นเมนู "งาน" ได้ทั้ง 4 ฝ่าย ส่วนตำแหน่งอื่นเห็นเฉพาะฝ่ายที่ตัวเองสังกัด (ต้องตรงกับ auth.js)
const ADMIN_LEADERSHIP_POSITIONS = ['ประธานค่าย', 'รองประธานค่าย', 'เลขานุการ'];

// ใส่รูปโปรไฟล์จริง (User.avatarUrl) ถ้ามี ไม่งั้น fallback เป็นตัวอักษรย่อเหมือนเดิม
function renderAvatar(el, avatarUrl, initial) {
    if (!el) return;
    el.innerHTML = '';
    if (avatarUrl) {
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        el.appendChild(img);
    } else {
        el.innerText = initial;
    }
}

function loadAdminUser() {
    return fetch('/api/auth/me')
        .then((res) => {
            if (!res.ok) throw new Error('unauthorized');
            return res.json();
        })
        .then(({ user }) => {
            const isPrivilegedStaff = user.role === 'STAFF' && user.isAdmin;
            const roleLabel = ACTIVITY_ROLE_LABELS[user.role] || user.role;

            // เหมือนหน้าพี่ค่าย/หน้าแรก: ถ้ามีชื่อ-นามสกุลและตำแหน่งในโปรไฟล์ ให้ขึ้นชื่อและตำแหน่งแทน email/role ตรง ๆ
            const fullName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null;
            const positionLabel = (user.position && user.position.name) || roleLabel;
            const subLabel = isPrivilegedStaff ? `${positionLabel} · ผู้ดูแลระบบ` : positionLabel;
            const nameLine = fullName || (user.role === 'WEBMANAGER' ? 'Owner' : user.email);
            const initial = nameLine.charAt(0).toUpperCase();

            const display = document.getElementById('admin-username-display');
            const avatar = document.getElementById('admin-avatar');
            if (display) display.textContent = `${nameLine} (${subLabel})`;
            renderAvatar(avatar, user.avatarUrl, initial);

            const menuAvatar = document.getElementById('admin-menu-avatar');
            const menuUsername = document.getElementById('admin-menu-username');
            const menuRole = document.getElementById('admin-menu-role');
            renderAvatar(menuAvatar, user.avatarUrl, initial);
            if (menuUsername) menuUsername.textContent = nameLine;
            if (menuRole) menuRole.textContent = subLabel;

            // ลิงก์ "โปรไฟล์" มีเฉพาะพี่ค่าย (Host ไม่มี StaffProfile) ส่วน "หน้าแรก" พาไปหน้าที่เหมาะกับ role นั้น ๆ
            const profileLink = document.getElementById('admin-menu-profile-link');
            if (profileLink) profileLink.classList.toggle('hidden', user.role !== 'STAFF');

            const homeLink = document.getElementById('admin-menu-home-link');
            if (homeLink) homeLink.onclick = () => {
                window.location.href = user.role === 'STAFF' ? '/staff/profile.html' : '/';
            };

            applyAdminTaskMenuVisibility(user);
            applyAdminHomeNavAccess(user);
        })
        .catch(() => {
            window.location.href = '/';
        });
}

// Admin (พี่ค่ายที่ isAdmin) มีสิทธิ์ในกลุ่ม "Home" แค่ ประชาสัมพันธ์ กับ กำหนดการ - หน้าแรก (Hero) กับ ทำเนียบประธานค่าย เป็นของ WebManager เท่านั้น
// (WebManager ที่แวะเข้า /admin ยังเห็นครบทุกแท็บเหมือนเดิม)
function applyAdminHomeNavAccess(user) {
    const isWebManager = !!(user && user.role === 'WEBMANAGER');
    ['home', 'committee'].forEach((tab) => {
        const navChild = document.getElementById(`admin-tab-${tab}`);
        if (navChild) navChild.classList.toggle('hidden', !isWebManager);
    });
    if (isWebManager) return;

    // ถ้าแท็บที่เปิดอยู่ตอนนี้ดันเป็นแท็บที่เพิ่งถูกซ่อน (เช่น "หน้าแรก" ที่ active เป็นค่าเริ่มต้นตอนโหลดหน้า) ให้สลับไปแท็บที่ Admin เข้าได้แทน
    const activeTab = document.querySelector('#home-subnav .admin-shell-nav-child.active');
    if (activeTab && (activeTab.id === 'admin-tab-home' || activeTab.id === 'admin-tab-committee')) {
        switchAdminTab('news');
    }
}

// เหมือน applyStaffTaskMenuVisibility ใน auth.js: กรองรายการ "งาน" ตามฝ่ายที่พี่ค่ายสังกัด (Host ไม่มีฝ่ายจึงไม่เห็นเมนูนี้เลย)
// WebManager (สิทธิ์สูงสุด) นับเป็น "ผู้บริหาร" เห็นได้ทุกฝ่ายเสมอ เหมือน isAcademicManager/requireGroupManagementAccess ฝั่ง backend
function applyAdminTaskMenuVisibility(user) {
    const wraps = document.querySelectorAll('.admin-tasks-wrap');
    if (!wraps.length) return;

    const isWebManager = !!(user && user.role === 'WEBMANAGER');
    const isLeadership = isWebManager || !!(user && user.position && ADMIN_LEADERSHIP_POSITIONS.includes(user.position.name));
    const departmentName = user && user.department ? user.department.name : null;

    wraps.forEach((wrap) => {
        const items = wrap.querySelectorAll('[data-department-name]');
        let visibleCount = 0;
        items.forEach((item) => {
            const show = isLeadership || (departmentName && item.dataset.departmentName === departmentName);
            item.classList.toggle('hidden', !show);
            if (show) visibleCount += 1;
        });
        wrap.classList.toggle('hidden', !(user && (user.role === 'STAFF' || isWebManager)) || visibleCount === 0);
    });
}

function adminComingSoon(featureName) {
    document.getElementById('admin-user-menu').classList.add('hidden');
    showToast(`"${featureName}" อยู่ระหว่างการพัฒนา`);
}

async function adminLogout() {
    const confirmed = await adminConfirm('ต้องการออกจากระบบใช่หรือไม่?', { title: 'ยืนยันออกจากระบบ', confirmText: 'ออกจากระบบ' });
    if (!confirmed) return;

    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        window.location.href = '/';
    });
}

function toggleAdminUserMenu() {
    const menu = document.getElementById('admin-user-menu');
    if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', (event) => {
    const dropdown = document.querySelector('.admin-user-dropdown');
    const menu = document.getElementById('admin-user-menu');
    if (dropdown && menu && !dropdown.contains(event.target)) {
        menu.classList.add('hidden');
    }
});

// ==========================================
// การแจ้งเตือน (Notification bell)
// ==========================================
function toggleAdminNotifMenu() {
    const menu = document.getElementById('admin-notif-menu');
    if (!menu) return;
    const opening = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    if (opening) loadAdminNotifications();
}

document.addEventListener('click', (event) => {
    const dropdown = document.querySelector('.admin-notif-dropdown');
    const menu = document.getElementById('admin-notif-menu');
    if (dropdown && menu && !dropdown.contains(event.target)) {
        menu.classList.add('hidden');
    }
});

function loadAdminNotifications() {
    Loader.renderSkeletonCards(document.getElementById('admin-notif-list'), 3);
    fetch('/api/activity-logs')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            const lastSeen = Number(localStorage.getItem('adminNotifLastSeen') || 0);
            renderAdminNotifications(items.slice(0, 8), lastSeen);
            markAdminNotificationsSeen(items);
        })
        .catch((error) => console.error('โหลดการแจ้งเตือนไม่สำเร็จ:', error));
}

function renderAdminNotifications(items, lastSeen) {
    const list = document.getElementById('admin-notif-list');
    if (!list) return;

    if (items.length === 0) {
        list.innerHTML = '<p class="admin-notif-empty">ยังไม่มีการแจ้งเตือน</p>';
        return;
    }

    list.innerHTML = '';
    items.forEach((item) => {
        const div = document.createElement('div');
        const isUnread = new Date(item.createdAt).getTime() > lastSeen;
        div.className = `admin-notif-item${isUnread ? ' unread' : ''}`;
        const time = new Date(item.createdAt).toLocaleString('th-TH', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        div.innerHTML = `
            <span class="admin-notif-item-dot"></span>
            <span class="admin-notif-item-body">
                <span class="admin-notif-item-summary">${escapeHtml(item.summary)}</span>
                <span class="admin-notif-item-meta">${item.actorEmail} · ${time}</span>
            </span>
        `;
        list.appendChild(div);
    });
}

function checkAdminNotificationBadge() {
    fetch('/api/activity-logs')
        .then((res) => (res.ok ? res.json() : []))
        .then((items) => {
            if (items.length === 0) return;
            const lastSeen = Number(localStorage.getItem('adminNotifLastSeen') || 0);
            const latest = new Date(items[0].createdAt).getTime();
            const dot = document.getElementById('admin-notif-dot');
            if (dot) dot.classList.toggle('hidden', lastSeen >= latest);
        })
        .catch(() => {});
}

function markAdminNotificationsSeen(items) {
    if (items.length === 0) return;
    localStorage.setItem('adminNotifLastSeen', String(new Date(items[0].createdAt).getTime()));
    const dot = document.getElementById('admin-notif-dot');
    if (dot) dot.classList.add('hidden');
}

function viewAllActivityLogs() {
    const menu = document.getElementById('admin-notif-menu');
    if (menu) menu.classList.add('hidden');
    switchAdminSection('log');
}

function setAdminNavGroupCollapsed(targetId, collapsed) {
    const collapse = document.getElementById(targetId);
    if (collapse) collapse.classList.toggle('collapsed', collapsed);
}

function toggleAdminSidebar() {
    const sidebar = document.querySelector('.admin-shell-sidebar');
    if (!sidebar) return;
    const collapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('adminSidebarCollapsed', collapsed ? '1' : '0');
}

function toggleAdminTheme() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (next === 'dark') {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }
    localStorage.setItem('adminTheme', next);
}

const ADMIN_NAV_GROUPS = {
    home: 'home-subnav',
    'approve-registration': 'approve-registration-subnav',
    user: 'user-subnav',
    log: 'log-subnav',
};

function switchAdminSection(section) {
    const sidebar = document.querySelector('.admin-shell-sidebar');
    const wasCollapsedRail = !!(sidebar && sidebar.classList.contains('collapsed'));
    if (wasCollapsedRail) {
        // กดไอคอนขณะเมนูย่อ (icon rail) ให้เด้งเมนูออกมาเต็มก่อน
        sidebar.classList.remove('collapsed');
        localStorage.setItem('adminSidebarCollapsed', '0');
    }

    const ownSubnavId = ADMIN_NAV_GROUPS[section];
    const wasAlreadyActive = ownSubnavId
        && document.getElementById(`section-nav-${section}`).classList.contains('active');

    document.querySelectorAll('.admin-section').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.admin-shell-nav-parent').forEach((btn) => btn.classList.remove('active'));

    document.getElementById(`admin-section-${section}`).classList.add('active');
    document.getElementById(`section-nav-${section}`).classList.add('active');

    Object.entries(ADMIN_NAV_GROUPS).forEach(([groupSection, subnavId]) => {
        if (groupSection !== section) {
            // พับเมนูย่อยของกลุ่มอื่นอัตโนมัติเมื่อไปหน้าอื่น
            setAdminNavGroupCollapsed(subnavId, true);
        }
    });

    if (ownSubnavId) {
        if (wasAlreadyActive && !wasCollapsedRail) {
            // กดซ้ำที่เมนูหลักขณะเมนูย่อยเปิดอยู่แล้ว ให้สลับเปิด/หุบแทน
            const subnav = document.getElementById(ownSubnavId);
            setAdminNavGroupCollapsed(ownSubnavId, !subnav.classList.contains('collapsed'));
        } else {
            // เข้าเมนูกลุ่มนี้ใหม่ (หรือเด้งออกจากโหมดย่อ) ให้ขยายเมนูย่อยและเข้ารายการแรกเสมอ
            setAdminNavGroupCollapsed(ownSubnavId, false);
            const firstChild = document.querySelector(`#${ownSubnavId} .admin-shell-nav-child`);
            if (firstChild) switchAdminTab(firstChild.id.replace('admin-tab-', ''));
        }
    }
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.remove('active'));
    document.querySelectorAll('.admin-shell-nav-child').forEach((btn) => btn.classList.remove('active'));

    document.getElementById(`admin-panel-${tab}`).classList.add('active');
    document.getElementById(`admin-tab-${tab}`).classList.add('active');
}

let adminToastTimeout = null;
let adminToastUndoCallback = null;

function showToast(message, isError = false, options = {}) {
    const toast = document.getElementById('admin-toast');
    const messageEl = document.getElementById('admin-toast-message');
    const undoBtn = document.getElementById('admin-toast-undo-btn');
    if (!toast || !messageEl) return;

    clearTimeout(adminToastTimeout);
    messageEl.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('visible');

    adminToastUndoCallback = options.onUndo || null;
    if (undoBtn) undoBtn.classList.toggle('hidden', !adminToastUndoCallback);

    adminToastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
        adminToastUndoCallback = null;
    }, adminToastUndoCallback ? 5000 : 3000);
}

function adminToastUndo() {
    const toast = document.getElementById('admin-toast');
    const callback = adminToastUndoCallback;
    clearTimeout(adminToastTimeout);
    if (toast) toast.classList.remove('visible');
    adminToastUndoCallback = null;
    if (callback) callback();
}

// ==========================================
// กล่องยืนยัน (แทน confirm() ของเบราว์เซอร์)
// ==========================================
let adminConfirmResolver = null;

function adminConfirm(message, options = {}) {
    const modal = document.getElementById('admin-confirm-modal');
    const messageEl = document.getElementById('admin-confirm-message');
    const titleEl = document.getElementById('admin-confirm-title');
    const okBtn = document.getElementById('admin-confirm-ok-btn');
    if (!modal || !messageEl || !titleEl || !okBtn) return Promise.resolve(false);

    messageEl.textContent = message;
    titleEl.textContent = options.title || 'ยืนยันการลบ';
    okBtn.textContent = options.confirmText || 'ยืนยัน';
    modal.classList.remove('hidden');

    return new Promise((resolve) => {
        adminConfirmResolver = resolve;
    });
}

function adminConfirmResolve(result) {
    const modal = document.getElementById('admin-confirm-modal');
    if (modal) modal.classList.add('hidden');
    if (adminConfirmResolver) {
        adminConfirmResolver(result);
        adminConfirmResolver = null;
    }
}


// ==========================================
// ทำเนียบประธานค่าย (Committee)
// ==========================================
const COMMITTEE_PAGE_SIZE = 20;
let committeeItems = [];
let committeeCurrentPage = 1;
let committeeSelectedIds = new Set();
let committeeSortColumn = 'generationNo';
let committeeSortDirection = 'asc';

const COMMITTEE_SORTABLE_COLUMNS = ['generationNo', 'fullName', 'nickname'];
const SORT_ICON_NEUTRAL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.53 3.47a.75.75 0 00-1.06 0L6.22 6.72a.75.75 0 001.06 1.06L10 5.06l2.72 2.72a.75.75 0 101.06-1.06l-3.25-3.25zm-4.31 9.81l3.25 3.25a.75.75 0 001.06 0l3.25-3.25a.75.75 0 10-1.06-1.06L10 14.94l-2.72-2.72a.75.75 0 00-1.06 1.06z" clip-rule="evenodd" /></svg>';
const SORT_ICON_ASC = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.47 6.47a.75.75 0 011.06 0l4.25 4.25a.75.75 0 01-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 01-1.06-1.06l4.25-4.25z" clip-rule="evenodd" /></svg>';
const SORT_ICON_DESC = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.53 13.53a.75.75 0 01-1.06 0l-4.25-4.25a.75.75 0 111.06-1.06L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25z" clip-rule="evenodd" /></svg>';

function adminActionButtonsHtml() {
    return `
        <div class="admin-row-actions">
            <button type="button" class="admin-icon-btn admin-icon-btn-edit" data-action="edit" aria-label="แก้ไข" title="แก้ไข">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
            </button>
            <button type="button" class="admin-icon-btn admin-icon-btn-delete" data-action="delete" aria-label="ลบ" title="ลบ">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
            </button>
        </div>
    `;
}

function loadCommittees() {
    Loader.renderSkeletonTableRows(document.getElementById('committee-table-body'), 5, 4);
    fetch('/api/presidents')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            committeeItems = items;
            committeeCurrentPage = 1;
            committeeSelectedIds.clear();
            renderCommitteeTable();
        })
        .catch((error) => {
            console.error('โหลดข้อมูลประธานค่ายไม่สำเร็จ:', error);
            showToast('โหลดข้อมูลประธานค่ายไม่สำเร็จ', true);
        });
}

function getFilteredCommitteeItems() {
    const searchInput = document.getElementById('committee-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let items = committeeItems;
    if (query) {
        items = items.filter((item) => {
            const text = `${item.generationNos.join(' ')} ${item.fullName} ${item.nickname}`.toLowerCase();
            return text.includes(query);
        });
    }
    return sortCommitteeItems(items);
}

function sortCommitteeItems(items) {
    const direction = committeeSortDirection === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
        // คอลัมน์ "ครั้งที่" เก็บเป็น array (generationNos) เรียงตามครั้งที่น้อยที่สุด แทนการเทียบตัวเลขตรง ๆ
        const valA = committeeSortColumn === 'generationNo' ? Math.min(...a.generationNos) : a[committeeSortColumn];
        const valB = committeeSortColumn === 'generationNo' ? Math.min(...b.generationNos) : b[committeeSortColumn];
        if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * direction;
        return String(valA).localeCompare(String(valB), 'th') * direction;
    });
}

function setCommitteeSort(column) {
    if (committeeSortColumn === column) {
        committeeSortDirection = committeeSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        committeeSortColumn = column;
        committeeSortDirection = 'asc';
    }
    committeeCurrentPage = 1;
    renderCommitteeTable();
}

function updateCommitteeSortIndicators() {
    COMMITTEE_SORTABLE_COLUMNS.forEach((column) => {
        const icon = document.querySelector(`[data-sort-icon-committee="${column}"]`);
        if (!icon) return;
        if (committeeSortColumn !== column) {
            icon.classList.remove('active');
            icon.innerHTML = SORT_ICON_NEUTRAL;
        } else {
            icon.classList.add('active');
            icon.innerHTML = committeeSortDirection === 'asc' ? SORT_ICON_ASC : SORT_ICON_DESC;
        }
    });
}

function getCurrentCommitteeId() {
    const visibleItems = committeeItems.filter((item) => item.isVisible !== false);
    if (visibleItems.length === 0) return null;
    return visibleItems.reduce((max, item) => (Math.max(...item.generationNos) > Math.max(...max.generationNos) ? item : max), visibleItems[0]).id;
}

function renderCommitteeTable() {
    const tbody = document.getElementById('committee-table-body');
    const empty = document.getElementById('committee-empty');
    const noMatch = document.getElementById('committee-no-match');
    if (!tbody || !empty) return;

    const filtered = getFilteredCommitteeItems();
    const totalPages = Math.max(1, Math.ceil(filtered.length / COMMITTEE_PAGE_SIZE));
    committeeCurrentPage = Math.min(Math.max(1, committeeCurrentPage), totalPages);
    const start = (committeeCurrentPage - 1) * COMMITTEE_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + COMMITTEE_PAGE_SIZE);
    const currentId = getCurrentCommitteeId();

    tbody.innerHTML = '';
    empty.classList.toggle('hidden', committeeItems.length !== 0);
    if (noMatch) noMatch.classList.toggle('hidden', !(committeeItems.length > 0 && filtered.length === 0));

    pageItems.forEach((item) => {
        const row = document.createElement('tr');
        const checked = committeeSelectedIds.has(item.id);
        const isVisible = item.isVisible !== false;
        row.innerHTML = `
            <td>
                <label class="admin-checkbox-wrap">
                    <input type="checkbox" class="admin-row-checkbox" ${checked ? 'checked' : ''}>
                    <span class="custom-checkbox"></span>
                </label>
            </td>
            <td><img class="admin-row-thumb" src="${item.imageUrl || '/backend/uploads/presidents/profile.jpg'}" alt=""></td>
            <td class="admin-cell-strong">${item.generationNos.join(', ')}</td>
            <td class="admin-cell-strong">${item.fullName}</td>
            <td>${item.nickname}</td>
            <td>
                <div class="admin-status-cell">
                    <label class="admin-toggle-switch small">
                        <input type="checkbox" class="admin-visibility-toggle" ${isVisible ? 'checked' : ''}>
                    </label>
                    ${item.id === currentId ? '<span class="admin-badge admin-badge-current">ปัจจุบัน</span>' : ''}
                </div>
            </td>
            <td>${adminActionButtonsHtml()}</td>
        `;
        row.querySelector('.admin-row-checkbox').addEventListener('change', (e) => toggleCommitteeRowSelect(item.id, e.target.checked));
        row.querySelector('.admin-visibility-toggle').addEventListener('change', (e) => toggleCommitteeVisibility(item, e.target.checked));
        row.querySelector('[data-action="edit"]').addEventListener('click', () => openCommitteeForm(item));
        row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteCommittee(item));
        tbody.appendChild(row);
    });

    updateCommitteePagination(filtered.length, totalPages);
    updateCommitteeBulkBar();
    updateCommitteeSelectAllState(pageItems);
    updateCommitteeSortIndicators();
}

function toggleCommitteeVisibility(item, isVisible) {
    fetch(`/api/presidents/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(() => {
            showToast(
                isVisible ? `เปิดแสดงผล "${item.fullName}" แล้ว` : `ซ่อน "${item.fullName}" จากหน้าเว็บแล้ว`,
                false,
                { onUndo: () => toggleCommitteeVisibility(item, !isVisible) }
            );
            loadCommittees();
        })
        .catch((error) => {
            console.error(error);
            showToast('อัปเดตสถานะไม่สำเร็จ', true);
            loadCommittees();
        });
}

function toggleCommitteeRowSelect(id, checked) {
    if (checked) committeeSelectedIds.add(id);
    else committeeSelectedIds.delete(id);
    updateCommitteeBulkBar();
    updateCommitteeSelectAllState();
}

function toggleCommitteeSelectAll(checked) {
    const filtered = getFilteredCommitteeItems();
    const start = (committeeCurrentPage - 1) * COMMITTEE_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + COMMITTEE_PAGE_SIZE);
    pageItems.forEach((item) => {
        if (checked) committeeSelectedIds.add(item.id);
        else committeeSelectedIds.delete(item.id);
    });
    renderCommitteeTable();
}

function updateCommitteeSelectAllState(currentPageItems) {
    const selectAll = document.getElementById('committee-select-all');
    if (!selectAll) return;

    let pageItems = currentPageItems;
    if (!pageItems) {
        const filtered = getFilteredCommitteeItems();
        const start = (committeeCurrentPage - 1) * COMMITTEE_PAGE_SIZE;
        pageItems = filtered.slice(start, start + COMMITTEE_PAGE_SIZE);
    }
    selectAll.checked = pageItems.length > 0 && pageItems.every((item) => committeeSelectedIds.has(item.id));
}

function updateCommitteeBulkBar() {
    const btn = document.getElementById('committee-bulk-delete-btn');
    const countEl = document.getElementById('committee-selected-count');
    const n = committeeSelectedIds.size;

    if (btn) btn.disabled = n === 0;
    if (countEl) {
        countEl.textContent = `เลือกแล้ว ${n} รายการ`;
        countEl.classList.toggle('hidden', n === 0);
    }
}

async function bulkDeleteCommittees() {
    const ids = Array.from(committeeSelectedIds);
    if (ids.length === 0) return;
    const confirmed = await adminConfirm(`ลบข้อมูลประธานค่ายที่เลือกไว้ ${ids.length} รายการ ใช่หรือไม่?`);
    if (!confirmed) return;

    Promise.all(ids.map((id) => fetch(`/api/presidents/${id}`, { method: 'DELETE' })))
        .then((results) => {
            const failedCount = results.filter((res) => !res.ok && res.status !== 204).length;
            showToast(
                failedCount > 0 ? `ลบสำเร็จบางส่วน (ล้มเหลว ${failedCount} รายการ)` : 'ลบข้อมูลที่เลือกสำเร็จ',
                failedCount > 0
            );
            loadCommittees();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบข้อมูลที่เลือกไม่สำเร็จ', true);
        });
}

function updateCommitteePagination(filteredCount, totalPages) {
    const pagination = document.getElementById('committee-pagination');
    const prevBtn = document.getElementById('committee-prev-btn');
    const nextBtn = document.getElementById('committee-next-btn');
    if (!pagination || !prevBtn || !nextBtn) return;

    pagination.classList.toggle('hidden', filteredCount <= COMMITTEE_PAGE_SIZE);
    prevBtn.disabled = committeeCurrentPage <= 1;
    nextBtn.disabled = committeeCurrentPage >= totalPages;
    renderCommitteePageNumbers(totalPages);
}

function getPaginationRange(current, total) {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let last;

    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
            range.push(i);
        }
    }

    range.forEach((i) => {
        if (last) {
            if (i - last === 2) {
                rangeWithDots.push(last + 1);
            } else if (i - last !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        last = i;
    });

    return rangeWithDots;
}

function renderCommitteePageNumbers(totalPages) {
    const container = document.getElementById('committee-page-numbers');
    if (!container) return;

    container.innerHTML = '';
    getPaginationRange(committeeCurrentPage, totalPages).forEach((page) => {
        if (page === '...') {
            const span = document.createElement('span');
            span.className = 'admin-page-ellipsis';
            span.textContent = '...';
            container.appendChild(span);
            return;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-page-number-btn';
        btn.textContent = page;
        btn.classList.toggle('active', page === committeeCurrentPage);
        btn.addEventListener('click', () => goToCommitteePage(page));
        container.appendChild(btn);
    });
}

function goToCommitteePage(page) {
    committeeCurrentPage = page;
    renderCommitteeTable();
}

function changeCommitteePage(delta) {
    committeeCurrentPage += delta;
    renderCommitteeTable();
}

// ชิปตัวเลข "ครั้งที่" ของฟอร์มที่เปิดอยู่ตอนนี้ (คนเดียวกันดำรงตำแหน่งได้หลายครั้ง ไม่ต้องสร้างข้อมูลซ้ำ)
let committeeGenerationChips = [];

function renderCommitteeGenerationChips() {
    const container = document.getElementById('committee-generationNos-chips');
    if (!container) return;
    container.innerHTML = committeeGenerationChips
        .map((n) => `
            <span class="generation-chip">
                ครั้งที่ ${n}
                <button type="button" class="generation-chip-remove" aria-label="ลบครั้งที่ ${n}" onclick="removeCommitteeGenerationChip(${n})">&times;</button>
            </span>
        `)
        .join('');
}

function addCommitteeGenerationChip() {
    const input = document.getElementById('committee-generationNo-add-input');
    const value = Number(input.value);

    if (!input.value || !Number.isInteger(value) || value < 1) {
        showToast('กรุณาใส่ครั้งที่เป็นจำนวนเต็มบวก', true);
        return;
    }
    if (committeeGenerationChips.includes(value)) {
        showToast(`มีครั้งที่ ${value} อยู่แล้ว`, true);
        return;
    }

    committeeGenerationChips.push(value);
    committeeGenerationChips.sort((a, b) => a - b);
    renderCommitteeGenerationChips();
    input.value = '';
    input.focus();
}

function removeCommitteeGenerationChip(value) {
    committeeGenerationChips = committeeGenerationChips.filter((n) => n !== value);
    renderCommitteeGenerationChips();
}

// กด Enter ในช่องเพิ่มครั้งที่ = เพิ่มชิป ไม่ใช่ submit ฟอร์มทั้งหมด
function handleCommitteeGenerationInputKeydown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addCommitteeGenerationChip();
}

function openCommitteeForm(item) {
    const form = document.getElementById('committee-form');
    const error = document.getElementById('committee-form-error');
    form.reset();
    error.classList.add('hidden');

    document.getElementById('committee-modal-title').textContent = item ? 'แก้ไขประธานค่าย' : 'เพิ่มประธานค่าย';
    document.getElementById('committee-id').value = item ? item.id : '';
    committeeGenerationChips = item ? [...item.generationNos].sort((a, b) => a - b) : [];
    renderCommitteeGenerationChips();
    document.getElementById('committee-fullName').value = item ? item.fullName : '';
    document.getElementById('committee-nickname').value = item ? item.nickname : '';
    document.getElementById('committee-imageUrl').value = item && item.imageUrl ? item.imageUrl : '';
    document.getElementById('committee-university').value = item && item.university ? item.university : '';
    document.getElementById('committee-universityLogoUrl').value = item && item.universityLogoUrl ? item.universityLogoUrl : '';
    document.getElementById('committee-faculty').value = item && item.faculty ? item.faculty : '';
    document.getElementById('committee-major').value = item && item.major ? item.major : '';
    document.getElementById('committee-isVisible').checked = item ? item.isVisible !== false : true;

    document.getElementById('committee-modal').classList.remove('hidden');
}

function closeCommitteeForm() {
    document.getElementById('committee-modal').classList.add('hidden');
}

function submitCommitteeForm(event) {
    event.preventDefault();

    const id = document.getElementById('committee-id').value;
    const errorBox = document.getElementById('committee-form-error');
    errorBox.classList.add('hidden');

    if (committeeGenerationChips.length === 0) {
        errorBox.textContent = 'ต้องระบุครั้งที่อย่างน้อย 1 ครั้ง';
        errorBox.classList.remove('hidden');
        return;
    }

    const payload = {
        generationNos: committeeGenerationChips,
        fullName: document.getElementById('committee-fullName').value.trim(),
        nickname: document.getElementById('committee-nickname').value.trim(),
        imageUrl: document.getElementById('committee-imageUrl').value.trim(),
        university: document.getElementById('committee-university').value.trim(),
        universityLogoUrl: document.getElementById('committee-universityLogoUrl').value.trim(),
        faculty: document.getElementById('committee-faculty').value.trim(),
        major: document.getElementById('committee-major').value.trim(),
        isVisible: document.getElementById('committee-isVisible').checked,
    };

    const url = id ? `/api/presidents/${id}` : '/api/presidents';
    const method = id ? 'PUT' : 'POST';
    const submitBtn = event.target.querySelector('button[type="submit"]');
    Loader.setButtonLoading(submitBtn, 'กำลังบันทึก...');

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            closeCommitteeForm();
            showToast(id ? 'แก้ไขข้อมูลประธานค่ายสำเร็จ' : 'เพิ่มประธานค่ายสำเร็จ');
            loadCommittees();
        })
        .catch((error) => {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
        })
        .finally(() => {
            Loader.clearButtonLoading(submitBtn);
        });
}

async function deleteCommittee(item) {
    const confirmed = await adminConfirm(`ลบ "${item.fullName}" (ครั้งที่ ${item.generationNos.join(', ')}) ใช่หรือไม่?`);
    if (!confirmed) return;

    fetch(`/api/presidents/${item.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showToast('ลบข้อมูลประธานค่ายสำเร็จ');
            loadCommittees();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบข้อมูลไม่สำเร็จ', true);
        });
}

// ==========================================
// ข่าวสารประกาศ (News)
// ==========================================
const NEWS_PAGE_SIZE = 20;
const NEWS_SORTABLE_COLUMNS = ['title', 'tag', 'publishedAt'];
let newsItems = [];
let newsCurrentPage = 1;
let newsSelectedIds = new Set();
let newsSortColumn = 'publishedAt';
let newsSortDirection = 'desc';

function loadNews() {
    Loader.renderSkeletonTableRows(document.getElementById('news-table-body'), 5, 4);
    fetch('/api/news')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            newsItems = items;
            newsCurrentPage = 1;
            newsSelectedIds.clear();
            renderNewsTable();
        })
        .catch((error) => {
            console.error('โหลดข่าวสารไม่สำเร็จ:', error);
            showToast('โหลดประชาสัมพันธ์ไม่สำเร็จ', true);
        });
}

function getFilteredNewsItems() {
    const searchInput = document.getElementById('news-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let items = newsItems;
    if (query) {
        items = items.filter((item) => {
            const text = `${item.title} ${NEWS_TAG_LABELS[item.tag] || item.tag}`.toLowerCase();
            return text.includes(query);
        });
    }
    return sortNewsItems(items);
}

function sortNewsItems(items) {
    const direction = newsSortDirection === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
        let valA = a[newsSortColumn];
        let valB = b[newsSortColumn];
        if (newsSortColumn === 'publishedAt') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        }
        if (newsSortColumn === 'tag') {
            valA = NEWS_TAG_LABELS[valA] || valA;
            valB = NEWS_TAG_LABELS[valB] || valB;
        }
        if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * direction;
        return String(valA).localeCompare(String(valB), 'th') * direction;
    });
}

function setNewsSort(column) {
    if (newsSortColumn === column) {
        newsSortDirection = newsSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        newsSortColumn = column;
        newsSortDirection = 'asc';
    }
    newsCurrentPage = 1;
    renderNewsTable();
}

function updateNewsSortIndicators() {
    NEWS_SORTABLE_COLUMNS.forEach((column) => {
        const icon = document.querySelector(`[data-sort-icon-news="${column}"]`);
        if (!icon) return;
        if (newsSortColumn !== column) {
            icon.classList.remove('active');
            icon.innerHTML = SORT_ICON_NEUTRAL;
        } else {
            icon.classList.add('active');
            icon.innerHTML = newsSortDirection === 'asc' ? SORT_ICON_ASC : SORT_ICON_DESC;
        }
    });
}

function renderNewsTable() {
    const tbody = document.getElementById('news-table-body');
    const empty = document.getElementById('news-empty');
    const noMatch = document.getElementById('news-no-match');
    if (!tbody || !empty) return;

    const filtered = getFilteredNewsItems();
    const totalPages = Math.max(1, Math.ceil(filtered.length / NEWS_PAGE_SIZE));
    newsCurrentPage = Math.min(Math.max(1, newsCurrentPage), totalPages);
    const start = (newsCurrentPage - 1) * NEWS_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + NEWS_PAGE_SIZE);

    tbody.innerHTML = '';
    empty.classList.toggle('hidden', newsItems.length !== 0);
    if (noMatch) noMatch.classList.toggle('hidden', !(newsItems.length > 0 && filtered.length === 0));

    pageItems.forEach((item) => {
        const row = document.createElement('tr');
        const checked = newsSelectedIds.has(item.id);
        const isVisible = item.isVisible !== false;
        const publishedDate = new Date(item.publishedAt).toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
        row.innerHTML = `
            <td>
                <label class="admin-checkbox-wrap">
                    <input type="checkbox" class="admin-row-checkbox" ${checked ? 'checked' : ''}>
                    <span class="custom-checkbox"></span>
                </label>
            </td>
            <td class="admin-cell-title admin-cell-strong" title="${item.title}">${item.title}</td>
            <td><span class="admin-badge">${NEWS_TAG_LABELS[item.tag] || item.tag}</span></td>
            <td>${publishedDate}</td>
            <td>
                <label class="admin-toggle-switch small">
                    <input type="checkbox" class="admin-hot-toggle" ${item.isHot ? 'checked' : ''}>
                </label>
            </td>
            <td>
                <label class="admin-toggle-switch small">
                    <input type="checkbox" class="admin-visibility-toggle" ${isVisible ? 'checked' : ''}>
                </label>
            </td>
            <td>${adminActionButtonsHtml()}</td>
        `;
        row.querySelector('.admin-row-checkbox').addEventListener('change', (e) => toggleNewsRowSelect(item.id, e.target.checked));
        row.querySelector('.admin-hot-toggle').addEventListener('change', (e) => toggleNewsHot(item, e.target.checked));
        row.querySelector('.admin-visibility-toggle').addEventListener('change', (e) => toggleNewsVisibility(item, e.target.checked));
        row.querySelector('[data-action="edit"]').addEventListener('click', () => openNewsForm(item));
        row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteNewsItem(item));
        tbody.appendChild(row);
    });

    updateNewsPagination(filtered.length, totalPages);
    updateNewsBulkBar();
    updateNewsSelectAllState(pageItems);
    updateNewsSortIndicators();
}

function toggleNewsRowSelect(id, checked) {
    if (checked) newsSelectedIds.add(id);
    else newsSelectedIds.delete(id);
    updateNewsBulkBar();
    updateNewsSelectAllState();
}

function toggleNewsSelectAll(checked) {
    const filtered = getFilteredNewsItems();
    const start = (newsCurrentPage - 1) * NEWS_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + NEWS_PAGE_SIZE);
    pageItems.forEach((item) => {
        if (checked) newsSelectedIds.add(item.id);
        else newsSelectedIds.delete(item.id);
    });
    renderNewsTable();
}

function updateNewsSelectAllState(currentPageItems) {
    const selectAll = document.getElementById('news-select-all');
    if (!selectAll) return;

    let pageItems = currentPageItems;
    if (!pageItems) {
        const filtered = getFilteredNewsItems();
        const start = (newsCurrentPage - 1) * NEWS_PAGE_SIZE;
        pageItems = filtered.slice(start, start + NEWS_PAGE_SIZE);
    }
    selectAll.checked = pageItems.length > 0 && pageItems.every((item) => newsSelectedIds.has(item.id));
}

function updateNewsBulkBar() {
    const btn = document.getElementById('news-bulk-delete-btn');
    const countEl = document.getElementById('news-selected-count');
    const n = newsSelectedIds.size;

    if (btn) btn.disabled = n === 0;
    if (countEl) {
        countEl.textContent = `เลือกแล้ว ${n} รายการ`;
        countEl.classList.toggle('hidden', n === 0);
    }
}

async function bulkDeleteNewsItems() {
    const ids = Array.from(newsSelectedIds);
    if (ids.length === 0) return;
    const confirmed = await adminConfirm(`ลบประชาสัมพันธ์ที่เลือกไว้ ${ids.length} รายการ ใช่หรือไม่?`);
    if (!confirmed) return;

    Promise.all(ids.map((id) => fetch(`/api/news/${id}`, { method: 'DELETE' })))
        .then((results) => {
            const failedCount = results.filter((res) => !res.ok && res.status !== 204).length;
            showToast(
                failedCount > 0 ? `ลบสำเร็จบางส่วน (ล้มเหลว ${failedCount} รายการ)` : 'ลบประชาสัมพันธ์ที่เลือกสำเร็จ',
                failedCount > 0
            );
            loadNews();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบประชาสัมพันธ์ที่เลือกไม่สำเร็จ', true);
        });
}

function updateNewsPagination(filteredCount, totalPages) {
    const pagination = document.getElementById('news-pagination');
    const prevBtn = document.getElementById('news-prev-btn');
    const nextBtn = document.getElementById('news-next-btn');
    if (!pagination || !prevBtn || !nextBtn) return;

    pagination.classList.toggle('hidden', filteredCount <= NEWS_PAGE_SIZE);
    prevBtn.disabled = newsCurrentPage <= 1;
    nextBtn.disabled = newsCurrentPage >= totalPages;
    renderNewsPageNumbers(totalPages);
}

function renderNewsPageNumbers(totalPages) {
    const container = document.getElementById('news-page-numbers');
    if (!container) return;

    container.innerHTML = '';
    getPaginationRange(newsCurrentPage, totalPages).forEach((page) => {
        if (page === '...') {
            const span = document.createElement('span');
            span.className = 'admin-page-ellipsis';
            span.textContent = '...';
            container.appendChild(span);
            return;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-page-number-btn';
        btn.textContent = page;
        btn.classList.toggle('active', page === newsCurrentPage);
        btn.addEventListener('click', () => goToNewsPage(page));
        container.appendChild(btn);
    });
}

function goToNewsPage(page) {
    newsCurrentPage = page;
    renderNewsTable();
}

function changeNewsPage(delta) {
    newsCurrentPage += delta;
    renderNewsTable();
}

function toggleNewsVisibility(item, isVisible) {
    fetch(`/api/news/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(() => {
            showToast(
                isVisible ? `เปิดแสดงผลประชาสัมพันธ์ "${item.title}" แล้ว` : `ซ่อนประชาสัมพันธ์ "${item.title}" จากหน้าเว็บแล้ว`,
                false,
                { onUndo: () => toggleNewsVisibility(item, !isVisible) }
            );
            loadNews();
        })
        .catch((error) => {
            console.error(error);
            showToast('อัปเดตสถานะไม่สำเร็จ', true);
            loadNews();
        });
}

function toggleNewsHot(item, isHot) {
    fetch(`/api/news/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHot }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(() => {
            showToast(
                isHot ? `ตั้งประชาสัมพันธ์ "${item.title}" เป็นสำคัญแล้ว` : `ยกเลิกประกาศเด่น "${item.title}" แล้ว`,
                false,
                { onUndo: () => toggleNewsHot(item, !isHot) }
            );
            loadNews();
        })
        .catch((error) => {
            console.error(error);
            showToast('อัปเดตสถานะไม่สำเร็จ', true);
            loadNews();
        });
}

function toDateInputValue(isoDate) {
    const date = new Date(isoDate);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
}

// เอดิเตอร์รายละเอียดข่าวเป็น contenteditable แทน textarea ธรรมดา ให้พี่ค่ายกดปุ่มจัดรูปแบบ (ตัวหนา/ตัวเอียง/รายการ) และกด Enter ขึ้นบรรทัดใหม่ได้เลย
// โดยไม่ต้องพิมพ์แท็ก HTML เอง แต่ยังคงเก็บ/แสดงผลเป็น HTML เหมือนเดิม (ใช้ execCommand ซึ่งรองรับใน Chrome/Edge ที่ทีมงานใช้งานจริง)
function initRichTextToolbar() {
    document.querySelectorAll('.admin-richtext-btn').forEach((btn) => {
        btn.addEventListener('mousedown', (event) => event.preventDefault());
        btn.addEventListener('click', () => {
            document.execCommand(btn.dataset.richtextCmd, false, null);
            updateRichTextToolbarState();
        });
    });
    document.addEventListener('selectionchange', updateRichTextToolbarState);

    // execCommand('defaultParagraphSeparator', 'br') ไม่เสถียรพอในทุกเบราว์เซอร์ จึงสั่งแทรก <br> เองตอนกด Enter แทนที่จะปล่อยให้ห่อ <div> ใหม่ทุกครั้ง
    // ใช้ execCommand('insertLineBreak') แทนการแทรก <br> ด้วย Range เอง เพราะ Range แบบ manual วางตำแหน่งเคอร์เซอร์หลัง <br> ท้ายสุดไม่ได้ (พิมพ์ต่อแล้วอักษรไปแทรกก่อน <br> แทน)
    const detailEl = document.getElementById('news-detail');
    if (detailEl) {
        detailEl.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            document.execCommand('insertLineBreak');
        });
    }
}

function updateRichTextToolbarState() {
    if (document.activeElement?.id !== 'news-detail') return;
    document.querySelectorAll('.admin-richtext-btn').forEach((btn) => {
        try {
            btn.classList.toggle('active', document.queryCommandState(btn.dataset.richtextCmd));
        } catch (error) {
            // บางคำสั่ง (เช่นตอนยังไม่ได้ focus) เรียก queryCommandState ไม่ได้ ข้ามไปเฉย ๆ
        }
    });
}

let newsOriginalImageUrl = '';

function openNewsForm(item) {
    const form = document.getElementById('news-form');
    const error = document.getElementById('news-form-error');
    form.reset();
    error.classList.add('hidden');

    document.getElementById('news-modal-title').textContent = item ? 'แก้ไขประชาสัมพันธ์' : 'เพิ่มประชาสัมพันธ์';
    document.getElementById('news-id').value = item ? item.id : '';
    document.getElementById('news-tag').value = item ? item.tag : 'ANNOUNCE';
    document.getElementById('news-publishedAt').value = item ? toDateInputValue(item.publishedAt) : toDateInputValue(new Date());
    document.getElementById('news-title').value = item ? item.title : '';
    document.getElementById('news-summary').value = item ? item.summary : '';
    document.getElementById('news-detail').innerHTML = item ? item.detail : '';
    document.getElementById('news-imageUrl').value = item && item.imageUrl ? item.imageUrl : '';
    document.getElementById('news-isHot').checked = item ? Boolean(item.isHot) : false;
    document.getElementById('news-isVisible').checked = item ? item.isVisible !== false : true;

    newsOriginalImageUrl = item && item.imageUrl ? item.imageUrl : '';

    document.getElementById('news-modal').classList.remove('hidden');
}

function closeNewsForm() {
    document.getElementById('news-modal').classList.add('hidden');
}

// อัปโหลดรูปภาพประกอบข่าวโดยตรง (ไม่ครอบตัด เพราะแสดงผลด้วย object-fit: cover เสมออยู่แล้ว) แล้วเอา URL ที่ได้ไปใส่ในช่อง news-imageUrl ให้อัตโนมัติ
function uploadNewsImage(event) {
    const fileInput = event.target;
    const file = fileInput.files[0];
    if (!file) return;

    const status = document.getElementById('news-imageUrl-status');
    if (status) {
        status.textContent = 'กำลังอัปโหลด...';
        status.classList.remove('hidden');
    }

    const formData = new FormData();
    formData.append('file', file, file.name || 'upload.jpg');

    fetch('/api/news/upload', { method: 'POST', body: formData })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(({ url }) => {
            document.getElementById('news-imageUrl').value = url;
            if (status) status.classList.add('hidden');
        })
        .catch((error) => {
            if (status) {
                status.textContent = `อัปโหลดไม่สำเร็จ: ${error.message}`;
                status.classList.remove('hidden');
            }
        })
        .finally(() => {
            fileInput.value = '';
        });
}

// ลบไฟล์รูปเก่าทิ้งจากเซิร์ฟเวอร์ (ไม่ลบถ้า URL เป็นค่าเดิมที่ไม่เปลี่ยน หรือไม่ได้เป็นไฟล์ที่อัปโหลดไว้ในระบบเรา - ฝั่ง backend กันรูปตั้งต้น news.jpg ไม่ให้ถูกลบไว้แล้วด้วย)
function deleteOldNewsFileIfChanged(oldUrl, newUrl) {
    if (!oldUrl || oldUrl === newUrl) return;
    fetch('/api/news/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: oldUrl }),
    }).catch((error) => console.error('ลบไฟล์รูปเก่าไม่สำเร็จ:', error));
}

function submitNewsForm(event) {
    event.preventDefault();

    const id = document.getElementById('news-id').value;
    const errorBox = document.getElementById('news-form-error');
    errorBox.classList.add('hidden');

    // รายละเอียดข่าวไม่บังคับกรอก เพราะบางข่าวมีเนื้อหาอยู่ในรูปภาพประกอบทั้งหมดอยู่แล้ว
    const detailEl = document.getElementById('news-detail');

    const payload = {
        tag: document.getElementById('news-tag').value,
        publishedAt: document.getElementById('news-publishedAt').value,
        title: document.getElementById('news-title').value.trim(),
        summary: document.getElementById('news-summary').value.trim(),
        detail: detailEl.innerHTML.trim(),
        imageUrl: document.getElementById('news-imageUrl').value.trim(),
        isHot: document.getElementById('news-isHot').checked,
        isVisible: document.getElementById('news-isVisible').checked,
    };

    const url = id ? `/api/news/${id}` : '/api/news';
    const method = id ? 'PUT' : 'POST';
    const submitBtn = event.target.querySelector('button[type="submit"]');
    Loader.setButtonLoading(submitBtn, 'กำลังบันทึก...');

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            deleteOldNewsFileIfChanged(newsOriginalImageUrl, payload.imageUrl);
            closeNewsForm();
            showToast(id ? 'แก้ไขประชาสัมพันธ์สำเร็จ' : 'เพิ่มประชาสัมพันธ์สำเร็จ');
            loadNews();
        })
        .catch((error) => {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
        })
        .finally(() => {
            Loader.clearButtonLoading(submitBtn);
        });
}

async function deleteNewsItem(item) {
    const confirmed = await adminConfirm(`ลบประชาสัมพันธ์ "${item.title}" ใช่หรือไม่?`);
    if (!confirmed) return;

    fetch(`/api/news/${item.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showToast('ลบประชาสัมพันธ์สำเร็จ');
            loadNews();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบประชาสัมพันธ์ไม่สำเร็จ', true);
        });
}

// ==========================================
// กำหนดการ (Schedule)
// ==========================================
const SCHEDULE_PAGE_SIZE = 20;
const SCHEDULE_SORTABLE_COLUMNS = ['eventDate', 'title'];
const SCHEDULE_BADGE_CLASS = {
    EMERALD: 'admin-badge-create',
    ROSE: 'admin-badge-delete',
    BRAND: '',
    INDIGO: 'admin-badge-update',
};
let scheduleItems = [];
let scheduleCurrentPage = 1;
let scheduleSelectedIds = new Set();
let scheduleSortColumn = 'eventDate';
let scheduleSortDirection = 'asc';

function loadSchedules() {
    Loader.renderSkeletonTableRows(document.getElementById('schedule-table-body'), 5, 4);
    fetch('/api/schedules')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            scheduleItems = items;
            scheduleCurrentPage = 1;
            scheduleSelectedIds.clear();
            renderScheduleTable();
        })
        .catch((error) => {
            console.error('โหลดกำหนดการไม่สำเร็จ:', error);
            showToast('โหลดกำหนดการไม่สำเร็จ', true);
        });
}

function getFilteredScheduleItems() {
    const searchInput = document.getElementById('schedule-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let items = scheduleItems;
    if (query) {
        items = items.filter((item) => {
            const text = `${item.title} ${item.badgeLabel} ${item.dateText}`.toLowerCase();
            return text.includes(query);
        });
    }
    return sortScheduleItems(items);
}

function sortScheduleItems(items) {
    const direction = scheduleSortDirection === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
        let valA = a[scheduleSortColumn];
        let valB = b[scheduleSortColumn];
        if (scheduleSortColumn === 'eventDate') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        }
        if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * direction;
        return String(valA).localeCompare(String(valB), 'th') * direction;
    });
}

function setScheduleSort(column) {
    if (scheduleSortColumn === column) {
        scheduleSortDirection = scheduleSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        scheduleSortColumn = column;
        scheduleSortDirection = 'asc';
    }
    scheduleCurrentPage = 1;
    renderScheduleTable();
}

function updateScheduleSortIndicators() {
    SCHEDULE_SORTABLE_COLUMNS.forEach((column) => {
        const icon = document.querySelector(`[data-sort-icon-schedule="${column}"]`);
        if (!icon) return;
        if (scheduleSortColumn !== column) {
            icon.classList.remove('active');
            icon.innerHTML = SORT_ICON_NEUTRAL;
        } else {
            icon.classList.add('active');
            icon.innerHTML = scheduleSortDirection === 'asc' ? SORT_ICON_ASC : SORT_ICON_DESC;
        }
    });
}

function renderScheduleTable() {
    const tbody = document.getElementById('schedule-table-body');
    const empty = document.getElementById('schedule-empty');
    const noMatch = document.getElementById('schedule-no-match');
    if (!tbody || !empty) return;

    const filtered = getFilteredScheduleItems();
    const totalPages = Math.max(1, Math.ceil(filtered.length / SCHEDULE_PAGE_SIZE));
    scheduleCurrentPage = Math.min(Math.max(1, scheduleCurrentPage), totalPages);
    const start = (scheduleCurrentPage - 1) * SCHEDULE_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + SCHEDULE_PAGE_SIZE);

    tbody.innerHTML = '';
    empty.classList.toggle('hidden', scheduleItems.length !== 0);
    if (noMatch) noMatch.classList.toggle('hidden', !(scheduleItems.length > 0 && filtered.length === 0));

    pageItems.forEach((item) => {
        const row = document.createElement('tr');
        const checked = scheduleSelectedIds.has(item.id);
        const isVisible = item.isVisible !== false;
        const badgeClass = SCHEDULE_BADGE_CLASS[item.badgeColor] || '';
        row.innerHTML = `
            <td>
                <label class="admin-checkbox-wrap">
                    <input type="checkbox" class="admin-row-checkbox" ${checked ? 'checked' : ''}>
                    <span class="custom-checkbox"></span>
                </label>
            </td>
            <td class="admin-cell-strong">${item.dateText}</td>
            <td class="admin-cell-title" title="${item.title}">${item.title}</td>
            <td><span class="admin-badge ${badgeClass}">${item.badgeLabel || '-'}</span></td>
            <td>
                <label class="admin-toggle-switch small">
                    <input type="checkbox" class="admin-visibility-toggle" ${isVisible ? 'checked' : ''}>
                </label>
            </td>
            <td>${adminActionButtonsHtml()}</td>
        `;
        row.querySelector('.admin-row-checkbox').addEventListener('change', (e) => toggleScheduleRowSelect(item.id, e.target.checked));
        row.querySelector('.admin-visibility-toggle').addEventListener('change', (e) => toggleScheduleVisibility(item, e.target.checked));
        row.querySelector('[data-action="edit"]').addEventListener('click', () => openScheduleForm(item));
        row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteScheduleItem(item));
        tbody.appendChild(row);
    });

    updateSchedulePagination(filtered.length, totalPages);
    updateScheduleBulkBar();
    updateScheduleSelectAllState(pageItems);
    updateScheduleSortIndicators();
}

function toggleScheduleRowSelect(id, checked) {
    if (checked) scheduleSelectedIds.add(id);
    else scheduleSelectedIds.delete(id);
    updateScheduleBulkBar();
    updateScheduleSelectAllState();
}

function toggleScheduleSelectAll(checked) {
    const filtered = getFilteredScheduleItems();
    const start = (scheduleCurrentPage - 1) * SCHEDULE_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + SCHEDULE_PAGE_SIZE);
    pageItems.forEach((item) => {
        if (checked) scheduleSelectedIds.add(item.id);
        else scheduleSelectedIds.delete(item.id);
    });
    renderScheduleTable();
}

function updateScheduleSelectAllState(currentPageItems) {
    const selectAll = document.getElementById('schedule-select-all');
    if (!selectAll) return;

    let pageItems = currentPageItems;
    if (!pageItems) {
        const filtered = getFilteredScheduleItems();
        const start = (scheduleCurrentPage - 1) * SCHEDULE_PAGE_SIZE;
        pageItems = filtered.slice(start, start + SCHEDULE_PAGE_SIZE);
    }
    selectAll.checked = pageItems.length > 0 && pageItems.every((item) => scheduleSelectedIds.has(item.id));
}

function updateScheduleBulkBar() {
    const btn = document.getElementById('schedule-bulk-delete-btn');
    const countEl = document.getElementById('schedule-selected-count');
    const n = scheduleSelectedIds.size;

    if (btn) btn.disabled = n === 0;
    if (countEl) {
        countEl.textContent = `เลือกแล้ว ${n} รายการ`;
        countEl.classList.toggle('hidden', n === 0);
    }
}

async function bulkDeleteSchedules() {
    const ids = Array.from(scheduleSelectedIds);
    if (ids.length === 0) return;
    const confirmed = await adminConfirm(`ลบกำหนดการที่เลือกไว้ ${ids.length} รายการ ใช่หรือไม่?`);
    if (!confirmed) return;

    Promise.all(ids.map((id) => fetch(`/api/schedules/${id}`, { method: 'DELETE' })))
        .then((results) => {
            const failedCount = results.filter((res) => !res.ok && res.status !== 204).length;
            showToast(
                failedCount > 0 ? `ลบสำเร็จบางส่วน (ล้มเหลว ${failedCount} รายการ)` : 'ลบกำหนดการที่เลือกสำเร็จ',
                failedCount > 0
            );
            loadSchedules();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบกำหนดการที่เลือกไม่สำเร็จ', true);
        });
}

function updateSchedulePagination(filteredCount, totalPages) {
    const pagination = document.getElementById('schedule-pagination');
    const prevBtn = document.getElementById('schedule-prev-btn');
    const nextBtn = document.getElementById('schedule-next-btn');
    if (!pagination || !prevBtn || !nextBtn) return;

    pagination.classList.toggle('hidden', filteredCount <= SCHEDULE_PAGE_SIZE);
    prevBtn.disabled = scheduleCurrentPage <= 1;
    nextBtn.disabled = scheduleCurrentPage >= totalPages;
    renderSchedulePageNumbers(totalPages);
}

function renderSchedulePageNumbers(totalPages) {
    const container = document.getElementById('schedule-page-numbers');
    if (!container) return;

    container.innerHTML = '';
    getPaginationRange(scheduleCurrentPage, totalPages).forEach((page) => {
        if (page === '...') {
            const span = document.createElement('span');
            span.className = 'admin-page-ellipsis';
            span.textContent = '...';
            container.appendChild(span);
            return;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-page-number-btn';
        btn.textContent = page;
        btn.classList.toggle('active', page === scheduleCurrentPage);
        btn.addEventListener('click', () => goToSchedulePage(page));
        container.appendChild(btn);
    });
}

function goToSchedulePage(page) {
    scheduleCurrentPage = page;
    renderScheduleTable();
}

function changeSchedulePage(delta) {
    scheduleCurrentPage += delta;
    renderScheduleTable();
}

function toggleScheduleVisibility(item, isVisible) {
    fetch(`/api/schedules/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(() => {
            showToast(
                isVisible ? `เปิดแสดงผลกำหนดการ "${item.title}" แล้ว` : `ซ่อนกำหนดการ "${item.title}" จากหน้าเว็บแล้ว`,
                false,
                { onUndo: () => toggleScheduleVisibility(item, !isVisible) }
            );
            loadSchedules();
        })
        .catch((error) => {
            console.error(error);
            showToast('อัปเดตสถานะไม่สำเร็จ', true);
            loadSchedules();
        });
}

// แปลงวันที่เริ่ม/สิ้นสุดเป็นข้อความไทยสำหรับช่อง "วันที่แสดงผล" อัตโนมัติ กันไม่ต้องพิมพ์เอง (ยังแก้ไขเพิ่มเติมทีหลังได้ตามปกติ)
// ต้องดึง วัน/เดือน/ปี พร้อมกันในการเรียกเดียว (formatToParts) เพราะถ้าขอปีเดี่ยว ๆ th-TH จะเติมคำว่า "พ.ศ." นำหน้าให้อัตโนมัติ
function formatThaiDateRange(startValue, endValue) {
    const start = new Date(`${startValue}T00:00:00`);
    const end = endValue ? new Date(`${endValue}T00:00:00`) : null;

    const partsOf = (d, monthStyle) => {
        const parts = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: monthStyle, year: 'numeric' }).formatToParts(d);
        const get = (type) => parts.find((p) => p.type === type)?.value || '';
        return { day: get('day'), month: get('month'), year: get('year') };
    };
    const dayOf = (d) => partsOf(d, 'short').day;
    const monthShortOf = (d) => partsOf(d, 'short').month;
    const monthLongOf = (d) => partsOf(d, 'long').month;
    const yearOf = (d) => partsOf(d, 'short').year;

    if (!end || end.getTime() === start.getTime()) {
        return {
            short: `${dayOf(start)} ${monthShortOf(start)} ${yearOf(start)}`,
            full: `${dayOf(start)} ${monthLongOf(start)} ${yearOf(start)}`,
        };
    }

    const sameYear = yearOf(start) === yearOf(end);
    const sameMonth = sameYear && start.getMonth() === end.getMonth();

    if (sameMonth) {
        return {
            short: `${dayOf(start)}-${dayOf(end)} ${monthShortOf(end)} ${yearOf(end)}`,
            full: `${dayOf(start)}-${dayOf(end)} ${monthLongOf(end)} ${yearOf(end)}`,
        };
    }
    if (sameYear) {
        return {
            short: `${dayOf(start)} ${monthShortOf(start)} - ${dayOf(end)} ${monthShortOf(end)} ${yearOf(end)}`,
            full: `${dayOf(start)} ${monthLongOf(start)} - ${dayOf(end)} ${monthLongOf(end)} ${yearOf(end)}`,
        };
    }
    return {
        short: `${dayOf(start)} ${monthShortOf(start)} ${yearOf(start)} - ${dayOf(end)} ${monthShortOf(end)} ${yearOf(end)}`,
        full: `${dayOf(start)} ${monthLongOf(start)} ${yearOf(start)} - ${dayOf(end)} ${monthLongOf(end)} ${yearOf(end)}`,
    };
}

function autoFillScheduleDateText() {
    const startValue = document.getElementById('schedule-eventDate').value;
    if (!startValue) return;
    const endValue = document.getElementById('schedule-endDate').value;
    const { short, full } = formatThaiDateRange(startValue, endValue);
    document.getElementById('schedule-dateText').value = short;
    document.getElementById('schedule-mobileDate').value = full;
}

function openScheduleForm(item) {
    const form = document.getElementById('schedule-form');
    const error = document.getElementById('schedule-form-error');
    form.reset();
    error.classList.add('hidden');

    document.getElementById('schedule-modal-title').textContent = item ? 'แก้ไขกำหนดการ' : 'เพิ่มกำหนดการ';
    document.getElementById('schedule-id').value = item ? item.id : '';
    document.getElementById('schedule-eventDate').value = item ? toDateInputValue(item.eventDate) : toDateInputValue(new Date());
    document.getElementById('schedule-badgeColor').value = item ? item.badgeColor : 'BRAND';
    document.getElementById('schedule-dateText').value = item ? item.dateText : '';
    document.getElementById('schedule-mobileDate').value = item && item.mobileDate ? item.mobileDate : '';
    document.getElementById('schedule-badgeLabel').value = item && item.badgeLabel ? item.badgeLabel : '';
    document.getElementById('schedule-title').value = item ? item.title : '';
    document.getElementById('schedule-description').value = item ? item.description : '';
    document.getElementById('schedule-isVisible').checked = item ? item.isVisible !== false : true;

    document.getElementById('schedule-modal').classList.remove('hidden');
}

function closeScheduleForm() {
    document.getElementById('schedule-modal').classList.add('hidden');
}

function submitScheduleForm(event) {
    event.preventDefault();

    const id = document.getElementById('schedule-id').value;
    const payload = {
        eventDate: document.getElementById('schedule-eventDate').value,
        badgeColor: document.getElementById('schedule-badgeColor').value,
        dateText: document.getElementById('schedule-dateText').value.trim(),
        mobileDate: document.getElementById('schedule-mobileDate').value.trim(),
        badgeLabel: document.getElementById('schedule-badgeLabel').value.trim(),
        title: document.getElementById('schedule-title').value.trim(),
        description: document.getElementById('schedule-description').value.trim(),
        isVisible: document.getElementById('schedule-isVisible').checked,
    };

    const url = id ? `/api/schedules/${id}` : '/api/schedules';
    const method = id ? 'PUT' : 'POST';
    const errorBox = document.getElementById('schedule-form-error');
    errorBox.classList.add('hidden');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    Loader.setButtonLoading(submitBtn, 'กำลังบันทึก...');

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            closeScheduleForm();
            showToast(id ? 'แก้ไขกำหนดการสำเร็จ' : 'เพิ่มกำหนดการสำเร็จ');
            loadSchedules();
        })
        .catch((error) => {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
        })
        .finally(() => {
            Loader.clearButtonLoading(submitBtn);
        });
}

async function deleteScheduleItem(item) {
    const confirmed = await adminConfirm(`ลบกำหนดการ "${item.title}" ใช่หรือไม่?`);
    if (!confirmed) return;

    fetch(`/api/schedules/${item.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showToast('ลบกำหนดการสำเร็จ');
            loadSchedules();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบกำหนดการไม่สำเร็จ', true);
        });
}

// ==========================================
// อนุมัติการลงทะเบียน (Approve Registration) - ก๊อปมาจาก webmanager.js (endpoint/สิทธิ์เดียวกัน requireAdminAccess อยู่แล้ว)
// ==========================================
const APPROVAL_STATUS_BADGE = {
    PENDING: '<span class="admin-badge admin-badge-pending">รออนุมัติ</span>',
    REJECTED: '<span class="admin-badge admin-badge-delete">ถูกปฏิเสธ</span>',
};

function loadApprovalQueue(role) {
    Loader.renderSkeletonTableRows(document.getElementById(`approval-table-body-${role}`), 5, 3);
    fetch(`/api/users?role=${role}`)
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            // แสดงทั้งที่รออนุมัติและที่เคยถูกปฏิเสธ (เผื่อกลับมาอนุมัติซ้ำภายหลัง) ไม่แสดงบัญชีที่อนุมัติแล้ว
            const pendingItems = items.filter((item) => item.approvalStatus !== 'APPROVED');
            renderApprovalTable(role, pendingItems);
        })
        .catch((error) => {
            console.error(`โหลดคำขอลงทะเบียน (${role}) ไม่สำเร็จ:`, error);
            showToast('โหลดคำขอลงทะเบียนไม่สำเร็จ', true);
        });
}

function renderApprovalTable(role, items) {
    const tbody = document.getElementById(`approval-table-body-${role}`);
    const empty = document.getElementById(`approval-empty-${role}`);
    if (!tbody || !empty) return;

    tbody.innerHTML = '';
    empty.classList.toggle('hidden', items.length !== 0);

    items.forEach((item) => {
        const fullName = [item.prefix, item.firstName, item.lastName].filter(Boolean).join(' ') || '-';
        const createdDate = new Date(item.createdAt).toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
        // ลบได้เฉพาะรายการที่ถูกปฏิเสธแล้วเท่านั้น (กันลบคำขอที่ยังไม่ได้ตัดสินใจโดยไม่ตั้งใจ) ลบแล้วอีเมลนี้จะสมัครใหม่ได้อีกครั้ง
        const deleteBtnHtml = item.approvalStatus === 'REJECTED'
            ? '<button type="button" class="admin-delete-btn">ลบ</button>'
            : '';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="admin-cell-strong">${fullName}${item.nickname ? ` (${item.nickname})` : ''}</td>
            <td>${item.email}</td>
            <td>${createdDate}</td>
            <td>${APPROVAL_STATUS_BADGE[item.approvalStatus] || ''}</td>
            <td>
                <div class="admin-row-actions">
                    <button type="button" class="btn-outline admin-detail-btn" style="padding: 0.4rem 0.75rem; font-size: 0.78rem;">ดูรายละเอียด</button>
                    <button type="button" class="admin-approve-btn">อนุมัติ</button>
                    <button type="button" class="admin-reject-btn">ปฏิเสธ</button>
                    ${deleteBtnHtml}
                </div>
            </td>
        `;
        row.querySelector('.admin-detail-btn').addEventListener('click', () => openApprovalDetail(item, role));
        row.querySelector('.admin-approve-btn').addEventListener('click', () => setApprovalStatus(item, role, 'APPROVED'));
        row.querySelector('.admin-reject-btn').addEventListener('click', () => setApprovalStatus(item, role, 'REJECTED'));
        row.querySelector('.admin-delete-btn')?.addEventListener('click', () => deleteApprovalItem(item, role));
        tbody.appendChild(row);
    });
}

// สวิตช์นี้โผล่จุดเดียว (ต่างจากของ WebManager ที่โผล่ 2 จุด) แต่ยังใช้ data-attribute เหมือนเดิมเพื่อให้ตรงกับ markup ที่ก๊อปมา
function applyRegistrationToggleState(role, isOpen) {
    document.querySelectorAll(`[data-registration-toggle="${role}"]`).forEach((toggle) => { toggle.checked = isOpen; });
    document.querySelectorAll(`[data-registration-status-dot="${role}"]`).forEach((dot) => { dot.classList.toggle('closed', !isOpen); });
}

function submitRegistrationOpen(role, checked) {
    const field = role === 'staff' ? 'staffRegistrationOpen' : 'participantRegistrationOpen';
    const label = role === 'staff' ? 'ลงทะเบียนพี่ค่าย' : 'ลงทะเบียนน้องค่าย';

    fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: checked }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            applyRegistrationToggleState(role, checked);
            showToast(checked ? `เปิดรับ${label}แล้ว` : `ปิดรับ${label}แล้ว`);
        })
        .catch((error) => {
            showToast(error.message, true);
            loadRegistrationSettings(); // ย้อนสวิตช์กลับตามค่าจริงในฐานข้อมูลถ้าบันทึกไม่สำเร็จ
        });
}

function applyAutoApproveToggleState(role, isAuto) {
    const toggle = document.getElementById(`${role}-auto-approve-toggle`);
    const dot = document.getElementById(`${role}-auto-approve-status-dot`);
    if (toggle) toggle.checked = isAuto;
    if (dot) dot.classList.toggle('closed', !isAuto);
}

const AUTO_APPROVE_FIELD_BY_ROLE = { staff: 'staffAutoApprove', participant: 'participantAutoApprove' };
const AUTO_APPROVE_LABEL_BY_ROLE = { staff: 'พี่ค่าย', participant: 'น้องค่าย' };

function submitAutoApprove(role, checked) {
    const field = AUTO_APPROVE_FIELD_BY_ROLE[role];
    const label = AUTO_APPROVE_LABEL_BY_ROLE[role];

    fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: checked }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            applyAutoApproveToggleState(role, checked);
            showToast(checked ? `เปิดอนุมัติ${label}อัตโนมัติแล้ว` : `ปิดอนุมัติ${label}อัตโนมัติแล้ว`);
        })
        .catch((error) => {
            showToast(error.message, true);
            loadRegistrationSettings();
        });
}

function applyCheckRegistrationToggleState(role, isVisible) {
    const toggle = document.getElementById(`check-registration-visible-toggle-${role}`);
    if (toggle) toggle.checked = isVisible;
}

function submitCheckRegistrationVisible(role, checked) {
    const field = role === 'staff' ? 'checkRegistrationVisibleStaff' : 'checkRegistrationVisibleParticipant';
    const label = role === 'staff' ? 'พี่ค่าย' : 'น้องค่าย';

    fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: checked }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            showToast(checked ? `แสดงแท็บ "${label}" ในหน้าตรวจสอบผลการลงทะเบียนแล้ว` : `ซ่อนแท็บ "${label}" ในหน้าตรวจสอบผลการลงทะเบียนแล้ว`);
        })
        .catch((error) => {
            showToast(error.message, true);
            loadRegistrationSettings();
        });
}

// โหลดสถานะสวิตช์ทั้งหมดของหน้า "การลงทะเบียน" จาก /api/site-settings จุดเดียว (เทียบเท่า loadHeroCardSetting ฝั่ง WebManager แต่ตัดส่วนที่ไม่มีในหน้านี้ออก)
function loadRegistrationSettings() {
    fetch('/api/site-settings')
        .then((res) => (res.ok ? res.json() : { staffRegistrationOpen: true, participantRegistrationOpen: true }))
        .then((settings) => {
            applyRegistrationToggleState('staff', settings.staffRegistrationOpen !== false);
            // ต้องมีค่ายที่กำลังดำเนินการอยู่จริงด้วยเสมอ ไม่งั้นโชว์เป็น "เปิด" หลอกตา ทั้งที่จริงปิดรับอยู่ (ฝั่ง server บล็อกแล้ว แค่แสดงผลให้ตรงกัน)
            applyRegistrationToggleState('participant', settings.participantRegistrationOpen !== false && !!settings.campActive);
            applyAutoApproveToggleState('staff', !!settings.staffAutoApprove);
            applyAutoApproveToggleState('participant', !!settings.participantAutoApprove);
            applyCheckRegistrationToggleState('staff', settings.checkRegistrationVisibleStaff !== false);
            applyCheckRegistrationToggleState('participant', settings.checkRegistrationVisibleParticipant !== false);
        })
        .catch((error) => console.error('โหลดการตั้งค่าการลงทะเบียนไม่สำเร็จ:', error));
}

// เปิดดูรายละเอียดการลงทะเบียนทั้งหมด (ยกเว้นอีเมล-ซึ่งอยู่ในตารางอยู่แล้ว-และรหัสผ่านที่ไม่มีส่งมาให้อยู่แล้ว) ก่อนตัดสินใจอนุมัติ/ปฏิเสธ
function openApprovalDetail(item, role) {
    const grid = document.getElementById('approval-detail-grid');
    if (!grid) return;

    const fullName = [item.prefix, item.firstName, item.lastName].filter(Boolean).join(' ') || '-';
    const birthDate = item.birthDate
        ? new Date(item.birthDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';
    const createdDate = new Date(item.createdAt).toLocaleDateString('th-TH', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const commonFields = [
        ['ชื่อ-นามสกุล', fullName],
        ['ชื่อเล่น', item.nickname || '-'],
        ['วันเกิด', birthDate],
        ['เบอร์โทรศัพท์', item.phone || '-'],
    ];

    const roleFields = role === 'STAFF'
        ? [
            ['คำนำหน้าทางวิชาการ', item.academicTitle || '-'],
            ['ฝ่ายงานที่สนใจ', item.department?.name || '-'],
            ['สถาบัน/สังกัด', item.affiliation || '-'],
            ['อาชีพ', item.occupation || '-'],
        ]
        : [
            ['เบอร์โทรผู้ปกครอง', item.parentPhone || '-'],
            ['รูปแบบคอร์สเรียน', item.courseFormat?.name || '-'],
            ['แผนการเรียน', formatStudyPlanLabel(item)],
            ['กลุ่มวิชาที่สนใจ', formatInterestSubjectGroupLabel(item)],
            ['สถาบัน/คณะในฝัน', item.dreamInstitution || '-'],
        ];

    const allFields = [...commonFields, ...roleFields, ['สมัครเมื่อ', createdDate]];

    grid.innerHTML = allFields
        .map(([label, value]) => `
            <div class="approval-detail-item">
                <span class="approval-detail-label">${label}</span>
                <span class="approval-detail-value">${value}</span>
            </div>
        `)
        .join('');

    const approveBtn = document.getElementById('approval-detail-approve-btn');
    const rejectBtn = document.getElementById('approval-detail-reject-btn');
    const deleteBtn = document.getElementById('approval-detail-delete-btn');
    approveBtn.onclick = () => { closeApprovalDetail(); setApprovalStatus(item, role, 'APPROVED'); };
    rejectBtn.onclick = () => { closeApprovalDetail(); setApprovalStatus(item, role, 'REJECTED'); };
    deleteBtn.classList.toggle('hidden', item.approvalStatus !== 'REJECTED');
    deleteBtn.onclick = () => { closeApprovalDetail(); deleteApprovalItem(item, role); };

    document.getElementById('approval-detail-modal').classList.remove('hidden');
}

function closeApprovalDetail() {
    document.getElementById('approval-detail-modal').classList.add('hidden');
}

async function setApprovalStatus(item, role, approvalStatus) {
    const label = approvalStatus === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ';
    const confirmed = await adminConfirm(`${label}คำขอลงทะเบียนของ "${item.email}" ใช่หรือไม่?`, {
        title: `ยืนยันการ${label}`,
        confirmText: label,
    });
    if (!confirmed) return;

    fetch(`/api/users/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(`${label}คำขอลงทะเบียนสำเร็จ`);
            loadApprovalQueue(role);
        })
        .catch((error) => {
            console.error(error);
            showToast(`${label}คำขอลงทะเบียนไม่สำเร็จ`, true);
        });
}

// ลบคำขอที่ถูกปฏิเสธทิ้งถาวร (ต่างจากการปฏิเสธที่แค่เปลี่ยนสถานะ) ใช้เมื่อต้องการให้อีเมลนี้กลับไปสมัครใหม่ได้
async function deleteApprovalItem(item, role) {
    const confirmed = await adminConfirm(`ลบคำขอลงทะเบียนของ "${item.email}" ทิ้งถาวรใช่หรือไม่? อีเมลนี้จะสามารถสมัครใหม่ได้อีกครั้ง`);
    if (!confirmed) return;

    fetch(`/api/users/${item.id}`, { method: 'DELETE' })
        .then(async (res) => {
            if (!res.ok && res.status !== 204) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            showToast('ลบคำขอลงทะเบียนสำเร็จ');
            loadApprovalQueue(role);
        })
        .catch((error) => {
            console.error(error);
            showToast(error.message || 'ลบคำขอลงทะเบียนไม่สำเร็จ', true);
        });
}

// ==========================================
// จัดการผู้ใช้งาน (User)
// ==========================================
const USER_PAGE_SIZE = 20;
const USER_SORTABLE_COLUMNS = ['email', 'createdAt'];

const userState = { STAFF: [], PARTICIPANT: [] };
const userCurrentPage = { STAFF: 1, PARTICIPANT: 1 };
const userSelectedIds = { STAFF: new Set(), PARTICIPANT: new Set() };
const userSortColumn = { STAFF: 'createdAt', PARTICIPANT: 'createdAt' };
const userSortDirection = { STAFF: 'desc', PARTICIPANT: 'desc' };

function loadUsers(role) {
    Loader.renderSkeletonTableRows(document.getElementById(`user-table-body-${role}`), 5, 4);
    fetch(`/api/users?role=${role}`)
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            userState[role] = items;
            userCurrentPage[role] = 1;
            userSelectedIds[role].clear();
            renderUserTable(role);
        })
        .catch((error) => {
            console.error(`โหลดข้อมูลผู้ใช้งาน (${role}) ไม่สำเร็จ:`, error);
            showToast('โหลดข้อมูลผู้ใช้งานไม่สำเร็จ', true);
        });
}

function getFilteredUserItems(role) {
    const searchInput = document.getElementById(`user-search-${role}`);
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let items = userState[role] || [];
    if (query) {
        items = items.filter((item) => item.email.toLowerCase().includes(query));
    }
    return sortUserItems(role, items);
}

function sortUserItems(role, items) {
    const column = userSortColumn[role];
    const direction = userSortDirection[role] === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
        if (column === 'createdAt') return (new Date(a.createdAt) - new Date(b.createdAt)) * direction;
        return String(a[column]).localeCompare(String(b[column]), 'th') * direction;
    });
}

function setUserSort(role, column) {
    if (userSortColumn[role] === column) {
        userSortDirection[role] = userSortDirection[role] === 'asc' ? 'desc' : 'asc';
    } else {
        userSortColumn[role] = column;
        userSortDirection[role] = 'asc';
    }
    userCurrentPage[role] = 1;
    renderUserTable(role);
}

function updateUserSortIndicators(role) {
    USER_SORTABLE_COLUMNS.forEach((column) => {
        const icon = document.querySelector(`[data-sort-icon-user-${role}="${column}"]`);
        if (!icon) return;
        if (userSortColumn[role] !== column) {
            icon.classList.remove('active');
            icon.innerHTML = SORT_ICON_NEUTRAL;
        } else {
            icon.classList.add('active');
            icon.innerHTML = userSortDirection[role] === 'asc' ? SORT_ICON_ASC : SORT_ICON_DESC;
        }
    });
}

function renderUserTable(role) {
    const tbody = document.getElementById(`user-table-body-${role}`);
    const empty = document.getElementById(`user-empty-${role}`);
    const noMatch = document.getElementById(`user-no-match-${role}`);
    if (!tbody || !empty) return;

    const items = userState[role] || [];
    const filtered = getFilteredUserItems(role);
    const totalPages = Math.max(1, Math.ceil(filtered.length / USER_PAGE_SIZE));
    userCurrentPage[role] = Math.min(Math.max(1, userCurrentPage[role]), totalPages);
    const start = (userCurrentPage[role] - 1) * USER_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + USER_PAGE_SIZE);

    tbody.innerHTML = '';
    empty.classList.toggle('hidden', items.length !== 0);
    if (noMatch) noMatch.classList.toggle('hidden', !(items.length > 0 && filtered.length === 0));

    pageItems.forEach((item) => {
        const row = document.createElement('tr');
        const checked = userSelectedIds[role].has(item.id);
        const createdDate = new Date(item.createdAt).toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
        const adminBadgeCell = role === 'STAFF'
            ? `<td>${item.isAdmin ? '<span class="admin-bool-badge admin-bool-badge--yes">✓</span>' : '<span class="admin-bool-badge admin-bool-badge--no">✕</span>'}</td>`
            : '';
        row.innerHTML = `
            <td>
                <label class="admin-checkbox-wrap">
                    <input type="checkbox" class="admin-row-checkbox" ${checked ? 'checked' : ''}>
                    <span class="custom-checkbox"></span>
                </label>
            </td>
            <td class="admin-cell-strong">${item.email}</td>
            <td>${createdDate}</td>
            ${adminBadgeCell}
            <td>${adminActionButtonsHtml()}</td>
        `;
        row.querySelector('.admin-row-checkbox').addEventListener('change', (e) => toggleUserRowSelect(role, item.id, e.target.checked));
        row.querySelector('[data-action="edit"]').addEventListener('click', () => openUserForm(item, role));
        row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteUserItem(item, role));
        tbody.appendChild(row);
    });

    updateUserPagination(role, filtered.length, totalPages);
    updateUserBulkBar(role);
    updateUserSelectAllState(role, pageItems);
    updateUserSortIndicators(role);
}

function toggleUserRowSelect(role, id, checked) {
    if (checked) userSelectedIds[role].add(id);
    else userSelectedIds[role].delete(id);
    updateUserBulkBar(role);
    updateUserSelectAllState(role);
}

function toggleUserSelectAll(role, checked) {
    const filtered = getFilteredUserItems(role);
    const start = (userCurrentPage[role] - 1) * USER_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + USER_PAGE_SIZE);
    pageItems.forEach((item) => {
        if (checked) userSelectedIds[role].add(item.id);
        else userSelectedIds[role].delete(item.id);
    });
    renderUserTable(role);
}

function updateUserSelectAllState(role, currentPageItems) {
    const selectAll = document.getElementById(`user-select-all-${role}`);
    if (!selectAll) return;

    let pageItems = currentPageItems;
    if (!pageItems) {
        const filtered = getFilteredUserItems(role);
        const start = (userCurrentPage[role] - 1) * USER_PAGE_SIZE;
        pageItems = filtered.slice(start, start + USER_PAGE_SIZE);
    }
    selectAll.checked = pageItems.length > 0 && pageItems.every((item) => userSelectedIds[role].has(item.id));
}

function updateUserBulkBar(role) {
    const btn = document.getElementById(`user-bulk-delete-btn-${role}`);
    const countEl = document.getElementById(`user-selected-count-${role}`);
    const n = userSelectedIds[role].size;

    if (btn) btn.disabled = n === 0;
    if (countEl) {
        countEl.textContent = `เลือกแล้ว ${n} รายการ`;
        countEl.classList.toggle('hidden', n === 0);
    }
}

async function bulkDeleteUsers(role) {
    const ids = Array.from(userSelectedIds[role]);
    if (ids.length === 0) return;
    const confirmed = await adminConfirm(`ลบผู้ใช้งานที่เลือกไว้ ${ids.length} รายการ ใช่หรือไม่?`);
    if (!confirmed) return;

    Promise.all(ids.map((id) => fetch(`/api/users/${id}`, { method: 'DELETE' })))
        .then(async (results) => {
            const failedCount = results.filter((res) => !res.ok && res.status !== 204).length;
            showToast(
                failedCount > 0 ? `ลบสำเร็จบางส่วน (ล้มเหลว ${failedCount} รายการ)` : 'ลบผู้ใช้งานที่เลือกสำเร็จ',
                failedCount > 0
            );
            loadUsers(role);
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบผู้ใช้งานที่เลือกไม่สำเร็จ', true);
        });
}

function updateUserPagination(role, filteredCount, totalPages) {
    const pagination = document.getElementById(`user-pagination-${role}`);
    const prevBtn = document.getElementById(`user-prev-btn-${role}`);
    const nextBtn = document.getElementById(`user-next-btn-${role}`);
    if (!pagination || !prevBtn || !nextBtn) return;

    pagination.classList.toggle('hidden', filteredCount <= USER_PAGE_SIZE);
    prevBtn.disabled = userCurrentPage[role] <= 1;
    nextBtn.disabled = userCurrentPage[role] >= totalPages;
    renderUserPageNumbers(role, totalPages);
}

function renderUserPageNumbers(role, totalPages) {
    const container = document.getElementById(`user-page-numbers-${role}`);
    if (!container) return;

    container.innerHTML = '';
    getPaginationRange(userCurrentPage[role], totalPages).forEach((page) => {
        if (page === '...') {
            const span = document.createElement('span');
            span.className = 'admin-page-ellipsis';
            span.textContent = '...';
            container.appendChild(span);
            return;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-page-number-btn';
        btn.textContent = page;
        btn.classList.toggle('active', page === userCurrentPage[role]);
        btn.addEventListener('click', () => goToUserPage(role, page));
        container.appendChild(btn);
    });
}

function goToUserPage(role, page) {
    userCurrentPage[role] = page;
    renderUserTable(role);
}

function changeUserPage(role, delta) {
    userCurrentPage[role] += delta;
    renderUserTable(role);
}

function openUserForm(item, role) {
    const form = document.getElementById('user-form');
    const error = document.getElementById('user-form-error');
    form.reset();
    error.classList.add('hidden');

    document.getElementById('user-modal-title').textContent = item ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน';
    document.getElementById('user-id').value = item ? item.id : '';
    document.getElementById('user-current-role-tab').value = role;
    document.getElementById('user-email').value = item ? item.email : '';
    document.getElementById('user-role').value = item ? item.role : role;
    document.getElementById('user-role-group').classList.toggle('hidden', !!item);
    document.getElementById('user-password').value = '';
    document.getElementById('user-password').required = !item;
    document.getElementById('user-password').placeholder = item
        ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน'
        : 'อย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลข';

    document.getElementById('user-modal').classList.remove('hidden');
}

function closeUserForm() {
    document.getElementById('user-modal').classList.add('hidden');
}

function submitUserForm(event) {
    event.preventDefault();

    const id = document.getElementById('user-id').value;
    const currentRoleTab = document.getElementById('user-current-role-tab').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    const errorBox = document.getElementById('user-form-error');
    errorBox.classList.add('hidden');

    // ตอนแก้ไข เว้นว่างรหัสผ่านได้ (แปลว่าไม่เปลี่ยน) แต่ถ้าพิมพ์มาต้องผ่านเงื่อนไขเดียวกับหน้าอื่นเสมอ
    if (password && !checkPasswordStrength(password)) {
        errorBox.textContent = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวอักษรและตัวเลขอย่างละ 1 ตัวขึ้นไป';
        errorBox.classList.remove('hidden');
        return;
    }

    const payload = {
        email: document.getElementById('user-email').value.trim(),
        role,
    };
    if (password) payload.password = password;
    // Admin (พี่ค่ายที่ isAdmin) ไม่มีสิทธิ์มอบ/ถอดสิทธิ์ผู้ดูแลระบบ จึงไม่ส่ง isAdmin เลยจากแผงนี้ (ทำได้เฉพาะใน /webmanager)

    const url = id ? `/api/users/${id}` : '/api/users';
    const method = id ? 'PUT' : 'POST';
    const submitBtn = event.target.querySelector('button[type="submit"]');
    Loader.setButtonLoading(submitBtn, 'กำลังบันทึก...');

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            closeUserForm();
            showToast(id ? 'แก้ไขผู้ใช้งานสำเร็จ' : 'เพิ่มผู้ใช้งานสำเร็จ');
            loadUsers(currentRoleTab);
            if (payload.role !== currentRoleTab) loadUsers(payload.role);
        })
        .catch((error) => {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
        })
        .finally(() => {
            Loader.clearButtonLoading(submitBtn);
        });
}

async function deleteUserItem(item, role) {
    const confirmed = await adminConfirm(`ลบผู้ใช้งาน "${item.email}" ใช่หรือไม่?`);
    if (!confirmed) return;

    fetch(`/api/users/${item.id}`, { method: 'DELETE' })
        .then(async (res) => {
            if (!res.ok && res.status !== 204) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            showToast('ลบผู้ใช้งานสำเร็จ');
            loadUsers(role);
        })
        .catch((error) => {
            console.error(error);
            showToast(error.message || 'ลบผู้ใช้งานไม่สำเร็จ', true);
        });
}

// ==========================================
// ประวัติการดำเนินการ (Activity Log)
// แยกเป็น 2 กลุ่มตามผู้กระทำ: "ของ Admin" (WEBMANAGER/STAFF ซึ่งเป็นคนเดียวที่เข้าแผงจัดการเนื้อหาได้) และ "ของผู้ใช้" (PARTICIPANT)
// ==========================================
function loadActivityLogs(scope) {
    Loader.renderSkeletonTableRows(document.getElementById(`log-${scope}-table-body`), 4, 4);
    fetch(`/api/activity-logs?scope=${scope}`)
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => renderActivityLogTable(scope, items))
        .catch((error) => {
            console.error('โหลดประวัติการดำเนินการไม่สำเร็จ:', error);
            showToast('โหลดประวัติการดำเนินการไม่สำเร็จ', true);
        });
}

function renderActivityLogTable(scope, items) {
    const tbody = document.getElementById(`log-${scope}-table-body`);
    const empty = document.getElementById(`log-${scope}-empty`);
    if (!tbody || !empty) return;

    tbody.innerHTML = '';

    if (items.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    items.forEach((item) => {
        const row = document.createElement('tr');
        const action = ACTIVITY_ACTION_LABELS[item.action] || { text: item.action, className: '' };
        const entityLabel = ACTIVITY_ENTITY_LABELS[item.entityType] || item.entityType;
        const roleLabel = ACTIVITY_ROLE_LABELS[item.actorRole] || item.actorRole;
        const time = new Date(item.createdAt).toLocaleString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        row.innerHTML = `
            <td class="admin-cell-time">${time}</td>
            <td>
                <span class="admin-cell-actor">${item.actorEmail}</span>
                <span class="admin-cell-actor-role">${roleLabel}</span>
            </td>
            <td><span class="admin-badge ${action.className}">${action.text}</span></td>
            <td>${entityLabel}</td>
            <td class="admin-cell-summary">${escapeHtml(item.summary)}</td>
        `;
        tbody.appendChild(row);
    });
}

// ==========================================
// ค้นหาในตาราง (client-side filter)
// ==========================================
function setupAdminTableSearch({ inputId, tbodyId, noMatchId }) {
    const input = document.getElementById(inputId);
    const tbody = document.getElementById(tbodyId);
    const noMatch = noMatchId ? document.getElementById(noMatchId) : null;
    if (!input || !tbody) return;

    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        const rows = Array.from(tbody.querySelectorAll('tr'));
        let visibleCount = 0;

        rows.forEach((row) => {
            const match = !query || row.textContent.toLowerCase().includes(query);
            row.classList.toggle('hidden', !match);
            if (match) visibleCount += 1;
        });

        if (noMatch) noMatch.classList.toggle('hidden', rows.length === 0 || visibleCount > 0);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    document.getElementById('committee-form').addEventListener('submit', submitCommitteeForm);
    document.getElementById('news-form').addEventListener('submit', submitNewsForm);
    document.getElementById('schedule-form').addEventListener('submit', submitScheduleForm);
    document.getElementById('user-form').addEventListener('submit', submitUserForm);
    initRichTextToolbar();

    if (localStorage.getItem('adminSidebarCollapsed') === '1') {
        const sidebar = document.querySelector('.admin-shell-sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }

    if (sessionStorage.getItem('ptnJustLoggedIn') === '1') {
        sessionStorage.removeItem('ptnJustLoggedIn');
        showToast('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับกลับเข้าสู่ระบบ');
    }

    const adminUserLoaded = loadAdminUser();
    loadCommittees();
    loadNews();
    loadSchedules();
    loadUsers('STAFF');
    loadUsers('PARTICIPANT');
    loadRegistrationSettings();
    loadApprovalQueue('STAFF');
    loadApprovalQueue('PARTICIPANT');
    const dashboardLoaded = initAdminDashboard();
    checkAdminNotificationBadge();
    loadActivityLogs('admin');
    loadActivityLogs('user');

    const committeeSearchInput = document.getElementById('committee-search');
    if (committeeSearchInput) {
        committeeSearchInput.addEventListener('input', () => {
            committeeCurrentPage = 1;
            renderCommitteeTable();
        });
    }

    const newsSearchInput = document.getElementById('news-search');
    if (newsSearchInput) {
        newsSearchInput.addEventListener('input', () => {
            newsCurrentPage = 1;
            renderNewsTable();
        });
    }

    const scheduleSearchInput = document.getElementById('schedule-search');
    if (scheduleSearchInput) {
        scheduleSearchInput.addEventListener('input', () => {
            scheduleCurrentPage = 1;
            renderScheduleTable();
        });
    }

    ['STAFF', 'PARTICIPANT'].forEach((role) => {
        const input = document.getElementById(`user-search-${role}`);
        if (input) input.addEventListener('input', () => renderUserTable(role));
    });

    setupAdminTableSearch({ inputId: 'log-admin-search', tbodyId: 'log-admin-table-body', noMatchId: 'log-admin-no-match' });
    setupAdminTableSearch({ inputId: 'log-user-search', tbodyId: 'log-user-table-body', noMatchId: 'log-user-no-match' });

    // รอแค่ข้อมูลที่แดชบอร์ด (แท็บที่เห็นก่อนเสมอตอนเปิดเข้ามา) ใช้จริง ไม่รอครบทุกแท็บ/ทุกตาราง
    Promise.allSettled([adminUserLoaded, dashboardLoaded])
        .then(() => Loader.hideFullPageLoader());
});
