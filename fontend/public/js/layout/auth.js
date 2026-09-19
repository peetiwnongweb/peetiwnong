let selectedAuthRole = 'PARTICIPANT';
let forgotPasswordEmail = '';
let verifiedOtpCode = '';
let authOtpController = null;
let authResendCooldown = null;
// loginUser() กับ loadRegistrationOpenSetting() ต่างก็ยิง fetch ตอน DOMContentLoaded พร้อมกัน
// และแย่งกันคุม class "hidden" ของปุ่ม hero-register-*-btn เหมือนกัน ใครเสร็จทีหลังชนะ (race condition)
// เก็บสถานะล็อกอินไว้ตรงนี้ให้ applyHeroRegisterButtonState() เช็คด้วย กันปุ่มลงทะเบียนโผล่มาให้คนที่ล็อกอินแล้วเห็น
let isUserLoggedIn = false;
// เก็บ settings ล่าสุดไว้ให้ applyCheckStatusTabState() เรียกซ้ำได้จาก loginUser() ด้วย กัน race condition เดียวกับข้างบน
let lastSiteSettings = null;

// promise เดียวใช้ร่วมกันทั้งหน้า กันแต่ละสคริปต์ (auth.js เอง + สคริปต์เฉพาะหน้าอย่าง staff-academic.js/participant-study.js ฯลฯ)
// ยิง fetch('/api/auth/me') ของตัวเองซ้ำตอนโหลดหน้าเดียวกัน (บางหน้าก่อนหน้านี้ยิงซ้ำ 2-4 รอบพร้อมกัน) auth.js โหลดก่อนสคริปต์เฉพาะหน้าเสมอ
// จึงประกาศ promise นี้ทันทีตอนสคริปต์ทำงาน (ไม่ต้องรอ DOMContentLoaded) ให้สคริปต์อื่นมาแนบ .then() ใช้ผลเดียวกันได้ทัน
// resolve เป็น {user:null, camp:null} เสมอ ไม่มี reject กันทุกจุดที่เรียกใช้ต้องเขียน .catch() ซ้ำอีก
// ข้าม fetch จริงถ้าอยู่ในกรอบพรีวิวของ WebManager (ดูคอมเมนต์ preview=1 ใน checkAuthSession เดิม) ให้ถือเป็น "ยังไม่ได้ล็อกอิน" ไปเลย
window.PTN_AUTH_ME = (new URLSearchParams(window.location.search).get('preview') === '1')
    ? Promise.resolve({ user: null, camp: null })
    : fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : { user: null, camp: null }))
        .catch(() => ({ user: null, camp: null }));

const ROLE_LABELS = {
    STAFF: 'พี่ค่าย',
    PARTICIPANT: 'น้องค่าย',
    WEBMANAGER: 'WebManager',
};

// ตำแหน่งผู้บริหารค่าย: มองเห็นเมนู "งาน" ได้ทั้ง 4 ฝ่าย ส่วนตำแหน่งอื่นเห็นเฉพาะฝ่ายที่ตัวเองสังกัด
const LEADERSHIP_POSITIONS = ['ประธานค่าย', 'รองประธานค่าย', 'เลขานุการ'];

// ==========================================
// สถานะค่าย (จาก /api/auth/me → camp) - ระบบวิชาการ/กิจกรรมใช้ได้เฉพาะตอนมีค่ายที่ "กำลังดำเนินการ" (สร้างค่าย + กำหนดตำแหน่งแล้ว ยังไม่จบค่าย)
// ฝั่ง server ล็อก API พวกนี้ด้วย 409 CAMP_NOT_ACTIVE อยู่แล้ว (ดู requireActiveCamp) ฝั่งหน้าเว็บแค่โชว์แผงอธิบายแทนเนื้อหา ไม่ยิงโหลดข้อมูลให้เจอ error รัว ๆ
// ==========================================
window.PTN_CAMP_STATE = null;

function isCampActive(camp = window.PTN_CAMP_STATE) {
    return !!(camp && camp.isActive);
}

