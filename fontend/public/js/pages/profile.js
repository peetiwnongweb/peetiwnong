// คลังภาพโปรไฟล์พี่ค่าย (ไฟล์จริงอยู่ที่ fontend/assets/images/avatars/staff/)
const AVATAR_GALLERY = ['1_base.png', '2_base.png'].map((name) => `/assets/images/avatars/staff/${name}`);
let currentAvatarUrl = null; // รูปที่บันทึกไว้จริงในระบบ
let stagedAvatarUrl = null; // รูปที่กำลังพรีวิวในโมดัล ยังไม่บันทึกจนกว่าจะกด "บันทึก"
let currentAvatarInitial = 'U';
let profileBirthDateSelects = null; // ตัวควบคุม dropdown วันเกิด (setupDateSelects) - null บนหน้าที่ไม่มี element นี้ (participant/profile.html)

function formatDateForInput(isoDate) {
    if (!isoDate) return '';
    return String(isoDate).slice(0, 10);
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
        desc: 'คำอธิบายว่าแต่ละช่องในหน้านี้คืออะไร ช่องไหนแก้เองได้และช่องไหนต้องติดต่อแอดมิน หากติดปัญหาส่วนไหนสามารถติดต่อสอบถามได้ที่ช่องทางท้ายหน้านี้',
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

// สลับช่องตามสถานะ ใช้เงื่อนไขเดียวกับฟอร์มสมัครพี่ค่าย (ดู handleOccupationStatusChange ใน staff-form.js):
// กำลังศึกษา = โชว์คณะ/สาขา และล็อกอาชีพเป็น "นักศึกษา" / ประกอบอาชีพ = พิมพ์อาชีพเอง ซ่อนคณะ/สาขา
function handleProfileOccupationStatusChange() {
    const status = document.getElementById('profile-occupation-status')?.value;
    const occupationInput = document.getElementById('profile-occupation');
    const facultyInput = document.getElementById('profile-faculty');
    const majorInput = document.getElementById('profile-major');
    const occupationGroup = document.getElementById('profile-occupation-field-group');
    const facultyGroup = document.getElementById('profile-faculty-field-group');
    const majorGroup = document.getElementById('profile-major-field-group');
    if (!occupationInput || !facultyInput || !majorInput) return;

    const affiliationInput = document.getElementById('profile-affiliation');
    const affiliationMark = document.getElementById('profile-affiliation-required-mark');
    const occupationMark = document.getElementById('profile-occupation-required-mark');

    const affiliationGroup = document.getElementById('profile-affiliation-field-group');

    // ยังไม่เลือกสถานะ = ยังไม่รู้ว่าจะให้กรอกสังกัดแบบไหน (บริษัท/มหาวิทยาลัย) ซ่อนไว้ก่อนเหมือนฟอร์มสมัคร
    const showStudentFields = status === 'studying';
    facultyGroup.classList.toggle('hidden', !showStudentFields);
    majorGroup.classList.toggle('hidden', !showStudentFields);
    occupationGroup.classList.toggle('hidden', !status);
    affiliationGroup.classList.toggle('hidden', !status);

    // ช่องไหนบังคับกรอกตามสถานะไหน ใช้เกณฑ์เดียวกับฟอร์มสมัคร: กำลังศึกษา = สถาบัน/คณะ/สาขา, ประกอบอาชีพ = อาชีพ
    facultyInput.required = showStudentFields;
    majorInput.required = showStudentFields;
    affiliationInput.required = showStudentFields;
    affiliationMark.classList.toggle('hidden', !showStudentFields);
    occupationInput.required = status === 'working';
    occupationMark.classList.toggle('hidden', status !== 'working');

    if (showStudentFields) {
        occupationInput.value = 'นักศึกษา';
        occupationInput.readOnly = true;
    } else {
        if (occupationInput.readOnly) occupationInput.value = '';
        occupationInput.readOnly = false;
        facultyInput.value = '';
        majorInput.value = '';
        if (!status) {
            occupationInput.value = '';
            affiliationInput.value = '';
        }
    }
}

function handleProfilePhoneInput(event) {
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

function fillProfileForm(user) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('profile-email', user.email);
    setVal('profile-position', (user.position && user.position.name) || 'ยังไม่ได้กำหนด');
    setVal('profile-department', (user.department && user.department.name) || 'ยังไม่ได้กำหนด');
    setVal('profile-prefix', user.prefix);
    setVal('profile-academic-title', user.academicTitle);
    setVal('profile-first-name', user.firstName);
    setVal('profile-last-name', user.lastName);
    setVal('profile-nickname', user.nickname);
    profileBirthDateSelects?.setValue(formatDateForInput(user.birthDate));
    setVal('profile-phone', formatPhoneNumber(user.phone));
    setVal('profile-affiliation', user.affiliation);
    setVal('profile-occupation', user.occupation);
    setVal('profile-faculty', user.faculty);
    setVal('profile-major', user.major);

    // ฐานข้อมูลไม่ได้เก็บ "สถานะ" (ประกอบอาชีพ/กำลังศึกษา) เป็นคอลัมน์แยก - เหมือนฝั่งฟอร์มสมัครที่ใช้เป็นแค่ตัวสลับ UI
    // จึงเดาย้อนกลับจากข้อมูลที่มี: กรอกคณะ/สาขาไว้ = กำลังศึกษา, มีแต่อาชีพ = ประกอบอาชีพ, ไม่มีทั้งคู่ = ยังไม่ได้เลือก
    const statusSelect = document.getElementById('profile-occupation-status');
    if (statusSelect) {
        if (user.faculty || user.major) statusSelect.value = 'studying';
        else if (user.occupation) statusSelect.value = 'working';
        else statusSelect.value = '';
        handleProfileOccupationStatusChange();
    }

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
    testImage.src = url;
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

function handleProfileSettingsSubmit(event) {
    event.preventDefault();

    const payload = {
        prefix: document.getElementById('profile-prefix').value,
        academicTitle: document.getElementById('profile-academic-title').value,
        firstName: document.getElementById('profile-first-name').value,
        lastName: document.getElementById('profile-last-name').value,
        nickname: document.getElementById('profile-nickname').value,
        birthDate: document.getElementById('profile-birth-date').value,
        phone: document.getElementById('profile-phone').value,
        affiliation: document.getElementById('profile-affiliation').value,
        occupation: document.getElementById('profile-occupation').value,
        faculty: document.getElementById('profile-faculty').value,
        major: document.getElementById('profile-major').value,
    };

    // วันเกิดเป็น input[type=hidden] แล้ว (ค่ามาจาก dropdown) เบราว์เซอร์ไม่บังคับ required ให้อีกต่อไป ต้องเช็คเอง
    if (!payload.birthDate) {
        showProfileToast('กรุณาเลือกวันเกิด', false);
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) Loader.setButtonLoading(submitBtn, 'กำลังบันทึก...');

    fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(({ user }) => {
            fillProfileForm(user);
            if (typeof loginUser === 'function') loginUser(user);
            showProfileToast('บันทึกการเปลี่ยนแปลงสำเร็จ', true);
        })
        .catch((error) => {
            showProfileToast(error.message, false);
        })
        .finally(() => {
            if (submitBtn) Loader.clearButtonLoading(submitBtn);
        });
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

    // ช่องวันเกิดพี่ค่าย: dropdown วัน/เดือน/ปี แทน input[type=date] เดิม (บั๊ก iOS Safari กับปฏิทินพุทธศักราช - ดู date-select.js)
    // มีแค่ในหน้า staff/profile.html เท่านั้น (participant/profile.html ที่ใช้ไฟล์นี้ร่วมกันไม่มี element นี้ ฟังก์ชันจะคืน null เฉย ๆ ไม่พัง)
    profileBirthDateSelects = setupDateSelects({ containerId: 'profile-birth-date-selects', hiddenId: 'profile-birth-date', yearsBack: 100, yearsAhead: 0 });

    fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then(({ user }) => fillProfileForm(user))
        .catch(() => {})
        .finally(() => Loader.hideFullPageLoader());
});
