// วาดกระดาษคำตอบเป็น SVG (หน่วย มม. บน A4) จาก layout ของ omr-engine.js - ใช้ตอนพิมพ์ และใช้สร้างภาพจำลองไว้ทดสอบตัวตรวจ
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PTNOmrSheet = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const FONT = "Sarabun, 'Leelawadee UI', Tahoma, sans-serif";

    function esc(v) {
        return String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    function text(x, y, value, size, opts = {}) {
        return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${opts.bold ? 700 : 400}" fill="${opts.fill || '#111'}" text-anchor="${opts.anchor || 'start'}" dominant-baseline="${opts.baseline || 'alphabetic'}">${esc(value)}</text>`;
    }

    // qrSvg: สตริง <svg ...> ของ QR (จาก lib qrcode) ฝังลงตำแหน่ง layout.qr
    // info: { title, examTitle, sectionsText, participant: { fullName, code, nickname, course } | null }
    // fill (ทดสอบเท่านั้น): { answers: [[choiceIdx]], idCode: '280052', shade: 70 } วาดรอยฝนลงไปด้วย
    function renderSheetSvg(layout, info, qrSvg, fill) {
        const parts = [];
        parts.push(`<rect width="210" height="297" fill="#fff"/>`);
        layout.fiducials.forEach((f) => {
            const s = layout.fiducialSize;
            parts.push(`<rect x="${f.x - s / 2}" y="${f.y - s / 2}" width="${s}" height="${s}" fill="#000"/>`);
        });

        // หัวกระดาษ
        parts.push(text(24, 28, 'กระดาษคำตอบ', 6.2, { bold: true }));
        parts.push(text(24, 35, info.examTitle || '', 4.2, { bold: true }));
        if (info.sectionsText) parts.push(text(24, 41, info.sectionsText, 3, { fill: '#444' }));
        const p = info.participant;
        parts.push(text(24, 52, 'ชื่อ-นามสกุล', 3.4));
        parts.push(`<line x1="44" y1="52.6" x2="110" y2="52.6" stroke="#888" stroke-width="0.2" stroke-dasharray="0.6 0.6"/>`);
        if (p) parts.push(text(46, 51.6, p.fullName + (p.nickname ? ` (${p.nickname})` : ''), 3.6, { bold: true }));
        parts.push(text(24, 60, 'คอร์ส', 3.4));
        parts.push(`<line x1="34" y1="60.6" x2="110" y2="60.6" stroke="#888" stroke-width="0.2" stroke-dasharray="0.6 0.6"/>`);
        if (p) parts.push(text(36, 59.6, p.course || '', 3.6, { bold: true }));
        parts.push(text(24, 68, 'รหัสประจำตัว', 3.4));
        parts.push(`<line x1="45" y1="68.6" x2="110" y2="68.6" stroke="#888" stroke-width="0.2" stroke-dasharray="0.6 0.6"/>`);
        if (p) parts.push(text(47, 67.6, p.code || '', 3.6, { bold: true }));

        // คำชี้แจง
        const notes = p
            ? ['ใช้ดินสอ 2B ฝนให้เต็มวงและเข้ม', 'ต้องการเปลี่ยนคำตอบให้ลบให้สะอาด', 'ห้ามขีดเขียนหรือพับบริเวณสี่เหลี่ยมดำ 4 มุมและ QR']
            : ['ใบนี้ไม่มีชื่อ ต้องเขียนชื่อและฝนรหัสประจำตัว 6 หลักด้านขวา', 'ใช้ดินสอ 2B ฝนให้เต็มวง ลบให้สะอาด', 'ห้ามขีดเขียนบริเวณสี่เหลี่ยมดำ 4 มุมและ QR'];
        notes.forEach((n, i) => parts.push(text(24, 78 + i * 4.6, `• ${n}`, 2.9, { fill: '#444' })));

        // บล็อกฝนรหัส (ใบรายคนพิมพ์รหัสให้ในช่องด้านบน ไม่ต้องฝน)
        const idX0 = layout.idBubbles[0][0].x - 3.4, idX1 = layout.idBubbles[layout.idBubbles.length - 1][0].x + 3.4;
        parts.push(text((idX0 + idX1) / 2, 30, p ? 'รหัส (ไม่ต้องฝน)' : 'ฝนรหัสประจำตัว', 2.8, { anchor: 'middle', fill: '#444' }));
        layout.idBubbles.forEach((col, d) => {
            const cx = col[0].x;
            parts.push(`<rect x="${cx - 2.6}" y="${layout.idBoxY - 3.2}" width="5.2" height="5" fill="none" stroke="#666" stroke-width="0.25"/>`);
            if (p && p.code) parts.push(text(cx, layout.idBoxY + 0.6, p.code[d] || '', 3.6, { anchor: 'middle', bold: true }));
            col.forEach((b) => {
                parts.push(`<circle cx="${b.x}" cy="${b.y}" r="${layout.idBubbleD / 2}" fill="none" stroke="${p ? '#ccc' : '#555'}" stroke-width="0.25"/>`);
                parts.push(text(b.x, b.y + 0.05, b.label, 2.4, { anchor: 'middle', baseline: 'central', fill: '#c4c4c4' }));
            });
        });

        // QR
        if (qrSvg) {
            const inner = String(qrSvg).replace(/<\?xml[^>]*>/, '').replace(/<svg\b/, `<svg x="${layout.qr.x}" y="${layout.qr.y}" width="${layout.qr.size}" height="${layout.qr.size}"`);
            parts.push(inner);
        }

        // พื้นที่คำตอบ
        parts.push(`<line x1="20" y1="${layout.questions.length ? 97 : 97}" x2="190" y2="97" stroke="#26324a" stroke-width="0.4"/>`);
        layout.headers.forEach((h) => {
            parts.push(`<rect x="${h.x}" y="${h.y - 2.5}" width="40" height="5" rx="1" fill="#eef1f8"/>`);
            parts.push(text(h.x + 1.5, h.y + 0.1, h.text, 3, { bold: true, baseline: 'central', fill: '#26324a' }));
        });
        layout.questions.forEach((q) => {
            parts.push(text(q.numberX, q.y + 0.05, `${q.number}.`, 3, { anchor: 'end', baseline: 'central', bold: true }));
            q.choices.forEach((c) => {
                parts.push(`<circle cx="${c.x}" cy="${c.y}" r="${layout.bubbleD / 2}" fill="none" stroke="#555" stroke-width="0.25"/>`);
                parts.push(text(c.x, c.y + 0.05, c.label, 2.6, { anchor: 'middle', baseline: 'central', fill: '#c4c4c4' }));
            });
        });

        // รอยฝน (ทดสอบ)
        if (fill) {
            const shade = `rgb(${fill.shade},${fill.shade},${fill.shade})`;
            (fill.answers || []).forEach((sel, i) => {
                const q = layout.questions[i];
                if (!q) return;
                (sel || []).forEach((c) => {
                    const ch = q.choices[c];
                    const rr = layout.bubbleD / 2 * (fill.partial && i % 7 === 3 ? 0.65 : 0.92);
                    parts.push(`<circle cx="${ch.x}" cy="${ch.y}" r="${rr}" fill="${shade}"/>`);
                });
            });
            // รอยยางลบไม่หมด (สีจาง) ในวงที่ไม่ได้เลือก ทุก ๆ 5 ข้อ
            if (fill.smudge) {
                layout.questions.forEach((q, i) => {
                    if (i % 5 !== 2) return;
                    const sel = (fill.answers || [])[i] || [];
                    const c = q.choices.findIndex((_, k) => !sel.includes(k));
                    if (c < 0) return;
                    parts.push(`<circle cx="${q.choices[c].x}" cy="${q.choices[c].y}" r="${layout.bubbleD / 2 * 0.85}" fill="rgb(${fill.smudge},${fill.smudge},${fill.smudge})"/>`);
                });
            }
            if (fill.idCode) {
                String(fill.idCode).split('').forEach((digit, d) => {
                    const b = layout.idBubbles[d][Number(digit)];
                    parts.push(`<circle cx="${b.x}" cy="${b.y}" r="${layout.idBubbleD / 2 * 0.92}" fill="${shade}"/>`);
                });
            }
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="210mm" height="297mm">${parts.join('')}</svg>`;
    }

    return { renderSheetSvg };
});