// แทนที่เนื้อหาใน <main> ของหน้าด้วยแผง "ระบบยังไม่เปิดใช้งาน" - systemName เช่น "ระบบวิชาการ", audience "staff" | "participant" (เปลี่ยนคำอธิบายให้ตรงกับคนอ่าน)
function renderCampLockedPage(mainEl, { systemName, audience = "staff", camp = window.PTN_CAMP_STATE } = {}) {
    if (!mainEl) return;
    const ended = !!(camp && camp.hasCamp && camp.isEnded);
    const title = ended ? `ค่ายครั้งที่ ${camp.generationNo} จบแล้ว` : `${systemName}ยังไม่เปิดใช้งาน`;
    const desc = ended
        ? (audience === "participant"
            ? "ค่ายสิ้นสุดลงแล้ว ระบบส่วนนี้ปิดใช้งาน ขอบคุณที่มาร่วมค่ายกับเรา"
            : "ตำแหน่งของพี่ค่ายทุกคนถูกรีเซ็ตกลับเป็นทีมงานค่ายแล้ว ระบบส่วนนี้จะเปิดอีกครั้งเมื่อ WebManager สร้างค่ายครั้งถัดไป")
        : (audience === "participant"
            ? "ยังไม่มีค่ายที่กำลังดำเนินการ ระบบส่วนนี้จะเปิดใช้งานเมื่อค่ายเริ่มดำเนินการแล้ว"
            : "ยังไม่มีค่ายที่กำลังดำเนินการ ระบบจะเปิดใช้งานเมื่อ WebManager สร้างค่ายและกำหนดคณะทำงานครบแล้ว ก่อนหน้านั้นพี่ค่ายทุกคนมีสถานะเป็นทีมงานค่ายปกติ และยังไม่มีน้องค่ายในระบบ");
    const steps = [
        { label: "สร้างค่าย + กำหนดประธาน/รองประธาน/เลขานุการ/หัวหน้าฝ่าย", state: camp && camp.hasCamp ? "done" : "current" },
        { label: "ดำเนินการค่าย · ระบบวิชาการและกิจกรรมเปิดใช้งาน", state: isCampActive(camp) ? "current" : "" },
        { label: "จบค่าย", state: ended ? "done" : "" },
    ];
    // ปุ่มแท็บของหน้านี้ (บนแถบเมนู/เมนูมือถือ/ฟุตเตอร์) ชี้ไปที่เนื้อหาที่ถูกแทนที่แล้ว ซ่อนไปด้วยกันสับสน
    document.querySelectorAll('[onclick*="switchTab("], [onclick*="goToScoreTab("], [onclick*="handleStudyTabSwitch("]').forEach((el) => el.classList.add('hidden'));
    mainEl.innerHTML = `
        <section class="camp-lock" role="status" aria-live="polite">
            <div class="camp-lock-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            </div>
            <h2 class="camp-lock-title">${title}</h2>
            <p class="camp-lock-desc">${desc}</p>
            ${audience === "staff" ? `<ol class="camp-lock-steps">${steps.map((step, i) => `<li class="${step.state}">${step.state === "done" ? "✓" : i + 1} ${step.label}</li>`).join("")}</ol>` : ""}
            <div class="camp-lock-actions">
                <a class="btn-primary" href="/">กลับหน้าแรก</a>
            </div>
        </section>
    `;
}

function toggleUserMenu() {
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.toggle('hidden');
}

// เปิด/ปิดกล่องดรอปดาวน์แบบมีอนิเมชัน (ใช้ร่วมกันทั้งเมนู "งาน" บน desktop และมือถือ)
function openDropdownAnimated(el, trigger) {
    if (!el) return;
    el.classList.remove('hidden', 'closing');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
}

function closeDropdownAnimated(el, trigger) {
    if (!el || el.classList.contains('hidden') || el.classList.contains('closing')) return;
    el.classList.add('closing');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    el.addEventListener('animationend', () => {
        el.classList.add('hidden');
        el.classList.remove('closing');
    }, { once: true });
}

function toggleRegisterMenu() {
    const trigger = document.getElementById('register-nav-trigger');
    const menu = document.getElementById('register-nav-menu');
    if (!menu) return;
    if (menu.classList.contains('hidden')) {
        openDropdownAnimated(menu, trigger);
    } else {
        closeDropdownAnimated(menu, trigger);
    }
}

function toggleMobileRegisterMenu() {
    const trigger = document.getElementById('m-register-nav-trigger');
    const items = document.getElementById('m-register-nav-items');
    if (!items) return;
    if (items.classList.contains('hidden')) {
        openDropdownAnimated(items, trigger);
    } else {
        closeDropdownAnimated(items, trigger);
    }
}

// WebManager เห็นเมนู "งาน" เฉพาะตอนอยู่ในโซนพี่ค่าย (/staff/...) เท่านั้น - "จำลองพี่ค่าย" ตอนกดเข้าไปดู ไม่ใช่โชว์ปนอยู่ตลอดเวลาที่หน้าแรกสาธารณะ
function applyStaffTaskMenuVisibility(user) {
    const wraps = document.querySelectorAll('.nav-tasks-wrap');
    if (!wraps.length) return;

    const isWebManagerInStaffArea = !!(user && user.role === 'WEBMANAGER') && window.location.pathname.startsWith('/staff/');
    const isLeadership = isWebManagerInStaffArea || !!(user && user.position && LEADERSHIP_POSITIONS.includes(user.position.name));
    const departmentName = user && user.department ? user.department.name : null;
    // ไม่มีค่ายที่กำลังดำเนินการ = ระบบวิชาการ/กิจกรรมล็อกทั้งหมด ซ่อนเมนูไปเลยไม่ว่าจะตำแหน่งอะไร (ตำแหน่งที่ค้างจากการตั้งมือก็ใช้อะไรไม่ได้อยู่ดี)
    const campActive = isCampActive();

    wraps.forEach((wrap) => {
        const items = wrap.querySelectorAll('[data-department-name]');
        let visibleCount = 0;
        items.forEach((item) => {
            const show = campActive && (isLeadership || (departmentName && item.dataset.departmentName === departmentName));
            item.classList.toggle('hidden', !show);
            if (show) visibleCount += 1;
        });
        wrap.classList.toggle('hidden', !(user && (user.role === 'STAFF' || isWebManagerInStaffArea)) || visibleCount === 0);
    });
}

