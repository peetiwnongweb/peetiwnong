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
        img.src = window.PTN_MEDIA_URL(avatarUrl);
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
            // ก๊อปลิงก์ /admin มาเปิดโดยไม่มีสิทธิ์ (น้องค่าย/พี่ค่ายที่ไม่ใช่ผู้ดูแลระบบ) = เด้งกลับหน้าแรก ตรงกับ requireAdminAccess ฝั่ง backend
            if (!isPrivilegedStaff && user.role !== 'WEBMANAGER') {
                window.location.replace('/');
                return;
            }
            const roleLabel = ACTIVITY_ROLE_LABELS[user.role] || user.role;

            // เหมือนหน้าพี่ค่าย/หน้าแรก: ถ้ามีชื่อ-นามสกุลและตำแหน่งในโปรไฟล์ ให้ขึ้นชื่อและตำแหน่งแทน email/role ตรง ๆ
            const fullName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null;
            const positionLabel = (user.position && user.position.name) || roleLabel;
            const subLabel = isPrivilegedStaff ? `${positionLabel} · ผู้ดูแลระบบ` : positionLabel;
            const nameLine = fullName || (user.role === 'WEBMANAGER' ? 'Owner' : user.email);
            const initial = nameLine.charAt(0).toUpperCase();

            const display = document.getElementById('admin-username-display');
            const avatar = document.getElementById('admin-avatar');
            // เหมือนหน้าอื่น (auth.js): บนแถบแสดงแค่ชื่อ ตำแหน่ง/สิทธิ์ดูได้ในเมนูบัญชีที่กดเปิด
            if (display) display.textContent = nameLine;
            renderAvatar(avatar, user.avatarUrl, initial);

            const menuAvatar = document.getElementById('admin-menu-avatar');
            const menuUsername = document.getElementById('admin-menu-username');
            const menuRole = document.getElementById('admin-menu-role');
            renderAvatar(menuAvatar, user.avatarUrl, initial);
            if (menuUsername) menuUsername.textContent = nameLine;
            if (menuRole) menuRole.textContent = subLabel;

            // ลิงก์ "โปรไฟล์" มีเฉพาะพี่ค่าย (Host ไม่มี StaffProfile)
            const profileLink = document.getElementById('admin-menu-profile-link');
            if (profileLink) profileLink.classList.toggle('hidden', user.role !== 'STAFF');

            applyAdminTaskMenuVisibility(user);
        })
        .catch(() => {
            window.location.href = '/';
        });
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

// ใช้ข้อมูลที่ loadActivityLogs('admin')/loadActivityLogs('user') โหลดมาอยู่แล้ว (เรียงจากใหม่สุดก่อนเสมอ) แทนการยิง /api/activity-logs แยกอีกรอบซ้ำซ้อน
// รายการล่าสุดของ 2 scope นี้รวมกัน = รายการล่าสุดจริงของทั้งระบบเสมอ (ฝั่ง backend ก็แบ่งแค่ 2 scope นี้เหมือนกัน)
function checkAdminNotificationBadge() {
    const latestAdmin = activityLogItemsCache.admin?.[0]?.createdAt;
    const latestUser = activityLogItemsCache.user?.[0]?.createdAt;
    const timestamps = [latestAdmin, latestUser].filter(Boolean).map((d) => new Date(d).getTime());
    if (timestamps.length === 0) return;
    const latest = Math.max(...timestamps);
    const lastSeen = Number(localStorage.getItem('adminNotifLastSeen') || 0);
    const dot = document.getElementById('admin-notif-dot');
    if (dot) dot.classList.toggle('hidden', lastSeen >= latest);
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

function toggleNewsSubnav() {
    const subnav = document.getElementById('news-subnav');
    const toggleBtn = document.getElementById('admin-tab-news-toggle');
    if (subnav && toggleBtn) {
        const isCollapsed = subnav.classList.toggle('collapsed');
        toggleBtn.classList.toggle('active', !isCollapsed);
        const caret = toggleBtn.querySelector('.admin-shell-nav-subcaret');
        if (caret) {
            caret.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }
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

// โหลดข้อมูลของแท็บแบบ lazy (ครั้งแรกที่สลับไปเปิดดูเท่านั้น) แทนที่จะยิงทุก endpoint พร้อมกันตอนเปิดหน้า Admin
// เหตุผล/แพทเทิร์นเดียวกับ webmanager.js (ดูคอมเมนต์ ADMIN_LAZY_LOADERS ในไฟล์นั้น) key เดียวกัน = ข้อมูลชุดเดียวกัน ใช้ร่วมกันได้หลายแท็บโดยยิงแค่ครั้งเดียว
const loadedAdminKeys = new Set();

const ADMIN_LAZY_LOADERS = {
    news: () => loadNews(),
    schedule: () => loadSchedules(),
    'approve-staff': () => loadUsers('STAFF'),
    'approve-participant': () => loadUsers('PARTICIPANT'),
    'approve-news': () => loadNews(),
    'staff-users': () => loadUsers('STAFF'),
    'participant-users': () => loadUsers('PARTICIPANT'),
    users: () => loadUsers('ALL'),
    lookups: () => loadLookupOptions(),
};

const ADMIN_TAB_LOAD_KEYS = {
    news: ['news'],
    schedule: ['schedule'],
    'approve-staff': ['approve-staff', 'lookups'],
    'approve-participant': ['approve-participant', 'lookups'],
    'staff-users': ['staff-users', 'lookups'],
    'participant-users': ['participant-users', 'lookups'],
    'approve-news': ['approve-news'],
    users: ['users'],
};

function loadAdminLazyKeys(keys) {
    keys.forEach((key) => {
        if (loadedAdminKeys.has(key)) return;
        loadedAdminKeys.add(key);
        ADMIN_LAZY_LOADERS[key]();
    });
}

// Sections ที่ไม่มี subnav แต่ต้อง load ข้อมูลเมื่อเปิด
const ADMIN_SECTION_LOAD_KEYS = {};

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
            const firstChild = document.querySelector(`#${ownSubnavId} .admin-shell-nav-child:not([id$="-toggle"]), #${ownSubnavId} .admin-shell-nav-grandchild:not([id$="-toggle"])`);
            if (firstChild) switchAdminTab(firstChild.id.replace('admin-tab-', ''));
        }
    } else {
        // Section ที่ไม่มี subnav: load ข้อมูล lazy
        const sectionLoadKeys = ADMIN_SECTION_LOAD_KEYS[section];
        if (sectionLoadKeys) loadAdminLazyKeys(sectionLoadKeys);
    }
}

function expandNestedSubnavForTab(tab) {
    const btn = document.getElementById(`admin-tab-${tab}`);
    if (!btn) return;
    const nestedSubnav = btn.closest('.admin-shell-nav-collapse');
    if (!nestedSubnav || !nestedSubnav.classList.contains('collapsed')) return;
    nestedSubnav.classList.remove('collapsed');
    const toggleBtn = document.getElementById(`admin-tab-${nestedSubnav.id.replace('-subnav', '')}-toggle`);
    if (toggleBtn) toggleBtn.classList.add('expanded');
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.remove('active'));
    document.querySelectorAll('.admin-shell-nav-child, .admin-shell-nav-grandchild').forEach((btn) => btn.classList.remove('active'));

    document.getElementById(`admin-panel-${tab}`).classList.add('active');
    document.getElementById(`admin-tab-${tab}`).classList.add('active');
    expandNestedSubnavForTab(tab);
    const loadKeys = ADMIN_TAB_LOAD_KEYS[tab];
    if (loadKeys) loadAdminLazyKeys(loadKeys);
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
// ตัวช่วยตาราง (ไอคอนเรียงลำดับ / ปุ่มแก้ไข-ลบในแถว / เลขหน้า) ใช้ร่วมกันทุกตาราง
// ==========================================
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

