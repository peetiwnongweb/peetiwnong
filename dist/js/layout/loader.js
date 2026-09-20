// ==========================================
// Loader กลาง: ใช้ร่วมทุกหน้า ไม่มี dependency กับ auth.js/nav.js (webmanager/admin ไม่ได้โหลด 2 ไฟล์นั้น)
// สไตล์คู่กับ fontend/public/css/base/loader.css
// ==========================================

function renderSkeletonCards(container, count = 3) {
    if (!container) return;
    let html = '';
    for (let i = 0; i < count; i += 1) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton skeleton-line skeleton-title"></div>
                <div class="skeleton skeleton-line skeleton-w-70"></div>
                <div class="skeleton skeleton-line skeleton-w-40"></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderSkeletonTableRows(tbody, columnCount = 4, count = 4) {
    if (!tbody) return;
    let rowsHtml = '';
    for (let i = 0; i < count; i += 1) {
        let cellsHtml = '';
        for (let c = 0; c < columnCount; c += 1) {
            cellsHtml += `<td><span class="skeleton skeleton-line"></span></td>`;
        }
        rowsHtml += `<tr class="skeleton-table-row">${cellsHtml}</tr>`;
    }
    tbody.innerHTML = rowsHtml;
}

// เก็บ HTML เดิมของปุ่มไว้ใน dataset แล้วสลับเป็น spinner + ข้อความโหลด กัน double-call ด้วย dataset.loading
function setButtonLoading(btn, loadingText) {
    if (!btn || btn.dataset.loading === 'true') return;
    btn.dataset.loading = 'true';
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner spinner-sm"></span>${loadingText}`;
}

function clearButtonLoading(btn) {
    if (!btn || btn.dataset.loading !== 'true') return;
    btn.innerHTML = btn.dataset.originalHtml;
    delete btn.dataset.originalHtml;
    delete btn.dataset.loading;
    btn.disabled = false;
}

function spinnerHTML(size) {
    return `<span class="spinner${size === 'sm' ? ' spinner-sm' : ''}"></span>`;
}

// โหลดเดอร์เต็มหน้าจอ: ใช้ตอนหน้าเว็บกำลังโหลดข้อมูลก้อนแรกตั้งแต่เปิดหน้ามา (ครอบทั้ง DOMContentLoaded ไปจนกว่าจะเรียก fetch ครั้งแรกเสร็จ)
// inject markup เข้า document.body เองตอนเรียกใช้ครั้งแรก ไม่ต้องใส่ไว้ในทุกไฟล์ HTML ล่วงหน้า - ใช้ path แบบ absolute (/assets/...) เพราะไฟล์นี้ถูกโหลดจากหลายความลึกของ URL ไม่เท่ากัน (public/staff/participant/webmanager/admin)
function ensureFullPageLoaderEl() {
    let el = document.getElementById('full-page-loader');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'full-page-loader';
    el.className = 'full-page-loader hidden';
    el.innerHTML = `
        <div class="full-page-loader-visual">
            <div class="full-page-loader-ring"></div>
            <img src="/assets/images/logo/logo1.png" alt="PTN logo" class="full-page-loader-logo">
        </div>
        <div class="full-page-loader-words">
            <span class="full-page-loader-word">ค่ายวิชาการ</span>
            <span class="full-page-loader-word">พี่ติวน้อง</span>
            <span class="full-page-loader-word">PEETIWNONG</span>
            <span class="full-page-loader-word">Academics Camp</span>
            <span class="full-page-loader-word">ค่ายวิชาการ</span>
        </div>
    `;
    document.body.appendChild(el);
    return el;
}

function showFullPageLoader() {
    ensureFullPageLoaderEl().classList.remove('hidden');
}

function hideFullPageLoader() {
    const el = document.getElementById('full-page-loader');
    if (el) el.classList.add('hidden');
}

window.Loader = {
    renderSkeletonCards,
    renderSkeletonTableRows,
    setButtonLoading,
    clearButtonLoading,
    spinnerHTML,
    showFullPageLoader,
    hideFullPageLoader,
};
