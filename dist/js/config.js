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

window.fetch = async function () {
    let [resource, config] = arguments;

    if (typeof resource === 'string' && resource.startsWith('/api/')) {
        // Change /api/... to https://api.peetiwnong.site/api/...
        resource = API_BASE_URL + resource;
        
        // Ensure cookies are sent with cross-origin requests
        if (!config) {
            config = {};
        }
        config.credentials = 'include';
    }

    return originalFetch(resource, config);
};
