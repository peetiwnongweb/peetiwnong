// staff-form.js (โครงเดียวกับ form.js ของน้องค่าย ต่างกันแค่ชื่อกลุ่ม checkbox ในสเต็ป 2: interested_department แทน subject_track)
let currentStep = 1;
const totalSteps = 3;
let regOtpController = null;

// โมดัลคู่มือกรอกฟอร์ม เปิดจากปุ่ม "Help" ท้าย sidebar
function openHelpModal() {
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

// สลับระหว่างช่อง "อาชีพ" กับ "คณะ/สำนักวิชา + สาขาวิชา" ตามสถานะที่เลือก (ประกอบอาชีพ / กำลังศึกษา)
// ช่อง "สถาบัน/สังกัด" ซ่อนไว้ตั้งแต่แรกเหมือนกัน โผล่มาพร้อมกันตอนเลือกสถานะแล้วเท่านั้น
// แต่บังคับกรอกเฉพาะตอน "กำลังศึกษา" เท่านั้น (สถาบันการศึกษาสำคัญกว่า) ส่วน "ประกอบอาชีพ" ไม่บังคับสังกัด
// ล้างค่าของฝั่งที่ซ่อนไปด้วย กันกรอกไว้แล้วสลับสถานะทีหลังแล้วค่าเก่าหลุดติดไปกับ submit
function handleOccupationStatusChange() {
    const status = document.getElementById('reg-occupation-status').value;
    const affiliationGroup = document.getElementById('affiliation-field-group');
    const occupationGroup = document.getElementById('occupation-field-group');
    const studentGroup = document.getElementById('student-field-group');
    const affiliationInput = document.getElementById('reg-affiliation');
    const affiliationRequiredMark = document.getElementById('affiliation-required-mark');
    const occupationInput = document.getElementById('reg-occupation');
    const occupationRequiredMark = document.getElementById('occupation-required-mark');
    const facultyInput = document.getElementById('reg-faculty');
    const majorInput = document.getElementById('reg-major');

    if (status === 'studying') {
        affiliationGroup.classList.remove('hidden');
        // ยังโชว์ช่องอาชีพอยู่ แต่เติมให้เป็น "นักศึกษา" แล้วล็อกไว้แก้ไม่ได้ (เลือก "กำลังศึกษา" ก็คืออาชีพนักศึกษาอยู่แล้ว
        // ไม่ต้องให้กรอกซ้ำ แต่ยังต้องส่งค่าไปเก็บเหมือนกรณีประกอบอาชีพ ไม่งั้นข้อมูลอาชีพจะว่างทั้งที่รู้อยู่แล้ว)
        occupationGroup.classList.remove('hidden');
        studentGroup.classList.remove('hidden');
        affiliationInput.required = true;
        affiliationRequiredMark.classList.remove('hidden');
        occupationInput.value = 'นักศึกษา';
        occupationInput.readOnly = true;
        occupationInput.required = false;
        occupationRequiredMark.classList.add('hidden'); // ระบบเติมให้เองแล้ว ไม่ใช่ช่องที่ผู้สมัครต้องกรอก
        facultyInput.required = true;
        majorInput.required = true;
    } else if (status === 'working') {
        affiliationGroup.classList.remove('hidden');
        studentGroup.classList.add('hidden');
        occupationGroup.classList.remove('hidden');
        affiliationInput.required = false;
        affiliationRequiredMark.classList.add('hidden');
        facultyInput.value = '';
        majorInput.value = '';
        // ปลดล็อกให้พิมพ์อาชีพเองได้ และล้างคำว่า "นักศึกษา" ที่ระบบเติมไว้ตอนเลือก "กำลังศึกษา" ออกก่อน
        if (occupationInput.readOnly) occupationInput.value = '';
        occupationInput.readOnly = false;
        occupationInput.required = true;
        occupationRequiredMark.classList.remove('hidden');
        facultyInput.required = false;
        majorInput.required = false;
    } else {
        // ยังไม่เลือกสถานะ: ซ่อนทั้งหมดไว้ก่อน ไม่ต้อง default ไปทางใดทางหนึ่งให้ และไม่บังคับกรอกฝั่งไหนเลย
        // (ตัว select สถานะเองบังคับเลือกอยู่แล้ว ผู้ใช้ผ่านสเต็ปนี้ไปไม่ได้ถ้ายังไม่เลือก)
        affiliationGroup.classList.add('hidden');
        occupationGroup.classList.add('hidden');
        studentGroup.classList.add('hidden');
        affiliationInput.value = '';
        affiliationInput.required = false;
        affiliationRequiredMark.classList.add('hidden');
        occupationInput.value = '';
        occupationInput.readOnly = false;
        occupationRequiredMark.classList.add('hidden');
        facultyInput.value = '';
        majorInput.value = '';
        occupationInput.required = false;
        facultyInput.required = false;
        majorInput.required = false;
    }
}

// แสดงเบอร์โทรแบบมีขีดให้อ่านง่าย (081-234-5671) เหมือนหน้าโปรไฟล์ โดยไม่ต้องเก็บขีดจริงในข้อมูล
function formatPhoneNumber(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function handleRegPhoneInput(event) {
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

// dropdown วัน/เดือน/ปีเกิด 3 ช่อง แทน input[type=date] เดิม (ตัวควบคุมวันของ iOS Safari มีบั๊กความกว้างขั้นต่ำภายใน
// ล้นกรอบเสมอ แก้ด้วย CSS ทุกทางแล้วยังไม่หาย) เลือกครบ 3 ช่องแล้วค่อยประกอบเป็นวันที่ ISO เก็บใน #reg-dob (hidden)
// ให้โค้ดส่วนอื่น (validateStep, handleFormSubmit) อ่านค่าได้เหมือนเดิมโดยไม่ต้องแก้
function setupDobSelects() {
    const daySelect = document.getElementById('reg-dob-day');
    const monthSelect = document.getElementById('reg-dob-month');
    const yearSelect = document.getElementById('reg-dob-year');
    const hidden = document.getElementById('reg-dob');
    if (!daySelect || !monthSelect || !yearSelect || !hidden) return;

    const nowBuddhistYear = new Date().getFullYear() + 543;
    for (let y = nowBuddhistYear; y >= nowBuddhistYear - 100; y--) {
        const opt = document.createElement('option');
        opt.value = y - 543; // เก็บเป็น ค.ศ. ไว้ประกอบวันที่จริง ส่วนที่โชว์ผู้ใช้เป็น พ.ศ.
        opt.textContent = y;
        yearSelect.appendChild(opt);
    }

    function daysInMonth(month, gregorianYear) {
        if (!month) return 31;
        return new Date(gregorianYear || 2000, month, 0).getDate();
    }

    function rebuildDayOptions() {
        const prevValue = daySelect.value;
        const month = parseInt(monthSelect.value, 10) || 0;
        const gregorianYear = parseInt(yearSelect.value, 10) || null;
        const maxDay = daysInMonth(month, gregorianYear);

        daySelect.innerHTML = '<option value="">วัน</option>';
        for (let d = 1; d <= maxDay; d++) {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            daySelect.appendChild(opt);
        }
        if (prevValue && parseInt(prevValue, 10) <= maxDay) {
            daySelect.value = prevValue;
        }
    }

    function updateHiddenValue() {
        const day = daySelect.value;
        const month = monthSelect.value;
        const year = yearSelect.value;
        const pad = (n) => String(n).padStart(2, '0');
        hidden.value = (day && month && year) ? `${year}-${pad(month)}-${pad(day)}` : '';
    }

    rebuildDayOptions();

    monthSelect.addEventListener('change', () => { rebuildDayOptions(); updateHiddenValue(); });
    yearSelect.addEventListener('change', () => { rebuildDayOptions(); updateHiddenValue(); });
    daySelect.addEventListener('change', updateHiddenValue);
}

// จำค่าที่กรอกไว้ใน localStorage กันรีเฟรชแล้วต้องกรอกใหม่ทั้งหมด
// ไม่จำ: รหัสผ่าน (ห้ามเก็บรหัสผ่านไว้ใน localStorage เด็ดขาด), OTP (ช่องกรอกทีละหลักไม่มี id ให้เก็บอยู่แล้ว หมดอายุเร็วจำไปก็ไม่มีประโยชน์),
// และช่องยอมรับเงื่อนไข PDPA (ให้ผู้ใช้ต้องติ๊กยืนยันใหม่ทุกครั้งที่กลับมา ไม่ควรจำการยินยอมข้ามรอบให้อัตโนมัติ)
const DRAFT_STORAGE_KEY = 'ptn-staff-register-draft';
const DRAFT_EXCLUDED_IDS = new Set(['reg-terms']);

function getDraftableFields() {
    const form = document.getElementById('multi-step-form');
    if (!form) return [];
    return Array.from(form.querySelectorAll('input, select')).filter((el) => (
        el.type !== 'password' && !DRAFT_EXCLUDED_IDS.has(el.id)
    ));
}

function saveFormDraft() {
    const data = {};
    getDraftableFields().forEach((el) => {
        if (el.type === 'radio' || el.type === 'checkbox') {
            if (el.checked) data[el.name || el.id] = el.value;
        } else if (el.id) {
            data[el.id] = el.value;
        }
    });
    try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        // localStorage อาจถูกบล็อก (โหมดส่วนตัว/ตั้งค่าเบราว์เซอร์) แค่ข้ามไปเฉย ๆ ไม่ใช่ฟีเจอร์จำเป็นต่อการสมัคร
    }
}

function clearFormDraft() {
    try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
        // เช่นเดียวกับด้านบน
    }
}

function restoreFormDraft() {
    let data;
    try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) return;
        data = JSON.parse(raw);
    } catch (error) {
        return;
    }

    // วัน/เดือน/ปีเกิด ต้องคืนค่าปี+เดือนก่อน แล้วยิง change เพื่อให้ rebuildDayOptions ทำงาน (ตัวเลือก "วัน" ขึ้นอยู่กับเดือน/ปี)
    // ถึงจะคืนค่า "วัน" ได้ถูกต้อง คืนตามลำดับปกติ (ก่อนเดือน) จะหาตัวเลือกวันที่ยังไม่ถูกสร้างไม่เจอ
    const dobYear = document.getElementById('reg-dob-year');
    const dobMonth = document.getElementById('reg-dob-month');
    const dobDay = document.getElementById('reg-dob-day');
    if (dobYear && data['reg-dob-year'] !== undefined) {
        dobYear.value = data['reg-dob-year'];
        dobYear.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (dobMonth && data['reg-dob-month'] !== undefined) {
        dobMonth.value = data['reg-dob-month'];
        dobMonth.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (dobDay && data['reg-dob-day'] !== undefined) {
        dobDay.value = data['reg-dob-day'];
        dobDay.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // สถานะ (ประกอบอาชีพ/กำลังศึกษา) ต้องคืนค่า+ยิง handler ก่อนช่องอื่น ๆ เพราะ handleOccupationStatusChange จะล้างค่า
    // ของฝั่งที่ไม่เกี่ยวข้อง (เช่นเลือก "ประกอบอาชีพ" จะล้างคณะ/สาขา) ถ้าคืนค่าช่องอาชีพ/คณะ/สาขาไปก่อนจะโดนล้างทิ้งพอดี
    const statusSelect = document.getElementById('reg-occupation-status');
    if (statusSelect && data['reg-occupation-status'] !== undefined) {
        statusSelect.value = data['reg-occupation-status'];
        if (statusSelect.value) handleOccupationStatusChange();
    }

    getDraftableFields().forEach((el) => {
        if (['reg-dob-year', 'reg-dob-month', 'reg-dob-day', 'reg-occupation-status'].includes(el.id)) return; // คืนค่าไปแล้วด้านบน
        if (el.type === 'radio' || el.type === 'checkbox') {
            const key = el.name || el.id;
            if (data[key] !== undefined && el.value === data[key]) {
                el.checked = true;
                const card = el.closest('.checkbox-card');
                if (card) toggleCard(card);
            }
        } else if (el.id && data[el.id] !== undefined) {
            el.value = data[el.id];
        }
    });
}

// ล้างฟอร์มกลับเป็นค่าว่างล้วน ๆ ใช้ native form.reset() เป็นหลัก (คืนค่า select/input ทุกช่องกลับ default ในไฟล์ HTML เอง)
// แต่ .reset() ไม่รู้จัก class "selected" ที่ toggleCard ใส่ไว้เอง กับสถานะโชว์/ซ่อนช่องอาชีพ/คณะ-สาขา เลยต้องเคลียร์เพิ่มเอง
function resetFormToBlank() {
    const form = document.getElementById('multi-step-form');
    if (form) form.reset();
    document.querySelectorAll('.checkbox-card.selected').forEach((card) => card.classList.remove('selected'));
    handleOccupationStatusChange();
}

function handleClearDraftClick() {
    clearFormDraft();
    resetFormToBlank();
    showFormToast('ล้างฟอร์มแล้ว', false);
}

document.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    setupDobSelects();
    regOtpController = setupOtpInputs('reg-otp-boxes');
    restoreFormDraft();

    showStep(currentStep);
    updateStepVisuals(currentStep);

    const form = document.getElementById('multi-step-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        form.addEventListener('input', saveFormDraft);
        form.addEventListener('change', saveFormDraft);
    }

    Loader.hideFullPageLoader();
});

