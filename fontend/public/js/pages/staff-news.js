// ==========================================
// เขียนข่าว / เช็คข่าว: พี่ค่ายทุกคนไม่ว่าฝ่ายไหนเขียนข่าวส่งเข้ามาได้ ต้องรอ Owner อนุมัติก่อนเผยแพร่จริง
// ==========================================

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

const NEWS_TAG_LABELS = {
    ANNOUNCE: 'ประกาศค่าย',
    ACTIVITY: 'ประชาสัมพันธ์การรับสมัคร',
    SCHOLAR: 'กิจกรรม',
    OTHER: 'อื่น ๆ',
};

const NEWS_APPROVAL_LABELS = {
    PENDING: { text: 'กำลังพิจารณา', className: 'status-pending' },
    APPROVED: { text: 'อนุมัติ', className: 'status-approved' },
    REJECTED: { text: 'ถูกปฏิเสธ', className: 'status-rejected' },
};

// ป้ายสถานะของ 1 ข่าว (ใช้ร่วมทั้งการ์ดในลิสต์และโมดัลดูรายละเอียด กันโค้ดสองชุดเพี้ยนไม่ตรงกัน)
// isVisible เป็นค่าที่ backend ตั้ง true ไว้ตั้งแต่ตอนส่งข่าวเสมอ (ดูคอมเมนต์ submitNews ฝั่ง backend) ไม่ได้แปลว่ากำลังเผยแพร่จริง ๆ -
// หน้าเว็บสาธารณะต้อง approvalStatus === 'APPROVED' ด้วยเท่านั้นถึงจะเห็น ไม่งั้นข่าวที่ "กำลังพิจารณา" จะโชว์ป้าย "เผยแพร่" ทั้งที่ยังไม่ได้เผยแพร่จริง (สับสน)
// จึงซ่อนป้ายนี้ไว้จนกว่าจะอนุมัติแล้ว ค่อยโชว์ตามค่า isVisible จริง (ซึ่งตอนนั้นสะท้อนความจริงแล้วว่า Admin เลือกให้เผยแพร่หรือซ่อนไว้)
function renderNewsStatusBadgesHtml(item) {
    const approval = NEWS_APPROVAL_LABELS[item.approvalStatus] || NEWS_APPROVAL_LABELS.PENDING;
    const visibilityBadge = item.approvalStatus === 'APPROVED'
        ? `<span class="news-status-badge ${item.isVisible ? 'status-visible' : 'status-hidden'}">${item.isVisible ? 'เผยแพร่' : 'ไม่เผยแพร่'}</span>`
        : '';
    return `<span class="news-status-badge ${approval.className}">${approval.text}</span>${visibilityBadge}`;
}

let myNewsItems = [];
let editingNewsId = null; // null = กำลังเขียนข่าวใหม่, ไม่ null = กำลังแก้ไขข่าวเดิม (เฉพาะที่ยังไม่อนุมัติ)
let newsWriteImageUrl = null;

// แบ่งหน้ารายการ "ตรวจสอบสถานะ" - รูปแบบเดียวกับ .pagination-bar ของลิสต์ข่าวสาธารณะหน้าแรก (ดู public/js/pages/news.js)
const NEWS_CHECK_PAGE_SIZE = 5;
let newsCheckCurrentPage = 1;

let newsToastTimer = null;
function showNewsToast(message, isSuccess) {
    const toast = document.getElementById('news-toast');
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

    clearTimeout(newsToastTimer);
    newsToastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function formatNewsDate(isoDate) {
    return new Date(isoDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ==========================================
// แท็บ: เขียนข่าว
// ==========================================
function handleNewsWriteImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const label = document.getElementById('news-write-image-upload-label');
    const originalLabel = label.innerHTML;
    label.innerHTML = `${Loader.spinnerHTML('sm')}กำลังอัปโหลด...`;

    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/news/upload', { method: 'POST', body: formData })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(({ url }) => {
            newsWriteImageUrl = url;
            const preview = document.getElementById('news-write-image-preview');
            preview.src = window.PTN_MEDIA_URL(url);
            document.getElementById('news-write-image-preview-wrap').classList.remove('hidden');
        })
        .catch((error) => {
            showNewsToast(error.message || 'อัปโหลดรูปไม่สำเร็จ', false);
        })
        .finally(() => {
            label.innerHTML = originalLabel;
            event.target.value = '';
        });
}

