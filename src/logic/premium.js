/**
 * PremiumManager — legacy local premium records + promo codes.
 *
 * Access decisions now go through logic/entitlements.js (package catalog in
 * data/packages.js): free intro, Core Game Pass, Challenge Membership (not
 * launched) and legacy purchases. This module still reads/writes the
 * `scd_premium` record that earlier versions stored for $49.99 Full Access,
 * older Standard/Expansion tiers and promo grants — Entitlements honours that
 * record as legacy Full Access (or a time-limited promo) so existing
 * purchasers keep everything they were promised.
 *
 * The old order-ID and unverified-email lookups were removed: access is now
 * granted only from verified provider events or an email-verified restore.
 */

import { Entitlements } from './entitlements.js';

const STORAGE_KEY = 'scd_premium';

export const PremiumManager = {
  /** True when the player holds any paid entitlement (Core, membership, legacy or promo). */
  isPremium() {
    return Entitlements.hasPaid();
  },

  /**
   * Persists premium status after a successful checkout, email verification, or promo redemption.
   * @param {object} opts
   * @param {string} [opts.email]
   * @param {string} [opts.customerId]
   * @param {'standard'|'expansion'} [opts.tier='standard']
   * @param {number} [opts.expiresAt]  Unix ms timestamp; omit for permanent paid access.
   * @param {string} [opts.source]     'promo' | 'purchase' (informational).
   */
  setPremium({ email, customerId, tier = 'standard', expiresAt, source }) {
    const record = {
      active: true,
      email: email ?? null,
      customerId: customerId ?? null,
      tier,
      ts: Date.now(),
    };
    if (expiresAt) record.expiresAt = expiresAt;
    if (source)    record.source    = source;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  },

  /**
   * Validates a promo code against the server and, if valid, stores a
   * time-limited expansion grant.
   * @param {string} code
   * @returns {Promise<{ ok: boolean, message: string }>}
   */
  async redeemPromo(code) {
    try {
      const res = await fetch('/api/redeem-promo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code }),
      });
      const json = await res.json();
      if (json.valid) {
        this.setPremium({
          tier:      json.tier,
          expiresAt: json.expiresAt,
          source:    'promo',
        });
        return { ok: true, message: json.message ?? '1-month full access activated!' };
      }
      return { ok: false, message: json.message ?? 'Invalid promo code.' };
    } catch {
      return { ok: false, message: 'Could not verify promo code. Check your connection.' };
    }
  },

  clearPremium() {
    localStorage.removeItem(STORAGE_KEY);
  },

  getPremiumData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

};
