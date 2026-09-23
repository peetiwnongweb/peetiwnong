// คลังภาพโปรไฟล์พี่ค่าย (ไฟล์จริงอยู่ที่ fontend/assets/images/avatars/staff/)
const AVATAR_GALLERY = ['1_base.png', '2_base.png'].map((name) => `/assets/images/avatars/staff/${name}`);
let currentAvatarUrl = null; // รูปที่บันทึกไว้จริงในระบบ
let stagedAvatarUrl = null; // รูปที่กำลังพรีวิวในโมดัล ยังไม่บันทึกจนกว่าจะกด "บันทึก"
let currentAvatarInitial = 'U';

function formatBirthDateDisplay(isoDate) {
    if (!isoDate) return 'ยังไม่ได้กำหนด';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'ยังไม่ได้กำหนด';
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

// แสดงเบอร์โทรแบบมีขีดให้อ่านง่าย (081-234-5671) โดยไม่ต้องเก็บขีดจริงในข้อมูล
function formatPhoneNumber(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// คู่มืออธิบายแต่ละช่องในหน้านี้ (แนวเดียวกับปุ่ม Help ในฟอร์มสมัคร - ดู openHelpModal ใน staff-form.js)
// ใช้โมดัลตัวเดียวร่วมกันทั้ง 2 แท็บ สลับเฉพาะหัวเรื่องกับบล็อกเนื้อหา ส่วนช่องทางติดต่อ/ปุ่มปิดใช้ร่วมกัน
const HELP_TOPICS = {
    profile: {
        tag: 'คู่มือการแก้ไขข้อมูล',
        title: 'วิธีแก้ไขข้อมูลโปรไฟล์',
        desc: 'ทุกช่องในหน้านี้เป็นข้อมูลดูอย่างเดียว แก้ไขเองไม่ได้ (ยกเว้นรูปโปรไฟล์และรหัสผ่าน) เลื่อนลงไปดูความหมายของแต่ละช่องและวิธีแก้ไขข้อมูลด้านล่าง',
    },
    security: {
        tag: 'คู่มือความปลอดภัย',
        title: 'วิธีเปลี่ยนรหัสผ่าน',
        desc: 'คำอธิบายว่าแต่ละช่องต้องกรอกอะไร และรหัสผ่านใหม่ต้องผ่านเงื่อนไขอะไรบ้าง (ใช้เกณฑ์ชุดเดียวกับตอนสมัคร) หากติดปัญหาส่วนไหนสามารถติดต่อสอบถามได้ที่ช่องทางท้ายหน้านี้',
    },
};

function openHelpModal(topic = 'profile') {
    const modal = document.getElementById('help-modal');
    if (!modal) return;

    const info = HELP_TOPICS[topic] || HELP_TOPICS.profile;
    document.getElementById('help-modal-tag').textContent = info.tag;
    document.getElementById('help-modal-title').textContent = info.title;
    document.getElementById('help-modal-desc').textContent = info.desc;
    Object.keys(HELP_TOPICS).forEach((key) => {
        document.getElementById(`help-topic-${key}`)?.classList.toggle('hidden', key !== topic);
    });

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

// ทั้งฟอร์มเป็นช่องแสดงผลอ่านอย่างเดียวทั้งหมด (แก้เองไม่ได้ ยกเว้นรูปโปรไฟล์ด้านบน) ไม่มีฟอร์มให้บันทึกอีกต่อไป - ผิดพลาดต้องแจ้งแอดมินแก้ให้ (เหมือน participant/profile.html)
function fillProfileForm(user) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || 'ยังไม่ได้กำหนด';
    };

    setVal('profile-email', user.email);
    setVal('profile-position', user.position && user.position.name);
    setVal('profile-department', user.department && user.department.name);
    setVal('profile-prefix', user.prefix);
    setVal('profile-academic-title', user.academicTitle);
    setVal('profile-first-name', user.firstName);
    setVal('profile-last-name', user.lastName);
    setVal('profile-nickname', user.nickname);
    setVal('profile-birth-date', formatBirthDateDisplay(user.birthDate));
    setVal('profile-phone', formatPhoneNumber(user.phone));
    setVal('profile-affiliation', user.affiliation);
    setVal('profile-occupation', user.occupation);
    setVal('profile-faculty', user.faculty);
    setVal('profile-major', user.major);

    // ฐานข้อมูลไม่ได้เก็บ "สถานะ" (ประกอบอาชีพ/กำลังศึกษา) เป็นคอลัมน์แยก - เดาย้อนกลับจากข้อมูลที่มีเหมือนที่แผงแอดมิน/WebManager ใช้แสดงในตาราง (มีคณะ/สาขา = กำลังศึกษา, มีแต่อาชีพ = ประกอบอาชีพ)
    const statusText = user.faculty || user.major ? 'กำลังศึกษา (ระดับอุดมศึกษา)' : (user.occupation ? 'ประกอบอาชีพ' : null);
    setVal('profile-occupation-status', statusText);

    currentAvatarUrl = user.avatarUrl || null;
    currentAvatarInitial = (user.firstName || user.email || 'U').charAt(0).toUpperCase();
    const avatarPreview = document.getElementById('profile-avatar-preview');
    if (typeof renderAvatar === 'function') {
        renderAvatar(avatarPreview, user.avatarUrl, currentAvatarInitial);
    } else if (avatarPreview) {
        avatarPreview.innerText = currentAvatarInitial;
    }
}

// ==========================================
// เปลี่ยนรูปโปรไฟล์ (เลือกจากคลัง หรือใส่ URL เอง) — เลือก/พิมพ์ URL แค่พรีวิว ต้องกด "บันทึก" ถึงจะมีผลจริง
// ==========================================
function showAvatarPickerError(message) {
    const errorBox = document.getElementById('avatar-picker-error');
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
}

function hideAvatarPickerError() {
    const errorBox = document.getElementById('avatar-picker-error');
    if (errorBox) errorBox.classList.add('hidden');
}

function openAvatarPicker() {
    stagedAvatarUrl = currentAvatarUrl;
    hideAvatarPickerError();
    const urlInput = document.getElementById('avatar-url-input');
    if (urlInput) urlInput.value = '';
    renderAvatarGallery();
    updateAvatarPickerPreview();
    const modal = document.getElementById('avatar-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAvatarPicker() {
    const modal = document.getElementById('avatar-modal');
    if (modal) modal.classList.add('hidden');
    hideAvatarPickerError();
    stagedAvatarUrl = null;
}

function updateAvatarPickerPreview() {
    const preview = document.getElementById('avatar-picker-preview');
    if (typeof renderAvatar === 'function') {
        renderAvatar(preview, stagedAvatarUrl, currentAvatarInitial);
    } else if (preview) {
        preview.innerText = currentAvatarInitial;
    }

    document.querySelectorAll('#avatar-gallery-grid .avatar-gallery-item').forEach((item) => {
        item.classList.toggle('selected', item.dataset.avatarUrl === stagedAvatarUrl);
    });
}

function renderAvatarGallery() {
    const grid = document.getElementById('avatar-gallery-grid');
    if (!grid) return;
    grid.innerHTML = '';
    AVATAR_GALLERY.forEach((url) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'avatar-gallery-item' + (url === stagedAvatarUrl ? ' selected' : '');
        btn.dataset.avatarUrl = url;
        btn.setAttribute('aria-label', 'เลือกรูปโปรไฟล์นี้');
        btn.innerHTML = `<img src="${url}" alt="">`;
        btn.addEventListener('click', () => {
            hideAvatarPickerError();
            stagedAvatarUrl = url;
            updateAvatarPickerPreview();
        });
        grid.appendChild(btn);
    });
}

// ดักปัญหา URL: ต้องขึ้นต้นด้วย / หรือ http(s):// (ตรงกับที่ backend ตรวจ) และต้องโหลดเป็นรูปได้จริงก่อนถึงจะพรีวิวให้
function handleCustomAvatarUrlSubmit(event) {
    event.preventDefault();
    hideAvatarPickerError();

    const input = document.getElementById('avatar-url-input');
    const url = input ? input.value.trim() : '';
    if (!url) return;

    if (!/^(https?:\/\/|\/)/.test(url)) {
        showAvatarPickerError('URL รูปภาพไม่ถูกต้อง ต้องขึ้นต้นด้วย / หรือ http(s)://');
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) Loader.setButtonLoading(submitBtn, 'กำลังตรวจสอบ...');

    const testImage = new Image();
    testImage.onload = () => {
        if (submitBtn) Loader.clearButtonLoading(submitBtn);
        stagedAvatarUrl = url;
        updateAvatarPickerPreview();
    };
    testImage.onerror = () => {
        if (submitBtn) Loader.clearButtonLoading(submitBtn);
        showAvatarPickerError('ไม่สามารถโหลดรูปภาพจาก URL นี้ได้ กรุณาตรวจสอบ URL อีกครั้ง');
    };
    testImage.src = window.PTN_MEDIA_URL(url);
}

function saveAvatar() {
    if (!stagedAvatarUrl || stagedAvatarUrl === currentAvatarUrl) {
        closeAvatarPicker();
        return;
    }
    hideAvatarPickerError();

    const saveBtn = document.getElementById('avatar-save-btn');
    if (saveBtn) Loader.setButtonLoading(saveBtn, 'กำลังบันทึก...');

    fetch('/api/auth/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: stagedAvatarUrl }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(({ user }) => {
            fillProfileForm(user);
            if (typeof loginUser === 'function') loginUser(user);
            closeAvatarPicker();
        })
        .catch((error) => {
            showAvatarPickerError(error.message);
        })
        .finally(() => {
            if (saveBtn) Loader.clearButtonLoading(saveBtn);
        });
}

