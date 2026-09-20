// form.js
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
const DRAFT_STORAGE_KEY = 'ptn-participant-register-draft';
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
        if (el.type === 'radio') {
            if (el.checked) data[el.name || el.id] = el.value;
        } else if (el.type === 'checkbox') {
            // checkbox เลือกได้หลายอันในกลุ่มเดียวกันได้ (เช่น subject_track) เก็บเป็น array เสมอ ต่างจาก radio ที่เลือกได้ทีละอัน
            if (!el.checked) return;
            const key = el.name || el.id;
            if (!Array.isArray(data[key])) data[key] = [];
            data[key].push(el.value);
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

    getDraftableFields().forEach((el) => {
        if (['reg-dob-year', 'reg-dob-month', 'reg-dob-day'].includes(el.id)) return; // คืนค่าไปแล้วด้านบน
        if (el.type === 'radio') {
            const key = el.name || el.id;
            if (data[key] !== undefined && el.value === data[key]) {
                el.checked = true;
                const card = el.closest('.checkbox-card');
                if (card) toggleCard(card);
            }
        } else if (el.type === 'checkbox') {
            const key = el.name || el.id;
            const stored = data[key];
            if (Array.isArray(stored) && stored.includes(el.value)) {
                el.checked = true;
                const card = el.closest('.checkbox-card');
                if (card) toggleCard(card);
            }
        } else if (el.id && data[el.id] !== undefined) {
            el.value = data[el.id];
        }
    });

    // ค่า reg-plan/checkbox subject_track ถูกคืนไปแล้วในลูปด้านบน แต่ set ค่าตรง ๆ ไม่ได้ยิง change event เลยต้องเรียกฟังก์ชันนี้เองอีกที
    // เพื่อโชว์/ซ่อนช่อง "ระบุ" ให้ตรงกับค่าที่คืนมา (ไม่กระทบค่าที่เพิ่งคืน เพราะฟังก์ชันนี้เคลียร์ค่าเฉพาะตอนไม่ได้เลือก OTHER เท่านั้น)
    handleStudyPlanChange();
    handleInterestOtherChange();
}

// สลับโชว์/ซ่อนช่อง "ระบุแผนการเรียน" ตามที่เลือกในดรอปดาวน์ "แผนการเรียนปัจจุบัน"
// สลับ required ของช่องระบุไปด้วย เพราะ validateStep() เช็คจาก attribute required ทั่วไปอยู่แล้ว ไม่ต้องเขียนเงื่อนไขเพิ่ม
function handleStudyPlanChange() {
    const select = document.getElementById('reg-plan');
    const group = document.getElementById('study-plan-other-group');
    const otherInput = document.getElementById('reg-plan-other');
    if (!select || !group || !otherInput) return;

    const isOther = select.value === 'OTHER';
    group.classList.toggle('hidden', !isOther);
    otherInput.required = isOther;
    if (!isOther) otherInput.value = '';
}

// สลับโชว์/ซ่อนช่อง "ระบุกลุ่มวิชาที่สนใจ" ตามที่ติ๊กการ์ด "อื่น ๆ" ในกลุ่มวิชาที่สนใจเป็นพิเศษหรือไม่ (แพทเทิร์นเดียวกับ handleStudyPlanChange)
function handleInterestOtherChange() {
    const checkbox = document.querySelector('input[name="subject_track"][value="OTHER"]');
    const group = document.getElementById('interest-other-group');
    const otherInput = document.getElementById('reg-interest-other');
    if (!checkbox || !group || !otherInput) return;

    const isOther = checkbox.checked;
    group.classList.toggle('hidden', !isOther);
    otherInput.required = isOther;
    if (!isOther) otherInput.value = '';
}

// ล้างฟอร์มกลับเป็นค่าว่างล้วน ๆ ใช้ native form.reset() เป็นหลัก (คืนค่า select/input ทุกช่องกลับ default ในไฟล์ HTML เอง)
// แต่ .reset() ไม่รู้จัก class "selected" ที่ toggleCard ใส่ไว้เอง และไม่รู้จักช่อง "ระบุ" ที่โชว์/ซ่อนเองผ่าน JS เลยต้องเคลียร์เพิ่ม
function resetFormToBlank() {
    const form = document.getElementById('multi-step-form');
    if (form) form.reset();
    document.querySelectorAll('.checkbox-card.selected').forEach((card) => card.classList.remove('selected'));
    handleStudyPlanChange();
    handleInterestOtherChange();
}

