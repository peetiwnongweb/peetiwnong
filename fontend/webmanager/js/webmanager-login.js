// หน้า login แยกต่างหากของ WebManager (สิทธิ์สูงสุด) ไม่ใช้โมดัลร่วมกับพี่ค่าย/น้องค่าย และไม่มีแท็บเลือกบทบาท เพราะ role ถูกกำหนดตายตัวเป็น WEBMANAGER
let webManagerForgotEmail = '';
let webManagerVerifiedOtpCode = '';
let webManagerOtpController = null;
let webManagerResendCooldown = null;

function goToWebManagerStep(step) {
    ['login', 'forgot-email', 'forgot-otp', 'forgot-newpass'].forEach((s) => {
        const el = document.getElementById(`wm-step-${s}`);
        if (el) el.classList.toggle('hidden', s !== step);
    });

    const loginForm = document.getElementById('wm-login-form');
    const forgotEmailForm = document.getElementById('wm-forgot-email-form');
    const forgotNewpassForm = document.getElementById('wm-forgot-newpass-form');
    if (step === 'login' && loginForm) loginForm.reset();
    if (step === 'forgot-email' && forgotEmailForm) forgotEmailForm.reset();
    if (step === 'forgot-otp' && webManagerOtpController) webManagerOtpController.reset();
    if (step === 'forgot-newpass' && forgotNewpassForm) {
        forgotNewpassForm.reset();
        updateWebManagerPasswordHint('');
    }
}

function showWebManagerToast(message, isSuccess) {
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

function handleWebManagerLoginSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('wm-login-email').value.trim();
    const password = document.getElementById('wm-login-password').value;
    const btn = event.target.querySelector('button[type="submit"]');

    Loader.setButtonLoading(btn, 'กำลังเข้าสู่ระบบ...');

    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'WEBMANAGER' }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(() => {
            window.location.href = '/webmanager/index.html';
        })
        .catch((error) => {
            showWebManagerToast(error.message, false);
            Loader.clearButtonLoading(btn);
        });
}

function handleWebManagerForgotEmailSubmit(event) {
    event.preventDefault();
    webManagerForgotEmail = document.getElementById('wm-forgot-email').value.trim();
    requestWebManagerOtp(true);
}

function requestWebManagerOtp(goToOtpStep) {
    return fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: webManagerForgotEmail }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(() => {
            if (!webManagerOtpController) {
                webManagerOtpController = setupOtpInputs('wm-otp-boxes');
            }
            if (goToOtpStep) {
                goToWebManagerStep('forgot-otp');
            }
            startWebManagerResendCooldown();
        })
        .catch((error) => {
            showWebManagerToast(error.message, false);
        });
}

function handleWebManagerResendOtp() {
    requestWebManagerOtp(false);
}

function startWebManagerResendCooldown() {
    const btn = document.getElementById('wm-resend-otp');
    if (!btn) return;
    if (webManagerResendCooldown) clearInterval(webManagerResendCooldown);

    let seconds = 30;
    btn.disabled = true;
    btn.innerText = `ส่งรหัสอีกครั้ง (${seconds}s)`;

    webManagerResendCooldown = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
            clearInterval(webManagerResendCooldown);
            btn.disabled = false;
            btn.innerText = 'ส่งรหัสอีกครั้ง';
        } else {
            btn.innerText = `ส่งรหัสอีกครั้ง (${seconds}s)`;
        }
    }, 1000);
}

function handleWebManagerVerifyOtpSubmit(event) {
    event.preventDefault();
    const otpCode = webManagerOtpController ? webManagerOtpController.getValue() : '';

    fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: webManagerForgotEmail, otpCode }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(() => {
            webManagerVerifiedOtpCode = otpCode;
            goToWebManagerStep('forgot-newpass');
        })
        .catch((error) => {
            showWebManagerToast(error.message, false);
            if (webManagerOtpController) webManagerOtpController.reset();
        });
}

function updateWebManagerPasswordHint(password) {
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

function handleWebManagerNewPasswordInput() {
    updateWebManagerPasswordHint(document.getElementById('wm-reset-new-password').value);
}

function handleWebManagerForgotResetSubmit(event) {
    event.preventDefault();
    const newPassword = document.getElementById('wm-reset-new-password').value;
    const confirmPassword = document.getElementById('wm-reset-confirm-password').value;

    if (!checkPasswordStrength(newPassword)) {
        updateWebManagerPasswordHint(newPassword);
        showWebManagerToast('รหัสผ่านยังไม่ผ่านมาตรฐานความปลอดภัย', false);
        return;
    }
    if (newPassword !== confirmPassword) {
        showWebManagerToast('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน', false);
        return;
    }

    fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: webManagerForgotEmail, otpCode: webManagerVerifiedOtpCode, newPassword }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then((body) => {
            showWebManagerToast(body.message, true);
            setTimeout(() => goToWebManagerStep('login'), 1200);
        })
        .catch((error) => {
            showWebManagerToast(error.message, false);
        });
}

// เข้าหน้านี้ทั้งที่ล็อกอินเป็น WebManager อยู่แล้ว (เช่นกด back) ให้พาเข้าแผงควบคุมเลย ไม่ต้องกรอกซ้ำ
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
            if (body && body.user && body.user.role === 'WEBMANAGER') {
                window.location.href = '/webmanager/index.html';
            }
        })
        .catch(() => {});
});
