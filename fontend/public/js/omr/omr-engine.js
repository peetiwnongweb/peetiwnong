// ตัวตรวจกระดาษคำตอบแบบฝน (OMR) ของระบบสอบวัดผล - ไม่พึ่ง DOM ใช้ได้ทั้งในเบราว์เซอร์และ Node (ไว้ทดสอบ)
// 1) computeLayout(exam): ตำแหน่งทุกอย่างบนกระดาษ A4 หน่วยมิลลิเมตร (ใช้ร่วมกันทั้งตอนพิมพ์และตอนสแกน ต้องตรงกันเสมอ)
// 2) scanSheet(gray, layout): หาสี่เหลี่ยมดำ 4 มุม -> homography -> อ่านความเข้มของทุกวง -> คำตอบ + รหัสประจำตัวที่ฝน
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PTNOmr = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const PAGE_W = 210;
    const PAGE_H = 297;
    const FIDUCIAL = 10;              // ขนาดสี่เหลี่ยมดำมุมกระดาษ (มม.)
    const FIDUCIAL_CENTERS = [[15, 15], [195, 15], [195, 282], [15, 282]]; // TL TR BR BL
    const BUBBLE_D = 4.4;             // เส้นผ่านศูนย์กลางวง (มม.)
    const CHOICE_GAP = 5.8;           // ระยะห่างวงในข้อเดียวกัน
    const ROW_H = 6.1;                // ความสูงต่อแถว
    const ANSWER_TOP = 102;           // ขอบบนพื้นที่คำตอบ
    const ANSWER_BOTTOM = 272;
    const COLUMN_LEFT = 20;
    const COLUMN_W = 43;
    const COLUMNS = 4;
    const ID_DIGITS = 6;
    const ID_LEFT = 118;              // บล็อกฝนรหัสประจำตัว (6 หลัก x 0-9)
    const ID_TOP = 44;                // จุดศูนย์กลางแถวเลข 0
    const ID_COL_GAP = 6;
    const ID_ROW_GAP = 5.1;
    const ID_BUBBLE_D = 4;
    const QR = { x: 160, y: 24, size: 30 };
    const MAX_QUESTIONS = 100;
    const ROWS_PER_COLUMN = Math.floor((ANSWER_BOTTOM - ANSWER_TOP) / ROW_H);

    const CHOICE_LABELS = {
        thai: ['ก', 'ข', 'ค', 'ง', 'จ'],
        latin: ['A', 'B', 'C', 'D', 'E'],
        number: ['1', '2', '3', '4', '5'],
    };

    // exam: { choiceCount: 4|5, choiceStyle, sections: [{ title, questionCount }] }
    // คำถามเลขต่อเนื่องทั้งแผ่น (1..N) แต่ละตอนมีหัวตอนกิน 1 แถว ไหลจากบนลงล่างทีละคอลัมน์
    function computeLayout(exam) {
        const choiceCount = exam.choiceCount === 5 ? 5 : 4;
        const labels = (CHOICE_LABELS[exam.choiceStyle] || CHOICE_LABELS.thai).slice(0, choiceCount);
        const items = [];
        let number = 0;
        (exam.sections || []).forEach((section, sectionIndex) => {
            items.push({ type: 'header', sectionIndex, text: section.title || '' });
            for (let i = 0; i < section.questionCount; i++) {
                number += 1;
                items.push({ type: 'question', sectionIndex, number, indexInSection: i });
            }
        });
        const questions = [];
        const headers = [];
        let col = 0;
        let row = 0;
        let overflow = false;
        items.forEach((item, idx) => {
            // หัวตอนไม่อยู่แถวล่างสุดของคอลัมน์ (ข้อแรกของตอนจะหลุดไปคอลัมน์ถัดไป) - ขึ้นคอลัมน์ใหม่แทน
            if (item.type === 'header' && row >= ROWS_PER_COLUMN - 1 && row > 0) { col += 1; row = 0; }
            if (row >= ROWS_PER_COLUMN) { col += 1; row = 0; }
            if (col >= COLUMNS) { overflow = true; return; }
            const x0 = COLUMN_LEFT + col * COLUMN_W;
            const y = ANSWER_TOP + row * ROW_H + ROW_H / 2;
            if (item.type === 'header') {
                headers.push({ x: x0, y, text: item.text, sectionIndex: item.sectionIndex });
            } else {
                const choices = labels.map((label, c) => ({ x: x0 + 9.5 + c * CHOICE_GAP, y, label }));
                questions.push({ number: item.number, sectionIndex: item.sectionIndex, indexInSection: item.indexInSection, numberX: x0 + 6.2, y, choices });
            }
            row += 1;
            void idx;
        });
        const idBubbles = [];
        for (let d = 0; d < ID_DIGITS; d++) {
            const colBubbles = [];
            for (let v = 0; v < 10; v++) colBubbles.push({ x: ID_LEFT + d * ID_COL_GAP, y: ID_TOP + v * ID_ROW_GAP, label: String(v) });
            idBubbles.push(colBubbles);
        }
        return {
            pageW: PAGE_W,
            pageH: PAGE_H,
            fiducialSize: FIDUCIAL,
            fiducials: FIDUCIAL_CENTERS.map(([x, y]) => ({ x, y })),
            bubbleD: BUBBLE_D,
            idBubbleD: ID_BUBBLE_D,
            qr: QR,
            idBubbles,
            idBoxY: ID_TOP - 7,
            headers,
            questions,
            questionCount: number,
            choiceCount,
            labels,
            overflow,
            capacity: COLUMNS * ROWS_PER_COLUMN,
        };
    }

    // ---------- ภาพ ----------
    function toGray(rgba, width, height) {
        const gray = new Uint8Array(width * height);
        for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
            gray[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
        }
        return { data: gray, width, height };
    }

    function downscale(img, maxW) {
        if (img.width <= maxW) return { img, scale: 1 };
        const scale = img.width / maxW;
        const w = Math.round(img.width / scale);
        const h = Math.round(img.height / scale);
        const out = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            const sy = Math.min(img.height - 1, Math.floor(y * scale));
            for (let x = 0; x < w; x++) {
                // เฉลี่ย 2x2 จุด ลด noise
                const sx = Math.min(img.width - 1, Math.floor(x * scale));
                const sx2 = Math.min(img.width - 1, sx + 1);
                const sy2 = Math.min(img.height - 1, sy + 1);
                out[y * w + x] = (img.data[sy * img.width + sx] + img.data[sy * img.width + sx2] + img.data[sy2 * img.width + sx] + img.data[sy2 * img.width + sx2]) >> 2;
            }
        }
        return { img: { data: out, width: w, height: h }, scale };
    }

    function otsu(data) {
        const hist = new Array(256).fill(0);
        for (let i = 0; i < data.length; i++) hist[data[i]]++;
        const total = data.length;
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * hist[i];
        let sumB = 0, wB = 0, best = 0, threshold = 128;
        for (let t = 0; t < 256; t++) {
            wB += hist[t];
            if (!wB) continue;
            const wF = total - wB;
            if (!wF) break;
            sumB += t * hist[t];
            const mB = sumB / wB, mF = (sum - sumB) / wF;
            const between = wB * wF * (mB - mF) * (mB - mF);
            if (between > best) { best = between; threshold = t; }
        }
        return threshold;
    }

    // threshold แบบปรับตามพื้นที่ (ค่าเฉลี่ยบล็อก) รับมือแสงไม่สม่ำเสมอ/เงา
    function adaptiveBinary(img) {
        const { data, width: w, height: h } = img;
        const integral = new Float64Array((w + 1) * (h + 1));
        for (let y = 0; y < h; y++) {
            let rowSum = 0;
            for (let x = 0; x < w; x++) {
                rowSum += data[y * w + x];
                integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + rowSum;
            }
        }
        const r = Math.max(8, Math.round(Math.min(w, h) / 12));
        const global = otsu(data);
        const out = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
            for (let x = 0; x < w; x++) {
                const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
                const area = (y1 - y0) * (x1 - x0);
                const s = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
                const v = data[y * w + x];
                out[y * w + x] = v < s / area * 0.75 && v < global + 30 ? 1 : 0;
            }
        }
        return out;
    }

    function components(bin, w, h) {
        const labels = new Int32Array(w * h);
        const comps = [];
        const stack = new Int32Array(w * h);
        let next = 1;
        for (let i = 0; i < bin.length; i++) {
            if (!bin[i] || labels[i]) continue;
            let sp = 0;
            stack[sp++] = i;
            labels[i] = next;
            let area = 0, sx = 0, sy = 0, minX = w, minY = h, maxX = 0, maxY = 0;
            while (sp) {
                const p = stack[--sp];
                const x = p % w, y = (p - x) / w;
                area++; sx += x; sy += y;
                if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
                if (x > 0 && bin[p - 1] && !labels[p - 1]) { labels[p - 1] = next; stack[sp++] = p - 1; }
                if (x < w - 1 && bin[p + 1] && !labels[p + 1]) { labels[p + 1] = next; stack[sp++] = p + 1; }
                if (y > 0 && bin[p - w] && !labels[p - w]) { labels[p - w] = next; stack[sp++] = p - w; }
                if (y < h - 1 && bin[p + w] && !labels[p + w]) { labels[p + w] = next; stack[sp++] = p + w; }
            }
            comps.push({ label: next, area, cx: sx / area, cy: sy / area, minX, minY, maxX, maxY });
            next++;
        }
        return { comps, labels };
    }

    // ระยะไกลสุดจากจุดศูนย์กลาง / sqrt(พื้นที่): สี่เหลี่ยมจัตุรัสทึบ ≈ 0.707 ไม่ว่าจะเอียงกี่องศา, วงกลมทึบ (วงที่ฝน) ≈ 0.564
    function squareness(c, labels, w) {
        let maxD2 = 0;
        for (let y = c.minY; y <= c.maxY; y++) {
            for (let x = c.minX; x <= c.maxX; x++) {
                if (labels[y * w + x] !== c.label) continue;
                const d2 = (x - c.cx) * (x - c.cx) + (y - c.cy) * (y - c.cy);
                if (d2 > maxD2) maxD2 = d2;
            }
        }
        return Math.sqrt(maxD2) / Math.sqrt(c.area);
    }

    // หาสี่เหลี่ยมดำ 4 มุม: หาก้อนดำที่เป็นสี่เหลี่ยมจัตุรัสทึบทั้งหมด แล้วเลือก "4 ก้อนที่เรียงกันเป็นรูปกระดาษ" ได้ดีที่สุด
    // (สัดส่วนกว้าง:ยาวใกล้ 180:267, ขนาดก้อนพอ ๆ กันและสัมพันธ์กับขนาดกระดาษ) - ของสีเข้มทรงเหลี่ยมในฉากหลัง/นิ้วที่จับกระดาษจะไม่ถูกเลือก
    // debug (ไม่บังคับ): ใส่ object มาเพื่อรับจำนวนสี่เหลี่ยมที่เห็น (debug.candidates) ไว้บอกผู้ใช้
    function findFiducialCandidates(gray, debug) {
        const { img: small, scale } = downscale(gray, 700);
        const bin = adaptiveBinary(small);
        const { comps, labels } = components(bin, small.width, small.height);
        const minSide = Math.min(small.width, small.height);
        let candidates = comps.filter((c) => {
            const bw = c.maxX - c.minX + 1, bh = c.maxY - c.minY + 1;
            if (bw < Math.max(5, minSide * 0.012) || bw > minSide * 0.16) return false;
            const aspect = bw / bh;
            if (aspect < 0.6 || aspect > 1.67) return false;
            // ทึบพอ (สี่เหลี่ยมเอียง 45° ยังได้ ~0.5) และรูปทรงเป็นสี่เหลี่ยม ไม่ใช่วงกลม/ตัวอักษร (ภาพเบลอทำให้มุมมนลง จึงเผื่อช่วงไว้กว้าง)
            if (c.area / (bw * bh) < 0.42) return false;
            const sq = squareness(c, labels, small.width);
            c.sq = sq;
            return sq > 0.62 && sq < 0.82;
        });
        if (debug) debug.candidates = candidates.length;
        if (candidates.length < 4) return [];
        // จำกัดจำนวนก้อนที่จะลองจับคู่ (เลือกที่เหลี่ยมใกล้อุดมคติที่สุด) กันช้าเวลาภาพรก
        candidates = candidates.sort((a, b) => Math.abs(a.sq - 0.707) - Math.abs(b.sq - 0.707)).slice(0, 22);
        const size = (c) => Math.sqrt(c.area);
        const dist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
        const minArea = small.width * small.height * 0.05;
        const found = [];
        const n = candidates.length;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) for (let l = k + 1; l < n; l++) {
            const quad = [candidates[i], candidates[j], candidates[k], candidates[l]];
            const sizes = quad.map(size);
            const sMin = Math.min(...sizes), sMax = Math.max(...sizes);
            if (sMax > sMin * 1.8) continue;
            // เรียงตามมุมรอบจุดศูนย์กลาง (ตามเข็ม) เริ่มจากซ้ายบน
            const mx = quad.reduce((t, c) => t + c.cx, 0) / 4, my = quad.reduce((t, c) => t + c.cy, 0) / 4;
            quad.sort((a, b) => Math.atan2(a.cy - my, a.cx - mx) - Math.atan2(b.cy - my, b.cx - mx));
            let startIdx = 0;
            quad.forEach((c, idx) => { if (c.cx + c.cy < quad[startIdx].cx + quad[startIdx].cy) startIdx = idx; });
            const q = [0, 1, 2, 3].map((t) => quad[(startIdx + t) % 4]);
            // ต้องเป็นรูปสี่เหลี่ยมนูน
            let sign = 0, convex = true;
            for (let t = 0; t < 4; t++) {
                const a = q[t], b = q[(t + 1) % 4], c = q[(t + 2) % 4];
                const cross = (b.cx - a.cx) * (c.cy - b.cy) - (b.cy - a.cy) * (c.cx - b.cx);
                if (sign === 0) sign = Math.sign(cross); else if (Math.sign(cross) !== sign) { convex = false; break; }
            }
            if (!convex) continue;
            const e = [dist(q[0], q[1]), dist(q[1], q[2]), dist(q[2], q[3]), dist(q[3], q[0])];
            // ด้านตรงข้ามยาวใกล้กัน (เผื่อมุมมองเอียง)
            if (Math.max(e[0], e[2]) > Math.min(e[0], e[2]) * 2 || Math.max(e[1], e[3]) > Math.min(e[1], e[3]) * 2) continue;
            const w = (e[0] + e[2]) / 2, h = (e[1] + e[3]) / 2;
            const ratio = Math.min(w, h) / Math.max(w, h);
            if (ratio < 0.45 || ratio > 0.92) continue;
            // ขนาดสี่เหลี่ยมดำเทียบกับด้านสั้นของกระดาษ (10 มม. ต่อ 180 มม. ≈ 0.056)
            const rel = (sMin + sMax) / 2 / Math.min(w, h);
            if (rel < 0.025 || rel > 0.12) continue;
            const area = Math.abs((q[1].cx - q[0].cx) * (q[3].cy - q[0].cy) - (q[3].cx - q[0].cx) * (q[1].cy - q[0].cy));
            if (area < minArea) continue;
            const score = Math.abs(ratio - 0.674) * 3 + (sMax / sMin - 1) + Math.abs(rel - 0.056) * 10 - area / (small.width * small.height) * 0.5;
            found.push({ score, q });
        }
        found.sort((a, b) => a.score - b.score);
        const quads = found.slice(0, 5).map((x) => x.q);
        // แบบเดิม: ก้อนที่อยู่ริมสุดแต่ละมุม (แม่นเวลาภาพเอียงมาก/ไม่มีของรบกวน)
        const pick = (score) => candidates.reduce((b, c) => (score(c) > score(b) ? c : b));
        const extreme = [pick((c) => -(c.cx + c.cy)), pick((c) => c.cx - c.cy), pick((c) => c.cx + c.cy), pick((c) => c.cy - c.cx)];
        if (new Set(extreme).size === 4) {
            const sizes = extreme.map(size);
            const area = Math.abs((extreme[1].cx - extreme[0].cx) * (extreme[3].cy - extreme[0].cy) - (extreme[3].cx - extreme[0].cx) * (extreme[1].cy - extreme[0].cy));
            if (Math.max(...sizes) <= Math.min(...sizes) * 2.2 && area >= minArea) quads.push(extreme);
        }
        const seen = new Set();
        return quads.filter((q) => {
            const key = q.map((c) => c.label).sort().join(',');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).map((q) => q.map((c) => refineCenter(gray, c.cx * scale, c.cy * scale, (c.maxX - c.minX + 1) * scale)));
    }

    // รูปแบบที่น่าจะเป็นที่สุด (ใช้วาดกรอบ/เช็คความนิ่งตอนเปิดกล้อง) - การตรวจจริงใช้ scan() ที่ยืนยันด้วย QR อีกชั้น
    function findFiducials(gray, debug) {
        const quads = findFiducialCandidates(gray, debug);
        return quads && quads.length ? quads[0] : null;
    }

    // คำนวณจุดศูนย์กลางใหม่บนภาพความละเอียดเต็ม (แม่นกว่าภาพที่ย่อ)
    function refineCenter(gray, cx, cy, size) {
        const { data, width: w, height: h } = gray;
        const r = Math.round(size * 0.9);
        const x0 = Math.max(0, Math.round(cx - r)), x1 = Math.min(w - 1, Math.round(cx + r));
        const y0 = Math.max(0, Math.round(cy - r)), y1 = Math.min(h - 1, Math.round(cy + r));
        const vals = [];
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) vals.push(data[y * w + x]);
        const t = otsu(Uint8Array.from(vals));
        let sx = 0, sy = 0, n = 0;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (data[y * w + x] < t) { sx += x; sy += y; n++; }
        return n ? { x: sx / n, y: sy / n } : { x: cx, y: cy };
    }

    // homography จาก 4 คู่จุด (มม. -> พิกเซล) แก้สมการ 8x8
    function homography(src, dst) {
        const A = [];
        const b = [];
        for (let i = 0; i < 4; i++) {
            const [x, y] = src[i];
            const [u, v] = dst[i];
            A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
            A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
        }
        const n = 8;
        for (let c = 0; c < n; c++) {
            let p = c;
            for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
            [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
            for (let r = 0; r < n; r++) {
                if (r === c) continue;
                const f = A[r][c] / A[c][c];
                for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
                b[r] -= f * b[c];
            }
        }
        const h = b.map((v, i) => v / A[i][i]);
        return (x, y) => {
            const d = h[6] * x + h[7] * y + 1;
            return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
        };
    }

    function sample(gray, x, y) {
        const { data, width: w, height: h } = gray;
        if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return 255;
        const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        const i = y0 * w + x0;
        return data[i] * (1 - fx) * (1 - fy) + data[i + 1] * fx * (1 - fy) + data[i + w] * (1 - fx) * fy + data[i + w + 1] * fx * fy;
    }

    // อ่านวง 1 วง: fill = สัดส่วนจุดในวง (รัศมี 60%) ที่มืดกว่าพื้นกระดาษรอบวงชัดเจน (0-1)
    // depth = ความเข้มเฉลี่ยของรอยในวงเทียบพื้นกระดาษ (0 = ขาว) ใช้แยกรอยฝนจริงออกจากรอยยางลบ/เงาที่จางกว่า
    function bubbleFill(gray, map, cx, cy, d) {
        const r = d / 2;
        const ring = [];
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            const [px, py] = map(cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r * 1.45);
            ring.push(sample(gray, px, py));
        }
        ring.sort((p, q) => p - q);
        const white = ring[Math.floor(ring.length * 0.75)];
        let dark = 0, total = 0, sum = 0;
        const steps = 5;
        for (let i = -steps; i <= steps; i++) {
            for (let j = -steps; j <= steps; j++) {
                const dx = (i / steps) * r * 0.6, dy = (j / steps) * r * 0.6;
                if (dx * dx + dy * dy > (r * 0.6) * (r * 0.6)) continue;
                const [px, py] = map(cx + dx, cy + dy);
                const v = sample(gray, px, py);
                total++;
                sum += v;
                if (v < white * 0.68) dark++;
            }
        }
        if (!total || !white) return { fill: 0, depth: 0 };
        return { fill: dark / total, depth: Math.max(0, 1 - sum / total / white) };
    }

    const FILLED = 0.42;   // ถือว่าฝน
    const FAINT = 0.22;    // ฝนจาง/ลบไม่หมด (ให้ตรวจ)

    // marks: [{ fill, depth }] ของทุกตัวเลือกในข้อ - เลือกได้ต้องทึบพอ และเข้มใกล้เคียงรอยที่เข้มที่สุดในข้อ (ฝน 2 ช่องจริงเข้มพอ ๆ กัน รอยยางลบจางกว่ามาก)
    function classify(marks) {
        const fills = marks.map((m) => m.fill);
        const maxDepth = Math.max(...marks.map((m) => m.depth));
        const max = Math.max(...fills);
        const selected = marks.map((m, i) => (m.fill >= FILLED && m.depth >= maxDepth * 0.6 ? i : -1)).filter((i) => i >= 0);
        let flag = null;
        if (selected.length > 1) flag = 'multiple';
        else if (!selected.length && max >= FAINT) flag = 'faint';
        else if (selected.length === 1) {
            const others = fills.filter((_, i) => i !== selected[0]);
            if (others.some((f) => f >= FAINT)) flag = 'faint';
        } else flag = 'blank';
        return { selected, flag };
    }

    // gray: { data: Uint8Array, width, height } - คืน null ถ้าหามุมกระดาษไม่เจอ
    function scanSheet(gray, layout, corners) {
        const found = corners || findFiducials(gray);
        if (!found) return null;
        const map = homography(layout.fiducials.map((f) => [f.x, f.y]), found.map((p) => [p.x, p.y]));
        const answers = layout.questions.map((q) => {
            const marks = q.choices.map((c) => bubbleFill(gray, map, c.x, c.y, layout.bubbleD));
            const { selected, flag } = classify(marks);
            return { number: q.number, selected, flag, fills: marks.map((m) => Math.round(m.fill * 100) / 100) };
        });
        const idDigits = layout.idBubbles.map((col) => {
            const marks = col.map((b) => bubbleFill(gray, map, b.x, b.y, layout.idBubbleD));
            const { selected, flag } = classify(marks);
            return { digit: selected.length === 1 ? selected[0] : null, flag };
        });
        const idFilled = idDigits.some((d) => d.digit !== null || d.flag === 'multiple');
        const studentCode = idDigits.every((d) => d.digit !== null) ? idDigits.map((d) => d.digit).join('') : null;
        return { corners: found, map, answers, studentCode, idFilled, idDigits };
    }

    // ตัดภาพบริเวณ QR ให้ตรงหน้า (ไว้ส่งให้ jsQR) - คืน RGBA
    function warpRegion(gray, map, x, y, w, h, pxPerMm) {
        const ow = Math.round(w * pxPerMm), oh = Math.round(h * pxPerMm);
        const out = new Uint8ClampedArray(ow * oh * 4);
        for (let j = 0; j < oh; j++) {
            for (let i = 0; i < ow; i++) {
                const [px, py] = map(x + i / pxPerMm, y + j / pxPerMm);
                const v = sample(gray, px, py);
                const k = (j * ow + i) * 4;
                out[k] = out[k + 1] = out[k + 2] = v; out[k + 3] = 255;
            }
        }
        return { data: out, width: ow, height: oh };
    }

    function readQr(gray, map, layout, jsQR) {
        if (!jsQR) return null;
        const pad = 4;
        const region = warpRegion(gray, map, layout.qr.x - pad, layout.qr.y - pad, layout.qr.size + pad * 2, layout.qr.size + pad * 2, 8);
        const code = jsQR(region.data, region.width, region.height, { inversionAttempts: 'dontInvert' });
        return code ? code.data : null;
    }

    // สแกนเต็มขั้น: หามุม -> ลองทุกทิศ (กระดาษกลับหัว/หมุน) เลือกทิศที่อ่าน QR ได้ -> อ่านคำตอบ
    // คืน { ...scanSheet, qrText } หรือ null ถ้าหามุมไม่เจอ (qrText null = อ่าน QR ไม่ได้ ใช้ทิศปกติ)
    function scan(gray, layout, jsQR) {
        const quads = findFiducialCandidates(gray);
        if (!quads.length) return null;
        const orders = [[0, 1, 2, 3], [2, 3, 0, 1], [1, 2, 3, 0], [3, 0, 1, 2]];
        // QR อยู่ตำแหน่งตายตัวเทียบกับ 4 มุม - ถ้าจับมุมผิด (ของในฉากหลัง/รูปสี่เหลี่ยมอื่น) จะอ่าน QR ไม่ได้ จึงใช้ยืนยันว่าเลือกถูก
        for (const found of quads) {
            for (const order of orders) {
                const corners = order.map((i) => found[i]);
                const map = homography(layout.fiducials.map((f) => [f.x, f.y]), corners.map((p) => [p.x, p.y]));
                const qrText = readQr(gray, map, layout, jsQR);
                if (qrText) return { ...scanSheet(gray, layout, corners), qrText };
            }
        }
        return { ...scanSheet(gray, layout, quads[0]), qrText: null };
    }

    // QR บนกระดาษ: "PTN-EX:<examId>:<participantProfileId>" (0 = ใบเปล่า ใช้รหัสที่ฝน)
    function parseQr(text) {
        const m = /^PTN-EX:(\d+):(\d+)$/.exec(String(text || '').trim());
        return m ? { examId: Number(m[1]), participantProfileId: Number(m[2]) } : null;
    }

    // ตรวจคำตอบกับเฉลย - key[i]: array ของ index ตัวเลือกที่ถูก หรือ '*' = ข้อที่ตัดทิ้ง (ได้คะแนนทุกคน)
    // คืนคะแนนรายตอน (correct/total/points/maxPoints) - ข้อที่ฝนหลายช่องถือว่าผิด
    function grade(exam, answers) {
        const key = exam.answerKey || [];
        let qIndex = 0;
        const sections = (exam.sections || []).map((section) => {
            let correct = 0;
            for (let i = 0; i < section.questionCount; i++, qIndex++) {
                const k = key[qIndex];
                const a = answers[qIndex] || [];
                if (k === '*') correct++;
                else if (Array.isArray(k) && k.length && a.length === 1 && k.includes(a[0])) correct++;
            }
            const per = Number(section.pointsPerQuestion) || 1;
            return { subjectId: section.subjectId, correct, total: section.questionCount, points: correct * per, maxPoints: section.questionCount * per };
        });
        return { sections, totalPoints: sections.reduce((s, x) => s + x.points, 0), maxPoints: sections.reduce((s, x) => s + x.maxPoints, 0) };
    }

    return { computeLayout, toGray, findFiducials, scanSheet, scan, readQr, parseQr, grade, homography, CHOICE_LABELS, MAX_QUESTIONS };
});
