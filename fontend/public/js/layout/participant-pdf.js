// ส่งออกรายชื่อน้องค่ายเป็นไฟล์ PDF (ชื่อเล่น ชื่อ-นามสกุล ชั้น คอร์ส)
// วาดหน้า A4 เป็น HTML แล้วแปลงด้วย html2canvas + jsPDF เพื่อให้ฟอนต์ไทยแสดงถูกต้อง
(function () {
    const LIBS = [
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    ];
    const ROWS_PER_PAGE = 28;
    const GRADE_ORDER = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`โหลด ${src} ไม่สำเร็จ`));
            document.head.appendChild(script);
        });
    }

    function escapeText(value) {
        return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    function sortParticipants(items) {
        const gradeIndex = (g) => {
            const i = GRADE_ORDER.indexOf(g);
            return i === -1 ? 99 : i;
        };
        return [...items].sort((a, b) =>
            String(a.courseFormat?.name || '').localeCompare(String(b.courseFormat?.name || ''), 'th')
            || gradeIndex(a.gradeLevel) - gradeIndex(b.gradeLevel)
            || String(a.firstName || '').localeCompare(String(b.firstName || ''), 'th'));
    }

    function buildPage(rows, startNo, pageNo, totalPages, total, dateText) {
        const page = document.createElement('div');
        page.style.cssText = 'width:794px;height:1123px;padding:56px 56px 40px;box-sizing:border-box;background:#fff;color:#111;'
            + "font-family:'Sarabun','Prompt',sans-serif;display:flex;flex-direction:column;";
        const body = rows.map((item, i) => {
            const fullName = [item.prefix, item.firstName, item.lastName].filter(Boolean).join(' ') || '-';
            const bg = i % 2 ? '#f6f7fb' : '#fff';
            return `<tr style="background:${bg}">
                <td style="padding:7px 10px;text-align:center;border-bottom:1px solid #e5e7eb">${startNo + i}</td>
                <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${escapeText(item.nickname || '-')}</td>
                <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${escapeText(fullName)}</td>
                <td style="padding:7px 10px;text-align:center;border-bottom:1px solid #e5e7eb">${escapeText(item.gradeLevel || '-')}</td>
                <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${escapeText(item.courseFormat?.name || '-')}</td>
            </tr>`;
        }).join('');
        page.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #26324a;padding-bottom:10px;margin-bottom:14px">
                <div>
                    <div style="font-family:'Prompt',sans-serif;font-size:22px;font-weight:600;color:#26324a">รายชื่อน้องค่าย</div>
                    <div style="font-size:14px;color:#555">ค่ายพี่ติวน้อง · ทั้งหมด ${total} คน</div>
                </div>
                <div style="font-size:13px;color:#555">พิมพ์เมื่อ ${dateText}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:15px">
                <thead>
                    <tr style="background:#26324a;color:#fff">
                        <th style="padding:8px 10px;width:56px;font-weight:600">ลำดับ</th>
                        <th style="padding:8px 10px;text-align:left;width:110px;font-weight:600">ชื่อเล่น</th>
                        <th style="padding:8px 10px;text-align:left;font-weight:600">ชื่อ-นามสกุล</th>
                        <th style="padding:8px 10px;width:70px;font-weight:600">ชั้น</th>
                        <th style="padding:8px 10px;text-align:left;width:170px;font-weight:600">คอร์ส</th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
            <div style="margin-top:auto;text-align:right;font-size:12px;color:#777">หน้า ${pageNo} / ${totalPages}</div>`;
        return page;
    }

    async function exportParticipantsPdf(items, button) {
        if (!items || !items.length) {
            if (typeof showToast === 'function') showToast('ไม่มีรายชื่อน้องค่ายให้ส่งออก', true);
            return;
        }
        const originalText = button ? button.textContent : '';
        if (button) { button.disabled = true; button.textContent = 'กำลังสร้าง PDF...'; }
        const holder = document.createElement('div');
        holder.style.cssText = 'position:fixed;left:-10000px;top:0;';
        document.body.appendChild(holder);
        try {
            for (const src of LIBS) await loadScript(src);
            if (document.fonts && document.fonts.ready) await document.fonts.ready;

            const sorted = sortParticipants(items);
            const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
            const now = new Date();
            const dateText = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
            const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            for (let p = 0; p < totalPages; p++) {
                const rows = sorted.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
                const page = buildPage(rows, p * ROWS_PER_PAGE + 1, p + 1, totalPages, sorted.length, dateText);
                holder.innerHTML = '';
                holder.appendChild(page);
                const canvas = await window.html2canvas(page, { scale: 2, backgroundColor: '#ffffff' });
                if (p > 0) pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
            }
            const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            pdf.save(`รายชื่อน้องค่าย-${stamp}.pdf`);
        } catch (error) {
            console.error('ส่งออก PDF ไม่สำเร็จ:', error);
            if (typeof showToast === 'function') showToast('ส่งออก PDF ไม่สำเร็จ', true);
        } finally {
            holder.remove();
            if (button) { button.disabled = false; button.textContent = originalText; }
        }
    }

    window.exportParticipantsPdf = exportParticipantsPdf;
})();
