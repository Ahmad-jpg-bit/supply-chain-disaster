/**
 * In-game Help (HUD "Help" button): how a turn works, the game's words in
 * plain language, and the guided-start controls. A modal <dialog> opened on
 * demand — nothing is shown until the player asks for it.
 */

const GLOSSARY = [
    ['Turn / quarter', null, 'One turn is one quarter (3 months). A chapter has 4 quarters.'],
    ['Stock available now', 'inventory', 'Units in your warehouse that customers can buy this quarter.'],
    ['Stock on the way', 'in transit', 'Units you have ordered that have not arrived yet.'],
    ['Time until your order arrives', 'lead time', 'How many quarters pass between ordering and being able to sell the units.'],
    ['Customer orders still waiting', 'backlog', 'Customers you couldn\'t serve yet. They are served first from the next stock you have.'],
    ['Extra stock for surprises', 'safety stock', 'Stock you aim to keep in reserve in case demand is higher than expected.'],
    ['Faulty units', 'defects', 'Units that arrive broken. Inspection finds some of them before customers do.'],
    ['Storage cost', 'holding cost', 'What it costs each quarter to keep stock in your warehouse.'],
    ['Customer demand', null, 'How many units customers want in a quarter. It changes from quarter to quarter, so the game shows an estimate.'],
    ['Estimate', null, 'A calculation from today\'s numbers. Real demand and surprise events can make the result different.'],
];

/**
 * @param {Object} o
 * @param {'story'|'endless'|'weekly'} o.mode
 * @param {boolean} o.guideActive
 * @param {Function} o.onReplay
 * @param {Function} o.onStop
 * @param {HTMLElement} [o.returnFocus]
 */
export function openHelpDialog({ mode, guideActive, onReplay, onStop, returnFocus }) {
    const story = mode === 'story';
    const steps = story
        ? ['Read the quarter\'s event and pick a response.',
           'Set your order: how much, from whom, how fast, at what price and with what protection.',
           'Confirm. Guess this quarter\'s demand, then see what happened and why.']
        : ['Set your order: how much, from whom, how fast, at what price and with what protection.',
           'Confirm and see what happened. Each wave gets harder — survive as long as you can.'];

    const dlg = document.createElement('dialog');
    dlg.className = 'pw-dialog help-dialog';
    dlg.setAttribute('aria-labelledby', 'help-dlg-title');
    dlg.innerHTML = `
        <div class="pw-dialog-head">
            <div>
                <p class="pw-eyebrow">Help</p>
                <h2 id="help-dlg-title">How to play</h2>
            </div>
            <button type="button" class="pw-dialog-close" aria-label="Close help">✕</button>
        </div>
        <div class="pw-dialog-body">
            <h3>Each turn</h3>
            <ol class="help-steps">${steps.map(t => `<li>${t}</li>`).join('')}</ol>
            <p class="pw-note">One turn is one quarter (3 months). Your goal is to keep customers served and the business healthy — there is rarely one right answer, only trade-offs.</p>

            <h3>Guided start</h3>
            <p>Short tips appear next to the controls they explain. You can skip them at any time.</p>
            <div class="help-actions">
                <button type="button" class="help-btn" data-help="replay">${guideActive ? 'Restart the guided start' : 'Replay the guided start'}</button>
                ${guideActive ? '<button type="button" class="help-btn help-btn--quiet" data-help="stop">Stop guidance</button>' : ''}
            </div>

            <h3>Words used in the game</h3>
            <dl class="help-glossary">
                ${GLOSSARY.map(([plain, term, text]) => `
                <div><dt>${plain}${term ? ` <span class="pw-muted">(${term})</span>` : ''}</dt><dd>${text}</dd></div>`).join('')}
            </dl>
        </div>`;
    document.body.appendChild(dlg);
    const close = () => dlg.close();
    dlg.querySelector('.pw-dialog-close').addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.querySelector('[data-help="replay"]').addEventListener('click', () => { returnFocus = null; close(); onReplay(); });
    dlg.querySelector('[data-help="stop"]')?.addEventListener('click', () => { close(); onStop(); });
    dlg.addEventListener('close', () => { dlg.remove(); returnFocus?.focus(); });
    dlg.showModal();
    return dlg;
}
