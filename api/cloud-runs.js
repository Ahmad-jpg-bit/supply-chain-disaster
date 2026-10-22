// Cloud-save runs API (replaces the old unauthenticated /api/save-game).
// Every call is scoped to the signed-in session's owner; mutations need the
// session CSRF token. See lib/cloud/service.js for revision/conflict rules.
//
// GET                         → { runs: [{ runId, rev, deleted, updatedAt, meta }] }
// GET ?id=…[&head=1]          → one run (with snapshot unless head=1)
// GET ?id=…&checkpoint=1      → previous server checkpoint for recovery
// PUT { runId, expectedRev, writeId, meta, snapshot } → { rev } | 409 conflict | 410 deleted
// DELETE ?id=…&expectedRev=N  → tombstone (stale writes can't recreate it)

import { context, deps as makeDeps, send } from '../lib/cloud/http.js';
import { listRuns, getRun, putRun, deleteRun, getCheckpoint } from '../lib/cloud/service.js';

export default async function handler(req, res) {
    const deps = await makeDeps();
    const ctx = context(req);
    const q = req.query || {};
    let out;
    try {
        if (req.method === 'GET') {
            if (!q.id) out = await listRuns(deps, ctx);
            else if (q.checkpoint === '1') out = await getCheckpoint(deps, ctx, { runId: q.id });
            else out = await getRun(deps, ctx, { runId: q.id, headOnly: q.head === '1' });
        } else if (req.method === 'PUT') out = await putRun(deps, ctx, req.body);
        else if (req.method === 'DELETE') {
            const expectedRev = q.expectedRev !== undefined ? Number(q.expectedRev) : undefined;
            out = await deleteRun(deps, ctx, { runId: q.id, expectedRev });
        } else out = { status: 405, body: { error: 'method_not_allowed' } };
    } catch (e) {
        console.error('[cloud-runs] error', e?.name || 'Error');
        out = { status: 500, body: { error: 'server_error' } };
    }
    return send(res, out, deps.cfg);
}
