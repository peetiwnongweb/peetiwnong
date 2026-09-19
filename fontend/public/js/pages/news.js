const TAG_INFO = {
    ANNOUNCE: { thai: 'ประกาศค่าย', class: 'tag-brand' },
    ACTIVITY: { thai: 'ประชาสัมพันธ์การรับสมัคร', class: 'tag-emerald' },
    SCHOLAR: { thai: 'กิจกรรม', class: 'tag-amber' },
    OTHER: { thai: 'อื่น ๆ', class: 'tag-blue' },
};

const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

let NEWS_ITEMS = [];
let currentFilter = 'all';

const NEWS_PAGE_SIZE = 6;
let newsCurrentPage = 1;

function formatThaiDate(isoDate) {
    const date = new Date(isoDate);
    return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function initNews() {
    const prevButton = document.getElementById('news-pagination-prev');
    const nextButton = document.getElementById('news-pagination-next');
    if (prevButton) prevButton.addEventListener('click', () => goToNewsPage(newsCurrentPage - 1));
    if (nextButton) nextButton.addEventListener('click', () => goToNewsPage(newsCurrentPage + 1));

    Loader.renderSkeletonCards(document.getElementById('news-summary-grid'), 3);
    Loader.renderSkeletonCards(document.getElementById('news-grid-container'), 6);

    fetch('/api/news?visibleOnly=true')
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((items) => {
            NEWS_ITEMS = items;
            renderNewsSummary();
            renderNews('all');
        })
        .catch((error) => {
            console.error('โหลดข่าวสารไม่สำเร็จ:', error);
        });
}

function renderNewsSummary(limit = 3) {
    const container = document.getElementById('news-summary-grid');
    if (!container) return;

    container.innerHTML = '';

    NEWS_ITEMS.slice(0, limit).forEach(news => {
        const tagInfo = TAG_INFO[news.tag] || TAG_INFO.OTHER;

        const card = document.createElement('div');
        card.className = 'news-card flex flex-col';

        let hotBadge = news.isHot ? '<span class="news-hot-badge">Hot</span>' : '';

        card.innerHTML = `
            <div class="news-img-wrap">
                ${hotBadge}
                <img src="${news.imageUrl || '../../backend/uploads/news/news.jpg'}" alt="ภาพประกอบประชาสัมพันธ์" class="news-thumbnail">
            </div>
            <div class="news-content grow flex flex-col justify-between">
                <div class="news-info">
                    <span class="news-tag ${tagInfo.class}">${tagInfo.thai}</span>
                    <h3 class="news-title">${news.title}</h3>
                    <p class="news-desc">${news.summary}</p>
                </div>
                <div class="news-footer flex items-center justify-between">
                    <span>${formatThaiDate(news.publishedAt)}</span>
                    <span class="news-readmore" onclick="switchTab('news')" style="cursor: pointer;">อ่านต่อ...</span>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function renderNews(filter = 'all', keyword = '') {
    const container = document.getElementById('news-grid-container');
    const noNews = document.getElementById('no-news-found');
    if (!container || !noNews) return;

    container.innerHTML = '';

    const filteredNews = NEWS_ITEMS.filter(news => {
        const matchesFilter = filter === 'all' || news.tag.toLowerCase() === filter.toLowerCase();
        const matchesSearch = news.title.toLowerCase().includes(keyword.toLowerCase()) ||
            news.summary.toLowerCase().includes(keyword.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const totalPages = Math.max(1, Math.ceil(filteredNews.length / NEWS_PAGE_SIZE));
    newsCurrentPage = Math.min(Math.max(1, newsCurrentPage), totalPages);
    const start = (newsCurrentPage - 1) * NEWS_PAGE_SIZE;
    const pageNews = filteredNews.slice(start, start + NEWS_PAGE_SIZE);

    if (filteredNews.length === 0) {
        noNews.classList.remove('hidden');
    } else {
        noNews.classList.add('hidden');

        pageNews.forEach(news => {
            const tagInfo = TAG_INFO[news.tag] || TAG_INFO.OTHER;

            const card = document.createElement('div');
            card.className = 'news-card flex flex-col';

            let hotBadge = news.isHot ? '<span class="news-hot-badge">Hot</span>' : '';

            card.innerHTML = `
                <div class="news-img-wrap">
                    ${hotBadge}
                    <img src="${news.imageUrl || '../../backend/uploads/news/news.jpg'}" alt="ภาพประกอบประชาสัมพันธ์" class="news-thumbnail">
                </div>
                <div class="news-content grow flex flex-col justify-between">
                    <div class="news-info">
                        <span class="news-tag ${tagInfo.class}">${tagInfo.thai}</span>
                        <h3 class="news-title">${news.title}</h3>
                        <p class="news-desc">${news.summary}</p>
                    </div>
                    <div class="news-footer flex items-center justify-between">
                        <span>${formatThaiDate(news.publishedAt)}</span>
                        <span class="news-readmore" role="button" tabindex="0">รายละเอียด</span>
                    </div>
                </div>
            `;
            const detailButton = card.querySelector('.news-readmore');
            if (detailButton) {
                detailButton.addEventListener('click', () => {
                    viewNewsDetail(news.id);
                });
            }
            container.appendChild(card);
        });
    }

    renderNewsPagination(totalPages);
}

function renderNewsPagination(totalPages) {
    const bar = document.getElementById('news-pagination-bar');
    const prevButton = document.getElementById('news-pagination-prev');
    const nextButton = document.getElementById('news-pagination-next');
    const pagesContainer = document.getElementById('news-pagination-pages');
    if (!bar || !prevButton || !nextButton || !pagesContainer) return;

    bar.classList.toggle('hidden', totalPages <= 1);
    prevButton.disabled = newsCurrentPage === 1;
    nextButton.disabled = newsCurrentPage === totalPages;

    pagesContainer.innerHTML = '';
    for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pagination-page';
        button.textContent = String(page);
        button.classList.toggle('active', page === newsCurrentPage);
        button.setAttribute('aria-current', page === newsCurrentPage ? 'page' : 'false');
        button.addEventListener('click', () => goToNewsPage(page));
        pagesContainer.appendChild(button);
    }
}

function goToNewsPage(page) {
    newsCurrentPage = page;
    renderNews(currentFilter, document.getElementById('news-search').value);
    document.getElementById('news-grid-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterNews(tag) {
    currentFilter = tag;
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`filter-btn-${tag}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    const searchInput = document.getElementById('news-search');
    newsCurrentPage = 1;
    renderNews(tag, searchInput.value);
}

function searchNews() {
    const searchInput = document.getElementById('news-search');
    newsCurrentPage = 1;
    renderNews(currentFilter, searchInput.value);
}

function openNewsModal() {
    const modal = document.getElementById('news-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeNewsModal() {
    const modal = document.getElementById('news-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function viewNewsDetail(newsId) {
    const news = NEWS_ITEMS.find(item => item.id === newsId);
    if (!news) return;

    const tagInfo = TAG_INFO[news.tag] || TAG_INFO.OTHER;
    const modal = document.getElementById('news-modal');
    const modalContent = document.getElementById('news-modal-content');
    if (!modalContent || !modal) return;

    modalContent.innerHTML = `
        <div class="space-y-4">
            <span class="text-xs font-bold px-2.5 py-1 rounded bg-brand-50 text-brand-600 inline-block">${tagInfo.thai}</span>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">${news.title}</h2>
            <div class="flex items-center gap-2 text-xs text-slate-400">
                <span>เผยแพร่เมื่อ: ${formatThaiDate(news.publishedAt)}</span>
                <span>•</span>
                <span>โดย: คณะกรรมการค่าย</span>
            </div>
            <img src="${news.imageUrl || '../../backend/uploads/news/news.jpg'}" alt="ภาพประกอบประชาสัมพันธ์" class="w-full h-48 sm:h-64 object-cover rounded-xl">
            <hr class="border-slate-100">
            <div class="text-slate-600 text-sm sm:text-base leading-relaxed font-light py-2">
                ${news.detail}
            </div>
            <div class="pt-4 border-t border-slate-100 flex justify-end">
                <button id="close-news-modal-button" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                    ปิดหน้าต่างนี้
                </button>
            </div>
        </div>
    `;

    const closeButton = document.getElementById('close-news-modal-button');
    if (closeButton) {
        closeButton.addEventListener('click', closeNewsModal);
    }

    openNewsModal();
}
