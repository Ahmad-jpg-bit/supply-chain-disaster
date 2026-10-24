/**
 * HTTP glue for the cloud-save API routes: session cookie, request context,
 * code emails. Nothing here logs emails, codes, cookies or snapshots.
 */

import { cloudConfig, SESSION_TTL } from './config.js';
import { defaultStore } from '../billing/store.js';

export const COOKIE = 'scd_sess';

export function parseCookies(header = '') {
    const out = {};
    for (const part of String(header).split(';')) {
        const i = part.indexOf('=');
        if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
}

export function sessionCookie(value, { clear = false, insecure = false } = {}) {
    const attrs = [`${COOKIE}=${clear ? '' : encodeURIComponent(value)}`, 'Path=/api', 'HttpOnly', 'SameSite=Lax', `Max-Age=${clear ? 0 : SESSION_TTL}`];
    if (!insecure) attrs.push('Secure');
    return attrs.join('; ');
}

export function context(req) {
    const h = req.headers || {};
    const fwd = String(h['x-forwarded-for'] || '').split(',')[0].trim();
    return {
        ip: fwd || req.socket?.remoteAddress || 'unknown',
        origin: h.origin || null,
        sid: parseCookies(h.cookie)[COOKIE] || null,
        csrf: h['x-scd-csrf'] || null,
        clientHeader: h['x-scd-client'] || null,
    };
}

async function sendCode(email, code) {
    if (process.env.SCD_DEV_MEMORY_STORE === '1' && process.env.VERCEL_ENV !== 'production') {
        (globalThis.__scdDevMail ||= []).push({ to: email, code, at: Date.now() });   // local test harness only
        return;
    }
    if (!process.env.RESEND_API_KEY) throw new Error('email not configured');
    const { Resend } = await import('resend');
    // Resend's SDK returns { error } instead of throwing — surface it, or a rejected send looks like success
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: 'Supply Chain Disaster <hello@supplychaindisaster.com>',
        to: email,
        subject: `${code} is your Supply Chain Disaster code`,
        html: `<p>Your code to turn on cloud saves for Supply Chain Disaster is:</p>
               <p style="font-size:28px;font-weight:700;letter-spacing:0.15em;">${code}</p>
               <p>It expires in 10 minutes and works once. If you didn't ask for it, you can ignore this email — nothing changes without the code.</p>
               <p style="color:#666;font-size:12px;">This is not a marketing email, and turning on cloud saves doesn't sign you up for any.</p>`,
    });
    if (error) throw Object.assign(new Error(`email send failed: ${error.name}`), { name: 'EmailSendError' });
}

export async function deps() {
    return { cfg: cloudConfig(), store: await defaultStore(), sendCode };
}

/** Write a service result (and any session cookie change) to the response. */
export function send(res, out, cfg) {
    res.setHeader('Cache-Control', 'no-store');
    if (out.setSession) res.setHeader('Set-Cookie', sessionCookie(out.setSession, { insecure: cfg.devInsecureCookies }));
    if (out.clearSession) res.setHeader('Set-Cookie', sessionCookie('', { clear: true, insecure: cfg.devInsecureCookies }));
    return res.status(out.status).json(out.body);
}
