function setupOtpInputs(containerId, onComplete) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const inputs = Array.from(container.querySelectorAll('.otp-digit'));

    function currentValue() {
        return inputs.map((input) => input.value).join('');
    }

    function checkComplete() {
        if (inputs.every((input) => input.value) && typeof onComplete === 'function') {
            onComplete(currentValue());
        }
    }

    inputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);
            if (input.value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
            checkComplete();
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Backspace' && !input.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        input.addEventListener('paste', (event) => {
            event.preventDefault();
            const pasted = (event.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
            pasted.split('').slice(0, inputs.length).forEach((char, i) => {
                if (inputs[i]) inputs[i].value = char;
            });
            const nextEmpty = inputs.findIndex((i) => !i.value);
            (nextEmpty === -1 ? inputs[inputs.length - 1] : inputs[nextEmpty]).focus();
            checkComplete();
        });
    });

    return {
        getValue: currentValue,
        reset: () => {
            inputs.forEach((input) => { input.value = ''; });
            inputs[0].focus();
        },
        focus: () => inputs[0].focus(),
    };
}

// เกณฑ์รหัสผ่านต้องตรงกับที่ backend บังคับจริงเสมอ (ดู backend/lib/password.js: isPasswordValid)
// คือยาวอย่างน้อย 8 ตัว และผ่านอย่างน้อย 3 ใน 4 ประเภท: พิมพ์เล็ก / พิมพ์ใหญ่ / ตัวเลข / อักขระพิเศษ
// เดิมเช็คแค่ "มีตัวอักษร+ตัวเลข ยาว 8" ซึ่งหลวมกว่าจริง รหัสอย่าง abcd1234 เลยผ่านหน้าเว็บแต่ไปโดนปฏิเสธที่เซิร์ฟเวอร์
function checkPasswordStrength(password) {
    if (typeof password !== 'string' || password.length < 8) return false;
    const categoriesMet = [
        /[a-z]/.test(password),
        /[A-Z]/.test(password),
        /\d/.test(password),
        /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;
    return categoriesMet >= 3;
}

const EYE_ICON = '<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';
const EYE_OFF_ICON = '<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.774 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>';

function togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (btnEl) {
        btnEl.innerHTML = isPassword ? EYE_OFF_ICON : EYE_ICON;
        btnEl.setAttribute('aria-label', isPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
    }
}
