/* ==========================================================================
   mxo.me — AI Prompts Page
   Handles: prompt expand/collapse toggle, overflow detection,
   clipboard copy (with fallback), bookmark toggle, logo animation.
   ========================================================================== */

function initPromptsPage() {
  initLogoAnimation();
  initPromptToggles();
  initCopyButtons();
  initBookmarks();
}

window.PageInitializers = window.PageInitializers || {};
window.PageInitializers.prompts = initPromptsPage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPromptsPage, { once: true });
} else {
  initPromptsPage();
}

/* -------------------------------------------------------------------------
   Logo animation — play video after a short delay
   ---------------------------------------------------------------------- */
function initLogoAnimation() {
  var logo = document.querySelector('.navbar .logo-animated');
  if (!logo) return;
  var video = logo.querySelector('video');
  setTimeout(function () {
    logo.classList.add('is-playing');
    if (video) video.play().catch(function () {});
  }, 3000);
}

/* -------------------------------------------------------------------------
   Prompt expand/collapse toggle with overflow detection
   ---------------------------------------------------------------------- */
function initPromptToggles() {
  var toggles = document.querySelectorAll('.prompt-toggle');
  if (!toggles.length) return;

  toggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var promptText = btn.closest('.card-body').querySelector('.prompt-text');
      if (!promptText) return;

      var isExpanded = !promptText.classList.contains('is-clamped');

      if (isExpanded) {
        promptText.classList.add('is-clamped');
        btn.textContent = 'View full prompt';
        btn.setAttribute('aria-expanded', 'false');
      } else {
        promptText.classList.remove('is-clamped');
        btn.textContent = 'Show less';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* overflow check — show toggle only when text is actually truncated */
  requestAnimationFrame(function () {
    setTimeout(function () {
      document.querySelectorAll('.prompt-text').forEach(function (el) {
        var isClamped = el.classList.contains('is-clamped');
        var isOverflow = el.scrollHeight > el.clientHeight + 2;
        var toggle = el.closest('.card-body').querySelector('.prompt-toggle');
        if (toggle) {
          toggle.classList.toggle('is-visible', isClamped && isOverflow);
        }
      });
    }, 100);
  });
}

/* -------------------------------------------------------------------------
   Copy prompt to clipboard with fallback
   ---------------------------------------------------------------------- */
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var prompt = btn.dataset.prompt || '';
      if (!prompt) return;

      var originalText = btn.textContent;

      function onDone() {
        btn.textContent = 'Copied!';
        btn.classList.add('is-copied');
        setTimeout(function () {
          btn.textContent = originalText;
          btn.classList.remove('is-copied');
        }, 1500);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(prompt).then(onDone).catch(function () {
          fallbackCopy(prompt, onDone);
        });
      } else {
        fallbackCopy(prompt, onDone);
      }
    });
  });
}

function fallbackCopy(text, callback) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    if (callback) callback();
  } catch (err) {
    // silently fail
  }
  document.body.removeChild(ta);
}

/* -------------------------------------------------------------------------
   Bookmark toggle
   ---------------------------------------------------------------------- */
function initBookmarks() {
  document.querySelectorAll('.bookmark').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      btn.classList.toggle('saved');
    });
  });
}
