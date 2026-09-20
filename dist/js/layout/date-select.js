// ==========================================
// ช่องเลือกวันที่แบบ 3 dropdown (วัน / เดือน / ปี พ.ศ.) ใช้แทน <input type="date">
// เหตุผล: ตัวควบคุมวันที่ของ iOS Safari ถ้าเครื่องตั้งปฏิทินเป็นพุทธศักราช จะโชว์เป็น "16 Sep BE 2569"
// ผู้ใช้สับสนว่าต้องกรอกปีอะไร และยังมีบั๊กความกว้างขั้นต่ำที่ล้นกรอบด้วย แก้จากฝั่งเว็บด้วย CSS ไม่ได้เลย
// (วิธีเดียวกับช่องวันเกิดในฟอร์มลงทะเบียน - ดู setupDobSelects ใน form.js ที่เขียนไว้ก่อนหน้า)
//
// วิธีใช้: วาง <div id="xxx-selects"></div> กับ <input type="hidden" id="xxx"> ไว้ใน HTML แล้วเรียก
//   const ctl = setupDateSelects({ containerId: 'xxx-selects', hiddenId: 'xxx' });
// ค่าที่ได้เก็บใน hidden เป็น ISO (YYYY-MM-DD) เหมือน input[type=date] เดิม โค้ดส่วนอื่นอ่านค่าได้โดยไม่ต้องแก้
// ==========================================

const DATE_SELECT_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function setupDateSelects({ containerId, hiddenId, yearsBack = 1, yearsAhead = 1 }) {
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(hiddenId);
    if (!container || !hidden) return null;

    container.classList.add('date-select-row');
    container.innerHTML = `
        <select class="form-input date-select" data-part="day"><option value="">วัน</option></select>
        <select class="form-input date-select" data-part="month"><option value="">เดือน</option></select>
        <select class="form-input date-select" data-part="year"><option value="">ปี</option></select>
    `;

    const daySelect = container.querySelector('[data-part="day"]');
    const monthSelect = container.querySelector('[data-part="month"]');
    const yearSelect = container.querySelector('[data-part="year"]');

    DATE_SELECT_MONTHS.forEach((label, index) => {
        const opt = document.createElement('option');
        opt.value = index + 1;
        opt.textContent = label;
        monthSelect.appendChild(opt);
    });

    const currentYear = new Date().getFullYear();
    for (let y = currentYear - yearsBack; y <= currentYear + yearsAhead; y++) {
        const opt = document.createElement('option');
        opt.value = y; // เก็บเป็น ค.ศ. ไว้ประกอบวันที่จริง ส่วนที่โชว์ผู้ใช้เป็น พ.ศ.
        opt.textContent = y + 543;
        yearSelect.appendChild(opt);
    }

    function rebuildDayOptions() {
        const prevValue = daySelect.value;
        const month = parseInt(monthSelect.value, 10) || 0;
        const year = parseInt(yearSelect.value, 10) || 2000;
        const maxDay = month ? new Date(year, month, 0).getDate() : 31;

        daySelect.innerHTML = '<option value="">วัน</option>';
        for (let d = 1; d <= maxDay; d++) {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            daySelect.appendChild(opt);
        }
        if (prevValue && parseInt(prevValue, 10) <= maxDay) daySelect.value = prevValue;
    }

    function syncHidden() {
        const pad = (n) => String(n).padStart(2, '0');
        const [d, m, y] = [daySelect.value, monthSelect.value, yearSelect.value];
        hidden.value = (d && m && y) ? `${y}-${pad(m)}-${pad(d)}` : '';
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }

    [monthSelect, yearSelect].forEach((el) => el.addEventListener('change', () => {
        rebuildDayOptions();
        syncHidden();
    }));
    daySelect.addEventListener('change', syncHidden);

    rebuildDayOptions();

    return {
        getValue: () => hidden.value,
        setValue(isoDate) {
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '');
            if (!match) return this.clear();
            yearSelect.value = String(Number(match[1]));
            monthSelect.value = String(Number(match[2]));
            rebuildDayOptions();
            daySelect.value = String(Number(match[3]));
            syncHidden();
        },
        clear() {
            yearSelect.value = '';
            monthSelect.value = '';
            rebuildDayOptions();
            daySelect.value = '';
            syncHidden();
        },
    };
}
