/* =====================================================================
   IdeanaX — Prompts Page
   Handles: search, filter, and copy-to-clipboard for prompts.
   ===================================================================== */

function initPromptsPage() {
  initPromptSearch();
  initCopyToClipboard();
}

window.PageInitializers = window.PageInitializers || {};
window.PageInitializers.prompts = initPromptsPage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPromptsPage, { once: true });
} else {
  initPromptsPage();
}

/* -----------------------------------------------------------------
   Search — filters prompts by title/content
   ----------------------------------------------------------------- */
function initPromptSearch() {
  const searchInput = document.querySelector('.search-box input');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    const cards = document.querySelectorAll('.prompt-card, .card');
    
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(query) ? '' : 'none';
    });
  });
}

/* -----------------------------------------------------------------
   Copy to clipboard — for prompt text
   ----------------------------------------------------------------- */
function initCopyToClipboard() {
  document.querySelectorAll('.copy-btn, [data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy || btn.closest('.card')?.textContent;
      if (!text) return;
      
      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = original, 1500);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });
  });
}
