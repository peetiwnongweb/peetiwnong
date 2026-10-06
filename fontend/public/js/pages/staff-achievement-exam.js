// ==========================================
// แท็บ "สอบวัดผล": ชุดข้อสอบแบบฝนกระดาษคำตอบ -> ใส่เฉลย -> พิมพ์กระดาษ -> สแกนตรวจด้วยกล้อง -> ประกาศผล
// ตัวตรวจ/เลย์เอาต์อยู่ที่ js/omr/omr-engine.js, วาดกระดาษที่ js/omr/omr-sheet.js (ใช้ไฟล์เดียวกับฝั่งเซิร์ฟเวอร์)
// ใช้ตัวแปร/ฟังก์ชันกลางจาก staff-academic.js: courseFormats, subjects, academicTier, showActivitiesToast, showConfirm, Loader
// ==========================================
(function () {
    const API = '/api/achievement-exams';
    const state = {
        exams: [],
        canManage: false,
        exam: null,          // ชุดที่เปิดอยู่
        view: 'key',         // key | print | scan | results | settings
        roster: [],
        submissions: [],
        keyDraft: null,
        stream: null,
        scanTimer: null,
        scanBusy: false,
        stableCount: 0,
        lastCorners: null,
        scanResult: null,    // ผลสแกนล่าสุดที่รอบันทึก
        waitForClear: false, // เพิ่งบันทึก/เจอกระดาษผิดชุด: รอให้เอากระดาษออกจากกล้องก่อนสแกนแผ่นถัดไป (กันสแกนแผ่นเดิมซ้ำ)
    };

    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const toast = (msg, ok) => showActivitiesToast(msg, ok);

    async function api(path, options = {}) {
        const res = await fetch(API + path, {
            ...options,
            headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
        });
        if (res.status === 204) return null;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    }

    function totalQuestions(exam) {
        return exam.sections.reduce((sum, s) => sum + s.questionCount, 0);
    }

    function layoutOf(exam) {
        return PTNOmr.computeLayout({ choiceCount: exam.choiceCount, choiceStyle: exam.choiceStyle, sections: exam.sections });
    }

    function labelsOf(exam) {
        return (PTNOmr.CHOICE_LABELS[exam.choiceStyle] || PTNOmr.CHOICE_LABELS.thai).slice(0, exam.choiceCount);
    }

    // ---------- รายการชุดข้อสอบ ----------
    async function loadExams() {
        try {
            const data = await api('');
            state.exams = data.exams;
            state.canManage = data.canManage;
            renderExamList();
            if (state.exam) {
                const fresh = state.exams.find((e) => e.id === state.exam.id);
                if (fresh) state.exam = fresh; else closeExam();
            }
        } catch (error) {
            console.error(error);
            toast(error.message || 'โหลดชุดข้อสอบไม่สำเร็จ', false);
        }
    }

    function renderExamList() {
        const list = $('ach-exam-list');
        $('ach-create-btn').classList.toggle('hidden', !state.canManage);
        if (!state.exams.length) {
            list.innerHTML = `<p class="activities-empty">${state.canManage ? 'ยังไม่มีชุดข้อสอบ กด "สร้างชุดข้อสอบ" เพื่อเริ่ม' : 'ยังไม่มีชุดข้อสอบที่มีวิชาของคุณ'}</p>`;
            return;
        }
        list.innerHTML = state.exams.map((e) => {
            const keyDone = (e.answerKey || []).filter((k) => k === '*' || (Array.isArray(k) && k.length)).length;
            const total = totalQuestions(e);
            return `<button type="button" class="ach-exam-card${state.exam && state.exam.id === e.id ? ' is-active' : ''}" data-id="${e.id}">
                <span class="ach-exam-card-title">${esc(e.title)}</span>
                <span class="ach-exam-card-meta">คอร์ส${esc(e.courseName)} · ${total} ข้อ · ${e.sections.map((s) => esc(s.title)).join(', ')}</span>
                <span class="ach-exam-card-tags">
                    <span class="ach-tag${keyDone === total ? ' ok' : ''}">เฉลย ${keyDone}/${total}</span>
                    <span class="ach-tag">สแกนแล้ว ${e.submissionCount || 0}/${e.participantCount ?? '-'}</span>
                    ${e.isPublished ? '<span class="ach-tag ok">ประกาศผลแล้ว</span>' : '<span class="ach-tag">ยังไม่ประกาศ</span>'}
                </span>
            </button>`;
        }).join('');
        list.querySelectorAll('.ach-exam-card').forEach((b) => b.addEventListener('click', () => openExam(Number(b.dataset.id))));
    }

    function openExam(id) {
        stopCamera();
        state.exam = state.exams.find((e) => e.id === id) || null;
        state.keyDraft = null;
        state.scanResult = null;
        state.roster = [];
        state.submissions = [];
        renderExamList();
        if (!state.exam) return;
        $('ach-detail').classList.remove('hidden');
        $('ach-detail-title').textContent = state.exam.title;
        $('ach-detail-meta').textContent = `คอร์ส${state.exam.courseName} · ${totalQuestions(state.exam)} ข้อ · ${state.exam.choiceCount} ตัวเลือก${state.exam.isPublished ? ' · ประกาศผลแล้ว' : ''}`;
        document.querySelectorAll('[data-ach-manage]').forEach((el) => el.classList.toggle('hidden', !state.canManage));
        loadRoster();
        switchView(state.view === 'settings' && !state.canManage ? 'key' : state.view);
        $('ach-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeExam() {
        stopCamera();
        state.exam = null;
        $('ach-detail').classList.add('hidden');
        renderExamList();
    }

    async function loadRoster() {
        if (!state.exam) return;
        try {
            const [r, s] = await Promise.all([api(`/${state.exam.id}/roster`), api(`/${state.exam.id}/submissions`)]);
            state.roster = r.participants;
            state.submissions = s.submissions;
            if (state.view === 'results') renderResults();
            if (state.view === 'scan') renderScanProgress();
        } catch (error) {
            console.error(error);
        }
    }

    function switchView(view) {
        if (view !== 'scan') stopCamera();
        state.view = view;
        document.querySelectorAll('.ach-view-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
        document.querySelectorAll('.ach-view').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== view));
        if (view === 'key') renderKey();
        if (view === 'settings') renderExamForm(JSON.parse(JSON.stringify(state.exam))); // สำเนา กันแก้ค้างในตัวจริงถ้ายังไม่กดบันทึก
        if (view === 'results') renderResults();
        if (view === 'scan') renderScanIdle();
        if (view === 'print') renderPrint();
    }

    // ---------- ฟอร์มสร้าง/แก้ชุดข้อสอบ ----------
    function courseSubjects(courseId) {
        return (typeof subjects !== 'undefined' ? subjects : []).filter((s) => s.requiresScoring && (s.courseFormatId === courseId || s.courseFormatId === null));
    }

    function renderExamForm(exam) {
        const wrap = exam ? $('ach-settings-form') : $('ach-create-form');
        const courseId = exam ? exam.courseFormatId : Number(wrap.dataset.courseId || 0);
        const sections = exam ? exam.sections.map((s) => ({ ...s })) : JSON.parse(wrap.dataset.sections || '[]');
        const locked = exam && (exam.submissionCount || 0) > 0;
        const subjectOptions = (selected) => '<option value="">-- เลือกวิชา --</option>' + courseSubjects(courseId).map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
        wrap.innerHTML = `
            <div class="form-grid mb-4">
                <div class="form-group">
                    <label class="form-label">ชื่อชุดข้อสอบ</label>
                    <input type="text" class="form-input" data-f="title" value="${esc(exam ? exam.title : (wrap.dataset.title || 'สอบวัดผลสัมฤทธิ์'))}">
                </div>
                <div class="form-group">
                    <label class="form-label">คอร์ส</label>
                    <select class="form-input" data-f="course" ${exam ? 'disabled' : ''}>
                        <option value="">-- เลือกคอร์ส --</option>
                        ${courseFormats.map((c) => `<option value="${c.id}" ${c.id === courseId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-grid mb-4">
                <div class="form-group">
                    <label class="form-label">จำนวนตัวเลือกต่อข้อ</label>
                    <select class="form-input" data-f="choiceCount" ${locked ? 'disabled' : ''}>
                        <option value="4" ${(exam ? exam.choiceCount : Number(wrap.dataset.choiceCount || 4)) === 4 ? 'selected' : ''}>4 ตัวเลือก</option>
                        <option value="5" ${(exam ? exam.choiceCount : Number(wrap.dataset.choiceCount || 4)) === 5 ? 'selected' : ''}>5 ตัวเลือก</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">รูปแบบตัวเลือก</label>
                    <select class="form-input" data-f="choiceStyle">
                        ${[['thai', 'ก ข ค ง จ'], ['latin', 'A B C D E'], ['number', '1 2 3 4 5']].map(([v, l]) => `<option value="${v}" ${(exam ? exam.choiceStyle : (wrap.dataset.choiceStyle || 'thai')) === v ? 'selected' : ''}>${l}</option>`).join('')}
                    </select>
                </div>
            </div>
            <p class="form-label">ตอน (รายวิชา) เรียงตามลำดับบนกระดาษ</p>
            <div class="ach-sections">
                ${sections.map((s, i) => `
                    <div class="ach-section-row" data-i="${i}">
                        <select class="form-input" data-s="subjectId" ${locked ? 'disabled' : ''}>${subjectOptions(s.subjectId)}</select>
                        <label>ข้อ <input type="number" class="form-input" data-s="questionCount" min="1" max="100" value="${s.questionCount}" ${locked ? 'disabled' : ''}></label>
                        <label>คะแนน/ข้อ <input type="number" class="form-input" data-s="pointsPerQuestion" min="0.25" step="0.25" value="${s.pointsPerQuestion || 1}"></label>
                        ${locked ? '' : `<button type="button" class="ach-icon-btn" data-remove="${i}" title="ลบตอนนี้">✕</button>`}
                    </div>`).join('') || '<p class="activities-empty">ยังไม่มีตอน กด "เพิ่มตอน"</p>'}
            </div>
            ${locked ? '<p class="ach-note">สแกนกระดาษไปแล้ว เปลี่ยนจำนวนข้อ ตัวเลือก หรือวิชาไม่ได้ (แก้ได้แค่ชื่อ คะแนนต่อข้อ และรูปแบบตัวเลือก)</p>' : `<button type="button" class="btn-outline" data-add-section ${courseId ? '' : 'disabled'}>+ เพิ่มตอน</button>`}
            <p class="ach-note" data-f="summary"></p>
            <div class="form-actions">
                ${exam ? '<button type="button" class="ach-danger-btn" data-delete>ลบชุดข้อสอบ</button>' : '<button type="button" class="btn-outline" data-cancel>ยกเลิก</button>'}
                <button type="button" class="btn-primary" data-save>${exam ? 'บันทึกการแก้ไข' : 'สร้างชุดข้อสอบ'}</button>
            </div>`;

        const read = () => {
            const rows = [...wrap.querySelectorAll('.ach-section-row')].map((row) => ({
                subjectId: Number(row.querySelector('[data-s="subjectId"]').value) || null,
                questionCount: Number(row.querySelector('[data-s="questionCount"]').value) || 0,
                pointsPerQuestion: Number(row.querySelector('[data-s="pointsPerQuestion"]').value) || 1,
            }));
            return {
                title: wrap.querySelector('[data-f="title"]').value.trim(),
                courseFormatId: Number(wrap.querySelector('[data-f="course"]').value) || null,
                choiceCount: Number(wrap.querySelector('[data-f="choiceCount"]').value),
                choiceStyle: wrap.querySelector('[data-f="choiceStyle"]').value,
                sections: rows,
            };
        };
        const remember = () => {
            if (exam) return;
            const v = read();
            wrap.dataset.title = v.title;
            wrap.dataset.courseId = v.courseFormatId || '';
            wrap.dataset.choiceCount = v.choiceCount;
            wrap.dataset.choiceStyle = v.choiceStyle;
            wrap.dataset.sections = JSON.stringify(v.sections);
        };
        const summarize = () => {
            const v = read();
            const total = v.sections.reduce((s, x) => s + x.questionCount, 0);
            const layout = PTNOmr.computeLayout({ choiceCount: v.choiceCount, choiceStyle: v.choiceStyle, sections: v.sections.map((s) => ({ ...s, title: '' })) });
            const points = v.sections.reduce((s, x) => s + x.questionCount * x.pointsPerQuestion, 0);
            const el = wrap.querySelector('[data-f="summary"]');
            el.textContent = `รวม ${total} ข้อ (สูงสุด ${PTNOmr.MAX_QUESTIONS}) · คะแนนเต็ม ${points}` + (layout.overflow ? ' · เกินพื้นที่กระดาษ 1 แผ่น' : '');
            el.classList.toggle('ach-error', layout.overflow || total > PTNOmr.MAX_QUESTIONS);
        };
        wrap.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', () => { remember(); summarize(); }));
        wrap.querySelector('[data-f="course"]').addEventListener('change', () => { remember(); wrap.dataset.sections = '[]'; renderExamForm(exam); });
        wrap.querySelector('[data-add-section]')?.addEventListener('click', () => {
            const v = read();
            const used = new Set(v.sections.map((s) => s.subjectId));
            const next = courseSubjects(v.courseFormatId || courseId).find((s) => !used.has(s.id));
            v.sections.push({ subjectId: next ? next.id : null, questionCount: 20, pointsPerQuestion: 1 });
            if (exam) { exam.sections = v.sections; exam.title = v.title; exam.choiceCount = v.choiceCount; exam.choiceStyle = v.choiceStyle; } else { wrap.dataset.sections = JSON.stringify(v.sections); remember(); wrap.dataset.sections = JSON.stringify(v.sections); }
            renderExamForm(exam);
        });
        wrap.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
            const v = read();
            v.sections.splice(Number(b.dataset.remove), 1);
            if (exam) exam.sections = v.sections; else { remember(); wrap.dataset.sections = JSON.stringify(v.sections); }
            renderExamForm(exam);
        }));
        wrap.querySelector('[data-cancel]')?.addEventListener('click', () => { wrap.classList.add('hidden'); delete wrap.dataset.sections; });
        wrap.querySelector('[data-delete]')?.addEventListener('click', deleteExam);
        wrap.querySelector('[data-save]').addEventListener('click', async (event) => {
            const v = read();
            if (!v.title) return toast('กรุณาใส่ชื่อชุดข้อสอบ', false);
            if (!v.courseFormatId) return toast('กรุณาเลือกคอร์ส', false);
            if (!v.sections.length || v.sections.some((s) => !s.subjectId)) return toast('กรุณาเลือกวิชาให้ครบทุกตอน', false);
            const btn = event.currentTarget;
            Loader.setButtonLoading(btn, 'กำลังบันทึก...');
            try {
                if (exam) {
                    await api(`/${exam.id}`, { method: 'PUT', body: JSON.stringify(v) });
                    toast('บันทึกชุดข้อสอบแล้ว', true);
                    await loadExams();
                    openExam(exam.id);
                } else {
                    const created = await api('', { method: 'POST', body: JSON.stringify(v) });
                    wrap.classList.add('hidden');
                    delete wrap.dataset.sections;
                    toast('สร้างชุดข้อสอบแล้ว ใส่เฉลยต่อได้เลย', true);
                    await loadExams();
                    state.view = 'key';
                    openExam(created.id);
                }
            } catch (error) {
                toast(error.message, false);
            } finally {
                Loader.clearButtonLoading(btn);
            }
        });
        summarize();
    }

    async function deleteExam() {
        const exam = state.exam;
        const ok = await showConfirm(`ลบชุดข้อสอบ "${exam.title}" และผลสแกนทั้งหมด ${exam.submissionCount || 0} แผ่น ใช่หรือไม่?${exam.isPublished ? ' (คะแนนที่ประกาศไปแล้วในตารางคะแนนจะยังอยู่)' : ''}`, { title: 'ลบชุดข้อสอบ', confirmText: 'ลบ' });
        if (!ok) return;
        try {
            await api(`/${exam.id}`, { method: 'DELETE' });
            toast('ลบชุดข้อสอบแล้ว', true);
            closeExam();
            loadExams();
        } catch (error) {
            toast(error.message, false);
        }
    }

    // ---------- ตารางคำตอบ (ใช้ทั้งเฉลยและแก้คำตอบที่สแกน) ----------
    // values: array ต่อข้อ ([index] / '*'); options: { mode: 'key' | 'answer', flags, key, editable(sectionIndex) }
    function answerGridHtml(exam, values, options) {
        const labels = labelsOf(exam);
        let q = 0;
        return exam.sections.map((section, si) => {
            const rows = [];
            for (let i = 0; i < section.questionCount; i++, q++) {
                const v = values[q];
                const editable = options.editable ? options.editable(si) : true;
                const flag = options.flags ? options.flags[q] : null;
                const k = options.key ? options.key[q] : null;
                let status = '';
                if (options.mode === 'answer' && k) {
                    const correct = k === '*' || (Array.isArray(k) && v.length === 1 && k.includes(v[0]));
                    status = correct ? 'is-correct' : 'is-wrong';
                }
                rows.push(`<div class="ach-q ${status} ${flag && flag !== 'blank' ? 'is-flag' : ''}" data-q="${q}">
                    <span class="ach-q-no">${q + 1}</span>
                    ${labels.map((l, c) => `<button type="button" class="ach-choice${v !== '*' && Array.isArray(v) && v.includes(c) ? ' on' : ''}${options.mode === 'answer' && Array.isArray(k) && k.includes(c) ? ' key' : ''}" data-q="${q}" data-c="${c}" ${editable && v !== '*' ? '' : 'disabled'}>${esc(l)}</button>`).join('')}
                    ${options.mode === 'key' ? `<button type="button" class="ach-cancel-q${v === '*' ? ' on' : ''}" data-q="${q}" data-cancel-q ${editable ? '' : 'disabled'} title="ตัดข้อนี้ทิ้ง ทุกคนได้คะแนน">ตัดข้อ</button>` : ''}
                    ${flag === 'multiple' ? '<span class="ach-flag">ฝนหลายช่อง</span>' : flag === 'faint' ? '<span class="ach-flag">รอยจาง</span>' : ''}
                </div>`);
            }
            return `<div class="ach-grid-section"><p class="ach-grid-title">${esc(section.title)} <span>ข้อ ${q - section.questionCount + 1}–${q} · ${section.pointsPerQuestion || 1} คะแนน/ข้อ</span></p>
                ${options.mode === 'key' && (options.editable ? options.editable(si) : true) ? `<div class="ach-quick"><input type="text" class="form-input" data-quick="${si}" placeholder="พิมพ์เฉลยเร็ว เช่น ${labels.join('')}${labels.join('')}... (ข้อละ 1 ตัว, - = ข้าม)"><button type="button" class="btn-outline" data-quick-apply="${si}">ใส่</button></div>` : ''}
                <div class="ach-grid">${rows.join('')}</div></div>`;
        }).join('');
    }

    function renderKey() {
        const exam = state.exam;
        const total = totalQuestions(exam);
        if (!state.keyDraft) {
            state.keyDraft = Array.from({ length: total }, (_, i) => {
                const k = (exam.answerKey || [])[i];
                return k === '*' ? '*' : Array.isArray(k) ? k.slice() : [];
            });
        }
        const mySubjectIds = new Set((typeof mySubjects !== 'undefined' ? mySubjects : []).map((s) => s.id));
        const editable = (si) => state.canManage || mySubjectIds.has(exam.sections[si].subjectId);
        const wrap = $('ach-key-wrap');
        const done = state.keyDraft.filter((k) => k === '*' || k.length).length;
        wrap.innerHTML = `<p class="ach-note">กดตัวเลือกที่ถูกของแต่ละข้อ (ถูกได้หลายตัวเลือก กดซ้ำเพื่อยกเลิก) · ใส่แล้ว ${done}/${total} ข้อ${exam.submissionCount ? ' · บันทึกแล้วระบบจะตรวจกระดาษที่สแกนไปแล้วใหม่ทั้งหมด' : ''}</p>`
            + answerGridHtml(exam, state.keyDraft, { mode: 'key', editable })
            + `<div class="form-actions"><button type="button" class="btn-primary" id="ach-key-save">บันทึกเฉลย</button></div>`;
        wrap.querySelectorAll('.ach-choice').forEach((b) => b.addEventListener('click', () => {
            const q = Number(b.dataset.q), c = Number(b.dataset.c);
            const cur = state.keyDraft[q] === '*' ? [] : state.keyDraft[q];
            state.keyDraft[q] = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c].sort();
            renderKey();
        }));
        wrap.querySelectorAll('[data-cancel-q]').forEach((b) => b.addEventListener('click', () => {
            const q = Number(b.dataset.q);
            state.keyDraft[q] = state.keyDraft[q] === '*' ? [] : '*';
            renderKey();
        }));
        wrap.querySelectorAll('[data-quick-apply]').forEach((b) => b.addEventListener('click', () => {
            const si = Number(b.dataset.quickApply);
            const text = wrap.querySelector(`[data-quick="${si}"]`).value.replace(/\s+/g, '');
            const labels = labelsOf(exam);
            const start = exam.sections.slice(0, si).reduce((s, x) => s + x.questionCount, 0);
            const chars = [...text];
            const bad = chars.find((ch) => ch !== '-' && !labels.includes(ch) && !labels.map((l) => l.toLowerCase()).includes(ch.toLowerCase()));
            if (bad) return toast(`ตัวอักษร "${bad}" ไม่ใช่ตัวเลือก (${labels.join(' ')})`, false);
            chars.slice(0, exam.sections[si].questionCount).forEach((ch, i) => {
                if (ch === '-') return;
                const idx = labels.findIndex((l) => l.toLowerCase() === ch.toLowerCase());
                state.keyDraft[start + i] = [idx];
            });
            renderKey();
        }));
        $('ach-key-save').addEventListener('click', async (event) => {
            const btn = event.currentTarget;
            Loader.setButtonLoading(btn, 'กำลังบันทึก...');
            try {
                await api(`/${exam.id}/answer-key`, { method: 'PUT', body: JSON.stringify({ answerKey: state.keyDraft }) });
                toast('บันทึกเฉลยแล้ว', true);
                state.keyDraft = null;
                await loadExams();
                openExam(exam.id);
            } catch (error) {
                toast(error.message, false);
                Loader.clearButtonLoading(btn);
            }
        });
    }

    // ---------- พิมพ์กระดาษคำตอบ ----------
    function renderPrint() {
        $('ach-print-wrap').innerHTML = `
            <p class="ach-note">พิมพ์คนละแผ่น ตั้งขนาดเป็น "ขนาดจริง/100%" ในหน้าต่างพิมพ์ และเลือกกระดาษให้ตรงกับที่เลือกด้านล่าง สี่เหลี่ยมดำ 4 มุมต้องอยู่ครบ</p>
            <div class="ach-print-actions" style="margin-bottom:0.5rem">
                <label class="ach-inline">ขนาดกระดาษ
                    <select class="form-input" id="ach-print-paper" style="width:auto">
                        <option value="A4">A4 (วงใหญ่ ฝนง่าย)</option>
                        <option value="A5">A5 (ประหยัดกระดาษ วงเล็กลง)</option>
                    </select>
                </label>
            </div>
            <div class="ach-print-actions">
                <button type="button" class="btn-primary" id="ach-print-roster">พิมพ์ใบรายคน (มีชื่อ + QR) ทั้งคอร์ส</button>
                <label class="ach-inline">ใบเปล่า <input type="number" class="form-input" id="ach-print-blank-count" min="1" max="200" value="5"> แผ่น</label>
                <button type="button" class="btn-outline" id="ach-print-blank">พิมพ์ใบเปล่า (ฝนรหัส)</button>
            </div>
            <p class="ach-note" style="margin-top:1rem">ใบรายคนและรายชื่อเรียงตามรหัสประจำตัว แจกกระดาษตามลำดับรายชื่อได้เลย</p>
            <div class="ach-print-actions">
                <button type="button" class="btn-outline" id="ach-print-signlist">พิมพ์ใบลงชื่อรับกระดาษคำตอบ</button>
            </div>`;
        $('ach-print-roster').addEventListener('click', () => printSheets(false));
        $('ach-print-blank').addEventListener('click', () => printSheets(true));
        $('ach-print-signlist').addEventListener('click', printSignList);
    }

    const byCode = (a, b) => String(a.code).localeCompare(String(b.code));

    // รายชื่อน้องค่ายเรียงตามรหัส พร้อมช่องลงชื่อรับ/ส่งกระดาษคำตอบ (A4 หน้าละ 25 คน)
    function printSignList() {
        const exam = state.exam;
        const people = state.roster.slice().sort(byCode);
        if (!people.length) return toast('ไม่มีน้องค่ายในคอร์สนี้', false);
        const win = window.open('', '_blank');
        if (!win) return toast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัป', false);
        const ROWS = 25;
        const totalPages = Math.ceil(people.length / ROWS);
        const pages = [];
        for (let p = 0; p < totalPages; p++) {
            const rows = people.slice(p * ROWS, (p + 1) * ROWS).map((x, i) => `<tr><td class="c">${p * ROWS + i + 1}</td><td class="c">${esc(x.code)}</td><td>${esc(x.fullName)}</td><td>${esc(x.nickname || '')}</td><td></td><td></td></tr>`).join('');
            pages.push(`<section class="page">
                <header><h1>รายชื่อรับกระดาษคำตอบ</h1><p>${esc(exam.title)} · คอร์ส${esc(exam.courseName)} · ${people.length} คน</p></header>
                <table><thead><tr><th class="c" style="width:11mm">ลำดับ</th><th class="c" style="width:20mm">รหัส</th><th>ชื่อ-นามสกุล</th><th style="width:20mm">ชื่อเล่น</th><th class="c" style="width:32mm">ลงชื่อรับ</th><th class="c" style="width:32mm">ลงชื่อส่ง</th></tr></thead><tbody>${rows}</tbody></table>
                <footer><span></span><span>หน้า ${p + 1} / ${totalPages}</span></footer>
            </section>`);
        }
        win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายชื่อรับกระดาษคำตอบ</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap">
<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Sarabun,sans-serif;color:#111;background:#e5e7eb}
.page{background:#fff;width:186mm;height:273mm;margin:0 auto;display:flex;flex-direction:column;break-after:page;page-break-after:always;overflow:hidden}.page:last-child{break-after:auto;page-break-after:auto}
header{text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}h1{margin:0 0 2px;font-size:19px}header p{margin:2px 0;font-size:13px}header .fill{margin-top:6px}
table{width:100%;border-collapse:collapse;font-size:13.5px}th{background:#fff;color:#000;font-weight:700;text-align:left;padding:5px 6px;border:1.2px solid #000}td{border:1px solid #000;padding:0 6px;height:8.6mm;color:#000}.c{text-align:center}
footer{margin-top:auto;display:flex;justify-content:space-between;font-size:13px;padding-top:8px}
@media screen{body{padding:12mm 0}.page{padding:12mm;width:210mm;height:297mm;margin-bottom:8mm;box-shadow:0 2px 10px rgba(0,0,0,.15)}}</style></head><body>${pages.join('')}
<script>(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},200)});<\/script></body></html>`);
        win.document.close();
    }

    // A5 = ย่อกระดาษ A4 ทั้งแผ่นลง 71% (ตัวตรวจอ้างอิงสี่เหลี่ยมดำ 4 มุม จึงอ่านได้ทุกขนาด)
    async function printSheets(blank) {
        const exam = state.exam;
        const paper = ($('ach-print-paper') && $('ach-print-paper').value === 'A5') ? { name: 'A5', w: 148, h: 210 } : { name: 'A4', w: 210, h: 297 };
        const win = window.open('', '_blank');
        if (!win) return toast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัป', false);
        win.document.write('<p style="font-family:sans-serif;padding:20px">กำลังเตรียมกระดาษคำตอบ...</p>');
        try {
            const data = await api(`/${exam.id}/roster?qr=1`);
            const layout = layoutOf(exam);
            let q = 0;
            const sectionsText = exam.sections.map((s) => { const a = q + 1; q += s.questionCount; return `${s.title} ข้อ ${a}–${q}`; }).join(' · ');
            const base = { examTitle: exam.title, sectionsText };
            const pages = blank
                ? Array.from({ length: Math.max(1, Math.min(200, Number($('ach-print-blank-count').value) || 1)) }, () => PTNOmrSheet.renderSheetSvg(layout, { ...base, participant: null }, data.blankQrSvg))
                : data.participants.slice().sort(byCode).map((p) => PTNOmrSheet.renderSheetSvg(layout, { ...base, participant: p }, p.qrSvg));
            if (!pages.length) { win.close(); return toast('ไม่มีน้องค่ายในคอร์สนี้', false); }
            win.document.open();
            win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>กระดาษคำตอบ ${esc(exam.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap">
<style>@page{size:${paper.name} portrait;margin:0}body{margin:0;background:#e5e7eb}.p{width:${paper.w}mm;height:${paper.h}mm;margin:0 auto;background:#fff;break-after:page;page-break-after:always;overflow:hidden}.p:last-child{break-after:auto;page-break-after:auto}.p svg{display:block;width:${paper.w}mm;height:${paper.h}mm}@media screen{body{padding:8mm 0}.p{margin-bottom:8mm;box-shadow:0 2px 10px rgba(0,0,0,.15)}}</style>
</head><body>${pages.map((svg) => `<div class="p">${svg}</div>`).join('')}
<script>(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},300)});<\/script></body></html>`);
            win.document.close();
        } catch (error) {
            win.close();
            toast(error.message, false);
        }
    }

    // ---------- สแกน ----------
    function renderScanProgress() {
        const el = $('ach-scan-progress');
        if (!el) return;
        const done = new Set(state.submissions.map((s) => s.participantProfileId));
        el.textContent = `สแกนแล้ว ${state.roster.filter((p) => done.has(p.id)).length}/${state.roster.length} คน`;
    }

    function renderScanIdle() {
        const keyMissing = (state.exam.answerKey || []).filter((k) => !(k === '*' || (Array.isArray(k) && k.length))).length;
        $('ach-scan-wrap').innerHTML = `
            ${keyMissing ? `<p class="ach-note ach-error">ยังใส่เฉลยไม่ครบ ${keyMissing} ข้อ คะแนนที่เห็นจะยังไม่ถูกต้อง (บันทึกได้ ระบบตรวจใหม่ให้เองเมื่อใส่เฉลยครบ)</p>` : ''}
            <div class="ach-scan-top">
                <span id="ach-scan-progress" class="ach-note"></span>
                <div class="ach-print-actions">
                    <button type="button" class="btn-primary" id="ach-cam-start">เปิดกล้องสแกน</button>
                    <button type="button" class="btn-primary hidden" id="ach-cam-shot">ถ่ายเลย</button>
                    <button type="button" class="btn-outline hidden" id="ach-cam-stop">ปิดกล้อง</button>
                    <label class="btn-outline ach-file-btn">อัปโหลดรูป<input type="file" accept="image/*" id="ach-file-input" hidden></label>
                    <button type="button" class="btn-outline" id="ach-manual-btn">กรอกคำตอบเอง</button>
                </div>
            </div>
            <div class="ach-camera hidden" id="ach-camera">
                <video id="ach-video" playsinline muted></video>
                <canvas id="ach-overlay"></canvas>
                <p class="ach-camera-hint" id="ach-camera-hint">จ่อกระดาษให้เห็นสี่เหลี่ยมดำครบ 4 มุม</p>
            </div>
            <div id="ach-scan-result"></div>`;
        renderScanProgress();
        $('ach-cam-start').addEventListener('click', startCamera);
        $('ach-cam-stop').addEventListener('click', stopCamera);
        $('ach-cam-shot').addEventListener('click', () => {
            const video = $('ach-video');
            if (!state.stream || !video || !video.videoWidth) return;
            state.scanResult = null;
            state.waitForClear = false;
            if (!processGray(grabVideoFrame(video), true)) toast('หาสี่เหลี่ยมดำ 4 มุมไม่เจอ ขยับให้เห็นครบทั้ง 4 มุม', false);
        });
        $('ach-file-input').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) scanFile(f); });
        $('ach-manual-btn').addEventListener('click', () => showResult({ answers: Array.from({ length: totalQuestions(state.exam) }, () => []), flags: [], participant: null, manual: true }));
    }

    async function startCamera() {
        if (!navigator.mediaDevices?.getUserMedia) return toast('เบราว์เซอร์นี้เปิดกล้องไม่ได้ ใช้ "อัปโหลดรูป" แทน', false);
        try {
            state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        } catch (error) {
            return toast('เปิดกล้องไม่ได้ (อนุญาตการใช้กล้องในเบราว์เซอร์ก่อน)', false);
        }
        const video = $('ach-video');
        video.srcObject = state.stream;
        await video.play().catch(() => {});
        $('ach-camera').classList.remove('hidden');
        drawOverlay(null, 1, 1);
        $('ach-cam-start').classList.add('hidden');
        $('ach-cam-stop').classList.remove('hidden');
        $('ach-cam-shot').classList.remove('hidden');
        $('ach-scan-result').innerHTML = '';
        state.scanResult = null;
        state.waitForClear = false;
        state.stableCount = 0;
        state.lastCorners = null;
        scheduleScan();
    }

    function stopCamera() {
        clearTimeout(state.scanTimer);
        state.scanTimer = null;
        if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
        state.stream = null;
        if ($('ach-camera')) {
            $('ach-camera').classList.add('hidden');
            $('ach-cam-start')?.classList.remove('hidden');
            $('ach-cam-stop')?.classList.add('hidden');
            $('ach-cam-shot')?.classList.add('hidden');
        }
    }

    function scheduleScan() {
        clearTimeout(state.scanTimer);
        state.scanTimer = setTimeout(scanTick, 280);
    }

    function grabVideoFrame(video) {
        const vw = video.videoWidth, vh = video.videoHeight;
        let cw = vw, ch = vh;
        if (vw / vh > 3 / 4) cw = Math.round(vh * 3 / 4); else ch = Math.round(vw * 4 / 3);
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, cw, ch);
        return PTNOmr.toGray(ctx.getImageData(0, 0, cw, ch).data, cw, ch);
    }

    function grabFrame(source, w, h) {
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, w, h);
        return PTNOmr.toGray(ctx.getImageData(0, 0, w, h).data, w, h);
    }

    // กรอบกล้องแสดงเป็นแนวตั้ง (object-fit: cover ครอปภาพกล้องแนวนอนให้พอดี) - แปลงพิกัดภาพกล้องจริงเป็นพิกัดบนจอด้วยสเกล/ระยะครอปเดียวกัน
    // ไม่เจอกระดาษ: วาดกรอบนำสัดส่วน A4 + สี่เหลี่ยม 4 มุม ให้วางกระดาษให้ตรงกรอบ
    function drawOverlay(corners, w, h, color) {
        const canvas = $('ach-overlay');
        const box = $('ach-camera');
        canvas.width = box.clientWidth; canvas.height = box.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!corners) {
            const gh = canvas.height * 0.86, gw = gh * 210 / 297;
            const gx = (canvas.width - gw) / 2, gy = (canvas.height - gh) / 2 - canvas.height * 0.02;
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
            ctx.strokeRect(gx, gy, gw, gh);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            const m = gw * 15 / 210, s = gw * 10 / 210;
            [[gx + m, gy + m], [gx + gw - m, gy + m], [gx + gw - m, gy + gh - m], [gx + m, gy + gh - m]].forEach(([cx, cy]) => ctx.fillRect(cx - s / 2, cy - s / 2, s, s));
            return;
        }
        const scale = Math.min(canvas.width / w, canvas.height / h);
        const ox = (canvas.width - w * scale) / 2, oy = (canvas.height - h * scale) / 2;
        ctx.strokeStyle = color; ctx.lineWidth = 4;
        ctx.beginPath();
        corners.forEach((p, i) => (i ? ctx.lineTo(ox + p.x * scale, oy + p.y * scale) : ctx.moveTo(ox + p.x * scale, oy + p.y * scale)));
        ctx.closePath(); ctx.stroke();
    }

    // ทุก ~0.3 วิ: หามุมกระดาษ ถ้านิ่ง 3 ครั้งติดกัน -> ตรวจทั้งแผ่น
    function scanTick() {
        const video = $('ach-video');
        if (!state.stream || !video || !video.videoWidth || state.scanResult) return;
        const gray = grabVideoFrame(video);
        const w = gray.width, h = gray.height;
        const debug = {};
        const corners = PTNOmr.findFiducials(gray, debug);
        if (state.waitForClear) {
            drawOverlay(corners, w, h, '#94a3b8');
            if (corners) {
                $('ach-camera-hint').textContent = 'เอาแผ่นนี้ออก แล้ววางแผ่นถัดไป';
                return scheduleScan();
            }
            state.waitForClear = false;
        }
        if (!corners) {
            state.stableCount = 0;
            drawOverlay(null, w, h);
            $('ach-camera-hint').textContent = debug.candidates
                ? `เห็นสี่เหลี่ยมดำ ${Math.min(debug.candidates, 4)}/4 มุม ขยับให้เห็นครบ ไม่เอานิ้วบัง`
                : 'จ่อกระดาษให้เห็นสี่เหลี่ยมดำครบ 4 มุม';
            return scheduleScan();
        }
        const moved = state.lastCorners ? Math.max(...corners.map((p, i) => Math.hypot(p.x - state.lastCorners[i].x, p.y - state.lastCorners[i].y))) : Infinity;
        state.lastCorners = corners;
        state.stableCount = moved < Math.max(w, h) * 0.03 ? state.stableCount + 1 : 0;
        drawOverlay(corners, w, h, state.stableCount >= 1 ? '#22c55e' : '#f59e0b');
        $('ach-camera-hint').textContent = state.stableCount >= 1 ? 'กำลังตรวจ...' : 'เจอแล้ว ถือนิ่ง ๆ';
        if (state.stableCount < 1) return scheduleScan();
        // ตรวจอัตโนมัติเฉพาะตอนอ่าน QR ได้ (ยืนยันว่าจับมุมถูก) - อ่านไม่ได้ให้สแกนต่อ หรือกด "ถ่ายเลย"
        if (!processGray(gray, false)) $('ach-camera-hint').textContent = 'อ่าน QR ไม่ได้ ขยับให้ชัดขึ้น หรือกด "ถ่ายเลย"';
        if (!state.scanResult) scheduleScan();
    }

    async function scanFile(file) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, 2400 / Math.max(img.width, img.height));
            const gray = grabFrame(img, Math.round(img.width * scale), Math.round(img.height * scale));
            if (!processGray(gray)) toast('หาสี่เหลี่ยมดำ 4 มุมในรูปไม่เจอ ถ่ายใหม่ให้เห็นทั้งแผ่น', false);
        };
        img.onerror = () => toast('เปิดรูปไม่ได้', false);
        img.src = url;
    }

    function processGray(gray, force = true) {
        const layout = layoutOf(state.exam);
        const result = PTNOmr.scan(gray, layout, window.jsQR);
        if (!result) return false;
        if (!result.qrText && !force) return false;
        const qr = PTNOmr.parseQr(result.qrText);
        if (qr && qr.examId !== state.exam.id) {
            toast('กระดาษนี้เป็นของชุดข้อสอบอื่น', false);
            state.waitForClear = true;
            return true;
        }
        let participant = null;
        let idNote = '';
        if (qr && qr.participantProfileId) participant = state.roster.find((p) => p.id === qr.participantProfileId) || null;
        if (!participant && result.studentCode) {
            participant = state.roster.find((p) => p.code === result.studentCode) || null;
            if (!participant) idNote = `รหัสที่ฝน ${result.studentCode} ไม่ตรงกับน้องคนไหนในคอร์ส`;
        }
        if (!participant && !idNote) idNote = qr ? 'ใบเปล่า: ฝนรหัสไม่ครบ/อ่านไม่ได้' : 'อ่าน QR ไม่ได้ และฝนรหัสไม่ครบ';
        // ใบรายคน: ใช้ QR เป็นหลัก ถ้ารหัสที่ฝนสำรองไว้ไม่ตรงกับชื่อในใบ ให้เตือน (อาจหยิบกระดาษเพื่อนมาใช้)
        if (participant && result.studentCode && result.studentCode !== participant.code) idNote = 'รหัสที่ฝน ' + result.studentCode + ' ไม่ตรงกับชื่อบนกระดาษ ตรวจสอบก่อนบันทึก';
        showResult({
            answers: result.answers.map((a) => a.selected),
            flags: result.answers.map((a) => a.flag),
            participant,
            idNote,
        });
        return true;
    }

    function showResult(res) {
        clearTimeout(state.scanTimer);
        state.scanResult = res;
        renderResultPanel();
        const exam = state.exam;
        const already = res.participant && state.submissions.some((s) => s.participantProfileId === res.participant.id);
        const hasFlags = res.flags.some((f) => f === 'multiple' || f === 'faint');
        // อ่านชัด ระบุตัวได้ และยังไม่เคยสแกน -> บันทึกเลย แล้วสแกนแผ่นต่อไปอัตโนมัติ
        if (!res.manual && res.participant && !already && !hasFlags && !res.idNote) saveResult(true);
        if (exam && state.stream) $('ach-camera-hint').textContent = 'ตรวจแล้ว ดูผลด้านล่าง';
    }

    function renderResultPanel() {
        const res = state.scanResult;
        const exam = state.exam;
        const wrap = $('ach-scan-result');
        if (!res) { wrap.innerHTML = ''; return; }
        const g = PTNOmr.grade(exam, res.answers);
        const already = res.participant && state.submissions.some((s) => s.participantProfileId === res.participant.id);
        const flagCount = res.flags.filter((f) => f === 'multiple' || f === 'faint').length;
        const done = new Set(state.submissions.map((s) => s.participantProfileId));
        wrap.innerHTML = `
            <div class="ach-result">
                <div class="ach-result-head">
                    <div>
                        ${res.participant
                            ? `<p class="ach-result-name">${esc(res.participant.fullName)}${res.participant.nickname ? ` (${esc(res.participant.nickname)})` : ''}</p><p class="ach-note">${esc(res.participant.code)}${already ? ' · <b class="ach-error">เคยบันทึกแล้ว บันทึกจะทับของเดิม</b>' : ''}</p>${res.idNote ? `<p class="ach-note ach-error">${esc(res.idNote)}</p>` : ''}`
                            : `<p class="ach-result-name ach-error">ยังไม่รู้ว่าเป็นของใคร</p><p class="ach-note">${esc(res.idNote || '')}</p>`}
                        <select class="form-input ach-pick" id="ach-pick">
                            <option value="">-- เลือกน้องค่าย --</option>
                            ${state.roster.map((p) => `<option value="${p.id}" ${res.participant && res.participant.id === p.id ? 'selected' : ''}>${esc(p.code)} ${esc(p.fullName)}${p.nickname ? ` (${esc(p.nickname)})` : ''}${done.has(p.id) ? ' ✓' : ''}</option>`).join('')}
                        </select>
                    </div>
                    <div class="ach-score">
                        <span class="ach-score-total">${g.totalPoints}<small>/${g.maxPoints}</small></span>
                        ${g.sections.map((s, i) => `<span class="ach-note">${esc(exam.sections[i].title)} ${s.points}/${s.maxPoints}</span>`).join('')}
                    </div>
                </div>
                ${flagCount ? `<p class="ach-note ach-error">มี ${flagCount} ข้อที่ต้องตรวจ (ฝนหลายช่อง/รอยจาง) ดูกระดาษจริงแล้วกดแก้ก่อนบันทึก</p>` : ''}
                ${answerGridHtml(exam, res.answers, { mode: 'answer', flags: res.flags, key: exam.answerKey })}
                <div class="form-actions">
                    <button type="button" class="btn-outline" id="ach-result-discard">ทิ้ง / สแกนใหม่</button>
                    <button type="button" class="btn-primary" id="ach-result-save">${already ? 'บันทึกทับ' : 'บันทึก'}</button>
                </div>
            </div>`;
        $('ach-pick').addEventListener('change', (e) => {
            res.participant = state.roster.find((p) => p.id === Number(e.target.value)) || null;
            renderResultPanel();
        });
        wrap.querySelectorAll('.ach-choice').forEach((b) => b.addEventListener('click', () => {
            const q = Number(b.dataset.q), c = Number(b.dataset.c);
            const cur = res.answers[q];
            res.answers[q] = cur.length === 1 && cur[0] === c ? [] : [c];
            res.flags[q] = null;
            renderResultPanel();
        }));
        $('ach-result-discard').addEventListener('click', () => resumeScan(false));
        $('ach-result-save').addEventListener('click', () => saveResult(false));
    }

    async function saveResult(auto) {
        const res = state.scanResult;
        if (!res) return;
        if (!res.participant) return toast('เลือกน้องค่ายก่อนบันทึก', false);
        const btn = $('ach-result-save');
        if (btn) Loader.setButtonLoading(btn, 'กำลังบันทึก...');
        try {
            const saved = await api(`/${state.exam.id}/submissions/${res.participant.id}`, {
                method: 'PUT',
                body: JSON.stringify({ answers: res.answers, source: res.manual ? 'manual' : 'scan' }),
            });
            const idx = state.submissions.findIndex((s) => s.participantProfileId === res.participant.id);
            const row = { participantProfileId: res.participant.id, code: res.participant.code, fullName: res.participant.fullName, nickname: res.participant.nickname, answers: res.answers, ...saved };
            if (idx >= 0) state.submissions[idx] = row; else state.submissions.unshift(row);
            toast(`บันทึก ${res.participant.fullName} ได้ ${saved.totalPoints} คะแนน`, true);
            renderScanProgress();
            const ex = state.exams.find((e) => e.id === state.exam.id);
            if (ex) ex.submissionCount = state.submissions.length;
            if (state.stream) {
                $('ach-scan-result').innerHTML = `<p class="ach-saved">✓ บันทึก ${esc(res.participant.fullName)} ${saved.totalPoints} คะแนนแล้ว · วางแผ่นถัดไปได้เลย</p>`;
                setTimeout(() => resumeScan(true), auto ? 1200 : 400);
            } else {
                state.scanResult = null;
                $('ach-scan-result').innerHTML = `<p class="ach-saved">✓ บันทึก ${esc(res.participant.fullName)} ${saved.totalPoints} คะแนนแล้ว</p>`;
            }
        } catch (error) {
            toast(error.message, false);
            if (btn) Loader.clearButtonLoading(btn);
        }
    }

    // afterSave = true: เพิ่งบันทึก ต้องเอาแผ่นเดิมออกก่อน / false (กดทิ้ง-สแกนใหม่): สแกนแผ่นเดิมซ้ำได้ทันที
    function resumeScan(afterSave) {
        state.waitForClear = !!state.stream && afterSave === true;
        state.scanResult = null;
        state.stableCount = 0;
        state.lastCorners = null;
        if (state.stream) { $('ach-scan-result').innerHTML = ''; scheduleScan(); } else renderResultPanel();
    }

    // ---------- ผลสอบ ----------
    function renderResults() {
        const exam = state.exam;
        const wrap = $('ach-results-wrap');
        const subs = state.submissions;
        const done = new Set(subs.map((s) => s.participantProfileId));
        const missing = state.roster.filter((p) => !done.has(p.id));
        const total = totalQuestions(exam);
        const labels = labelsOf(exam);
        const maxPoints = exam.sections.reduce((s, x) => s + x.questionCount * (x.pointsPerQuestion || 1), 0);
        // สถิติรายข้อ: % ตอบถูก และตัวเลือกที่ถูกเลือกบ่อย
        const stats = Array.from({ length: total }, (_, q) => {
            const counts = labels.map(() => 0);
            let correct = 0;
            subs.forEach((s) => {
                const a = s.answers[q] || [];
                if (a.length === 1) counts[a[0]]++;
                const k = exam.answerKey[q];
                if (k === '*' || (Array.isArray(k) && a.length === 1 && k.includes(a[0]))) correct++;
            });
            return { q, counts, pct: subs.length ? Math.round((correct / subs.length) * 100) : 0 };
        });
        const sorted = subs.slice().sort((a, b) => b.totalPoints - a.totalPoints);
        const avg = subs.length ? (subs.reduce((s, x) => s + x.totalPoints, 0) / subs.length).toFixed(1) : '-';
        wrap.innerHTML = `
            <div class="ach-results-top">
                <p class="ach-note">สแกนแล้ว ${subs.length}/${state.roster.length} คน · เฉลี่ย ${avg}/${maxPoints}${exam.isPublished ? ' · <b>ประกาศผลแล้ว</b> (สแกน/แก้เฉลยเพิ่มจะอัปเดตคะแนนให้ทันที)' : ''}</p>
                <div class="ach-print-actions">
                    <button type="button" class="btn-outline" id="ach-csv">ดาวน์โหลด CSV</button>
                    ${state.canManage && !exam.isPublished ? '<button type="button" class="btn-primary" id="ach-publish">ประกาศผล</button>' : ''}
                </div>
            </div>
            <div class="ach-table-wrap"><table class="ach-table">
                <thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th>${exam.sections.map((s) => `<th>${esc(s.title)}</th>`).join('')}<th>รวม</th><th>ที่มา</th><th></th></tr></thead>
                <tbody>${sorted.map((s) => `<tr>
                    <td>${esc(s.code)}</td><td>${esc(s.fullName)}${s.nickname ? ` (${esc(s.nickname)})` : ''}</td>
                    ${s.sectionScores.map((x) => `<td class="c">${x.points}/${x.maxPoints}</td>`).join('')}
                    <td class="c"><b>${s.totalPoints}</b></td><td class="c">${s.source === 'manual' ? 'กรอกเอง' : 'สแกน'}</td>
                    <td class="c"><button type="button" class="ach-link" data-edit="${s.participantProfileId}">ดู/แก้</button> <button type="button" class="ach-link ach-error" data-del="${s.participantProfileId}">ลบ</button></td>
                </tr>`).join('') || `<tr><td colspan="${exam.sections.length + 5}" class="c">ยังไม่มีผลสแกน</td></tr>`}</tbody>
            </table></div>
            ${missing.length ? `<p class="ach-note">ยังไม่ได้สแกน (${missing.length}): ${missing.map((p) => esc(p.nickname || p.fullName)).join(', ')}</p>` : ''}
            ${subs.length ? `<p class="profile-section-title" style="margin-top:1rem">สถิติรายข้อ</p>
            <div class="ach-stats">${stats.map((s) => `<div class="ach-stat ${s.pct < 40 ? 'hard' : s.pct > 85 ? 'easy' : ''}" title="${labels.map((l, i) => `${l}: ${s.counts[i]}`).join(' · ')}">
                <span class="ach-stat-no">${s.q + 1}</span><span class="ach-stat-pct">${s.pct}%</span>
                <span class="ach-stat-dist">${labels.map((l, i) => `<i class="${Array.isArray(exam.answerKey[s.q]) && exam.answerKey[s.q].includes(i) ? 'k' : ''}">${esc(l)}${s.counts[i]}</i>`).join('')}</span>
            </div>`).join('')}</div>
            <p class="ach-note">% = สัดส่วนคนที่ตอบถูก · สีแดง = ยาก (ถูกน้อยกว่า 40%) · สีเขียว = ง่าย (ถูกมากกว่า 85%) · ตัวหนา = เฉลย</p>` : ''}`;
        $('ach-csv').addEventListener('click', downloadCsv);
        $('ach-publish')?.addEventListener('click', publish);
        wrap.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
            const s = subs.find((x) => x.participantProfileId === Number(b.dataset.edit));
            switchView('scan');
            showResult({ answers: s.answers.map((a) => a.slice()), flags: [], participant: state.roster.find((p) => p.id === s.participantProfileId) || { id: s.participantProfileId, code: s.code, fullName: s.fullName, nickname: s.nickname }, manual: s.source === 'manual' });
        }));
        wrap.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
            const s = subs.find((x) => x.participantProfileId === Number(b.dataset.del));
            if (!(await showConfirm(`ลบผลสแกนของ ${s.fullName}?`, { title: 'ลบผลสแกน', confirmText: 'ลบ' }))) return;
            try {
                await api(`/${exam.id}/submissions/${s.participantProfileId}`, { method: 'DELETE' });
                state.submissions = state.submissions.filter((x) => x.participantProfileId !== s.participantProfileId);
                renderResults();
                toast('ลบผลสแกนแล้ว', true);
            } catch (error) {
                toast(error.message, false);
            }
        }));
    }

    function downloadCsv() {
        const exam = state.exam;
        const labels = labelsOf(exam);
        const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const total = totalQuestions(exam);
        const header = ['รหัส', 'ชื่อ-นามสกุล', 'ชื่อเล่น', ...exam.sections.map((s) => s.title), 'รวม', ...Array.from({ length: total }, (_, i) => `ข้อ ${i + 1}`)];
        const lines = [header.map(quote).join(',')].concat(state.submissions.map((s) => [
            s.code, s.fullName, s.nickname || '',
            ...s.sectionScores.map((x) => x.points), s.totalPoints,
            ...s.answers.map((a) => a.map((c) => labels[c]).join('')),
        ].map(quote).join(',')));
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ผลสอบ-${exam.title}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    async function publish() {
        const exam = state.exam;
        const missing = state.roster.length - state.submissions.length;
        const ok = await showConfirm(`ประกาศผล "${exam.title}"? คะแนนของ ${state.submissions.length} คนจะถูกบันทึกเป็น "คะแนนสอบ" ของแต่ละวิชาในตารางคะแนน และน้องค่ายจะเห็นทันที${missing > 0 ? ` (ยังไม่ได้สแกน ${missing} คน สแกนเพิ่มหลังประกาศได้)` : ''}`, { title: 'ประกาศผลสอบ', confirmText: 'ประกาศผล' });
        if (!ok) return;
        try {
            await api(`/${exam.id}/publish`, { method: 'POST' });
            toast('ประกาศผลแล้ว', true);
            await loadExams();
            openExam(exam.id);
            switchView('results');
        } catch (error) {
            toast(error.message, false);
        }
    }

    // ---------- เริ่มต้น ----------
    function init() {
        const page = $('page-achievement');
        if (!page) return;
        $('ach-create-btn').addEventListener('click', () => {
            const form = $('ach-create-form');
            form.classList.toggle('hidden');
            if (!form.classList.contains('hidden')) renderExamForm(null);
        });
        $('ach-detail-close').addEventListener('click', closeExam);
        document.querySelectorAll('.ach-view-btn').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
        // โหลดข้อมูลเมื่อเปิดแท็บ / ปิดกล้องเมื่อออกจากแท็บ
        let wasActive = false;
        const sync = () => {
            const active = page.classList.contains('active');
            if (active && !wasActive) loadExams();
            if (!active && wasActive) stopCamera();
            wasActive = active;
        };
        new MutationObserver(sync).observe(page, { attributes: true, attributeFilter: ['class'] });
        sync();
        document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