// เด้ง pop up ลอยแจ้งผลลัพธ์การบันทึกฟอร์ม (สำเร็จ = เขียว, ผิดพลาด = แดง) ใช้ร่วมกันทั้งฟอร์มโปรไฟล์และฟอร์มความปลอดภัย
let profileToastTimer = null;
function showProfileToast(message, isSuccess) {
    const toast = document.getElementById('profile-toast');
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

    clearTimeout(profileToastTimer);
    profileToastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// checklist เงื่อนไขรหัสผ่านใต้ช่องกรอก ใช้เกณฑ์เดียวกับฟอร์มสมัคร (ดู updatePasswordChecklist ใน staff-form.js)
// และตรงกับที่ backend บังคับจริง (backend/lib/password.js)
function handleSecurityNewPasswordInput() {
    const password = document.getElementById('security-new-password').value;
    const rules = {
        length: password.length >= 8,
        lower: /[a-z]/.test(password),
        upper: /[A-Z]/.test(password),
        number: /\d/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    Object.entries(rules).forEach(([rule, met]) => {
        const li = document.querySelector(`#security-password-checklist [data-rule="${rule}"], #security-password-checklist-categories [data-rule="${rule}"]`);
        if (li) li.classList.toggle('met', met);
    });
}

function handleSecuritySubmit(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('security-current-password').value;
    const newPassword = document.getElementById('security-new-password').value;
    const confirmPassword = document.getElementById('security-confirm-password').value;

    if (!checkPasswordStrength(newPassword)) {
        showProfileToast('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร และผ่านอย่างน้อย 3 ใน 4 ประเภท (พิมพ์เล็ก/พิมพ์ใหญ่/ตัวเลข/อักขระพิเศษ)', false);
        return;
    }
    if (newPassword !== confirmPassword) {
        showProfileToast('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน', false);
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) Loader.setButtonLoading(submitBtn, 'กำลังบันทึก...');

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
            event.target.reset();
            handleSecurityNewPasswordInput();
            showProfileToast('เปลี่ยนรหัสผ่านสำเร็จ', true);
        })
        .catch((error) => {
            showProfileToast(error.message, false);
        })
        .finally(() => {
            if (submitBtn) Loader.clearButtonLoading(submitBtn);
        });
}

document.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    window.PTN_AUTH_ME
        .then(({ user }) => { if (user) fillProfileForm(user); })
        .finally(() => Loader.hideFullPageLoader());
});
