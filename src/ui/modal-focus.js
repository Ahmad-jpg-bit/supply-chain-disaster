/**
 * Keyboard focus for full-screen game overlays (appended to <body>, outside
 * #app): while any is open the page behind is inert, so Tab can't reach it
 * and screen readers skip it, and focus moves into the overlay if it isn't
 * there already. Holds are counted — overlays that hand over to each other
 * (summary → concept card → offer) never release the page too early.
 */

let holds = 0;

/**
 * Ignore activations for a moment after an overlay opens: the second click of
 * a double-click on the previous screen's button would otherwise land on
 * whatever just appeared under the pointer (e.g. the offer screen's purchase
 * button right after the concept card's Continue).
 * @returns {() => boolean} ready — true once the overlay has been open long enough
 */
export function readyAfter(ms = 450) {
    const t = performance.now();
    return () => performance.now() - t >= ms;
}

/**
 * @param {HTMLElement} overlay
 * @param {HTMLElement} [focusEl] — where focus should go (default: first focusable control)
 * @returns {() => void} release — call once when the overlay starts hiding (extra calls are ignored)
 */
export function holdModal(overlay, focusEl) {
    const app = document.getElementById('app');
    holds++;
    if (app) app.inert = true;
    // The cloud-save toast also sits outside #app; keep focus off it while it's behind an overlay
    document.querySelectorAll('.svp-toast').forEach(t => { t.inert = true; });
    if (!overlay.contains(document.activeElement)) {
        const target = focusEl || overlay.querySelector('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        target?.focus({ preventScroll: true });
    }
    let released = false;
    return () => {
        if (released) return;
        released = true;
        holds = Math.max(0, holds - 1);
        if (!holds) {
            if (app) app.inert = false;
            document.querySelectorAll('.svp-toast').forEach(t => { t.inert = false; });
        }
    };
}
