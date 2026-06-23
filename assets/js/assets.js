/* =====================================================================
   mxo.me — AI Assets Page
   assets.js — handles interactive elements for the assets page
   ===================================================================== */

function initAssetsPage() {
  'use strict';

  /* ---------------------------------------------------------------
     Safe localStorage helpers
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
  const bookmarkButtons = document.querySelectorAll('.bookmark-flat');
  const playButtons = document.querySelectorAll('.play-btn');
  const chipRow = document.getElementById('chipRow');
  const moreChipBtn = document.getElementById('moreChipBtn');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  /* ---------------------------------------------------------------
     Bookmark functionality
  --------------------------------------------------------------- */
  const BOOKMARK_KEY = 'mxome_asset_bookmarks';
  const bookmarks = new Set(storageGet(BOOKMARK_KEY, []));

  function updateBookmarkUI(btn, isSaved) {
    const svg = btn.querySelector('svg');
    if (isSaved) {
      btn.classList.add('saved');
      btn.style.color = '#f43f5e';
      if (svg) svg.setAttribute('fill', 'currentColor');
    } else {
      btn.classList.remove('saved');
      btn.style.color = '';
      if (svg) svg.setAttribute('fill', 'none');
    }
    btn.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
  }

  bookmarkButtons.forEach(btn => {
    const card = btn.closest('.card, .audio-card, .visual-card');
    const title = card ? card.querySelector('h3')?.textContent : null;
    
    if (title) {
      updateBookmarkUI(btn, bookmarks.has(title));
    }

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!title) return;
      
      const isSaved = bookmarks.has(title);
      
      if (isSaved) {
        bookmarks.delete(title);
      } else {
        bookmarks.add(title);
      }
      
      storageSet(BOOKMARK_KEY, Array.from(bookmarks));
      updateBookmarkUI(this, !isSaved);
    });
  });

  /* ---------------------------------------------------------------
     Audio play button functionality (visual only)
  --------------------------------------------------------------- */
  playButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const isPlaying = this.dataset.playing === 'true';
      const iconPlay = this.querySelector('.icon-play');
      const iconPause = this.querySelector('.icon-pause');
      
      if (isPlaying) {
        this.dataset.playing = 'false';
        if (iconPlay) iconPlay.style.display = '';
        if (iconPause) iconPause.style.display = 'none';
      } else {
        this.dataset.playing = 'true';
        if (iconPlay) iconPlay.style.display = 'none';
        if (iconPause) iconPause.style.display = '';
        
        // Auto-stop after 5 seconds for demo
        setTimeout(() => {
          this.dataset.playing = 'false';
          if (iconPlay) iconPlay.style.display = '';
          if (iconPause) iconPause.style.display = 'none';
        }, 5000);
      }
    });
  });

  /* ---------------------------------------------------------------
     Chip filter functionality
  --------------------------------------------------------------- */
  if (chipRow) {
    const chips = chipRow.querySelectorAll('.chip');
    
    // More/Less toggle
    if (moreChipBtn) {
      moreChipBtn.addEventListener('click', function() {
        const isExpanded = this.dataset.expanded === 'true';
        
        if (isExpanded) {
          // Collapse
          chipRow.querySelectorAll('.chip-extra').forEach(c => c.remove());
          this.innerHTML = 'More <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
          this.dataset.expanded = 'false';
        } else {
          // Expand with extra categories
          const extraCategories = ['Motion Graphics', '3D Models', 'Icons', 'Fonts'];
          extraCategories.forEach(cat => {
            const chip = document.createElement('button');
            chip.className = 'chip chip-extra';
            chip.textContent = cat;
            chipRow.insertBefore(chip, this);
          });
          this.innerHTML = 'Less <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>';
          this.dataset.expanded = 'true';
        }
      });
    }
    
    // Filter selection
    chips.forEach(chip => {
      chip.addEventListener('click', function() {
        if (this.classList.contains('chip-more')) return;
        
        chips.forEach(c => {
          if (!c.classList.contains('chip-more') && !c.classList.contains('chip-extra')) {
            c.classList.remove('chip-active');
          }
        });
        this.classList.add('chip-active');
      });
    });
  }

  /* ---------------------------------------------------------------
     Sidebar filter interactions
  --------------------------------------------------------------- */
  const radioItems = document.querySelectorAll('.radio-list li');
  radioItems.forEach(item => {
    item.addEventListener('click', function() {
      const parent = this.closest('.radio-list');
      if (parent) {
        parent.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
      }
      this.classList.add('selected');
    });
  });

  const checkItems = document.querySelectorAll('.check-list li');
  checkItems.forEach(item => {
    item.addEventListener('click', function() {
      const checkbox = this.querySelector('.checkbox');
      if (checkbox) {
        checkbox.classList.toggle('checkbox-checked');
      }
    });
  });

  /* ---------------------------------------------------------------
     Load More button
  --------------------------------------------------------------- */
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function() {
      this.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Loading...';
      
      setTimeout(() => {
        this.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Load More Assets';
        // In a real app, this would load more content
      }, 1000);
    });
  }

  /* ---------------------------------------------------------------
     View toggle functionality
  --------------------------------------------------------------- */
  const viewToggle = document.getElementById('viewToggle');
  const assetSections = document.getElementById('assetSections');
  
  if (viewToggle && assetSections) {
    const viewBtns = viewToggle.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        viewBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const view = this.dataset.view;
        if (view === 'list') {
          assetSections.classList.add('list-view');
        } else {
          assetSections.classList.remove('list-view');
        }
      });
    });
  }
}

window.PageInitializers = window.PageInitializers || {};
window.PageInitializers.assets = initAssetsPage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAssetsPage, { once: true });
} else {
  initAssetsPage();
}
