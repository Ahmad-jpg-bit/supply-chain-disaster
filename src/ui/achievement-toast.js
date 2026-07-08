/**
 * AchievementToast — bottom-corner unlock notifications.
 * Stacks multiple unlocks; each auto-dismisses after 6 s.
 */

export function showAchievementToasts(unlocked) {
    if (!unlocked || !unlocked.length) return;

    let host = document.getElementById('achv-toast-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'achv-toast-host';
        document.body.appendChild(host);
    }

    unlocked.forEach((a, i) => {
        const el = document.createElement('div');
        el.className = 'achv-toast';
        el.innerHTML = `
            <span class="achv-toast-icon">${a.icon}</span>
            <div class="achv-toast-body">
                <div class="achv-toast-eyebrow">ACHIEVEMENT UNLOCKED — ${a.concept}</div>
                <div class="achv-toast-name">${a.name}</div>
                <p class="achv-toast-desc">${a.desc}</p>
            </div>`;
        host.appendChild(el);

        setTimeout(() => el.classList.add('achv-toast--visible'), 60 + i * 250);
        setTimeout(() => {
            el.classList.remove('achv-toast--visible');
            setTimeout(() => el.remove(), 400);
        }, 6000 + i * 250);
    });
}
