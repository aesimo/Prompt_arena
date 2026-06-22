/* =====================================================================
   IdeanaX — Assets Page
   Handles: search, filtering, and download interactions for assets.
   ===================================================================== */

function initAssetsPage() {
  initAssetsSearch();
  initAssetFilters();
}

window.PageInitializers = window.PageInitializers || {};
window.PageInitializers.assets = initAssetsPage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAssetsPage, { once: true });
} else {
  initAssetsPage();
}

/* -----------------------------------------------------------------
   Search — filters assets by name
   ----------------------------------------------------------------- */
function initAssetsSearch() {
  const searchInput = document.querySelector('.search-box input, #searchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    const cards = document.querySelectorAll('.asset-card, .card');
    
    cards.forEach(card => {
      const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
      const desc = card.querySelector('p')?.textContent.toLowerCase() || '';
      const match = title.includes(query) || desc.includes(query);
      card.style.display = match ? '' : 'none';
    });
  });
}

/* -----------------------------------------------------------------
   Category filters — chips and sidebar filters
   ----------------------------------------------------------------- */
function initAssetFilters() {
  const chips = document.querySelectorAll('.chip[data-filter]');
  
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      // Update active state
      chips.forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      
      const filter = chip.dataset.filter;
      const cards = document.querySelectorAll('.asset-card, .card');
      
      cards.forEach(card => {
        if (filter === 'all') {
          card.style.display = '';
        } else {
          const cardFilter = card.dataset.filter || '';
          card.style.display = cardFilter === filter ? '' : 'none';
        }
      });
    });
  });
}