// ปุ่ม "เขียนข่าว" เห็นได้ทุกคนที่เป็นพี่ค่าย ไม่ว่าจะสังกัดฝ่ายไหน (การเขียนข่าวเป็นสิทธิ์พื้นฐานของพี่ค่ายทุกคน ไม่กรองตามฝ่ายเหมือนเมนู "งาน" ด้านบน)
// WebManager เห็นเฉพาะตอนอยู่ในโซนพี่ค่ายเหมือนกัน (จำลองพี่ค่าย) ไม่มี data-department-name จึงไม่ถูก applyStaffTaskMenuVisibility() กรองไปด้วยโดยบังเอิญ
function applyNewsWriteLinkVisibility(user) {
    const isWebManagerInStaffArea = !!(user && user.role === 'WEBMANAGER') && window.location.pathname.startsWith('/staff/');
    const show = !!(user && (user.role === 'STAFF' || isWebManagerInStaffArea));
    document.querySelectorAll('#hero-news-write-link, #user-menu-news-write-link, #m-menu-news-write-link').forEach((el) => {
        el.classList.toggle('hidden', !show);
    });
}

// ปุ่มลัด "การเรียน"/"กิจกรรม" ของน้องค่าย เหมือนกัน: WebManager เห็นเฉพาะตอนอยู่ในโซนน้องค่าย (/participant/...) - "จำลองน้องค่าย"
// ไม่มี data-department-name ให้กรองทีละปุ่มเหมือนพี่ค่าย โชว์คู่กันเสมอเมื่อเงื่อนไขผ่าน
function applyParticipantTaskMenuVisibility(user) {
    const wraps = document.querySelectorAll('.participant-tasks-wrap');
    if (!wraps.length) return;

    const isWebManagerInParticipantArea = !!(user && user.role === 'WEBMANAGER') && window.location.pathname.startsWith('/participant/');
    const show = !!(user && user.role === 'PARTICIPANT') || isWebManagerInParticipantArea;
    wraps.forEach((wrap) => wrap.classList.toggle('hidden', !show));
}

// ==========================================
// กล่องยืนยัน (แทน confirm() ของเบราว์เซอร์)
// ==========================================
let confirmResolver = null;

function showConfirm(message, options = {}) {
    const modal = document.getElementById('confirm-modal');
    const messageEl = document.getElementById('confirm-message');
    const titleEl = document.getElementById('confirm-title');
    const okBtn = document.getElementById('confirm-ok-btn');
    if (!modal || !messageEl || !titleEl || !okBtn) return Promise.resolve(false);

    messageEl.textContent = message;
    titleEl.textContent = options.title || 'ยืนยันการดำเนินการ';
    okBtn.textContent = options.confirmText || 'ยืนยัน';
    modal.classList.remove('hidden');

    return new Promise((resolve) => {
        confirmResolver = resolve;
    });
}

function confirmResolve(result) {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('hidden');
    if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
    }
}

function comingSoon(featureName) {
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.add('hidden');
    alert(`"${featureName}" อยู่ระหว่างการพัฒนา`);
}

document.addEventListener('click', (event) => {
    document.querySelectorAll('.user-dropdown').forEach((dropdown) => {
        const menu = dropdown.querySelector('.user-dropdown-menu');
        if (menu && !dropdown.contains(event.target)) {
            menu.classList.add('hidden');
        }
    });

    document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
        const menu = dropdown.querySelector('.nav-dropdown-menu');
        const trigger = dropdown.querySelector('.nav-dropdown-trigger');
        if (menu && !dropdown.contains(event.target)) {
            closeDropdownAnimated(menu, trigger);
        }
    });
});

function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    goToAuthStep('login');

    const toast = document.getElementById('auth-toast');
    if (toast) {
        toast.className = 'hidden mt-4 p-3 rounded-xl text-xs font-semibold text-center transition-all';
        toast.innerText = '';
    }
}

function goToAuthStep(step) {
    ['login', 'forgot-email', 'forgot-otp', 'forgot-newpass'].forEach((s) => {
        const el = document.getElementById(`auth-step-${s}`);
        if (el) el.classList.toggle('hidden', s !== step);
    });

    const loginForm = document.getElementById('form-login');
    const forgotEmailForm = document.getElementById('forgot-email-form');
    const forgotNewpassForm = document.getElementById('forgot-newpass-form');
    if (step === 'login' && loginForm) loginForm.reset();
    if (step === 'forgot-email' && forgotEmailForm) forgotEmailForm.reset();
    if (step === 'forgot-otp' && authOtpController) authOtpController.reset();
    if (step === 'forgot-newpass' && forgotNewpassForm) {
        forgotNewpassForm.reset();
        updatePasswordHint('');
    }
}

