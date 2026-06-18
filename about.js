/* ==========================================================================
   IdeanaX — About Page
   Handles: animated stat counters (count up when scrolled into view),
   smooth-scroll CTA buttons.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initStatCounters();
  initCtaScroll();
});

/* ---------------------------------------------------------------------
   Stat counters — animate "50K+", "10K+", etc. from 0 when the stats
   strip first scrolls into view.
   ------------------------------------------------------------------ */
function initStatCounters() {
  const stats = document.querySelectorAll('.stats-strip .stat-num');
  if (!stats.length) return;

  const parsed = Array.from(stats).map(el => {
    const raw = el.textContent.trim();
    const match = raw.match(/^([\d.]+)(K\+|M\+|\+)?$/i);
    return {
      el,
      target: match ? parseFloat(match[1]) : 0,
      suffix: match ? (match[2] || '') : ''
    };
  });

  let played = false;

  const animate = () => {
    if (played) return;
    played = true;

    parsed.forEach(({ el, target, suffix }) => {
      const duration = 900;
      const start = performance.now();

      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = (target * eased).toFixed(target % 1 === 0 ? 0 : 1);
        el.textContent = current + suffix;
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };

  const strip = document.querySelector('.stats-strip');
  if (!strip) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate();
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });
    observer.observe(strip);
  } else {
    animate();
  }
}

/* ---------------------------------------------------------------------
   CTA scroll — "Explore Platform" / "Start Exploring" scroll to the
   value-proposition section; "Contact Us" scrolls to the footer.
   ------------------------------------------------------------------ */
function initCtaScroll() {
  const toWhy = document.getElementById('exploreBtn');
  const toStart = document.getElementById('startExploringBtn');
  const toContact = document.getElementById('contactBtn');

  const whySection = document.querySelector('.why-section');
  const footer = document.querySelector('.footer');

  [toWhy, toStart].forEach(btn => {
    btn?.addEventListener('click', () => {
      whySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  toContact?.addEventListener('click', () => {
    footer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
