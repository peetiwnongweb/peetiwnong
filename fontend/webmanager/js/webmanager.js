// escape ก่อน render ผ่าน innerHTML - ใช้กับข้อความที่มาจาก activity log (summary) ซึ่งบางครั้งเป็น error message ที่ต่อมาจากปลายทางภายนอก (เช่น Google API ตอบ HTML ดิบตอน 502)
// ป้องกัน tag ที่หลุดมา (โดยเฉพาะ <style>) ไปกระทบ layout ทั้งหน้า เพราะ <style> มีผลข้ามตำแหน่งที่มันอยู่ใน DOM เสมอไม่ว่าจะซ้อนอยู่ใน element ไหน
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
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
    CAMP: 'ค่าย',
};

const ACTIVITY_ROLE_LABELS = {
    HOST: 'Host', // ค่าเก่าก่อนเปลี่ยนชื่อ role เป็น WEBMANAGER ยังต้องเก็บไว้แสดงผลประวัติการดำเนินการเก่า
    WEBMANAGER: 'WebManager',
    ADMIN: 'แอดมิน',
    STAFF: 'พี่ค่าย',
    PARTICIPANT: 'น้องค่าย',
};

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

// id ของบัญชีที่ login อยู่ตอนนี้ - ใช้กันลบตัวเองในตาราง "จัดการบัญชี Owner" (backend ก็เช็คซ้ำอีกชั้นอยู่แล้วใน deleteUser)
let currentAdminUserId = null;
// เก็บข้อมูลผู้ใช้ปัจจุบันไว้ใช้ตอนเปิดหน้าต่าง "โปรไฟล์" (พรีฟิลอีเมล)
let currentWebManagerUser = null;

function loadAdminUser() {
    return fetch('/api/auth/me')
        .then((res) => {
            if (!res.ok) throw new Error('unauthorized');
            return res.json();
        })
        .then(({ user }) => {
            currentAdminUserId = user.id;
            const isPrivilegedStaff = user.role === 'STAFF' && user.isAdmin;
            const roleLabel = ACTIVITY_ROLE_LABELS[user.role] || user.role;

            // เหมือนหน้าพี่ค่าย/หน้าแรก: ถ้ามีชื่อ-นามสกุลและตำแหน่งในโปรไฟล์ ให้ขึ้นชื่อและตำแหน่งแทน email/role ตรง ๆ
            // WebManager ไม่มีโปรไฟล์ชื่อ-นามสกุล และมีอยู่คนเดียวในระบบ จึงขึ้น "Owner" แทน email ตรง ๆ
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

            // เก็บไว้ใช้ตอนเปิดหน้าต่าง "โปรไฟล์" (พรีฟิลอีเมล) - หน้านี้เข้าได้เฉพาะ WEBMANAGER อยู่แล้วจึงไม่ต้องเช็ค role ซ้ำ
            currentWebManagerUser = user;

        })
        .catch(() => {
            window.location.href = '/webmanager/login';
        });
}

// ==========================================
// โปรไฟล์บัญชี (WebManager): แก้ไขอีเมลและรหัสผ่านของตัวเอง - ใช้ได้กับทุกบัญชี Owner ที่ล็อกอินอยู่ ไม่ผูกกับบัญชีใดบัญชีหนึ่ง
// ==========================================
function openWebManagerSettings() {
    document.getElementById('admin-user-menu').classList.add('hidden');

    document.getElementById('webmanager-email-form').reset();
    document.getElementById('webmanager-email-form-error').classList.add('hidden');
    document.getElementById('webmanager-settings-email').value = currentWebManagerUser ? currentWebManagerUser.email : '';

    document.getElementById('webmanager-password-form').reset();
    document.getElementById('webmanager-password-form-error').classList.add('hidden');
    handleWebManagerSettingsPasswordInput();

    document.getElementById('webmanager-settings-modal').classList.remove('hidden');
}

function closeWebManagerSettings() {
    document.getElementById('webmanager-settings-modal').classList.add('hidden');
}

function handleWebManagerSettingsPasswordInput() {
    const hint = document.getElementById('webmanager-settings-password-hint');
    const password = document.getElementById('webmanager-new-password').value;
    if (!hint) return;
    if (!password) {
        hint.className = 'password-hint';
        hint.innerText = 'อย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลข';
        return;
    }
    const isValid = checkPasswordStrength(password);
    hint.className = `password-hint ${isValid ? 'valid' : 'invalid'}`;
    hint.innerText = isValid
        ? '✓ รหัสผ่านผ่านมาตรฐานความปลอดภัย'
        : 'ต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลขอย่างละ 1 ตัวขึ้นไป';
}

