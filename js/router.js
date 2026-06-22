/* =====================================================================
   IdeanaX — True SPA Router
   Handles client-side navigation with persistent header/footer.
   Only the main content area (#spa-content) changes between routes.
   ===================================================================== */

(function () {
  'use strict';

  // Route configuration mapping URLs to route names
  // Using relative paths for GitHub Pages subdirectory support
  const ROUTES = {
    '/': 'home',
    './': 'home',
    'index.html': 'home',
    '/index.html': 'home',
    'prompts.html': 'prompts',
    '/prompts.html': 'prompts',
    'tools.html': 'tools',
    '/tools.html': 'tools',
    'assets.html': 'assets',
    '/assets.html': 'assets',
    'blog.html': 'blog',
    '/blog.html': 'blog',
    'about.html': 'about',
    '/about.html': 'about',
    'contact.html': 'contact',
    '/contact.html': 'contact',
    'faq.html': 'faq',
    '/faq.html': 'faq',
    'privacy.html': 'privacy',
    '/privacy.html': 'privacy',
    'terms.html': 'terms',
    '/terms.html': 'terms',
    'disclaimer.html': 'disclaimer',
    '/disclaimer.html': 'disclaimer'
  };

  // Page metadata for each route
  const PAGE_META = {
    home: { 
      title: 'IdeanaX — Discover AI Prompts & Creator Resources', 
      css: 'styles.css', 
      js: 'script.js'
    },
    prompts: { 
      title: 'IdeanaX — AI Prompts Directory', 
      css: 'prompts.css', 
      js: 'prompts.js'
    },
    tools: { 
      title: 'IdeanaX — AI Tools Directory', 
      css: 'tools.css', 
      js: 'tools.js'
    },
    assets: { 
      title: 'IdeanaX — Digital Assets Marketplace', 
      css: 'assets.css', 
      js: 'assets.js'
    },
    blog: { 
      title: 'IdeanaX — Blog & Guides', 
      css: 'blog.css', 
      js: 'blog.js'
    },
    about: { 
      title: 'About Us — IdeanaX', 
      css: 'about.css', 
      js: 'about.js'
    },
    contact: { 
      title: 'Contact Us — IdeanaX', 
      css: 'contact.css', 
      js: 'contact.js'
    },
    faq: { 
      title: 'FAQ — IdeanaX', 
      css: 'faq.css', 
      js: 'faq.js'
    },
    privacy: { 
      title: 'Privacy Policy — IdeanaX', 
      css: 'privacy.css', 
      js: 'privacy.js'
    },
    terms: { 
      title: 'Terms of Service — IdeanaX', 
      css: 'terms.css', 
      js: 'terms.js'
    },
    disclaimer: { 
      title: 'Disclaimer — IdeanaX', 
      css: 'disclaimer.css', 
      js: 'disclaimer.js'
    }
  };

  class Router {
    constructor() {
      this.currentRoute = null;
      this.currentCSS = [];
      this.currentJS = [];
      this.isNavigating = false;
      this.cache = new Map();
      this.spaContent = document.getElementById('spa-content');
      this.loader = document.getElementById('spa-loader');
      this.mainNavbar = document.getElementById('main-navbar');
      this.mainFooter = document.getElementById('main-footer');
    }

    init() {
      // Get initial route
      const path = window.location.pathname;
      const routeName = this.getRouteName(path);
      this.currentRoute = routeName;

      // Setup event listeners
      this.setupLinkInterception();
      this.setupPopState();

      // Load initial page content
      this.loadInitialContent(routeName);

      console.log('[SPA Router] Initialized on route:', routeName);
    }

    async loadInitialContent(routeName) {
      // Home route content is embedded in index.html, skip fetch
      if (routeName === 'home') {
        this.currentRoute = routeName;
        this.updateActiveNav(routeName);
        this.updateMeta(routeName);
        this.initializePage(routeName);
        return;
      }

      // Fetch content from the page file using relative path
      const targetPath = this.getFileForRoute(routeName);
      try {
        this.showLoader();
        const pageContent = await this.fetchPage(targetPath);
        const content = this.extractContent(pageContent, routeName);

        // Cleanup (if any)
        this.cleanupPage();

        // Update DOM content
        this.updateContent(content, routeName);

        // Load new assets
        await this.loadRouteAssets(routeName);

        // Update navigation states
        this.updateActiveNav(routeName);
        this.updateMeta(routeName);

        // Initialize new page
        this.initializePage(routeName);

        this.hideLoader();
      } catch (error) {
        console.error('[SPA Router] Failed to load initial content:', error);
        this.hideLoader();
        // Show error message in content area
        this.spaContent.innerHTML = '<div class="spa-page"><div style="padding:4rem;text-align:center;"><h2>Page not found</h2><p>The requested page could not be loaded.</p></div></div>';
      }
    }

    getFileForRoute(routeName) {
      const fileMap = {
        'home': 'index.html',
        'prompts': 'prompts.html',
        'tools': 'tools.html',
        'assets': 'assets.html',
        'blog': 'blog.html',
        'about': 'about.html',
        'contact': 'contact.html',
        'faq': 'faq.html',
        'privacy': 'privacy.html',
        'terms': 'terms.html',
        'disclaimer': 'disclaimer.html'
      };
      return fileMap[routeName] || 'index.html';
    }

    getRouteName(path) {
      // Handle root path and empty path
      if (path === '/' || path === '' || path === './') return 'home';

      // Remove leading ./ if present
      const cleanPath = path.replace(/^\.\//, '');

      // Remove leading / if present for lookup
      const lookupPath = cleanPath.replace(/^\//, '');

      // Try direct lookup, then with leading /, then just the filename
      return ROUTES[cleanPath] || ROUTES[lookupPath] || ROUTES['/' + lookupPath] || 'home';
    }

    getPathForRoute(routeName) {
      // Reverse lookup - prefer relative paths (no leading /)
      for (const [path, name] of Object.entries(ROUTES)) {
        if (name === routeName && !path.startsWith('/')) {
          return path;
        }
      }
      // Fallback to root-relative if no relative found
      for (const [path, name] of Object.entries(ROUTES)) {
        if (name === routeName) {
          return path;
        }
      }
      return './';
    }

    setupLinkInterception() {
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href');
        
        // Skip if marked with data-nav (we handle these specially)
        if (link.hasAttribute('data-nav')) {
          e.preventDefault();
          this.navigate(href);
          return;
        }

        // Skip external links, anchors, and special links
        if (this.shouldIgnoreLink(href, link)) return;

        // Check if it's a known route
        const routeName = this.getRouteName(href);
        if (routeName && routeName !== this.getRouteName(window.location.pathname)) {
          e.preventDefault();
          this.navigate(href);
        }
      });
    }

    shouldIgnoreLink(href, link) {
      // Skip if it has a target
      if (link.target && link.target !== '_self') return true;
      
      // Skip external links
      if (href.startsWith('http') || href.startsWith('//')) return true;
      
      // Skip anchors and javascript
      if (href.startsWith('#') || href.startsWith('javascript:')) return true;
      
      // Skip download links
      if (link.hasAttribute('download')) return true;
      
      // Skip links to non-HTML files
      if (/\.(pdf|zip|jpg|jpeg|png|gif|svg|mp4|webm)$/i.test(href)) return true;

      return false;
    }

    setupPopState() {
      window.addEventListener('popstate', (e) => {
        const path = window.location.pathname;
        const routeName = this.getRouteName(path);

        if (routeName !== this.currentRoute) {
          // Use relative path for loadRoute
          const relativePath = routeName === 'home' ? './' : this.getFileForRoute(routeName);
          this.loadRoute(relativePath, false);
        }
      });
    }

    navigate(href) {
      if (this.isNavigating) return;

      const currentPath = window.location.pathname;
      // Handle relative paths - convert to absolute for comparison
      const targetPath = href.startsWith('/') ? href : (href.startsWith('./') ? href.substring(1) : '/' + href);

      // Don't navigate to same page
      if (currentPath === targetPath ||
          (currentPath === '/' && (targetPath === '/index.html' || targetPath === 'index.html')) ||
          (currentPath === '/index.html' && (targetPath === '/' || targetPath === '')) ||
          (currentPath.endsWith(targetPath))) {
        return;
      }

      this.loadRoute(href, true);
    }

    async loadRoute(href, pushState = true) {
      if (this.isNavigating) return;
      this.isNavigating = true;

      // Use relative path directly
      const targetPath = href.startsWith('/') ? href.replace(/^\//, '') : href.replace(/^\.\//, '');
      const routeName = this.getRouteName(targetPath);

      try {
        this.showLoader();
        this.startFadeOut();

        // Small delay for visual transition
        await this.delay(150);

        // Handle home route specially - content is embedded
        if (routeName === 'home') {
          // Cleanup previous page
          this.cleanupPage();

          // Clear spa-content to show embedded home content
          this.spaContent.innerHTML = '';

          // Update URL
          if (pushState) {
            window.history.pushState({}, '', './');
          }

          // Update navigation states on persistent navbar/footer
          this.updateActiveNav(routeName);

          // Update meta tags
          this.updateMeta(routeName);

          // Initialize new page
          this.initializePage(routeName);

          // Fade in
          this.startFadeIn();
          await this.delay(200);
          this.hideLoader();

          // Update current route
          this.currentRoute = routeName;

          // Scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });

          this.isNavigating = false;
          return;
        }

        // Check cache first
        let pageContent;
        if (this.cache.has(targetPath)) {
          pageContent = this.cache.get(targetPath);
        } else {
          pageContent = await this.fetchPage(targetPath);
          // Cache the content
          this.cache.set(targetPath, pageContent);
        }

        // Parse and extract content (without navbar/footer)
        const content = this.extractContent(pageContent, routeName);

        // Update URL - use relative path for GitHub Pages subdirectory support
        if (pushState) {
          window.history.pushState({}, '', targetPath);
        }

        // Cleanup previous page
        this.cleanupPage();

        // Update DOM content
        this.updateContent(content, routeName);

        // Load new assets
        await this.loadRouteAssets(routeName);

        // Update navigation states on persistent navbar/footer
        this.updateActiveNav(routeName);

        // Update meta tags
        this.updateMeta(routeName);

        // Initialize new page
        this.initializePage(routeName);

        // Fade in
        this.startFadeIn();
        await this.delay(200);
        this.hideLoader();

        // Update current route
        this.currentRoute = routeName;

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } catch (error) {
        console.error('[SPA Router] Navigation failed:', error);
        // Fall back to full page load
        window.location.href = href;
      } finally {
        this.isNavigating = false;
      }
    }

    async fetchPage(url) {
      // Use relative path for GitHub Pages subdirectory support
      // Remove leading / or ./ if present to ensure relative path
      const fetchUrl = url.replace(/^[\/]/, '').replace(/^\.\//, '');

      const response = await fetch(fetchUrl, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${fetchUrl}: ${response.status}`);
      }

      return await response.text();
    }

    extractContent(html, routeName) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Try to find spa-page content first
      const spaPage = doc.querySelector('.spa-page');
      if (spaPage) {
        // Extract content from inside spa-page, excluding navbar and footer
        let mainContent = '';
        // Convert HTMLCollection to Array for proper iteration
        const children = Array.from(spaPage.children);
        
        let skipUntilFooter = false;
        
        for (let child of children) {
          // Skip navbar/header elements (everything until we hit the first non-navbar element)
          if (child.classList.contains('navbar') || 
              child.tagName === 'HEADER' ||
              child.classList.contains('nav-inner')) {
            skipUntilFooter = false;
            continue;
          }
          
          // Stop at footer and skip everything after
          if (child.classList.contains('footer') || 
              child.tagName === 'FOOTER') {
            skipUntilFooter = true;
            continue;
          }
          
          if (skipUntilFooter) {
            continue;
          }
          
          mainContent += child.outerHTML;
        }
        
        return {
          content: mainContent,
          title: doc.title,
          meta: doc.querySelector('meta[name="description"]')?.content || ''
        };
      }

      // Fallback: extract content between navbar and footer from body
      const body = doc.body;
      let mainContent = '';
      let collecting = false;
      let skipUntilFooter = false;
      
      const children = Array.from(body.children);
      for (let child of children) {
        // Skip scripts, loader, etc.
        if (child.tagName === 'SCRIPT') continue;
        if (child.id === 'spa-loader') continue;
        
        // Start collecting after navbar
        if (child.classList.contains('navbar') || child.id === 'main-navbar') {
          collecting = true;
          skipUntilFooter = false;
          continue;
        }
        
        // Stop collecting at footer
        if (child.classList.contains('footer') || child.id === 'main-footer') {
          skipUntilFooter = true;
          break;
        }
        
        if (skipUntilFooter) continue;
        
        // Handle spa-content wrapper
        if (child.id === 'spa-content') {
          const innerPage = child.querySelector('.spa-page');
          if (innerPage) {
            // Extract from inner spa-page, excluding navbar/footer
            const innerChildren = Array.from(innerPage.children);
            let innerSkipUntilFooter = false;
            for (let innerChild of innerChildren) {
              if (innerChild.classList.contains('navbar') || 
                  innerChild.classList.contains('footer') ||
                  innerChild.tagName === 'HEADER' ||
                  innerChild.tagName === 'FOOTER') {
                innerSkipUntilFooter = (innerChild.classList.contains('footer') || innerChild.tagName === 'FOOTER');
                continue;
              }
              if (innerSkipUntilFooter) continue;
              mainContent += innerChild.outerHTML;
            }
          } else {
            mainContent = child.innerHTML;
          }
          break;
        }
        
        if (collecting) {
          mainContent += child.outerHTML;
        }
      }

      return {
        content: mainContent,
        title: doc.title,
        meta: doc.querySelector('meta[name="description"]')?.content || ''
      };
    }

    updateContent(contentObj, routeName) {
      if (!this.spaContent) {
        console.error('[SPA Router] spa-content element not found');
        return;
      }

      // Create spa-page wrapper for the content
      const meta = PAGE_META[routeName] || PAGE_META.home;
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'spa-page';
      pageWrapper.dataset.page = routeName;
      pageWrapper.dataset.title = meta.title;
      pageWrapper.innerHTML = contentObj.content;

      // Clear and update content
      this.spaContent.innerHTML = '';
      this.spaContent.appendChild(pageWrapper);
    }

    async loadRouteAssets(routeName) {
      const meta = PAGE_META[routeName];
      if (!meta) return;

      // Load CSS
      if (meta.css) {
        await this.loadCSS(meta.css);
        this.currentCSS.push(meta.css);
      }

      // Load JS
      if (meta.js) {
        await this.loadJS(meta.js);
        this.currentJS.push(meta.js);
      }
    }

    loadCSS(href) {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (document.querySelector(`link[href="${href}"]`)) {
          resolve();
          return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        link.onerror = () => {
          // Don't fail on CSS load errors
          console.warn('[SPA Router] Failed to load CSS:', href);
          resolve();
        };
        document.head.appendChild(link);
      });
    }

    unloadCSS(href) {
      // Don't unload styles.css as it's the base stylesheet
      if (href === 'styles.css') return;
      
      const link = document.querySelector(`link[href="${href}"]`);
      if (link) {
        link.remove();
      }
    }

    loadJS(src) {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = resolve;
        script.onerror = () => {
          // Don't fail on JS load errors (some pages might not have JS)
          console.warn('[SPA Router] Failed to load JS:', src);
          resolve();
        };
        document.body.appendChild(script);
      });
    }

    cleanupPage() {
      // Unload previous CSS (except styles.css which is shared)
      this.currentCSS.forEach(css => {
        this.unloadCSS(css);
      });
      this.currentCSS = [];

      // Remove old scripts from body
      this.currentJS.forEach(js => {
        const script = document.querySelector(`script[src="${js}"]`);
        if (script) {
          script.remove();
        }
      });
      this.currentJS = [];

      // Clear any intervals or timeouts from previous page
      if (window.PageCleanups && window.PageCleanups[this.currentRoute]) {
        try {
          window.PageCleanups[this.currentRoute]();
        } catch (e) {
          console.warn('[SPA Router] Cleanup error:', e);
        }
      }
    }

    initializePage(routeName) {
      // Wait for scripts to load then initialize
      setTimeout(() => {
        if (window.PageInitializers && window.PageInitializers[routeName]) {
          try {
            window.PageInitializers[routeName]();
            console.log('[SPA Router] Initialized page:', routeName);
          } catch (e) {
            console.error('[SPA Router] Page init error:', e);
          }
        } else {
          // Try to find and execute inline scripts
          this.executeInlineScripts();
        }
      }, 50);
    }

    executeInlineScripts() {
      const scripts = this.spaContent.querySelectorAll('script');
      scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    }

    updateActiveNav(routeName) {
      // Using relative paths for GitHub Pages subdirectory support
      const pathMap = {
        'home': './',
        'prompts': 'prompts.html',
        'tools': 'tools.html',
        'assets': 'assets.html',
        'blog': 'blog.html',
        'about': 'about.html',
        'contact': 'contact.html',
        'faq': 'faq.html',
        'privacy': 'privacy.html',
        'terms': 'terms.html',
        'disclaimer': 'disclaimer.html'
      };

      const activePath = pathMap[routeName];

      // Update navbar links
      if (this.mainNavbar) {
        this.mainNavbar.querySelectorAll('.nav-links a').forEach(link => {
          link.classList.remove('active');
          const linkHref = link.getAttribute('href');
          // Normalize href for comparison
          const normalizedHref = linkHref?.replace(/^[\/]/, '').replace(/^\.\//, '');
          const normalizedActive = activePath?.replace(/^[\/]/, '').replace(/^\.\//, '');
          if (normalizedHref === normalizedActive ||
              (routeName === 'home' && (linkHref === '/' || linkHref === './' || linkHref === 'index.html' || linkHref === '/index.html'))) {
            link.classList.add('active');
          }
        });
      }

      // Update footer links
      if (this.mainFooter) {
        this.mainFooter.querySelectorAll('a').forEach(link => {
          link.classList.remove('footer-active');
          const linkHref = link.getAttribute('href');
          // Normalize href for comparison
          const normalizedHref = linkHref?.replace(/^[\/]/, '').replace(/^\.\//, '');
          const normalizedActive = activePath?.replace(/^[\/]/, '').replace(/^\.\//, '');
          if (normalizedHref === normalizedActive ||
              (routeName === 'home' && (linkHref === '/' || linkHref === './' || linkHref === 'index.html' || linkHref === '/index.html'))) {
            link.classList.add('footer-active');
          }
        });
      }
    }

    updateMeta(routeName) {
      const meta = PAGE_META[routeName];
      if (meta) {
        document.title = meta.title;
      }
    }

    showLoader() {
      if (this.loader) {
        this.loader.classList.add('is-visible');
      }
    }

    hideLoader() {
      if (this.loader) {
        this.loader.classList.remove('is-visible');
      }
    }

    startFadeOut() {
      if (this.spaContent) {
        this.spaContent.classList.add('is-fading-out');
        this.spaContent.classList.remove('is-fading-in');
      }
    }

    startFadeIn() {
      if (this.spaContent) {
        this.spaContent.classList.remove('is-fading-out');
        this.spaContent.classList.add('is-fading-in');
      }
    }

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // Initialize router when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.spaRouter = new Router();
      window.spaRouter.init();
    });
  } else {
    window.spaRouter = new Router();
    window.spaRouter.init();
  }

  // Expose Router class for potential extensions
  window.SPARouter = Router;
})();
