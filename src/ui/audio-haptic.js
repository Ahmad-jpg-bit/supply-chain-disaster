/**
 * AudioHapticManager — Web Audio API synthesis + Capacitor/Web haptic feedback.
 * Zero external audio files; all sounds are generated programmatically via the
 * Web Audio API oscillator/gain graph. Falls back gracefully on every platform.
 */

// Capacitor Haptics loaded lazily (only on native builds)
let _Haptics       = null;
let _ImpactStyle   = null;
let _NotifType     = null;
let _nativePlatform = false;

async function _initNative() {
    try {
        const { Capacitor } = await import('@capacitor/core');
        _nativePlatform = Capacitor.isNativePlatform();
        if (_nativePlatform) {
            const mod = await import('@capacitor/haptics');
            _Haptics     = mod.Haptics;
            _ImpactStyle = mod.ImpactStyle;
            _NotifType   = mod.NotificationType;
        }
    } catch (_) { /* not native */ }
}

export const AudioHapticManager = {
    _ctx:         null,
    _masterGain:  null,
    _audioOn:     true,
    _hapticOn:    true,
    _initialized: false,

    /** Call once at game start (after a user gesture so AudioContext is allowed). */
    async init() {
        if (this._initialized) return;
        this._initialized = true;

        await _initNative();

        // Restore saved preferences
        this._audioOn  = localStorage.getItem('scd_audio')  !== 'off';
        this._hapticOn = localStorage.getItem('scd_haptic') !== 'off';

        // Eagerly create and resume the AudioContext NOW, while we are still
        // inside the user-gesture call stack. Browsers (especially iOS Safari)
        // require resume() to be awaited within the gesture — if we defer
        // creation to the first play() call the context may still be suspended
        // and the oscillators start against it producing silence.
        try {
            if (!this._ctx) {
                this._ctx = new (window.AudioContext || window.webkitAudioContext)();
                this._masterGain = this._ctx.createGain();
                this._masterGain.gain.value = 0.22;
                this._masterGain.connect(this._ctx.destination);
            }
            if (this._ctx.state === 'suspended') await this._ctx.resume();
        } catch (_) {}

        this._wireToggleBtn();
    },

    toggleAudio() {
        this._audioOn = !this._audioOn;
        localStorage.setItem('scd_audio', this._audioOn ? 'on' : 'off');
        this._updateToggleBtn();
    },

    // ── Audio ────────────────────────────────────────────────────────────────

    /**
     * Play a synthesised sound effect.
     * @param {'confirm'|'bad'|'good'|'alert'|'tick'} type
     */
    async play(type) {
        if (!this._audioOn) return;
        try {
            await this._ensureCtx();
            switch (type) {
                case 'confirm': this._playConfirm(); break;
                case 'bad':     this._playThud();    break;
                case 'good':    this._playChime();   break;
                case 'alert':   this._playAlert();   break;
                case 'tick':    this._playTick();    break;
            }
        } catch (_) { /* AudioContext may be blocked pre-gesture */ }
    },

    async _ensureCtx() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._masterGain = this._ctx.createGain();
            this._masterGain.gain.value = 0.22; // subtle game audio
            this._masterGain.connect(this._ctx.destination);
        }
        if (this._ctx.state === 'suspended') await this._ctx.resume();
    },

    /** Short crisp two-tone click — order confirmed / positive UI action */
    _playConfirm() {
        const ctx = this._ctx, t = ctx.currentTime;
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(this._masterGain);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
        g.gain.setValueAtTime(0.7, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.start(t); osc.stop(t + 0.15);
    },

    /** Deep low thud — risky / bad decision */
    _playThud() {
        const ctx = this._ctx, t = ctx.currentTime;
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(this._masterGain);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, t);
        osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
        osc.start(t); osc.stop(t + 0.28);
    },

    /** Two-note rising chime — optimal decision / positive outcome */
    _playChime() {
        const ctx = this._ctx, t = ctx.currentTime;
        [880, 1320].forEach((freq, i) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.connect(g); g.connect(this._masterGain);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = t + i * 0.06;
            g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(0.45, start + 0.03);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.52);
            osc.start(start); osc.stop(start + 0.55);
        });
    },

    /** Harsh double-buzz — critical alert / CRIT warning */
    _playAlert() {
        const ctx = this._ctx, t = ctx.currentTime;
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(this._masterGain);
        osc.type = 'square';
        osc.frequency.value = 220;
        // Two pulses
        g.gain.setValueAtTime(0.0,  t);
        g.gain.setValueAtTime(0.35, t + 0.01);
        g.gain.setValueAtTime(0.0,  t + 0.09);
        g.gain.setValueAtTime(0.35, t + 0.14);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.start(t); osc.stop(t + 0.30);
    },

    /** Ultra-short UI tick — minor interaction / selection */
    _playTick() {
        const ctx = this._ctx, t = ctx.currentTime;
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(this._masterGain);
        osc.type = 'sine';
        osc.frequency.value = 720;
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        osc.start(t); osc.stop(t + 0.05);
    },

    // ── Haptics ──────────────────────────────────────────────────────────────

    /**
     * Trigger haptic feedback.
     * @param {'light'|'medium'|'heavy'|'success'|'warning'|'error'} style
     */
    async haptic(style) {
        if (!this._hapticOn) return;
        try {
            if (_nativePlatform && _Haptics) {
                switch (style) {
                    case 'light':   await _Haptics.impact({ style: _ImpactStyle.Light });   break;
                    case 'medium':  await _Haptics.impact({ style: _ImpactStyle.Medium });  break;
                    case 'heavy':   await _Haptics.impact({ style: _ImpactStyle.Heavy });   break;
                    case 'success': await _Haptics.notification({ type: _NotifType.Success }); break;
                    case 'warning': await _Haptics.notification({ type: _NotifType.Warning }); break;
                    case 'error':   await _Haptics.notification({ type: _NotifType.Error });   break;
                }
            } else if ('vibrate' in navigator) {
                // Web / PWA fallback vibration patterns (ms on/off)
                const patterns = {
                    light:   [18],
                    medium:  [38],
                    heavy:   [70],
                    success: [25, 55, 25],
                    warning: [55, 35, 55],
                    error:   [90, 40, 90, 40, 90],
                };
                navigator.vibrate(patterns[style] || [40]);
            }
        } catch (_) {}
    },

    // ── UI toggle button ─────────────────────────────────────────────────────

    _wireToggleBtn() {
        const btn = document.getElementById('audio-toggle');
        if (!btn) return;
        btn.addEventListener('click', () => this.toggleAudio());
        this._updateToggleBtn();
    },

    _updateToggleBtn() {
        const btn = document.getElementById('audio-toggle');
        if (!btn) return;
        btn.setAttribute('aria-pressed', String(this._audioOn));
        btn.title = this._audioOn ? 'Mute audio' : 'Unmute audio';
        btn.innerHTML = this._audioOn
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
        btn.classList.toggle('audio-muted', !this._audioOn);
    },
};
