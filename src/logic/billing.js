/**
 * BillingManager — platform-aware purchase abstraction.
 *
 * Web  → Lemon Squeezy hosted checkout (handled by paywall.js).
 * Native (Android/iOS) → RevenueCat + Google Play Billing.
 *
 * RevenueCat entitlements must be configured in the RC dashboard
 * to match the identifiers below, linked to the Google Play product IDs.
 *
 * DEV MODE (no RC key):
 * When VITE_REVENUECAT_ANDROID_KEY is missing/empty on a native build,
 * RevenueCat is bypassed and purchase/restore calls return a mocked
 * success so the unlock UI can be verified end-to-end without a
 * configured Play Console or RC project.
 * Remove _RC_DEV_MODE usage once real products are live.
 */

import { Capacitor } from '@capacitor/core';
import { PremiumManager } from './premium.js';

// Must match entitlement identifiers configured in RevenueCat dashboard
const RC_ENTITLEMENTS = {
  standard:  'standard',
  expansion: 'expansion',
};

// Must match Google Play product IDs configured in Play Console
const RC_PRODUCT_IDS = {
  standard:  'com.nextrack.scmdisaster.standard',
  expansion: 'com.nextrack.scmdisaster.expansion',
};

const _RC_API_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_KEY ?? '';

// True when native but no RC key is configured — enables purchase mock for UI testing.
// TODO: remove this flag once RevenueCat dashboard + Play Console products are set up.
let _RC_DEV_MODE = false;

let _rcInitialized = false;

async function _getRC() {
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  return Purchases;
}

export const BillingManager = {
  /**
   * True when running inside a Capacitor native shell (Android/iOS).
   * False on web — all native billing code is skipped.
   */
  isNative: Capacitor.isNativePlatform(),

  /**
   * Initialize RevenueCat SDK on app start (native only).
   * Safe to call multiple times — no-ops after first call.
   * If the API key is missing, logs a warning and activates dev-mode mock.
   */
  async initialize() {
    if (!this.isNative || _rcInitialized) return;

    if (!_RC_API_KEY) {
      console.warn('[BillingManager] RevenueCat bypassed: No API key. Purchase mock active for UI testing.');
      _RC_DEV_MODE = true;
      return;
    }

    try {
      const Purchases = await _getRC();
      await Purchases.configure({ apiKey: _RC_API_KEY });
      _rcInitialized = true;
    } catch (e) {
      console.error('[BillingManager] RevenueCat init failed:', e);
      // Fall back to dev-mode rather than crashing
      _RC_DEV_MODE = true;
    }
  },

  /**
   * Purchase a tier on native via RevenueCat.
   * On web, returns { success: false, reason: 'use-web-checkout' } —
   * paywall.js opens the LS checkout URL instead.
   * In dev-mode (no RC key), returns a mocked success immediately.
   *
   * @param {'standard'|'expansion'} tier
   * @returns {Promise<{ success: boolean, tier?: string, reason?: string }>}
   */
  async purchaseTier(tier) {
    if (!this.isNative) {
      return { success: false, reason: 'use-web-checkout' };
    }

    // DEV MODE: mock a successful purchase so the unlock UI can be tested
    // TODO: remove once RC dashboard + Play Console products are configured
    if (_RC_DEV_MODE) {
      console.warn(`[BillingManager] DEV MODE — mocking successful purchase for tier: ${tier}`);
      PremiumManager.setPremium({ tier });
      return { success: true, tier };
    }

    try {
      const Purchases = await _getRC();
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;

      if (!current) return { success: false, reason: 'no-offerings' };

      const pkg = current.availablePackages.find(
        p => p.product.identifier === RC_PRODUCT_IDS[tier],
      );
      if (!pkg) return { success: false, reason: 'product-not-found' };

      const result = await Purchases.purchasePackage({ aPackage: pkg });
      const active = result.customerInfo?.entitlements?.active ?? {};

      if (active[RC_ENTITLEMENTS[tier]]) {
        PremiumManager.setPremium({ tier });
        return { success: true, tier };
      }

      return { success: false, reason: 'entitlement-not-active' };
    } catch (e) {
      if (e?.code === 'USER_CANCELLED') return { success: false, reason: 'cancelled' };
      console.error('[BillingManager] purchaseTier failed:', e);
      return { success: false, reason: 'error' };
    }
  },

  /**
   * Restore previous purchases on native via RevenueCat.
   * On web, returns { success: false, reason: 'use-web-restore' } —
   * paywall.js handles email-based restore instead.
   * In dev-mode (no RC key), returns no-purchases-found (nothing to restore yet).
   *
   * @returns {Promise<{ success: boolean, tier?: string, reason?: string }>}
   */
  async restorePurchases() {
    if (!this.isNative) {
      return { success: false, reason: 'use-web-restore' };
    }

    // DEV MODE: restore has nothing to return without a real RC backend
    // TODO: remove once RC dashboard + Play Console products are configured
    if (_RC_DEV_MODE) {
      console.warn('[BillingManager] DEV MODE — restore skipped (no RC backend).');
      return { success: false, reason: 'no-purchases-found' };
    }

    try {
      const Purchases = await _getRC();
      const result = await Purchases.restorePurchases();
      const active = result.customerInfo?.entitlements?.active ?? {};

      if (active[RC_ENTITLEMENTS.expansion]) {
        PremiumManager.setPremium({ tier: 'expansion' });
        return { success: true, tier: 'expansion' };
      }
      if (active[RC_ENTITLEMENTS.standard]) {
        PremiumManager.setPremium({ tier: 'standard' });
        return { success: true, tier: 'standard' };
      }

      return { success: false, reason: 'no-purchases-found' };
    } catch (e) {
      console.error('[BillingManager] restorePurchases failed:', e);
      return { success: false, reason: 'error' };
    }
  },
};