function removeNewsWriteImage() {
    newsWriteImageUrl = null;
    document.getElementById('news-write-image-preview-wrap').classList.add('hidden');
    document.getElementById('news-write-image-preview').src = '';
}

// ใส่ url ให้ execCommand('createLink') เอง เพราะปุ่มอื่น ๆ (bold/italic/insertUnorderedList) ไม่ต้องการ argument (ส่ง null พอ) มีแค่คำสั่งนี้ที่ต้องถามผู้ใช้ก่อน
// ไม่ได้เลือกข้อความไว้ (selection ว่าง) ก็แทรกตัว url เองเป็นเนื้อลิงก์ให้เลย กันกดแล้วไม่เกิดอะไรขึ้นเพราะไม่รู้ว่าต้องลากเลือกก่อน
async function insertNewsWriteRichTextLink(editorEl) {
    editorEl.focus();
    // เก็บตำแหน่งที่เลือกไว้ไว้ก่อนเปิด modal เพราะโฟกัสจะย้ายไปช่องกรอกลิงก์ ทำให้ selection เดิมในกล่องข้อความหายไป ต้องกู้คืนก่อนสั่ง execCommand
    const selection = window.getSelection();
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    const hasSelection = !!selection?.toString();

    const rawUrl = await showLinkPrompt();
    if (!rawUrl) return;
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

    editorEl.focus();
    if (savedRange) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
    }

    if (hasSelection) {
        document.execCommand('createLink', false, url);
    } else {
        document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
    }
    editorEl.querySelectorAll('a:not([target])').forEach((a) => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
    });
}

// กล่องถามลิงก์แบบมีสไตล์ตรงกับเว็บ แทน prompt() เบราว์เซอร์เดิม
let linkPromptResolver = null;
function showLinkPrompt() {
    const modal = document.getElementById('link-prompt-modal');
    const input = document.getElementById('link-prompt-input');
    if (!modal || !input) return Promise.resolve(null);
    input.value = '';
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);
    return new Promise((resolve) => { linkPromptResolver = resolve; });
}

function linkPromptResolve(value) {
    document.getElementById('link-prompt-modal')?.classList.add('hidden');
    if (linkPromptResolver) {
        linkPromptResolver(value && value.trim() ? value.trim() : null);
        linkPromptResolver = null;
    }
}

// วางลิงก์ (คัดลอกมาทั้งดุ้น ไม่ได้เลือกคำอื่นมาแปะด้วย) ให้กลายเป็นลิงก์คลิกได้ทันทีโดยไม่ต้องกดปุ่ม "แทรกลิงก์" เอง
// เช็คเฉพาะกรณีที่วางแล้วทั้งข้อความเป็น URL ล้วน ๆ เท่านั้น ถ้าวางเป็นย่อหน้ายาวที่มีลิงก์ปนอยู่ ปล่อยเป็นข้อความธรรมดาไปตามปกติ ไม่พยายามเดา
function handleNewsWriteRichTextPaste(event) {
    const text = (event.clipboardData || window.clipboardData)?.getData('text/plain')?.trim();
    if (!text || !/^https?:\/\/\S+$/i.test(text)) return;
    event.preventDefault();
    document.execCommand('insertHTML', false, `<a href="${escapeHtml(text)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`);
}

// ผูกปุ่ม B/I/หัวข้อย่อย/ลิงก์ ของ rich text editor เข้ากับช่อง news-write-detail (ก๊อปพฤติกรรมจาก initRichTextToolbar() ใน webmanager.js เป๊ะ)
function initNewsWriteRichTextToolbar() {
    document.querySelectorAll('.admin-richtext-btn').forEach((btn) => {
        btn.addEventListener('mousedown', (event) => event.preventDefault());
        btn.addEventListener('click', async () => {
            if (btn.dataset.richtextCmd === 'createLink') {
                await insertNewsWriteRichTextLink(document.getElementById('news-write-detail'));
            } else {
                document.execCommand(btn.dataset.richtextCmd, false, null);
            }
            updateNewsWriteRichTextToolbarState();
        });
    });
    document.addEventListener('selectionchange', updateNewsWriteRichTextToolbarState);

    // สั่งแทรก <br> เองตอนกด Enter แทนที่จะปล่อยให้เบราว์เซอร์ห่อ <div> ใหม่ทุกครั้ง (execCommand('defaultParagraphSeparator','br') ไม่เสถียรพอในทุกเบราว์เซอร์)
    const detailEl = document.getElementById('news-write-detail');
    if (detailEl) {
        detailEl.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            document.execCommand('insertLineBreak');
        });
        detailEl.addEventListener('paste', handleNewsWriteRichTextPaste);
    }

    document.getElementById('link-prompt-input')?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        linkPromptResolve(document.getElementById('link-prompt-input').value);
    });
}

