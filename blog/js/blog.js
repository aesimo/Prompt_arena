/* ==========================================================================
   mxo.me — Blog & Guides Page
   Handles: topic pill filter, blog search, post bookmarks,
   grid/list view toggle, pagination clicks.
   ========================================================================== */

function initBlogPage() {
  initTopicFilter();
  initBlogSearch();
  initPostBookmarks();
  initViewToggle();
  initPagination();
}

window.PageInitializers = window.PageInitializers || {};
window.PageInitializers.blog = initBlogPage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlogPage, { once: true });
} else {
  initBlogPage();
}

/* ---------------------------------------------------------------------
   Topic pill filter — shows/hides posts by data-topic attribute
   ------------------------------------------------------------------ */
function initTopicFilter() {
  const topicRow = document.getElementById('topicRow');
  if (!topicRow) return;

  topicRow.querySelectorAll('.topic-pill[data-topic]').forEach(pill => {
    pill.addEventListener('click', () => {
      topicRow.querySelectorAll('.topic-pill[data-topic]').forEach(p => p.classList.remove('pill-active'));
      pill.classList.add('pill-active');

      const topic = pill.dataset.topic;
      document.querySelectorAll('#postGrid .post-card').forEach(card => {
        const match = topic === 'all' || card.dataset.topic === topic;
        card.style.display = match ? '' : 'none';
      });

      const input = document.getElementById('blogSearchInput');
      if (input) input.value = '';
    });
  });
}

/* ---------------------------------------------------------------------
   Blog search — filters posts by title text
   ------------------------------------------------------------------ */
function initBlogSearch() {
  const input = document.getElementById('blogSearchInput');
  if (!input) return;

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();

    if (query) {
      const topicRow = document.getElementById('topicRow');
      topicRow?.querySelectorAll('.topic-pill[data-topic]').forEach(p => p.classList.remove('pill-active'));
      topicRow?.querySelector('[data-topic="all"]')?.classList.add('pill-active');
    }

    document.querySelectorAll('#postGrid .post-card').forEach(card => {
      const title = card.dataset.title?.toLowerCase() || card.querySelector('h3')?.textContent.toLowerCase() || '';
      const desc = card.querySelector('p')?.textContent.toLowerCase() || '';
      const matches = !query || title.includes(query) || desc.includes(query);
      card.style.display = matches ? '' : 'none';
    });
  });
}

/* ---------------------------------------------------------------------
   Post bookmark toggle (both corner button and footer button)
   ------------------------------------------------------------------ */
function initPostBookmarks() {
  document.querySelectorAll('.post-bookmark, .post-meta-bookmark').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.classList.toggle('saved');
    });
  });
}

/* ---------------------------------------------------------------------
   Grid / List view toggle
   ------------------------------------------------------------------ */
function initViewToggle() {
  const gridBtn = document.getElementById('gridViewBtn');
  const listBtn = document.getElementById('listViewBtn');
  const postGrid = document.getElementById('postGrid');
  if (!gridBtn || !listBtn || !postGrid) return;

  gridBtn.addEventListener('click', () => {
    gridBtn.classList.add('view-active');
    listBtn.classList.remove('view-active');
    postGrid.classList.remove('post-grid-list');
  });

  listBtn.addEventListener('click', () => {
    listBtn.classList.add('view-active');
    gridBtn.classList.remove('view-active');
    postGrid.classList.add('post-grid-list');
  });
}

/* ---------------------------------------------------------------------
   Pagination — visual page switching (demo: just updates active state)
   ------------------------------------------------------------------ */
function initPagination() {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;

  pagination.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      pagination.querySelectorAll('.page-btn[data-page]').forEach(b => b.classList.remove('page-active'));
      btn.classList.add('page-active');
      document.getElementById('postGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.getElementById('pagePrev')?.addEventListener('click', () => {
    const active = pagination.querySelector('.page-active');
    const buttons = Array.from(pagination.querySelectorAll('.page-btn[data-page]'));
    const idx = buttons.indexOf(active);
    if (idx > 0) buttons[idx - 1].click();
  });

  document.getElementById('pageNext')?.addEventListener('click', () => {
    const active = pagination.querySelector('.page-active');
    const buttons = Array.from(pagination.querySelectorAll('.page-btn[data-page]'));
    const idx = buttons.indexOf(active);
    if (idx >= 0 && idx < buttons.length - 1) buttons[idx + 1].click();
  });
}
