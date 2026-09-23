// ==========================================
// แดชบอร์ด WebManager (6 แท็บ) - โหลดต่อจาก webmanager.js จึงใช้ helper ของไฟล์นั้นได้ (escapeHtml, showToast, switchAdminSection, switchAdminTab,
// ACTIVITY_ACTION_LABELS, STUDY_PLAN_LABELS, INTEREST_SUBJECT_GROUP_LABELS, submitRegistrationOpen, Loader)
// ข้อมูลทุกแท็บมาจาก /api/dashboard/* (ดู backend/controllers/dashboardController.js) โหลดเฉพาะแท็บที่เปิดดู แท็บภาพรวมโหลดตอนเข้าหน้า
// กราฟทั้งหมดวาดเป็น SVG เองในไฟล์นี้ ไม่ใช้ไลบรารีภายนอก (ข้อมูลไม่กี่สิบจุด ไม่คุ้มโหลดไลบรารีเพิ่ม)
// ==========================================

const DASHBOARD_TAB_STORAGE_KEY = 'webmanagerDashboardTab';
const DASHBOARD_RANGE_STORAGE_KEY = 'webmanagerDashboardUsageRange';
const DASHBOARD_TABS = ['overview', 'people', 'academic', 'activities', 'system', 'usage'];
const DASHBOARD_TAB_ENDPOINTS = {
    overview: '/api/dashboard/summary',
    people: '/api/dashboard/people',
    academic: '/api/dashboard/academic',
    activities: '/api/dashboard/activities',
    system: '/api/dashboard/system',
    usage: '/api/dashboard/usage',
};

const dashboardState = {
    tab: 'overview',
    usageRange: '7d',
    loaded: new Set(),
    data: {},
};

// ==========================================
// helper จัดรูปแบบ
// ==========================================
function dashNum(value) {
    return Number(value || 0).toLocaleString('th-TH');
}

function dashBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function dashSignedBytes(bytes) {
    if (bytes === null || bytes === undefined) return null;
    const sign = bytes >= 0 ? '+' : '-';
    return `${sign}${dashBytes(Math.abs(bytes))}`;
}

function dashDay(day, options = {}) {
    if (!day) return '-';
    const date = typeof day === 'string' && day.length === 10 ? new Date(`${day}T00:00:00+07:00`) : new Date(day);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok', ...options });
}

function dashDateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
}

function dashRelativeTime(value) {
    if (!value) return '-';
    const diffMs = Date.now() - new Date(value).getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return 'เมื่อสักครู่';
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} ชม. ที่แล้ว`;
    const days = Math.round(hours / 24);
    return `${days} วันที่แล้ว`;
}

function dashDuration(seconds) {
    const total = Number(seconds || 0);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0) return `${days} วัน ${hours} ชม.`;
    if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
    return `${minutes} นาที`;
}

function dashPct(part, total) {
    return total > 0 ? Math.round((part / total) * 100) : 0;
}

function dashMs(ms) {
    const value = Number(ms || 0);
    if (value >= 10000) return `${(value / 1000).toFixed(1)} s`;
    return `${dashNum(Math.round(value))} ms`;
}

// ==========================================
// ชิ้นส่วน HTML ที่ใช้ซ้ำ
// ==========================================
const DASH_ICONS = {
    users: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>',
    staff: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.55 50.55 0 0112 13.489a50.55 50.55 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>',
    book: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>',
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>',
    doc: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>',
    mic: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>',
    flag: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>',
    group: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>',
    news: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" /></svg>',
    photo: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>',
    clock: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
    db: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
    bolt: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>',
    cloud: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>',
};

function dashStatCard({ icon, color = 'brand', value, label, suffix = '' }) {
    return `
        <div class="dash-card dash-stat">
            <div class="dash-ico ${color}">${DASH_ICONS[icon] || ''}</div>
            <div>
                <div class="dash-val">${value}${suffix ? ` <small>${suffix}</small>` : ''}</div>
                <div class="dash-lbl">${label}</div>
            </div>
        </div>
    `;
}

// แถบสัดส่วน 1 ชุด - items: [{ name, count, cls? }] ความยาวเทียบกับค่ามากสุด (หรือ max ที่ส่งมา)
function dashBarRows(items, { cls = '', max = null, tight = false, suffix = '', format = dashNum } = {}) {
    if (!items || items.length === 0) return dashEmpty('ยังไม่มีข้อมูล');
    const top = max ?? Math.max(1, ...items.map((i) => i.count));
    return `
        <div class="dash-bars${tight ? ' tight' : ''}">
            ${items.map((item) => `
                <div class="dash-bar-row">
                    <span class="dash-bar-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                    <div class="dash-bar"><i class="${item.cls || cls}" style="width:${Math.min(100, Math.round((item.count / top) * 100))}%"></i></div>
                    <span class="dash-bar-cnt">${format(item.count)}${suffix}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function dashKv(rows) {
    return `<div class="dash-kv">${rows.map(([k, v]) => `<div class="dash-kv-row"><span class="dash-kv-k">${k}</span><span class="dash-kv-v">${v}</span></div>`).join('')}</div>`;
}

function dashTag(text, kind = 'muted') {
    return `<span class="dash-tag ${kind}">${text}</span>`;
}

function dashEmpty(text) {
    return `<div class="dash-empty">${text}</div>`;
}

function dashSplit(parts) {
    const total = parts.reduce((s, p) => s + p.count, 0);
    if (total === 0) return dashEmpty('ยังไม่มีข้อมูล');
    return `
        <div class="dash-split">${parts.map((p) => `<i class="${p.cls}" style="width:${(p.count / total) * 100}%" title="${escapeHtml(p.name)} ${dashNum(p.count)}"></i>`).join('')}</div>
        <div class="dash-legend">${parts.map((p) => `<span><i class="${p.cls}"></i>${escapeHtml(p.name)} ${dashNum(p.count)} (${dashPct(p.count, total)}%)</span>`).join('')}</div>
    `;
}

function dashSkeleton(count = 3) {
    return `<div class="dash-skeleton">${'<div></div>'.repeat(count)}</div>`;
}

// ==========================================
// กราฟ SVG (viewBox คงที่ ปล่อยให้ย่อ/ขยายตามความกว้างการ์ด)
// ==========================================
const DASH_CHART_W = 720;
const DASH_CHART_H = 200;
const DASH_CHART_PAD = { top: 12, right: 12, bottom: 26, left: 12 };

function dashChartFrame(inner) {
    return `<svg class="dash-chart" viewBox="0 0 ${DASH_CHART_W} ${DASH_CHART_H}" role="img">${inner}</svg>`;
}

function dashChartEmpty(text) {
    return `<div class="dash-chart-empty">${text}</div>`;
}

// แท่งซ้อนกัน series: [{ values:[], cls }] (ซ้อนตามลำดับ series แรกอยู่ล่าง) labels: [] แสดงทุก labelEvery ตัว
function dashStackedBarChart({ series, labels, labelEvery = 1, markers = [] }) {
    const count = labels.length;
    if (count === 0) return dashChartEmpty('ยังไม่มีข้อมูล');
    const totals = labels.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] || 0), 0));
    const max = Math.max(1, ...totals);
    if (max === 1 && totals.every((t) => t === 0)) return dashChartEmpty('ยังไม่มีข้อมูลในช่วงนี้');
    const innerW = DASH_CHART_W - DASH_CHART_PAD.left - DASH_CHART_PAD.right;
    const innerH = DASH_CHART_H - DASH_CHART_PAD.top - DASH_CHART_PAD.bottom;
    const slot = innerW / count;
    const barW = Math.max(2, slot - Math.min(6, slot * 0.3));
    const baseY = DASH_CHART_PAD.top + innerH;

    let bars = '';
    labels.forEach((_, i) => {
        let yCursor = baseY;
        const x = DASH_CHART_PAD.left + i * slot + (slot - barW) / 2;
        series.forEach((ser) => {
            const v = ser.values[i] || 0;
            if (v <= 0) return;
            const h = (v / max) * innerH;
            yCursor -= h;
            bars += `<rect class="bar ${ser.cls || ''}" x="${x.toFixed(1)}" y="${yCursor.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${escapeHtml(labels[i])}: ${dashNum(v)}</title></rect>`;
        });
    });
    const labelText = labels.map((label, i) => (i % labelEvery === 0 || i === count - 1)
        ? `<text class="lab" x="${(DASH_CHART_PAD.left + i * slot + slot / 2).toFixed(1)}" y="${DASH_CHART_H - 8}" text-anchor="middle">${escapeHtml(label)}</text>` : '').join('');
    const markerLines = markers.map((m) => `<line class="marker" x1="${(DASH_CHART_PAD.left + m.index * slot + slot / 2).toFixed(1)}" y1="${DASH_CHART_PAD.top}" x2="${(DASH_CHART_PAD.left + m.index * slot + slot / 2).toFixed(1)}" y2="${baseY}" stroke="${m.color}"><title>${escapeHtml(m.label)}</title></line>`).join('');
    const gridY = DASH_CHART_PAD.top + innerH / 2;
    return dashChartFrame(`
        <line class="grid" x1="${DASH_CHART_PAD.left}" y1="${gridY}" x2="${DASH_CHART_W - DASH_CHART_PAD.right}" y2="${gridY}"/>
        <text class="lab" x="${DASH_CHART_PAD.left}" y="${gridY - 3}">${dashNum(Math.round(max / 2))}</text>
        <text class="lab" x="${DASH_CHART_PAD.left}" y="${DASH_CHART_PAD.top + 8}">${dashNum(max)}</text>
        <line class="axis" x1="${DASH_CHART_PAD.left}" y1="${baseY}" x2="${DASH_CHART_W - DASH_CHART_PAD.right}" y2="${baseY}"/>
        ${markerLines}${bars}${labelText}
    `);
}