function submitWebManagerEmailForm(event) {
    event.preventDefault();
    if (!currentWebManagerUser) return;

    const email = document.getElementById('webmanager-settings-email').value.trim();
    const errorBox = document.getElementById('webmanager-email-form-error');
    errorBox.classList.add('hidden');

    fetch(`/api/users/${currentWebManagerUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            showToast('บันทึกอีเมลสำเร็จ');
            loadAdminUser();
            loadOwners();
        })
        .catch((error) => {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
        });
}

function submitWebManagerPasswordForm(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('webmanager-current-password').value;
    const newPassword = document.getElementById('webmanager-new-password').value;
    const confirmPassword = document.getElementById('webmanager-confirm-password').value;
    const errorBox = document.getElementById('webmanager-password-form-error');
    errorBox.classList.add('hidden');

    if (!checkPasswordStrength(newPassword)) {
        errorBox.textContent = 'รหัสผ่านใหม่ยังไม่ผ่านมาตรฐานความปลอดภัย';
        errorBox.classList.remove('hidden');
        return;
    }
    if (newPassword !== confirmPassword) {
        errorBox.textContent = 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน';
        errorBox.classList.remove('hidden');
        return;
    }

    fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(() => {
            document.getElementById('webmanager-password-form').reset();
            handleWebManagerSettingsPasswordInput();
            showToast('เปลี่ยนรหัสผ่านสำเร็จ');
        })
        .catch((error) => {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
        });
}

async function adminLogout() {
    const confirmed = await adminConfirm('ต้องการออกจากระบบใช่หรือไม่?', { title: 'ยืนยันออกจากระบบ', confirmText: 'ออกจากระบบ' });
    if (!confirmed) return;

    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        try { sessionStorage.removeItem(WEBMANAGER_NAV_STORAGE_KEY); } catch (error) { /* private mode */ }
        window.location.href = '/webmanager/login';
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
            const lastSeen = Number(localStorage.getItem('webmanagerNotifLastSeen') || 0);
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
    const lastSeen = Number(localStorage.getItem('webmanagerNotifLastSeen') || 0);
    const dot = document.getElementById('admin-notif-dot');
    if (dot) dot.classList.toggle('hidden', lastSeen >= latest);
}

function markAdminNotificationsSeen(items) {
    if (items.length === 0) return;
    localStorage.setItem('webmanagerNotifLastSeen', String(new Date(items[0].createdAt).getTime()));
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
    localStorage.setItem('webmanagerSidebarCollapsed', collapsed ? '1' : '0');
}

function toggleAdminTheme() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (next === 'dark') {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }
    localStorage.setItem('webmanagerTheme', next);
}

const ADMIN_NAV_GROUPS = {
    home: 'home-subnav',
    staff: 'staff-subnav',
    'approve-registration': 'approve-registration-subnav',
    user: 'user-subnav',
    log: 'log-subnav',
    camps: 'camps-subnav',
};

// โหลดข้อมูลของแท็บ/หน้าแบบ lazy (ครั้งแรกที่สลับไปเปิดดูเท่านั้น) แทนที่จะยิงทุก endpoint พร้อมกันตอนเปิดหน้า WebManager
// (เดิมยิงพร้อมกัน ~18 เส้นตอน DOMContentLoaded ล้น connection pool ของ Supabase แผนฟรี (จำกัด 15 client) ได้ง่าย ๆ)
// key เดียวกันแปลว่าข้อมูลชุดเดียวกัน ใช้ร่วมกันได้หลายแท็บโดยยิงแค่ครั้งเดียว (เช่น approve-staff/staff-users คือ /api/users?role=STAFF ตัวเดียวกัน หลัง merge ไปแล้ว)
// สิ่งที่ยังคง eager ไว้ (ไม่อยู่ในระบบนี้): loadAdminUser/loadHeroCardSetting (ใช้ร่วมหลายแท็บพร้อมกัน เบาพอไม่คุ้มแยก lazy) initDashboard (lazy ในตัวอยู่แล้วต่อแท็บย่อย)
// loadActivityLogs ทั้ง 2 scope (ต้องรู้ผลไวสำหรับจุดแดงแจ้งเตือนที่เห็นได้จากทุกหน้าไม่ต้องเปิดแท็บ log)
const loadedAdminKeys = new Set();

const ADMIN_LAZY_LOADERS = {
    committee: () => loadCommittees(),
    gallery: () => loadGalleryPhotos(),
    news: () => loadNews(),
    schedule: () => loadSchedules(),
    'approve-staff': () => loadUsers('STAFF'),
    'approve-participant': () => loadUsers('PARTICIPANT'),
    owners: () => loadOwners(),
    camps: () => loadCamps(),
    'camp-backup': () => loadCampBackups(),
    lookups: () => loadLookupOptions(),
};

// แท็บ (switchAdminTab) -> รายการ key ที่ต้องโหลด แท็บที่ไม่มีในนี้ไม่ต้องโหลดอะไรเพิ่ม (ข้อมูลมากับของที่ eager อยู่แล้ว เช่น home/history-intro มากับ loadHeroCardSetting)
const ADMIN_TAB_LOAD_KEYS = {
    'approve-news': ['news'],
    news: ['news'],
    schedule: ['schedule'],
    gallery: ['gallery'],
    committee: ['committee'],
    'camp-lifecycle': ['camps'],
    'camp-backup': ['camp-backup'],
    'approve-staff': ['approve-staff', 'lookups'],
    'approve-participant': ['approve-participant', 'lookups'],
    'staff-users': ['approve-staff', 'lookups'],
    'participant-users': ['approve-participant', 'lookups'],
};

// section ที่ไม่มีแท็บย่อย (switchAdminSection เข้าตรง ไม่ผ่าน switchAdminTab) -> รายการ key ที่ต้องโหลด
const ADMIN_SECTION_LOAD_KEYS = {
    'camp-history': ['camps'],
    'create-owner': ['owners'],
};

function loadAdminLazyKeys(keys) {
    keys.forEach((key) => {
        if (loadedAdminKeys.has(key)) return;
        loadedAdminKeys.add(key);
        ADMIN_LAZY_LOADERS[key]();
    });
}

// จำตำแหน่งที่เปิดอยู่ล่าสุด (section เฉย ๆ สำหรับหน้าที่ไม่มีแท็บย่อย เช่น dashboard/participant, หรือ tab เจาะจงสำหรับหน้าที่มีแท็บย่อย)
// ไว้ใน sessionStorage กันรีเฟรชแล้วเด้งกลับไป dashboard ทุกครั้ง ค่าล่าสุดชนะเสมอไม่ว่าจะเป็น section หรือ tab
const WEBMANAGER_NAV_STORAGE_KEY = 'ptn-webmanager-nav';

function saveWebManagerNav(type, value) {
    try { sessionStorage.setItem(WEBMANAGER_NAV_STORAGE_KEY, JSON.stringify({ type, value })); } catch (error) { /* private mode */ }
}

// หา section ที่ tab หนึ่ง ๆ สังกัดอยู่ จากการไล่ขึ้นไปหา ancestor ที่ id ตรงกับค่าใน ADMIN_NAV_GROUPS
// ไล่ทีละชั้นแทนการใช้ .closest('[id$="-subnav"]') ตรง ๆ เพราะแท็บลูกหลาน (เช่น "news"/"gallery" ใต้หน้าแรก)
// อยู่ใน subnav ชั้นในซ้อนอีกที (news-subnav/history-subnav) ซึ่งไม่ใช่ค่าใน ADMIN_NAV_GROUPS ต้องไล่ต่อขึ้นไปถึง home-subnav
function getSectionForAdminTab(tab) {
    const btn = document.getElementById(`admin-tab-${tab}`);
    if (!btn) return null;
    let node = btn.parentElement;
    while (node) {
        if (node.id && Object.values(ADMIN_NAV_GROUPS).includes(node.id)) {
            return Object.keys(ADMIN_NAV_GROUPS).find((key) => ADMIN_NAV_GROUPS[key] === node.id) || null;
        }
        node = node.parentElement;
    }
    return null;
}

// เรียกตอนโหลดหน้าเพื่อกลับไปตำแหน่งเดิมที่จำไว้ (ไม่ทำอะไรถ้าไม่เคยจำไว้ - ปล่อยให้ dashboard ที่ active ไว้ใน HTML อยู่แบบเดิม)
function restoreWebManagerNav() {
    let saved = null;
    try {
        const raw = sessionStorage.getItem(WEBMANAGER_NAV_STORAGE_KEY);
        saved = raw ? JSON.parse(raw) : null;
    } catch (error) { /* private mode หรือค่าที่เก็บไว้เสีย */ }
    if (!saved) return;

    if (saved.type === 'tab' && document.getElementById(`admin-panel-${saved.value}`)) {
        const section = getSectionForAdminTab(saved.value);
        if (section) {
            switchAdminSection(section);
            switchAdminTab(saved.value);
        }
    } else if (saved.type === 'section' && document.getElementById(`admin-section-${saved.value}`)) {
        switchAdminSection(saved.value);
    }
}

function switchAdminSection(section) {
    const sidebar = document.querySelector('.admin-shell-sidebar');
    const wasCollapsedRail = !!(sidebar && sidebar.classList.contains('collapsed'));
    if (wasCollapsedRail) {
        // กดไอคอนขณะเมนูย่อ (icon rail) ให้เด้งเมนูออกมาเต็มก่อน
        sidebar.classList.remove('collapsed');
        localStorage.setItem('webmanagerSidebarCollapsed', '0');
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
    } else {
        // หน้าที่ไม่มีแท็บย่อย (dashboard, participant, create-owner) - บันทึกตัว section เองเลย
        saveWebManagerNav('section', section);
        const loadKeys = ADMIN_SECTION_LOAD_KEYS[section];
        if (loadKeys) loadAdminLazyKeys(loadKeys);
        // ทั้งหน้าเลื่อนตามเอกสาร (ไม่มี scroll container แยก) สลับ section แล้วไม่เลื่อนกลับขึ้นบน เนื้อหาสั้น ๆ จะโผล่พ้นจอถ้าเลื่อนค้างไว้จากหน้าก่อน
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// เมนูย่อยชั้นที่ 2 (เช่น "ข่าวประกาศ" ที่แตกเป็น "การอนุมัติข่าว"/"จัดการข่าว") พับ/กางแยกจากเมนูหลักด้วย toggleNewsSubnav()/toggleHistorySubnav()
// ตอนกลับมาที่แท็บลูกหลานพวกนี้ (เช่นตอนรีเฟรชแล้ว restoreWebManagerNav() เรียก switchAdminTab() ตรง ๆ) ต้องกางให้เห็นด้วย ไม่งั้นแท็บ active อยู่แต่มองไม่เห็นเพราะโดนพับซ่อน
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
    saveWebManagerNav('tab', tab);
    document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.remove('active'));
    document.querySelectorAll('.admin-shell-nav-child, .admin-shell-nav-grandchild').forEach((btn) => btn.classList.remove('active'));

    document.getElementById(`admin-panel-${tab}`).classList.add('active');
    document.getElementById(`admin-tab-${tab}`).classList.add('active');
    expandNestedSubnavForTab(tab);
    const loadKeys = ADMIN_TAB_LOAD_KEYS[tab];
    if (loadKeys) loadAdminLazyKeys(loadKeys);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ดรอปดาวน์ย่อยชั้นที่ 2 (เช่น "ข่าวประกาศ" ที่แตกเป็น "การอนุมัติข่าว"/"จัดการข่าว") แยกจาก setAdminNavGroupCollapsed
// เพราะไม่ต้องมีตรรกะเลือกลูกแรกอัตโนมัติ/พับกลุ่มอื่นแบบเมนูหลัก แค่กาง-หุบง่าย ๆ
function toggleNewsSubnav() {
    const subnav = document.getElementById('news-subnav');
    const toggle = document.getElementById('admin-tab-news-toggle');
    if (!subnav || !toggle) return;
    subnav.classList.toggle('collapsed');
    toggle.classList.toggle('expanded');
}

function toggleHistorySubnav() {
    const subnav = document.getElementById('history-subnav');
    const toggle = document.getElementById('admin-tab-history-toggle');
    if (!subnav || !toggle) return;
    subnav.classList.toggle('collapsed');
    toggle.classList.toggle('expanded');
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
    const iconEl = modal?.querySelector('.admin-confirm-icon');
    if (!modal || !messageEl || !titleEl || !okBtn) return Promise.resolve(false);

    messageEl.textContent = message;
    titleEl.textContent = options.title || 'ยืนยันการลบ';
    okBtn.textContent = options.confirmText || 'ยืนยัน';

    // สีปุ่ม/ไอคอนของ popup ต้องตรงกับสีปุ่มที่กด (เขียว = อนุมัติ, แดง = ปฏิเสธ/ลบ)
    const variant = options.variant || 'delete';
    okBtn.classList.remove('admin-confirm-ok-btn--approve', 'admin-confirm-ok-btn--reject');
    iconEl?.classList.remove('admin-confirm-icon--approve', 'admin-confirm-icon--reject');
    if (variant === 'approve') {
        okBtn.classList.add('admin-confirm-ok-btn--approve');
        iconEl?.classList.add('admin-confirm-icon--approve');
    } else if (variant === 'reject') {
        okBtn.classList.add('admin-confirm-ok-btn--reject');
        iconEl?.classList.add('admin-confirm-icon--reject');
    }

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
// แดชบอร์ด (Dashboard) - ย้ายไปอยู่ js/webmanager-dashboard.js ทั้งหมด (โหลดต่อจากไฟล์นี้ ใช้ helper เช่น escapeHtml/showToast/switchAdminSection จากไฟล์นี้ได้)
// ==========================================

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

// เหมือน adminActionButtonsHtml() แต่เพิ่มปุ่มรูปตา "ดูตัวอย่างจริงบนเว็บ" ไว้ตรงกลาง - ใช้เฉพาะตาราง "ประชาสัมพันธ์" (ข่าวที่อนุมัติแล้วเท่านั้น) จุดเดียว ไม่ใช้ร่วมกับตารางอื่นเพื่อไม่ให้ตารางที่ไม่มีตัวอย่างจริงบนเว็บ (ประธานค่าย/กำหนดการ/ผู้ใช้) มีปุ่มนี้ไปด้วยโดยไม่มีความหมาย
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

// ==========================================
// หน้าแรก (Home): สวิตช์เปิด/ปิดการ์ดเด่นประธานค่ายล่าสุดใน Hero ของหน้าเว็บหลัก
// ==========================================
// ข้อความเริ่มต้นที่ฝังอยู่ในหน้าเว็บสาธารณะ (fontend/*/) ใช้เติมในฟอร์มตอนที่ยังไม่เคยบันทึกค่าจาก WebManager
// เพื่อให้เห็นข้อความปัจจุบันจริง ๆ พร้อมแก้ไขได้เลย แทนที่จะเห็นช่องว่างเปล่า
const DEFAULT_HISTORY_TITLE = 'จุดเริ่มต้นของค่ายวิชาการ "พี่ติวน้อง"';
const DEFAULT_HISTORY_BODY = 'ค่ายวิชาการพี่ติวน้องก่อตั้งขึ้นเมื่อปีพุทธศักราช 2540 โดยกลุ่มศิษย์เก่าโรงเรียนพิมายดำรงวิทยาคม นำโดย รศ.ดร.อาคม แก้วระวัง ศิษย์เก่ารุ่นที่ 3 ด้วยความตั้งใจที่จะส่งต่อความรู้และประสบการณ์ให้แก่รุ่นน้องที่กำลังจะก้าวเข้าสู่รั้วมหาวิทยาลัย\n\nตลอดระยะเวลากว่า 28 รุ่น ค่ายแห่งนี้เติบโตขึ้นเรื่อย ๆ ทั้งในด้านจำนวนผู้เข้าร่วมและคุณภาพของกิจกรรม โดยยังคงยึดมั่นในเจตนารมณ์เดิมคือ "พี่สอนน้อง น้องส่งต่อรุ่นต่อไป" เพื่อสร้างเครือข่ายศิษย์เก่าที่เข้มแข็งและพร้อมช่วยเหลือกันตลอดไป';

// เปิดสวิตช์นี้ไม่ได้เลยถ้ายังไม่มีข้อมูลทำเนียบประธานค่ายสักคน (จะไปโชว์การ์ดว่าง/รูปพังที่หน้าแรก) - เช็คคู่กับฝั่ง server ใน siteSettingsController.js
// เรียกทั้งจาก loadCommittees() และ loadHeroCardSetting() เพราะสอง fetch นี้ไม่รู้ว่าใครเสร็จก่อนกัน
function updateHeroToggleAvailability() {
    const cardToggle = document.getElementById('hero-card-visible-toggle');
    if (!cardToggle) return;
    const hasCommitteeData = committeeItems.length > 0;
    cardToggle.disabled = !hasCommitteeData;
    cardToggle.title = hasCommitteeData ? '' : 'ยังไม่มีข้อมูลทำเนียบประธานค่าย เพิ่มข้อมูลก่อนถึงจะเปิดได้';
    if (!hasCommitteeData) cardToggle.checked = false;
}

// เปิดสวิตช์นี้ไม่ได้เลยถ้ายังไม่มีข้อมูลทำเนียบประธานค่ายสักคน (จะไปโชว์ส่วนว่างที่หน้าแรก) - เช็คคู่กับฝั่ง server ใน siteSettingsController.js
// เรียกทั้งจาก loadCommittees() และ loadHeroCardSetting() เพราะสอง fetch นี้ไม่รู้ว่าใครเสร็จก่อนกัน
function updateCommitteeSectionToggleAvailability() {
    const toggle = document.getElementById('committee-section-visible-toggle');
    if (!toggle) return;
    const hasCommitteeData = committeeItems.length > 0;
    toggle.disabled = !hasCommitteeData;
    toggle.title = hasCommitteeData ? '' : 'ยังไม่มีข้อมูลทำเนียบประธานค่าย เพิ่มข้อมูลก่อนถึงจะเปิดได้';
    if (!hasCommitteeData) toggle.checked = false;
}

// เปิดสวิตช์นี้ไม่ได้เลยถ้ายังไม่มีข่าวที่แสดงอยู่สักข่าว - เช็คคู่กับฝั่ง server ใน siteSettingsController.js
// เรียกทั้งจาก loadNews() และ loadHeroCardSetting() เพราะสอง fetch นี้ไม่รู้ว่าใครเสร็จก่อนกัน
function updateNewsSectionToggleAvailability() {
    const toggle = document.getElementById('news-section-visible-toggle');
    if (!toggle) return;
    const hasVisibleNews = newsItems.some((item) => item.isVisible);
    toggle.disabled = !hasVisibleNews;
    toggle.title = hasVisibleNews ? '' : 'ยังไม่มีประชาสัมพันธ์ที่แสดงอยู่ เพิ่มก่อนถึงจะเปิดได้';
    if (!hasVisibleNews) toggle.checked = false;
}

function loadHeroCardSetting() {
    fetch('/api/site-settings')
        .then((res) => (res.ok ? res.json() : { heroCardVisible: true, staffRegistrationOpen: true, participantRegistrationOpen: true }))
        .then((settings) => {
            const cardToggle = document.getElementById('hero-card-visible-toggle');
            if (cardToggle) cardToggle.checked = settings.heroCardVisible !== false;
            updateHeroToggleAvailability();

            const committeeSectionToggle = document.getElementById('committee-section-visible-toggle');
            if (committeeSectionToggle) committeeSectionToggle.checked = settings.committeeSectionVisible !== false;
            updateCommitteeSectionToggleAvailability();

            const newsSectionToggle = document.getElementById('news-section-visible-toggle');
            if (newsSectionToggle) newsSectionToggle.checked = settings.newsSectionVisible !== false;
            updateNewsSectionToggleAvailability();

            applyRegistrationToggleState('staff', settings.staffRegistrationOpen !== false);
            // ต้องมีค่ายที่กำลังดำเนินการอยู่จริงด้วยเสมอ ไม่งั้นโชว์เป็น "เปิด" (สีส้ม) หลอกตา ทั้งที่จริงปิดรับอยู่ (ฝั่ง server บล็อกแล้ว แค่แสดงผลให้ตรงกัน)
            applyRegistrationToggleState('participant', settings.participantRegistrationOpen !== false && !!settings.campActive);
            applyAutoApproveToggleState('staff', !!settings.staffAutoApprove);
            applyAutoApproveToggleState('participant', !!settings.participantAutoApprove);
            applyAutoApproveToggleState('news', !!settings.newsAutoApprove);
            // loadCamps() เป็น lazy แล้ว (โหลดตอนเปิดแท็บ "ขั้นตอนดำเนินการค่าย"/"ประวัติค่าย" เท่านั้น) ถ้ายังไม่เคยโหลดอย่าเรียก ไม่งั้นจะคิดว่ายังไม่มีค่ายทั้งที่แค่ยังไม่รู้ผล (loadCamps เองก็เรียกซ้ำอีกทีตอนโหลดเสร็จจริงอยู่แล้ว)
            if (campsLoaded) updateCampLifecycleSteps();

            applyCheckRegistrationToggleState('staff', settings.checkRegistrationVisibleStaff !== false);
            applyCheckRegistrationToggleState('participant', settings.checkRegistrationVisibleParticipant !== false);

            const titleField = document.getElementById('history-intro-title');
            const bodyField = document.getElementById('history-intro-body');
            if (titleField) titleField.value = settings.historyTitle || DEFAULT_HISTORY_TITLE;
            if (bodyField) bodyField.value = settings.historyBody || DEFAULT_HISTORY_BODY;
        })
        .catch((error) => console.error('โหลดการตั้งค่าเว็บไซต์ไม่สำเร็จ:', error));
}

// สวิตช์นี้โผล่ 2 จุด (แท็บ "ขั้นตอนดำเนินการค่าย" + แท็บ "อนุมัติการลงทะเบียน") ใช้ data-attribute หา "ทุกจุด" แทน getElementById
// เพราะ id ใช้ได้แค่จุดเดียวต่อ 1 boolean ถ้ามี DOM 2 จุดต่อ id เดียวกันจะเพี้ยน (จุดที่ 2 ไม่มีวันอัปเดต)
function applyRegistrationToggleState(role, isOpen) {
    document.querySelectorAll(`[data-registration-toggle="${role}"]`).forEach((toggle) => { toggle.checked = isOpen; });
    document.querySelectorAll(`[data-registration-status-dot="${role}"]`).forEach((dot) => { dot.classList.toggle('closed', !isOpen); });
}

// รีเฟรชพรีวิวหน้าเว็บหลักในแท็บ "หน้าแรก" - ไม่ auto-refresh ตามเวลาเพราะโหลดหน้าเต็มมีต้นทุน เรียกเฉพาะตอนกดปุ่มเองหรือหลังสลับสวิตช์ที่กระทบหน้านี้สำเร็จ
function reloadHomePreview() {
    const iframe = document.getElementById('home-preview-iframe');
    if (iframe) iframe.src = iframe.src;
}

function submitHeroCardVisible(checked) {
    fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroCardVisible: checked }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            showToast(checked ? 'เปิดแสดงการ์ดเด่นใน Hero แล้ว' : 'ซ่อนการ์ดเด่นใน Hero แล้ว');
            reloadHomePreview();
        })
        .catch((error) => {
            showToast(error.message, true);
            loadHeroCardSetting(); // ย้อนสวิตช์กลับตามค่าจริงในฐานข้อมูลถ้าบันทึกไม่สำเร็จ
        });
}

function submitCommitteeSectionVisible(checked) {
    fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ committeeSectionVisible: checked }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            showToast(checked ? 'แสดงส่วนทำเนียบประธานค่ายที่หน้าแรกแล้ว' : 'ซ่อนส่วนทำเนียบประธานค่ายที่หน้าแรกแล้ว');
            reloadHomePreview();
        })
        .catch((error) => {
            showToast(error.message, true);
            loadHeroCardSetting(); // ย้อนสวิตช์กลับตามค่าจริงในฐานข้อมูลถ้าบันทึกไม่สำเร็จ
        });
}

function submitNewsSectionVisible(checked) {
    fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsSectionVisible: checked }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            showToast(checked ? 'แสดงส่วนประชาสัมพันธ์ล่าสุดที่หน้าแรกแล้ว' : 'ซ่อนส่วนประชาสัมพันธ์ล่าสุดที่หน้าแรกแล้ว');
            reloadHomePreview();
        })
        .catch((error) => {
            showToast(error.message, true);
            loadHeroCardSetting(); // ย้อนสวิตช์กลับตามค่าจริงในฐานข้อมูลถ้าบันทึกไม่สำเร็จ
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
            loadHeroCardSetting(); // ย้อนสวิตช์กลับตามค่าจริงในฐานข้อมูลถ้าบันทึกไม่สำเร็จ
        });
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
            if (campsLoaded) updateCampLifecycleSteps();
            showToast(checked ? `เปิดรับ${label}แล้ว` : `ปิดรับ${label}แล้ว`);
        })
        .catch((error) => {
            showToast(error.message, true);
            loadHeroCardSetting(); // ย้อนสวิตช์กลับตามค่าจริงในฐานข้อมูลถ้าบันทึกไม่สำเร็จ
        });
}

function applyAutoApproveToggleState(role, isAuto) {
    const toggle = document.getElementById(`${role}-auto-approve-toggle`);
    const dot = document.getElementById(`${role}-auto-approve-status-dot`);
    if (toggle) toggle.checked = isAuto;
    if (dot) dot.classList.toggle('closed', !isAuto);
}

const AUTO_APPROVE_FIELD_BY_ROLE = { staff: 'staffAutoApprove', participant: 'participantAutoApprove', news: 'newsAutoApprove' };
const AUTO_APPROVE_LABEL_BY_ROLE = { staff: 'พี่ค่าย', participant: 'น้องค่าย', news: 'ประชาสัมพันธ์' };

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
            loadHeroCardSetting(); // ย้อนสวิตช์กลับตามค่าจริงในฐานข้อมูลถ้าบันทึกไม่สำเร็จ
        });
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
            updateHeroToggleAvailability();
            updateCommitteeSectionToggleAvailability();
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

// จำ URL รูป/โลโก้เดิมตอนเปิดฟอร์มไว้ เทียบตอนบันทึกสำเร็จว่าเปลี่ยนไฟล์ไหม ถ้าเปลี่ยนค่อยลบไฟล์เก่าทิ้ง (กันเปลืองพื้นที่)
let committeeOriginalImageUrl = '';
let committeeOriginalUniversityLogoUrl = '';

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

    committeeOriginalImageUrl = item && item.imageUrl ? item.imageUrl : '';
    committeeOriginalUniversityLogoUrl = item && item.universityLogoUrl ? item.universityLogoUrl : '';

    updateCommitteeImagePreview();
    updateCommitteeLogoPreview();
    document.getElementById('committee-modal').classList.remove('hidden');
}

// อัปเดตกรอบตัวอย่างรูปภาพ/โลโก้ให้ตรงกับช่อง URL เสมอ (พิมพ์เอง/แปะลิงก์เอง หรือเปลี่ยนหลังอัปโหลดไฟล์เสร็จ)
function updateCommitteeImagePreview() {
    const url = document.getElementById('committee-imageUrl')?.value.trim();
    const wrap = document.getElementById('committee-imageUrl-preview');
    const img = document.getElementById('committee-imageUrl-preview-img');
    if (!wrap || !img) return;
    if (url) {
        img.src = url;
        wrap.classList.remove('hidden');
    } else {
        img.src = '';
        wrap.classList.add('hidden');
    }
}

function updateCommitteeLogoPreview() {
    const url = document.getElementById('committee-universityLogoUrl')?.value.trim();
    const wrap = document.getElementById('committee-universityLogoUrl-preview');
    const img = document.getElementById('committee-universityLogoUrl-preview-img');
    if (!wrap || !img) return;
    if (url) {
        img.src = url;
        wrap.classList.remove('hidden');
    } else {
        img.src = '';
        wrap.classList.add('hidden');
    }
}

// ลบไฟล์รูปเก่าทิ้งจากเซิร์ฟเวอร์ (ไม่ลบถ้า URL เป็นค่าเดิมที่ไม่เปลี่ยน หรือไม่ได้เป็นไฟล์ที่อัปโหลดไว้ในระบบเรา)
function deleteOldPresidentFileIfChanged(oldUrl, newUrl) {
    if (!oldUrl || oldUrl === newUrl) return;
    fetch('/api/presidents/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: oldUrl }),
    }).catch((error) => console.error('ลบไฟล์รูปเก่าไม่สำเร็จ:', error));
}

function closeCommitteeForm() {
    document.getElementById('committee-modal').classList.add('hidden');
}

// อัปโหลดไฟล์ (รูปประธานค่าย/โลโก้มหาวิทยาลัย/รูปที่ครอบตัดแล้ว) แล้วเอา URL ที่ได้ไปใส่ในช่อง targetFieldId ให้อัตโนมัติ
function uploadFileToPresidents(file, targetFieldId) {
    const status = document.getElementById(`${targetFieldId}-status`);
    if (status) {
        status.textContent = 'กำลังอัปโหลด...';
        status.classList.remove('hidden');
    }

    const formData = new FormData();
    formData.append('file', file, file.name || 'upload.jpg');

    // โลโก้มหาวิทยาลัยแยกเก็บลง presidents/logo/ ต่างหาก ไม่ปนกับรูปคน (ดู backend/middleware/upload.js)
    const uploadUrl = targetFieldId === 'committee-universityLogoUrl' ? '/api/presidents/upload?type=logo' : '/api/presidents/upload';

    return fetch(uploadUrl, { method: 'POST', body: formData })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(({ url }) => {
            document.getElementById(targetFieldId).value = url;
            if (status) status.classList.add('hidden');
            if (targetFieldId === 'committee-universityLogoUrl') updateCommitteeLogoPreview();
            else updateCommitteeImagePreview();
        })
        .catch((error) => {
            if (status) {
                status.textContent = `อัปโหลดไม่สำเร็จ: ${error.message}`;
                status.classList.remove('hidden');
            }
        });
}

// โลโก้มหาวิทยาลัย: อัปโหลดไฟล์เดิมตรง ๆ ไม่ผ่านตัวครอบตัดสี่เหลี่ยมจตุรัส (ดูเหตุผลในคอมเมนต์ด้านล่าง)
function uploadCommitteeUniversityLogo(event) {
    const file = event.target.files[0];
    if (!file) return;

    uploadFileToPresidents(file, 'committee-universityLogoUrl').finally(() => {
        event.target.value = '';
    });
}

// ==========================================
// ครอบตัดรูปภาพให้เป็นสี่เหลี่ยมจตุรัส ก่อนอัปโหลดจริง (ใช้กับช่อง "รูปภาพ" ของประธานค่าย
// เพราะแสดงผลในกรอบสี่เหลี่ยมจตุรัสแบบ cover: .track-profile-img
// ส่วน "โลโก้มหาวิทยาลัย" แสดงผลแบบ object-fit:contain (.university-logo) ไม่ครอบตัดอยู่แล้ว
// และโลโก้มักไม่เป็นสี่เหลี่ยมจตุรัส/มีพื้นหลังโปร่งใส เลยอัปโหลดไฟล์ตรง ๆ แทน ดู uploadCommitteeUniversityLogo()
// ==========================================
const CROP_VIEWPORT_SIZE = 320; // ต้องตรงกับ .crop-viewport ใน CSS
const CROP_OUTPUT_SIZE = 800; // ขนาดรูปสี่เหลี่ยมจตุรัสที่ครอบตัดแล้ว (พิกเซล)
let cropTargetFieldId = null;
let cropObjectUrl = null;
let cropDragState = null;
const cropState = { naturalWidth: 0, naturalHeight: 0, baseScale: 1, zoom: 1, tx: 0, ty: 0 };

function openImageCropModal(event, targetFieldId) {
    const file = event.target.files[0];
    if (!file) return;

    cropTargetFieldId = targetFieldId;
    if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    cropObjectUrl = URL.createObjectURL(file);

    const img = document.getElementById('crop-image');
    img.onload = () => {
        // baseScale = ซูมขั้นต่ำที่ทำให้รูปคลุมกรอบสี่เหลี่ยมจตุรัสพอดี (ด้านสั้นสุดของรูป = ขนาดกรอบ)
        cropState.naturalWidth = img.naturalWidth;
        cropState.naturalHeight = img.naturalHeight;
        cropState.baseScale = CROP_VIEWPORT_SIZE / Math.min(img.naturalWidth, img.naturalHeight);
        cropState.zoom = 1;
        cropState.tx = (CROP_VIEWPORT_SIZE - img.naturalWidth * cropState.baseScale) / 2;
        cropState.ty = (CROP_VIEWPORT_SIZE - img.naturalHeight * cropState.baseScale) / 2;
        document.getElementById('crop-zoom').value = '1';
        applyCropTransform();
    };
    img.src = cropObjectUrl;

    document.getElementById('crop-status').classList.add('hidden');
    document.getElementById('image-crop-modal').classList.remove('hidden');
}

// ห้ามลากรูปจนหลุดกรอบ (ต้องมีรูปคลุมเต็มกรอบสี่เหลี่ยมจตุรัสเสมอ)
function clampCropOffset() {
    const scale = cropState.baseScale * cropState.zoom;
    const dispW = cropState.naturalWidth * scale;
    const dispH = cropState.naturalHeight * scale;
    const minTx = Math.min(0, CROP_VIEWPORT_SIZE - dispW);
    const minTy = Math.min(0, CROP_VIEWPORT_SIZE - dispH);
    cropState.tx = Math.max(minTx, Math.min(0, cropState.tx));
    cropState.ty = Math.max(minTy, Math.min(0, cropState.ty));
}

function applyCropTransform() {
    clampCropOffset();
    const scale = cropState.baseScale * cropState.zoom;
    document.getElementById('crop-image').style.transform = `translate(${cropState.tx}px, ${cropState.ty}px) scale(${scale})`;
}

// ผูก event ครั้งเดียวตอนโหลดหน้า (ไม่ใช่ทุกครั้งที่เปิด modal ครอบตัด กันผูกซ้ำ)
function initImageCropHandlers() {
    const viewport = document.getElementById('crop-viewport');
    const zoomSlider = document.getElementById('crop-zoom');
    if (!viewport || !zoomSlider) return;

    viewport.addEventListener('pointerdown', (event) => {
        cropDragState = { startX: event.clientX, startY: event.clientY, startTx: cropState.tx, startTy: cropState.ty };
        viewport.classList.add('dragging');
        viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', (event) => {
        if (!cropDragState) return;
        cropState.tx = cropDragState.startTx + (event.clientX - cropDragState.startX);
        cropState.ty = cropDragState.startTy + (event.clientY - cropDragState.startY);
        applyCropTransform();
    });
    const endDrag = () => {
        cropDragState = null;
        viewport.classList.remove('dragging');
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    zoomSlider.addEventListener('input', () => {
        cropState.zoom = Number(zoomSlider.value);
        applyCropTransform();
    });
}

function cancelImageCrop() {
    document.getElementById('image-crop-modal').classList.add('hidden');
    const fileInput = document.getElementById(`${cropTargetFieldId}-file`);
    if (fileInput) fileInput.value = '';
    if (cropObjectUrl) {
        URL.revokeObjectURL(cropObjectUrl);
        cropObjectUrl = null;
    }
    cropTargetFieldId = null;
}

function confirmImageCrop() {
    const img = document.getElementById('crop-image');
    const scale = cropState.baseScale * cropState.zoom;
    const sourceSize = CROP_VIEWPORT_SIZE / scale;
    const sourceX = -cropState.tx / scale;
    const sourceY = -cropState.ty / scale;

    const canvas = document.createElement('canvas');
    canvas.width = CROP_OUTPUT_SIZE;
    canvas.height = CROP_OUTPUT_SIZE;
    canvas.getContext('2d').drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);

    const confirmBtn = document.getElementById('crop-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'กำลังบันทึก...';

    canvas.toBlob((blob) => {
        const targetFieldId = cropTargetFieldId;
        uploadFileToPresidents(blob, targetFieldId).finally(() => {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'ยืนยันครอบตัด';
            const fileInput = document.getElementById(`${targetFieldId}-file`);
            if (fileInput) fileInput.value = '';
            if (cropObjectUrl) {
                URL.revokeObjectURL(cropObjectUrl);
                cropObjectUrl = null;
            }
            cropTargetFieldId = null;
            document.getElementById('image-crop-modal').classList.add('hidden');
        });
    }, 'image/jpeg', 0.92);
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
            deleteOldPresidentFileIfChanged(committeeOriginalImageUrl, payload.imageUrl);
            deleteOldPresidentFileIfChanged(committeeOriginalUniversityLogoUrl, payload.universityLogoUrl);
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
// จัดการค่าย (Camp generations)
// ==========================================
let campStaffOptions = [];
let campDepartments = [];
let campVicePresidents = []; // [{userId, fullName, nickname}]
let campPresidentSelect = null;
let campSecretarySelect = null;
let campVicePresidentAddSelect = null;
let campDepartmentHeadSelects = {}; // departmentId -> staff-select handle
let campItemsCache = []; // เก็บผลลัพธ์ /api/camps ล่าสุดไว้ ให้ตัวบอกขั้นตอนดำเนินการค่ายอ่านสถานะได้โดยไม่ต้อง fetch ซ้ำ
// แยกจาก campItemsCache.length===0 เพราะ "ยังไม่เคยโหลด" กับ "โหลดแล้วแต่ไม่มีค่ายจริง ๆ" ต้องแยกออกจากกัน (loadCamps() เป็น lazy แล้ว อาจยังไม่เคยรันตอนที่ loadHeroCardSetting() เรียก updateCampLifecycleSteps() ก็ได้)
let campsLoaded = false;

function loadCamps() {
    Loader.renderSkeletonTableRows(document.getElementById('camps-table-body'), 5, 4);
    fetch('/api/camps')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => renderCampsTable(items))
        .catch((error) => {
            console.error('โหลดข้อมูลค่ายไม่สำเร็จ:', error);
            showToast('โหลดข้อมูลค่ายไม่สำเร็จ', true);
        });
}

function renderCampsTable(items) {
    const tbody = document.getElementById('camps-table-body');
    const empty = document.getElementById('camps-empty');
    const endBtn = document.getElementById('camp-end-btn');
    if (!tbody || !empty) return;

    empty.classList.toggle('hidden', items.length !== 0);

    tbody.innerHTML = '';
    items.forEach((camp) => {
        const vicePresidents = camp.vicePresidents.map((vp) => vp.fullName).join(', ') || '-';
        const departmentHeads = camp.departmentHeads.map((dh) => `${dh.departmentName}: ${dh.fullName}`).join(', ') || '-';
        const createdDate = new Date(camp.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const statusBadge = camp.isEnded
            ? '<span class="admin-badge admin-badge-hidden">จบแล้ว</span>'
            : '<span class="admin-badge admin-badge-current">กำลังดำเนินการ</span>';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="admin-cell-strong">ครั้งที่ ${camp.generationNo}</td>
            <td>${camp.president ? camp.president.fullName : '-'}</td>
            <td>${vicePresidents}</td>
            <td>${camp.secretary ? camp.secretary.fullName : '-'}</td>
            <td>${departmentHeads}</td>
            <td>${statusBadge}</td>
            <td>${createdDate}</td>
            <td>
                <div class="admin-row-actions">
                    <button type="button" class="admin-icon-btn admin-icon-btn-delete" aria-label="ลบ" title="ลบประวัติค่ายรุ่นนี้">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </button>
                </div>
            </td>
        `;
        row.querySelector('.admin-icon-btn-delete').addEventListener('click', () => deleteCamp(camp));
        tbody.appendChild(row);
    });

    // ปุ่ม "จบค่ายปัจจุบัน" กดได้เฉพาะตอนมีค่ายที่ยังไม่จบ (แถวแรก = ครั้งที่ล่าสุดเพราะ /api/camps เรียงจากมากไปน้อย)
    if (endBtn) endBtn.disabled = items.length === 0 || items[0].isEnded;

    campItemsCache = items;
    campsLoaded = true;
    updateCampLifecycleSteps();
}

