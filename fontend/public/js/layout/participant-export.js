// ส่งออกรายชื่อ (น้องค่าย / พี่ค่าย): พิมพ์ทีละหน้า A4 หรือดาวน์โหลด CSV เรียงตามที่เลือก
// น้องค่าย: ชื่อเล่น ชื่อ-นามสกุล ชั้น คอร์ส วันเกิด | พี่ค่าย: ชื่อเล่น ชื่อ-นามสกุล ตำแหน่ง ฝ่าย วันเกิด
(function () {
    const ROWS_PER_PAGE = 25;
    const GRADE_ORDER = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
    const POSITION_ORDER = ['ประธานค่าย', 'รองประธานค่าย', 'เลขานุการ', 'หัวหน้าฝ่าย', 'ทีมงาน'];
    const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

    function escapeText(value) {
        return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    // วันเกิดเป็น { month: 0-11, day } หรือ null ถ้าไม่มีข้อมูล
    function birthParts(item) {
        if (!item.birthDate) return null;
        const d = new Date(item.birthDate);
        return Number.isNaN(d.getTime()) ? null : { month: d.getMonth(), day: d.getDate() };
    }

    const orderIndex = (list, value) => {
        const i = list.indexOf(value);
        return i === -1 ? 99 : i;
    };
    const text = (a, b) => String(a || '').localeCompare(String(b || ''), 'th');
    const byName = (a, b) => text(a.firstName, b.firstName) || text(a.lastName, b.lastName);
    const byNickname = (a, b) => text(a.nickname, b.nickname) || byName(a, b);
    const byBirth = (a, b) => {
        const x = birthParts(a), y = birthParts(b);
        const kx = x ? x.month * 100 + x.day : 9999, ky = y ? y.month * 100 + y.day : 9999;
        return kx - ky || byName(a, b);
    };
    const departmentNames = (item) => (item.departments || []).map((d) => d.name).join(', ');

    // ตั้งค่าแต่ละประเภทรายชื่อ: หัวข้อ คอลัมน์ (พิมพ์/CSV) และวิธีเรียง
    const KINDS = {
        participant: {
            title: 'รายชื่อน้องค่าย',
            defaultSort: 'course',
            sorts: {
                course: ['คอร์ส', (a, b) => text(a.courseFormat?.name, b.courseFormat?.name) || orderIndex(GRADE_ORDER, a.gradeLevel) - orderIndex(GRADE_ORDER, b.gradeLevel) || byName(a, b)],
                birthMonth: ['เดือนเกิด', byBirth],
                grade: ['ชั้น', (a, b) => orderIndex(GRADE_ORDER, a.gradeLevel) - orderIndex(GRADE_ORDER, b.gradeLevel) || text(a.courseFormat?.name, b.courseFormat?.name) || byName(a, b)],
                name: ['ชื่อ', byName],
                nickname: ['ชื่อเล่น', byNickname],
            },
            columns: [
                { label: 'ชั้น', width: '12mm', center: true, value: (item) => item.gradeLevel || '-' },
                { label: 'คอร์ส', width: '34mm', value: (item) => item.courseFormat?.name || '-' },
            ],
        },
        staff: {
            title: 'รายชื่อพี่ค่าย',
            defaultSort: 'position',
            sorts: {
                position: ['ตำแหน่ง', (a, b) => orderIndex(POSITION_ORDER, a.position?.name) - orderIndex(POSITION_ORDER, b.position?.name) || text(departmentNames(a), departmentNames(b)) || byName(a, b)],
                department: ['ฝ่าย', (a, b) => text(departmentNames(a) || '￿', departmentNames(b) || '￿') || orderIndex(POSITION_ORDER, a.position?.name) - orderIndex(POSITION_ORDER, b.position?.name) || byName(a, b)],
                birthMonth: ['เดือนเกิด', byBirth],
                name: ['ชื่อ', byName],
                nickname: ['ชื่อเล่น', byNickname],
            },
            columns: [
                { label: 'ตำแหน่ง', width: '28mm', value: (item) => item.position?.name || '-' },
                { label: 'ฝ่าย', width: '40mm', value: (item) => departmentNames(item) || '-' },
            ],
        },
    };

    function toRows(kind, items, sortBy) {
        const config = KINDS[kind];
        const compare = (config.sorts[sortBy] || config.sorts[config.defaultSort])[1];
        return [...items].sort(compare).map((item, i) => {
            const birth = birthParts(item);
            return {
                no: i + 1,
                nickname: item.nickname || '-',
                fullName: [item.prefix, item.firstName, item.lastName].filter(Boolean).join(' ') || '-',
                extra: config.columns.map((c) => c.value(item)),
                birthMonth: birth ? MONTHS[birth.month] : '-',
                birthDay: birth ? `${birth.day} ${MONTHS[birth.month]}` : '-',
            };
        });
    }

    function warnEmpty(kind, items) {
        if (items && items.length) return false;
        if (typeof showToast === 'function') showToast(`ไม่มี${KINDS[kind].title}ให้ส่งออก`, true);
        return true;
    }

    function printList(kind, items, sortBy) {
        if (warnEmpty(kind, items)) return;
        const config = KINDS[kind];
        const sortLabel = (config.sorts[sortBy] || config.sorts[config.defaultSort])[0];
        const rows = toRows(kind, items, sortBy);
        const win = window.open('', '_blank');
        if (!win) {
            if (typeof showToast === 'function') showToast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัป', true);
            return;
        }
        const now = new Date();
        const dateText = `${now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })} เวลา ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`;
        const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
        const extraHeads = config.columns.map((c) => `<th${c.center ? ' class="c"' : ''} style="width:${c.width}">${c.label}</th>`).join('');
        const pages = [];
        for (let p = 0; p < totalPages; p++) {
            const body = rows.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE).map((r) => `
                <tr><td class="c">${r.no}</td><td>${escapeText(r.nickname)}</td><td>${escapeText(r.fullName)}</td>${r.extra.map((v, i) => `<td${config.columns[i].center ? ' class="c"' : ''}>${escapeText(v)}</td>`).join('')}<td>${escapeText(r.birthDay)}</td></tr>`).join('');
            pages.push(`
            <section class="page">
                <header>
                    <div><h1>${config.title}</h1><p>ค่ายพี่ติวน้อง · ทั้งหมด ${rows.length} คน · เรียงตาม${sortLabel}</p></div>
                    <p>พิมพ์เมื่อ ${dateText}</p>
                </header>
                <table>
                    <thead><tr><th class="c" style="width:11mm">ลำดับ</th><th style="width:22mm">ชื่อเล่น</th><th>ชื่อ-นามสกุล</th>${extraHeads}<th style="width:26mm">วันเกิด</th></tr></thead>
                    <tbody>${body}</tbody>
                </table>
                <footer>หน้า ${p + 1} / ${totalPages}</footer>
            </section>`);
        }
        win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${config.title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Prompt:wght@600&family=Sarabun:wght@400;600&display=swap">
<style>
  @page { size: A4 portrait; margin: 12mm 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: 'Sarabun', sans-serif; color: #111; background: #e5e7eb; }
  .page { background: #fff; width: 182mm; height: 272mm; margin: 0 auto; display: flex; flex-direction: column; break-after: page; page-break-after: always; overflow: hidden; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #26324a; padding-bottom: 6px; margin-bottom: 10px; }
  header p { margin: 0; font-size: 12px; color: #555; }
  h1 { margin: 0; font-family: 'Prompt', sans-serif; font-size: 20px; color: #26324a; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #26324a; color: #fff; font-weight: 600; text-align: left; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  tbody tr:nth-child(even) td { background: #f6f7fb; }
  .c { text-align: center; }
  footer { margin-top: auto; text-align: right; font-size: 11px; color: #777; }
  @media screen { body { padding: 12mm 0; } .page { padding: 12mm 14mm; width: 210mm; height: 297mm; margin-bottom: 8mm; box-shadow: 0 2px 10px rgba(0,0,0,.15); } }
</style></head><body>${pages.join('')}
<script>
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { setTimeout(function () { window.print(); }, 200); });
<\/script></body></html>`);
        win.document.close();
    }

    function downloadListCsv(kind, items, sortBy) {
        if (warnEmpty(kind, items)) return;
        const config = KINDS[kind];
        const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const header = ['ลำดับ', 'ชื่อเล่น', 'ชื่อ-นามสกุล', ...config.columns.map((c) => c.label), 'เดือนเกิด', 'วันเกิด'];
        const lines = [header.map(quote).join(',')]
            .concat(toRows(kind, items, sortBy).map((r) => [r.no, r.nickname, r.fullName, ...r.extra, r.birthMonth, r.birthDay].map(quote).join(',')));
        // ใส่ BOM เพื่อให้ Excel อ่านภาษาไทยถูก
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const now = new Date();
        const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${config.title}-${stamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    window.printParticipants = (items, sortBy) => printList('participant', items, sortBy);
    window.downloadParticipantsCsv = (items, sortBy) => downloadListCsv('participant', items, sortBy);
    window.printStaff = (items, sortBy) => printList('staff', items, sortBy);
    window.downloadStaffCsv = (items, sortBy) => downloadListCsv('staff', items, sortBy);
})();