function selectAuthRole(role, btnEl) {
    selectedAuthRole = role;
    document.querySelectorAll('.auth-tab').forEach((btn) => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const subtitle = document.getElementById('auth-login-subtitle');
    if (subtitle) subtitle.innerText = `ลงชื่อเข้าใช้ในฐานะ${ROLE_LABELS[role] || role}`;
}

function showAuthToast(message, isSuccess) {
    const toast = document.getElementById('auth-toast');
    if (!toast) return;

    toast.classList.remove('hidden');
    toast.innerText = message;
    if (isSuccess) {
        toast.className = 'mt-4 p-3 rounded-xl text-xs font-semibold text-center bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse';
    } else {
        toast.className = 'mt-4 p-3 rounded-xl text-xs font-semibold text-center bg-rose-50 text-rose-600 border border-rose-200';
    }
}

function handleLoginSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = event.target.querySelector('button[type="submit"]');

    Loader.setButtonLoading(btn, 'กำลังเข้าสู่ระบบ...');

    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: selectedAuthRole }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(({ user }) => {
            loginUser(user);
            closeAuthModal();
            sessionStorage.setItem('ptnJustLoggedIn', '1');
            // ล็อกอินแล้วอยู่หน้าเดิมต่อเลย (ปกติคือหน้าแรก เพราะโมดัลนี้เปิดใช้ได้จากทุกหน้า) ไม่พุ่งไปหน้าตั้งค่าโปรไฟล์อัตโนมัติ
            showWelcomeToast();
        })
        .catch((error) => {
            showAuthToast(error.message, false);
        })
        .finally(() => {
            Loader.clearButtonLoading(btn);
        });
}

// เด้ง pop up "ยินดีต้อนรับ" หลังเข้าสู่ระบบสำเร็จ บนหน้าที่พาไปถึง (ไม่ใช่ในโมดัลก่อนเปลี่ยนหน้า) - ข้อความคงที่ฝังไว้ใน HTML แล้ว (ดู index.html) ไม่ต้องตั้งด้วย JS
function showWelcomeToast() {
    if (sessionStorage.getItem('ptnJustLoggedIn') !== '1') return;
    sessionStorage.removeItem('ptnJustLoggedIn');

    const toast = document.getElementById('welcome-toast');
    const bar = toast?.querySelector('.welcome-toast-bar');
    if (!toast) return;
    toast.classList.add('show');

    // แถบโหลดนับถอยหลัง - เด้งแค่ครั้งเดียวต่อการล็อกอิน 1 ครั้ง (ไม่มีทางเด้งซ้อนกันถี่ ๆ) ไม่ต้องรีเซ็ต/บังคับ reflow เหมือน showXToast หน้าอื่น
    if (bar) bar.classList.add('running');

    setTimeout(() => toast.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', showWelcomeToast);

function handleForgotEmailSubmit(event) {
    event.preventDefault();
    forgotPasswordEmail = document.getElementById('forgot-email').value.trim();
    requestOtp(true);
}

function requestOtp(goToOtpStep) {
    return fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(() => {
            if (!authOtpController) {
                authOtpController = setupOtpInputs('auth-otp-boxes');
            }
            if (goToOtpStep) {
                goToAuthStep('forgot-otp');
            }
            startAuthResendCooldown();
        })
        .catch((error) => {
            showAuthToast(error.message, false);
        });
}

function handleResendOtp() {
    requestOtp(false);
}

function startAuthResendCooldown() {
    const btn = document.getElementById('auth-resend-otp');
    if (!btn) return;
    if (authResendCooldown) clearInterval(authResendCooldown);

    let seconds = 30;
    btn.disabled = true;
    btn.innerText = `ส่งรหัสอีกครั้ง (${seconds}s)`;

    authResendCooldown = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
            clearInterval(authResendCooldown);
            btn.disabled = false;
            btn.innerText = 'ส่งรหัสอีกครั้ง';
        } else {
            btn.innerText = `ส่งรหัสอีกครั้ง (${seconds}s)`;
        }
    }, 1000);
}

function handleVerifyOtpSubmit(event) {
    event.preventDefault();
    const otpCode = authOtpController ? authOtpController.getValue() : '';

    fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail, otpCode }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(() => {
            verifiedOtpCode = otpCode;
            goToAuthStep('forgot-newpass');
        })
        .catch((error) => {
            showAuthToast(error.message, false);
            if (authOtpController) authOtpController.reset();
        });
}

