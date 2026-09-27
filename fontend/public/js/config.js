// Global API Configuration
// This file intercepts all fetch() calls in the frontend to route /api/... to the correct Backend domain.

const API_BASE_URL = 'https://api.peetiwnong.site'; // Render backend URL (via custom domain)

// API responses store media paths such as /media/presidents/<fileId>; those files live on Render, not Pages.
window.PTN_MEDIA_URL = function (url) {
    if (!url || typeof url !== 'string') return url;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/media/') || url.startsWith('/backend/uploads/')) {
        return API_BASE_URL + url;
    }
    return url;
};

// ลิงก์ <a href> / window.open ที่ชี้ไป /api/... ไม่ผ่าน fetch() ตัวดักด้านล่าง ต้องต่อโดเมน backend เอง
window.PTN_API_URL = function (path) {
    return API_BASE_URL + path;
};

// ใช้แทนรูปที่ไม่มี (รูปประธานค่าย/ข่าวที่ยังไม่ได้อัปโหลด) - ไฟล์นี้อยู่บน Pages เอง ไม่ต้องไปขอจาก backend
window.PTN_PLACEHOLDER_IMAGE = '/assets/images/logo/logo1.png';

const originalFetch = window.fetch;

// ==========================================
// หน้าจอรอ "กำลังดำเนินการ" อัตโนมัติ: ทุกคำขอที่เปลี่ยนข้อมูล (POST/PUT/PATCH/DELETE ไป /api/...) ทุกหน้า
// ให้ผู้ใช้รู้ว่ากดไปแล้วและต้องรอ กันกดซ้ำระหว่างรอ - รอ 300ms ก่อนค่อยแสดง คำขอที่เสร็จเร็วจะได้ไม่กะพริบ
// คำขอที่ไม่อยากให้แสดง (ทำเบื้องหลัง) ส่ง { ptnSilent: true } มาใน config
// ==========================================
let busyCount = 0;
let busyTimer = null;

function ensureBusyOverlay() {
    let el = document.getElementById('ptn-busy-overlay');
    if (el) return el;
    if (!document.getElementById('ptn-busy-style')) {
        const style = document.createElement('style');
        style.id = 'ptn-busy-style';
        style.textContent = `
            #ptn-busy-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.35);cursor:progress}
            #ptn-busy-overlay[hidden]{display:none}
            .ptn-busy-box{display:flex;align-items:center;gap:.75rem;padding:1rem 1.5rem;border-radius:1rem;background:#fff;color:#1e293b;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.2)}
            .ptn-busy-spin{width:1.5rem;height:1.5rem;border:3px solid #fed7aa;border-top-color:#f97316;border-radius:50%;animation:ptn-busy-rot .8s linear infinite}
            @keyframes ptn-busy-rot{to{transform:rotate(360deg)}}
        `;
        document.head.appendChild(style);
    }
    el = document.createElement('div');
    el.id = 'ptn-busy-overlay';
    el.hidden = true;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="ptn-busy-box"><span class="ptn-busy-spin"></span><span>กำลังดำเนินการ กรุณารอสักครู่...</span></div>';
    document.body.appendChild(el);
    return el;
}

function startBusy() {
    busyCount += 1;
    if (busyCount === 1 && !busyTimer) {
        busyTimer = setTimeout(() => {
            busyTimer = null;
            if (busyCount > 0 && document.body) ensureBusyOverlay().hidden = false;
        }, 300);
    }
}

function endBusy() {
    busyCount = Math.max(0, busyCount - 1);
    if (busyCount > 0) return;
    if (busyTimer) { clearTimeout(busyTimer); busyTimer = null; }
    const el = document.getElementById('ptn-busy-overlay');
    if (el) el.hidden = true;
}

window.fetch = async function () {
    let [resource, config] = arguments;
    const method = String((config && config.method) || 'GET').toUpperCase();
    const showBusy = typeof resource === 'string' && resource.startsWith('/api/') && method !== 'GET' && method !== 'HEAD' && !(config && config.ptnSilent);

    if (typeof resource === 'string' && resource.startsWith('/api/')) {
        // Change /api/... to https://api.peetiwnong.site/api/...
        resource = API_BASE_URL + resource;
        
        // Ensure cookies are sent with cross-origin requests
        if (!config) {
            config = {};
        }
        config.credentials = 'include';
    }

    if (!showBusy) return originalFetch(resource, config);
    startBusy();
    try {
        return await originalFetch(resource, config);
    } finally {
        endBusy();
    }
};
