const HISTORY_IMAGES = [
  { src: '../assets/images/logo/logo1.png', alt: 'โลโก้ค่าย 1' },
  { src: '../assets/images/logo/logo2.png', alt: 'โลโก้ค่าย 2' },
  { src: '../assets/images/logo/logoPMD1.png', alt: 'โลโก้ค่าย PMD' }
];

let currentHistoryImage = 0;
let currentImageFilter = 'none';
let currentBrightness = 100;

function updateHistoryImage() {
    const mainImage = document.getElementById('history-main-image');
    if (!mainImage) return;

    mainImage.src = HISTORY_IMAGES[currentHistoryImage].src;
    mainImage.alt = HISTORY_IMAGES[currentHistoryImage].alt;
    mainImage.style.filter = getCssFilter();

    document.querySelectorAll('.history-thumb').forEach((btn, index) => {
        btn.classList.toggle('active', index === currentHistoryImage);
    });
}

function getCssFilter() {
    const map = {
        none: 'none',
        grayscale: 'grayscale(1)',
        sepia: 'sepia(0.75)',
        contrast: 'contrast(1.2)'
    };
    return `${map[currentImageFilter] || 'none'} brightness(${currentBrightness}%)`;
}

function selectHistoryImage(index) {
    if (index < 0 || index >= HISTORY_IMAGES.length) return;
    currentHistoryImage = index;
    updateHistoryImage();
}

function applyImageFilter(filterName) {
    currentImageFilter = filterName;
    updateHistoryImage();
}

function setBrightness(value) {
    currentBrightness = Number(value);
    updateHistoryImage();
}

window.addEventListener('DOMContentLoaded', updateHistoryImage);