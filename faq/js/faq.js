function initFaqPage() {

  const categories   = Array.from(document.querySelectorAll('.faq-category'));
  const topicItems   = Array.from(document.querySelectorAll('.topic-item'));
  const searchInput  = document.getElementById('searchInput');
  const noResults     = document.getElementById('noResults');

  /* ---------- CATEGORY ACCORDION (top-level) ---------- */
  categories.forEach(cat => {
    const row = cat.querySelector('.category-row');
    row.addEventListener('click', () => {
      const isOpen = cat.classList.contains('open');
      cat.classList.toggle('open', !isOpen);
      row.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  /* ---------- QUESTION ACCORDION (nested) ---------- */
  document.querySelectorAll('.qa-question').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.qa-item');
      const isOpen = item.classList.contains('open');
      item.classList.toggle('open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  /* ---------- TOPIC SIDEBAR FILTER ---------- */
  topicItems.forEach(item => {
    item.addEventListener('click', () => {
      topicItems.forEach(t => t.classList.remove('active'));
      item.classList.add('active');

      const topic = item.dataset.topic;
      filterByTopic(topic);

      // clear search when switching topics
      searchInput.value = '';
    });
  });

  function filterByTopic(topic) {
    let anyVisible = false;
    categories.forEach(cat => {
      const match = topic === 'all' || cat.dataset.category === topic;
      cat.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    noResults.hidden = anyVisible;
  }

  /* ---------- SEARCH ---------- */
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();

    if (query === '') {
      // restore whatever topic filter is currently active
      const activeTopic = document.querySelector('.topic-item.active')?.dataset.topic || 'all';
      filterByTopic(activeTopic);
      collapseAllQuestions();
      return;
    }

    // searching overrides topic filter — show all categories, filter questions within
    let anyVisible = false;

    categories.forEach(cat => {
      const qaItems = Array.from(cat.querySelectorAll('.qa-item'));
      let categoryHasMatch = false;

      qaItems.forEach(qa => {
        const questionText = qa.querySelector('.qa-question span').textContent.toLowerCase();
        const answerText = qa.querySelector('.qa-answer p').textContent.toLowerCase();
        const matches = questionText.includes(query) || answerText.includes(query);

        qa.style.display = matches ? '' : 'none';
        if (matches) {
          categoryHasMatch = true;
          qa.classList.add('open');
          qa.querySelector('.qa-question').setAttribute('aria-expanded', 'true');
        }
      });

      cat.style.display = categoryHasMatch ? '' : 'none';
      if (categoryHasMatch) {
        cat.classList.add('open');
        cat.querySelector('.category-row').setAttribute('aria-expanded', 'true');
        anyVisible = true;
      }
    });

    noResults.hidden = anyVisible;
  });

  function collapseAllQuestions() {
    document.querySelectorAll('.qa-item').forEach(qa => {
      qa.style.display = '';
      qa.classList.remove('open');
      qa.querySelector('.qa-question').setAttribute('aria-expanded', 'false');
    });
    categories.forEach(cat => {
      cat.classList.remove('open');
      cat.querySelector('.category-row').setAttribute('aria-expanded', 'false');
    });
  }

}

window.PageInitializers = window.PageInitializers || {};
window.PageInitializers.faq = initFaqPage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFaqPage, { once: true });
} else {
  initFaqPage();
}