// ลบแค่ประวัติ/ผู้ดำรงตำแหน่งของค่ายรุ่นนี้ (ไม่กระทบข้อมูลน้องค่าย/กลุ่ม/กิจกรรม/วิชาที่ผูกไว้ด้วยเลขรุ่นแบบ snapshot เฉย ๆ ดู deleteCamp ใน campController.js)
async function deleteCamp(camp) {
    const confirmed = await adminConfirm(`ลบประวัติค่ายครั้งที่ ${camp.generationNo} ใช่หรือไม่? (ไม่กระทบข้อมูลน้องค่าย/คะแนน/ตารางเรียนของรุ่นนี้)`, {
        title: 'ยืนยันการลบประวัติค่าย',
        confirmText: 'ลบ',
    });
    if (!confirmed) return;

    fetch(`/api/camps/${camp.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showToast('ลบประวัติค่ายสำเร็จ');
            loadCamps();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบประวัติค่ายไม่สำเร็จ', true);
        });
}

// ==========================================
// วิซาร์ดขั้นตอนดำเนินการค่าย: แสดงทีละขั้น เดินหน้า/ถอยหลัง หรือกดเลือกจากแถบขั้นตอนด้านบนได้เลย
// ==========================================
// 3 ขั้นตามที่ใช้งานจริง: สร้างค่าย+กำหนดคณะทำงาน (ขั้นเดียว) → ดำเนินการค่าย (ระบบวิชาการ/กิจกรรมเปิด, เปิดรับน้องค่ายอยู่ในขั้นนี้) → จบค่าย
const LIFECYCLE_STEP_ORDER = ['create', 'run', 'end'];
let currentLifecycleStepIndex = 0;
// เด้งไปขั้นที่ "current" ให้อัตโนมัติแค่ครั้งแรกที่คำนวณได้ (ตอนโหลดหน้า) ครั้งต่อ ๆ ไป (เช่น สลับสวิตช์) จะไม่ดึงผู้ใช้ออกจากขั้นที่กำลังดูอยู่
let lifecycleViewInitialized = false;

function showLifecycleStep(step) {
    const index = LIFECYCLE_STEP_ORDER.indexOf(step);
    if (index === -1) return;
    currentLifecycleStepIndex = index;
    renderLifecyclePageView();
}

function lifecycleStepNav(direction) {
    const nextIndex = currentLifecycleStepIndex + direction;
    if (nextIndex < 0 || nextIndex >= LIFECYCLE_STEP_ORDER.length) return;
    // การกดปุ่ม disabled จริงในเบราว์เซอร์ไม่ยิง onclick อยู่แล้ว แต่กันซ้ำไว้ในนี้ด้วยเผื่อถูกเรียกทางอื่น: เดินหน้าไม่ได้ถ้าขั้นปัจจุบันยังไม่เสร็จ (ถอยหลังทำได้เสมอ)
    if (direction > 0) {
        const currentStepKey = LIFECYCLE_STEP_ORDER[currentLifecycleStepIndex];
        const currentStepDone = document.querySelector(`#camp-lifecycle-pages [data-step="${currentStepKey}"]`)?.dataset.state === 'done';
        if (!currentStepDone) return;
    }
    currentLifecycleStepIndex = nextIndex;
    renderLifecyclePageView();
}