function updatePasswordHint(password) {
    const hint = document.getElementById('reset-password-hint');
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

function handleNewPasswordInput() {
    updatePasswordHint(document.getElementById('reset-new-password').value);
}

function handleForgotResetSubmit(event) {
    event.preventDefault();
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    if (!checkPasswordStrength(newPassword)) {
        updatePasswordHint(newPassword);
        showAuthToast('รหัสผ่านยังไม่ผ่านมาตรฐานความปลอดภัย', false);
        return;
    }
    if (newPassword !== confirmPassword) {
        showAuthToast('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน', false);
        return;
    }

    fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail, otpCode: verifiedOtpCode, newPassword }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then((body) => {
            showAuthToast(body.message, true);
            setTimeout(() => goToAuthStep('login'), 1200);
        })
        .catch((error) => {
            showAuthToast(error.message, false);
        });
}

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

function loginUser(userData) {
    isUserLoggedIn = true;
    const isWebManager = userData.role === 'WEBMANAGER';
    // WebManager (สิทธิ์สูงสุด) เข้าได้ทุกหน้าเสมออยู่แล้ว (ดู server.js: requireAdminPage/requireStaffPage/requireParticipantPage)
    // จึงนับเป็น hasAdminAccess ด้วย เพื่อให้เห็นลิงก์ Admin ในเมนูนี้เหมือนพี่ค่ายที่เป็นผู้ดูแลระบบ
    const hasAdminAccess = (userData.role === 'STAFF' && userData.isAdmin) || isWebManager;
    const isPrivilegedStaff = userData.role === 'STAFF' && userData.isAdmin;
    const roleLabel = ROLE_LABELS[userData.role] || userData.role;

    // ถ้ามีชื่อ-นามสกุลและตำแหน่งในโปรไฟล์พี่ค่าย ให้ขึ้นชื่อและตำแหน่งแทน email/role ตรง ๆ
    // พี่ค่ายที่ได้สิทธิ์ผู้ดูแลระบบ (isAdmin) ให้ต่อท้ายตำแหน่งด้วย "ผู้ดูแลระบบ" เสมอ ไม่ว่าจะมีตำแหน่งหรือไม่ก็ตาม
    const fullName = userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : null;
    const positionLabel = (userData.position && userData.position.name) || roleLabel;
    const subLabel = isPrivilegedStaff ? `${positionLabel} · ผู้ดูแลระบบ` : positionLabel;
    const nameLine = fullName || (userData.role === 'WEBMANAGER' ? 'Owner' : userData.email);
    const initial = nameLine.charAt(0).toUpperCase();
    // ปุ่มตัวเรียกที่ header เอาไว้แค่ชื่อ-นามสกุลเฉย ๆ (ตำแหน่ง/ผู้ดูแลระบบไปโชว์ในเมนูที่กดเปิดแทน กันยาวจนล้นบรรทัด)
    const displayName = nameLine;

    const authLoggedOut = document.getElementById('auth-logged-out');
    const authLoggedIn = document.getElementById('auth-logged-in');
    const userAvatar = document.getElementById('user-avatar');
    const userDisplayName = document.getElementById('user-display-name');
    const mAuthLoggedOut = document.getElementById('m-auth-logged-out');
    const mAuthLoggedIn = document.getElementById('m-auth-logged-in');

    if (authLoggedOut) authLoggedOut.classList.add('hidden');
    if (authLoggedIn) authLoggedIn.classList.remove('hidden');
    renderAvatar(userAvatar, userData.avatarUrl, initial);
    if (userDisplayName) userDisplayName.innerText = displayName;

    const menuAvatar = document.getElementById('user-menu-avatar');
    const menuUsername = document.getElementById('user-menu-username');
    const menuRole = document.getElementById('user-menu-role');
    renderAvatar(menuAvatar, userData.avatarUrl, initial);
    if (menuUsername) menuUsername.textContent = nameLine;
    if (menuRole) menuRole.textContent = subLabel;

    // WebManager (สิทธิ์สูงสุด) เข้า /staff/... หรือ /participant/... ได้เหมือน "จำลอง" บทบาทนั้นชั่วคราว
    // ตอนจำลองอยู่: ซ่อนทางลัดพี่ค่าย/น้องค่าย/Admin/WebManager ออก ให้เห็นเหมือนบทบาทนั้นจริง ๆ (มีโปรไฟล์ + เมนูงาน) แล้วโชว์ปุ่ม "ออกจากการจำลอง" แทน
    const isSimulating = isWebManager && (window.location.pathname.startsWith('/staff/') || window.location.pathname.startsWith('/participant/'));

    const adminLink = document.getElementById('user-menu-admin-link');
    if (adminLink) adminLink.classList.toggle('hidden', !hasAdminAccess || isSimulating);

    // WebManager ไม่มีโปรไฟล์พี่ค่าย/น้องค่ายจริง ซ่อน "โปรไฟล์" ไว้ตอนไม่ได้จำลอง แต่โชว์ตอนจำลองให้เหมือนบทบาทจริง (แม้หน้าจะว่างเพราะไม่มีข้อมูลจริงก็ตาม)
    const profileLinkDesktop = document.getElementById('user-menu-profile-link');
    if (profileLinkDesktop) profileLinkDesktop.classList.toggle('hidden', isWebManager && !isSimulating);

    if (mAuthLoggedOut) mAuthLoggedOut.classList.add('hidden');
    if (mAuthLoggedIn) mAuthLoggedIn.classList.remove('hidden');

    const mHeaderAvatarBtn = document.getElementById('m-header-avatar-btn');
    const mHeaderAvatar = document.getElementById('m-header-avatar');
    const mHeaderUsername = document.getElementById('m-header-username');
    if (mHeaderAvatarBtn) mHeaderAvatarBtn.classList.remove('hidden');
    renderAvatar(mHeaderAvatar, userData.avatarUrl, initial);
    if (mHeaderUsername) mHeaderUsername.textContent = nameLine;

    const mMenuProfileLink = document.getElementById('m-menu-profile-link');
    const mMenuAdminLink = document.getElementById('m-menu-admin-link');
    const mMenuAccountCard = document.getElementById('m-menu-account-card');
    const mMenuAccountDivider = document.getElementById('m-menu-account-divider');
    renderAvatar(document.getElementById('m-menu-account-avatar'), userData.avatarUrl, initial);
    const mMenuAccountName = document.getElementById('m-menu-account-name');
    const mMenuAccountRole = document.getElementById('m-menu-account-role');
    if (mMenuAccountName) mMenuAccountName.textContent = nameLine;
    if (mMenuAccountRole) mMenuAccountRole.textContent = subLabel;
    if (mMenuProfileLink) mMenuProfileLink.classList.toggle('hidden', isWebManager && !isSimulating);
    if (mMenuAdminLink) mMenuAdminLink.classList.toggle('hidden', !hasAdminAccess || isSimulating);

    // ลิงก์ "โปรไฟล์" พาไปหน้าที่ถูกต้องตาม role (STAFF/PARTICIPANT มีหน้าโปรไฟล์จริง)
    // ตอน WebManager จำลองอยู่ก็ให้เข้าหน้าโปรไฟล์ของโซนที่กำลังจำลองได้เหมือนกัน (ข้อมูลจะว่างเพราะไม่มีโปรไฟล์จริง แต่โครงหน้าต้องขึ้นได้ ไม่ใช่ stub เฉย ๆ)
    const profileUrl = userData.role === 'STAFF' ? '/staff/profile'
        : userData.role === 'PARTICIPANT' ? '/participant/profile'
        : isSimulating && window.location.pathname.startsWith('/staff/') ? '/staff/profile'
        : isSimulating && window.location.pathname.startsWith('/participant/') ? '/participant/profile'
        : null;
    if (profileUrl) {
        const profileLinkEl = document.getElementById('user-menu-profile-link');
        if (profileLinkEl) profileLinkEl.onclick = () => window.location.href = profileUrl;
        if (mMenuProfileLink) mMenuProfileLink.onclick = () => window.location.href = profileUrl;
    }

    if (mMenuAccountCard) mMenuAccountCard.classList.remove('hidden');
    if (mMenuAccountDivider) mMenuAccountDivider.classList.remove('hidden');

    const heroRegisterStaffBtn = document.getElementById('hero-register-staff-btn');
    if (heroRegisterStaffBtn) heroRegisterStaffBtn.classList.add('hidden');
    const heroRegisterParticipantBtn = document.getElementById('hero-register-participant-btn');
    if (heroRegisterParticipantBtn) heroRegisterParticipantBtn.classList.add('hidden');
    const heroOpenBadge = document.getElementById('hero-open-badge');
    if (heroOpenBadge) heroOpenBadge.classList.add('hidden');

    applyStaffTaskMenuVisibility(userData);
    applyNewsWriteLinkVisibility(userData);
    applyParticipantTaskMenuVisibility(userData);

    // เผื่อ loadRegistrationOpenSetting() เสร็จก่อน isUserLoggedIn ถูกตั้งค่า (race condition) เรียกซ้ำด้วย settings ล่าสุดถ้ามี
    if (lastSiteSettings) applyCheckStatusTabState(lastSiteSettings);
}