function nextStep(stepNumber) {
    if (!validateStep(currentStep)) {
        return;
    }

    currentStep = stepNumber;
    showStep(currentStep);
    updateStepVisuals(currentStep);
}

function prevStep(stepNumber) {
    currentStep = stepNumber;
    showStep(currentStep);
    updateStepVisuals(currentStep);
}

function showStep(stepNumber) {
    for (let i = 1; i <= totalSteps; i++) {
        const stepContent = document.getElementById(`step-content-${i}`);
        if (stepContent) {
            stepContent.classList.remove('active');
        }
    }

    const activeStep = document.getElementById(`step-content-${stepNumber}`);
    if (activeStep) {
        activeStep.classList.add('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepVisuals(stepNumber) {
    for (let i = 1; i <= totalSteps; i++) {
        const indicator = document.getElementById(`indicator-step-${i}`);
        const icon = indicator.querySelector('.step-icon');

        if (!indicator || !icon) continue;

        indicator.classList.remove('active', 'completed', 'pending');

        if (i < stepNumber) {
            indicator.classList.add('completed');
            icon.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;
        } else if (i === stepNumber) {
            indicator.classList.add('active');
            icon.innerHTML = i;
        } else {
            indicator.classList.add('pending');
            icon.innerHTML = i;
        }
    }
}

function validateStep(step) {
    const stepElement = document.getElementById(`step-content-${step}`);
    if (!stepElement) return true;

    const inputs = stepElement.querySelectorAll('input[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!input.value.trim() && input.type !== 'checkbox') {
            isValid = false;
            input.style.borderColor = 'var(--rose-600)';
        } else if (input.type === 'checkbox' && !input.checked) {
            if (input.name !== 'interested_department') {
                isValid = false;
                input.style.borderColor = 'var(--rose-600)';
            }
        } else {
            input.style.borderColor = '';
        }
    });

    // สเต็ป 2 เฉพาะ: ต้องเลือกฝ่ายงานที่สนใจอย่างน้อย 1 ฝ่าย
    if (step === 2) {
        const checkboxes = stepElement.querySelectorAll('input[name="interested_department"]:checked');
        if (checkboxes.length === 0) {
            isValid = false;
            showFormToast("กรุณาเลือกฝ่ายงานที่สนใจอย่างน้อย 1 ข้อ", true);
        }
    }

    if (!isValid && step !== 2) {
        showFormToast("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน", true);
        return false;
    }

    if (step === 3 && isValid) {
        const otp = regOtpController ? regOtpController.getValue() : '';
        if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            showFormToast("กรุณากรอกรหัส OTP ให้ถูกต้อง (ตัวเลข 6 หลัก)", true);
            return false;
        }

        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        if (password !== confirmPassword) {
            document.getElementById('reg-confirm-password').style.borderColor = 'var(--rose-600)';
            showFormToast("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน", true);
            return false;
        }
    }

    return isValid;
}