function handleClearDraftClick() {
    clearFormDraft();
    resetFormToBlank();
    showFormToast('ล้างฟอร์มแล้ว', false);
}

// Initialize form on load
document.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    setupDobSelects();
    regOtpController = setupOtpInputs('reg-otp-boxes');
    restoreFormDraft();

    // Show step 1 initially
    showStep(currentStep);
    updateStepVisuals(currentStep);

    // Bind form submission
    const form = document.getElementById('multi-step-form');
    if (form) {
        form.addEventListener('input', saveFormDraft);
        form.addEventListener('change', saveFormDraft);
        form.addEventListener('submit', handleFormSubmit);
    }

    Loader.hideFullPageLoader();
});

function nextStep(stepNumber) {
    // Validate current step before proceeding
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
    // Hide all steps
    for (let i = 1; i <= totalSteps; i++) {
        const stepContent = document.getElementById(`step-content-${i}`);
        if (stepContent) {
            stepContent.classList.remove('active');
        }
    }
    
    // Show current step
    const activeStep = document.getElementById(`step-content-${stepNumber}`);
    if (activeStep) {
        activeStep.classList.add('active');
    }
    
    // Scroll to top of form area if needed
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepVisuals(stepNumber) {
    for (let i = 1; i <= totalSteps; i++) {
        const indicator = document.getElementById(`indicator-step-${i}`);
        const icon = indicator.querySelector('.step-icon');
        
        if (!indicator || !icon) continue;
        
        // Reset classes
        indicator.classList.remove('active', 'completed', 'pending');
        
        if (i < stepNumber) {
            // Completed steps
            indicator.classList.add('completed');
            icon.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;
        } else if (i === stepNumber) {
            // Active step
            indicator.classList.add('active');
            icon.innerHTML = i;
        } else {
            // Pending steps
            indicator.classList.add('pending');
            icon.innerHTML = i;
        }
    }
}

function validateStep(step) {
    // A simple validation: check if required fields in the current step are filled
    const stepElement = document.getElementById(`step-content-${step}`);
    if (!stepElement) return true;
    
    const inputs = stepElement.querySelectorAll('input[required], select[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim() && input.type !== 'checkbox') {
            isValid = false;
            input.style.borderColor = 'var(--rose-600)';
        } else if (input.type === 'checkbox' && !input.checked) {
            // Special handling if checkbox is required but not in step 3
            if (input.name !== 'subject_track') {
                isValid = false;
                input.style.borderColor = 'var(--rose-600)';
            }
        } else {
            input.style.borderColor = ''; // reset
        }
    });
    
    if (!isValid) {
        showFormToast("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน", true);
        return false;
    }

    // Step 3 specific validation: OTP + Match password
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

// Toggle checkbox/radio card UI
function toggleCard(labelElement) {
    const input = labelElement.querySelector('input[type="checkbox"], input[type="radio"]');
    if (!input) return;

    // Use setTimeout to allow browser default action to check/uncheck first
    setTimeout(() => {
        if (input.type === 'radio') {
            // radio = เลือกได้ทีละ 1 ต้องเอา .selected ออกจากการ์ดอื่นในกลุ่มเดียวกันด้วย
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
        firstName: document.getElementById('reg-firstname').value.trim(),
        lastName: document.getElementById('reg-lastname').value.trim(),
        nickname: document.getElementById('reg-nickname').value.trim(),
        birthDate: document.getElementById('reg-dob').value,
        phone: document.getElementById('reg-phone').value.replace(/\D/g, ''),
        parentPhone: document.getElementById('reg-parent-phone').value.replace(/\D/g, ''),
        courseFormat: document.getElementById('reg-course').value,
        studyPlan: document.getElementById('reg-plan').value,
        studyPlanOther: document.getElementById('reg-plan-other').value.trim(),
        interestSubjectGroup: Array.from(document.querySelectorAll('input[name="subject_track"]:checked')).map((el) => el.value),
        interestSubjectGroupOther: document.getElementById('reg-interest-other').value.trim(),
        dreamInstitution: document.getElementById('reg-dream').value.trim(),
    };

    fetch('/api/auth/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: document.getElementById('reg-email').value.trim(),
            otpCode: regOtpController ? regOtpController.getValue() : '',
            password: document.getElementById('reg-password').value,
            role: 'PARTICIPANT',
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
            showFormToast('ลงทะเบียนสำเร็จ! บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ กำลังพากลับหน้าหลัก...', false);
            setTimeout(() => {
                window.location.href = '../';
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
        body: JSON.stringify({ email, role: 'PARTICIPANT' }),
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
