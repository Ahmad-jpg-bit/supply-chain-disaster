/**
 * Product analytics events, sent through the site's existing GA4 tag
 * (window.gtag from the page <head>). No new vendor, no personal data:
 * only stable IDs (industry, mode, chapter) plus locale and page variant.
 *
 * In development builds events are collected on window.__scdAnalytics
 * instead of being sent, so local testing never pollutes production data.
 */

import { LOCALE } from '../i18n/pregame.js';

const VARIANT = 'pregame_v2';
const sentOnce = new Set();

/**
 * @param {string} name     GA4 event name (snake_case)
 * @param {Object} [params] stable, non-personal parameters
 * @param {string} [onceKey] if given, the event is sent at most once per page load for this key
 */
export function track(name, params = {}, onceKey) {
    if (onceKey !== undefined) {
        const k = `${name}:${onceKey}`;
        if (sentOnce.has(k)) return;
        sentOnce.add(k);
    }
    const payload = { ...params, locale: LOCALE, variant: VARIANT };
    if (import.meta.env.DEV) {
        (window.__scdAnalytics ||= []).push({ event: name, ...payload });
        return;
    }
    try { window.gtag?.('event', name, payload); } catch { /* analytics must never break the game */ }
}