function updateNewsWriteRichTextToolbarState() {
    if (document.activeElement?.id !== 'news-write-detail') return;
    document.querySelectorAll('.admin-richtext-btn').forEach((btn) => {
        try {
            btn.classList.toggle('active', document.queryCommandState(btn.dataset.richtextCmd));
        } catch (error) {
            // บางคำสั่ง (เช่นตอนยังไม่ได้ focus) เรียก queryCommandState ไม่ได้ ข้ามไปเฉย ๆ
        }
    });
}

function resetNewsWriteForm() {
    editingNewsId = null;
    newsWriteImageUrl = null;
    document.getElementById('news-write-form').reset();
    // form.reset() ข้างบนไม่แตะช่อง rich text (ไม่ใช่ form control ปกติ) ต้องเคลียร์เอง
    document.getElementById('news-write-detail').innerHTML = '';
    document.getElementById('news-write-form-error').classList.add('hidden');
    document.getElementById('news-write-image-preview-wrap').classList.add('hidden');
    document.getElementById('news-write-image-preview').src = '';
    document.getElementById('news-write-mode-label').classList.remove('show');
    document.getElementById('news-write-cancel-edit-btn').classList.add('hidden');
    document.getElementById('news-write-submit-btn').textContent = 'ส่งประชาสัมพันธ์';
}

