// หน้า login แยกต่างหากของ SuperAdmin (สิทธิ์สูงสุด) ไม่ใช้โมดัลร่วมกับพี่ค่าย/น้องค่าย และไม่มีแท็บเลือกบทบาท เพราะ role ถูกกำหนดตายตัวเป็น SUPERADMIN
let superAdminForgotEmail = '';
let superAdminVerifiedOtpCode = '';
let superAdminOtpController = null;
let superAdminResendCooldown = null;

function goToSuperAdminStep(step) {
    ['login', 'forgot-email', 'forgot-otp', 'forgot-newpass'].forEach((s) => {
        const el = document.getElementById(`wm-step-${s}`);
        if (el) el.classList.toggle('hidden', s !== step);
    });

    const loginForm = document.getElementById('wm-login-form');
    const forgotEmailForm = document.getElementById('wm-forgot-email-form');
    const forgotNewpassForm = document.getElementById('wm-forgot-newpass-form');
    if (step === 'login' && loginForm) loginForm.reset();
    if (step === 'forgot-email' && forgotEmailForm) forgotEmailForm.reset();
    if (step === 'forgot-otp' && superAdminOtpController) superAdminOtpController.reset();
    if (step === 'forgot-newpass' && forgotNewpassForm) {
        forgotNewpassForm.reset();
        updateSuperAdminPasswordHint('');
    }
}

function showSuperAdminToast(message, isSuccess) {
    const toast = document.getElementById('wm-login-toast');
    if (!toast) return;

    toast.classList.remove('hidden');
    toast.innerText = message;
    if (isSuccess) {
        toast.className = 'toast mt-4 p-3 rounded-xl text-xs font-semibold text-center bg-emerald-50 text-emerald-600 border border-emerald-200';
    } else {
        toast.className = 'toast mt-4 p-3 rounded-xl text-xs font-semibold text-center bg-rose-50 text-rose-600 border border-rose-200';
    }
}

function handleSuperAdminLoginSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('wm-login-email').value.trim();
    const password = document.getElementById('wm-login-password').value;
    const btn = event.target.querySelector('button[type="submit"]');

    Loader.setButtonLoading(btn, 'กำลังเข้าสู่ระบบ...');

    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'SUPERADMIN' }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(() => {
            window.location.href = '/superadmin/';
        })
        .catch((error) => {
            showSuperAdminToast(error.message, false);
            Loader.clearButtonLoading(btn);
        });
}

function handleSuperAdminForgotEmailSubmit(event) {
    event.preventDefault();
    superAdminForgotEmail = document.getElementById('wm-forgot-email').value.trim();
    requestSuperAdminOtp(true);
}

function requestSuperAdminOtp(goToOtpStep) {
    return fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: superAdminForgotEmail }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(() => {
            if (!superAdminOtpController) {
                superAdminOtpController = setupOtpInputs('wm-otp-boxes');
            }
            if (goToOtpStep) {
                goToSuperAdminStep('forgot-otp');
            }
            startSuperAdminResendCooldown();
        })
        .catch((error) => {
            showSuperAdminToast(error.message, false);
        });
}

function handleSuperAdminResendOtp() {
    requestSuperAdminOtp(false);
}

function startSuperAdminResendCooldown() {
    const btn = document.getElementById('wm-resend-otp');
    if (!btn) return;
    if (superAdminResendCooldown) clearInterval(superAdminResendCooldown);

    let seconds = 30;
    btn.disabled = true;
    btn.innerText = `ส่งรหัสอีกครั้ง (${seconds}s)`;

    superAdminResendCooldown = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
            clearInterval(superAdminResendCooldown);
            btn.disabled = false;
            btn.innerText = 'ส่งรหัสอีกครั้ง';
        } else {
            btn.innerText = `ส่งรหัสอีกครั้ง (${seconds}s)`;
        }
    }, 1000);
}

function handleSuperAdminVerifyOtpSubmit(event) {
    event.preventDefault();
    const otpCode = superAdminOtpController ? superAdminOtpController.getValue() : '';

    fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: superAdminForgotEmail, otpCode }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(() => {
            superAdminVerifiedOtpCode = otpCode;
            goToSuperAdminStep('forgot-newpass');
        })
        .catch((error) => {
            showSuperAdminToast(error.message, false);
            if (superAdminOtpController) superAdminOtpController.reset();
        });
}

function updateSuperAdminPasswordHint(password) {
    const hint = document.getElementById('wm-reset-password-hint');
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

function handleSuperAdminNewPasswordInput() {
    updateSuperAdminPasswordHint(document.getElementById('wm-reset-new-password').value);
}

function handleSuperAdminForgotResetSubmit(event) {
    event.preventDefault();
    const newPassword = document.getElementById('wm-reset-new-password').value;
    const confirmPassword = document.getElementById('wm-reset-confirm-password').value;

    if (!checkPasswordStrength(newPassword)) {
        updateSuperAdminPasswordHint(newPassword);
        showSuperAdminToast('รหัสผ่านยังไม่ผ่านมาตรฐานความปลอดภัย', false);
        return;
    }
    if (newPassword !== confirmPassword) {
        showSuperAdminToast('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน', false);
        return;
    }

    fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: superAdminForgotEmail, otpCode: superAdminVerifiedOtpCode, newPassword }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then((body) => {
            showSuperAdminToast(body.message, true);
            setTimeout(() => goToSuperAdminStep('login'), 1200);
        })
        .catch((error) => {
            showSuperAdminToast(error.message, false);
        });
}

// เข้าหน้านี้ทั้งที่ล็อกอินเป็น SuperAdmin อยู่แล้ว (เช่นกด back) ให้พาเข้าแผงควบคุมเลย ไม่ต้องกรอกซ้ำ
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
            if (body && body.user && body.user.role === 'SUPERADMIN') {
                window.location.href = '/superadmin/';
            }
        })
        .catch(() => {});
});