async function logout() {
    const confirmed = await showConfirm('ยืนยันการออกจากระบบใช่หรือไม่?', { title: 'ออกจากระบบ', confirmText: 'ออกจากระบบ' });
    if (!confirmed) return;

    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        try { sessionStorage.removeItem('ptn-active-tab'); } catch (error) { /* private mode */ } // กันแท็บที่จำไว้ (เช่นตอนจำลองพี่ค่าย/น้องค่าย) ค้างข้ามบัญชีถัดไป
        window.location.href = '/';
    });
}

function checkAuthSession() {
    // ใช้ผลจาก window.PTN_AUTH_ME (ยิงไปแล้วตั้งแต่สคริปต์นี้โหลด ดูคอมเมนต์ตรงประกาศด้านบน) ไม่ fetch เอง
    // โหมดพรีวิว (iframe "ตัวอย่างหน้าเว็บหลัก" ในแผง WebManager, src="/?preview=1") ผลจะเป็น user:null เสมออยู่แล้ว
    // ปล่อยให้ header อยู่ในสถานะเริ่มต้น (เหมือนผู้เยี่ยมชมทั่วไปที่ยังไม่ได้ล็อกอิน) กันปุ่ม "ออกจากระบบ"/"Admin" หลุดเข้ามาให้กดพลาดในกรอบพรีวิวเล็ก ๆ
    window.PTN_AUTH_ME.then(({ user, camp }) => {
        if (!user) return;
        window.PTN_CAMP_STATE = camp || null;
        loginUser(user);
    });
}