// เส้น + พื้นที่ใต้เส้น values: [] labels: []
function dashLineChart({ values, labels, labelEvery = 1, cls = '', extra = null }) {
    const count = values.length;
    if (count === 0) return dashChartEmpty('ยังไม่มีข้อมูล');
    const max = Math.max(1, ...values, ...(extra ? extra.values : []));
    if (values.every((v) => v === 0) && (!extra || extra.values.every((v) => v === 0))) return dashChartEmpty('ยังไม่มีข้อมูลในช่วงนี้');
    const innerW = DASH_CHART_W - DASH_CHART_PAD.left - DASH_CHART_PAD.right;
    const innerH = DASH_CHART_H - DASH_CHART_PAD.top - DASH_CHART_PAD.bottom;
    const baseY = DASH_CHART_PAD.top + innerH;
    const step = count > 1 ? innerW / (count - 1) : 0;
    const point = (v, i) => [DASH_CHART_PAD.left + (count > 1 ? i * step : innerW / 2), baseY - (v / max) * innerH];
    const pts = values.map(point);
    const poly = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${pts[0][0].toFixed(1)},${baseY} ${poly} ${pts[pts.length - 1][0].toFixed(1)},${baseY}`;
    const dots = count <= 40 ? pts.map(([x, y], i) => `<circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"><title>${escapeHtml(labels[i])}: ${dashNum(values[i])}</title></circle>`).join('') : '';
    const extraLine = extra ? `<polyline class="line ${extra.cls || 'dark'}" points="${extra.values.map(point).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}"/>` : '';
    const labelText = labels.map((label, i) => (i % labelEvery === 0 || i === count - 1)
        ? `<text class="lab" x="${pts[i][0].toFixed(1)}" y="${DASH_CHART_H - 8}" text-anchor="${i === 0 ? 'start' : (i === count - 1 ? 'end' : 'middle')}">${escapeHtml(label)}</text>` : '').join('');
    const gridY = DASH_CHART_PAD.top + innerH / 2;
    return dashChartFrame(`
        <line class="grid" x1="${DASH_CHART_PAD.left}" y1="${gridY}" x2="${DASH_CHART_W - DASH_CHART_PAD.right}" y2="${gridY}"/>
        <text class="lab" x="${DASH_CHART_PAD.left}" y="${gridY - 3}">${dashNum(Math.round(max / 2))}</text>
        <text class="lab" x="${DASH_CHART_PAD.left}" y="${DASH_CHART_PAD.top + 8}">${dashNum(max)}</text>
        <line class="axis" x1="${DASH_CHART_PAD.left}" y1="${baseY}" x2="${DASH_CHART_W - DASH_CHART_PAD.right}" y2="${baseY}"/>
        <polygon class="area ${cls}" points="${area}"/>
        <polyline class="line ${cls}" points="${poly}"/>
        ${extraLine}${dots}${labelText}
    `);
}

const DASH_WEEKDAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

// heatmap 7 วัน × 24 ชม. (matrix[day][hour])
function dashHeatmap(matrix) {
    const max = Math.max(1, ...matrix.flat());
    if (matrix.flat().every((v) => v === 0)) return dashChartEmpty('ยังไม่มีข้อมูลในช่วงนี้');
    let html = '<div class="dash-heat">';
    matrix.forEach((row, d) => {
        html += `<div class="d">${DASH_WEEKDAYS[d]}</div>`;
        row.forEach((v, h) => {
            const opacity = v === 0 ? 0.06 : Math.max(0.15, v / max);
            html += `<div class="c" style="opacity:${opacity.toFixed(2)}" title="${DASH_WEEKDAYS[d]} ${String(h).padStart(2, '0')}:00 · ${dashNum(v)} คำขอ"></div>`;
        });
    });
    html += '<div></div>';
    for (let h = 0; h < 24; h += 1) html += h % 3 === 0 ? `<div class="h">${String(h).padStart(2, '0')}</div>` : '<div></div>';
    html += '</div>';
    return html;
}

// ==========================================
// โหลด/สลับแท็บ
// ==========================================
function initDashboard() {
    const savedTab = localStorage.getItem(DASHBOARD_TAB_STORAGE_KEY);
    const savedRange = localStorage.getItem(DASHBOARD_RANGE_STORAGE_KEY);
    if (DASHBOARD_TABS.includes(savedTab)) dashboardState.tab = savedTab;
    if (['today', '7d', '30d', 'camp'].includes(savedRange)) dashboardState.usageRange = savedRange;
    applyDashboardTabClasses();
    // ภาพรวมโหลดเสมอ (ตัวเลข "อัปเดตล่าสุด" ในหัวหน้า + เป็นแท็บที่กลับมาดูบ่อยสุด) ถ้าเปิดค้างไว้แท็บอื่นก็โหลดแท็บนั้นเพิ่ม
    const loads = [loadDashboardTab('overview')];
    if (dashboardState.tab !== 'overview') loads.push(loadDashboardTab(dashboardState.tab));
    return Promise.allSettled(loads);
}

