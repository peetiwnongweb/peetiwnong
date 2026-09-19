// จำแท็บที่เปิดอยู่ไว้ใน sessionStorage กันรีเฟรชแล้วเด้งกลับไปหน้าแรกทุกครั้ง (อยู่รอดแค่ตอน tab เบราว์เซอร์ยังเปิดอยู่ ไม่ใช่ถาวรข้ามเซสชัน)
const TAB_STORAGE_KEY = 'ptn-active-tab';

function switchTab(tabId) {
    try { sessionStorage.setItem(TAB_STORAGE_KEY, tabId); } catch (error) { /* private mode ปิด storage ไว้ก็ไม่เป็นไร แค่ไม่จำ */ }

    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));

    const targetContent = document.getElementById(`page-${tabId}`);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.classList.remove('active-nav-btn');
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add('active-nav-btn');
    }

    const mNavButtons = document.querySelectorAll('.mobile-nav-btn');
    mNavButtons.forEach(btn => {
        btn.classList.remove('active-nav-btn');
    });
    const mActiveBtn = document.getElementById(`m-nav-${tabId}`);
    if (mActiveBtn) {
        mActiveBtn.classList.add('active-nav-btn');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        toggleMobileMenu();
    }
}

// รีเฟรชหน้าแล้วกลับไปแท็บเดิมที่เปิดค้างไว้ (ไม่ใช่เด้งกลับไปหน้าแรกเสมอ) - logout() ใน auth.js ล้างค่านี้ทิ้งด้วยเวลาออกจากระบบ
// หน้าที่ใส่ data-tab-restore="false" ไว้ที่ <body> (เช่น หน้าแรกสาธารณะ) จะไม่จำแท็บข้ามการรีเฟรช รีเฟรชแล้วกลับไปแท็บแรกสุดของหน้าเสมอ
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.tabRestore === 'false') return;

    let savedTab = null;
    try { savedTab = sessionStorage.getItem(TAB_STORAGE_KEY); } catch (error) { /* private mode */ }
    if (savedTab && document.getElementById(`page-${savedTab}`)) {
        switchTab(savedTab);
    }
});

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const burgerToggle = document.getElementById('burger-toggle');

    if (menu) {
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden', 'closing');
        } else {
            menu.classList.add('closing');
            menu.addEventListener('animationend', () => {
                menu.classList.add('hidden');
                menu.classList.remove('closing');
            }, { once: true });
        }
    }
    if (burgerToggle) {
        burgerToggle.checked = !burgerToggle.checked;
    }
}




// initNews มีนิยามอยู่แค่ในหน้าแรกสาธารณะ (news.js) แต่ nav.js นี้ใช้ร่วมกันทุกหน้า (พี่ค่าย/น้องค่าย/แอดมิน) จึงต้องเช็คก่อนเรียกกันหน้าที่ไม่มีสคริปต์นั้นโหลดอยู่ error
window.onload = function () {
    if (typeof initNews === 'function') initNews();
};

// ==========================================
// SCROLL TO TOP FUNCTIONALITY
// ==========================================
window.addEventListener('scroll', function() {
    const scrollBtn = document.getElementById('scroll-to-top-btn');
    if (scrollBtn) {
        if (window.scrollY > 100 || document.documentElement.scrollTop > 100) {
            scrollBtn.classList.add('show');
        } else {
            scrollBtn.classList.remove('show');
        }
    }
});

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}
