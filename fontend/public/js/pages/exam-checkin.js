function showExamCheckinState(stateId) {
    ['exam-checkin-loading', 'exam-checkin-success', 'exam-checkin-error', 'exam-checkin-login-required'].forEach((id) => {
        document.getElementById(id)?.classList.toggle('hidden', id !== stateId);
    });
}

function performCheckIn(token) {
    fetch('/api/oral-exam-sessions/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
            return body;
        })
        .then((result) => {
            document.getElementById('exam-checkin-success-detail').textContent =
                `วิชา${result.subjectName} - นี่คือการเข้าสอบครั้งที่ ${result.attemptNumber} ของคุณ`;
            showExamCheckinState('exam-checkin-success');
        })
        .catch((error) => {
            document.getElementById('exam-checkin-error-detail').textContent = error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
            showExamCheckinState('exam-checkin-error');
        });
}

document.addEventListener('DOMContentLoaded', () => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
        document.getElementById('exam-checkin-error-detail').textContent = 'ลิงก์ไม่ถูกต้อง ไม่พบรหัสเช็คอิน';
        showExamCheckinState('exam-checkin-error');
        return;
    }

    fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : { user: null }))
        .then(({ user }) => {
            if (!user || user.role !== 'PARTICIPANT') {
                showExamCheckinState('exam-checkin-login-required');
                return;
            }
            performCheckIn(token);
        })
        .catch(() => showExamCheckinState('exam-checkin-login-required'));
});
