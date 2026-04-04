import './shared/base.css';
import './shared/nav.css';
import './shared/pages.css';
import { createNav } from './shared/nav.js';
import { createFooter } from './shared/footer.js';
import { initAmbientParticles } from './shared/particles-lite.js';

window.addEventListener('DOMContentLoaded', () => {
  createNav('contact');
  createFooter();
  initAmbientParticles();

  const form = document.getElementById('contact-form');
  const statusEl = document.getElementById('form-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.className = 'form-status';
    statusEl.textContent = '';

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const subject = form.subject.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !message) {
      statusEl.className = 'form-status error';
      statusEl.textContent = 'Please fill in all required fields.';
      return;
    }

    const submitBtn = form.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });

      const data = await res.json();

      if (res.ok) {
        statusEl.className = 'form-status success';
        statusEl.textContent = 'Message sent successfully! We\'ll get back to you soon.';
        form.reset();
      } else {
        statusEl.className = 'form-status error';
        statusEl.textContent = data.error || 'Something went wrong. Please try again.';
      }
    } catch {
      statusEl.className = 'form-status error';
      statusEl.textContent = 'Network error. Please check your connection and try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
    }
  });
});