// ==========================================
// กลุ่มเช็กบ็อกซ์เลือกได้หลายข้อ (ครอบ <select multiple> เดิมไว้) - แทนที่กล่องลิสต์ยาวมีสกรอลบาร์แบบ native ด้วยการ์ดเช็กบ็อกซ์
// ดีไซน์/คำอธิบายเหมือนช่อง "กลุ่มวิชาที่สนใจ" ในหน้าลงทะเบียนสาธารณะ (form.html) เป๊ะ ให้ UI ตรงกันทั้งสองฝั่ง
// ซ่อน <select> ตัวจริงไว้ (id/options เดิมทุกอย่าง) แล้ววาดการ์ดมาคลุมแทน โค้ดที่อ่าน/เขียนค่าจาก select.selectedOptions หรือ option.selected ที่มีอยู่เดิมยังใช้ได้ปกติ ไม่ต้องแก้
// ==========================================
const INTEREST_SUBJECT_GROUP_DESCRIPTIONS = {
    ENGINEERING_TECH: 'เทคโนโลยี, คอมพิวเตอร์ และการคำนวณ',
    SCIENCE: 'ฟิสิกส์, เคมี, ชีววิทยา และวิทยาศาสตร์ทั่วไป',
    HEALTH: 'แพทยศาสตร์, พยาบาล, เภสัช และสาธารณสุข',
    EDUCATION: 'ครุศาสตร์และการสอน',
    HUMANITIES_SOCIAL: 'ภาษาอังกฤษ, ประวัติศาสตร์, สังคมศาสตร์',
    ART_DESIGN: 'การคิดเชิงสร้างสรรค์, การออกแบบ, ทัศนศิลป์',
    MEDIA_DIGITAL_TECH: 'สื่อสารมวลชนและดิจิทัลคอนเทนต์',
    BUSINESS: 'การจัดการ, การตลาด, การเงินและการบัญชี',
    OTHER: 'สาขาอื่นที่ไม่ได้ระบุไว้ข้างต้น',
};

const multiCheckboxGroupRefreshers = {};

function initMultiCheckboxGroup(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.classList.add('hidden');

    const group = document.createElement('div');
    group.className = 'multi-checkbox-group';
    group.innerHTML = Array.from(select.options).map((option, index) => `
        <label class="multi-checkbox-option${option.selected ? ' selected' : ''}">
            <input type="checkbox" data-option-index="${index}" ${option.selected ? 'checked' : ''}>
            <div class="multi-checkbox-option-content">
                <span class="multi-checkbox-option-title">${escapeHtml(option.textContent)}</span>
                ${INTEREST_SUBJECT_GROUP_DESCRIPTIONS[option.value] ? `<span class="multi-checkbox-option-desc">${escapeHtml(INTEREST_SUBJECT_GROUP_DESCRIPTIONS[option.value])}</span>` : ''}
            </div>
        </label>
    `).join('');

    select.insertAdjacentElement('afterend', group);

    group.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            select.options[Number(checkbox.dataset.optionIndex)].selected = checkbox.checked;
            checkbox.closest('.multi-checkbox-option').classList.toggle('selected', checkbox.checked);
            select.dispatchEvent(new Event('change'));
        });
    });

    // เรียกอันนี้จากภายนอกทุกครั้งที่มีโค้ดอื่นตั้งค่า option.selected ตรง ๆ (เช่นตอนเปิดฟอร์มแก้ไขแล้วเติมค่าเดิม) ให้เช็กบ็อกซ์/การ์ดตามทัน
    multiCheckboxGroupRefreshers[selectId] = () => {
        const checkboxes = group.querySelectorAll('input[type="checkbox"]');
        Array.from(select.options).forEach((option, index) => {
            checkboxes[index].checked = option.selected;
            checkboxes[index].closest('.multi-checkbox-option').classList.toggle('selected', option.selected);
        });
    };
}

function refreshMultiCheckboxGroup(selectId) {
    multiCheckboxGroupRefreshers[selectId]?.();
}

// คำอธิบายฝ่ายงานแต่ละฝ่าย เหมือนช่อง "ฝ่ายงานที่สนใจร่วมทำงาน" ในหน้าลงทะเบียนพี่ค่าย (staff-form.html) เป๊ะ - ผูกกับ "ชื่อฝ่าย" เพราะตารางฝ่ายงานไม่มีคอลัมน์คำอธิบายเก็บไว้
const DEPARTMENT_DESCRIPTIONS = {
    'ฝ่ายวิชาการ': 'ออกแบบเนื้อหาและดูแลกิจกรรมด้านวิชาการ',
    'ฝ่ายกิจกรรมและสันทนาการ': 'ออกแบบและดูแลกิจกรรมนันทนาการ',
    'ฝ่ายปกครองบริการและอาคารสถานที่': 'ดูแลความปลอดภัยและสถานที่',
    'ฝ่ายเทคโนโลยีและประชาสัมพันธ์': 'ดูแลระบบ สื่อ และประชาสัมพันธ์',
    'ฝ่ายงานพยาบาล': 'ดูแลสุขภาพและปฐมพยาบาล',
};

// การ์ดเลือกได้ข้อเดียว (ครอบ <select> เดิมไว้ เหมือน initMultiCheckboxGroup แต่ใช้ radio แทน checkbox) - ใช้กับ "ฝ่ายงาน" ในฟอร์มแก้ไขพี่ค่าย ให้ดีไซน์ตรงกับหน้าลงทะเบียน
// ต้องเรียกหลัง select มี <option> ครบแล้วเท่านั้น (ฝ่ายงานเติมแบบ async จาก API ไม่ใช่ hardcode ไว้ใน HTML แบบกลุ่มวิชาที่สนใจ)
const singleCardSelectRefreshers = {};

function initSingleCardSelect(selectId, descriptions = {}) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.classList.add('hidden');

    const radioName = `${selectId}-card`;
    const group = document.createElement('div');
    group.className = 'multi-checkbox-group';
    group.innerHTML = Array.from(select.options)
        .filter((option) => option.value)
        .map((option) => `
            <label class="multi-checkbox-option${option.selected ? ' selected' : ''}">
                <input type="radio" name="${radioName}" value="${escapeHtml(option.value)}" ${option.selected ? 'checked' : ''}>
                <div class="multi-checkbox-option-content">
                    <span class="multi-checkbox-option-title">${escapeHtml(option.textContent)}</span>
                    ${descriptions[option.textContent] ? `<span class="multi-checkbox-option-desc">${escapeHtml(descriptions[option.textContent])}</span>` : ''}
                </div>
            </label>
        `).join('');

    select.insertAdjacentElement('afterend', group);

    group.querySelectorAll('input[type="radio"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            select.value = radio.value;
            group.querySelectorAll('.multi-checkbox-option').forEach((card) => {
                card.classList.toggle('selected', card.querySelector('input[type="radio"]').checked);
            });
            select.dispatchEvent(new Event('change'));
        });
    });

    // เรียกอันนี้จากภายนอกทุกครั้งที่มีโค้ดอื่นตั้งค่า select.value ตรง ๆ (เช่นตอนเปิดฟอร์มแก้ไขแล้วเติมค่าเดิม) ให้การ์ดตามทัน
    singleCardSelectRefreshers[selectId] = () => {
        group.querySelectorAll('input[type="radio"]').forEach((radio) => {
            radio.checked = radio.value === select.value;
            radio.closest('.multi-checkbox-option').classList.toggle('selected', radio.checked);
        });
    };
}

function refreshSingleCardSelect(selectId) {
    singleCardSelectRefreshers[selectId]?.();
}

// ==========================================
// ตัวเลือกฝ่ายงาน/ตำแหน่ง/คอร์สเรียน/กลุ่ม ในฟอร์ม "จัดการข้อมูลผู้ใช้" (แก้ไขพี่ค่าย/น้องค่าย) - เติม <option> จาก API ให้ select ที่มีอยู่แล้วในหน้า
// ==========================================
function populateSelectOptions(selectId, items) {
    const select = document.getElementById(selectId);
    if (!select) return;
    items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    });
}

function loadLookupOptions() {
    fetch('/api/lookups/departments')
        .then((res) => (res.ok ? res.json() : []))
        .then((items) => {
            // เรียงตามชื่อ (asc) ตามปกติ แต่ดันฝ่ายวิชาการขึ้นมาอยู่การ์ดแรกเสมอ (เหมือนลิสต์หัวหน้าฝ่ายตอนสร้างค่าย) ฝ่ายที่ผูกกับระบบวิชาการโดยตรง ให้เห็นก่อนฝ่ายอื่น
            const sortedItems = [...items].sort((a, b) => {
                if (a.name === 'ฝ่ายวิชาการ') return -1;
                if (b.name === 'ฝ่ายวิชาการ') return 1;
                return 0;
            });
            populateSelectOptions('user-staff-department', sortedItems);
            initSingleCardSelect('user-staff-department', DEPARTMENT_DESCRIPTIONS);
        })
        .catch((error) => console.error('โหลดรายชื่อฝ่ายงานไม่สำเร็จ:', error));

    fetch('/api/lookups/positions')
        .then((res) => (res.ok ? res.json() : []))
        .then((items) => {
            populateSelectOptions('user-staff-position', items);
        })
        .catch((error) => console.error('โหลดรายชื่อตำแหน่งไม่สำเร็จ:', error));

    fetch('/api/lookups/course-formats')
        .then((res) => (res.ok ? res.json() : []))
        .then((items) => {
            populateSelectOptions('user-participant-courseFormat', items);
        })
        .catch((error) => console.error('โหลดรูปแบบคอร์สเรียนไม่สำเร็จ:', error));

    fetch('/api/lookups/groups')
        .then((res) => (res.ok ? res.json() : []))
        .then((items) => {
            populateSelectOptions('user-participant-group', items);
        })
        .catch((error) => console.error('โหลดรายชื่อกลุ่มไม่สำเร็จ:', error));
}