// อัปเดตสีเขียว/แดงของ checklist เงื่อนไขรหัสผ่านใต้ช่องกรอก ตามเงื่อนไขเดียวกับที่ backend บังคับจริง (PASSWORD_PATTERN)
function updatePasswordChecklist() {
    const password = document.getElementById('reg-password').value;
    const rules = {
        length: password.length >= 8,
        lower: /[a-z]/.test(password),
        upper: /[A-Z]/.test(password),
        number: /\d/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    Object.entries(rules).forEach(([rule, met]) => {
        const li = document.querySelector(`[data-rule="${rule}"]`);
        if (li) li.classList.toggle('met', met);
    });
}

function toggleCard(labelElement) {
    const input = labelElement.querySelector('input[type="checkbox"], input[type="radio"]');
    if (!input) return;

    setTimeout(() => {
        if (input.type === 'radio') {
            document.querySelectorAll(`input[type="radio"][name="${input.name}"]`).forEach((radio) => {
                const card = radio.closest('.checkbox-card');
                if (card) card.classList.toggle('selected', radio.checked);
            });
        } else if (input.checked) {
            labelElement.classList.add('selected');
        } else {
            labelElement.classList.remove('selected');
        }
    }, 0);
}

let formToastTimeout = null;

function showFormToast(message, isError) {
    const toast = document.getElementById('form-toast');
    const messageEl = document.getElementById('form-toast-message');
    const bar = toast ? toast.querySelector('.form-toast-bar') : null;
    if (!toast || !messageEl || !bar) return;

    clearTimeout(formToastTimeout);
    messageEl.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('visible');

    // รีเซ็ตแถบโหลดแล้วบังคับ reflow (bar.offsetWidth) ก่อนใส่คลาส running กลับ ไม่งั้นถ้า toast เด้งซ้อนกันถี่ ๆ
    // แอนิเมชันเดิมที่ยังไม่จบจะไม่ยอมรีสตาร์ทใหม่ (browser มองว่าคลาสไม่เปลี่ยน)
    bar.classList.remove('running');
    bar.style.transform = 'scaleX(0)';
    void bar.offsetWidth;
    bar.style.transform = '';
    bar.classList.add('running');

    formToastTimeout = setTimeout(() => toast.classList.remove('visible'), 3000);
}

function handleFormSubmit(event) {
    event.preventDefault();

    if (!validateStep(3)) {
        return;
    }

    const btn = document.querySelector('button[type="submit"]');
    if (btn) Loader.setButtonLoading(btn, 'กำลังประมวลผล...');

    const profile = {
        prefix: document.getElementById('reg-prefix').value,
        academicTitle: document.getElementById('reg-academic-title').value.trim(),
        firstName: document.getElementById('reg-firstname').value.trim(),
        lastName: document.getElementById('reg-lastname').value.trim(),
        nickname: document.getElementById('reg-nickname').value.trim(),
        birthDate: document.getElementById('reg-dob').value,
        phone: document.getElementById('reg-phone').value.replace(/\D/g, ''),
        department: (document.querySelector('input[name="interested_department"]:checked') || {}).value || '',
        affiliation: document.getElementById('reg-affiliation').value.trim(),
        // ส่งค่าอาชีพเสมอ ไม่ได้ส่งเฉพาะตอนเลือก "ประกอบอาชีพ" แล้ว เพราะตอนเลือก "กำลังศึกษา" ระบบเติม "นักศึกษา" ให้อัตโนมัติ
        // (ถ้ายังตัดทิ้งเหมือนเดิม ค่าที่เติมให้จะไม่ถูกบันทึก) ส่วนกรณียังไม่เลือกสถานะ ช่องนี้ถูกล้างเป็นค่าว่างอยู่แล้ว
        occupation: document.getElementById('reg-occupation').value.trim(),
        faculty: document.getElementById('reg-occupation-status').value === 'studying'
            ? document.getElementById('reg-faculty').value.trim() : '',
        major: document.getElementById('reg-occupation-status').value === 'studying'
            ? document.getElementById('reg-major').value.trim() : '',
    };

    fetch('/api/auth/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: document.getElementById('reg-email').value.trim(),
            otpCode: regOtpController ? regOtpController.getValue() : '',
            password: document.getElementById('reg-password').value,
            role: 'STAFF',
            profile,
        }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            clearFormDraft();
            showFormToast('ส่งใบสมัครพี่ค่ายสำเร็จ! บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ กำลังพากลับหน้าหลัก...', false);
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2500);
        })
        .catch((error) => {
            showFormToast(error.message, true);
            if (btn) Loader.clearButtonLoading(btn);
        });
}

function requestOTP() {
    const email = document.getElementById('reg-email').value.trim();
    if (!email) {
        showFormToast("กรุณากรอกอีเมลก่อนขอรับรหัส OTP", true);
        return;
    }

    const btn = document.getElementById('btn-request-otp');
    btn.disabled = true;

    fetch('/api/auth/register/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: 'STAFF' }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        })
        .then(() => {
            showFormToast(`ส่งรหัส OTP ไปยัง ${email} แล้ว กรุณาตรวจสอบกล่องจดหมาย`, false);
            if (regOtpController) regOtpController.reset();
            let countdown = 60;
            btn.innerText = `ส่งใหม่ (${countdown}s)`;
            const timer = setInterval(() => {
                countdown--;
                btn.innerText = `ส่งใหม่ (${countdown}s)`;
                if (countdown <= 0) {
                    clearInterval(timer);
                    btn.disabled = false;
                    btn.innerText = "ขอรับ OTP";
                }
            }, 1000);
        })
        .catch((error) => {
            showFormToast(error.message, true);
            btn.disabled = false;
        });
}
