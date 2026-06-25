/* =====================================================================
   mxo.me — SPA Router
   router.js — handles client-side routing for the SPA
   ===================================================================== */

(function() {
  'use strict';

  // Route configuration mapping URLs to page files
  const routes = {
    '/': { page: 'home', file: null },
    '/index.html': { page: 'home', file: null },
    '/prompts': { page: 'prompts', file: './prompts/html/prompts.html' },
    '/prompts.html': { page: 'prompts', file: './prompts/html/prompts.html' },
    '/tools': { page: 'tools', file: './tools/html/tools.html' },
    '/tools.html': { page: 'tools', file: './tools/html/tools.html' },
    '/assets': { page: 'assets', file: './assets/html/assets.html' },
    '/assets.html': { page: 'assets', file: './assets/html/assets.html' },
    '/blog': { page: 'blog', file: './blog/html/blog.html' },
    '/blog.html': { page: 'blog', file: './blog/html/blog.html' },
    '/about': { page: 'about', file: './about/html/about.html' },
    '/about.html': { page: 'about', file: './about/html/about.html' },
    '/contact': { page: 'contact', file: './contact/html/contact.html' },
    '/contact.html': { page: 'contact', file: './contact/html/contact.html' },
    '/faq': { page: 'faq', file: './faq/html/faq.html' },
    '/faq.html': { page: 'faq', file: './faq/html/faq.html' },
    '/privacy': { page: 'privacy', file: './privacy/html/privacy.html' },
    '/privacy.html': { page: 'privacy', file: './privacy/html/privacy.html' },
    '/terms': { page: 'terms', file: './terms/html/terms.html' },
    '/terms.html': { page: 'terms', file: './terms/html/terms.html' },
    '/disclaimer': { page: 'disclaimer', file: './disclaimer/html/disclaimer.html' },
    '/disclaimer.html': { page: 'disclaimer', file: './disclaimer/html/disclaimer.html' },
    '/image-converter': { page: 'image-converter', file: './image-converter/html/image-converter.html' },
    '/image-converter.html': { page: 'image-converter', file: './image-converter/html/image-converter.html' }
  };

  const spaContent = document.getElementById('spa-content');
  const spaLoader = document.getElementById('spa-loader');
  let currentPage = null;

  /* ---------------------------------------------------------------
     Utility Functions
  --------------------------------------------------------------- */
  function showLoader() {
    if (spaLoader) spaLoader.style.display = 'flex';
  }

  function hideLoader() {
    if (spaLoader) spaLoader.style.display = 'none';
  }

  function getRoute(path) {
    // Remove trailing slash except for root
    const cleanPath = path.replace(/\/$/, '') || '/';
    return routes[cleanPath] || routes[path] || null;
  }

  function normalizePath(href) {
    if (!href) return href;
    // Drop query string / hash so they don't break matching
    let path = href.split(/[?#]/)[0];
    // Already a known route? return as-is
    if (routes[path] || routes[path.replace(/\/$/, '') || '/']) return href;

    const map = {
      'index.html': '/',
      'prompts/html/prompts.html': '/prompts',
      'tools/html/tools.html': '/tools',
      'assets/html/assets.html': '/assets',
      'blog/html/blog.html': '/blog',
      'about/html/about.html': '/about',
      'contact/html/contact.html': '/contact',
      'faq/html/faq.html': '/faq',
      'privacy/html/privacy.html': '/privacy',
      'terms/html/terms.html': '/terms',
      'disclaimer/html/disclaimer.html': '/disclaimer',
      'image-converter/html/image-converter.html': '/image-converter',
    };

    const m = path.match(/(?:^|\/)([^/]+\/html\/[^/]+\.html|index\.html)$/);
    if (m && map[m[1]]) return map[m[1]];
    return href;
  }

  function updateActiveNav(page) {
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.classList.remove('active');
      if (page === 'home' && (link.getAttribute('href') === 'index.html' || link.getAttribute('href') === './index.html')) {
        link.classList.add('active');
      } else if (link.dataset.page === page || link.getAttribute('href')?.includes(page)) {
        link.classList.add('active');
      }
    });
  }

  /* ---------------------------------------------------------------
     Page Loading
  --------------------------------------------------------------- */
  async function loadPage(url, pushState = true) {
    const route = getRoute(url);
    
    if (!route) {
      console.warn('Route not found:', url);
      return;
    }

    // Home page is already in the DOM
    if (route.page === 'home') {
      if (spaContent) {
        // Hide all page sections
        const pages = spaContent.querySelectorAll('.spa-page');
        pages.forEach(p => p.style.display = 'none');
        
        // Show home page
        const homePage = spaContent.querySelector('[data-page="home"]');
        if (homePage) {
          homePage.style.display = 'block';
        }
      }
      
      document.title = 'mxo.me — Discover AI Prompts & Creator Resources';
      updateActiveNav('home');
      currentPage = 'home';
      
      if (pushState) {
        history.pushState({ page: 'home' }, '', url);
      }
      window.scrollTo(0, 0);
      return;
    }

    showLoader();

    try {
      const response = await fetch(route.file);
      if (!response.ok) throw new Error('Failed to load page');
      
      const html = await response.text();
      
      // Parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract the main content
      const newContent = doc.querySelector('body');
      
      if (spaContent && newContent) {
        // Create a wrapper for the new page
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'spa-page';
        pageWrapper.dataset.page = route.page;
        
        // Copy attributes from body if any
        if (newContent.className) {
          pageWrapper.className += ' ' + newContent.className;
        }
        
        // Move all children from body to wrapper
        while (newContent.firstChild) {
          pageWrapper.appendChild(newContent.firstChild);
        }
        
        // Hide all existing pages
        const existingPages = spaContent.querySelectorAll('.spa-page');
        existingPages.forEach(p => {
          p.style.display = 'none';
          // Remove pages that aren't home to keep DOM clean
          if (p.dataset.page !== 'home') {
            p.remove();
          }
        });
        
        // Add new page
        spaContent.appendChild(pageWrapper);
        
        // Update title
        const title = doc.querySelector('title');
        if (title) {
          document.title = title.textContent;
        }
        
        // Update meta description
        const metaDesc = doc.querySelector('meta[name="description"]');
        if (metaDesc) {
          let existingMeta = document.querySelector('meta[name="description"]');
          if (existingMeta) {
            existingMeta.content = metaDesc.content;
          }
        }
        
        // Initialize page-specific scripts
        if (window.PageInitializers && window.PageInitializers[route.page]) {
          window.PageInitializers[route.page]();
        }
        
        updateActiveNav(route.page);
        currentPage = route.page;
        
        if (pushState) {
          history.pushState({ page: route.page }, '', url);
        }
        
        window.scrollTo(0, 0);
      }
    } catch (error) {
      console.error('Error loading page:', error);
      // Fallback to traditional navigation
      window.location.href = url;
    } finally {
      hideLoader();
    }
  }

  /* ---------------------------------------------------------------
     Event Handlers
  --------------------------------------------------------------- */
  function handleLinkClick(e) {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // External links
    if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }

    // Let modifier-key clicks open in a new tab as usual
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;

    const normalizedHref = normalizePath(href);

    // Check if it's a route we handle
    const route = getRoute(normalizedHref);
    if (route) {
      e.preventDefault();
      loadPage(normalizedHref);
    }
  }

  function handlePopState(e) {
    const path = normalizePath(window.location.pathname);
    loadPage(path, false);
  }

  /* ---------------------------------------------------------------
     Initialization
  --------------------------------------------------------------- */
  function init() {
    // Intercept link clicks
    document.addEventListener('click', handleLinkClick);

    // Handle browser back/forward
    window.addEventListener('popstate', handlePopState);

    // Store current page
    const path = normalizePath(window.location.pathname);
    const route = getRoute(path);
    if (route) {
      currentPage = route.page;
      updateActiveNav(route.page);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose router API
  window.SPARouter = {
    navigate: loadPage,
    getCurrentPage: () => currentPage
  };
})();