// สลับโชว์/ซ่อนช่อง "ระบุกลุ่มวิชาที่สนใจ" ตามที่เลือก "OTHER" ในกล่องกลุ่มวิชาที่สนใจ (multi-select) หรือไม่ ใช้ร่วมกันทั้งฟอร์มสร้าง/แก้ไขน้องค่าย
function syncInterestOtherVisibility(selectId, groupId) {
    const select = document.getElementById(selectId);
    const group = document.getElementById(groupId);
    if (!select || !group) return;
    const isOther = Array.from(select.selectedOptions).some((option) => option.value === 'OTHER');
    group.classList.toggle('hidden', !isOther);
}

// สลับโชว์/ซ่อนช่อง "ระบุแผนการเรียน" ตามที่เลือกในดรอปดาวน์แผนการเรียน ใช้ร่วมกันทั้งฟอร์มสร้าง/แก้ไขน้องค่าย
function syncStudyPlanOtherVisibility(selectId, groupId) {
    const select = document.getElementById(selectId);
    const group = document.getElementById(groupId);
    if (!select || !group) return;
    group.classList.toggle('hidden', select.value !== 'OTHER');
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
    const approvalBody = document.getElementById('news-approval-table-body');
    if (approvalBody) Loader.renderSkeletonTableRows(approvalBody, 5, 4);
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

            // อัปเดตตาราง "คอนุมัติประชาสัมพันธ์" ใช้ผลจาก fetch เดียวกัน
            newsApprovalItems = items.filter((item) => item.approvalStatus !== 'APPROVED');
            newsApprovalCurrentPage = 1;
            renderNewsApprovalTable();
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
            <td>${newsRowActionButtonsHtml()}</td>
        `;
        row.querySelector('.admin-row-checkbox').addEventListener('change', (e) => toggleNewsRowSelect(item.id, e.target.checked));
        row.querySelector('.admin-hot-toggle').addEventListener('change', (e) => toggleNewsHot(item, e.target.checked));
        row.querySelector('.admin-visibility-toggle').addEventListener('change', (e) => toggleNewsVisibility(item, e.target.checked));
        row.querySelector('[data-action="edit"]').addEventListener('click', () => openNewsForm(item));
        row.querySelector('[data-action="view"]').addEventListener('click', () => openNewsPreview(item));
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
// ใส่ url ให้ execCommand('createLink') เอง เพราะปุ่มอื่น ๆ (bold/italic/insertUnorderedList) ไม่ต้องการ argument (ส่ง null พอ) มีแค่คำสั่งนี้ที่ต้องถามผู้ใช้ก่อน
// ไม่ได้เลือกข้อความไว้ (selection ว่าง) ก็แทรกตัว url เองเป็นเนื้อลิงก์ให้เลย กันกดแล้วไม่เกิดอะไรขึ้นเพราะไม่รู้ว่าต้องลากเลือกก่อน
async function insertRichTextLink(editorEl) {
    editorEl.focus();
    // เก็บตำแหน่งที่เลือกไว้ไว้ก่อนเปิด modal เพราะโฟกัสจะย้ายไปช่องกรอกลิงก์ ทำให้ selection เดิมในกล่องข้อความหายไป ต้องกู้คืนก่อนสั่ง execCommand
    const selection = window.getSelection();
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    const hasSelection = !!selection?.toString();

    const rawUrl = await showLinkPrompt();
    if (!rawUrl) return;
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

    editorEl.focus();
    if (savedRange) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
    }

    if (hasSelection) {
        document.execCommand('createLink', false, url);
    } else {
        document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
    }
    // เปิดแท็บใหม่เสมอตอนอ่านจริง (ระหว่างพิมพ์ในนี้คลิกธรรมดาไม่ตามลิงก์อยู่แล้วเพราะอยู่ใน contenteditable ไม่กระทบการแก้ไขต่อ)
    editorEl.querySelectorAll('a:not([target])').forEach((a) => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
    });
}

// กล่องถามลิงก์แบบมีสไตล์ตรงกับเว็บ แทน prompt() เบราว์เซอร์เดิม
let linkPromptResolver = null;
function showLinkPrompt() {
    const modal = document.getElementById('link-prompt-modal');
    const input = document.getElementById('link-prompt-input');
    if (!modal || !input) return Promise.resolve(null);
    input.value = '';
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);
    return new Promise((resolve) => { linkPromptResolver = resolve; });
}

function linkPromptResolve(value) {
    document.getElementById('link-prompt-modal')?.classList.add('hidden');
    if (linkPromptResolver) {
        linkPromptResolver(value && value.trim() ? value.trim() : null);
        linkPromptResolver = null;
    }
}

function initRichTextToolbar() {
    document.querySelectorAll('.admin-richtext-btn').forEach((btn) => {
        btn.addEventListener('mousedown', (event) => event.preventDefault());
        btn.addEventListener('click', async () => {
            if (btn.dataset.richtextCmd === 'createLink') {
                const editorEl = btn.closest('.admin-richtext-editor')?.querySelector('.admin-richtext');
                if (editorEl) await insertRichTextLink(editorEl);
            } else {
                document.execCommand(btn.dataset.richtextCmd, false, null);
            }
            updateRichTextToolbarState();
        });
    });
    document.addEventListener('selectionchange', updateRichTextToolbarState);

    // execCommand('defaultParagraphSeparator', 'br') ไม่เสถียรพอในทุกเบราว์เซอร์ จึงสั่งแทรก <br> เองตอนกด Enter แทนที่จะปล่อยให้ห่อ <div> ใหม่ทุกครั้ง
    // ใช้ execCommand('insertLineBreak') แทนการแทรก <br> ด้วย Range เอง เพราะ Range แบบ manual วางตำแหน่งเคอร์เซอร์หลัง <br> ท้ายสุดไม่ได้ (พิมพ์ต่อแล้วอักษรไปแทรกก่อน <br> แทน)
    document.querySelectorAll('.admin-richtext').forEach((detailEl) => {
        detailEl.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            document.execCommand('insertLineBreak');
        });
        detailEl.addEventListener('paste', handleRichTextPaste);
    });

    document.getElementById('link-prompt-input')?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        linkPromptResolve(document.getElementById('link-prompt-input').value);
    });
}

// วางลิงก์ (คัดลอกมาทั้งดุ้น ไม่ได้เลือกคำอื่นมาแปะด้วย) ให้กลายเป็นลิงก์คลิกได้ทันทีโดยไม่ต้องกดปุ่ม "แทรกลิงก์" เอง
// เช็คเฉพาะกรณีที่วางแล้วทั้งข้อความเป็น URL ล้วน ๆ เท่านั้น (ตรงกับเคสที่พบบ่อยสุดคือก๊อปลิงก์มาวางเดี่ยว ๆ) ถ้าวางเป็นย่อหน้ายาวที่มีลิงก์ปนอยู่ ปล่อยเป็นข้อความธรรมดาไปตามปกติ ไม่พยายามเดา
function handleRichTextPaste(event) {
    const text = (event.clipboardData || window.clipboardData)?.getData('text/plain')?.trim();
    if (!text || !/^https?:\/\/\S+$/i.test(text)) return;
    event.preventDefault();
    document.execCommand('insertHTML', false, `<a href="${escapeHtml(text)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`);
}

