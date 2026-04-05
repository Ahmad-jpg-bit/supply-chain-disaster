/**
 * Shared navigation bar component.
 * Usage: createNav('game') | createNav('about') | createNav('blog') | createNav('contact')
 *
 * On the game page the Upgrade button dispatches a 'scd:open-paywall' event.
 * On other pages it links to /?upgrade=1 which triggers the paywall on load.
 */
export function createNav(activePage = 'game') {
  const nav = document.createElement('nav');
  nav.className = 'site-nav glass-panel';
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="/" class="nav-logo" aria-label="Supply Chain Disaster">
        <svg class="nav-chain-icon" width="52" height="32" viewBox="0 0 52 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <!-- Blue link – open on the right -->
          <path d="M22 5 L9 5 Q3 5 3 11 L3 21 Q3 27 9 27 L22 27"
                stroke="#3b82f6" stroke-width="3.5" stroke-linecap="round"/>
          <!-- Orange link – open on the left -->
          <path d="M30 5 L43 5 Q49 5 49 11 L49 21 Q49 27 43 27 L30 27"
                stroke="#f97316" stroke-width="3.5" stroke-linecap="round"/>
        </svg>
        <span class="nav-logo-text">Supply Chain Disaster</span>
      </a>
      <button class="nav-hamburger" aria-label="Toggle menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-links">
        <li><a href="/" class="nav-link nav-link--cta${activePage === 'game' ? ' active' : ''}">Play Free</a></li>
        <li class="nav-dropdown-item">
          <button class="nav-link nav-dropdown-toggle${activePage === 'about' || activePage === 'blog' ? ' active' : ''}" aria-expanded="false" aria-haspopup="true">
            Resources
            <svg class="nav-dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <ul class="nav-dropdown" role="menu">
            <li role="none"><a href="/blog" class="nav-dropdown-link${activePage === 'blog' ? ' active' : ''}" role="menuitem">
              <span class="nav-dropdown-icon">📖</span> Supply Chain Blog
            </a></li>
            <li role="none"><a href="/about" class="nav-dropdown-link${activePage === 'about' ? ' active' : ''}" role="menuitem">
              <span class="nav-dropdown-icon">🎮</span> About the Game
            </a></li>
            <li role="none"><a href="/pricing" class="nav-dropdown-link${activePage === 'pricing' ? ' active' : ''}" role="menuitem">
              <span class="nav-dropdown-icon">✦</span> Pricing
            </a></li>
          </ul>
        </li>
        <li><a href="https://tools.supplychaindisaster.com" class="nav-link" target="_blank" rel="noopener">Calculators ↗</a></li>
        <li><a href="/contact" class="nav-link${activePage === 'contact' ? ' active' : ''}">Contact</a></li>
        <li class="nav-search-item">
          <button class="nav-search-btn" aria-label="Search scenarios and concepts" aria-expanded="false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <div class="nav-search-box" aria-hidden="true">
            <form class="nav-search-form" role="search" action="/blog">
              <input class="nav-search-input" type="search" name="q" placeholder="Search scenarios, concepts…" autocomplete="off" />
              <button type="submit" class="nav-search-submit" aria-label="Submit search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </form>
          </div>
        </li>
        <li>
          <a
            href="${activePage === 'game' ? '#' : '/?upgrade=1'}"
            id="nav-upgrade-btn"
            class="nav-link nav-upgrade-btn"
          >Unlock All ✦</a>
        </li>
      </ul>
    </div>
  `;

  document.body.prepend(nav);

  // Hamburger toggle
  const hamburger = nav.querySelector('.nav-hamburger');
  const links = nav.querySelector('.nav-links');
  hamburger.addEventListener('click', () => {
    const expanded = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', String(!expanded));
    hamburger.classList.toggle('open');
    links.classList.toggle('open');
  });

  // Resources dropdown toggle
  const dropdownToggle = nav.querySelector('.nav-dropdown-toggle');
  const dropdown = nav.querySelector('.nav-dropdown');
  if (dropdownToggle && dropdown) {
    dropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropdownToggle.getAttribute('aria-expanded') === 'true';
      dropdownToggle.setAttribute('aria-expanded', String(!open));
      dropdown.classList.toggle('open', !open);
    });
    document.addEventListener('click', () => {
      dropdownToggle.setAttribute('aria-expanded', 'false');
      dropdown.classList.remove('open');
    });
    dropdown.addEventListener('click', (e) => e.stopPropagation());
  }

  // Search toggle
  const searchBtn = nav.querySelector('.nav-search-btn');
  const searchBox = nav.querySelector('.nav-search-box');
  const searchInput = nav.querySelector('.nav-search-input');
  if (searchBtn && searchBox) {
    searchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = searchBtn.getAttribute('aria-expanded') === 'true';
      searchBtn.setAttribute('aria-expanded', String(!open));
      searchBox.classList.toggle('open', !open);
      searchBox.setAttribute('aria-hidden', String(open));
      if (!open) searchInput?.focus();
    });
    document.addEventListener('click', (e) => {
      if (!nav.querySelector('.nav-search-item').contains(e.target)) {
        searchBtn.setAttribute('aria-expanded', 'false');
        searchBox.classList.remove('open');
        searchBox.setAttribute('aria-hidden', 'true');
      }
    });
    searchBox.addEventListener('click', (e) => e.stopPropagation());
  }

  // Upgrade button — dispatch event on game page, follow link on other pages
  const upgradeBtn = nav.querySelector('#nav-upgrade-btn');
  if (activePage === 'game' && upgradeBtn) {
    upgradeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('scd:open-paywall'));
    });
  }

  return nav;
}

/**
 * Toggle minimal mode on the nav (landing page only).
 * Hides all secondary links, leaving only the logo + two CTAs.
 */
export function setNavMinimal(active) {
  const nav = document.querySelector('.site-nav');
  if (nav) nav.classList.toggle('site-nav--minimal', active);
}

/**
 * Update the nav upgrade button to reflect premium status.
 * Call after confirming the user is premium.
 */
export function markNavPremium() {
  const btn = document.getElementById('nav-upgrade-btn');
  if (!btn) return;
  btn.textContent = 'Premium ✦';
  btn.classList.add('nav-upgrade-btn--active');
  btn.removeAttribute('href');
  btn.style.cursor = 'default';
  btn.onclick = (e) => e.preventDefault();
}
