/* =====================================================================
   mxo.me — AI Prompts Page
   prompts.js — handles interactive elements for the prompts page
   ===================================================================== */

function initPromptsPage() {
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
  const grid = document.querySelector('.prompt-grid');
  const copyButtons = document.querySelectorAll('.copy-btn');
  const bookmarkButtons = document.querySelectorAll('.bookmark');

  /* ---------------------------------------------------------------
     Copy Prompt functionality
  --------------------------------------------------------------- */
  copyButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const card = this.closest('.card');
      const promptText = card.querySelector('p').textContent;
      
      navigator.clipboard.writeText(promptText).then(() => {
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        this.style.background = '#10b981';
        setTimeout(() => {
          this.textContent = originalText;
          this.style.background = '';
        }, 1500);
      }).catch(() => {
        // Fallback for browsers without clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = promptText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        setTimeout(() => {
          this.textContent = originalText;
        }, 1500);
      });
    });
  });

  /* ---------------------------------------------------------------
     Bookmark functionality
  --------------------------------------------------------------- */
  const BOOKMARK_KEY = 'mxome_prompt_bookmarks';
  const bookmarks = new Set(storageGet(BOOKMARK_KEY, []));

  function updateBookmarkUI(btn, isSaved) {
    btn.style.color = isSaved ? '#f43f5e' : '';
    btn.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
  }

  bookmarkButtons.forEach(btn => {
    const card = btn.closest('.card');
    const title = card.querySelector('h3').textContent;
    
    // Initial state
    updateBookmarkUI(btn, bookmarks.has(title));

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
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
     Chip filter functionality
  --------------------------------------------------------------- */
  const chips = document.querySelectorAll('.chip');
  chips.forEach(chip => {
    chip.addEventListener('click', function() {
      if (this.classList.contains('chip-more')) return;
      
      chips.forEach(c => c.classList.remove('chip-active'));
      this.classList.add('chip-active');
    });
  });

  /* ---------------------------------------------------------------
     Sidebar filter interactions
  --------------------------------------------------------------- */
  const radioItems = document.querySelectorAll('.radio-list li');
  radioItems.forEach(item => {
    item.addEventListener('click', function() {
      const parent = this.closest('.radio-list');
      parent.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
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
     Pagination
  --------------------------------------------------------------- */
  const pageButtons = document.querySelectorAll('.page-btn');
  pageButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.classList.contains('active')) return;
      
      pageButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

window.PageInitializers = window.PageInitializers || {};
window.PageInitializers.prompts = initPromptsPage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPromptsPage, { once: true });
} else {
  initPromptsPage();
}