// เปิดฟอร์ม "เขียนข่าว" พร้อมพรีฟิลค่าจากข่าวเดิม เพื่อแก้ไข (เรียกจากปุ่ม "แก้ไข" ในแท็บเช็คข่าว)
function startEditNews(item) {
    editingNewsId = item.id;
    newsWriteImageUrl = item.imageUrl || null;

    document.getElementById('news-write-tag').value = item.tag;
    document.getElementById('news-write-title').value = item.title;
    document.getElementById('news-write-summary').value = item.summary;
    document.getElementById('news-write-detail').innerHTML = item.detail;

    const previewWrap = document.getElementById('news-write-image-preview-wrap');
    if (item.imageUrl) {
        document.getElementById('news-write-image-preview').src = window.PTN_MEDIA_URL(item.imageUrl);
        previewWrap.classList.remove('hidden');
    } else {
        previewWrap.classList.add('hidden');
    }

    document.getElementById('news-write-form-error').classList.add('hidden');
    document.getElementById('news-write-mode-label').textContent = `กำลังแก้ไขประชาสัมพันธ์ "${item.title}" — บันทึกแล้วจะส่งกลับเข้าคิวรออนุมัติใหม่`;
    document.getElementById('news-write-mode-label').classList.add('show');
    document.getElementById('news-write-cancel-edit-btn').classList.remove('hidden');
    document.getElementById('news-write-submit-btn').textContent = 'บันทึกการแก้ไข';

    switchTab('write');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function submitNewsWriteForm(event) {
    event.preventDefault();

    const payload = {
        tag: document.getElementById('news-write-tag').value,
        title: document.getElementById('news-write-title').value.trim(),
        summary: document.getElementById('news-write-summary').value.trim(),
        detail: document.getElementById('news-write-detail').innerHTML.trim(),
        imageUrl: newsWriteImageUrl,
    };

    const errorBox = document.getElementById('news-write-form-error');
    errorBox.classList.add('hidden');

    const submitBtn = document.getElementById('news-write-submit-btn');
    Loader.setButtonLoading(submitBtn, 'กำลังบันทึก...');

    const url = editingNewsId ? `/api/news/mine/${editingNewsId}` : '/api/news/submit';
    const method = editingNewsId ? 'PUT' : 'POST';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then(() => {
            const wasEditing = !!editingNewsId;
            resetNewsWriteForm();
            showNewsToast(wasEditing ? 'บันทึกการแก้ไขสำเร็จ ส่งกลับเข้าคิวรออนุมัติแล้ว' : 'ส่งประชาสัมพันธ์สำเร็จ กำลังรอการอนุมัติ', true);
            loadMyNews();
            switchTab('check');
        })
        .catch((error) => {
            errorBox.textContent = error.message;
            errorBox.classList.remove('hidden');
        })
        .finally(() => {
            Loader.clearButtonLoading(submitBtn);
        });
}

// ==========================================
// แท็บ: เช็คข่าว
// ==========================================
function loadMyNews() {
    Loader.renderSkeletonCards(document.getElementById('news-check-list'), 3);
    return fetch('/api/news/mine')
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((items) => {
            myNewsItems = items;
            renderNewsCheckList();
        })
        .catch((error) => {
            console.error('โหลดรายการข่าวของฉันไม่สำเร็จ:', error);
            showNewsToast('โหลดรายการประชาสัมพันธ์ไม่สำเร็จ', false);
        });
}

function renderNewsCheckList() {
    const list = document.getElementById('news-check-list');
    const empty = document.getElementById('news-check-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    empty.classList.toggle('hidden', myNewsItems.length !== 0);

    const totalPages = Math.max(1, Math.ceil(myNewsItems.length / NEWS_CHECK_PAGE_SIZE));
    newsCheckCurrentPage = Math.min(Math.max(1, newsCheckCurrentPage), totalPages);
    const start = (newsCheckCurrentPage - 1) * NEWS_CHECK_PAGE_SIZE;
    const pageItems = myNewsItems.slice(start, start + NEWS_CHECK_PAGE_SIZE);

    pageItems.forEach((item) => {
        const canEdit = item.approvalStatus !== 'APPROVED';

        const card = document.createElement('div');
        card.className = 'news-item-card';
        card.innerHTML = `
            <div class="news-item-top">
                <div>
                    <p class="news-item-title">${item.title}</p>
                    <p class="news-item-meta">${NEWS_TAG_LABELS[item.tag] || item.tag} · ส่งเมื่อ ${formatNewsDate(item.createdAt)}</p>
                </div>
                <div class="news-item-badges">
                    ${renderNewsStatusBadgesHtml(item)}
                </div>
            </div>
            <div class="news-item-actions">
                <button type="button" class="btn-outline news-detail-btn">ดูรายละเอียด</button>
                <div class="news-item-actions-right">
                    ${canEdit ? '<button type="button" class="btn-outline news-edit-btn">แก้ไข</button>' : ''}
                    <button type="button" class="btn-outline news-delete-btn">ลบ</button>
                </div>
            </div>
        `;
        card.querySelector('.news-detail-btn').addEventListener('click', () => viewNewsDetail(item.id));
        card.querySelector('.news-edit-btn')?.addEventListener('click', () => startEditNews(item));
        card.querySelector('.news-delete-btn').addEventListener('click', () => handleDeleteMyNews(item));
        list.appendChild(card);
    });

    renderNewsCheckPagination(totalPages);
}

// วาดปุ่มเลขหน้า - ซ่อนทั้งแถบถ้ามีแค่หน้าเดียว (รายการ <= NEWS_CHECK_PAGE_SIZE) ไม่ต้องมีให้กดเปล่า ๆ
function renderNewsCheckPagination(totalPages) {
    const bar = document.getElementById('news-check-pagination-bar');
    const prevButton = document.getElementById('news-check-pagination-prev');
    const nextButton = document.getElementById('news-check-pagination-next');
    const pagesContainer = document.getElementById('news-check-pagination-pages');
    if (!bar || !prevButton || !nextButton || !pagesContainer) return;

    bar.classList.toggle('hidden', totalPages <= 1);
    prevButton.disabled = newsCheckCurrentPage === 1;
    nextButton.disabled = newsCheckCurrentPage === totalPages;

    pagesContainer.innerHTML = '';
    for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pagination-page';
        button.textContent = String(page);
        button.classList.toggle('active', page === newsCheckCurrentPage);
        button.setAttribute('aria-current', page === newsCheckCurrentPage ? 'page' : 'false');
        button.addEventListener('click', () => goToNewsCheckPage(page));
        pagesContainer.appendChild(button);
    }
}

function goToNewsCheckPage(page) {
    newsCheckCurrentPage = page;
    renderNewsCheckList();
    document.getElementById('news-check-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ลบข่าวของตัวเองได้ทุกสถานะ (ต่างจากแก้ไขที่ล็อกไว้หลังอนุมัติแล้ว - ดูคอมเมนต์ deleteMyNews ฝั่ง backend) เตือนเป็นพิเศษถ้าข่าวเผยแพร่อยู่แล้ว เพราะลบแล้วหายจากหน้าเว็บทันที
async function handleDeleteMyNews(item) {
    const isLive = item.approvalStatus === 'APPROVED' && item.isVisible;
    const confirmed = await showConfirm(
        `ลบประชาสัมพันธ์ "${item.title}" ใช่หรือไม่?${isLive ? ' ข่าวนี้เผยแพร่อยู่บนหน้าเว็บแล้ว ลบตอนนี้จะหายจากหน้าเว็บทันที' : ''}`,
        { title: 'ยืนยันการลบ', confirmText: 'ลบ' },
    );
    if (!confirmed) return;

    fetch(`/api/news/mine/${item.id}`, { method: 'DELETE' })
        .then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            showNewsToast('ลบประชาสัมพันธ์สำเร็จ', true);
            loadMyNews();
        })
        .catch((error) => {
            console.error('ลบประชาสัมพันธ์ไม่สำเร็จ:', error);
            showNewsToast(error.message || 'ลบประชาสัมพันธ์ไม่สำเร็จ', false);
        });
}

function viewNewsDetail(newsId) {
    const item = myNewsItems.find((n) => n.id === newsId);
    if (!item) return;

    const modalContent = document.getElementById('news-detail-modal-content');
    if (!modalContent) return;

    modalContent.innerHTML = `
        <div class="space-y-4">
            <div class="news-item-badges">
                ${renderNewsStatusBadgesHtml(item)}
            </div>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">${item.title}</h2>
            <p class="news-item-meta">${NEWS_TAG_LABELS[item.tag] || item.tag} · ส่งเมื่อ ${formatNewsDate(item.createdAt)}</p>
            ${item.imageUrl ? `
            <div style="position: relative;">
                <img src="${window.PTN_MEDIA_URL(item.imageUrl)}" alt="ภาพประกอบประชาสัมพันธ์" class="news-detail-image" style="cursor: zoom-in;" onclick="openImageLightbox('${item.imageUrl}')">
                <button type="button" class="news-detail-zoom-btn" onclick="openImageLightbox('${item.imageUrl}')" aria-label="ดูรูปเต็ม">
                    <svg class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                    </svg>
                </button>
            </div>` : ''}
            <hr class="border-slate-100">
            <p class="news-detail-body">${item.detail}</p>
        </div>
    `;

    document.getElementById('news-detail-modal').classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeNewsDetailModal() {
    document.getElementById('news-detail-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
}

// ดูรูปประกอบข่าวแบบเต็มจอ ไม่ถูกครอบตัด (รูปในกรอบตัวอย่างแสดงแบบ object-cover ครอบตัดไว้)
function openImageLightbox(url) {
    document.getElementById('image-lightbox-img').src = window.PTN_MEDIA_URL(url);
    document.getElementById('image-lightbox-modal').classList.remove('hidden');
}

function closeImageLightbox() {
    document.getElementById('image-lightbox-modal').classList.add('hidden');
    document.getElementById('image-lightbox-img').src = '';
}

document.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    const writeForm = document.getElementById('news-write-form');
    if (writeForm) writeForm.addEventListener('submit', submitNewsWriteForm);
    initNewsWriteRichTextToolbar();

    document.getElementById('news-check-pagination-prev')?.addEventListener('click', () => goToNewsCheckPage(newsCheckCurrentPage - 1));
    document.getElementById('news-check-pagination-next')?.addEventListener('click', () => goToNewsCheckPage(newsCheckCurrentPage + 1));

    loadMyNews().finally(() => Loader.hideFullPageLoader());
});
