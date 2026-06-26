/* =====================================================================
   IdeanaX — AI Tools Directory
   script.js — wires up every interactive element already present in
   tools.html / tools.css: search, sort, category filters (chips +
   sidebar), availability filters, view toggle, theme toggle, bookmarks,
   "more" chips, clear filters and pagination.
   ===================================================================== */

function initToolsPage() {
  'use strict';

  /* ---------------------------------------------------------------
     Safe localStorage helpers (private/incognito tabs can throw)
  --------------------------------------------------------------- */
  function storageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------
     Element refs
  --------------------------------------------------------------- */
  const grid            = document.getElementById('toolsGrid');
  const toolsContent     = document.getElementById('toolsContent');
  const toolSearchInput  = document.getElementById('toolSearchInput');
  const searchToggleBtn  = document.getElementById('searchToggleBtn');
  const themeToggleBtn   = document.getElementById('themeToggleBtn');
  const sortSelect       = document.getElementById('sortSelect');
  const sortRadioList    = document.getElementById('sortRadioList');
  const viewToggle       = document.getElementById('viewToggle');
  const chipRow          = document.getElementById('chipRow');
  const moreChipBtn      = document.getElementById('moreChipBtn');
  const catRadioList     = document.getElementById('catRadioList');
  const clearFiltersBtn  = document.getElementById('clearFiltersBtn');
  const paginationEl     = document.getElementById('pagination');
  const prevPageBtn      = document.getElementById('prevPage');
  const nextPageBtn      = document.getElementById('nextPage');
  const checkLists       = document.querySelectorAll('.check-list');
  const availabilityList = checkLists[0] || null;
  const featuresList     = checkLists[1] || null;

  if (!grid) return; // safety net if markup ever changes

  const cards = Array.from(grid.querySelectorAll('.tool-card'));
  const PAGE_SIZE = 8;

  /* tag each card with a stable order index + its trend flavour */
  cards.forEach((card, i) => {
    card.dataset.originalIndex = i;
    const trendEl = card.querySelector('.trend-tag');
    card.dataset.trend = trendEl
      ? (trendEl.classList.contains('hot') ? 'hot' : trendEl.classList.contains('pop') ? 'pop' : '')
      : '';
  });

  const state = {
    category: 'all',
    pricing: new Set(),   // values: free / freemium / open-source
    search: '',
    sort: 'trending',
    view: 'grid',
    page: 1
  };

  /* ---------------------------------------------------------------
     Accessibility helper — makes a non-button element keyboard
     operable without touching the HTML file.
  --------------------------------------------------------------- */
  function makeActivatable(el, onActivate) {
    el.tabIndex = 0;
    el.addEventListener('click', onActivate);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate(e);
      }
    });
  }

  /* ---------------------------------------------------------------
     BOOKMARKS (persisted)
  --------------------------------------------------------------- */
  const BOOKMARK_KEY = 'ideanax_bookmarks';
  const bookmarks = new Set(storageGet(BOOKMARK_KEY, []));

  function syncBookmarkUI(card) {
    const saved = bookmarks.has(card.dataset.title);
    card.querySelectorAll('.bookmark-flat').forEach((btn) => {
      btn.classList.toggle('saved', saved);
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
    });
  }
  cards.forEach(syncBookmarkUI);

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.bookmark-flat');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const card = btn.closest('.tool-card');
    const title = card.dataset.title;
    if (bookmarks.has(title)) bookmarks.delete(title);
    else bookmarks.add(title);
    storageSet(BOOKMARK_KEY, Array.from(bookmarks));
    syncBookmarkUI(card);
  });

  /* ---------------------------------------------------------------
     THEME TOGGLE (light / dark) — overrides the CSS custom
     properties defined on :root so no edits to tools.css are needed.
  --------------------------------------------------------------- */
  const THEME_KEY = 'ideanax_theme';
  const DARK_VARS = {
    '--bg': '#0a0a0f', '--bg-soft': '#0f0f17', '--surface': '#15151f',
    '--surface-2': '#1b1b27', '--border': '#2a2a38', '--border-soft': '#22222e',
    '--text': '#f4f4f8', '--text-dim': '#9b9bab', '--text-faint': '#6c6c80'
  };
  const LIGHT_VARS = {
    '--bg': '#f6f6fb', '--bg-soft': '#ffffff', '--surface': '#ffffff',
    '--surface-2': '#eef0f5', '--border': '#e0e0ea', '--border-soft': '#e8e8f0',
    '--text': '#15151f', '--text-dim': '#5a5a6e', '--text-faint': '#8b8b9c'
  };
  const SUN_ICON = themeToggleBtn ? themeToggleBtn.innerHTML : '';
  const MOON_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function applyTheme(theme) {
    const vars = theme === 'light' ? LIGHT_VARS : DARK_VARS;
    Object.keys(vars).forEach((k) => document.documentElement.style.setProperty(k, vars[k]));
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = theme === 'light' ? MOON_ICON : SUN_ICON;
      themeToggleBtn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    }
    storageSet(THEME_KEY, theme);
  }
  applyTheme(storageGet(THEME_KEY, 'dark'));
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      applyTheme(storageGet(THEME_KEY, 'dark') === 'dark' ? 'light' : 'dark');
    });
  }

  /* ---------------------------------------------------------------
     SEARCH
  --------------------------------------------------------------- */
  if (searchToggleBtn && toolSearchInput) {
    searchToggleBtn.addEventListener('click', () => {
      toolSearchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toolSearchInput.focus();
    });
  }

  let searchDebounceId;
  if (toolSearchInput) {
    toolSearchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceId);
      searchDebounceId = setTimeout(() => {
        state.search = toolSearchInput.value.trim().toLowerCase();
        state.page = 1;
        render();
      }, 150);
    });
  }

  /* ---------------------------------------------------------------
     CATEGORY — chip row + sidebar radio list (kept in sync), plus
     the "More" chip which reveals the categories that only exist
     in the sidebar (Marketing, Education, Other).
  --------------------------------------------------------------- */
  const EXTRA_CATEGORIES = [
    { cat: 'marketing', label: 'Marketing' },
    { cat: 'education', label: 'Education' },
    { cat: 'other', label: 'Other' }
  ];
  let moreExpanded = false;

  function collapseMoreChips() {
    if (!chipRow || !moreChipBtn) return;
    chipRow.querySelectorAll('.chip-extra').forEach((c) => c.remove());
    moreExpanded = false;
    moreChipBtn.innerHTML = 'More <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  }

  if (moreChipBtn && chipRow) {
    moreChipBtn.addEventListener('click', () => {
      if (moreExpanded) {
        collapseMoreChips();
        return;
      }
      EXTRA_CATEGORIES.forEach(({ cat, label }) => {
        const chip = document.createElement('button');
        chip.className = 'chip chip-extra';
        chip.dataset.filter = cat;
        chip.textContent = label;
        chipRow.insertBefore(chip, moreChipBtn);
      });
      moreExpanded = true;
      moreChipBtn.innerHTML = 'Less <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>';
    });
  }

  function setCategory(cat) {
    if (!cat) return;
    state.category = cat;
    state.page = 1;
    if (chipRow) {
      chipRow.querySelectorAll('.chip[data-filter]').forEach((c) => {
        c.classList.toggle('chip-active', c.dataset.filter === cat);
      });
    }
    if (catRadioList) {
      catRadioList.querySelectorAll('li').forEach((li) => {
        li.classList.toggle('selected', li.dataset.cat === cat);
      });
    }
    render();
  }

  if (chipRow) {
    chipRow.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip || chip === moreChipBtn || !chip.dataset.filter) return;
      setCategory(chip.dataset.filter);
    });
  }

  if (catRadioList) {
    catRadioList.querySelectorAll('li[data-cat]').forEach((li) => {
      makeActivatable(li, () => setCategory(li.dataset.cat));
    });
  }

  /* ---------------------------------------------------------------
     AVAILABILITY checkboxes — these map directly to data-pricing on
     each card, so checking them filters the grid (OR logic).
  --------------------------------------------------------------- */
  const AVAILABILITY_MAP = { 'Free': 'free', 'Freemium': 'freemium', 'Open Source': 'open-source' };
  if (availabilityList) {
    availabilityList.querySelectorAll('li').forEach((li) => {
      makeActivatable(li, () => {
        const checkbox = li.querySelector('.checkbox');
        const value = AVAILABILITY_MAP[li.textContent.trim()];
        const checked = checkbox.classList.toggle('checkbox-checked');
        if (!value) return;
        if (checked) state.pricing.add(value);
        else state.pricing.delete(value);
        state.page = 1;
        render();
      });
    });
  }

  /* ---------------------------------------------------------------
     FEATURE checkboxes — no matching data attribute exists on any
     card, so these stay visual-only toggles (no filtering claim
     is made that the data can't actually back).
  --------------------------------------------------------------- */
  if (featuresList) {
    featuresList.querySelectorAll('li').forEach((li) => {
      makeActivatable(li, () => li.querySelector('.checkbox').classList.toggle('checkbox-checked'));
    });
  }

  /* ---------------------------------------------------------------
     SORT — <select> and sidebar radio list stay in sync.
  --------------------------------------------------------------- */
  function setSort(value) {
    state.sort = value;
    state.page = 1;
    if (sortSelect) sortSelect.value = value;
    if (sortRadioList) {
      sortRadioList.querySelectorAll('li').forEach((li) => {
        li.classList.toggle('selected', li.dataset.sort === value);
      });
    }
    render();
  }
  if (sortSelect) sortSelect.addEventListener('change', () => setSort(sortSelect.value));
  if (sortRadioList) {
    sortRadioList.querySelectorAll('li[data-sort]').forEach((li) => {
      makeActivatable(li, () => setSort(li.dataset.sort));
    });
  }

  /* ---------------------------------------------------------------
     VIEW TOGGLE — grid / list (CSS already styles .list-view)
  --------------------------------------------------------------- */
  if (viewToggle && toolsContent) {
    viewToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.view-btn');
      if (!btn) return;
      state.view = btn.dataset.view;
      viewToggle.querySelectorAll('.view-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      toolsContent.classList.toggle('list-view', state.view === 'list');
    });
  }

  /* ---------------------------------------------------------------
     CLEAR FILTERS
  --------------------------------------------------------------- */
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      state.pricing.clear();
      state.search = '';
      if (toolSearchInput) toolSearchInput.value = '';
      document.querySelectorAll('.check-list .checkbox-checked').forEach((cb) => cb.classList.remove('checkbox-checked'));
      collapseMoreChips();
      setCategory('all');
      setSort('trending');
    });
  }

  /* ---------------------------------------------------------------
     FILTER + SORT
  --------------------------------------------------------------- */
  function getFiltered() {
    return cards.filter((card) => {
      if (state.category !== 'all' && card.dataset.cat !== state.category) return false;
      if (state.pricing.size && !state.pricing.has(card.dataset.pricing)) return false;
      if (state.search) {
        const title = (card.dataset.title || '').toLowerCase();
        const desc = (card.querySelector('p') ? card.querySelector('p').textContent : '').toLowerCase();
        if (title.indexOf(state.search) === -1 && desc.indexOf(state.search) === -1) return false;
      }
      return true;
    });
  }

  function trendRank(card, primary) {
    if (card.dataset.trend === primary) return 2;
    if (card.dataset.trend) return 1;
    return 0;
  }

  function sortCards(list) {
    const arr = list.slice();
    if (state.sort === 'az') {
      arr.sort((a, b) => a.dataset.title.localeCompare(b.dataset.title));
    } else if (state.sort === 'newest') {
      arr.sort((a, b) => Number(b.dataset.originalIndex) - Number(a.dataset.originalIndex));
    } else if (state.sort === 'popular') {
      arr.sort((a, b) => trendRank(b, 'pop') - trendRank(a, 'pop'));
    } else {
      arr.sort((a, b) => trendRank(b, 'hot') - trendRank(a, 'hot'));
    }
    return arr;
  }

  /* ---------------------------------------------------------------
     NO RESULTS message
  --------------------------------------------------------------- */
  let noResultsEl = null;
  function toggleNoResults(show) {
    if (show && !noResultsEl) {
      noResultsEl = document.createElement('div');
      noResultsEl.textContent = 'No tools match your filters — try adjusting your search or clearing filters.';
      noResultsEl.style.cssText = 'grid-column:1/-1;text-align:center;padding:56px 16px;color:var(--text-faint);font-size:14px;';
      grid.appendChild(noResultsEl);
    } else if (!show && noResultsEl) {
      noResultsEl.remove();
      noResultsEl = null;
    }
  }

  /* ---------------------------------------------------------------
     PAGINATION — rebuilt dynamically against the real filtered count
  --------------------------------------------------------------- */
  function pageList(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const keep = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
    const sorted = Array.from(keep).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
      out.push(p);
    });
    return out;
  }

  function setDisabled(btn, disabled) {
    if (!btn) return;
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.4' : '';
    btn.style.cursor = disabled ? 'default' : 'pointer';
  }

  function renderPagination(totalItems) {
    if (!paginationEl) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;

    paginationEl.querySelectorAll('.page-btn[data-page], .page-dots').forEach((el) => el.remove());

    pageList(state.page, totalPages).forEach((p) => {
      if (p === '…') {
        const dots = document.createElement('span');
        dots.className = 'page-dots';
        dots.textContent = '…';
        paginationEl.insertBefore(dots, nextPageBtn);
      } else {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (p === state.page ? ' active' : '');
        btn.dataset.page = String(p);
        btn.textContent = String(p);
        paginationEl.insertBefore(btn, nextPageBtn);
      }
    });

    setDisabled(prevPageBtn, state.page <= 1);
    setDisabled(nextPageBtn, state.page >= totalPages);
    paginationEl.style.display = totalPages <= 1 ? 'none' : 'flex';
  }

  if (paginationEl) {
    paginationEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      const totalPages = Math.max(1, Math.ceil(getFiltered().length / PAGE_SIZE));
      if (btn === prevPageBtn) state.page = Math.max(1, state.page - 1);
      else if (btn === nextPageBtn) state.page = Math.min(totalPages, state.page + 1);
      else if (btn.dataset.page) state.page = Number(btn.dataset.page);
      render();
      toolsContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------------------------------------------------------------
     MAIN RENDER
  --------------------------------------------------------------- */
  function render() {
    const filtered = sortCards(getFiltered());
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);
    const visible = new Set(pageItems);

    cards.forEach((card) => { card.style.display = visible.has(card) ? '' : 'none'; });
    pageItems.forEach((card) => grid.appendChild(card)); // re-order to match current sort

    toggleNoResults(filtered.length === 0);
    renderPagination(filtered.length);
  }

  render();
}

window.PageInitializers = window.PageInitializers || {};
window.PageInitializers.tools = initToolsPage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToolsPage, { once: true });
} else {
  initToolsPage();
}