function updateRichTextToolbarState() {
    const editorEl = document.activeElement;
    if (!editorEl?.classList.contains('admin-richtext')) return;
    editorEl.closest('.admin-richtext-editor')?.querySelectorAll('.admin-richtext-btn').forEach((btn) => {
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
    newsPublishedAtSelects?.setValue(item ? toDateInputValue(item.publishedAt) : toDateInputValue(new Date()));
    document.getElementById('news-title').value = item ? item.title : '';
    document.getElementById('news-summary').value = item ? item.summary : '';
    document.getElementById('news-detail').innerHTML = item ? item.detail : '';
    document.getElementById('news-imageUrl').value = item && item.imageUrl ? item.imageUrl : '';
    document.getElementById('news-isHot').checked = item ? Boolean(item.isHot) : false;
    document.getElementById('news-isVisible').checked = item ? item.isVisible !== false : true;

    newsOriginalImageUrl = item && item.imageUrl ? item.imageUrl : '';
    updateNewsImagePreview();

    document.getElementById('news-modal').classList.remove('hidden');
}

function closeNewsForm() {
    document.getElementById('news-modal').classList.add('hidden');
}

function updateNewsImagePreview() {
    const url = document.getElementById('news-imageUrl')?.value.trim();
    const wrap = document.getElementById('news-imageUrl-preview');
    const img = document.getElementById('news-imageUrl-preview-img');
    if (!wrap || !img) return;
    if (url) {
        img.src = window.PTN_MEDIA_URL(url);
        wrap.classList.remove('hidden');
    } else {
        img.src = '';
        wrap.classList.add('hidden');
    }
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
            updateNewsImagePreview();
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

function newsRowActionButtonsHtml() {
    return `
        <div class="admin-row-actions">
            <button type="button" class="admin-icon-btn admin-icon-btn-edit" data-action="edit" aria-label="แก้ไข" title="แก้ไข">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
            </button>
            <button type="button" class="admin-icon-btn admin-icon-btn-view" data-action="view" aria-label="ดูตัวอย่างจริงบนเว็บ" title="ดูตัวอย่างจริงบนเว็บ">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

function formatNewsAuthorName(item) {
    const profile = item.author && item.author.staffProfile;
    const fullName = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') : '';
    return fullName || (item.author && item.author.email) || '-';
}

function renderNewsPreviewModal(item, { showApprovalActions = false } = {}) {
    const grid = document.getElementById('news-approval-detail-grid');
    const preview = document.getElementById('news-approval-detail-preview');
    if (!grid || !preview) return;

    const submittedDate = new Date(item.createdAt).toLocaleDateString('th-TH', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const publishedOnlyDate = new Date(item.publishedAt).toLocaleDateString('th-TH', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    const fields = [
        ['สรุปย่อ (ใช้บนการ์ดหน้าแรก)', item.summary],
        ['ผู้เขียน', formatNewsAuthorName(item)],
        [showApprovalActions ? 'ส่งเมื่อ' : 'เผยแพร่เมื่อ', showApprovalActions ? submittedDate : publishedOnlyDate],
    ];

    grid.innerHTML = fields
        .map(([label, value]) => `
            <div class="approval-detail-item">
                <span class="approval-detail-label">${escapeHtml(label)}</span>
                <span class="approval-detail-value">${escapeHtml(value || '-')}</span>
            </div>
        `)
        .join('');

    const publishedDateText = new Date(item.publishedAt || item.createdAt).toLocaleDateString('th-TH', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
    const imageHtml = item.imageUrl
        ? `<div style="position: relative; margin-top: 1rem;">
            <img src="${escapeHtml(window.PTN_MEDIA_URL(item.imageUrl))}" alt="ภาพประกอบประชาสัมพันธ์" class="w-full h-48 sm:h-64 object-cover rounded-xl" style="cursor: zoom-in;" onclick="openImageLightbox('${escapeHtml(item.imageUrl)}')">
            <button type="button" class="news-detail-zoom-btn" onclick="openImageLightbox('${escapeHtml(item.imageUrl)}')" aria-label="ดูรูปเต็ม">
                <svg class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                </svg>
            </button>
        </div>`
        : '';

    preview.innerHTML = `
        <span class="text-xs font-bold px-2.5 py-1 rounded bg-brand-50 text-brand-600 inline-block">${escapeHtml(NEWS_TAG_LABELS[item.tag] || item.tag)}</span>
        <h2 class="text-xl sm:text-2xl font-bold text-slate-900 leading-snug" style="margin-top: 0.75rem;">${escapeHtml(item.title)}</h2>
        <div class="flex items-center gap-2 text-xs text-slate-400" style="margin-top: 0.5rem;">
            <span>เผยแพร่เมื่อ: ${publishedDateText}</span>
            <span>•</span>
            <span>โดย: คณะกรรมการค่าย</span>
        </div>
        ${imageHtml}
        <hr class="border-slate-100" style="margin: 1rem 0;">
        <div class="news-detail-content text-slate-600 text-sm sm:text-base leading-relaxed font-light py-2" style="white-space: pre-line;">${item.detail || ''}</div>
    `;

    document.getElementById('news-approval-detail-title').textContent = 'ตัวอย่างประชาสัมพันธ์';
    document.getElementById('news-approval-detail-subtitle').innerHTML = `สถานะ: ${NEWS_APPROVAL_STATUS_BADGE[item.approvalStatus] || ''}`;

    const actionsWrap = document.getElementById('news-approval-detail-actions');
    if (actionsWrap) actionsWrap.classList.toggle('hidden', !showApprovalActions);

    if (showApprovalActions) {
        const approveBtn = document.getElementById('news-approval-detail-approve-btn');
        const rejectBtn = document.getElementById('news-approval-detail-reject-btn');
        if (approveBtn) approveBtn.onclick = () => { closeNewsApprovalDetail(); setNewsApprovalStatus(item, 'APPROVED'); };
        if (rejectBtn) rejectBtn.onclick = () => { closeNewsApprovalDetail(); setNewsApprovalStatus(item, 'REJECTED'); };
    }

    document.getElementById('news-approval-detail-modal').classList.remove('hidden');
}

function openNewsPreview(item) {
    renderNewsPreviewModal(item, { showApprovalActions: false });
}


function closeNewsApprovalDetail() {
    document.getElementById('news-approval-detail-modal').classList.add('hidden');
}

function openImageLightbox(url) {
    document.getElementById('image-lightbox-img').src = window.PTN_MEDIA_URL(url);
    document.getElementById('image-lightbox-modal').classList.remove('hidden');
}

function closeImageLightbox() {
    document.getElementById('image-lightbox-modal').classList.add('hidden');
    document.getElementById('image-lightbox-img').src = '';
}


// ==========================================
// อนุมัติประชาสัมพันธ์ (News Approval)
// ==========================================
const NEWS_APPROVAL_STATUS_BADGE = {
    PENDING: '<span class="admin-badge admin-badge-pending">กำลังพิจารณา</span>',
    REJECTED: '<span class="admin-badge admin-badge-delete">ถูกปฏิเสธ</span>',
    APPROVED: '<span class="admin-badge admin-badge-create">อนุมัติแล้ว</span>',
};

const NEWS_APPROVAL_PAGE_SIZE = 10;
let newsApprovalItems = [];
let newsApprovalCurrentPage = 1;

function renderNewsApprovalTable() {
    const tbody = document.getElementById('news-approval-table-body');
    const empty = document.getElementById('news-approval-empty');
    if (!tbody || !empty) return;

    const totalPages = Math.max(1, Math.ceil(newsApprovalItems.length / NEWS_APPROVAL_PAGE_SIZE));
    if (newsApprovalCurrentPage > totalPages) newsApprovalCurrentPage = totalPages;
    const start = (newsApprovalCurrentPage - 1) * NEWS_APPROVAL_PAGE_SIZE;
    const pageItems = newsApprovalItems.slice(start, start + NEWS_APPROVAL_PAGE_SIZE);

    tbody.innerHTML = '';
    empty.classList.toggle('hidden', newsApprovalItems.length !== 0);

    pageItems.forEach((item) => {
        const submittedDate = new Date(item.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="admin-cell-strong">${escapeHtml(item.title)}</td>
            <td>${escapeHtml(formatNewsAuthorName(item))}</td>
            <td>${submittedDate}</td>
            <td>${NEWS_APPROVAL_STATUS_BADGE[item.approvalStatus] || ''}</td>
            <td>
                <div class="admin-row-actions">
                    <button type="button" class="btn-outline admin-detail-btn" style="padding: 0.4rem 0.75rem; font-size: 0.78rem;">ดูรายละเอียด</button>
                    <button type="button" class="admin-approve-btn">อนุมัติ</button>
                    <button type="button" class="admin-reject-btn">ปฏิเสธ</button>
                </div>
            </td>
        `;
        row.querySelector('.admin-detail-btn').addEventListener('click', () => openNewsApprovalDetail(item));
        row.querySelector('.admin-approve-btn').addEventListener('click', () => setNewsApprovalStatus(item, 'APPROVED'));
        row.querySelector('.admin-reject-btn').addEventListener('click', () => setNewsApprovalStatus(item, 'REJECTED'));
        tbody.appendChild(row);
    });

    updateNewsApprovalPagination(newsApprovalItems.length, totalPages);
}

function updateNewsApprovalPagination(totalCount, totalPages) {
    const pagination = document.getElementById('news-approval-pagination');
    const prevBtn = document.getElementById('news-approval-prev-btn');
    const nextBtn = document.getElementById('news-approval-next-btn');
    if (!pagination || !prevBtn || !nextBtn) return;

    pagination.classList.toggle('hidden', totalCount <= NEWS_APPROVAL_PAGE_SIZE);
    prevBtn.disabled = newsApprovalCurrentPage <= 1;
    nextBtn.disabled = newsApprovalCurrentPage >= totalPages;
    renderNewsApprovalPageNumbers(totalPages);
}

function renderNewsApprovalPageNumbers(totalPages) {
    const container = document.getElementById('news-approval-page-numbers');
    if (!container) return;

    container.innerHTML = '';
    getPaginationRange(newsApprovalCurrentPage, totalPages).forEach((page) => {
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
        btn.classList.toggle('active', page === newsApprovalCurrentPage);
        btn.addEventListener('click', () => goToNewsApprovalPage(page));
        container.appendChild(btn);
    });
}

function goToNewsApprovalPage(page) {
    newsApprovalCurrentPage = page;
    renderNewsApprovalTable();
}

function changeNewsApprovalPage(delta) {
    newsApprovalCurrentPage += delta;
    renderNewsApprovalTable();
}

function openNewsApprovalDetail(item) {
    renderNewsPreviewModal(item, { showApprovalActions: true });
}

async function setNewsApprovalStatus(item, approvalStatus) {
    const label = approvalStatus === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ';
    const confirmed = await adminConfirm(`${label}ประชาสัมพันธ์ "${item.title}" ใช่หรือไม่?`, {
        title: `ยืนยันการ${label}`,
        confirmText: label,
        variant: approvalStatus === 'APPROVED' ? 'approve' : 'reject',
    });
    if (!confirmed) return;

    fetch(`/api/news/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(`${label}ประชาสัมพันธ์สำเร็จ`);
            loadNews();
        })
        .catch((error) => {
            console.error(error);
            showToast(`${label}ประชาสัมพันธ์ไม่สำเร็จ`, true);
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
    scheduleEventDateSelects?.setValue(item ? toDateInputValue(item.eventDate) : toDateInputValue(new Date()));
    // "วันที่สิ้นสุด" เป็นแค่ตัวช่วยคำนวณข้อความช่วงวันที่ตอนกรอกครั้งแรก ไม่มีคอลัมน์เก็บจริงใน Schedule (ดู schema) จึงไม่มีค่าให้ดึงกลับมาตอนแก้ไข เคลียร์ทุกครั้งที่เปิดฟอร์ม
    scheduleEndDateSelects?.clear();
    document.getElementById('schedule-badgeColor').value = item ? item.badgeColor : 'BRAND';
    document.getElementById('schedule-dateText').value = item ? item.dateText : '';
    document.getElementById('schedule-mobileDate').value = item && item.mobileDate ? item.mobileDate : '';
    document.getElementById('schedule-badgeLabel').value = item && item.badgeLabel ? item.badgeLabel : '';
    document.getElementById('schedule-title').value = item ? item.title : '';
    document.getElementById('schedule-description').innerHTML = item ? richTextFromStoredText(item.description) : '';
    document.getElementById('schedule-isVisible').checked = item ? item.isVisible !== false : true;

    document.getElementById('schedule-modal').classList.remove('hidden');
}

// ข้อความเก่าที่ไม่มีแท็ก HTML เลย = ข้อความธรรมดา escape แล้วแปลงขึ้นบรรทัดเป็น <br> ส่วนที่เป็น HTML จาก editor อยู่แล้วใช้ตรง ๆ
function richTextFromStoredText(text) {
    if (!text) return '';
    if (/<[a-z][\s\S]*>/i.test(text)) return text;
    return escapeHtml(text).replace(/\n/g, '<br>');
}

// editor ที่ลบข้อความหมดมักเหลือ <br> ค้างไว้ นับเป็นว่าง (ไม่บังคับกรอกรายละเอียด)
function richTextToStoredHtml(editorEl) {
    if (!editorEl.textContent.trim() && !editorEl.querySelector('img')) return '';
    return editorEl.innerHTML.trim();
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
        description: richTextToStoredHtml(document.getElementById('schedule-description')),
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
            loadUsers(role);
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
            loadUsers(role);
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

const userState = { STAFF: [], PARTICIPANT: [], ALL: [] };
const userCurrentPage = { STAFF: 1, PARTICIPANT: 1, ALL: 1 };
const userSelectedIds = { STAFF: new Set(), PARTICIPANT: new Set(), ALL: new Set() };
const userSortColumn = { STAFF: 'createdAt', PARTICIPANT: 'createdAt', ALL: 'createdAt' };
const userSortDirection = { STAFF: 'desc', PARTICIPANT: 'desc', ALL: 'desc' };

function loadUsers(role = 'ALL') {
    const tableBodyId = role === 'ALL' ? 'user-table-body' : `user-table-body-${role}`;
    const approvalBodyId = `approval-table-body-${role}`;
    
    const tableBody = document.getElementById(tableBodyId);
    if (tableBody) Loader.renderSkeletonTableRows(tableBody, 5, 4);
    
    if (role !== 'ALL') {
        const approvalBody = document.getElementById(approvalBodyId);
        if (approvalBody) Loader.renderSkeletonTableRows(approvalBody, 5, 3);
    }

    const url = role === 'ALL' ? '/api/users' : `/api/users?role=${role}`;
    fetch(url)
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            userState[role] = items;
            userCurrentPage[role] = 1;
            userSelectedIds[role].clear();
            renderUserTable(role);

            if (role !== 'ALL') {
                const pendingItems = items.filter((item) => item.approvalStatus !== 'APPROVED');
                renderApprovalTable(role, pendingItems);
            }
        })
        .catch((error) => {
            console.error(`โหลดข้อมูลผู้ใช้งาน (${role}) ไม่สำเร็จ:`, error);
            showToast('โหลดข้อมูลผู้ใช้งานไม่สำเร็จ', true);
        });
}

function getFilteredUserItems(role = 'ALL') {
    const searchId = role === 'ALL' ? 'user-search' : `user-search-${role}`;
    const searchInput = document.getElementById(searchId);
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let items = userState[role] || [];
    if (query) {
        items = items.filter((item) => item.email.toLowerCase().includes(query));
    }
    return sortUserItems(role, items);
}

function sortUserItems(role = 'ALL', items) {
    const column = userSortColumn[role];
    const direction = userSortDirection[role] === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
        if (column === 'createdAt') return (new Date(a.createdAt) - new Date(b.createdAt)) * direction;
        return String(a[column] || '').localeCompare(String(b[column] || ''), 'th') * direction;
    });
}

// Support both setUserSort('email') and setUserSort('STAFF', 'email')
function setUserSort(arg1, arg2) {
    const role = arg2 ? arg1 : 'ALL';
    const column = arg2 || arg1;
    
    if (userSortColumn[role] === column) {
        userSortDirection[role] = userSortDirection[role] === 'asc' ? 'desc' : 'asc';
    } else {
        userSortColumn[role] = column;
        userSortDirection[role] = 'asc';
    }
    userCurrentPage[role] = 1;
    renderUserTable(role);
}

function updateUserSortIndicators(role = 'ALL') {
    USER_SORTABLE_COLUMNS.forEach((column) => {
        const iconSelector = role === 'ALL' ? `[data-sort-icon-user="${column}"]` : `[data-sort-icon-user-${role}="${column}"]`;
        const icon = document.querySelector(iconSelector);
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

function renderUserTable(role = 'ALL') {
    const tbodyId = role === 'ALL' ? 'user-table-body' : `user-table-body-${role}`;
    const emptyId = role === 'ALL' ? 'user-empty' : `user-empty-${role}`;
    const noMatchId = role === 'ALL' ? 'user-no-match' : `user-no-match-${role}`;
    
    const tbody = document.getElementById(tbodyId);
    const empty = document.getElementById(emptyId);
    const noMatch = document.getElementById(noMatchId);
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
        const adminBadgeCell = role === 'STAFF'
            ? `<td>${item.isAdmin ? '<span class="admin-bool-badge admin-bool-badge--yes">✓</span>' : '<span class="admin-bool-badge admin-bool-badge--no">✕</span>'}</td>`
            : '';
        const fullName = [item.prefix, item.firstName, item.lastName].filter(Boolean).join(' ') || '-';
        const nameInfoCells = `<td>${fullName}</td><td>${item.nickname || '-'}</td>`;
        const roleWorkCells = role === 'STAFF'
            ? `<td>${item.position?.name || '-'}</td><td>${item.department?.name || '-'}</td>`
            : `<td>${item.courseFormat?.name || '-'}</td><td>${item.group?.name || '-'}</td>`;
        row.innerHTML = `
            <td>
                <label class="admin-checkbox-wrap">
                    <input type="checkbox" class="admin-row-checkbox" ${checked ? 'checked' : ''}>
                    <span class="custom-checkbox"></span>
                </label>
            </td>
            ${nameInfoCells}
            ${roleWorkCells}
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

// Support both toggleUserSelectAll(true) and toggleUserSelectAll('STAFF', true)
function toggleUserSelectAll(arg1, arg2) {
    const role = arg2 !== undefined ? arg1 : 'ALL';
    const checked = arg2 !== undefined ? arg2 : arg1;
    
    const filtered = getFilteredUserItems(role);
    const start = (userCurrentPage[role] - 1) * USER_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + USER_PAGE_SIZE);
    pageItems.forEach((item) => {
        if (checked) userSelectedIds[role].add(item.id);
        else userSelectedIds[role].delete(item.id);
    });
    renderUserTable(role);
}

function updateUserSelectAllState(role = 'ALL', currentPageItems) {
    const selectAllId = role === 'ALL' ? 'user-select-all' : `user-select-all-${role}`;
    const selectAll = document.getElementById(selectAllId);
    if (!selectAll) return;

    let pageItems = currentPageItems;
    if (!pageItems) {
        const filtered = getFilteredUserItems(role);
        const start = (userCurrentPage[role] - 1) * USER_PAGE_SIZE;
        pageItems = filtered.slice(start, start + USER_PAGE_SIZE);
    }
    selectAll.checked = pageItems.length > 0 && pageItems.every((item) => userSelectedIds[role].has(item.id));
}

function updateUserBulkBar(role = 'ALL') {
    const btnId = role === 'ALL' ? 'user-bulk-delete-btn' : `user-bulk-delete-btn-${role}`;
    const countId = role === 'ALL' ? 'user-selected-count' : `user-selected-count-${role}`;
    const btn = document.getElementById(btnId);
    const countEl = document.getElementById(countId);
    const n = userSelectedIds[role].size;

    if (btn) btn.disabled = n === 0;
    if (countEl) {
        countEl.textContent = `เลือกแล้ว ${n} รายการ`;
        countEl.classList.toggle('hidden', n === 0);
    }
}

async function bulkDeleteUsers(role = 'ALL') {
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

function updateUserPagination(role = 'ALL', filteredCount, totalPages) {
    const paginationId = role === 'ALL' ? 'user-pagination' : `user-pagination-${role}`;
    const prevBtnId = role === 'ALL' ? 'user-prev-btn' : `user-prev-btn-${role}`;
    const nextBtnId = role === 'ALL' ? 'user-next-btn' : `user-next-btn-${role}`;
    
    const pagination = document.getElementById(paginationId);
    const prevBtn = document.getElementById(prevBtnId);
    const nextBtn = document.getElementById(nextBtnId);
    if (!pagination || !prevBtn || !nextBtn) return;

    pagination.classList.toggle('hidden', filteredCount <= USER_PAGE_SIZE);
    prevBtn.disabled = userCurrentPage[role] <= 1;
    nextBtn.disabled = userCurrentPage[role] >= totalPages;
    renderUserPageNumbers(role, totalPages);
}

function renderUserPageNumbers(role = 'ALL', totalPages) {
    const containerId = role === 'ALL' ? 'user-page-numbers' : `user-page-numbers-${role}`;
    const container = document.getElementById(containerId);
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

// Support both changeUserPage(-1) and changeUserPage('STAFF', -1)
function changeUserPage(arg1, arg2) {
    const role = arg2 !== undefined ? arg1 : 'ALL';
    const delta = arg2 !== undefined ? arg2 : arg1;
    userCurrentPage[role] += delta;
    renderUserTable(role);
}

function goToUserPage(role = 'ALL', page) {
    userCurrentPage[role] = page;
    renderUserTable(role);
}

function handleUserRoleChange() {
    const isStaff = document.getElementById('user-role').value === 'STAFF';

    document.getElementById('user-staff-personal-fields').classList.toggle('hidden', !isStaff);
    document.getElementById('user-participant-personal-fields').classList.toggle('hidden', isStaff);
    document.getElementById('user-staff-work-fields').classList.toggle('hidden', !isStaff);
    document.getElementById('user-participant-study-fields').classList.toggle('hidden', isStaff);
}

// แถบแท็บ "บัญชีเข้าสู่ระบบ / ข้อมูลส่วนตัว / ข้อมูลการทำงาน" ใน modal แก้ไข/เพิ่มผู้ใช้งาน ใช้คลาสเดียวกับแท็บแดชบอร์ด (.dashboard-tabs/.dashboard-tab)
function switchUserFormTab(tab) {
    document.querySelectorAll('#user-form-tabs .dashboard-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.userFormTab === tab);
    });
    ['account', 'personal', 'work'].forEach((t) => {
        document.getElementById(`user-form-panel-${t}`).classList.toggle('hidden', t !== tab);
    });
}

// สลับโชว์/ซ่อนช่องสังกัด+อาชีพ / คณะ+สาขา ตามสถานะที่เลือก เหมือนหน้าลงทะเบียนพี่ค่าย (staff-form.html: handleOccupationStatusChange) เป๊ะ
// แยกจาก handleUserStaffOccupationStatusChange() ด้านล่าง เพราะฟังก์ชันนี้ไม่ล้าง/เติมค่าใด ๆ ให้เรียกตอน populate ฟอร์มแก้ไขได้อย่างปลอดภัย (ไม่ทับข้อมูลจริงที่โหลดมา)
function applyUserStaffOccupationVisibility(status) {
    const affiliationGroup = document.getElementById('user-staff-affiliation-group');
    const studentGroup = document.getElementById('user-staff-student-group');
    if (!affiliationGroup || !studentGroup) return;
    affiliationGroup.classList.toggle('hidden', !status);
    studentGroup.classList.toggle('hidden', status !== 'studying');
}

// ผูกกับ onchange ของ select สถานะ - เหมือน applyUserStaffOccupationVisibility() แต่เพิ่มพฤติกรรมล้าง/เติมค่าอัตโนมัติตอนแอดมินสลับสถานะเองเหมือนหน้าลงทะเบียน
// (เลือก "กำลังศึกษา" อาชีพเติม "นักศึกษา" ให้อัตโนมัติและล็อกแก้ไม่ได้ / เลือก "ประกอบอาชีพ" ล้างคณะ-สาขาทิ้งเพราะไม่เกี่ยวกันแล้ว)
function handleUserStaffOccupationStatusChange() {
    const status = document.getElementById('user-staff-occupationStatus').value;
    applyUserStaffOccupationVisibility(status);

    const occupationInput = document.getElementById('user-staff-occupation');
    const facultyInput = document.getElementById('user-staff-faculty');
    const majorInput = document.getElementById('user-staff-major');

    if (status === 'studying') {
        occupationInput.value = 'นักศึกษา';
        occupationInput.readOnly = true;
    } else if (status === 'working') {
        if (occupationInput.readOnly) occupationInput.value = '';
        occupationInput.readOnly = false;
        facultyInput.value = '';
        majorInput.value = '';
    }
}

// รายการเงื่อนไขรหัสผ่านใต้ช่อง user-password เหมือนหน้าลงทะเบียน (updatePasswordChecklist ใน form.js/staff-form.js) - เกณฑ์ต้องตรงกับ isPasswordValid ฝั่ง backend (backend/lib/password.js) เสมอ
function updateUserPasswordChecklist() {
    const password = document.getElementById('user-password').value;
    const rules = {
        length: password.length >= 8,
        lower: /[a-z]/.test(password),
        upper: /[A-Z]/.test(password),
        number: /\d/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    Object.entries(rules).forEach(([rule, met]) => {
        document.querySelectorAll(`#user-password-checklist [data-rule="${rule}"], #user-password-checklist-categories [data-rule="${rule}"]`)
            .forEach((li) => li.classList.toggle('met', met));
    });
}

// จัดรูปแบบเบอร์โทรเป็น 0XX-XXX-XXXX ระหว่างพิมพ์ เหมือนหน้าลงทะเบียน (formatPhoneNumber/handleRegPhoneInput ใน form.js/staff-form.js) backend ตัดขีดออกเองอยู่แล้วตอนบันทึก (ดู buildStaffProfileData/buildParticipantProfileData) จึงจัดรูปแบบฝั่งนี้ได้อิสระไม่กระทบข้อมูลจริง
function formatPhoneNumber(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function handleUserPhoneInput(event) {
    const input = event.target;
    const digitsBeforeCursor = input.value.slice(0, input.selectionStart).replace(/\D/g, '').length;
    input.value = formatPhoneNumber(input.value);

    let seen = 0;
    let cursorPos = input.value.length;
    for (let i = 0; i < input.value.length; i++) {
        if (/\d/.test(input.value[i])) seen++;
        if (seen === digitsBeforeCursor) {
            cursorPos = i + 1;
            break;
        }
    }
    if (digitsBeforeCursor === 0) cursorPos = 0;
    input.setSelectionRange(cursorPos, cursorPos);
}

// onSaved: callback เสริมที่เรียกหลังบันทึกสำเร็จ (นอกเหนือจาก loadUsers(role) ปกติ) ใช้กับตารางที่กรองย่อยอีกที เช่นตารางพี่ค่ายรายฝ่าย
let userFormOnSaved = null;

function openUserForm(item, role, onSaved) {
    const form = document.getElementById('user-form');
    const error = document.getElementById('user-form-error');
    form.reset();
    error.classList.add('hidden');
    userFormOnSaved = onSaved || null;
    switchUserFormTab('account');

    document.getElementById('user-modal-title').textContent = item ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน';
    document.getElementById('user-id').value = item ? item.id : '';
    document.getElementById('user-current-role-tab').value = role;
    document.getElementById('user-email').value = item ? item.email : '';
    document.getElementById('user-role').value = item ? item.role : (role !== 'ALL' ? role : 'STAFF');
    document.getElementById('user-role-group').classList.toggle('hidden', !!item);
    document.getElementById('user-password').value = '';
    document.getElementById('user-password').required = !item;
    document.getElementById('user-password').placeholder = item
        ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน'
        : 'อย่างน้อย 8 ตัวอักษร';
    document.getElementById('user-confirm-password').value = '';
    document.getElementById('user-confirm-password').required = !item;
    document.getElementById('user-confirm-password').style.borderColor = '';
    updateUserPasswordChecklist();

    document.getElementById('user-staff-prefix').value = item?.prefix || '';
    document.getElementById('user-staff-academicTitle').value = item?.academicTitle || '';
    document.getElementById('user-staff-firstName').value = item?.firstName || '';
    document.getElementById('user-staff-lastName').value = item?.lastName || '';
    document.getElementById('user-staff-nickname').value = item?.nickname || '';
    userStaffBirthDateSelects?.setValue(item?.birthDate ? toDateInputValue(item.birthDate) : '');
    document.getElementById('user-staff-phone').value = formatPhoneNumber(item?.phone || '');
    document.getElementById('user-staff-department').value = item?.department?.id || '';
    refreshSingleCardSelect('user-staff-department');
    document.getElementById('user-staff-position').value = item?.position?.id || '';
    // สถานะ (ประกอบอาชีพ/กำลังศึกษา) ไม่มีคอลัมน์เก็บจริง เป็นแค่ตัวสลับ UI เหมือนหน้าลงทะเบียน (ดู schema.prisma: StaffProfile.faculty) เดาจากข้อมูลที่มีอยู่: มีคณะ/สาขา = กำลังศึกษา, ไม่มีแต่มีอาชีพ = ประกอบอาชีพ
    const inferredStatus = item?.faculty || item?.major ? 'studying' : (item?.occupation ? 'working' : '');
    document.getElementById('user-staff-occupationStatus').value = inferredStatus;
    applyUserStaffOccupationVisibility(inferredStatus);
    document.getElementById('user-staff-affiliation').value = item?.affiliation || '';
    document.getElementById('user-staff-occupation').value = item?.occupation || '';
    document.getElementById('user-staff-faculty').value = item?.faculty || '';
    document.getElementById('user-staff-major').value = item?.major || '';

    document.getElementById('user-participant-prefix').value = item?.prefix || '';
    document.getElementById('user-participant-firstName').value = item?.firstName || '';
    document.getElementById('user-participant-lastName').value = item?.lastName || '';
    document.getElementById('user-participant-nickname').value = item?.nickname || '';
    userParticipantBirthDateSelects?.setValue(item?.birthDate ? toDateInputValue(item.birthDate) : '');
    document.getElementById('user-participant-phone').value = formatPhoneNumber(item?.phone || '');
    document.getElementById('user-participant-parentPhone').value = formatPhoneNumber(item?.parentPhone || '');
    document.getElementById('user-participant-courseFormat').value = item?.courseFormat?.id || '';
    document.getElementById('user-participant-group').value = item?.group?.id || '';
    document.getElementById('user-participant-studyPlan').value = item?.studyPlan || '';
    document.getElementById('user-participant-studyPlanOther').value = item?.studyPlanOther || '';
    const userParticipantInterestSelect = document.getElementById('user-participant-interestSubjectGroup');
    const userParticipantInterestValues = new Set(Array.isArray(item?.interestSubjectGroup) ? item.interestSubjectGroup : []);
    Array.from(userParticipantInterestSelect.options).forEach((option) => {
        option.selected = userParticipantInterestValues.has(option.value);
    });
    refreshMultiCheckboxGroup('user-participant-interestSubjectGroup');
    document.getElementById('user-participant-interestSubjectGroupOther').value = item?.interestSubjectGroupOther || '';
    document.getElementById('user-participant-dreamInstitution').value = item?.dreamInstitution || '';

    handleUserRoleChange();
    syncStudyPlanOtherVisibility('user-participant-studyPlan', 'user-participant-studyPlanOther-group');
    syncInterestOtherVisibility('user-participant-interestSubjectGroup', 'user-participant-interestSubjectGroupOther-group');

    document.getElementById('user-modal').classList.remove('hidden');
}

function closeUserForm() {
    document.getElementById('user-modal').classList.add('hidden');
    userFormOnSaved = null;
}

function submitUserForm(event) {
    event.preventDefault();

    const id = document.getElementById('user-id').value;
    const currentRoleTab = document.getElementById('user-current-role-tab').value;
    const password = document.getElementById('user-password').value;
    const confirmPassword = document.getElementById('user-confirm-password').value;
    const confirmPasswordInput = document.getElementById('user-confirm-password');
    const role = document.getElementById('user-role').value;
    const errorBox = document.getElementById('user-form-error');
    errorBox.classList.add('hidden');
    confirmPasswordInput.style.borderColor = '';

    // ตอนแก้ไข เว้นว่างรหัสผ่านได้ (แปลว่าไม่เปลี่ยน) แต่ถ้าพิมพ์มาต้องผ่านเงื่อนไขเดียวกับหน้าอื่นเสมอ
    if (password && !checkPasswordStrength(password)) {
        errorBox.textContent = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีอย่างน้อย 3 ใน 4 ประเภทต่อไปนี้: ตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข อักขระพิเศษ';
        errorBox.classList.remove('hidden');
        return;
    }
    // เช็คตรงกับ "ยืนยันรหัสผ่าน" เหมือนหน้าลงทะเบียน (staff-form.js/form.js) เฉพาะตอนกรอกรหัสผ่านใหม่เท่านั้น เว้นว่างทั้งคู่ตอนแก้ไข = ไม่เปลี่ยนรหัสผ่าน ไม่ต้องเช็ค
    if (password && password !== confirmPassword) {
        confirmPasswordInput.style.borderColor = 'var(--rose-600)';
        errorBox.textContent = 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน';
        errorBox.classList.remove('hidden');
        return;
    }

    const payload = {
        email: document.getElementById('user-email').value.trim(),
        role,
    };
    if (password) payload.password = password;
    // ไม่ส่ง isAdmin: Admin มอบ/ถอดสิทธิ์ผู้ดูแลระบบไม่ได้ (backend ปฏิเสธ) สิทธิ์นี้จัดการได้จากแผง WebManager เท่านั้น
    if (role === 'STAFF') {
        payload.profile = {
            prefix: document.getElementById('user-staff-prefix').value,
            academicTitle: document.getElementById('user-staff-academicTitle').value.trim(),
            firstName: document.getElementById('user-staff-firstName').value.trim(),
            lastName: document.getElementById('user-staff-lastName').value.trim(),
            nickname: document.getElementById('user-staff-nickname').value.trim(),
            birthDate: document.getElementById('user-staff-birthDate').value,
            phone: document.getElementById('user-staff-phone').value.trim(),
            departmentId: document.getElementById('user-staff-department').value,
            positionId: document.getElementById('user-staff-position').value,
            affiliation: document.getElementById('user-staff-affiliation').value.trim(),
            occupation: document.getElementById('user-staff-occupation').value.trim(),
            faculty: document.getElementById('user-staff-faculty').value.trim(),
            major: document.getElementById('user-staff-major').value.trim(),
        };
    } else if (role === 'PARTICIPANT') {
        payload.profile = {
            prefix: document.getElementById('user-participant-prefix').value,
            firstName: document.getElementById('user-participant-firstName').value.trim(),
            lastName: document.getElementById('user-participant-lastName').value.trim(),
            nickname: document.getElementById('user-participant-nickname').value.trim(),
            birthDate: document.getElementById('user-participant-birthDate').value,
            phone: document.getElementById('user-participant-phone').value.trim(),
            parentPhone: document.getElementById('user-participant-parentPhone').value.trim(),
            courseFormatId: document.getElementById('user-participant-courseFormat').value,
            studyPlan: document.getElementById('user-participant-studyPlan').value,
            studyPlanOther: document.getElementById('user-participant-studyPlanOther').value.trim(),
            interestSubjectGroup: Array.from(document.getElementById('user-participant-interestSubjectGroup').selectedOptions).map((o) => o.value),
            interestSubjectGroupOther: document.getElementById('user-participant-interestSubjectGroupOther').value.trim(),
            dreamInstitution: document.getElementById('user-participant-dreamInstitution').value.trim(),
            groupId: document.getElementById('user-participant-group').value,
        };
    }

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
            const onSaved = userFormOnSaved;
            closeUserForm();
            showToast(id ? 'แก้ไขผู้ใช้งานสำเร็จ' : 'เพิ่มผู้ใช้งานสำเร็จ');
            loadUsers(currentRoleTab);
            if (payload.role !== currentRoleTab) loadUsers(payload.role);
            if (onSaved) onSaved();
        })
        .catch((error) => {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
        })
        .finally(() => {
            Loader.clearButtonLoading(submitBtn);
        });
}

async function deleteUserItem(item, role = 'ALL') {
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
const ACTIVITY_LOG_PAGE_SIZE = 30;
const activityLogItemsCache = {};
const activityLogCurrentPage = {};
const activityLogSearchQuery = {};

function loadActivityLogs(scope) {
    Loader.renderSkeletonTableRows(document.getElementById(`log-${scope}-table-body`), 4, 4);
    return fetch(`/api/activity-logs?scope=${scope}`)
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            activityLogItemsCache[scope] = items;
            activityLogCurrentPage[scope] = 1;
            renderActivityLogTable(scope);
        })
        .catch((error) => {
            console.error('โหลดประวัติการดำเนินการไม่สำเร็จ:', error);
            showToast('โหลดประวัติการดำเนินการไม่สำเร็จ', true);
        });
}

function changeActivityLogPage(scope, delta) {
    activityLogCurrentPage[scope] = (activityLogCurrentPage[scope] || 1) + delta;
    renderActivityLogTable(scope);
}

function goToActivityLogPage(scope, page) {
    activityLogCurrentPage[scope] = page;
    renderActivityLogTable(scope);
}

function updateActivityLogPagination(scope, totalCount, totalPages) {
    const pagination = document.getElementById(`log-${scope}-pagination`);
    const prevBtn = document.getElementById(`log-${scope}-prev-btn`);
    const nextBtn = document.getElementById(`log-${scope}-next-btn`);
    if (!pagination || !prevBtn || !nextBtn) return;

    pagination.classList.toggle('hidden', totalCount <= ACTIVITY_LOG_PAGE_SIZE);
    prevBtn.disabled = activityLogCurrentPage[scope] <= 1;
    nextBtn.disabled = activityLogCurrentPage[scope] >= totalPages;

    const container = document.getElementById(`log-${scope}-page-numbers`);
    if (!container) return;
    container.innerHTML = '';
    getPaginationRange(activityLogCurrentPage[scope], totalPages).forEach((page) => {
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
        btn.classList.toggle('active', page === activityLogCurrentPage[scope]);
        btn.addEventListener('click', () => goToActivityLogPage(scope, page));
        container.appendChild(btn);
    });
}

// ค้นหา: กรองจากข้อมูลทั้งหมดที่โหลดมา (ไม่ใช่แค่แถวที่แสดงอยู่หน้าปัจจุบัน) แล้วค่อยแบ่งหน้าผลลัพธ์ที่กรองแล้วอีกที
function handleActivityLogSearch(scope, query) {
    activityLogSearchQuery[scope] = query;
    activityLogCurrentPage[scope] = 1;
    renderActivityLogTable(scope);
}

function renderActivityLogTable(scope) {
    const tbody = document.getElementById(`log-${scope}-table-body`);
    const empty = document.getElementById(`log-${scope}-empty`);
    const noMatch = document.getElementById(`log-${scope}-no-match`);
    if (!tbody || !empty) return;

    const allItems = activityLogItemsCache[scope] || [];
    const query = (activityLogSearchQuery[scope] || '').trim().toLowerCase();
    const filtered = query
        ? allItems.filter((item) => `${item.actorEmail} ${item.entityType} ${item.summary}`.toLowerCase().includes(query))
        : allItems;

    tbody.innerHTML = '';

    if (allItems.length === 0) {
        empty.classList.remove('hidden');
        if (noMatch) noMatch.classList.add('hidden');
        updateActivityLogPagination(scope, 0, 1);
        return;
    }
    empty.classList.add('hidden');
    if (noMatch) noMatch.classList.toggle('hidden', filtered.length > 0);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ACTIVITY_LOG_PAGE_SIZE));
    activityLogCurrentPage[scope] = Math.min(activityLogCurrentPage[scope] || 1, totalPages);
    const start = (activityLogCurrentPage[scope] - 1) * ACTIVITY_LOG_PAGE_SIZE;
    const items = filtered.slice(start, start + ACTIVITY_LOG_PAGE_SIZE);

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

    updateActivityLogPagination(scope, filtered.length, totalPages);
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

let userStaffBirthDateSelects = null;
let userParticipantBirthDateSelects = null;

document.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    document.getElementById('news-form').addEventListener('submit', submitNewsForm);
    document.getElementById('schedule-form').addEventListener('submit', submitScheduleForm);
    document.getElementById('user-form').addEventListener('submit', submitUserForm);
    initRichTextToolbar();
    initMultiCheckboxGroup('user-participant-interestSubjectGroup');

    // date selects สำหรับช่องวันที่ใน form ข่าวและกำหนดการ (แทน input[type=date] เพื่อแก้ปัญหา iOS Safari แสดงปีพุทธศักราชเพี้ยน)
    newsPublishedAtSelects = setupDateSelects({ containerId: 'news-publishedAt-selects', hiddenId: 'news-publishedAt' });
    scheduleEventDateSelects = setupDateSelects({ containerId: 'schedule-eventDate-selects', hiddenId: 'schedule-eventDate' });
    scheduleEndDateSelects = setupDateSelects({ containerId: 'schedule-endDate-selects', hiddenId: 'schedule-endDate' });
    userStaffBirthDateSelects = setupDateSelects({ containerId: 'user-staff-birthDate-selects', hiddenId: 'user-staff-birthDate', yearsBack: 100, yearsAhead: 0 });
    userParticipantBirthDateSelects = setupDateSelects({ containerId: 'user-participant-birthDate-selects', hiddenId: 'user-participant-birthDate', yearsBack: 100, yearsAhead: 0 });

    if (localStorage.getItem('adminSidebarCollapsed') === '1') {
        const sidebar = document.querySelector('.admin-shell-sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }

    if (sessionStorage.getItem('ptnJustLoggedIn') === '1') {
        sessionStorage.removeItem('ptnJustLoggedIn');
        showToast('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับกลับเข้าสู่ระบบ');
    }

    const adminUserLoaded = loadAdminUser();
    loadRegistrationSettings();
    // ข้อมูลของแท็บอื่น ๆ (ข่าว/กำหนดการ/ทำเนียบ/ผู้ใช้) โหลดแบบ lazy ตอนเปิดแท็บนั้นจริง ๆ แทน (ดู ADMIN_TAB_LOAD_KEYS ด้านบน)
    const dashboardLoaded = initAdminDashboard();
    Promise.all([loadActivityLogs('admin'), loadActivityLogs('user')]).then(checkAdminNotificationBadge);

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

    document.getElementById('log-admin-search')?.addEventListener('input', (e) => handleActivityLogSearch('admin', e.target.value));
    document.getElementById('log-user-search')?.addEventListener('input', (e) => handleActivityLogSearch('user', e.target.value));

    // รอแค่ข้อมูลที่แดชบอร์ด (แท็บที่เห็นก่อนเสมอตอนเปิดเข้ามา) ใช้จริง ไม่รอครบทุกแท็บ/ทุกตาราง
    Promise.allSettled([adminUserLoaded, dashboardLoaded])
        .then(() => Loader.hideFullPageLoader());
});
