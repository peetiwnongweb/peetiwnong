function renderGroupMember(member) {
    const card = document.createElement('div');
    card.className = 'group-member-card';

    const avatar = document.createElement('div');
    avatar.className = 'group-member-avatar';
    const initial = (member.firstName || 'U').charAt(0).toUpperCase();
    if (typeof renderAvatar === 'function') {
        renderAvatar(avatar, member.avatarUrl, initial);
    } else {
        avatar.innerText = initial;
    }

    const info = document.createElement('div');
    info.className = 'group-member-info';
    const fullName = `${member.prefix || ''}${member.firstName || ''} ${member.lastName || ''}`.trim();
    info.innerHTML = `
        <p class="group-member-name">${fullName}${member.isMe ? ' <span class="group-member-me-badge">ฉัน</span>' : ''}</p>
        <p class="group-member-nickname">${member.nickname ? `ชื่อเล่น: ${member.nickname}` : ''}</p>
    `;

    card.appendChild(avatar);
    card.appendChild(info);
    return card;
}

function loadMyGroup() {
    const nameEl = document.getElementById('group-name-display');
    const emptyEl = document.getElementById('group-empty-state');
    const listEl = document.getElementById('group-member-list');
    const countEl = document.getElementById('group-member-count');

    if (listEl) Loader.renderSkeletonCards(listEl, 3);
    fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then(({ user }) => {
            if (!user.group) {
                if (nameEl) nameEl.textContent = 'ยังไม่ได้ถูกจัดกลุ่ม';
                if (emptyEl) emptyEl.classList.remove('hidden');
                if (listEl) listEl.classList.add('hidden');
                return;
            }

            if (nameEl) nameEl.textContent = user.group.name;

            return fetch('/api/auth/my-group-members')
                .then((res) => (res.ok ? res.json() : Promise.reject()))
                .then(({ members }) => {
                    if (countEl) countEl.textContent = `สมาชิกทั้งหมด ${members.length} คน`;
                    if (listEl) {
                        listEl.innerHTML = '';
                        members.forEach((member) => listEl.appendChild(renderGroupMember(member)));
                        listEl.classList.remove('hidden');
                    }
                    if (emptyEl) emptyEl.classList.add('hidden');
                });
        })
        .catch(() => {
            if (emptyEl) emptyEl.classList.remove('hidden');
        });
}

// ==========================================
// แท็บ: คะแนนกลุ่ม
// ==========================================
function loadGroupScores() {
    const rankNumberEl = document.getElementById('score-rank-number');
    const rankCardEl = document.getElementById('score-rank-card');
    const leaderboardListEl = document.getElementById('score-leaderboard-list');
    const leaderboardEmptyEl = document.getElementById('score-leaderboard-empty');
    const historyListEl = document.getElementById('score-history-list');
    const historyEmptyEl = document.getElementById('score-history-empty');

    if (leaderboardListEl) Loader.renderSkeletonCards(leaderboardListEl, 3);
    if (historyListEl) Loader.renderSkeletonCards(historyListEl, 3);
    return fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then(({ user }) => {
            if (!user.group) {
                if (rankCardEl) rankCardEl.classList.add('hidden');
                if (leaderboardEmptyEl) leaderboardEmptyEl.classList.remove('hidden');
                if (historyEmptyEl) historyEmptyEl.classList.remove('hidden');
                return;
            }

            return Promise.all([
                fetch('/api/camp-activities/scores/summary').then((res) => (res.ok ? res.json() : Promise.reject())),
                fetch('/api/camp-activities/my-group-scores').then((res) => (res.ok ? res.json() : Promise.reject())),
            ]).then(([summary, myScores]) => {
                if (rankNumberEl) rankNumberEl.textContent = myScores.totalScore;

                // ตารางอันดับทุกกลุ่ม
                if (leaderboardListEl) {
                    leaderboardListEl.innerHTML = '';
                    leaderboardEmptyEl?.classList.toggle('hidden', summary.length !== 0);
                    summary.forEach((row, index) => {
                        const isMe = row.groupId === user.group.id;
                        const rowEl = document.createElement('div');
                        rowEl.className = 'score-leaderboard-row' + (isMe ? ' score-leaderboard-row-me' : '');
                        rowEl.innerHTML = `
                            <span class="score-leaderboard-rank">${index + 1}</span>
                            <span class="score-leaderboard-name">${row.groupName}${isMe ? ' <span class="group-member-me-badge">กลุ่มของคุณ</span>' : ''}</span>
                            <span class="score-leaderboard-score-wrap">
                                <span class="score-leaderboard-score-number">${row.totalScore}</span>
                                <span class="score-leaderboard-score-unit">คะแนน</span>
                            </span>
                        `;
                        leaderboardListEl.appendChild(rowEl);
                    });
                }

                // ประวัติคะแนนของกลุ่มตัวเอง แยกตามกิจกรรม
                if (historyListEl) {
                    historyListEl.innerHTML = '';
                    historyEmptyEl?.classList.toggle('hidden', myScores.history.length !== 0);
                    myScores.history.forEach((item) => {
                        const rowEl = document.createElement('div');
                        rowEl.className = 'score-history-row';
                        rowEl.innerHTML = `
                            <span class="score-history-name">${item.activityName}</span>
                            ${item.scored
                                ? `<span class="score-history-score-wrap">
                                       <span class="score-history-score-number">${item.score}</span>
                                       <span class="score-history-score-unit">คะแนน</span>
                                   </span>`
                                : '<span class="score-history-pending">ยังไม่มีคะแนน</span>'}
                        `;
                        historyListEl.appendChild(rowEl);
                    });
                }
            });
        })
        .catch(() => {
            if (rankCardEl) rankCardEl.classList.add('hidden');
            leaderboardEmptyEl?.classList.remove('hidden');
            historyEmptyEl?.classList.remove('hidden');
        });
}

document.addEventListener('DOMContentLoaded', () => {
    Loader.showFullPageLoader();

    // ยังไม่มีค่ายที่กำลังดำเนินการ (หรือค่ายจบแล้ว) = ระบบกิจกรรมล็อกทั้งหน้า (API ตอบ 409 อยู่แล้ว) โชว์แผงอธิบายแทน ไม่โหลดกลุ่ม/คะแนน
    fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : { user: null, camp: null }))
        .catch(() => ({ user: null, camp: null }))
        .then(({ camp }) => {
            window.PTN_CAMP_STATE = camp || null;
            if (!isCampActive(camp)) {
                renderCampLockedPage(document.querySelector('main.main-content'), { systemName: 'ระบบกิจกรรม', audience: 'participant', camp });
                return;
            }
            return Promise.allSettled([loadMyGroup(), loadGroupScores()]);
        })
        .finally(() => Loader.hideFullPageLoader());
});