function applyDashboardTabClasses() {
    document.querySelectorAll('.dashboard-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.dashboardTab === dashboardState.tab));
    document.querySelectorAll('.dashboard-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `dashboard-panel-${dashboardState.tab}`));
}

function switchDashboardTab(tab) {
    if (!DASHBOARD_TABS.includes(tab)) return;
    dashboardState.tab = tab;
    localStorage.setItem(DASHBOARD_TAB_STORAGE_KEY, tab);
    applyDashboardTabClasses();
    if (!dashboardState.loaded.has(tab)) loadDashboardTab(tab);
}

// กระโดดจากแดชบอร์ดไปหน้าจัดการจริง (section ที่มีแท็บย่อยต้องระบุ tab ด้วย ไม่งั้น switchAdminSection จะเปิดแท็บแรกของกลุ่มแทน)
function dashboardGo(section, tab = null) {
    switchAdminSection(section);
    if (tab) switchAdminTab(tab);
}

function setDashboardRefreshSpinning(spinning) {
    const btn = document.getElementById('dashboard-refresh-btn');
    if (btn) {
        btn.classList.toggle('is-spinning', spinning);
        btn.disabled = spinning;
    }
}

function refreshDashboard() {
    setDashboardRefreshSpinning(true);
    loadDashboardTab(dashboardState.tab, { force: true }).finally(() => setDashboardRefreshSpinning(false));
}

async function loadDashboardTab(tab, { force = false } = {}) {
    const panel = document.getElementById(`dashboard-panel-${tab}`);
    if (!panel) return;
    if (!force && dashboardState.loaded.has(tab)) return;

    if (!dashboardState.loaded.has(tab)) panel.innerHTML = dashSkeleton(tab === 'usage' ? 6 : 3);

    let url = DASHBOARD_TAB_ENDPOINTS[tab];
    if (tab === 'overview' && force) url += '?refresh=1';
    if (tab === 'usage') url += `?range=${dashboardState.usageRange}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        dashboardState.data[tab] = data;
        dashboardState.loaded.add(tab);
        DASHBOARD_RENDERERS[tab](panel, data);
        if (tab === 'overview') {
            const updated = document.getElementById('dashboard-updated-at');
            if (updated) updated.textContent = `อัปเดตล่าสุด ${dashDateTime(data.generatedAt)}`;
        }
    } catch (error) {
        console.error(`โหลดแดชบอร์ด (${tab}) ไม่สำเร็จ:`, error);
        panel.innerHTML = `<div class="dash-card dash-error">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}<br><button type="button" class="dash-link" style="margin-top:.5rem" onclick="loadDashboardTab('${tab}', { force: true })">ลองใหม่</button></div>`;
        throw error;
    }
}

// ==========================================
// แท็บ 1: ภาพรวม
// ==========================================
function renderDashboardOverview(panel, d) {
    const camp = d.camp;
    // 3 ขั้นเดียวกับวิซาร์ด "ขั้นตอนดำเนินการค่าย" (LIFECYCLE_STEP_ORDER ใน webmanager.js): สร้าง+กำหนดคณะทำงาน → ดำเนินการ → จบ
    const lifecycle = (() => {
        const hasCamp = !!camp;
        const ended = hasCamp && camp.isEnded;
        return [
            { label: 'สร้างค่าย + คณะทำงาน', state: hasCamp ? 'done' : 'current' },
            { label: 'ดำเนินการค่าย', state: !hasCamp ? 'todo' : (ended ? 'done' : 'current') },
            { label: 'จบค่าย', state: ended ? 'done' : 'todo' },
        ];
    })();
    const stepperHtml = lifecycle.map((step, i) => `
        ${i > 0 ? `<div class="dash-step-line${lifecycle[i - 1].state === 'done' ? ' done' : ''}"></div>` : ''}
        <div class="dash-step ${step.state}"><span class="dash-step-n">${step.state === 'done' ? '✓' : i + 1}</span>${step.label}</div>
    `).join('');

    const campStatusPill = !camp
        ? '<span class="dash-status-pill"><span class="dot"></span>ยังไม่มีค่าย</span>'
        : (camp.isEnded ? '<span class="dash-status-pill ended"><span class="dot"></span>จบค่ายแล้ว</span>' : '<span class="dash-status-pill running"><span class="dot"></span>กำลังดำเนินการ</span>');

    const heroCamp = `
        <div class="dash-card dash-hero-camp">
            <div class="dash-gen">
                <div class="dash-gen-badge${camp ? '' : ' none'}">${camp ? camp.generationNo : '–'}</div>
                <div>
                    <div class="dash-gen-title">${camp ? `ค่ายพี่ติวน้อง ครั้งที่ ${camp.generationNo}` : 'ยังไม่ได้สร้างค่าย'}</div>
                    <div class="dash-gen-sub">${camp ? `สร้างเมื่อ ${dashDay(camp.createdAt, { year: 'numeric' })} ·` : ''} ${campStatusPill}</div>
                </div>
            </div>
            <div class="dash-stepper">${stepperHtml}</div>
            ${camp ? dashKv([
                ['ประธานค่าย', escapeHtml(camp.president || '-') + (camp.presidentNickname ? ` <span style="color:var(--slate-400)">(${escapeHtml(camp.presidentNickname)})</span>` : '')],
                ['รองประธาน', `${camp.vicePresidentCount} คน`],
                ['เลขานุการ', escapeHtml(camp.secretary || '-')],
                ['หัวหน้าฝ่าย', `${camp.departmentHeadCount} / ${camp.departmentCount} ฝ่าย`],
                ['ระบบวิชาการ / กิจกรรม', camp.isEnded ? dashTag('ปิด (ค่ายจบแล้ว)', 'muted') : dashTag('เปิดใช้งาน', 'ok')],
            ]) : `<p class="dash-note">ระบบวิชาการ/กิจกรรมล็อกอยู่จนกว่าจะสร้างค่ายและกำหนดคณะทำงาน → <button type="button" class="dash-link" onclick="dashboardGo('camps')">ขั้นตอนดำเนินการค่าย</button></p>`}
        </div>
    `;

    const reg = d.registrations;
    const heroRegistration = `
        <div class="dash-card">
            <p class="dash-card-h">การรับสมัคร</p>
            <div class="dash-kv">
                <div class="dash-kv-row"><span class="dash-kv-k">เปิดรับสมัครพี่ค่าย</span>
                    <label class="admin-toggle-switch small"><input type="checkbox" data-registration-toggle="staff" ${d.settings.staffRegistrationOpen ? 'checked' : ''} onchange="submitRegistrationOpen('staff', this.checked)"></label></div>
                <div class="dash-kv-row"><span class="dash-kv-k">เปิดรับสมัครน้องค่าย</span>
                    <label class="admin-toggle-switch small"><input type="checkbox" data-registration-toggle="participant" ${d.settings.participantRegistrationOpen && camp && !camp.isEnded ? 'checked' : ''} ${camp && !camp.isEnded ? '' : 'disabled title="ต้องมีค่ายที่กำลังดำเนินการอยู่ก่อนถึงจะเปิดรับสมัครน้องค่ายได้"'} onchange="submitRegistrationOpen('participant', this.checked)"></label></div>
                <div class="dash-kv-row"><span class="dash-kv-k">อนุมัติอัตโนมัติ</span><span class="dash-kv-v">${d.settings.staffAutoApprove ? 'พี่ค่าย ✓' : 'พี่ค่าย –'} · ${d.settings.participantAutoApprove ? 'น้องค่าย ✓' : 'น้องค่าย –'}</span></div>
                <div class="dash-kv-row" style="margin-top:.3rem"><span class="dash-kv-k">สมัครเข้ามาวันนี้</span><span class="dash-kv-v">+${reg.todayParticipant} น้องค่าย · +${reg.todayStaff} พี่ค่าย</span></div>
                <div class="dash-kv-row"><span class="dash-kv-k">สมัครสะสม 7 วัน</span><span class="dash-kv-v">${dashNum(reg.last7Days)} คน</span></div>
                <div class="dash-kv-row"><span class="dash-kv-k">รออนุมัติ / ไม่อนุมัติ</span><span class="dash-kv-v">${reg.pendingStaff + reg.pendingParticipant} / ${reg.rejected}</span></div>
            </div>
        </div>
    `;

    const backup = d.backup;
    const latest = backup.latest;
    const backupStatusTag = !latest ? dashTag('ยังไม่เคยสำรอง', 'muted')
        : latest.status === 'SUCCESS' ? dashTag('สำเร็จ', 'ok') : latest.status === 'FAILED' ? dashTag('ล้มเหลว', 'bad') : dashTag('กำลังทำงาน', 'wait');
    const nextBackup = latest && latest.status !== 'PENDING' && backup.configured
        ? dashDateTime(new Date(new Date(latest.startedAt).getTime() + backup.intervalHours * 3600 * 1000).toISOString())
        : '-';
    const heroBackup = `
        <div class="dash-card">
            <p class="dash-card-h">สำรองข้อมูล Google Drive</p>
            ${backup.configured ? dashKv([
                ['รอบล่าสุด', backupStatusTag],
                ['เมื่อ', latest ? `${dashDateTime(latest.startedAt)} (${{ SCHEDULED: 'อัตโนมัติ', MANUAL: 'กดเอง', CAMP_CREATE: 'ก่อนสร้างค่าย', CAMP_END: 'ก่อนลบน้องค่าย' }[latest.trigger] || latest.trigger})` : '-'],
                ['ไฟล์ / ขนาด', latest ? `${dashNum(latest.fileCount)} ไฟล์ · ${dashBytes(latest.totalBytes)}` : '-'],
                ['รอบถัดไป (ประมาณ)', nextBackup],
                ['ล้มเหลวใน 30 วัน', backup.failedLast30Days > 0 ? `<span style="color:var(--rose-600)">${backup.failedLast30Days} ครั้ง</span>` : '0 ครั้ง'],
            ]) : `<p class="dash-note">ยังไม่ได้ตั้งค่า Google Drive ใน .env ระบบจะข้ามการสำรองข้อมูลอัตโนมัติ</p>`}
            ${latest && latest.status === 'FAILED' && latest.errorMessage ? `<p class="dash-note" style="color:var(--rose-600)">${escapeHtml(latest.errorMessage)}</p>` : ''}
            <p class="dash-note"><button type="button" class="dash-link" onclick="dashboardGo('camps', 'camp-backups')">ดูประวัติ / สำรองตอนนี้</button></p>
        </div>
    `;

    const a = d.attention;
    const actionItems = [
        { count: a.pendingStaff, label: 'คำขอลงทะเบียน<br>พี่ค่ายรออนุมัติ', kind: 'warn', go: "dashboardGo('approve-registration')" },
        { count: a.pendingParticipant, label: 'คำขอลงทะเบียน<br>น้องค่ายรออนุมัติ', kind: 'warn', go: "dashboardGo('approve-registration')" },
        { count: a.pendingNews, label: 'ประชาสัมพันธ์<br>รออนุมัติ', kind: 'warn', go: "dashboardGo('home', 'approve-news')" },
        { count: a.ungroupedParticipants, label: 'น้องค่าย<br>ยังไม่ได้จัดกลุ่ม', kind: 'alert', go: "dashboardGo('user')" },
        { count: a.subjectsWithoutInstructor, label: `วิชาที่ยังไม่มี<br>ผู้สอนรับผิดชอบ`, kind: 'alert', title: a.subjectsWithoutInstructorNames.join(', '), go: "switchDashboardTab('academic')" },
        { count: a.openExamSessions, label: 'รอบสอบอธิบาย<br>ที่เปิดค้างอยู่', kind: '', go: "switchDashboardTab('academic')" },
        { count: a.pendingExamAttempts, label: 'น้องค่ายในคิวสอบ<br>ยังไม่ได้ประเมิน', kind: '', go: "switchDashboardTab('academic')" },
    ].filter((item) => item.count > 0);
    const actionsHtml = actionItems.length === 0
        ? `<div class="dash-all-clear">${DASH_ICONS.check.replace('<svg', '<svg style="width:1.25rem;height:1.25rem"')} ไม่มีรายการค้างที่ต้องดำเนินการตอนนี้</div>`
        : `<div class="dash-actions">${actionItems.map((item) => `
            <button type="button" class="dash-action ${item.kind}" onclick="${item.go}" ${item.title ? `title="${escapeHtml(item.title)}"` : ''}>
                <span class="dash-action-num">${dashNum(item.count)}</span>
                <span class="dash-action-lbl">${item.label}</span>
                <span class="dash-action-go">›</span>
            </button>`).join('')}</div>`;

    const p = d.people;
    const courseParts = p.participants.byCourse.map((c, i) => ({ name: c.name, count: c.count, cls: ['dash-c-blue', 'dash-c-green', 'dash-c-violet', 'dash-c-amber'][i % 4] }));
    const peopleHtml = `
        <div class="dash-grid dash-grid-3">
            <div class="dash-card">
                <div class="dash-stat"><div class="dash-ico blue">${DASH_ICONS.users}</div><div><div class="dash-val">${dashNum(p.participants.total)}</div><div class="dash-lbl">น้องค่ายทั้งหมด (อนุมัติแล้ว)</div></div></div>
                ${dashSplit(courseParts)}
                ${dashBarRows([
                    { name: 'จัดกลุ่มแล้ว', count: p.participants.grouped, cls: 'green' },
                    { name: 'ยังไม่จัดกลุ่ม', count: p.participants.ungrouped, cls: 'rose' },
                ], { max: Math.max(1, p.participants.total) })}
            </div>
            <div class="dash-card">
                <div class="dash-stat"><div class="dash-ico brand">${DASH_ICONS.staff}</div><div><div class="dash-val">${dashNum(p.staff.total)}</div><div class="dash-lbl">พี่ค่ายทั้งหมด (อนุมัติแล้ว) · ผู้ดูแลระบบ ${p.staff.admins} คน</div></div></div>
                ${dashBarRows(p.staff.byDepartment.slice(0, 6))}
            </div>
            <div class="dash-card">
                <div class="dash-stat"><div class="dash-ico violet">${DASH_ICONS.book}</div><div><div class="dash-val">${dashNum(p.participants.byStudyPlan.length)}</div><div class="dash-lbl">แผนการเรียนของน้องค่าย</div></div></div>
                ${dashBarRows(p.participants.byStudyPlan.map((s) => ({ name: s.key === 'UNKNOWN' ? 'ไม่ระบุ' : (STUDY_PLAN_LABELS[s.key] || s.key), count: s.count })), { cls: 'violet' })}
            </div>
        </div>
    `;

    const ac = d.academic;
    const scoringPct = dashPct(ac.scoring.recorded, ac.scoring.expected);
    const oral = ac.oralExam;
    const oralTotal = oral.passed + oral.failed + oral.pending;
    const academicHtml = `
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'book', color: 'brand', value: dashNum(ac.subjects), label: `รายวิชา · ${ac.subjectsByCourse.map((c) => `${c.name} ${c.count}`).join(' / ')}` })}
            ${dashStatCard({ icon: 'calendar', color: 'blue', value: dashNum(ac.classSchedules), label: 'คาบเรียนในตารางเรียน' })}
            ${dashStatCard({ icon: 'doc', color: 'green', value: dashNum(ac.studyDocuments), label: 'เอกสารประกอบการเรียน' })}
            ${dashStatCard({ icon: 'mic', color: 'amber', value: dashNum(ac.openExamSessions), label: 'รอบสอบอธิบายที่เปิดอยู่ตอนนี้' })}
        </div>
        <div class="dash-grid dash-grid-2">
            <div class="dash-card">
                <p class="dash-card-h">ความคืบหน้าการบันทึกคะแนน</p>
                <div class="dash-progress">
                    <div class="dash-ring${scoringPct < 50 ? ' warn' : ''}" style="--pct:${scoringPct}"><span>${scoringPct}%</span></div>
                    <div class="dash-progress-text">บันทึกแล้ว <b>${dashNum(ac.scoring.recorded)}</b> จาก <b>${dashNum(ac.scoring.expected)}</b> รายการ<br>(น้องค่าย ${dashNum(oral.participantTotal)} คน × วิชาที่เก็บคะแนน ${ac.scoringSubjects} วิชา ตามคอร์ส)<br>
                    ${ac.scoring.subjectsWithoutScores.length ? `<span style="color:var(--slate-400);font-size:.78rem">วิชาที่ยังไม่มีคะแนนเลย: ${escapeHtml(ac.scoring.subjectsWithoutScores.join(', '))}</span>` : '<span style="color:var(--dash-green);font-size:.78rem">ทุกวิชามีคะแนนบันทึกแล้ว</span>'}</div>
                </div>
            </div>
            <div class="dash-card">
                <p class="dash-card-h">สอบอธิบาย (ทั้งค่าย)</p>
                ${dashBarRows([
                    { name: 'ผ่าน', count: oral.passed, cls: 'green' },
                    { name: 'ไม่ผ่าน', count: oral.failed, cls: 'rose' },
                    { name: 'รอประเมิน', count: oral.pending, cls: 'blue' },
                ], { max: Math.max(1, oralTotal), tight: true })}
                <div style="margin-top:.9rem">${dashKv([
                    ['น้องค่ายที่ผ่านครบทุกวิชา', `${dashNum(oral.fullyPassedParticipants)} / ${dashNum(oral.participantTotal)} คน`],
                    ['อัตราผ่านต่อครั้งที่สอบ', oral.passed + oral.failed > 0 ? `${dashPct(oral.passed, oral.passed + oral.failed)}%` : '-'],
                ])}</div>
            </div>
        </div>
    `;

    const act = d.activities;
    const activitiesHtml = `
        <div class="dash-grid dash-grid-2">
            <div class="dash-card">
                <div class="dash-grid dash-grid-2" style="gap:.75rem;margin-bottom:1rem">
                    <div class="dash-stat"><div class="dash-ico rose">${DASH_ICONS.flag}</div><div><div class="dash-val">${dashNum(act.activities)}</div><div class="dash-lbl">กิจกรรมสันทนาการ</div></div></div>
                    <div class="dash-stat"><div class="dash-ico green">${DASH_ICONS.group}</div><div><div class="dash-val">${dashNum(act.groups)}</div><div class="dash-lbl">กลุ่มน้องค่าย</div></div></div>
                </div>
                ${dashKv([
                    ['บันทึกคะแนนแล้ว', `${dashNum(act.scoreCells)} / ${dashNum(act.expectedCells)} ช่อง (${dashPct(act.scoreCells, act.expectedCells)}%)`],
                    ['กิจกรรมล่าสุดที่บันทึก', act.latestScored ? `${escapeHtml(act.latestScored.name)} · ${dashDay(act.latestScored.updatedAt)}` : '-'],
                ])}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">อันดับคะแนนกลุ่ม</p>
                ${act.leaderboard.length === 0 ? dashEmpty('ยังไม่มีคะแนนกิจกรรม') : `<table class="dash-table">${act.leaderboard.map((g, i) => `
                    <tr><td style="width:2.5rem"><span class="dash-rank r${i + 1}">${i + 1}</span></td><td>${escapeHtml(g.name)}</td><td class="dash-num dash-strong">${dashNum(g.total)}</td></tr>`).join('')}</table>`}
            </div>
        </div>
    `;

    const c = d.content;
    const contentHtml = `
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'news', color: 'blue', value: dashNum(c.news.total), label: `ประชาสัมพันธ์ · แสดง ${c.news.visible} / ซ่อน ${c.news.hidden} / รออนุมัติ ${c.news.pending}` })}
            ${dashStatCard({ icon: 'calendar', color: 'green', value: dashNum(c.schedules), label: 'กำหนดการหน้าเว็บ' })}
            ${dashStatCard({ icon: 'photo', color: 'brand', value: dashNum(c.committees), label: `ทำเนียบประธานค่าย · ประมวลภาพ ${dashNum(c.galleryPhotos)} รูป` })}
            ${dashStatCard({ icon: 'clock', color: 'rose', value: dashNum(c.activityLogs.total), label: `ประวัติการดำเนินการ · วันนี้ ${dashNum(c.activityLogs.today)} รายการ` })}
        </div>
    `;

    const u = d.usage;
    const usageTeaser = `
        <div class="dash-grid dash-grid-2">
            <div class="dash-card">
                <div class="dash-card-h-row"><p class="dash-card-h">กิจกรรมล่าสุด</p><button type="button" class="dash-link" style="margin-left:auto;font-size:.78rem" onclick="dashboardGo('log')">ดูทั้งหมด</button></div>
                ${dashRecentActivityHtml(d.recentActivity)}
            </div>
            <div class="dash-card">
                <div class="dash-card-h-row"><p class="dash-card-h">การใช้งานวันนี้</p><button type="button" class="dash-link" style="margin-left:auto;font-size:.78rem" onclick="switchDashboardTab('usage')">ดูสถิติเต็ม</button></div>
                <div class="dash-grid dash-grid-3" style="gap:.75rem">
                    <div><div class="dash-val">${dashNum(u.dau)}</div><div class="dash-lbl">ผู้ใช้ที่เข้าวันนี้ · 7 วัน ${dashNum(u.wau)} · 30 วัน ${dashNum(u.mau)}</div></div>
                    <div><div class="dash-val">${dashNum(u.apiRequestsToday)}</div><div class="dash-lbl">คำขอ API วันนี้ · หน้าเว็บ ${dashNum(u.pageViewsToday)} ครั้ง</div></div>
                    <div><div class="dash-val">${dashNum(u.avgResponseMs)} <small>ms</small></div><div class="dash-lbl">ตอบสนองเฉลี่ย · error ${dashNum(u.errorsToday)} · ล็อกอินค้าง ${dashNum(u.sessionCount)}</div></div>
                </div>
            </div>
        </div>
    `;

    panel.innerHTML = `
        <div class="dash-grid dash-grid-hero">${heroCamp}${heroRegistration}${heroBackup}</div>
        <div class="dash-section-title">ต้องดำเนินการ <span class="dash-chip">คลิกเพื่อไปจัดการ</span></div>
        ${actionsHtml}
        <div class="dash-section-title">บุคลากร <button type="button" class="dash-link dash-chip" onclick="switchDashboardTab('people')">รายละเอียด ›</button></div>
        ${peopleHtml}
        <div class="dash-section-title">งานวิชาการ <button type="button" class="dash-link dash-chip" onclick="switchDashboardTab('academic')">รายวิชา ›</button></div>
        ${academicHtml}
        <div class="dash-section-title">งานกิจกรรมและสันทนาการ <button type="button" class="dash-link dash-chip" onclick="switchDashboardTab('activities')">ตารางคะแนน ›</button></div>
        ${activitiesHtml}
        <div class="dash-section-title">เว็บไซต์ &amp; ระบบ <button type="button" class="dash-link dash-chip" onclick="switchDashboardTab('system')">รายละเอียด ›</button></div>
        ${contentHtml}
        ${usageTeaser}
    `;
}

function dashRecentActivityHtml(items) {
    if (!items || items.length === 0) return dashEmpty('ยังไม่มีประวัติการดำเนินการ');
    return items.map((item) => {
        const action = ACTIVITY_ACTION_LABELS[item.action] || { text: item.action, className: '' };
        return `<div class="dash-log-row"><span class="admin-badge ${action.className}">${action.text}</span><span class="dash-log-summary" title="${escapeHtml(item.summary)}">${escapeHtml(item.summary)}</span><span class="dash-log-who">${escapeHtml(item.actorEmail.split('@')[0])} · ${dashDateTime(item.createdAt)}</span></div>`;
    }).join('');
}

// ==========================================
// แท็บ 2: บุคลากร
// ==========================================
function renderDashboardPeople(panel, d) {
    const s = d.staff;
    const p = d.participants;
    const pendingList = (list, role) => (list.length === 0 ? dashEmpty('ไม่มีคำขอค้าง') : `<table class="dash-table">${list.map((u) => `
        <tr><td>${escapeHtml(u.fullName)}${u.nickname ? ` <span class="dash-table-sub" style="display:inline">(${escapeHtml(u.nickname)})</span>` : ''}</td><td class="dash-num" style="color:var(--slate-400)">${dashRelativeTime(u.createdAt)}</td></tr>`).join('')}</table>
        <p class="dash-note"><button type="button" class="dash-link" onclick="dashboardGo('approve-registration')">ไปหน้าอนุมัติ${role}</button></p>`);

    panel.innerHTML = `
        <div class="dash-section-title">พี่ค่าย</div>
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'staff', color: 'brand', value: dashNum(s.total), label: 'พี่ค่ายที่อนุมัติแล้ว' })}
            ${dashStatCard({ icon: 'clock', color: 'amber', value: dashNum(s.pending), label: `รออนุมัติ · ไม่อนุมัติ ${dashNum(s.rejected)}` })}
            ${dashStatCard({ icon: 'check', color: 'green', value: dashNum(s.admins), label: 'ได้รับสิทธิ์ผู้ดูแลระบบ (/admin)' })}
            ${dashStatCard({ icon: 'users', color: s.noDepartment > 0 ? 'rose' : 'blue', value: dashNum(s.noDepartment), label: 'ยังไม่ระบุฝ่าย' })}
        </div>
        <div class="dash-grid dash-grid-3">
            <div class="dash-card" style="grid-column: span 2">
                <p class="dash-card-h">พี่ค่ายแยกตามฝ่าย · ตำแหน่ง</p>
                ${s.byDepartment.length === 0 ? dashEmpty('ยังไม่มีฝ่าย') : `<div class="dash-table-wrap"><table class="dash-table"><tr><th>ฝ่าย</th><th class="dash-num">จำนวน</th><th>ตำแหน่ง</th></tr>${s.byDepartment.map((dep) => `
                    <tr><td class="dash-strong">${escapeHtml(dep.name)}</td><td class="dash-num dash-strong">${dashNum(dep.count)}</td><td>${dep.positions.length ? dep.positions.map((pos) => `${dashTag(`${escapeHtml(pos.name)} ${pos.count}`, pos.name === 'หัวหน้าฝ่าย' ? 'brand' : 'muted')}`).join(' ') : '<span style="color:var(--slate-300)">-</span>'}</td></tr>`).join('')}</table></div>`}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">คำขอพี่ค่ายรออนุมัติ</p>
                ${pendingList(s.pendingList, 'พี่ค่าย')}
                <p class="dash-card-h" style="margin-top:1.2rem">ตำแหน่งทั้งหมด</p>
                ${dashBarRows(s.byPosition, { tight: true })}
            </div>
        </div>

        <div class="dash-section-title">น้องค่าย${d.generationNo ? ` <span class="dash-chip">ค่ายครั้งที่ ${d.generationNo}</span>` : ''}</div>
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'users', color: 'blue', value: dashNum(p.total), label: 'น้องค่ายที่อนุมัติแล้ว' })}
            ${dashStatCard({ icon: 'clock', color: 'amber', value: dashNum(p.pending), label: `รออนุมัติ · ไม่อนุมัติ ${dashNum(p.rejected)}` })}
            ${dashStatCard({ icon: 'group', color: 'green', value: dashNum(p.grouped), label: 'จัดกลุ่มแล้ว' })}
            ${dashStatCard({ icon: 'group', color: p.ungrouped > 0 ? 'rose' : 'green', value: dashNum(p.ungrouped), label: 'ยังไม่ได้จัดกลุ่ม' })}
        </div>
        <div class="dash-grid dash-grid-3">
            <div class="dash-card">
                <p class="dash-card-h">สมาชิกต่อกลุ่ม</p>
                ${dashBarRows(p.byGroup, { cls: 'green', tight: true })}
                ${p.byGroup.length ? `<p class="dash-note">เฉลี่ย ${(p.grouped / Math.max(1, p.byGroup.length)).toFixed(1)} คน/กลุ่ม · กลุ่มที่ต่างจากค่าเฉลี่ยมากควรเกลี่ยใหม่</p>` : ''}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">คอร์ส · แผนการเรียน</p>
                ${dashBarRows(p.byCourse, { cls: 'blue', tight: true })}
                <div style="margin-top:1rem">${dashBarRows(p.byStudyPlan.map((sp) => ({ name: sp.key === 'UNKNOWN' ? 'ไม่ระบุ' : (STUDY_PLAN_LABELS[sp.key] || sp.key), count: sp.count })), { cls: 'violet', tight: true })}</div>
            </div>
            <div class="dash-card">
                <p class="dash-card-h">กลุ่มวิชาที่สนใจ (เลือกได้หลายข้อ)</p>
                ${dashBarRows(p.byInterestGroup.map((g) => ({ name: INTEREST_SUBJECT_GROUP_LABELS[g.key] || g.key, count: g.count })), { cls: 'amber', tight: true })}
            </div>
        </div>
        <div class="dash-grid dash-grid-2">
            <div class="dash-card">
                <p class="dash-card-h">คำขอน้องค่ายรออนุมัติ</p>
                ${pendingList(p.pendingList, 'น้องค่าย')}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">น้องค่ายที่ยังไม่มีกลุ่ม</p>
                ${p.ungroupedList.length === 0 ? dashEmpty('ทุกคนมีกลุ่มแล้ว') : `<table class="dash-table">${p.ungroupedList.map((u) => `
                    <tr><td>${escapeHtml(u.fullName)}${u.nickname ? ` <span style="color:var(--slate-400)">(${escapeHtml(u.nickname)})</span>` : ''}</td><td class="dash-num">${dashTag(escapeHtml(u.course), 'info')}</td></tr>`).join('')}</table>
                    ${p.ungrouped > p.ungroupedList.length ? `<p class="dash-note">และอีก ${p.ungrouped - p.ungroupedList.length} คน</p>` : ''}`}
            </div>
        </div>
    `;
}

// ==========================================
// แท็บ 3: งานวิชาการ
// ==========================================
function renderDashboardAcademic(panel, d) {
    const scoringRows = d.subjects.filter((s) => s.requiresScoring);
    const subjectRow = (s) => {
        const expl = s.requiresScoring ? `${s.explanationRecorded}/${s.eligibleParticipants}` : '-';
        const ach = s.requiresScoring ? `${s.achievementRecorded}/${s.eligibleParticipants}` : '-';
        const scoreTag = !s.requiresScoring ? dashTag('ไม่เก็บคะแนน', 'muted')
            : s.eligibleParticipants === 0 ? dashTag('ไม่มีน้อง', 'muted')
                : (s.explanationRecorded >= s.eligibleParticipants && s.achievementRecorded >= s.eligibleParticipants) ? dashTag('ครบ', 'ok')
                    : (s.explanationRecorded === 0 && s.achievementRecorded === 0) ? dashTag('ยังไม่เริ่ม', 'bad')
                        : dashTag(`${dashPct(s.explanationRecorded + s.achievementRecorded, s.eligibleParticipants * 2)}%`, 'wait');
        const oral = s.oralExam;
        return `
            <tr>
                <td class="dash-strong">${escapeHtml(s.name)}${oral.activeSession ? ` ${dashTag('เปิดสอบอยู่', 'brand')}` : ''}</td>
                <td>${dashTag(escapeHtml(s.course), s.course === 'ทั้งคู่' ? 'ok' : 'info')}</td>
                <td>${s.instructors.length ? escapeHtml(s.instructors.join(', ')) : dashTag('ยังไม่มีผู้สอน', 'bad')}</td>
                <td class="dash-num">${s.credits}</td>
                <td class="dash-num">${dashNum(s.periods)}</td>
                <td class="dash-num">${expl} <span class="dash-table-sub">เต็ม ${s.explanationMaxScore}</span></td>
                <td class="dash-num">${ach} <span class="dash-table-sub">เต็ม ${s.achievementMaxScore}</span></td>
                <td class="dash-num">${scoreTag}</td>
                <td class="dash-num">${s.requiresScoring ? `${dashNum(oral.passedParticipants)} / ${dashNum(s.eligibleParticipants)}${oral.pendingAttempts ? ` <span class="dash-table-sub">รอ ${oral.pendingAttempts}</span>` : ''}` : '-'}</td>
                <td class="dash-num">${oral.avgPassedAttempt ? `ครั้งที่ ${oral.avgPassedAttempt}` : '-'} <span class="dash-table-sub">${dashNum(oral.sessionsRun)} รอบ · ตก ${dashNum(oral.failedAttempts)}</span></td>
            </tr>
        `;
    };

    panel.innerHTML = `
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'book', color: 'brand', value: dashNum(d.subjects.length), label: `รายวิชาทั้งหมด · เก็บคะแนน ${scoringRows.length} วิชา` })}
            ${d.byCourse.map((c) => dashStatCard({ icon: 'users', color: 'blue', value: dashNum(c.participants), label: `น้องคอร์ส${escapeHtml(c.name)} · ${c.subjects + c.sharedSubjects} วิชา · ${c.classPeriods} คาบ · เอกสาร ${c.documents}` })).join('')}
            ${dashStatCard({ icon: 'doc', color: 'green', value: dashNum(d.sharedDocuments), label: 'เอกสารทั่วไป (ทุกคอร์สเห็น)' })}
        </div>
        <div class="dash-card" style="margin-top:1rem">
            <div class="dash-card-h-row"><p class="dash-card-h">รายวิชาทั้งหมด · ความคืบหน้ารายวิชา</p><span class="dash-chip">คะแนน = จำนวนน้องที่บันทึกแล้ว / น้องในคอร์สนั้น</span></div>
            ${d.subjects.length === 0 ? dashEmpty('ยังไม่มีรายวิชา') : `<div class="dash-table-wrap"><table class="dash-table">
                <tr><th>วิชา</th><th>คอร์ส</th><th>ผู้สอน</th><th class="dash-num">หน่วยกิต</th><th class="dash-num">คาบ</th><th class="dash-num">คะแนนอธิบาย</th><th class="dash-num">คะแนนสอบ</th><th class="dash-num">สถานะ</th><th class="dash-num">สอบอธิบายผ่าน</th><th class="dash-num">ผ่านเฉลี่ย</th></tr>
                ${d.subjects.map(subjectRow).join('')}
            </table></div>`}
        </div>
        <div class="dash-grid dash-grid-3" style="margin-top:1rem">
            <div class="dash-card">
                <p class="dash-card-h">การตั้งค่าคะแนนกลาง</p>
                ${dashKv([
                    ['สัดส่วน อธิบาย : สอบ', `${d.settings.explanationWeight} : ${d.settings.achievementWeight}`],
                    ['ช่วงเกรด (grade band)', `${d.settings.gradeBands} ช่วง`],
                    ['คะแนนสอบอธิบายตามครั้ง', d.settings.oralExamBands.length ? d.settings.oralExamBands.map((b) => `ครั้ง ${b.attemptNumber}=${b.scorePercent}%`).join(' · ') : '-'],
                ])}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">วิชาที่ต้องตามงาน</p>
                ${(() => {
                    const noInstructor = d.subjects.filter((s) => s.instructors.length === 0);
                    const notStarted = scoringRows.filter((s) => s.eligibleParticipants > 0 && s.explanationRecorded === 0 && s.achievementRecorded === 0);
                    const noPeriod = d.subjects.filter((s) => s.periods === 0);
                    const items = [
                        noInstructor.length ? `ไม่มีผู้สอน: ${escapeHtml(noInstructor.map((s) => s.name).join(', '))}` : null,
                        notStarted.length ? `ยังไม่มีคะแนนเลย: ${escapeHtml(notStarted.map((s) => s.name).join(', '))}` : null,
                        noPeriod.length ? `ยังไม่อยู่ในตารางเรียน: ${escapeHtml(noPeriod.map((s) => s.name).join(', '))}` : null,
                    ].filter(Boolean);
                    return items.length ? `<ul style="margin:0;padding-left:1.1rem;font-size:.84rem;color:var(--slate-700);line-height:1.7">${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : `<div class="dash-all-clear">${DASH_ICONS.check.replace('<svg', '<svg style="width:1.25rem;height:1.25rem"')} ทุกวิชามีผู้สอน มีคะแนน และอยู่ในตารางเรียนแล้ว</div>`;
                })()}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">สอบอธิบาย · ผ่านแล้วต่อวิชา</p>
                ${dashBarRows(scoringRows.map((s) => ({ name: s.name, count: s.oralExam.passedParticipants })), { cls: 'green', max: Math.max(1, ...scoringRows.map((s) => s.eligibleParticipants)), tight: true })}
            </div>
        </div>
    `;
}

// ==========================================
// แท็บ 4: งานกิจกรรม
// ==========================================
function renderDashboardActivities(panel, d) {
    const matrix = d.activities.length === 0 || d.groups.length === 0
        ? dashEmpty(d.activities.length === 0 ? 'ยังไม่มีกิจกรรม (ฝ่ายกิจกรรมสร้างได้ที่หน้าพี่ค่าย)' : 'ยังไม่มีกลุ่มน้องค่าย')
        : `<div class="dash-table-wrap"><table class="dash-table dash-matrix">
            <tr><th>กลุ่ม</th><th class="dash-num">สมาชิก</th>${d.activities.map((a) => `<th style="text-align:center" title="${escapeHtml(a.name)}">${escapeHtml(a.name.length > 14 ? `${a.name.slice(0, 13)}…` : a.name)}</th>`).join('')}<th class="dash-num">รวม</th></tr>
            ${d.groups.map((g, i) => `<tr>
                <td><span class="dash-rank r${i + 1}">${i + 1}</span> <span class="dash-strong">${escapeHtml(g.name)}</span></td>
                <td class="dash-num">${dashNum(g.memberCount)}</td>
                ${d.activities.map((a) => (g.scores[a.id] === undefined ? '<td class="cell-empty">–</td>' : `<td class="cell-score">${dashNum(g.scores[a.id])}</td>`)).join('')}
                <td class="dash-num dash-strong">${dashNum(g.total)}</td>
            </tr>`).join('')}
        </table></div>`;

    panel.innerHTML = `
        <div class="dash-grid dash-grid-4">
            ${dashStatCard({ icon: 'flag', color: 'rose', value: dashNum(d.activities.length), label: 'กิจกรรมสันทนาการ' })}
            ${dashStatCard({ icon: 'group', color: 'green', value: dashNum(d.groups.length), label: 'กลุ่มน้องค่าย' })}
            ${dashStatCard({ icon: 'check', color: d.scoredCells < d.expectedCells ? 'amber' : 'green', value: `${dashNum(d.scoredCells)} / ${dashNum(d.expectedCells)}`, label: `ช่องคะแนนที่บันทึกแล้ว (${dashPct(d.scoredCells, d.expectedCells)}%)` })}
            ${dashStatCard({ icon: 'bolt', color: 'brand', value: d.groups[0] ? escapeHtml(d.groups[0].name) : '-', label: d.groups[0] ? `กลุ่มอันดับ 1 · ${dashNum(d.groups[0].total)} คะแนน` : 'ยังไม่มีคะแนน' })}
        </div>
        <div class="dash-card" style="margin-top:1rem">
            <div class="dash-card-h-row"><p class="dash-card-h">ตารางคะแนน กลุ่ม × กิจกรรม (เรียงตามคะแนนรวม)</p><span class="dash-chip">– = ยังไม่ได้ให้คะแนน</span></div>
            ${matrix}
        </div>
        <div class="dash-grid dash-grid-2" style="margin-top:1rem">
            <div class="dash-card">
                <p class="dash-card-h">กิจกรรมแต่ละรายการ</p>
                ${d.activities.length === 0 ? dashEmpty('ยังไม่มีกิจกรรม') : `<table class="dash-table"><tr><th>กิจกรรม</th><th class="dash-num">ให้คะแนนแล้ว</th><th class="dash-num">เฉลี่ย</th><th class="dash-num">อัปเดตล่าสุด</th></tr>${d.activities.map((a) => `
                    <tr><td class="dash-strong">${escapeHtml(a.name)}</td><td class="dash-num">${a.scoredGroups} / ${d.groups.length} ${a.scoredGroups >= d.groups.length ? dashTag('ครบ', 'ok') : (a.scoredGroups === 0 ? dashTag('ยังไม่เริ่ม', 'muted') : dashTag('ไม่ครบ', 'wait'))}</td><td class="dash-num">${a.avgScore ?? '-'}</td><td class="dash-num" style="color:var(--slate-400)">${a.lastUpdated ? dashDateTime(a.lastUpdated) : '-'}</td></tr>`).join('')}</table>`}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">คะแนนรวมต่อกลุ่ม</p>
                ${dashBarRows(d.groups.map((g) => ({ name: g.name, count: g.total })), { cls: 'green', tight: true })}
            </div>
        </div>
    `;
}

// ==========================================
// แท็บ 5: เว็บไซต์ & ระบบ
// ==========================================
function renderDashboardSystem(panel, d) {
    const roleLabel = { WEBMANAGER: 'WebManager', STAFF: 'พี่ค่าย', PARTICIPANT: 'น้องค่าย' };
    const statusLabel = { APPROVED: 'อนุมัติแล้ว', PENDING: 'รออนุมัติ', REJECTED: 'ไม่อนุมัติ' };
    const usersByRole = ['WEBMANAGER', 'STAFF', 'PARTICIPANT'].map((role) => {
        const rows = d.users.filter((u) => u.role === role);
        return { role, total: rows.reduce((s, r) => s + r.count, 0), detail: rows.map((r) => `${statusLabel[r.status] || r.status} ${r.count}`).join(' · ') };
    });
    const integrationRow = (label, ok, hint) => `<div class="dash-kv-row"><span class="dash-kv-k">${label}</span><span class="dash-kv-v">${ok ? dashTag('พร้อมใช้', 'ok') : dashTag(hint || 'ยังไม่ตั้งค่า', 'wait')}</span></div>`;
    const triggerLabel = { SCHEDULED: 'อัตโนมัติ', MANUAL: 'กดเอง', CAMP_CREATE: 'ก่อนสร้างค่าย', CAMP_END: 'ก่อนลบน้องค่าย' };
    const statusTag = (status) => (status === 'SUCCESS' ? dashTag('สำเร็จ', 'ok') : status === 'FAILED' ? dashTag('ล้มเหลว', 'bad') : dashTag('กำลังทำงาน', 'wait'));
    const db = d.database;
    const settingRows = [
        ['แสดงการ์ดประธานค่ายใน Hero', d.siteSettings.heroCardVisible],
        ['แสดงส่วนทำเนียบประธานค่าย', d.siteSettings.committeeSectionVisible],
        ['แสดงส่วนข่าวสารหน้าแรก', d.siteSettings.newsSectionVisible],
        ['แท็บตรวจสอบผล: พี่ค่าย', d.siteSettings.checkRegistrationVisibleStaff],
        ['แท็บตรวจสอบผล: น้องค่าย', d.siteSettings.checkRegistrationVisibleParticipant],
    ];

    panel.innerHTML = `
        <div class="dash-grid dash-grid-3">
            <div class="dash-card">
                <p class="dash-card-h">ผู้ใช้ในระบบ</p>
                ${dashKv(usersByRole.map((r) => [roleLabel[r.role], `<b>${dashNum(r.total)}</b> <span class="dash-table-sub" style="display:inline">${r.detail || ''}</span>`]))}
                <p class="dash-note">ล็อกอินค้างอยู่ (session ยังไม่หมดอายุ 7 วัน): <b>${dashNum(db?.sessionCount ?? 0)}</b></p>
            </div>
            <div class="dash-card">
                <p class="dash-card-h">การเชื่อมต่อภายนอก</p>
                <div class="dash-kv">
                    ${integrationRow('Google Drive (สำรองข้อมูล/เอกสาร/รูปภาพ)', d.integrations.googleDrive)}
                    ${integrationRow('อีเมล OTP (Gmail)', d.integrations.mail)}
                    ${integrationRow('SESSION_SECRET', d.integrations.sessionSecretSet, 'ใช้ค่า dev')}
                    <div class="dash-kv-row"><span class="dash-kv-k">โหมด</span><span class="dash-kv-v">${dashTag(d.integrations.nodeEnv, d.integrations.nodeEnv === 'production' ? 'ok' : 'info')}</span></div>
                </div>
            </div>
            <div class="dash-card">
                <p class="dash-card-h">เซิร์ฟเวอร์ · ฐานข้อมูล (ตอนนี้)</p>
                ${dashKv([
                    ['ขนาดฐานข้อมูล', db ? dashBytes(db.databaseBytes) : '-'],
                    ['แถวข้อมูลรวม (ประมาณ)', db ? dashNum(Math.round(db.totalRows)) : '-'],
                    ['การเชื่อมต่อ DB ที่ใช้อยู่', db && db.connectionCount !== null ? dashNum(db.connectionCount) : '-'],
                    ['หน่วยความจำ (RSS)', dashBytes(d.server.rssBytes)],
                    ['ทำงานต่อเนื่อง', dashDuration(d.server.uptimeSeconds)],
                    ['Node.js', `${d.server.nodeVersion} · ${d.server.platform}`],
                ])}
            </div>
        </div>
        <div class="dash-grid dash-grid-2" style="margin-top:1rem">
            <div class="dash-card">
                <div class="dash-card-h-row"><p class="dash-card-h">สำรองข้อมูล Google Drive · 10 รอบล่าสุด</p>${d.backups.failedLast30Days ? dashTag(`ล้มเหลว ${d.backups.failedLast30Days} ครั้งใน 30 วัน`, 'bad') : dashTag('30 วันไม่มีล้มเหลว', 'ok')}</div>
                ${d.backups.list.length === 0 ? dashEmpty(d.backups.configured ? 'ยังไม่เคยสำรองข้อมูล' : 'ยังไม่ได้ตั้งค่า Google Drive') : `<div class="dash-table-wrap"><table class="dash-table"><tr><th>เวลา</th><th>ค่าย</th><th>แบบ</th><th class="dash-num">ไฟล์</th><th class="dash-num">ขนาด</th><th>สถานะ</th></tr>${d.backups.list.map((run) => `
                    <tr><td>${dashDateTime(run.startedAt)}</td><td>${run.generationNo ? `ครั้งที่ ${run.generationNo}` : '-'}</td><td>${triggerLabel[run.trigger] || run.trigger}</td><td class="dash-num">${dashNum(run.fileCount)}</td><td class="dash-num">${dashBytes(run.totalBytes)}</td><td>${statusTag(run.status)}${run.errorMessage ? `<span class="dash-table-sub" title="${escapeHtml(run.errorMessage)}">${escapeHtml(run.errorMessage.slice(0, 40))}${run.errorMessage.length > 40 ? '…' : ''}</span>` : ''}</td></tr>`).join('')}</table></div>`}
                <p class="dash-note">รอบอัตโนมัติทุก ${d.backups.intervalHours} ชม. · <button type="button" class="dash-link" onclick="dashboardGo('camps', 'camp-backups')">จัดการ / สำรองตอนนี้</button></p>
            </div>
            <div class="dash-card">
                <p class="dash-card-h">ตารางที่ใหญ่ที่สุดในฐานข้อมูล</p>
                ${db ? dashBarRows(db.tables.map((t) => ({ name: t.table, count: t.bytes })), { cls: 'rose', tight: true, format: dashBytes }) : dashEmpty('อ่านข้อมูลไม่ได้')}
                <p class="dash-note">แถวโดยประมาณ: ${db ? db.tables.slice(0, 5).map((t) => `${escapeHtml(t.table)} ${dashNum(Math.round(t.rows))}`).join(' · ') : '-'}</p>
            </div>
        </div>
        <div class="dash-grid dash-grid-3" style="margin-top:1rem">
            <div class="dash-card">
                <p class="dash-card-h">ประวัติการดำเนินการ 7 วัน · ใครทำ</p>
                ${dashBarRows(d.logs.byRole7d.map((r) => ({ name: ACTIVITY_ROLE_LABELS[r.role] || r.role, count: r.count })), { tight: true })}
                <div style="margin-top:.9rem">${dashBarRows(d.logs.byAction7d.map((r) => ({ name: (ACTIVITY_ACTION_LABELS[r.action] || { text: r.action }).text, count: r.count, cls: { CREATE: 'green', UPDATE: 'blue', DELETE: 'rose' }[r.action] || '' })), { tight: true })}</div>
            </div>
            <div class="dash-card">
                <p class="dash-card-h">ประวัติการดำเนินการ 7 วัน · เรื่องอะไร</p>
                ${dashBarRows(d.logs.byEntity7d.map((r) => ({ name: ACTIVITY_ENTITY_LABELS[r.entityType] || r.entityType, count: r.count })), { cls: 'violet', tight: true })}
                <p class="dash-note"><button type="button" class="dash-link" onclick="dashboardGo('log')">ดู log ทั้งหมด</button></p>
            </div>
            <div class="dash-card">
                <p class="dash-card-h">เนื้อหาหน้าเว็บ · สวิตช์แสดงผล</p>
                ${dashKv([
                    ['ข่าวแยกประเภท', d.content.newsByTag.map((n) => `${NEWS_TAG_LABELS[n.tag] || n.tag} ${n.count}`).join(' · ') || '-'],
                    ['กำหนดการที่ยังมาไม่ถึง', `${dashNum(d.content.upcomingSchedules)} รายการ`],
                    ['ทำเนียบที่แสดง / ประมวลภาพ', `${dashNum(d.content.committeeVisible)} / ${dashNum(d.content.galleryPhotos)} รูป`],
                    ...settingRows.map(([label, on]) => [label, on ? dashTag('เปิด', 'ok') : dashTag('ปิด', 'muted')]),
                ])}
                <p class="dash-note"><button type="button" class="dash-link" onclick="dashboardGo('home')">ไปตั้งค่าหน้าแรก</button></p>
            </div>
        </div>
    `;
}

// ==========================================
// แท็บ 6: การใช้งานเว็บไซต์
// ==========================================
function setDashboardUsageRange(range) {
    if (!['today', '7d', '30d', 'camp'].includes(range) || range === dashboardState.usageRange) return;
    dashboardState.usageRange = range;
    localStorage.setItem(DASHBOARD_RANGE_STORAGE_KEY, range);
    dashboardState.loaded.delete('usage');
    loadDashboardTab('usage');
}

function toggleDashboardExportMenu(forceClose = false) {
    const menu = document.getElementById('dashboard-export-menu');
    if (!menu) return;
    menu.hidden = forceClose ? true : !menu.hidden;
}

document.addEventListener('click', (event) => {
    if (!event.target.closest('.dash-export')) toggleDashboardExportMenu(true);
});

function renderDashboardUsage(panel, d) {
    const k = d.kpi;
    const r = d.registrations;
    const rangeLabel = { today: 'วันนี้', '7d': '7 วัน', '30d': '30 วัน', camp: 'ทั้งค่าย' };
    const rangeBtn = (key) => `<button type="button" class="dash-range-btn${d.range.key === key ? ' on' : ''}" onclick="setDashboardUsageRange('${key}')">${rangeLabel[key]}</button>`;
    const days = d.activeByDay.map((x) => x.day);
    const labelEvery = days.length <= 7 ? 1 : days.length <= 31 ? 5 : Math.ceil(days.length / 8);
    const dayLabels = days.map((day) => dashDay(day));
    const otpPct = dashPct(r.otpSentToday, r.otpDailyQuota);

    // เส้นประบอกวันเปิดรับสมัคร: หาจากวันแรกที่มีคนสมัคร role นั้นในช่วง (ไม่มีบันทึกวันกดสวิตช์จริง ใช้แบบนี้พอชี้ให้เห็น)
    const firstStaffIndex = r.byDay.findIndex((x) => x.staff > 0);
    const firstParticipantIndex = r.byDay.findIndex((x) => x.participant > 0);
    const markers = [];
    if (firstStaffIndex > 0) markers.push({ index: firstStaffIndex, color: 'var(--brand-500)', label: 'เริ่มมีพี่ค่ายสมัคร' });
    if (firstParticipantIndex > 0) markers.push({ index: firstParticipantIndex, color: 'var(--dash-blue)', label: 'เริ่มมีน้องค่ายสมัคร' });

    const hourlyLabels = d.hourly24h.map((h) => `${String(h.hour).padStart(2, '0')}`);
    const breakdownRoles = [
        { name: 'น้องค่าย', count: d.breakdown.roles.participant, cls: 'blue' },
        { name: 'พี่ค่าย', count: d.breakdown.roles.staff, cls: '' },
        { name: 'ผู้เยี่ยมชม (ไม่ล็อกอิน)', count: d.breakdown.roles.guest, cls: 'green' },
        { name: 'WebManager', count: d.breakdown.roles.webmanager, cls: 'violet' },
    ];
    const totalBreakdown = breakdownRoles.reduce((s, x) => s + x.count, 0);
    const browsers = [
        ['Chrome/Edge', d.breakdown.browsers.chrome], ['Safari', d.breakdown.browsers.safari], ['LINE in-app', d.breakdown.browsers.line], ['อื่น ๆ', d.breakdown.browsers.other],
    ];
    const totalBrowser = browsers.reduce((s, [, c]) => s + c, 0);

    const endpointTable = (rows, mode) => (rows.length === 0 ? dashEmpty('ยังไม่มีข้อมูลในช่วงนี้') : `<div class="dash-table-wrap"><table class="dash-table">
        <tr><th>Endpoint</th>${mode === 'slow' ? '<th class="dash-num">เฉลี่ย</th><th class="dash-num">ช้าสุด</th><th class="dash-num">ครั้ง</th>' : '<th class="dash-num">ครั้ง</th><th class="dash-num">เฉลี่ย</th><th class="dash-num">error</th>'}</tr>
        ${rows.map((e) => `<tr><td><span class="dash-mono">${escapeHtml(e.method)} ${escapeHtml(e.route)}</span></td>${mode === 'slow'
            ? `<td class="dash-num dash-strong">${dashMs(e.avgDurationMs)}</td><td class="dash-num">${dashMs(e.maxDurationMs)}</td><td class="dash-num">${dashNum(e.requestCount)}</td>`
            : `<td class="dash-num dash-strong">${dashNum(e.requestCount)}</td><td class="dash-num">${dashMs(e.avgDurationMs)}</td><td class="dash-num">${e.errorCount ? `<span style="color:var(--rose-600)">${e.errorCount}</span>` : '0'}${e.clientErrorCount ? ` <span class="dash-table-sub">4xx ${e.clientErrorCount}</span>` : ''}</td>`}</tr>`).join('')}
    </table></div>`);

    const db = d.database;
    const weeklyGrowth = dashSignedBytes(db.weeklyGrowthBytes);
    const dbHistory = db.history;
    const dbChart = dbHistory.length >= 2
        ? dashLineChart({ values: dbHistory.map((h) => Math.round(h.databaseBytes / 1024)), labels: dbHistory.map((h) => dashDay(h.day)), labelEvery: Math.max(1, Math.ceil(dbHistory.length / 6)), cls: 'blue' })
        : dashChartEmpty(`ยังมี snapshot ${dbHistory.length} วัน · กราฟจะขึ้นเมื่อมีตั้งแต่ 2 วันขึ้นไป (ถ่ายอัตโนมัติวันละครั้ง)`);

    const camps = d.campComparison;

    panel.innerHTML = `
        <div class="dash-usage-head">
            <div>
                <div class="dash-section-title">สรุปการใช้งาน · ${rangeLabel[d.range.key]} <span class="dash-chip">${dashDay(d.range.startDay)}${d.range.days > 1 ? ` – ${dashDay(d.range.endDay)}` : ''}</span></div>
                <p class="dash-usage-head-sub">${d.trackingSince ? `เก็บสถิติตั้งแต่ ${dashDateTime(d.trackingSince)}` : 'เพิ่งเริ่มเก็บสถิติ ข้อมูลจะทยอยขึ้นภายใน 1 นาทีหลังมีการใช้งาน'} · เก็บระยะยาวข้ามค่าย ไม่ถูกล้างตอนสร้างค่ายใหม่ · ไม่เก็บ IP/ข้อมูลส่วนตัว</p>
            </div>
            <div class="dash-usage-controls">
                <div class="dash-range">${['today', '7d', '30d', 'camp'].map(rangeBtn).join('')}</div>
                <div class="dash-export">
                    <button type="button" class="dashboard-refresh-btn" onclick="toggleDashboardExportMenu()">${DASH_ICONS.cloud.replace('<svg', '<svg style="width:1rem;height:1rem"')}<span>ส่งออก CSV</span></button>
                    <div class="dash-export-menu" id="dashboard-export-menu" hidden>
                        <a href="${window.PTN_API_URL(`/api/dashboard/usage/export?type=hourly&range=${d.range.key}`)}">รายชั่วโมง (${rangeLabel[d.range.key]})</a>
                        <a href="${window.PTN_API_URL(`/api/dashboard/usage/export?type=endpoints&range=${d.range.key}`)}">รายวันต่อ endpoint (${rangeLabel[d.range.key]})</a>
                        <a href="${window.PTN_API_URL(`/api/dashboard/usage/export?type=users&range=${d.range.key}`)}">ผู้ใช้ต่อวัน (${rangeLabel[d.range.key]})</a>
                        <a href="${window.PTN_API_URL(`/api/dashboard/usage/export?type=snapshots`)}">ขนาดฐานข้อมูลรายวัน (ทั้งหมด)</a>
                    </div>
                </div>
            </div>
        </div>

        <div class="dash-grid dash-grid-6 dash-kpi">
            <div class="dash-card"><div class="dash-val">${dashNum(k.dau)}</div><div class="dash-lbl">ผู้ใช้ที่เข้าใช้วันนี้ (DAU)</div></div>
            <div class="dash-card"><div class="dash-val">${dashNum(k.rangeUsers)}</div><div class="dash-lbl">ผู้ใช้ไม่ซ้ำใน${rangeLabel[d.range.key]} · เฉลี่ย ${dashNum(k.avgDailyUsers)} คน/วัน</div></div>
            <div class="dash-card"><div class="dash-val">${dashNum(k.apiRequests)}</div><div class="dash-lbl">คำขอ API · เปิดหน้าเว็บ ${dashNum(k.pageViews)} ครั้ง</div></div>
            <div class="dash-card"><div class="dash-val">${dashNum(k.avgResponseMs)} <small>ms</small></div><div class="dash-lbl">ตอบสนองเฉลี่ย · ช้าสุด ${dashMs(k.maxResponseMs)}</div></div>
            <div class="dash-card"><div class="dash-val" style="${k.errorRate5xx > 1 ? 'color:var(--rose-600)' : ''}">${k.errorRate5xx}%</div><div class="dash-lbl">คำขอที่ error (5xx) ${dashNum(k.errors5xx)} · 4xx ${k.errorRate4xx}%</div></div>
            <div class="dash-card"><div class="dash-val">${dashNum(k.sessionCount)}</div><div class="dash-lbl">ล็อกอินค้างอยู่ตอนนี้ (session ยังไม่หมดอายุ)</div></div>
        </div>

        <div class="dash-card" style="margin-top:1rem">
            <div class="dash-card-h-row"><p class="dash-card-h">การสมัครสมาชิกต่อวัน</p><span class="dash-legend"><span><i class="dash-c-brand"></i>พี่ค่าย</span><span><i class="dash-c-blue"></i>น้องค่าย</span></span></div>
            ${dashStackedBarChart({ series: [{ values: r.byDay.map((x) => x.participant), cls: 'blue' }, { values: r.byDay.map((x) => x.staff), cls: '' }], labels: dayLabels, labelEvery, markers })}
            <div class="dash-pills">
                <span class="dash-pill">สมัครในช่วงนี้ <b>${dashNum(r.total)} คน</b> (พี่ค่าย ${dashNum(r.staff)} · น้องค่าย ${dashNum(r.participant)})</span>
                <span class="dash-pill">ทั้งระบบ: อนุมัติแล้ว <b>${dashNum(r.approved)}</b> · รออนุมัติ <b>${dashNum(r.pending)}</b> · ไม่อนุมัติ <b>${dashNum(r.rejected)}</b></span>
                ${r.peakDay ? `<span class="dash-pill">วันที่สมัครเยอะสุด <b>${dashDay(r.peakDay.day)} (${r.peakDay.staff + r.peakDay.participant} คน)</b></span>` : ''}
                <span class="dash-pill${otpPct >= 80 ? ' warn' : ''}">อีเมล OTP วันนี้ <b>${dashNum(r.otpSentToday)} / ${dashNum(r.otpDailyQuota)}</b>${r.otpRejectedToday ? ` · ถูกจำกัด ${r.otpRejectedToday}` : ''}</span>
            </div>
            <p class="dash-note">เส้นประ = วันแรกที่เริ่มมีพี่ค่าย/น้องค่ายสมัครในช่วงนี้ · ใช้ประเมินว่าควรเปิดรับล่วงหน้ากี่วัน และวันไหนโควตาอีเมล OTP (Gmail 500 ฉบับ/วัน) เสี่ยงเต็ม · น้องค่ายรุ่นก่อนถูกลบตอนสร้างค่ายใหม่ ตัวเลขการสมัครจึงมีเฉพาะค่ายปัจจุบัน</p>
        </div>

        <div class="dash-grid dash-grid-2" style="margin-top:1rem">
            <div class="dash-card">
                <div class="dash-card-h-row"><p class="dash-card-h">คำขอรายชั่วโมง · 24 ชั่วโมงล่าสุด</p><span class="dash-legend"><span><i class="dash-c-brand"></i>API</span><span><i class="dash-c-slate"></i>หน้าเว็บ</span></span></div>
                ${dashStackedBarChart({ series: [{ values: d.hourly24h.map((h) => h.apiRequests), cls: '' }, { values: d.hourly24h.map((h) => h.pageViews), cls: 'slate' }], labels: hourlyLabels, labelEvery: 3 })}
                <div class="dash-pills">
                    <span class="dash-pill">ชั่วโมงที่ใช้มากสุด (${rangeLabel[d.range.key]}) <b>${String(k.peakHour).padStart(2, '0')}:00–${String((k.peakHour + 1) % 24).padStart(2, '0')}:00</b></span>
                    <span class="dash-pill">ผู้ใช้พร้อมกันสูงสุดใน 1 ชม. <b>${dashNum(k.peakActiveUsers)} คน</b></span>
                </div>
            </div>
            <div class="dash-card">
                <div class="dash-card-h-row"><p class="dash-card-h">ผู้ใช้ที่เข้าใช้ต่อวัน</p><span class="dash-legend"><span><i class="dash-c-green"></i>ผู้ใช้ไม่ซ้ำ</span><span><i class="dash-c-dark"></i>คำขอ API (÷100)</span></span></div>
                ${dashLineChart({ values: d.activeByDay.map((x) => x.total), labels: dayLabels, labelEvery, extra: { values: d.requestsByDay.map((x) => Math.round(x.apiRequests / 100)), cls: 'dark' } })}
                <div class="dash-pills">
                    <span class="dash-pill">น้องค่ายเข้าใช้ <b>${dashNum(Math.max(0, ...d.activeByDay.map((x) => x.participant)))}</b> คน/วัน (สูงสุด)</span>
                    <span class="dash-pill">พี่ค่ายเข้าใช้ <b>${dashNum(Math.max(0, ...d.activeByDay.map((x) => x.staff)))}</b> คน/วัน (สูงสุด)</span>
                </div>
            </div>
        </div>

        <div class="dash-grid dash-grid-3" style="margin-top:1rem">
            <div class="dash-card">
                <p class="dash-card-h">ช่วงเวลาที่ใช้งาน (วัน × ชั่วโมง)</p>
                ${dashHeatmap(d.heatmap)}
                <p class="dash-note">สีเข้ม = คำขอเยอะ ใช้ดูว่าควรตั้งเวลาสำรองข้อมูล/ปิดปรับปรุงช่วงไหน</p>
            </div>
            <div class="dash-card">
                <p class="dash-card-h">ใครใช้ · ใช้จากอะไร</p>
                ${dashBarRows(breakdownRoles.map((x) => ({ ...x, count: x.count })), { tight: true })}
                ${totalBreakdown === 0 ? '' : `
                <div class="dash-split" style="margin-top:1rem"><i class="dash-c-brand" style="width:${dashPct(d.breakdown.devices.mobile, totalBreakdown)}%"></i><i class="dash-c-slate" style="width:${dashPct(d.breakdown.devices.desktop, totalBreakdown)}%"></i></div>
                <div class="dash-legend"><span><i class="dash-c-brand"></i>มือถือ/แท็บเล็ต ${dashPct(d.breakdown.devices.mobile, totalBreakdown)}%</span><span><i class="dash-c-slate"></i>คอมพิวเตอร์ ${dashPct(d.breakdown.devices.desktop, totalBreakdown)}%</span></div>
                <div class="dash-pills">${browsers.map(([name, count]) => `<span class="dash-pill">${name} <b>${dashPct(count, totalBrowser)}%</b></span>`).join('')}</div>`}
            </div>
            <div class="dash-card">
                <p class="dash-card-h">ฐานข้อมูล &amp; พื้นที่เก็บไฟล์</p>
                ${dashKv([
                    ['ขนาดฐานข้อมูล (Postgres)', `${dashBytes(db.databaseBytes)}${weeklyGrowth ? ` <span class="dash-delta${db.weeklyGrowthBytes < 0 ? ' down' : ''}">${weeklyGrowth}/สัปดาห์</span>` : ''}`],
                    ['โตใน 30 วัน', dashSignedBytes(db.monthlyGrowthBytes) || '<span style="color:var(--slate-400)">รอ snapshot สะสม</span>'],
                    ['ไฟล์รูปภาพบน Google Drive', db.storageConfigured ? `${dashNum(db.storageFileCount)} ไฟล์ · ${dashBytes(db.storageBytes)}${db.storageWeeklyGrowthBytes ? ` <span class="dash-delta">${dashSignedBytes(db.storageWeeklyGrowthBytes)}/สัปดาห์</span>` : ''}` : 'ยังไม่ตั้งค่า'],
                    ['แถวข้อมูลรวม (ประมาณ)', dashNum(Math.round(db.totalRows))],
                    ['การเชื่อมต่อ DB ที่ใช้อยู่', db.connectionCount === null ? '-' : dashNum(db.connectionCount)],
                    ['หน่วยความจำเซิร์ฟเวอร์', `${dashBytes(db.serverRssBytes)} · uptime ${dashDuration(db.uptimeSeconds)}`],
                ])}
                <p class="dash-card-h" style="margin:1rem 0 .5rem">ตารางที่ใหญ่สุด</p>
                ${dashBarRows(db.tables.slice(0, 5).map((t) => ({ name: t.table, count: t.bytes })), { cls: 'rose', tight: true, format: dashBytes })}
            </div>
        </div>

        <div class="dash-grid dash-grid-2" style="margin-top:1rem">
            <div class="dash-card">
                <div class="dash-card-h-row"><p class="dash-card-h">ฟีเจอร์ที่ถูกใช้มากที่สุด</p><span class="dash-chip">${dashNum(d.endpoints.distinct)} endpoint ที่มีการเรียก</span></div>
                ${endpointTable(d.endpoints.top, 'top')}
            </div>
            <div class="dash-card">
                <div class="dash-card-h-row"><p class="dash-card-h">Endpoint ที่ช้าที่สุด</p><span class="dash-chip">นับเฉพาะที่เรียก ≥ 3 ครั้ง</span></div>
                ${endpointTable(d.endpoints.slowest, 'slow')}
                <p class="dash-note">ใช้ชี้ว่าควรเพิ่ม index/ปรับ query ตรงไหน หรือแผนฐานข้อมูล/โฮสติ้งที่ใช้อยู่เริ่มไม่พอ${d.endpoints.errors.length ? ` · <span style="color:var(--rose-600)">มี error 5xx ที่ ${d.endpoints.errors.map((e) => escapeHtml(e.route)).join(', ')}</span>` : ''}</p>
            </div>
        </div>

        <div class="dash-grid dash-grid-2" style="margin-top:1rem">
            <div class="dash-card">
                <div class="dash-card-h-row"><p class="dash-card-h">ขนาดฐานข้อมูลรายวัน (KB)</p><span class="dash-chip">snapshot ${dbHistory.length} วัน</span></div>
                ${dbChart}
            </div>
            <div class="dash-card">
                <div class="dash-card-h-row"><p class="dash-card-h">เปรียบเทียบข้ามค่าย</p><span class="dash-chip">จากสถิติที่เก็บสะสม</span></div>
                ${camps.length === 0 ? dashEmpty('ยังไม่มีค่ายในระบบ') : `<div class="dash-table-wrap"><table class="dash-table">
                    <tr><th>ค่าย</th><th class="dash-num">ผู้ใช้ไม่ซ้ำ</th><th class="dash-num">DAU สูงสุด</th><th class="dash-num">คำขอ API</th><th class="dash-num">พีค</th><th class="dash-num">DB โต</th><th class="dash-num">ไฟล์เพิ่ม</th><th class="dash-num">5xx</th></tr>
                    ${camps.map((c) => `<tr><td class="dash-strong">ครั้งที่ ${c.generationNo} ${c.isEnded ? dashTag('จบแล้ว', 'muted') : dashTag('กำลังดำเนิน', 'ok')}<span class="dash-table-sub">${dashDay(c.startDay)}${c.endDay ? ` – ${dashDay(c.endDay)}` : ' – ปัจจุบัน'}</span></td><td class="dash-num">${dashNum(c.uniqueUsers)}</td><td class="dash-num">${dashNum(c.peakDau)}</td><td class="dash-num">${dashNum(c.apiRequests)}</td><td class="dash-num">${c.peakHour === null ? '-' : `${String(c.peakHour).padStart(2, '0')}:00`}</td><td class="dash-num">${dashSignedBytes(c.dbGrowthBytes) || '-'}</td><td class="dash-num">${dashSignedBytes(c.storageGrowthBytes) || '-'}</td><td class="dash-num">${dashNum(c.errors5xx)}</td></tr>`).join('')}
                </table></div>`}
                <p class="dash-note">ค่ายก่อนหน้าที่จัดก่อนเริ่มเก็บสถิติจะแสดงเป็น 0 · การโตของ DB/ไฟล์คำนวณจาก snapshot รายวันตั้งแต่วันสร้างค่ายจนวันสร้างค่ายถัดไป</p>
            </div>
        </div>
    `;
}

const DASHBOARD_RENDERERS = {
    overview: renderDashboardOverview,
    people: renderDashboardPeople,
    academic: renderDashboardAcademic,
    activities: renderDashboardActivities,
    system: renderDashboardSystem,
    usage: renderDashboardUsage,
};