function renderLifecyclePageView() {
    const stepKey = LIFECYCLE_STEP_ORDER[currentLifecycleStepIndex];

    document.querySelectorAll('#camp-lifecycle-stepper .lifecycle-stepper-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.step === stepKey);
    });
    document.querySelectorAll('#camp-lifecycle-pages .lifecycle-page').forEach((page) => {
        page.hidden = page.dataset.step !== stepKey;
    });

    const counter = document.getElementById('lifecycle-page-counter');
    if (counter) counter.textContent = `ขั้นตอนที่ ${currentLifecycleStepIndex + 1} จาก ${LIFECYCLE_STEP_ORDER.length}`;

    const prevBtn = document.getElementById('lifecycle-prev-btn');
    const nextBtn = document.getElementById('lifecycle-next-btn');
    // ขั้นแรกไม่มีที่ให้ถอย ซ่อนปุ่ม "ก่อนหน้า" ไปเลย (ไม่ใช่แค่ disabled เพราะปุ่มนี้ไม่มีสไตล์ disabled ให้เห็นความต่าง กดไม่ได้แต่หน้าตาเหมือนกดได้)
    if (prevBtn) {
        prevBtn.disabled = currentLifecycleStepIndex === 0;
        prevBtn.classList.toggle('lifecycle-nav-btn-hidden', currentLifecycleStepIndex === 0);
    }
    if (nextBtn) {
        const isLastStep = currentLifecycleStepIndex === LIFECYCLE_STEP_ORDER.length - 1;
        // กดข้ามไปขั้นถัดไปไม่ได้จนกว่าจะดำเนินการขั้นที่กำลังดูอยู่ให้เสร็จก่อน (data-state "done" ตัวเดียวกับที่ทำให้วงกลมในแถบด้านบนเปลี่ยนเป็นติ๊กถูก)
        // ยังกดวงกลมในแถบด้านบนข้ามไปขั้นอื่นตรง ๆ ได้เสมอ (showLifecycleStep ไม่เช็คเงื่อนไขนี้) กันไม่ให้ติดตันตอนขั้นที่ไม่มีปุ่มให้ "ทำให้เสร็จ" ในหน้าตัวเอง เช่น "ดำเนินค่าย"
        const currentStepState = document.querySelector(`#camp-lifecycle-pages [data-step="${stepKey}"]`)?.dataset.state;
        // ขั้น "ดำเนินการค่าย" จะเสร็จก็ต่อเมื่อกดจบค่ายในขั้นถัดไป จึงต้องปล่อยให้ไปต่อได้ตั้งแต่ค่ายกำลังดำเนินการอยู่ (current)
        const currentStepDone = currentStepState === 'done' || (stepKey === 'run' && currentStepState === 'current');
        nextBtn.disabled = isLastStep || !currentStepDone;
        nextBtn.title = (!isLastStep && !currentStepDone)
            ? 'ดำเนินการขั้นตอนนี้ให้เสร็จก่อนถึงจะไปขั้นถัดไปได้ (หรือกดเลือกขั้นตอนจากแถบด้านบนแทนได้)'
            : '';
    }
}

// สรุปในหน้าขั้น "ดำเนินการค่าย": ค่ายไหนกำลังดำเนินการ คณะทำงานครบไหม ระบบวิชาการ/กิจกรรมเปิดหรือยัง
function renderLifecycleRunStatus(latestCamp, participantOpen) {
    const el = document.getElementById('lifecycle-run-status');
    if (!el) return;
    if (!latestCamp) {
        el.innerHTML = '<p class="admin-field-hint">ยังไม่มีค่าย - สร้างค่ายในขั้นที่ 1 ก่อน ระบบวิชาการและระบบกิจกรรมจึงจะเปิดใช้งาน</p>';
        return;
    }
    const active = !latestCamp.isEnded;
    const rows = [
        ['ค่าย', `ครั้งที่ ${latestCamp.generationNo}`, active ? '<span class="admin-badge admin-badge-current">กำลังดำเนินการ</span>' : '<span class="admin-badge admin-badge-hidden">จบแล้ว</span>'],
        ['ประธานค่าย', escapeHtml(latestCamp.president?.fullName || '-'), ''],
        ['รองประธาน', latestCamp.vicePresidents?.length ? escapeHtml(latestCamp.vicePresidents.map((vp) => vp.fullName).join(', ')) : '-', ''],
        ['เลขานุการ', escapeHtml(latestCamp.secretary?.fullName || '-'), ''],
        ['หัวหน้าฝ่าย', `${latestCamp.departmentHeads?.length || 0} ฝ่าย`, ''],
        ['ระบบวิชาการ / ระบบกิจกรรม', active ? 'เปิดใช้งาน' : 'ปิด (ค่ายจบแล้ว)', active ? '<span class="admin-badge admin-badge-create">พร้อมใช้</span>' : ''],
        ['รับลงทะเบียนน้องค่าย', participantOpen ? 'เปิดรับอยู่' : 'ปิดรับ', ''],
    ];
    el.innerHTML = `<dl class="lifecycle-run-grid">${rows.map(([k, v, badge]) => `<dt>${k}</dt><dd>${v} ${badge}</dd>`).join('')}</dl>`;
}

// เปิดสวิตช์ "เปิดรับลงทะเบียนน้องค่าย" ไม่ได้เลยถ้าไม่มีค่ายที่กำลังดำเนินการอยู่จริง (ยังไม่สร้างค่ายเลย หรือค่ายล่าสุดจบไปแล้ว) - เช็คคู่กับฝั่ง server ใน siteSettingsController.js
// ไม่บังคับ checked=false ตอนปิดใช้งาน (ต่างจากสวิตช์อื่นที่ทำแบบนั้น) เพราะ loadCamps()/loadHeroCardSetting() เป็นคนละ fetch ไม่รู้ว่าใครเสร็จก่อนกัน
// การบังคับค่าจะเสี่ยงทับค่าจริงที่เพิ่งโหลดมาจาก settings ถ้า fetch ค่ายยังโหลดไม่เสร็จตอนนั้นพอดี ปล่อยให้ applyRegistrationToggleState() เป็นคนกำหนดค่า checked แต่ผู้เดียว (มันอ่าน settings.campActive อยู่แล้ว)
function updateParticipantRegistrationToggleAvailability(campActive) {
    document.querySelectorAll('[data-registration-toggle="participant"]').forEach((toggle) => {
        toggle.disabled = !campActive;
        toggle.title = campActive ? '' : 'ต้องมีค่ายที่กำลังดำเนินการอยู่ก่อนถึงจะเปิดรับสมัครน้องค่ายได้';
    });
}

// คำนวณสถานะ (todo/current/done) ของแต่ละขั้นในแท็บ "ขั้นตอนดำเนินการค่าย" จากค่ายล่าสุด + สวิตช์เปิดลงทะเบียนปัจจุบันในหน้า
// ใช้บอกภาพรวม (สีวงกลม/ติ๊กถูก) และคุมปุ่ม "ถัดไป" ของวิซาร์ด (renderLifecyclePageView อ่าน data-state ตัวนี้ต่อ) - ไม่ได้ล็อกสวิตช์ใด ๆ ในหน้า ยังกดสวิตช์ได้ตลอดไม่ว่าจะอยู่ขั้นไหน
function updateCampLifecycleSteps() {
    const stepper = document.getElementById('camp-lifecycle-stepper');
    if (!stepper) return;

    const latestCamp = campItemsCache[0] || null;
    const hasCamp = !!latestCamp;
    const campEnded = hasCamp && latestCamp.isEnded;
    // พี่ค่ายรับสมัครได้ตลอดเวลาไม่ผูกกับขั้นตอนดำเนินการค่าย (ตัดออกจากวิซาร์ดนี้แล้ว) เหลือแค่น้องค่ายที่เปิดรับได้เฉพาะตอนเปิดค่าย
    const participantOpen = !!document.querySelector('[data-registration-toggle="participant"]')?.checked;

    updateParticipantRegistrationToggleAvailability(hasCamp && !campEnded);

    // "ดำเนินการค่าย" เริ่มทันทีที่สร้างค่ายเสร็จ (ตำแหน่งถูกกำหนดครบในขั้นสร้าง) ไม่ต้องรอเปิดรับน้องค่ายก่อน - สวิตช์เปิดรับอยู่ในหน้าขั้นนี้แทน
    const states = {
        create: hasCamp ? 'done' : 'current',
        run: !hasCamp ? 'todo' : (campEnded ? 'done' : 'current'),
        end: campEnded ? 'done' : 'todo',
    };
    renderLifecycleRunStatus(latestCamp, participantOpen);

    Object.entries(states).forEach(([step, state]) => {
        document.querySelectorAll(`#admin-panel-camp-lifecycle [data-step="${step}"]`).forEach((el) => {
            el.dataset.state = state;
        });
    });

    if (!lifecycleViewInitialized) {
        lifecycleViewInitialized = true;
        const currentStepKey = Object.entries(states).find(([, state]) => state === 'current')?.[0] || LIFECYCLE_STEP_ORDER[0];
        showLifecycleStep(currentStepKey);
    } else {
        // เรียกซ้ำทุกครั้งที่สถานะเปลี่ยน (ไม่ใช่แค่ตอนโหลดครั้งแรก) เพื่อปลดล็อกปุ่ม "ถัดไป" ทันทีถ้าขั้นที่กำลังดูอยู่เพิ่งเสร็จ (เช่น กด "สร้างค่ายใหม่" แล้วข้อมูลค่ายโหลดกลับมา)
        // ไม่ยุ่งกับ currentLifecycleStepIndex เลย ผู้ใช้ยังอยู่หน้าเดิม แค่รีเฟรชสถานะปุ่ม/หน้าที่โชว์อยู่ให้ตรงกับ data-state ล่าสุด
        renderLifecyclePageView();
    }
}

// ==========================================
// สำรองข้อมูลค่ายขึ้น Google Drive
// ==========================================
const CAMP_BACKUP_TRIGGER_LABELS = { SCHEDULED: 'อัตโนมัติ', MANUAL: 'กดเอง', CAMP_CREATE: 'ก่อนสร้างค่ายใหม่', CAMP_END: 'ก่อนลบน้องค่าย (จบค่าย)' };
const CAMP_BACKUP_STATUS_BADGES = {
    SUCCESS: '<span class="admin-badge admin-badge-create">สำเร็จ</span>',
    FAILED: '<span class="admin-badge admin-badge-delete">ล้มเหลว</span>',
    PENDING: '<span class="admin-badge admin-badge-pending">กำลังทำงาน</span>',
};

const CAMP_BACKUPS_PAGE_SIZE = 20;
let campBackupRunsCache = [];
let campBackupsCurrentPage = 1;

