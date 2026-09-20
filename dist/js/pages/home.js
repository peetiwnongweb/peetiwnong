document.addEventListener('DOMContentLoaded', function () {
  Loader.showFullPageLoader();

  const cardsPerPage = 6;

  function setupTracksSection(tracksGrid, trackData) {
    const paginationBar = tracksGrid.nextElementSibling;
    if (!paginationBar || !paginationBar.classList.contains('pagination-bar')) {
      return;
    }

    const prevButton = paginationBar.querySelector('.pagination-prev');
    const nextButton = paginationBar.querySelector('.pagination-next');
    const pagesContainer = paginationBar.querySelector('.pagination-pages');

    if (!prevButton || !nextButton || !pagesContainer) {
      return;
    }

    const totalPages = Math.max(1, Math.ceil(trackData.length / cardsPerPage));

    let cards = [];
    let currentPage = 1;

    function renderTrackCards() {
      tracksGrid.innerHTML = '';

      trackData.forEach((track) => {
        const card = document.createElement('div');
        card.className = 'track-card flex flex-col';
        card.innerHTML = `
          <div class="track-profile-wrapper flex justify-center">
            <img src="${window.PTN_MEDIA_URL(track.imageUrl) || window.PTN_MEDIA_URL('/backend/uploads/presidents/profile.jpg')}" alt="image" class="track-profile-img">
          </div>
          <div class="track-card-body flex flex-col items-center justify-center gap-[0.6rem] flex-1">
            <span class="track-role role-president">ประธานค่ายครั้งที่ ${track.generationNos.join(', ')}</span>
            <h2 class="track-title-name">${track.fullName}</h2>
            <h3 class="track-title-nickname">${track.nickname}</h3>
          </div>
        `;
        tracksGrid.appendChild(card);
      });

      cards = Array.from(tracksGrid.querySelectorAll('.track-card'));
    }

    function setPage(page) {
      currentPage = Math.max(1, Math.min(totalPages, page));

      cards.forEach((card, index) => {
        const startIndex = (currentPage - 1) * cardsPerPage;
        const endIndex = startIndex + cardsPerPage;
        card.style.display = index >= startIndex && index < endIndex ? '' : 'none';
      });

      prevButton.disabled = currentPage === 1;
      nextButton.disabled = currentPage === totalPages;

      pagesContainer.querySelectorAll('.pagination-page').forEach((button) => {
        const pageNumber = Number(button.dataset.page);
        button.classList.toggle('active', pageNumber === currentPage);
        button.setAttribute('aria-current', pageNumber === currentPage ? 'page' : 'false');
      });
    }

    function createPaginationButtons() {
      pagesContainer.innerHTML = '';

      for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pagination-page';
        button.dataset.page = String(page);
        button.textContent = String(page);
        button.addEventListener('click', () => setPage(page));
        pagesContainer.appendChild(button);
      }
    }

    prevButton.addEventListener('click', () => setPage(currentPage - 1));
    nextButton.addEventListener('click', () => setPage(currentPage + 1));

    renderTrackCards();
    createPaginationButtons();
    setPage(1);
  }

  // ซ่อน/แสดงการ์ดเด่นประธานค่ายล่าสุด ขึ้นกับ 2 เงื่อนไขที่มาจาก fetch คนละตัวและไม่รู้ลำดับว่าใครเสร็จก่อน:
  // (1) มีข้อมูลทำเนียบประธานจริงไหม (2) แอดมินเปิดให้แสดงไหม (heroCardVisible) - ต้อง "ผ่านทั้งคู่" การ์ดถึงจะโชว์
  let heroHasData = false;
  let heroSettingVisible = true;
  function applyHeroCardVisibility() {
    const heroVisualCard = document.getElementById('hero-visual-card');
    if (heroVisualCard) heroVisualCard.classList.toggle('hidden', !(heroHasData && heroSettingVisible));
  }

  // ส่วนทำเนียบประธานค่ายทั้งหมด (ต่างจากการ์ดเด่นใน Hero) - ใช้ข้อมูลชุดเดียวกับการ์ดเด่น (fetch เดียวกัน) แต่แยกสวิตช์เปิด/ปิดคนละตัว
  let committeeHasData = false;
  let committeeSettingVisible = true;
  function applyCommitteeSectionVisibility() {
    const tracksSection = document.getElementById('tracks-section');
    if (tracksSection) tracksSection.classList.toggle('hidden', !(committeeHasData && committeeSettingVisible));
  }

  // ส่วนข่าวสารล่าสุดในหน้าแรก - เช็คมีข่าวจริงไหมด้วย fetch ของตัวเอง ไม่พึ่ง NEWS_ITEMS ของ news.js เพราะโหลดคนละจังหวะกัน
  let newsHasData = false;
  let newsSettingVisible = true;
  function applyNewsSectionVisibility() {
    const newsSection = document.getElementById('home-news-summary-section');
    if (newsSection) newsSection.classList.toggle('hidden', !(newsHasData && newsSettingVisible));
  }

  function renderHeroCard(trackData) {
    heroHasData = trackData.length > 0;
    applyHeroCardVisibility();
    committeeHasData = trackData.length > 0;
    applyCommitteeSectionVisibility();
    if (!trackData.length) return;
    // รุ่นล่าสุด = คนที่มีครั้งที่สูงสุด (API เรียงตามครั้งที่น้อยที่สุดของแต่ละคน ไม่ใช่ครั้งล่าสุด จึงต้องหาเองตรงนี้)
    const latest = trackData.reduce(
      (max, track) => (Math.max(...track.generationNos) > Math.max(...max.generationNos) ? track : max),
      trackData[0]
    );

    const image = document.getElementById('hero-card-image');
    const badge = document.getElementById('hero-card-badge');
    const nickname = document.getElementById('hero-card-nickname');
    const name = document.getElementById('hero-card-name');
    const uniLogo = document.getElementById('hero-card-uni-logo');
    const university = document.getElementById('hero-card-university');
    const faculty = document.getElementById('hero-card-faculty');
    const major = document.getElementById('hero-card-major');

    if (image) image.src = window.PTN_MEDIA_URL(latest.imageUrl) || window.PTN_MEDIA_URL('/backend/uploads/presidents/profile.jpg');
    if (badge) badge.innerText = `ประธานค่ายครั้งที่ ${Math.max(...latest.generationNos)}`;
    if (nickname) nickname.innerText = latest.nickname || '';
    if (name) name.innerText = latest.fullName || '';
    // ไม่มีโลโก้มหาวิทยาลัย = ซ่อนรูปโลโก้ไปเลย ไม่ต้องใส่โลโก้อื่นมาแทน
    if (uniLogo) {
      const logoWrap = uniLogo.parentElement;
      if (latest.universityLogoUrl) {
        uniLogo.src = window.PTN_MEDIA_URL(latest.universityLogoUrl);
        if (logoWrap) logoWrap.classList.remove('hidden');
      } else if (logoWrap) {
        logoWrap.classList.add('hidden');
      }
    }
    if (university) university.innerText = latest.university || '';
    if (faculty) faculty.innerText = latest.faculty || '';
    if (major) major.innerText = latest.major || '';
  }

  // สวิตช์เปิด/ปิดการ์ดเด่นประธานค่ายล่าสุดใน Hero + ข้อความ "ความเป็นมา" ตั้งค่าได้จากหน้า "ประวัติความเป็นมา" ในแผง WebManager
  // ใช้ window.PTN_SITE_SETTINGS (auth.js ยิงไปแล้วตั้งแต่สคริปต์นั้นโหลด) แทนการ fetch เอง กัน /api/site-settings ยิงซ้ำ 2 รอบบนหน้าแรก
  const siteSettingsLoaded = window.PTN_SITE_SETTINGS
    .then((settings) => {
      heroSettingVisible = settings.heroCardVisible !== false;
      applyHeroCardVisibility();

      committeeSettingVisible = settings.committeeSectionVisible !== false;
      applyCommitteeSectionVisibility();

      newsSettingVisible = settings.newsSectionVisible !== false;
      applyNewsSectionVisibility();

      const historyTitle = document.getElementById('history-intro-title');
      const historyBody = document.getElementById('history-intro-body');
      if (historyTitle && settings.historyTitle) historyTitle.innerText = settings.historyTitle;
      if (historyBody && settings.historyBody) {
        historyBody.innerHTML = '';
        settings.historyBody.split(/\n\s*\n/).forEach((paragraph) => {
          const p = document.createElement('p');
          p.innerText = paragraph.trim();
          historyBody.appendChild(p);
        });
      }
    });

  // ประมวลภาพบรรยากาศค่าย: ซ่อนทั้งการ์ดไว้จนกว่าจะมีรูปจริงที่อัปโหลดจากแผง WebManager
  const galleryLoaded = fetch('/api/gallery')
    .then((response) => (response.ok ? response.json() : []))
    .then((photos) => {
      const galleryCard = document.getElementById('history-gallery-card');
      if (!photos.length) {
        if (galleryCard) galleryCard.classList.add('hidden');
        return;
      }

      if (galleryCard) galleryCard.classList.remove('hidden');
      // จำกัดแค่ 20 รูปล่าสุด (photos เรียงเก่า-ใหม่จาก backend อยู่แล้ว ดู listPhotos ใน galleryController.js) กันโหลดรูปเยอะเกินจำเป็นตอนเข้าหน้าแรก (ลด egress)
      const limitedPhotos = photos.slice(-20);
      document.querySelectorAll('.history-gallery-grid').forEach((galleryGrid) => {
        galleryGrid.innerHTML = '';
        limitedPhotos.forEach((photo) => {
          const img = document.createElement('img');
          img.src = window.PTN_MEDIA_URL(photo.imageUrl);
          img.alt = 'ภาพบรรยากาศค่าย';
          img.loading = 'lazy';
          galleryGrid.appendChild(img);
        });
      });
    })
    .catch((error) => console.error('โหลดรูปประมวลภาพไม่สำเร็จ:', error));

  // เช็คว่ามีข่าวที่แสดงอยู่จริงไหม สำหรับซ่อน/แสดงส่วนข่าวสารล่าสุดที่หน้าแรก (แยก fetch จาก news.js เพราะโหลดคนละจังหวะกัน)
  const newsVisibilityLoaded = fetch('/api/news?visibleOnly=true')
    .then((response) => (response.ok ? response.json() : []))
    .then((items) => {
      newsHasData = items.length > 0;
      applyNewsSectionVisibility();
    })
    .catch((error) => console.error('โหลดข่าวสารไม่สำเร็จ:', error));

  document.querySelectorAll('.tracks-grid').forEach((tracksGrid) => Loader.renderSkeletonCards(tracksGrid, 3));

  const presidentsLoaded = fetch('/api/presidents?visibleOnly=true')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((trackData) => {
      renderHeroCard(trackData);

      document.querySelectorAll('.tracks-grid').forEach((tracksGrid) => {
        setupTracksSection(tracksGrid, trackData);
      });
    })
    .catch((error) => {
      console.error('โหลดข้อมูลทำเนียบประธานค่ายไม่สำเร็จ:', error);
    });

  Promise.allSettled([siteSettingsLoaded, galleryLoaded, newsVisibilityLoaded, presidentsLoaded])
    .then(() => Loader.hideFullPageLoader());
});
