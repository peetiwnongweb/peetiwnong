// ส่งออกรายชื่อน้องค่าย (ชื่อเล่น ชื่อ-นามสกุล ชั้น คอร์ส เดือนเกิด): พิมพ์ทีละหน้า A4 หรือดาวน์โหลด CSV
(function () {
    const ROWS_PER_PAGE = 25;
    const GRADE_ORDER = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
    const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const SORT_LABELS = { course: 'คอร์ส', birthMonth: 'เดือนเกิด', grade: 'ชั้น', name: 'ชื่อ', nickname: 'ชื่อเล่น' };

    function escapeText(value) {
        return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    // วันเกิดเป็น { month: 0-11, day } หรือ null ถ้าไม่มีข้อมูล
    function birthParts(item) {
        if (!item.birthDate) return null;
        const d = new Date(item.birthDate);
        return Number.isNaN(d.getTime()) ? null : { month: d.getMonth(), day: d.getDate() };
    }

    function toRows(items, sortBy) {
        const gradeIndex = (g) => {
            const i = GRADE_ORDER.indexOf(g);
            return i === -1 ? 99 : i;
        };
        const text = (a, b) => String(a || '').localeCompare(String(b || ''), 'th');
        const byCourse = (a, b) => text(a.courseFormat?.name, b.courseFormat?.name);
        const byGrade = (a, b) => gradeIndex(a.gradeLevel) - gradeIndex(b.gradeLevel);
        const byName = (a, b) => text(a.firstName, b.firstName) || text(a.lastName, b.lastName);
        const byBirth = (a, b) => {
            const x = birthParts(a), y = birthParts(b);
            const kx = x ? x.month * 100 + x.day : 9999, ky = y ? y.month * 100 + y.day : 9999;
            return kx - ky;
        };
        const compare = {
            course: (a, b) => byCourse(a, b) || byGrade(a, b) || byName(a, b),
            birthMonth: (a, b) => byBirth(a, b) || byName(a, b),
            grade: (a, b) => byGrade(a, b) || byCourse(a, b) || byName(a, b),
            name: byName,
            nickname: (a, b) => text(a.nickname, b.nickname) || byName(a, b),
        }[sortBy] || ((a, b) => byCourse(a, b) || byGrade(a, b) || byName(a, b));
        return [...items].sort(compare).map((item, i) => {
            const birth = birthParts(item);
            return {
                no: i + 1,
                nickname: item.nickname || '-',
                fullName: [item.prefix, item.firstName, item.lastName].filter(Boolean).join(' ') || '-',
                grade: item.gradeLevel || '-',
                course: item.courseFormat?.name || '-',
                birthMonth: birth ? MONTHS[birth.month] : '-',
                birthDay: birth ? `${birth.day} ${MONTHS[birth.month]}` : '-',
            };
        });
    }

    function warnEmpty(items) {
        if (items && items.length) return false;
        if (typeof showToast === 'function') showToast('ไม่มีรายชื่อน้องค่ายให้ส่งออก', true);
        return true;
    }

    function printParticipants(items, sortBy) {
        if (warnEmpty(items)) return;
        const rows = toRows(items, sortBy);
        const win = window.open('', '_blank');
        if (!win) {
            if (typeof showToast === 'function') showToast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัป', true);
            return;
        }
        const dateText = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
        const pages = [];
        for (let p = 0; p < totalPages; p++) {
            const body = rows.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE).map((r) => `
                <tr><td class="c">${r.no}</td><td>${escapeText(r.nickname)}</td><td>${escapeText(r.fullName)}</td><td class="c">${escapeText(r.grade)}</td><td>${escapeText(r.course)}</td><td>${escapeText(r.birthDay)}</td></tr>`).join('');
            pages.push(`
            <section class="page">
                <header>
                    <div><h1>รายชื่อน้องค่าย</h1><p>ค่ายพี่ติวน้อง · ทั้งหมด ${rows.length} คน · เรียงตาม${SORT_LABELS[sortBy] || SORT_LABELS.course}</p></div>
                    <p>พิมพ์เมื่อ ${dateText}</p>
                </header>
                <table>
                    <thead><tr><th class="c" style="width:11mm">ลำดับ</th><th style="width:22mm">ชื่อเล่น</th><th>ชื่อ-นามสกุล</th><th class="c" style="width:12mm">ชั้น</th><th style="width:34mm">คอร์ส</th><th style="width:28mm">วันเกิด</th></tr></thead>
                    <tbody>${body}</tbody>
                </table>
                <footer>หน้า ${p + 1} / ${totalPages}</footer>
            </section>`);
        }
        win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายชื่อน้องค่าย</title>
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

    function downloadParticipantsCsv(items, sortBy) {
        if (warnEmpty(items)) return;
        const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const lines = [['ลำดับ', 'ชื่อเล่น', 'ชื่อ-นามสกุล', 'ชั้น', 'คอร์ส', 'เดือนเกิด', 'วันเกิด'].map(quote).join(',')]
            .concat(toRows(items, sortBy).map((r) => [r.no, r.nickname, r.fullName, r.grade, r.course, r.birthMonth, r.birthDay].map(quote).join(',')));
        // ใส่ BOM เพื่อให้ Excel อ่านภาษาไทยถูก
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const now = new Date();
        const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `รายชื่อน้องค่าย-${stamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    window.printParticipants = printParticipants;
    window.downloadParticipantsCsv = downloadParticipantsCsv;
})();
