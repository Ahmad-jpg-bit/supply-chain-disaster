/**
 * Animated canvas particle network — interconnected nodes representing a supply chain.
 * "hero" mode (~80 particles) for start screen, "ambient" mode (~40) during gameplay.
 */

const COLORS = [
    'rgba(59, 130, 246, 0.3)',   // blue
    'rgba(34, 197, 94, 0.22)',   // green
    'rgba(245, 158, 11, 0.18)',  // amber
];

const HERO_COUNT = 50;           // reduced from 80 — lighter visual weight on landing page
const AMBIENT_COUNT = 20;
const AMBIENT_COUNT_MOBILE = 8;  // ≤768px — reduces O(n²) pairs from 780→105
const LINK_DISTANCE = 120;
const FPS_CAP_MOBILE = 1000 / 30; // 30fps on mobile (~33ms)
const LINK_OPACITY = 0.04;        // reduced from 0.06 — subtler background
const PARTICLE_MIN_R = 1.5;
const PARTICLE_MAX_R = 3.5;
const SPEED = 0.3;

export class ParticleNetwork {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'particle-canvas';
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mode = 'hero';
        this.running = false;
        this.animId = null;
        this._lastFrame = 0;
        this._isMobile = window.matchMedia('(max-width: 768px)').matches;
        this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Style
        Object.assign(this.canvas.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            zIndex: '0',
            pointerEvents: 'none',
        });

        document.body.prepend(this.canvas);
        this._resize();
        window.addEventListener('resize', () => {
            this._isMobile = window.matchMedia('(max-width: 768px)').matches;
            this._resize();
        });

        // Pause when tab is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stop();
            } else if (this.running === false && this._shouldRun) {
                this.start();
            }
        });
    }

    _resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    _createParticles(count) {
        this.particles = [];
        const w = this.canvas.width;
        const h = this.canvas.height;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * SPEED * 2,
                vy: (Math.random() - 0.5) * SPEED * 2,
                r: PARTICLE_MIN_R + Math.random() * (PARTICLE_MAX_R - PARTICLE_MIN_R),
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
            });
        }
    }

    _ambientCount() {
        return this._isMobile ? AMBIENT_COUNT_MOBILE : AMBIENT_COUNT;
    }

    setMode(mode) {
        this.mode = mode;
        const count = mode === 'hero' ? HERO_COUNT : this._ambientCount();
        // Keep existing particles, add or trim
        if (this.particles.length < count) {
            const w = this.canvas.width;
            const h = this.canvas.height;
            while (this.particles.length < count) {
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * SPEED * 2,
                    vy: (Math.random() - 0.5) * SPEED * 2,
                    r: PARTICLE_MIN_R + Math.random() * (PARTICLE_MAX_R - PARTICLE_MIN_R),
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                });
            }
        } else {
            this.particles.length = count;
        }
    }

    start() {
        this._shouldRun = true;
        if (this._reducedMotion) return; // respect accessibility preference
        if (this.running) return;
        if (this.particles.length === 0) {
            this._createParticles(this.mode === 'hero' ? HERO_COUNT : this._ambientCount());
        }
        this.running = true;
        this._loop();
    }

    stop() {
        this.running = false;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
    }

    _loop(ts = 0) {
        if (!this.running) return;
        // Throttle to 30fps on mobile to cut CPU/battery usage
        if (this._isMobile && ts - this._lastFrame < FPS_CAP_MOBILE) {
            this.animId = requestAnimationFrame((t) => this._loop(t));
            return;
        }
        this._lastFrame = ts;
        this._update();
        this._draw();
        this.animId = requestAnimationFrame((t) => this._loop(t));
    }

    _update() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) { p.x = 0; p.vx *= -1; }
            if (p.x > w) { p.x = w; p.vx *= -1; }
            if (p.y < 0) { p.y = 0; p.vy *= -1; }
            if (p.y > h) { p.y = h; p.vy *= -1; }
        }
    }

    _draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        const len = this.particles.length;

        // Draw links
        for (let i = 0; i < len; i++) {
            for (let j = i + 1; j < len; j++) {
                const a = this.particles[i];
                const b = this.particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < LINK_DISTANCE) {
                    const opacity = LINK_OPACITY * (1 - dist / LINK_DISTANCE);
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(148, 163, 184, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        // Draw particles
        for (const p of this.particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        }
    }
}