document.addEventListener('DOMContentLoaded', checkAuthSession);

// ปุ่ม "ลงทะเบียนพี่ค่าย"/"ลงทะเบียนน้องค่าย" เปิด/ปิดแยกกันได้จากแผง WebManager (หน้า "หน้าแรก")
// ปิดแล้วจุดเปลี่ยนเป็นสีเทา เปลี่ยนข้อความ และกดไม่ได้
const heroRegistrationOpenState = { staff: true, participant: true };

// ปิดรับลงทะเบียน = ซ่อนปุ่มไปเลย ไม่ใช่แค่กดไม่ได้ / ล็อกอินอยู่แล้วก็ไม่ต้องเห็นปุ่มลงทะเบียนเช่นกัน
function applyHeroRegisterButtonState(role, isOpen) {
    heroRegistrationOpenState[role] = isOpen;

    const btn = document.getElementById(`hero-register-${role}-btn`);
    if (btn) btn.classList.toggle('hidden', !isOpen || isUserLoggedIn);

    // ป้าย "เปิดลงทะเบียนแล้ววันนี้" โชว์เฉพาะตอนฝั่งน้องค่ายเปิดรับเท่านั้น (ผูกกับปุ่มลงทะเบียนน้องค่ายโดยเฉพาะ)
    if (role === 'participant') {
        const badge = document.getElementById('hero-open-badge');
        if (badge) badge.classList.toggle('hidden', !isOpen || isUserLoggedIn);
    }
}

// น้องค่ายสมัครได้เฉพาะตอนมีค่ายที่กำลังดำเนินการเท่านั้น (ก่อนสร้างค่ายยังไม่มีน้องค่ายในระบบเลย) ต่อให้สวิตช์ในแผง WebManager ตั้งเป็น "เปิด" ไว้ก็ตาม
// พี่ค่ายไม่ผูกกับค่าย สมัครเป็น "ทีมงานค่าย" ได้ตลอด เช็คตรงกับ isRegistrationOpen() ฝั่ง backend (authController.js)
function isParticipantRegistrationOpen(settings) {
    return settings.participantRegistrationOpen !== false && !!settings.campActive;
}

// ปุ่ม "ลงทะเบียน" แบบ popup บนแถบเมนู (desktop + มือถือ) ซ่อนตัวเลือกที่ปิดรับสมัครออกจาก popup เป็นรายบทบาท
// ถ้าปิดรับทั้งสองบทบาท เปลี่ยนปุ่มหลักเป็น "ยังไม่เปิดลงทะเบียน" และกดไม่ได้ (ไม่ใช่ popup อีกต่อไป)
function applyNavRegisterState(settings) {
    const staffOpen = settings.staffRegistrationOpen !== false;
    const participantOpen = isParticipantRegistrationOpen(settings);
    const anyOpen = staffOpen || participantOpen;

    [
        ['register-nav-item-staff', staffOpen],
        ['register-nav-item-participant', participantOpen],
        ['m-register-nav-item-staff', staffOpen],
        ['m-register-nav-item-participant', participantOpen],
    ].forEach(([id, open]) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !open);
    });

    [
        ['register-nav-trigger', 'register-nav-trigger-text', 'register-nav-caret'],
        ['m-register-nav-trigger', 'm-register-nav-trigger-text', 'm-register-nav-caret'],
    ].forEach(([triggerId, textId, caretId]) => {
        const trigger = document.getElementById(triggerId);
        const text = document.getElementById(textId);
        const caret = document.getElementById(caretId);
        if (!trigger) return;
        trigger.disabled = !anyOpen;
        trigger.classList.toggle('nav-register-disabled', !anyOpen);
        if (text) text.textContent = anyOpen ? 'ลงทะเบียน' : 'ยังไม่เปิดลงทะเบียน';
        if (caret) caret.classList.toggle('hidden', !anyOpen);
    });
}

