const BADGE_COLOR_CLASS = {
  EMERALD: 'badge-emerald',
  ROSE: 'badge-rose',
  BRAND: 'badge-brand',
  INDIGO: 'badge-indigo',
};

function renderSchedule(items) {
  const timelineList = document.getElementById('timeline-list');
  if (!timelineList) return;

  timelineList.innerHTML = '';
  timelineList.classList.toggle('is-empty', items.length === 0);

  if (items.length === 0) {
    timelineList.innerHTML = `
      <div class="timeline-empty-card">
        <div class="timeline-empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <h3 class="timeline-empty-title">ยังไม่มีกำหนดการ</h3>
        <p class="timeline-empty-desc">ระบบจะแสดงรายการกำหนดการทันทีที่มีการเพิ่มข้อมูลใหม่</p>
      </div>
    `;
    return;
  }

  items.forEach((item, index) => {
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item';
    const badgeClass = BADGE_COLOR_CLASS[item.badgeColor] || 'badge-brand';
    timelineItem.innerHTML = `
      <div class="timeline-date">
        <span class="date-text">${item.dateText}</span>
        <span class="date-badge ${badgeClass}">${item.badgeLabel}</span>
      </div>
      <div class="timeline-dot ${badgeClass} ${index === 0 ? '' : 'dot-inactive'}"></div>
      <div class="timeline-content">
        <span class="timeline-mobile-date">${item.mobileDate}</span>
        <h3 class="timeline-title">${item.title}</h3>
        <p class="timeline-desc">${item.description}</p>
      </div>
    `;

    timelineList.appendChild(timelineItem);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  Loader.showFullPageLoader();

  const timelineList = document.getElementById('timeline-list');
  if (timelineList) Loader.renderSkeletonCards(timelineList, 3);

  fetch('/api/schedules?visibleOnly=true')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(renderSchedule)
    .catch((error) => {
      console.error('โหลดกำหนดการไม่สำเร็จ:', error);
    })
    .finally(() => Loader.hideFullPageLoader());
});
