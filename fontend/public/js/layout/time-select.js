// ==========================================
// ช่องเลือกเวลาแบบ 2 dropdown (ชั่วโมง / นาที) ใช้แทน <input type="time">
// เหตุผล: ตัวควบคุมเวลาของ iOS Safari เป็น UI ล้อหมุน (wheel picker) ที่มีบั๊กเดียวกับช่องวันที่เดิม
// (ดู date-select.js) คือมี UA default บังคับความกว้างขั้นต่ำภายใน (shadow DOM) สูงเกินจอมือถือ ล้นกรอบฟอร์ม
// แก้ด้วย CSS ทุกทางที่มีแล้วก็ยังล้นอยู่ดี ใช้วิธีเดียวกับวันที่คือเปลี่ยนมาเป็น dropdown ธรรมดาแทนไปเลย
//
// วิธีใช้: วาง <div id="xxx-selects"></div> กับ <input type="hidden" id="xxx"> ไว้ใน HTML แล้วเรียก
//   const ctl = setupTimeSelects({ containerId: 'xxx-selects', hiddenId: 'xxx' });
// ค่าที่ได้เก็บใน hidden เป็น "HH:MM" (24 ชม. เลขนำหน้าศูนย์) เหมือน input[type=time].value เดิม โค้ดส่วนอื่นอ่านค่าได้โดยไม่ต้องแก้
// ==========================================

function setupTimeSelects({ containerId, hiddenId }) {
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(hiddenId);
    if (!container || !hidden) return null;

    container.classList.add('time-select-row');
    container.innerHTML = `
        <select class="form-input time-select" data-part="hour"><option value="">ชม.</option></select>
        <span class="time-select-sep">:</span>
        <select class="form-input time-select" data-part="minute"><option value="">นาที</option></select>
    `;

    const hourSelect = container.querySelector('[data-part="hour"]');
    const minuteSelect = container.querySelector('[data-part="minute"]');
    const pad = (n) => String(n).padStart(2, '0');

    for (let h = 0; h <= 23; h++) {
        const opt = document.createElement('option');
        opt.value = pad(h);
        opt.textContent = pad(h);
        hourSelect.appendChild(opt);
    }
    for (let m = 0; m <= 59; m++) {
        const opt = document.createElement('option');
        opt.value = pad(m);
        opt.textContent = pad(m);
        minuteSelect.appendChild(opt);
    }

    function syncHidden() {
        const [h, m] = [hourSelect.value, minuteSelect.value];
        hidden.value = (h && m) ? `${h}:${m}` : '';
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }

    [hourSelect, minuteSelect].forEach((el) => el.addEventListener('change', syncHidden));

    return {
        getValue: () => hidden.value,
        setValue(hhmm) {
            const match = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
            if (!match) return this.clear();
            hourSelect.value = match[1];
            minuteSelect.value = match[2];
            syncHidden();
        },
        clear() {
            hourSelect.value = '';
            minuteSelect.value = '';
            syncHidden();
        },
    };
}