function loadCampBackups() {
    Loader.renderSkeletonTableRows(document.getElementById('camp-backups-table-body'), 4, 3);
    fetch('/api/camps/backups')
        .then((res) => {
            // ยังไม่ได้ตั้งค่า Google Drive/ยังไม่มี endpoint นี้ระหว่างพัฒนา - ปล่อยผ่านเงียบ ๆ ไม่ต้อง error
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((runs) => {
            if (runs === null) return;
            campBackupRunsCache = runs;
            campBackupsCurrentPage = 1;
            renderCampBackupsTable();
            updateBackupStatusStrip(runs[0] || null);
        })
        .catch((error) => console.error('โหลดประวัติการสำรองข้อมูลไม่สำเร็จ:', error));
}

function renderCampBackupsTable() {
    const tbody = document.getElementById('camp-backups-table-body');
    const empty = document.getElementById('camp-backups-empty');
    if (!tbody || !empty) return;

    const runs = campBackupRunsCache;
    empty.classList.toggle('hidden', runs.length !== 0);

    const totalPages = Math.max(1, Math.ceil(runs.length / CAMP_BACKUPS_PAGE_SIZE));
    campBackupsCurrentPage = Math.min(campBackupsCurrentPage, totalPages);
    const start = (campBackupsCurrentPage - 1) * CAMP_BACKUPS_PAGE_SIZE;
    const pageItems = runs.slice(start, start + CAMP_BACKUPS_PAGE_SIZE);

    tbody.innerHTML = pageItems.map((run) => {
        const started = new Date(run.startedAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
            <tr>
                <td>${started}</td>
                <td>${run.generationNo ? `ครั้งที่ ${run.generationNo}` : '-'}</td>
                <td>${CAMP_BACKUP_TRIGGER_LABELS[run.trigger] || run.trigger}</td>
                <td>${CAMP_BACKUP_STATUS_BADGES[run.status] || run.status}</td>
                <td>${run.fileCount}</td>
                <td>${escapeHtml(run.errorMessage) || '-'}</td>
            </tr>
        `;
    }).join('');

    updateCampBackupsPagination(runs.length, totalPages);
}

function updateCampBackupsPagination(totalCount, totalPages) {
    const pagination = document.getElementById('camp-backups-pagination');
    const prevBtn = document.getElementById('camp-backups-prev-btn');
    const nextBtn = document.getElementById('camp-backups-next-btn');
    if (!pagination || !prevBtn || !nextBtn) return;

    pagination.classList.toggle('hidden', totalCount <= CAMP_BACKUPS_PAGE_SIZE);
    prevBtn.disabled = campBackupsCurrentPage <= 1;
    nextBtn.disabled = campBackupsCurrentPage >= totalPages;
    renderCampBackupsPageNumbers(totalPages);
}

function renderCampBackupsPageNumbers(totalPages) {
    const container = document.getElementById('camp-backups-page-numbers');
    if (!container) return;

    container.innerHTML = '';
    getPaginationRange(campBackupsCurrentPage, totalPages).forEach((page) => {
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
        btn.classList.toggle('active', page === campBackupsCurrentPage);
        btn.addEventListener('click', () => goToCampBackupsPage(page));
        container.appendChild(btn);
    });
}

function goToCampBackupsPage(page) {
    campBackupsCurrentPage = page;
    renderCampBackupsTable();
}

function changeCampBackupsPage(delta) {
    campBackupsCurrentPage += delta;
    renderCampBackupsTable();
}

function updateBackupStatusStrip(latestRun) {
    const text = document.getElementById('backup-status-text');
    if (!text) return;
    if (!latestRun) {
        text.textContent = 'ยังไม่เคยสำรองข้อมูล';
        return;
    }
    const started = new Date(latestRun.startedAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const statusText = { SUCCESS: 'สำเร็จ', FAILED: 'ล้มเหลว', PENDING: 'กำลังทำงาน' }[latestRun.status] || latestRun.status;
    text.textContent = `สำรองล่าสุด: ${started} (${statusText})`;
}

async function triggerManualBackup() {
    const confirmed = await adminConfirm(
        'สำรองข้อมูลค่ายปัจจุบันขึ้น Google Drive ตอนนี้เลยหรือไม่?',
        { title: 'สำรองข้อมูล', confirmText: 'สำรองข้อมูล', variant: 'approve' },
    );
    if (!confirmed) return;

    fetch('/api/camps/backup', { method: 'POST' })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then((result) => {
            showToast(result.skipped ? 'ยังไม่ได้ตั้งค่า Google Drive ข้ามการสำรองข้อมูล' : 'สำรองข้อมูลสำเร็จ', !!result.skipped);
            loadCampBackups();
        })
        .catch((error) => {
            console.error(error);
            showToast(error.message || 'สำรองข้อมูลไม่สำเร็จ', true);
        });
}

// ดรอปดาวน์ค้นหาพี่ค่าย ใช้ซ้ำสำหรับประธาน/เลขา/รองประธาน(เพิ่มทีละคน)/หัวหน้าฝ่ายแต่ละฝ่าย
// clearAfterSelect = true สำหรับช่อง "เพิ่มรองประธาน" ที่ไม่ได้เก็บค่าค้างไว้ในตัวมันเอง แต่ผลักเข้า list ต่างหาก
function createStaffSelect(containerId, options) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    container.innerHTML = `
        <input type="text" class="form-input staff-select-input" placeholder="${options.placeholder || 'ค้นหาชื่อ หรือ ชื่อเล่น...'}" autocomplete="off">
        <input type="hidden" class="staff-select-value">
        <div class="staff-select-dropdown hidden"></div>
    `;

    const input = container.querySelector('.staff-select-input');
    const hidden = container.querySelector('.staff-select-value');
    const dropdown = container.querySelector('.staff-select-dropdown');

    function renderOptions(query) {
        const q = query.trim().toLowerCase();
        const excludeIds = options.excludeIds ? options.excludeIds() : [];
        const matches = campStaffOptions
            .filter((s) => !excludeIds.includes(s.userId))
            .filter((s) => !q || s.fullName.toLowerCase().includes(q) || (s.nickname || '').toLowerCase().includes(q));

        dropdown.innerHTML = matches.length
            ? matches.map((s) => `<div class="staff-select-option" data-user-id="${s.userId}">${s.fullName}${s.nickname ? ` (${s.nickname})` : ''}</div>`).join('')
            : '<div class="staff-select-empty">ไม่พบพี่ค่ายที่ตรงกับคำค้นหา</div>';
        dropdown.classList.remove('hidden');
    }

    // ตอน focus แสดงลิสต์เต็มเสมอ (ไม่กรองด้วยข้อความที่แสดงอยู่) เพราะถ้าเคยเลือกไปแล้ว ข้อความในช่องจะเป็น
    // "ชื่อ (ชื่อเล่น)" ซึ่งไม่ match กับ fullName/nickname ตัวใดตัวหนึ่งเดี่ยว ๆ ทำให้ดรอปดาวน์ว่างเปล่าตอนเปิดซ้ำ
    input.addEventListener('focus', () => renderOptions(''));
    input.addEventListener('input', () => renderOptions(input.value));

    // mousedown+preventDefault กันไม่ให้ input เสีย focus/blur ก่อน click ทำงาน (ดรอปดาวน์ปิดไปก่อน)
    dropdown.addEventListener('mousedown', (event) => {
        const optionEl = event.target.closest('.staff-select-option');
        if (!optionEl) return;
        event.preventDefault();
        const userId = Number(optionEl.dataset.userId);
        const staff = campStaffOptions.find((s) => s.userId === userId);
        if (!staff) return;

        options.onSelect(staff);
        if (options.clearAfterSelect) {
            input.value = '';
            hidden.value = '';
        } else {
            input.value = `${staff.fullName}${staff.nickname ? ` (${staff.nickname})` : ''}`;
            hidden.value = staff.userId;
        }
        dropdown.classList.add('hidden');
    });

    return {
        getValue: () => (hidden.value ? Number(hidden.value) : null),
        clear: () => {
            input.value = '';
            hidden.value = '';
        },
    };
}

// ปิดดรอปดาวน์ทั้งหมดเมื่อคลิกนอกกล่องของมัน (ผูก listener เดียวตอนโหลดหน้า ไม่ผูกซ้ำทุกครั้งที่เปิด modal)
function initStaffSelectGlobalClose() {
    document.addEventListener('click', (event) => {
        document.querySelectorAll('.staff-select-dropdown:not(.hidden)').forEach((dropdown) => {
            const container = dropdown.closest('.staff-select');
            if (container && !container.contains(event.target)) dropdown.classList.add('hidden');
        });
    });
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

function renderCampVicePresidentChips() {
    const container = document.getElementById('camp-vice-presidents-chips');
    if (!container) return;
    container.innerHTML = campVicePresidents.map((vp) => `
        <span class="generation-chip">
            ${vp.fullName}
            <button type="button" class="generation-chip-remove" aria-label="ลบ ${vp.fullName}" onclick="removeCampVicePresident(${vp.userId})">&times;</button>
        </span>
    `).join('');
}

function removeCampVicePresident(userId) {
    campVicePresidents = campVicePresidents.filter((vp) => vp.userId !== userId);
    renderCampVicePresidentChips();
}

// ต้องเลือกชื่อจากดรอปดาวน์ก่อน แล้วกดปุ่ม + เพื่อยืนยันเพิ่มอีกที (ไม่เพิ่มทันทีตอนคลิกเลือกชื่อ) กันเผลอกดโดนตัวเลือกที่ไม่ตั้งใจ
let campVicePresidentPendingStaff = null;

function addPendingCampVicePresident() {
    if (!campVicePresidentPendingStaff) return;
    campVicePresidents.push(campVicePresidentPendingStaff);
    renderCampVicePresidentChips();
    campVicePresidentPendingStaff = null;
    campVicePresidentAddSelect?.clear();
    document.getElementById('camp-vice-president-add-btn').disabled = true;
}

function openCampCreateForm() {
    const form = document.getElementById('camp-create-form');
    const error = document.getElementById('camp-create-form-error');
    form.reset();
    error.classList.add('hidden');
    campVicePresidents = [];
    campVicePresidentPendingStaff = null;
    renderCampVicePresidentChips();

    Promise.all([
        fetch('/api/camps/staff-options').then((res) => (res.ok ? res.json() : [])),
        fetch('/api/lookups/departments').then((res) => (res.ok ? res.json() : [])),
    ]).then(([staffOptions, departments]) => {
        campStaffOptions = staffOptions;
        // เรียงตามชื่อ (asc) ตามปกติ แต่ดันฝ่ายวิชาการขึ้นมาอยู่แถวแรกของฟอร์มนี้ (ฝ่ายที่ผูกกับระบบวิชาการโดยตรง ให้กรอกก่อนฝ่ายอื่น)
        campDepartments = [...departments].sort((a, b) => {
            if (a.name === 'ฝ่ายวิชาการ') return -1;
            if (b.name === 'ฝ่ายวิชาการ') return 1;
            return 0;
        });

        campPresidentSelect = createStaffSelect('camp-president-select', { placeholder: 'ค้นหาประธานค่าย...', onSelect: () => {} });
        campSecretarySelect = createStaffSelect('camp-secretary-select', { placeholder: 'ค้นหาเลขานุการ...', onSelect: () => {} });
        const addBtn = document.getElementById('camp-vice-president-add-btn');
        addBtn.disabled = true;
        campVicePresidentAddSelect = createStaffSelect('camp-vice-president-add-select', {
            placeholder: 'ค้นหาแล้วเลือกชื่อ แล้วกด +...',
            clearAfterSelect: false,
            excludeIds: () => campVicePresidents.map((vp) => vp.userId),
            onSelect: (staff) => {
                campVicePresidentPendingStaff = staff;
                addBtn.disabled = false;
            },
        });

        const rowsContainer = document.getElementById('camp-department-heads-rows');
        rowsContainer.innerHTML = campDepartments.map((dept) => `
            <div class="form-group camp-department-head-row">
                <label class="form-label">${dept.name}</label>
                <div class="staff-select" id="camp-dept-head-select-${dept.id}"></div>
            </div>
        `).join('');

        campDepartmentHeadSelects = {};
        departments.forEach((dept) => {
            campDepartmentHeadSelects[dept.id] = createStaffSelect(`camp-dept-head-select-${dept.id}`, {
                placeholder: `ค้นหาหัวหน้าฝ่าย${dept.name}...`,
                onSelect: () => {},
            });
        });

        document.getElementById('camp-create-modal').classList.remove('hidden');
    }).catch((err) => {
        console.error('โหลดข้อมูลสำหรับสร้างค่ายไม่สำเร็จ:', err);
        showToast('โหลดข้อมูลสำหรับสร้างค่ายไม่สำเร็จ', true);
    });
}

function closeCampCreateForm() {
    document.getElementById('camp-create-modal').classList.add('hidden');
}

function showCampFormError(message) {
    const errorBox = document.getElementById('camp-create-form-error');
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
}

async function submitCampCreateForm(event) {
    event.preventDefault();
    document.getElementById('camp-create-form-error').classList.add('hidden');

    const generationNoRaw = document.getElementById('camp-generationNo').value;
    if (!generationNoRaw) return showCampFormError('กรุณาระบุครั้งที่');

    const presidentUserId = campPresidentSelect ? campPresidentSelect.getValue() : null;
    const secretaryUserId = campSecretarySelect ? campSecretarySelect.getValue() : null;
    if (!presidentUserId) return showCampFormError('กรุณาเลือกประธานค่าย');
    if (!secretaryUserId) return showCampFormError('กรุณาเลือกเลขานุการ');
    if (campDepartments.some((dept) => !campDepartmentHeadSelects[dept.id] || !campDepartmentHeadSelects[dept.id].getValue())) {
        return showCampFormError('กรุณาเลือกหัวหน้าฝ่ายให้ครบทุกฝ่าย');
    }

    const payload = {
        generationNo: Number(generationNoRaw),
        presidentUserId,
        secretaryUserId,
        vicePresidentUserIds: campVicePresidents.map((vp) => vp.userId),
        departmentHeads: campDepartments.map((dept) => ({ departmentId: dept.id, userId: campDepartmentHeadSelects[dept.id].getValue() })),
    };

    const wipePreview = await fetch('/api/camps/wipe-preview')
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);
    const wipeLine = wipePreview
        ? `จะลบถาวร: น้องค่าย ${wipePreview.participant} คน, กลุ่ม ${wipePreview.group} กลุ่ม, กิจกรรม ${wipePreview.campActivity} รายการ, วิชา ${wipePreview.subject} วิชา, ตารางเรียน ${wipePreview.classSchedule} คาบ, เอกสาร ${wipePreview.studyDocument} ไฟล์`
        : 'จะลบข้อมูลน้องค่ายและข้อมูลการดำเนินค่ายทั้งหมดในระบบอย่างถาวร';

    const confirmed = await adminConfirm(
        `สร้างค่ายครั้งที่ ${payload.generationNo} จะสำรองข้อมูลค่ายปัจจุบันขึ้น Google Drive ก่อน แล้ว${wipeLine} และมอบตำแหน่ง/ฝ่ายให้พี่ค่ายที่เลือกทันที ยืนยันหรือไม่?`,
        { title: 'ยืนยันการสร้างค่าย', confirmText: 'ยืนยันสร้างค่าย' },
    );
    if (!confirmed) return;

    fetch('/api/camps', {
        method: 'POST',
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
            closeCampCreateForm();
            showToast(`สร้างค่ายครั้งที่ ${payload.generationNo} สำเร็จ`);
            loadCamps();
            loadUsers('STAFF');
            loadUsers('PARTICIPANT');
        })
        .catch((error) => showCampFormError(error.message));
}

async function endCurrentCamp() {
    // จบค่ายจะเก็บข้อมูลน้องค่ายทั้งหมดเป็นไฟล์ขึ้น Google Drive แล้วลบออกจากฐานข้อมูลถาวรทันที (กู้คืนไม่ได้จากในระบบ ต้องเปิดไฟล์ใน Drive เอาเอง) - เตือนให้ชัดในข้อความยืนยันเพราะเป็นการลบถาวรจริง ๆ
    const confirmed = await adminConfirm(
        'ยืนยันจบค่ายปัจจุบัน? ระบบจะเก็บข้อมูลน้องค่ายทั้งหมดเป็นไฟล์ขึ้น Google Drive แล้วลบน้องค่ายออกจากฐานข้อมูลถาวร (กู้คืนไม่ได้) และรีเซ็ตตำแหน่ง/ฝ่ายของพี่ค่ายทุกคนกลับเป็น "ทีมงานค่าย"',
        { title: 'ยืนยันจบค่าย', confirmText: 'ยืนยันจบค่าย' }, // ไม่ใส่ variant - ใช้สไตล์ delete (แดง) ตามค่าเริ่มต้น ตรงกับความจริงที่นี่คือการลบข้อมูลถาวร
    );
    if (!confirmed) return;

    fetch('/api/camps/end', { method: 'POST' })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then((result) => {
            const archiveNote = result.participantArchive?.archived
                ? ` · เก็บไฟล์น้องค่าย ${result.participantArchive.participantCount} คนขึ้น Google Drive แล้วลบออกจากระบบ`
                : '';
            showToast(`จบค่ายครั้งที่ ${result.generationNo} สำเร็จ (รีเซ็ต ${result.staffResetCount} คน)${archiveNote}`);
            loadCamps();
            loadUsers('STAFF');
            loadUsers('PARTICIPANT');
            loadCampBackups();
        })
        .catch((error) => {
            console.error(error);
            showToast(error.message || 'จบค่ายไม่สำเร็จ', true);
        });
}

// ==========================================
// ความเป็นมา (History intro text)
// ==========================================
function submitHistoryIntro(event) {
    event.preventDefault();
    const errorBox = document.getElementById('history-intro-form-error');
    errorBox.classList.add('hidden');

    const historyTitle = document.getElementById('history-intro-title').value.trim();
    const historyBody = document.getElementById('history-intro-body').value.trim();

    fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyTitle, historyBody }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            showToast('บันทึกข้อความ "ความเป็นมา" สำเร็จ');
        })
        .catch((error) => {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
        });
}

// ==========================================
// ประมวลภาพ (Gallery photos)
// ==========================================
let galleryPhotoIds = [];
const gallerySelectedIds = new Set();

function loadGalleryPhotos() {
    fetch('/api/gallery')
        .then((res) => (res.ok ? res.json() : []))
        .then((photos) => {
            const grid = document.getElementById('gallery-photo-grid');
            const empty = document.getElementById('gallery-empty');
            if (!grid || !empty) return;

            grid.innerHTML = '';
            empty.classList.toggle('hidden', photos.length > 0);

            galleryPhotoIds = photos.map((photo) => photo.id);
            gallerySelectedIds.clear();

            // เพดาน 20 รูป ตรงกับ MAX_GALLERY_PHOTOS ใน galleryController.js - โชว์ยอดปัจจุบันเทียบเพดานให้เห็นชัดว่าใกล้เต็มหรือยัง
            const countEl = document.getElementById('gallery-photo-count');
            if (countEl) countEl.textContent = `${photos.length}/20`;

            photos.forEach((photo) => {
                const card = document.createElement('div');
                card.className = 'gallery-photo-card';
                card.innerHTML = `
                    <label class="gallery-photo-checkbox-wrap admin-checkbox-wrap">
                        <input type="checkbox" class="gallery-photo-checkbox">
                        <span class="custom-checkbox"></span>
                    </label>
                    <img src="${photo.imageUrl}" alt="ภาพบรรยากาศค่าย">
                    <button type="button" class="gallery-photo-delete-btn" aria-label="ลบรูปนี้">&times;</button>
                `;
                card.querySelector('.gallery-photo-checkbox').addEventListener('change', (e) => toggleGalleryPhotoSelect(photo.id, e.target.checked, card));
                card.querySelector('.gallery-photo-delete-btn').addEventListener('click', () => deleteGalleryPhoto(photo.id));
                grid.appendChild(card);
            });

            updateGalleryBulkBar();
        })
        .catch((error) => console.error('โหลดรูปประมวลภาพไม่สำเร็จ:', error));
}

function uploadOneGalleryFile(file) {
    const formData = new FormData();
    formData.append('file', file, file.name || 'upload.jpg');

    return fetch('/api/gallery/upload', { method: 'POST', body: formData })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        });
}

// อัปโหลดได้หลายไฟล์พร้อมกัน (เลือกหลายไฟล์ หรือลากมาวางทีเดียวหลายรูป) ทีละไฟล์ตามลำดับ
// เรียก loadGalleryPhotos() แค่ครั้งเดียวตอนจบ กันกริดกระพริบ/ยิง request ซ้อนกันตอนอัปโหลดหลายรูป
async function uploadGalleryFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) {
        showToast('เลือกเฉพาะไฟล์รูปภาพเท่านั้น', true);
        return;
    }

    let successCount = 0;
    let failCount = 0;
    let lastErrorMessage = '';
    for (let i = 0; i < files.length; i += 1) {
        try {
            await uploadOneGalleryFile(files[i]);
            successCount += 1;
        } catch (error) {
            failCount += 1;
            lastErrorMessage = error.message || '';
            console.error('อัปโหลดรูปไม่สำเร็จ:', files[i].name, error);
            // เต็มโควตาแล้ว (ดู MAX_GALLERY_PHOTOS ใน galleryController.js) ไม่ต้องลองไฟล์ที่เหลือต่อ จะเจอ error เดิมซ้ำทุกไฟล์
            if (lastErrorMessage.includes('กรุณาลบรูปเก่าก่อน')) {
                failCount += files.length - i - 1;
                break;
            }
        }
    }

    if (successCount) showToast(`เพิ่มรูปประมวลภาพสำเร็จ ${successCount} รูป`);
    if (failCount) showToast(lastErrorMessage || `อัปโหลดไม่สำเร็จ ${failCount} รูป`, true);
    loadGalleryPhotos();
}

function uploadGalleryPhoto(event) {
    const input = event.target;
    uploadGalleryFiles(input.files);
    input.value = '';
}

function handleGalleryDragOver(event) {
    event.preventDefault();
    document.getElementById('gallery-dropzone').classList.add('dragging');
}

function handleGalleryDragLeave(event) {
    event.preventDefault();
    document.getElementById('gallery-dropzone').classList.remove('dragging');
}

function handleGalleryDrop(event) {
    event.preventDefault();
    document.getElementById('gallery-dropzone').classList.remove('dragging');
    uploadGalleryFiles(event.dataTransfer.files);
}

async function deleteGalleryPhoto(id) {
    const confirmed = await adminConfirm('ลบรูปนี้ใช่หรือไม่?');
    if (!confirmed) return;

    fetch(`/api/gallery/${id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showToast('ลบรูปสำเร็จ');
            loadGalleryPhotos();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบรูปไม่สำเร็จ', true);
        });
}

function toggleGalleryPhotoSelect(id, checked, cardEl) {
    if (checked) gallerySelectedIds.add(id);
    else gallerySelectedIds.delete(id);
    cardEl.classList.toggle('selected', checked);
    updateGalleryBulkBar();
}

function updateGalleryBulkBar() {
    const btn = document.getElementById('gallery-bulk-delete-btn');
    const countEl = document.getElementById('gallery-selected-count');
    const selectAllBtn = document.getElementById('gallery-select-all-btn');
    const n = gallerySelectedIds.size;

    if (btn) btn.disabled = n === 0;
    if (countEl) {
        countEl.textContent = `เลือกแล้ว ${n} รูป`;
        countEl.classList.toggle('hidden', n === 0);
    }
    if (selectAllBtn) {
        const allSelected = galleryPhotoIds.length > 0 && galleryPhotoIds.every((id) => gallerySelectedIds.has(id));
        selectAllBtn.textContent = allSelected ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมด';
    }
}

function toggleGallerySelectAll() {
    const allSelected = galleryPhotoIds.length > 0 && galleryPhotoIds.every((id) => gallerySelectedIds.has(id));
    document.querySelectorAll('#gallery-photo-grid .gallery-photo-card').forEach((card, index) => {
        const id = galleryPhotoIds[index];
        const checkbox = card.querySelector('.gallery-photo-checkbox');
        if (allSelected) {
            gallerySelectedIds.delete(id);
            if (checkbox) checkbox.checked = false;
            card.classList.remove('selected');
        } else {
            gallerySelectedIds.add(id);
            if (checkbox) checkbox.checked = true;
            card.classList.add('selected');
        }
    });
    updateGalleryBulkBar();
}

async function bulkDeleteGalleryPhotos() {
    const ids = Array.from(gallerySelectedIds);
    if (ids.length === 0) return;
    const confirmed = await adminConfirm(`ลบรูปที่เลือกไว้ ${ids.length} รูป ใช่หรือไม่?`);
    if (!confirmed) return;

    Promise.all(ids.map((id) => fetch(`/api/gallery/${id}`, { method: 'DELETE' })))
        .then((results) => {
            const failedCount = results.filter((res) => !res.ok && res.status !== 204).length;
            showToast(
                failedCount > 0 ? `ลบสำเร็จบางส่วน (ล้มเหลว ${failedCount} รูป)` : 'ลบรูปที่เลือกสำเร็จ',
                failedCount > 0
            );
            loadGalleryPhotos();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบรูปที่เลือกไม่สำเร็จ', true);
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
    Loader.renderSkeletonTableRows(document.getElementById('news-approval-table-body'), 5, 3);
    fetch('/api/news')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            // ตารางนี้ ("ประชาสัมพันธ์") คือของที่อนุมัติ/เผยแพร่จริงแล้วเท่านั้น รายการที่รออนุมัติ/ถูกปฏิเสธอยู่ในแท็บ "การอนุมัติประชาสัมพันธ์" แยกต่างหาก
            newsItems = items.filter((item) => item.approvalStatus === 'APPROVED');
            newsCurrentPage = 1;
            newsSelectedIds.clear();
            renderNewsTable();
            updateNewsSectionToggleAvailability();

            // ใช้ผลจาก fetch เดียวกันนี้อัปเดตตาราง "การอนุมัติ" ไปด้วยเลย (เดิมยิง /api/news แยกอีกรอบซ้ำซ้อนใน loadNewsApprovalQueue())
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

// อัปเดตกรอบตัวอย่างรูปภาพให้ตรงกับช่อง news-imageUrl เสมอ (พิมพ์เอง/แปะลิงก์เอง หรือเปลี่ยนหลังอัปโหลดไฟล์เสร็จ)
function updateNewsImagePreview() {
    const url = document.getElementById('news-imageUrl')?.value.trim();
    const wrap = document.getElementById('news-imageUrl-preview');
    const img = document.getElementById('news-imageUrl-preview-img');
    if (!wrap || !img) return;
    if (url) {
        img.src = url;
        wrap.classList.remove('hidden');
    } else {
        img.src = '';
        wrap.classList.add('hidden');
    }
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
            // ลบได้ทั้งจากตาราง "จัดการประชาสัมพันธ์" และตาราง "การอนุมัติ" - loadNews() อัปเดตทั้งสองตารางในตัว (ดูคอมเมนต์ในฟังก์ชัน)
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
    scheduleEventDateSelects?.setValue(item ? toDateInputValue(item.eventDate) : toDateInputValue(new Date()));
    // "วันที่สิ้นสุด" เป็นแค่ตัวช่วยคำนวณข้อความช่วงวันที่ตอนกรอกครั้งแรก ไม่มีคอลัมน์เก็บจริงใน Schedule (ดู schema) จึงไม่มีค่าให้ดึงกลับมาตอนแก้ไข เคลียร์ทุกครั้งที่เปิดฟอร์ม
    scheduleEndDateSelects?.clear();
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

    // วันที่เริ่มเป็น input[type=hidden] แล้ว (ค่ามาจาก dropdown) เบราว์เซอร์ไม่บังคับ required ให้อีกต่อไป ต้องเช็คเอง
    if (!payload.eventDate) {
        errorBox.textContent = 'กรุณาเลือกวันที่เริ่ม';
        errorBox.classList.remove('hidden');
        return;
    }

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

function resetCreateOwnerForm() {
    document.getElementById('create-owner-form').reset();
    document.getElementById('create-owner-form-error').classList.add('hidden');
    document.getElementById('create-owner-confirm-password').style.borderColor = '';
    updateCreateOwnerPasswordChecklist();
}

// รายการเงื่อนไขรหัสผ่านใต้ช่อง create-owner-password เหมือนหน้าลงทะเบียน/ฟอร์มแก้ไขผู้ใช้งาน - เกณฑ์ต้องตรงกับ isPasswordValid ฝั่ง backend (backend/lib/password.js) เสมอ
function updateCreateOwnerPasswordChecklist() {
    const password = document.getElementById('create-owner-password').value;
    const rules = {
        length: password.length >= 8,
        lower: /[a-z]/.test(password),
        upper: /[A-Z]/.test(password),
        number: /\d/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    Object.entries(rules).forEach(([rule, met]) => {
        document.querySelectorAll(`#create-owner-password-checklist [data-rule="${rule}"], #create-owner-password-checklist-categories [data-rule="${rule}"]`)
            .forEach((li) => li.classList.toggle('met', met));
    });
}

// เพิ่มบัญชี WebManager (Owner) อีกบัญชี - เฉพาะอีเมล/รหัสผ่าน ไม่มีโปรไฟล์ (WebManager ไม่มี StaffProfile/ParticipantProfile)
// backend (userController.js: createUser) เช็คซ้ำอีกชั้นว่าต้องเป็น WebManager เท่านั้นถึงจะสร้างบัญชี role WEBMANAGER ได้
function submitCreateOwnerForm(event) {
    event.preventDefault();

    const email = document.getElementById('create-owner-email').value.trim();
    const password = document.getElementById('create-owner-password').value;
    const confirmPassword = document.getElementById('create-owner-confirm-password').value;
    const confirmPasswordInput = document.getElementById('create-owner-confirm-password');
    const errorBox = document.getElementById('create-owner-form-error');
    errorBox.classList.add('hidden');
    confirmPasswordInput.style.borderColor = '';

    if (!checkPasswordStrength(password)) {
        errorBox.textContent = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีอย่างน้อย 3 ใน 4 ประเภทต่อไปนี้: ตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข อักขระพิเศษ';
        errorBox.classList.remove('hidden');
        return;
    }
    if (password !== confirmPassword) {
        confirmPasswordInput.style.borderColor = 'var(--rose-600)';
        errorBox.textContent = 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน';
        errorBox.classList.remove('hidden');
        return;
    }

    const payload = { email, password, role: 'WEBMANAGER' };

    fetch('/api/users', {
        method: 'POST',
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
            document.getElementById('create-owner-form').reset();
            showToast('เพิ่มบัญชี Owner สำเร็จ');
            loadOwners();
        })
        .catch((error) => {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
        });
}

// รายชื่อบัญชี Owner (WEBMANAGER) ทั้งหมด - reuse endpoint เดียวกับหน้า "จัดการข้อมูลผู้ใช้" (GET /api/users?role=X)
function loadOwners() {
    Loader.renderSkeletonTableRows(document.getElementById('owner-table-body'), 4, 3);
    fetch('/api/users?role=WEBMANAGER')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            renderOwnerTable(items);
        })
        .catch((error) => {
            console.error('โหลดข้อมูลบัญชี Owner ไม่สำเร็จ:', error);
            showToast('โหลดข้อมูลบัญชี Owner ไม่สำเร็จ', true);
        });
}

function renderOwnerTable(items) {
    const tbody = document.getElementById('owner-table-body');
    const empty = document.getElementById('owner-empty');
    if (!tbody) return;

    tbody.innerHTML = '';
    empty.classList.toggle('hidden', items.length > 1);

    // บัญชี Owner ที่สร้างไว้ก่อนใครในระบบ (createdAt เก่าสุด) คือบัญชีพื้นฐานของระบบ ลบไม่ได้เด็ดขาดไม่ว่าใครจะล็อกอินอยู่ก็ตาม (เช็คคู่กับฝั่ง server ใน userController.js) เอาปุ่มถังขยะออกเฉพาะบัญชีนี้เลยแทนที่จะแค่ปิดปุ่ม
    const baseOwner = items.reduce((oldest, cur) => (
        !oldest || new Date(cur.createdAt) < new Date(oldest.createdAt) ? cur : oldest
    ), null);

    items.forEach((item) => {
        const isSelf = item.id === currentAdminUserId;
        const isBase = !!baseOwner && item.id === baseOwner.id;
        const row = document.createElement('tr');
        const createdDate = new Date(item.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
        row.innerHTML = `
            <td>${item.email}${isSelf ? ' <span class="admin-badge admin-badge-current">บัญชีนี้</span>' : ''}${isBase ? ' <span class="admin-badge admin-badge-hidden">บัญชีพื้นฐานของระบบ</span>' : ''}</td>
            <td>${createdDate}</td>
            <td class="admin-col-actions">
                ${isBase ? '' : `
                <button type="button" class="admin-icon-btn admin-icon-btn-delete" style="${isSelf ? 'opacity: 0.4;' : ''}" aria-label="ลบ" title="${isSelf ? 'ลบบัญชีที่ล็อกอินอยู่ตอนนี้ไม่ได้' : 'ลบ'}">
                    ${DA_ICON_TRASH}
                </button>`}
            </td>
        `;
        const deleteBtn = row.querySelector('.admin-icon-btn-delete');
        if (deleteBtn) {
            // ตั้งใจไม่ใช้ attribute disabled เพื่อให้กดแล้วยังเด้งบอกเหตุผลได้ (ปุ่ม disabled จริง ๆ จะไม่ยิง click event เลย มีแค่ tooltip ที่ต้องชี้ค้างถึงจะเห็น)
            deleteBtn.addEventListener('click', () => {
                if (isSelf) {
                    showToast('ลบไม่ได้ เพราะเป็นบัญชีที่กำลังล็อกอินอยู่ในขณะนี้ (กันล็อกตัวเองออกจากระบบ) ให้ล็อกอินด้วยบัญชี Owner อื่นแล้วมาลบแทน', true);
                    return;
                }
                deleteOwnerItem(item);
            });
        }
        tbody.appendChild(row);
    });
}

async function deleteOwnerItem(item) {
    const confirmed = await adminConfirm(`ลบบัญชี Owner "${item.email}" ใช่หรือไม่? บัญชีนี้จะเข้าระบบไม่ได้อีกทันที`);
    if (!confirmed) return;

    fetch(`/api/users/${item.id}`, { method: 'DELETE' })
        .then(async (res) => {
            if (!res.ok && res.status !== 204) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            showToast('ลบบัญชี Owner สำเร็จ');
            loadOwners();
        })
        .catch((error) => {
            showToast(error.message || 'ลบบัญชี Owner ไม่สำเร็จ', true);
        });
}

// ==========================================
// อนุมัติการลงทะเบียน (Approve Registration)
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
        variant: approvalStatus === 'APPROVED' ? 'approve' : 'reject',
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
// การอนุมัติข่าว (พี่ค่ายทุกฝ่ายส่งข่าวเข้ามาได้ ต้องรอ WebManager อนุมัติก่อนเผยแพร่จริง) - มิเรอร์ pattern การอนุมัติการลงทะเบียนด้านบน
// ==========================================
const NEWS_APPROVAL_STATUS_BADGE = {
    PENDING: '<span class="admin-badge admin-badge-pending">กำลังพิจารณา</span>',
    REJECTED: '<span class="admin-badge admin-badge-delete">ถูกปฏิเสธ</span>',
    APPROVED: '<span class="admin-badge admin-badge-create">อนุมัติแล้ว · แสดงบนเว็บหลักจริง</span>',
};

function formatNewsAuthorName(item) {
    const profile = item.author && item.author.staffProfile;
    const fullName = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') : '';
    return fullName || (item.author && item.author.email) || '-';
}

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
            <td class="admin-cell-strong">${item.title}</td>
            <td>${formatNewsAuthorName(item)}</td>
            <td>${submittedDate}</td>
            <td>${NEWS_APPROVAL_STATUS_BADGE[item.approvalStatus] || ''}</td>
            <td>
                <div class="admin-row-actions">
                    <button type="button" class="btn-outline admin-detail-btn" style="padding: 0.4rem 0.75rem; font-size: 0.78rem;">ดูรายละเอียด</button>
                    <button type="button" class="admin-approve-btn">อนุมัติ</button>
                    <button type="button" class="admin-reject-btn">ปฏิเสธ</button>
                    <button type="button" class="admin-icon-btn admin-icon-btn-delete admin-news-approval-delete-btn" aria-label="ลบ" title="ลบทิ้งถาวร">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </button>
                </div>
            </td>
        `;
        row.querySelector('.admin-detail-btn').addEventListener('click', () => openNewsApprovalDetail(item));
        row.querySelector('.admin-approve-btn').addEventListener('click', () => setNewsApprovalStatus(item, 'APPROVED'));
        row.querySelector('.admin-reject-btn').addEventListener('click', () => setNewsApprovalStatus(item, 'REJECTED'));
        row.querySelector('.admin-news-approval-delete-btn').addEventListener('click', () => deleteNewsItem(item));
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

// ใช้ร่วมกัน 2 ทาง: (1) จากคิวอนุมัติ (showApprovalActions=true) เห็นปุ่มอนุมัติ/ปฏิเสธด้วย (2) จากตาราง "ประชาสัมพันธ์" ที่อนุมัติแล้ว (showApprovalActions=false) ดูอย่างเดียวเพราะสถานะจริงแล้ว ไม่ใช่รออนุมัติ
function renderNewsPreviewModal(item, { showApprovalActions }) {
    const grid = document.getElementById('news-approval-detail-grid');
    const preview = document.getElementById('news-approval-detail-preview');
    if (!grid || !preview) return;

    const submittedDate = new Date(item.createdAt).toLocaleDateString('th-TH', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const publishedOnlyDate = new Date(item.publishedAt).toLocaleDateString('th-TH', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    // เหลือเฉพาะข้อมูลที่ไม่ได้แสดงในหน้าข่าวจริง (สรุปย่อใช้แค่บนการ์ดหน้าแรก ไม่โผล่ในหน้ารายละเอียด) ส่วนประเภท/หัวข้อย้ายไปอยู่ในกรอบตัวอย่างด้านล่างแทนแล้ว ไม่ต้องซ้ำ
    const fields = [
        ['สรุปย่อ (ใช้บนการ์ดหน้าแรก)', item.summary],
        ['ผู้เขียน', formatNewsAuthorName(item)],
        [showApprovalActions ? 'ส่งเมื่อ' : 'เผยแพร่เมื่อ', showApprovalActions ? submittedDate : publishedOnlyDate],
    ];

    grid.innerHTML = fields
        .map(([label, value]) => `
            <div class="approval-detail-item">
                <span class="approval-detail-label">${escapeHtml(label)}</span>
                <span class="approval-detail-value">${escapeHtml(value)}</span>
            </div>
        `)
        .join('');

    // กรอบด้านล่าง render ด้วย markup/คลาส Tailwind เดียวกับ viewNewsDetail() ใน js/pages/news.js เป๊ะ (หน้ารายละเอียดข่าวจริงที่น้องค่าย/พี่ค่ายเห็นเมื่อกด "รายละเอียด")
    // ต่างจากของจริงแค่จุดเดียวคือไม่โชว์รูป fallback ตอนไม่มีรูป (ของจริงมีบั๊กอ้างไฟล์ default ที่ไม่มีอยู่จริงอยู่แล้ว - เอาออกไปเลยดีกว่าให้เห็นรูปพังในกรอบตัวอย่าง)
    const publishedDateText = new Date(item.publishedAt || item.createdAt).toLocaleDateString('th-TH', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
    const imageHtml = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="ภาพประกอบประชาสัมพันธ์" class="w-full h-48 sm:h-64 object-cover rounded-xl" style="margin-top: 1rem; cursor: zoom-in;" onclick="openImageLightbox('${escapeHtml(item.imageUrl)}')">`
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
        <div class="text-slate-600 text-sm sm:text-base leading-relaxed font-light py-2">${item.detail || ''}</div>
    `;

    document.getElementById('news-approval-detail-title').textContent = 'ตัวอย่างประชาสัมพันธ์';
    // แสดงเป็น badge สถานะจริงของประกาศนี้ (ใช้ badge ชุดเดียวกับคอลัมน์ "สถานะ" ในตาราง) แทนประโยคอธิบายยาว ๆ
    document.getElementById('news-approval-detail-subtitle').innerHTML = `สถานะ: ${NEWS_APPROVAL_STATUS_BADGE[item.approvalStatus] || ''}`;

    const actionsWrap = document.getElementById('news-approval-detail-actions');
    if (actionsWrap) actionsWrap.classList.toggle('hidden', !showApprovalActions);

    if (showApprovalActions) {
        const approveBtn = document.getElementById('news-approval-detail-approve-btn');
        const rejectBtn = document.getElementById('news-approval-detail-reject-btn');
        approveBtn.onclick = () => { closeNewsApprovalDetail(); setNewsApprovalStatus(item, 'APPROVED'); };
        rejectBtn.onclick = () => { closeNewsApprovalDetail(); setNewsApprovalStatus(item, 'REJECTED'); };
    }

    document.getElementById('news-approval-detail-modal').classList.remove('hidden');
}

function openNewsApprovalDetail(item) {
    renderNewsPreviewModal(item, { showApprovalActions: true });
}

// ปุ่มรูปตา (👁) ในตาราง "ประชาสัมพันธ์" (จัดการ) - เฉพาะข่าวที่อนุมัติแล้วเท่านั้นที่อยู่ในตารางนี้ จึงดูอย่างเดียว ไม่มีปุ่มอนุมัติ/ปฏิเสธ
function openNewsPreview(item) {
    renderNewsPreviewModal(item, { showApprovalActions: false });
}

function closeNewsApprovalDetail() {
    document.getElementById('news-approval-detail-modal').classList.add('hidden');
}

// ดูรูปเต็มจอ ไม่ครอบตัด - ใช้ร่วมกันได้ทุกจุดที่มีรูปในกรอบเล็ก (ตอนนี้ใช้กับรูปประกอบในตัวอย่างประชาสัมพันธ์)
function openImageLightbox(url) {
    document.getElementById('image-lightbox-img').src = url;
    document.getElementById('image-lightbox-modal').classList.remove('hidden');
}

function closeImageLightbox() {
    document.getElementById('image-lightbox-modal').classList.add('hidden');
    document.getElementById('image-lightbox-img').src = '';
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
    Loader.renderSkeletonTableRows(document.getElementById(`approval-table-body-${role}`), 5, 3);
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

            // ใช้ผลจาก fetch เดียวกันนี้อัปเดตตาราง "คำขอลงทะเบียน" ไปด้วยเลย (เดิมยิง /api/users?role= แยกอีกรอบซ้ำซ้อนใน loadApprovalQueue())
            const pendingItems = items.filter((item) => item.approvalStatus !== 'APPROVED');
            renderApprovalTable(role, pendingItems);
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

function handleUserRoleChange() {
    const isStaff = document.getElementById('user-role').value === 'STAFF';

    const isadminRow = document.getElementById('user-isadmin-row');
    if (isadminRow) {
        isadminRow.classList.toggle('hidden', !isStaff);
        if (!isStaff) document.getElementById('user-isAdmin').checked = false;
    }

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
    document.getElementById('user-role').value = item ? item.role : role;
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
    document.getElementById('user-isAdmin').checked = !!(item && item.isAdmin);

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
    // แผงนี้เข้าได้เฉพาะ WebManager เท่านั้น จึงมอบ/ถอดสิทธิ์ผู้ดูแลระบบ (isAdmin) ให้พี่ค่ายได้เสมอ
    if (role === 'STAFF') {
        payload.isAdmin = document.getElementById('user-isAdmin').checked;
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
// งานกิจกรรมและสันทนาการ (แผง "พี่ค่าย" > ฝ่ายกิจกรรมและสันทนาการ)
// พอร์ตมาจาก fontend/public/js/pages/staff-activities.js (หน้า /staff/activities) มาใช้ภายใน WebManager
// ตั้งชื่อ id/ฟังก์ชันขึ้นต้นด้วย "da" (Department Activity) กันชนกับของเดิมในไฟล์นี้ทั้งหมด
// WebManager มีสิทธิ์จัดการกลุ่มเต็มอยู่แล้วเสมอ (ดู requireGroupManagementAccess) จึงไม่ต้องเช็คสิทธิ์แยกเหมือนหน้า /staff/
// ==========================================
const DA_ICON_EDIT = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
</svg>`;
const DA_ICON_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
</svg>`;
const DA_ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
</svg>`;

function daSwitchTab(tab) {
    document.querySelectorAll('.da-tab-content').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.da-tab-btn').forEach((btn) => btn.classList.remove('active'));
    document.getElementById(`da-tab-${tab}`)?.classList.add('active');
    document.getElementById(`da-tab-btn-${tab}`)?.classList.add('active');
}

// ---------- สร้างกิจกรรม ----------
let daCampActivities = [];

function daLoadCampActivities() {
    return fetch('/api/camp-activities')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            daCampActivities = items;
            daRenderActivityList();
            daRenderScoreActivitySelect();
        })
        .catch((error) => {
            console.error('โหลดรายการกิจกรรมไม่สำเร็จ:', error);
            showToast('โหลดรายการกิจกรรมไม่สำเร็จ', true);
        });
}

function daRenderActivityList() {
    const list = document.getElementById('da-activity-list');
    const empty = document.getElementById('da-activity-list-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    empty.classList.toggle('hidden', daCampActivities.length !== 0);

    daCampActivities.forEach((activity) => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div>
                <p class="activity-item-name">${activity.name}</p>
                ${activity.description ? `<p class="activity-item-desc">${activity.description}</p>` : ''}
            </div>
            <div class="activity-item-actions">
                <button type="button" class="activity-icon-btn edit" title="แก้ไข">${DA_ICON_EDIT}</button>
                <button type="button" class="activity-icon-btn delete" title="ลบ">${DA_ICON_TRASH}</button>
            </div>
        `;
        item.querySelector('.edit').addEventListener('click', () => daOpenActivityEditForm(item, activity));
        item.querySelector('.delete').addEventListener('click', () => daDeleteCampActivity(activity));
        list.appendChild(item);
    });
}

function daOpenActivityEditForm(itemEl, activity) {
    itemEl.innerHTML = `
        <form class="activity-edit-form" style="width: 100%;">
            <div class="form-group mb-6">
                <label class="form-label">ชื่อกิจกรรม *</label>
                <input type="text" class="form-input" id="da-activity-edit-name" value="${activity.name}" required>
            </div>
            <div class="form-group">
                <label class="form-label">รายละเอียด</label>
                <textarea class="form-input" id="da-activity-edit-desc" rows="3">${activity.description || ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-outline" id="da-activity-edit-cancel">ยกเลิก</button>
                <button type="submit" class="btn-primary">บันทึก</button>
            </div>
        </form>
    `;
    itemEl.querySelector('#da-activity-edit-cancel').addEventListener('click', () => daRenderActivityList());
    itemEl.querySelector('.activity-edit-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const name = itemEl.querySelector('#da-activity-edit-name').value.trim();
        const description = itemEl.querySelector('#da-activity-edit-desc').value.trim();
        daUpdateCampActivity(activity.id, { name, description });
    });
}

function daUpdateCampActivity(id, payload) {
    fetch(`/api/camp-activities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast('บันทึกกิจกรรมสำเร็จ');
            daLoadCampActivities();
        })
        .catch((error) => {
            console.error(error);
            showToast('บันทึกกิจกรรมไม่สำเร็จ', true);
        });
}

async function daDeleteCampActivity(activity) {
    const confirmed = await adminConfirm(`ลบกิจกรรม "${activity.name}" ใช่หรือไม่? คะแนนของกิจกรรมนี้จะถูกลบไปด้วย`, { confirmText: 'ลบ' });
    if (!confirmed) return;

    fetch(`/api/camp-activities/${activity.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showToast('ลบกิจกรรมสำเร็จ');
            daLoadCampActivities();
            daLoadLeaderboard();
            daLoadScoreHistoryLog();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบกิจกรรมไม่สำเร็จ', true);
        });
}

function daHandleActivityCreateSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById('da-activity-name-input');
    const descInput = document.getElementById('da-activity-desc-input');
    const name = nameInput.value.trim();
    const description = descInput.value.trim();

    fetch('/api/camp-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            nameInput.value = '';
            descInput.value = '';
            showToast('เพิ่มกิจกรรมสำเร็จ');
            daLoadCampActivities();
        })
        .catch((error) => {
            console.error(error);
            showToast('เพิ่มกิจกรรมไม่สำเร็จ', true);
        });
}

// ---------- บันทึกคะแนน ----------
let daGroupsCache = [];

function daRenderScoreActivitySelect() {
    const select = document.getElementById('da-score-activity-select');
    if (!select) return;

    const previousValue = select.value;
    select.innerHTML = '<option value="">-- เลือกกิจกรรม --</option>' +
        daCampActivities.map((a) => `<option value="${a.id}">${a.name}</option>`).join('');
    if (daCampActivities.some((a) => String(a.id) === previousValue)) {
        select.value = previousValue;
    }
}

function daLoadLeaderboard() {
    fetch('/api/camp-activities/scores/summary')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((summary) => {
            const list = document.getElementById('da-leaderboard-list');
            const empty = document.getElementById('da-leaderboard-empty');
            if (!list || !empty) return;

            list.innerHTML = '';
            empty.classList.toggle('hidden', summary.length !== 0);

            summary.forEach((row, index) => {
                const rowEl = document.createElement('div');
                rowEl.className = 'leaderboard-row';
                rowEl.innerHTML = `
                    <span class="leaderboard-rank">${index + 1}</span>
                    <span class="leaderboard-name">${row.groupName}</span>
                    <span class="leaderboard-score">${row.totalScore} คะแนน</span>
                `;
                list.appendChild(rowEl);
            });
        })
        .catch((error) => console.error('โหลดอันดับคะแนนไม่สำเร็จ:', error));
}

function daHandleScoreActivityChange() {
    const select = document.getElementById('da-score-activity-select');
    const activityId = select.value;
    const list = document.getElementById('da-score-group-list');
    const empty = document.getElementById('da-score-group-list-empty');
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
        daGroupsCache.length ? Promise.resolve(daGroupsCache) : fetch('/api/groups').then((res) => res.json()),
    ])
        .then(([scores, groups]) => {
            daGroupsCache = groups;
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
                    daSaveGroupScore(activityId, group.id, Number(input.value));
                });
                list.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('โหลดคะแนนของกิจกรรมไม่สำเร็จ:', error);
            showToast('โหลดคะแนนของกิจกรรมไม่สำเร็จ', true);
        });
}

function daSaveGroupScore(activityId, groupId, score) {
    fetch(`/api/camp-activities/${activityId}/scores/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast('บันทึกคะแนนสำเร็จ');
            daLoadLeaderboard();
            daLoadScoreHistoryLog();
        })
        .catch((error) => {
            console.error(error);
            showToast('บันทึกคะแนนไม่สำเร็จ', true);
        });
}

function daLoadScoreHistoryLog() {
    const list = document.getElementById('da-score-history-log-list');
    const empty = document.getElementById('da-score-history-log-empty');
    if (!list || !empty) return;

    fetch('/api/camp-activities/scores/history')
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
                    <button type="button" class="score-history-log-delete-btn" title="ลบ">${DA_ICON_TRASH}</button>
                `;
                row.querySelector('.score-history-log-delete-btn').addEventListener('click', () => daDeleteScoreHistoryEntry(entry));
                list.appendChild(row);
            });
        })
        .catch((error) => console.error('โหลดประวัติการบันทึกคะแนนไม่สำเร็จ:', error));
}

async function daDeleteScoreHistoryEntry(entry) {
    const confirmed = await adminConfirm(`ลบคะแนนกลุ่ม "${entry.groupName}" ในกิจกรรม "${entry.activityName}" (${entry.score} คะแนน) ใช่หรือไม่?`, { confirmText: 'ลบ' });
    if (!confirmed) return;

    fetch(`/api/camp-activities/${entry.activityId}/scores/${entry.groupId}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showToast('ลบคะแนนสำเร็จ');
            daLoadScoreHistoryLog();
            daLoadLeaderboard();
            const select = document.getElementById('da-score-activity-select');
            if (select && select.value === String(entry.activityId)) daHandleScoreActivityChange();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบคะแนนไม่สำเร็จ', true);
        });
}

// ---------- จัดการกลุ่ม ----------
let daGroups = [];
let daUnassignedParticipants = [];

function daLoadGroups() {
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
            daGroups = groupItems;
            daGroupsCache = groupItems;
            daUnassignedParticipants = unassignedItems;
            daRenderGroupList();
        })
        .catch((error) => {
            console.error('โหลดรายชื่อกลุ่มไม่สำเร็จ:', error);
            showToast('โหลดรายชื่อกลุ่มไม่สำเร็จ', true);
        });
}

function daRenderGroupList() {
    const list = document.getElementById('da-group-list');
    const empty = document.getElementById('da-group-list-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    empty.classList.toggle('hidden', daGroups.length !== 0);

    daGroups.forEach((group) => {
        const card = document.createElement('div');
        card.className = 'group-card';

        const membersHtml = group.members.length
            ? group.members.map((m) => `
                <div class="group-member-row" data-participant-id="${m.id}">
                    <span class="group-member-name">${m.fullName}${m.nickname ? ` (${m.nickname})` : ''}</span>
                    <button type="button" class="group-member-remove-btn" title="ลบออกจากกลุ่ม">${DA_ICON_CLOSE}</button>
                </div>
            `).join('')
            : '<p class="group-member-empty">ยังไม่มีสมาชิกในกลุ่มนี้</p>';

        card.innerHTML = `
            <div class="group-card-header">
                <div class="group-card-title">
                    ${group.name}
                    <span class="group-card-count">${group.members.length} คน</span>
                </div>
                <button type="button" class="group-delete-btn" title="ลบกลุ่ม">${DA_ICON_TRASH}</button>
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

        card.querySelector('.group-delete-btn').addEventListener('click', () => daDeleteGroup(group));
        card.querySelectorAll('.group-member-remove-btn').forEach((btn) => {
            const row = btn.closest('.group-member-row');
            const participantId = Number(row.dataset.participantId);
            btn.addEventListener('click', () => daRemoveGroupMember(group, participantId));
        });

        daSetupMemberSearch(card, group);

        list.appendChild(card);
    });
}

function daSetupMemberSearch(card, group) {
    const wrap = card.querySelector('.member-search-wrap');
    const input = wrap.querySelector('.member-search-input');
    const results = wrap.querySelector('.member-search-results');
    let selectedParticipantId = null;

    function renderResults(query) {
        const q = query.trim().toLowerCase();
        const matches = daUnassignedParticipants.filter((p) => {
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
                    const p = daUnassignedParticipants.find((x) => x.id === Number(btn.dataset.participantId));
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
            showToast('กรุณาเลือกชื่อจากรายการค้นหาก่อน', true);
            return;
        }
        daAddGroupMember(group, selectedParticipantId);
    });
}

function daHandleGroupCreateSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('da-group-name-input');
    const name = input.value.trim();

    fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            input.value = '';
            showToast('เพิ่มกลุ่มสำเร็จ');
            daLoadGroups();
        })
        .catch((error) => {
            console.error(error);
            showToast('เพิ่มกลุ่มไม่สำเร็จ', true);
        });
}

async function daDeleteGroup(group) {
    const confirmed = await adminConfirm(`ลบกลุ่ม "${group.name}" ใช่หรือไม่? สมาชิกในกลุ่มจะไม่ถูกลบ แค่จะไม่มีกลุ่มเท่านั้น`, { confirmText: 'ลบ' });
    if (!confirmed) return;

    fetch(`/api/groups/${group.id}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showToast('ลบกลุ่มสำเร็จ');
            daLoadGroups();
        })
        .catch((error) => {
            console.error(error);
            showToast('ลบกลุ่มไม่สำเร็จ', true);
        });
}

function daAddGroupMember(group, participantId) {
    fetch(`/api/groups/${group.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
    })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast('เพิ่มสมาชิกสำเร็จ');
            daLoadGroups();
        })
        .catch((error) => {
            console.error(error);
            showToast('เพิ่มสมาชิกไม่สำเร็จ', true);
        });
}

async function daRemoveGroupMember(group, participantId) {
    const confirmed = await adminConfirm('นำสมาชิกคนนี้ออกจากกลุ่มใช่หรือไม่?', { confirmText: 'นำออก' });
    if (!confirmed) return;

    fetch(`/api/groups/${group.id}/members/${participantId}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
            showToast('นำสมาชิกออกจากกลุ่มสำเร็จ');
            daLoadGroups();
        })
        .catch((error) => {
            console.error(error);
            showToast('นำสมาชิกออกจากกลุ่มไม่สำเร็จ', true);
        });
}

function daInit() {
    document.getElementById('da-activity-create-form')?.addEventListener('submit', daHandleActivityCreateSubmit);
    document.getElementById('da-group-create-form')?.addEventListener('submit', daHandleGroupCreateSubmit);
    document.getElementById('da-score-activity-select')?.addEventListener('change', daHandleScoreActivityChange);

    daLoadCampActivities();
    daLoadLeaderboard();
    daLoadScoreHistoryLog();
    daLoadGroups();
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

// ตัวควบคุม dropdown วัน/เดือน/ปี ของทุกช่องวันที่ในแผงนี้ (setupDateSelects) แทน input[type=date] เดิม
// เหตุผล: iOS Safari ถ้าเครื่องตั้งปฏิทินเป็นพุทธศักราชจะโชว์ปีเพี้ยนในตัวเลือกวันที่ของระบบ งงว่าต้องกรอกปีอะไร (ดู date-select.js)
let newsPublishedAtSelects = null;
let scheduleEventDateSelects = null;
let scheduleEndDateSelects = null;
let userStaffBirthDateSelects = null;
let userParticipantBirthDateSelects = null;

document.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    document.getElementById('committee-form').addEventListener('submit', submitCommitteeForm);
    document.getElementById('news-form').addEventListener('submit', submitNewsForm);
    document.getElementById('schedule-form').addEventListener('submit', submitScheduleForm);
    document.getElementById('user-form').addEventListener('submit', submitUserForm);
    document.getElementById('history-intro-form').addEventListener('submit', submitHistoryIntro);
    document.getElementById('camp-create-form').addEventListener('submit', submitCampCreateForm);
    initRichTextToolbar();
    initStaffSelectGlobalClose();
    initMultiCheckboxGroup('user-participant-interestSubjectGroup');

    // วันที่ข่าว-กำหนดการ: ใช้ช่วงเริ่มต้นของ setupDateSelects (1 ปีก่อน-หลังปีปัจจุบัน) พอสำหรับงานประจำวัน
    newsPublishedAtSelects = setupDateSelects({ containerId: 'news-publishedAt-selects', hiddenId: 'news-publishedAt' });
    scheduleEventDateSelects = setupDateSelects({ containerId: 'schedule-eventDate-selects', hiddenId: 'schedule-eventDate' });
    scheduleEndDateSelects = setupDateSelects({ containerId: 'schedule-endDate-selects', hiddenId: 'schedule-endDate' });
    userStaffBirthDateSelects = setupDateSelects({ containerId: 'user-staff-birthDate-selects', hiddenId: 'user-staff-birthDate', yearsBack: 100, yearsAhead: 0 });
    userParticipantBirthDateSelects = setupDateSelects({ containerId: 'user-participant-birthDate-selects', hiddenId: 'user-participant-birthDate', yearsBack: 100, yearsAhead: 0 });

    if (localStorage.getItem('webmanagerSidebarCollapsed') === '1') {
        const sidebar = document.querySelector('.admin-shell-sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }

    if (sessionStorage.getItem('ptnJustLoggedIn') === '1') {
        sessionStorage.removeItem('ptnJustLoggedIn');
        showToast('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับกลับเข้าสู่ระบบ');
    }

    const adminUserLoaded = loadAdminUser();
    restoreWebManagerNav();
    loadHeroCardSetting();
    initImageCropHandlers();
    // ข้อมูลของแท็บอื่น ๆ (ข่าว/กำหนดการ/ผู้ใช้/เจ้าของระบบ/ค่าย/สำรองข้อมูล/lookup) โหลดแบบ lazy ตอนเปิดแท็บนั้นจริง ๆ แทน (ดู ADMIN_TAB_LOAD_KEYS/ADMIN_SECTION_LOAD_KEYS ด้านบน)
    // restoreWebManagerNav() ด้านบนได้ trigger การโหลดของแท็บที่จำไว้ล่าสุดไปแล้วถ้ามี ผ่าน switchAdminTab/switchAdminSection
    const dashboardLoaded = initDashboard();
    Promise.all([loadActivityLogs('admin'), loadActivityLogs('user')]).then(checkAdminNotificationBadge);

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

    document.getElementById('log-admin-search')?.addEventListener('input', (e) => handleActivityLogSearch('admin', e.target.value));
    document.getElementById('log-user-search')?.addEventListener('input', (e) => handleActivityLogSearch('user', e.target.value));

    // รอแค่ข้อมูลที่แดชบอร์ด (แท็บที่เห็นก่อนเสมอตอนเปิดเข้ามา) ใช้จริง ไม่รอครบทุกแท็บ/ทุกตาราง (มีเยอะมาก หลายอันโหลดหลังบ้านเงียบ ๆ ไปเรื่อย ๆ ได้โดยไม่ต้องกันผู้ใช้ไว้)
    Promise.allSettled([adminUserLoaded, dashboardLoaded])
        .then(() => Loader.hideFullPageLoader());
});
