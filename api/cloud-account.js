// Cloud-save account API (replaces the old unauthenticated /api/load-game).
//
// GET                                   → session status { signedIn, email (masked), owner tag, csrf, legacy? }
// POST { action: 'request-code', email }        → { sent: true }  (same answer whether or not saves exist)
// POST { action: 'verify-code', email, code }   → { signedIn, … } + HttpOnly session cookie
// POST { action: 'sign-out' }                   → clears the session
// POST { action: 'legacy' }                     → old email-backup copy for import (signed in only)
// POST { action: 'legacy-dismiss' }             → hide that copy (original record untouched)
//
// Verifying an email starts a cloud-save session only — it never grants purchases.

import { context, deps as makeDeps, send } from '../lib/cloud/http.js';
import { requestCode, verifyCode, sessionStatus, signOut, getLegacy, dismissLegacy } from '../lib/cloud/service.js';

export default async function handler(req, res) {
    const deps = await makeDeps();
    const ctx = context(req);
    let out;
    try {
        if (req.method === 'GET') out = await sessionStatus(deps, ctx);
        else if (req.method === 'POST') {
            const { action, email, code } = req.body || {};
            if (action === 'request-code')        out = await requestCode(deps, ctx, { email });
            else if (action === 'verify-code')    out = await verifyCode(deps, ctx, { email, code });
            else if (action === 'sign-out')       out = await signOut(deps, ctx);
            else if (action === 'legacy')         out = await getLegacy(deps, ctx);
            else if (action === 'legacy-dismiss') out = await dismissLegacy(deps, ctx);
            else out = { status: 400, body: { error: 'unknown_action' } };
        } else out = { status: 405, body: { error: 'method_not_allowed' } };
    } catch (e) {
        console.error('[cloud-account] error', e?.name || 'Error');
        out = { status: 500, body: { error: 'server_error' } };
    }
    return send(res, out, deps.cfg);
}