function loadRegistrationOpenSetting() {
    fetch('/api/site-settings')
        .then((res) => (res.ok ? res.json() : { staffRegistrationOpen: true, participantRegistrationOpen: true }))
        .then((settings) => {
            lastSiteSettings = settings;
            applyHeroRegisterButtonState('staff', settings.staffRegistrationOpen !== false);
            applyHeroRegisterButtonState('participant', isParticipantRegistrationOpen(settings));
            applyNavRegisterState(settings);

            applyCheckStatusTabState(settings);
        })
        .catch((error) => console.error('โหลดการตั้งค่าเว็บไซต์ไม่สำเร็จ:', error));
}

// ==========================================
// ตรวจสอบผลการลงทะเบียน (Check Registration Status) - หน้าสาธารณะ ไม่ต้องเข้าสู่ระบบ
// ==========================================
let selectedCheckStatusRole = 'STAFF';

// แต่ละแท็บ (พี่ค่าย/น้องค่าย) เปิด/ปิดแยกกันได้จากแผง WebManager - ซ่อนทั้งเมนูถ้าปิดทั้งคู่, ซ่อนเฉพาะแท็บที่ปิดถ้าเปิดอย่างน้อย 1 ฝั่ง
function applyCheckStatusTabState(settings) {
    const staffVisible = settings.checkRegistrationVisibleStaff !== false;
    const participantVisible = settings.checkRegistrationVisibleParticipant !== false;
    const anyVisible = staffVisible || participantVisible;
    // ล็อกอินอยู่แล้ว = ไม่ต้องเห็นแท็บ "ตรวจสอบผลการลงทะเบียน" อีก (เป็นของคนที่ยังไม่ได้ล็อกอินเช็คสถานะตัวเอง)
    const shouldShow = anyVisible && !isUserLoggedIn;

    document.getElementById('nav-check-status')?.classList.toggle('hidden', !shouldShow);
    document.getElementById('m-nav-check-status')?.classList.toggle('hidden', !shouldShow);

    const staffTab = document.getElementById('check-status-tab-staff');
    const participantTab = document.getElementById('check-status-tab-participant');
    if (staffTab) staffTab.classList.toggle('hidden', !staffVisible);
    if (participantTab) participantTab.classList.toggle('hidden', !participantVisible);

    // ถ้าแท็บที่กำลังเลือกอยู่ถูกซ่อนไป ให้สลับไปแท็บที่ยังเปิดอยู่แทนอัตโนมัติ
    if (selectedCheckStatusRole === 'STAFF' && !staffVisible && participantVisible) {
        selectCheckStatusRole('PARTICIPANT', participantTab);
    } else if (selectedCheckStatusRole === 'PARTICIPANT' && !participantVisible && staffVisible) {
        selectCheckStatusRole('STAFF', staffTab);
    }
}

function selectCheckStatusRole(role, btnEl) {
    selectedCheckStatusRole = role;
    document.querySelectorAll('#page-check-status .auth-tab').forEach((tab) => tab.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const result = document.getElementById('check-status-result');
    if (result) result.classList.add('hidden');
}

function handleCheckStatusSubmit(event) {
    event.preventDefault();

    const email = document.getElementById('check-status-email').value.trim();
    const result = document.getElementById('check-status-result');
    const btn = event.target.querySelector('button[type="submit"]');

    Loader.setButtonLoading(btn, 'กำลังตรวจสอบ...');

    fetch(`/api/auth/register/status?email=${encodeURIComponent(email)}&role=${selectedCheckStatusRole}`)
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(({ found, approvalStatus }) => {
            const roleLabel = selectedCheckStatusRole === 'STAFF' ? 'พี่ค่าย' : 'น้องค่าย';
            if (!found) {
                showCheckStatusResult('notfound', `ไม่พบข้อมูลการลงทะเบียน${roleLabel}ด้วยอีเมลนี้`);
                return;
            }
            if (approvalStatus === 'PENDING') {
                showCheckStatusResult('pending', 'ใบสมัครของคุณอยู่ระหว่างรอการตรวจสอบและอนุมัติจากผู้ดูแลระบบ');
            } else if (approvalStatus === 'APPROVED') {
                showCheckStatusResult('approved', 'ใบสมัครของคุณได้รับการอนุมัติแล้ว! สามารถเข้าสู่ระบบได้ทันที');
            } else if (approvalStatus === 'REJECTED') {
                showCheckStatusResult('rejected', 'ใบสมัครของคุณไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ');
            }
        })
        .catch((error) => {
            showCheckStatusResult('error', error.message);
        })
        .finally(() => {
            Loader.clearButtonLoading(btn);
        });
}

function showCheckStatusResult(status, message) {
    const result = document.getElementById('check-status-result');
    if (!result) return;
    result.className = `check-status-result status-${status}`;
    result.textContent = message;
}

function handleHeroRegisterClick(event, role, targetUrl) {
    if (!heroRegistrationOpenState[role]) {
        event.preventDefault();
        return;
    }
    window.location.href = targetUrl;
}

document.addEventListener('DOMContentLoaded', loadRegistrationOpenSetting);
