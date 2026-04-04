/**
 * PremiumManager — client-side premium status management.
 *
 * Chapters 1-2  : free.
 * Chapters 3-8  : require Standard or Expansion premium.
 * Chapters 9-10 : require Expansion Bundle tier.
 *
 * Premium status is stored in localStorage and optionally verified against the server.
 * Stored shape: { active, email, customerId, tier: 'standard'|'expansion', ts }
 */

const STORAGE_KEY = 'scd_premium';
const FREE_CHAPTERS = 2;
const BASE_PREMIUM_CHAPTERS = 8; // chapters 3-8 gated by standard tier

export const PremiumManager = {
  /**
   * Returns true if stored premium is still valid (handles promo expiry).
   * @param {object} data - parsed premium object from localStorage
   */
  _isDataActive(data) {
    if (!data?.active) return false;
    // Promo grants have an expiry timestamp; paid purchases do not.
    if (data.expiresAt && Date.now() > data.expiresAt) {
      // Expired promo — clean up silently.
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
      return false;
    }
    return true;
  },

  /**
   * Returns true if the user has any active premium (standard or expansion).
   */
  isPremium() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return this._isDataActive(data);
    } catch {
      return false;
    }
  },

  /**
   * Returns true if the user has the Expansion Bundle tier.
   */
  isExpansion() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return this._isDataActive(data) && data?.tier === 'expansion';
    } catch {
      return false;
    }
  },

  /**
   * Returns true if the given chapter number is locked for the current user.
   * Chapters 3-8  → requires any premium.
   * Chapters 9-10 → requires expansion tier.
   */
  isChapterLocked(chapterNumber) {
    if (chapterNumber <= FREE_CHAPTERS) return false;
    if (chapterNumber <= BASE_PREMIUM_CHAPTERS) return !this.isPremium();
    return !this.isExpansion(); // expansion chapters 9-10
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

  /**
   * Verifies a completed Lemon Squeezy order by its order ID.
   * Called on the success.html page after redirect from Lemon Squeezy.
   */
  async verifyOrder(orderId) {
    try {
      const res = await fetch('/api/verify-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      if (json.active) {
        this.setPremium({ email: json.email, customerId: json.customerId, tier: json.tier ?? 'standard' });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Restores premium access by looking up an active subscription by email.
   */
  async restoreByEmail(email) {
    try {
      const res = await fetch('/api/verify-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      if (json.active) {
        this.setPremium({ email: json.email ?? email, customerId: json.customerId, tier: json.tier ?? 'standard' });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Re-validates stored premium against the server. Falls back to localStorage if offline.
   */
  async verifyWithServer() {
    const data = this.getPremiumData();
    if (!data?.email) return this.isPremium();

    try {
      const res = await fetch('/api/verify-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
      if (!res.ok) return this.isPremium();
      const json = await res.json();
      if (!json.active) {
        this.clearPremium();
        return false;
      }
      this.setPremium({ email: json.email ?? data.email, customerId: json.customerId ?? data.customerId, tier: json.tier ?? data.tier ?? 'standard' });
      return true;
    } catch {
      return this.isPremium(); // offline: trust localStorage
    }
  },
};
