/* =====================================================================
   mxo.me — Image Converter Implementation
   image-converter.js — handles client-side image loading, Canvas conversion,
   quality adjustments, live previews, metadata rendering, downloads, and
   AI-powered background removal with multiple fallback providers.
   ===================================================================== */

(function() {
  'use strict';

  function initImageConverterPage() {
    // DOM Element References
    const dropZone          = document.getElementById('dropZone');
    const fileInput         = document.getElementById('fileInput');
    const formatSelect      = document.getElementById('formatSelect');
    const qualitySlider     = document.getElementById('qualitySlider');
    const qualityVal        = document.getElementById('qualityVal');
    const qualityGroup      = document.getElementById('qualityGroup');
    const removeBgToggle    = document.getElementById('removeBgToggle');
    const bgRemovalOptions  = document.getElementById('bgRemovalOptions');
    const processingMode    = document.getElementById('processingMode');
    const edgeRefinementSlider = document.getElementById('edgeRefinementSlider');
    const comparisonToggle  = document.getElementById('comparisonToggle');
    const providerStatus    = document.getElementById('providerStatus');
    const progressOverlay   = document.getElementById('progressOverlay');
    const progressTitle     = document.getElementById('progressTitle');
    const progressSteps     = document.getElementById('progressSteps');
    const progressDetails   = document.getElementById('progressDetails');
    const emptyState        = document.getElementById('emptyState');
    const previewState      = document.getElementById('previewState');
    const origName          = document.getElementById('origName');
    const origDims          = document.getElementById('origDims');
    const origSize          = document.getElementById('origSize');
    const origFormat        = document.getElementById('origFormat');
    const origImgPreview    = document.getElementById('origImgPreview');
    const newFormat         = document.getElementById('newFormat');
    const newSize           = document.getElementById('newSize');
    const conversionStatus  = document.getElementById('conversionStatus');
    const newImgPreview     = document.getElementById('newImgPreview');
    const singleImgPreview  = document.getElementById('singleImgPreview');
    const beforeImgPreview  = document.getElementById('beforeImgPreview');
    const comparisonContainer = document.getElementById('comparisonContainer');
    const normalPreview     = document.getElementById('normalPreview');
    const comparisonHandle  = document.getElementById('comparisonHandle');
    const savingsPct        = document.getElementById('savingsPct');
    const downloadBtn       = document.getElementById('downloadBtn');

    if (!dropZone) return; // Guard for SPA context swaps

    // State container to hold current active conversion details
    const state = {
      originalFile: null,
      originalImg: null,
      originalUrl: null,
      bgRemovedImg: null,
      bgRemovedUrl: null,
      convertedBlob: null,
      convertedUrl: null,
      processingMode: 'balanced',
      edgeRefinement: 50,
      comparisonEnabled: false,
      isProcessing: false,
      abortController: null,
      cleanupUrls: []
    };

    // Provider configurations using only providers that actually work
    // 1. Imgly (primary) — uses @imgly/background-removal from CDN
    // 2. Smart Edge Canvas (fallback) — edge-detection based segmentation
    // 3. Color Key Canvas (final fallback) — color-based background removal
    const PROVIDERS = [
      {
        name: 'Imgly AI',
        url: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.0/dist/index.mjs',
        type: 'imgly',
        description: 'Deep learning model (online)'
      },
      {
        name: 'Smart Edge',
        type: 'canvas-edge',
        url: null,
        description: 'Edge detection (offline)'
      },
      {
        name: 'Color Key',
        type: 'canvas-color',
        url: null,
        description: 'Color sampling (offline)'
      }
    ];

    /* -----------------------------------------------------------------
       Background Removal Manager
       ----------------------------------------------------------------- */
    class BackgroundRemovalManager {
      constructor() {
        this.providers = PROVIDERS;
        this.currentProviderIndex = -1;
        this.onProgress = null;
        this.onProviderChange = null;
        this.maxImageSize = 2048;
        this.imglyModule = null;
        this.imglyLoading = false;
        this.imglyLoadPromise = null;
      }

      setProgressCallback(callback) {
        this.onProgress = callback;
      }

      setProviderChangeCallback(callback) {
        this.onProviderChange = callback;
      }

      updateProgress(step, message, details = '') {
        if (this.onProgress) {
          this.onProgress({ step, message, details });
        }
      }

      updateProviderUI(index, status) {
        if (this.onProviderChange) {
          this.onProviderChange(index, status);
        }
      }

      async preprocessImage(imageUrl) {
        this.updateProgress(1, 'Preprocessing', 'Analyzing image dimensions...');

        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';

          img.onload = () => {
            let { naturalWidth: width, naturalHeight: height } = img;

            // Resize if image is too large (prevents OOM on mobile)
            if (width > this.maxImageSize || height > this.maxImageSize) {
              const ratio = Math.min(this.maxImageSize / width, this.maxImageSize / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);

              this.updateProgress(1, 'Preprocessing', `Resizing image to ${width}×${height}...`);

              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);

              canvas.toBlob((blob) => {
                resolve(URL.createObjectURL(blob));
              }, 'image/png');
            } else {
              this.updateProgress(1, 'Preprocessing', `Image size ${width}×${height} is optimal.`);
              resolve(imageUrl);
            }
          };

          img.onerror = () => reject(new Error('Failed to load image for preprocessing'));
          img.src = imageUrl;
        });
      }

      async loadImglyModule() {
        if (this.imglyModule) return this.imglyModule;
        if (this.imglyLoading) return this.imglyLoadPromise;

        this.imglyLoading = true;
        this.imglyLoadPromise = (async () => {
          try {
            const mod = await import(PROVIDERS[0].url);
            // The library exports 'removeBackground' directly at module level
            this.imglyModule = mod.removeBackground || mod.default?.removeBackground || mod;
            return this.imglyModule;
          } catch (err) {
            this.imglyLoading = false;
            this.imglyModule = null;
            this.imglyLoadPromise = null;
            throw err;
          }
        })();

        const result = await this.imglyLoadPromise;
        this.imglyLoading = false;
        return result;
      }

      async removeWithImgly(imageUrl, mode) {
        const removeBackground = await this.loadImglyModule();

        const options = {
          progress: (progressInfo) => {
            // Imgly v1.4+ progress callback receives an object: { type: string, percent: number }
            // Some versions also pass { type, current, total }
            let percent = 0;
            if (typeof progressInfo === 'number') {
              percent = Math.round(progressInfo * 100);
            } else if (progressInfo.percent !== undefined) {
              percent = typeof progressInfo.percent === 'number'
                ? Math.round(progressInfo.percent * 100)
                : Math.round(progressInfo.percent);
            } else if (progressInfo.current !== undefined && progressInfo.total > 0) {
              percent = Math.round((progressInfo.current / progressInfo.total) * 100);
            }

            const phase = progressInfo.type || 'processing';
            this.updateProgress(3, 'Segmenting', `Imgly AI: ${phase} — ${percent}%`);
          },
          device: mode === 'fast' ? 'cpu' : (mode === 'quality' ? 'gpu' : 'gpu'),
          model: mode === 'quality' ? 'large' : 'medium',
          output: { format: 'image/png' }
        };

        return await removeBackground(imageUrl, options);
      }

      async removeWithCanvasEdge(imageUrl) {
        this.updateProgress(3, 'Segmenting', 'Smart Edge: Analyzing edges...');

        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = imageUrl;
        });

        const canvas = document.createElement('canvas');
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        this.updateProgress(3, 'Segmenting', 'Smart Edge: Computing edge mask...');

        // Step 1: Convert to grayscale
        const gray = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            gray[y * w + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          }
        }

        // Step 2: Compute Sobel gradient magnitude
        const grad = new Float32Array(w * h);
        let maxGrad = 0;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            const gx =
              -gray[idx - w - 1] + gray[idx - w + 1]
              - 2 * gray[idx - 1] + 2 * gray[idx + 1]
              - gray[idx + w - 1] + gray[idx + w + 1];

            const gy =
              -gray[idx - w - 1] - 2 * gray[idx - w] - gray[idx - w + 1]
              + gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1];

            const magnitude = Math.sqrt(gx * gx + gy * gy);
            grad[idx] = magnitude;
            if (magnitude > maxGrad) maxGrad = magnitude;
          }
        }

        this.updateProgress(3, 'Segmenting', 'Smart Edge: Segmenting subject from background...');

        // Step 3: Flood-fill from center to find the subject
        // Pixels with gradient below threshold are "fillable"
        const edgeThreshold = maxGrad * 0.08;
        const visited = new Uint8Array(w * h);
        const centerX = Math.floor(w / 2);
        const centerY = Math.floor(h / 2);

        // Use iterative stack-based flood fill
        const stack = [[centerX, centerY]];
        const maxFill = Math.floor(w * h * 0.85);

        while (stack.length > 0) {
          const [cx, cy] = stack.pop();
          if (cx < 1 || cx >= w - 1 || cy < 1 || cy >= h - 1) continue;
          const idx = cy * w + cx;
          if (visited[idx]) continue;
          if (grad[idx] > edgeThreshold) continue;
          visited[idx] = 1;

          if (visited.reduce((a, b) => a + b, 0) > maxFill) break;

          stack.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
        }

        // Step 4: Apply mask
        for (let i = 0; i < w * h; i++) {
          if (!visited[i]) {
            data[i * 4 + 3] = 0;
          }
        }

        // Step 5: Edge feathering for smoother transitions
        this.updateProgress(4, 'Refining Edges', 'Smart Edge: Feathering edges...');
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            if (data[idx + 3] === 0) continue;

            let bgNeighbors = 0;
            if (data[((y) * w + (x - 1)) * 4 + 3] === 0) bgNeighbors++;
            if (data[((y) * w + (x + 1)) * 4 + 3] === 0) bgNeighbors++;
            if (data[((y - 1) * w + (x)) * 4 + 3] === 0) bgNeighbors++;
            if (data[((y + 1) * w + (x)) * 4 + 3] === 0) bgNeighbors++;

            if (bgNeighbors > 0) {
              data[idx + 3] = Math.round(data[idx + 3] * (1 - bgNeighbors * 0.2));
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
      }

      async removeWithCanvasColor(imageUrl) {
        this.updateProgress(3, 'Segmenting', 'Color Key: Sampling background colors...');

        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = imageUrl;
        });

        const canvas = document.createElement('canvas');
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        this.updateProgress(3, 'Segmenting', 'Color Key: Detecting dominant background...');

        // Sample corners to identify background color
        const sampleSize = Math.max(3, Math.floor(Math.min(w, h) * 0.025));
        const cornerOffsets = [
          { x: Math.floor(w * 0.05), y: Math.floor(h * 0.05) },
          { x: Math.floor(w * 0.95), y: Math.floor(h * 0.05) },
          { x: Math.floor(w * 0.05), y: Math.floor(h * 0.95) },
          { x: Math.floor(w * 0.95), y: Math.floor(h * 0.95) },
          { x: Math.floor(w * 0.50), y: Math.floor(h * 0.05) },  // top edge center
          { x: Math.floor(w * 0.50), y: Math.floor(h * 0.95) },  // bottom edge center
          { x: Math.floor(w * 0.05), y: Math.floor(h * 0.50) },  // left edge center
          { x: Math.floor(w * 0.95), y: Math.floor(h * 0.50) }   // right edge center
        ];

        // Collect all sample pixels
        const samples = [];
        for (const offset of cornerOffsets) {
          for (let dy = -sampleSize; dy <= sampleSize; dy++) {
            for (let dx = -sampleSize; dx <= sampleSize; dx++) {
              const sx = Math.min(w - 1, Math.max(0, offset.x + dx));
              const sy = Math.min(h - 1, Math.max(0, offset.y + dy));
              const idx = (sy * w + sx) * 4;
              samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
            }
          }
        }

        // Compute average background color
        let bgR = 0, bgG = 0, bgB = 0;
        for (const s of samples) {
          bgR += s.r;
          bgG += s.g;
          bgB += s.b;
        }
        bgR = Math.round(bgR / samples.length);
        bgG = Math.round(bgG / samples.length);
        bgB = Math.round(bgB / samples.length);

        // Compute color variance for adaptive threshold
        let variance = 0;
        for (const s of samples) {
          variance += Math.pow(s.r - bgR, 2) + Math.pow(s.g - bgG, 2) + Math.pow(s.b - bgB, 2);
        }
        variance = Math.sqrt(variance / samples.length);

        // Adaptive threshold: tighter for uniform backgrounds, wider for noisy ones
        const threshold = Math.max(25, Math.min(90, variance * 1.8));

        this.updateProgress(3, 'Segmenting', `Color Key: Applying threshold (${threshold.toFixed(0)})...`);

        // Apply mask based on color distance from background
        for (let i = 0; i < w * h; i++) {
          const idx = i * 4;
          const dr = data[idx] - bgR;
          const dg = data[idx + 1] - bgG;
          const db = data[idx + 2] - bgB;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);

          if (dist < threshold) {
            data[idx + 3] = 0;
          }
        }

        // Edge feathering
        this.updateProgress(4, 'Refining Edges', 'Color Key: Feathering edges...');
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            if (data[idx + 3] === 0) continue;

            let bgNeighbors = 0;
            if (data[((y) * w + (x - 1)) * 4 + 3] === 0) bgNeighbors++;
            if (data[((y) * w + (x + 1)) * 4 + 3] === 0) bgNeighbors++;
            if (data[((y - 1) * w + (x)) * 4 + 3] === 0) bgNeighbors++;
            if (data[((y + 1) * w + (x)) * 4 + 3] === 0) bgNeighbors++;

            if (bgNeighbors > 0) {
              data[idx + 3] = Math.round(data[idx + 3] * (1 - bgNeighbors * 0.15));
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
      }

      applyEdgeRefinement(canvas, refinementLevel) {
        if (refinementLevel <= 0) return canvas;

        this.updateProgress(4, 'Refining Edges', `Applying edge smoothing (${refinementLevel}%)...`);

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Kernel radius grows with refinement level
        const radius = Math.max(1, Math.min(5, Math.round(refinementLevel / 20)));
        const tempData = new Uint8ClampedArray(data);

        for (let y = radius; y < height - radius; y++) {
          for (let x = radius; x < width - radius; x++) {
            const idx = (y * width + x) * 4;
            const centerAlpha = tempData[idx + 3];
            if (centerAlpha === 0) continue;

            // Check if this pixel is near an alpha edge
            let isEdgePixel = false;
            edgeCheck:
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dy === 0 && dx === 0) continue;
                const nIdx = ((y + dy) * width + (x + dx)) * 4 + 3;
                if (nIdx >= 0 && nIdx < tempData.length) {
                  if (Math.abs(tempData[nIdx] - centerAlpha) > 40) {
                    isEdgePixel = true;
                    break edgeCheck;
                  }
                }
              }
            }

            if (isEdgePixel) {
              // Weighted average of neighboring foreground pixels
              let r = 0, g = 0, b = 0, a = 0, totalWeight = 0;

              for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                  if (dy === 0 && dx === 0) {
                    // Give center pixel full weight
                    r += tempData[idx] * 255;
                    g += tempData[idx + 1] * 255;
                    b += tempData[idx + 2] * 255;
                    a += tempData[idx + 3] * 255;
                    totalWeight += 255;
                    continue;
                  }
                  const nIdx = ((y + dy) * width + (x + dx)) * 4;
                  if (nIdx >= 0 && nIdx + 3 < tempData.length && tempData[nIdx + 3] > 30) {
                    const alpha = tempData[nIdx + 3];
                    r += tempData[nIdx] * alpha;
                    g += tempData[nIdx + 1] * alpha;
                    b += tempData[nIdx + 2] * alpha;
                    a += alpha * alpha / 255;
                    totalWeight += alpha;
                  }
                }
              }

              if (totalWeight > 0) {
                data[idx] = Math.round(r / totalWeight);
                data[idx + 1] = Math.round(g / totalWeight);
                data[idx + 2] = Math.round(b / totalWeight);
                data[idx + 3] = Math.round(a / totalWeight * 255);
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
      }

      async process(imageUrl, mode = 'balanced', edgeRefinement = 50) {
        let processedUrl = null;
        let lastError = null;

        try {
          // Step 1: Preprocess (resize large images)
          processedUrl = await this.preprocessImage(imageUrl);

          // Step 2-4: Try providers in order (3 providers)
          for (let i = 0; i < this.providers.length; i++) {
            const provider = this.providers[i];
            this.currentProviderIndex = i;

            this.updateProviderUI(i, 'active');
            this.updateProgress(2, 'Loading AI Model', `${provider.name}: Starting...`);

            try {
              let blob;

              switch (provider.type) {
                case 'imgly': {
                  blob = await this.removeWithImgly(processedUrl, mode);
                  break;
                }
                case 'canvas-edge': {
                  this.updateProgress(2, 'Loading AI Model', `${provider.name}: Ready (no external dependencies)`);
                  blob = await this.removeWithCanvasEdge(processedUrl);
                  break;
                }
                case 'canvas-color': {
                  this.updateProgress(2, 'Loading AI Model', `${provider.name}: Ready (no external dependencies)`);
                  blob = await this.removeWithCanvasColor(processedUrl);
                  break;
                }
                default:
                  throw new Error(`Unknown provider type: ${provider.type}`);
              }

              // Step 4: Apply post-process edge refinement
              if (edgeRefinement > 0 && blob) {
                const blobUrl = URL.createObjectURL(blob);
                try {
                  const img = await new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = reject;
                    image.src = blobUrl;
                  });

                  const canvas = document.createElement('canvas');
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0);

                  this.applyEdgeRefinement(canvas, edgeRefinement);

                  blob = await new Promise((resolve) => {
                    canvas.toBlob((b) => resolve(b), 'image/png');
                  });
                } finally {
                  URL.revokeObjectURL(blobUrl);
                }
              }

              this.updateProgress(5, 'Finalizing', `${provider.name}: Background removal complete!`);
              this.updateProviderUI(i, 'success');

              return blob;

            } catch (error) {
              console.warn(`${provider.name} failed:`, error.message || error);
              lastError = error;
              this.updateProviderUI(i, 'error');
              // Continue to next provider
            }
          }

          throw new Error(
            `All background removal methods failed for this image. ` +
            (lastError ? `Last error: ${lastError.message}` : '')
          );

        } finally {
          if (processedUrl && processedUrl !== imageUrl) {
            URL.revokeObjectURL(processedUrl);
          }
        }
      }
    }

    // Initialize background removal manager
    const bgRemovalManager = new BackgroundRemovalManager();

    /* -----------------------------------------------------------------
       Utility Helpers
       ----------------------------------------------------------------- */
    function formatBytes(bytes, decimals = 1) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function cleanFileName(name) {
      return name.substring(0, name.lastIndexOf('.')) || name;
    }

    /* -----------------------------------------------------------------
       UI Update Functions
       ----------------------------------------------------------------- */
    function updateProgressUI(progress) {
      const steps = progressSteps.querySelectorAll('.progress-step');

      steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');

        if (stepNum < progress.step) {
          step.classList.add('completed');
        } else if (stepNum === progress.step) {
          step.classList.add('active');
        }
      });

      progressTitle.textContent = progress.message;
      progressDetails.textContent = progress.details;
    }

    function updateProviderUI(providerIndex, status = 'active') {
      const dots = providerStatus.querySelectorAll('.provider-dot');
      dots.forEach((dot, index) => {
        dot.classList.remove('active', 'success', 'error');
        if (index === providerIndex) {
          dot.classList.add(status);
        }
      });
    }

    function showProgressOverlay() {
      progressOverlay.style.display = 'flex';
      state.isProcessing = true;
    }

    function hideProgressOverlay() {
      progressOverlay.style.display = 'none';
      state.isProcessing = false;
      // Reset progress steps
      const steps = progressSteps.querySelectorAll('.progress-step');
      steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index === 0) step.classList.add('active');
      });
      progressTitle.textContent = 'Processing Image...';
      progressDetails.textContent = 'Preparing...';
    }

    function updateComparisonSlider(percentage) {
      const beforeLayer = comparisonContainer.querySelector('.comparison-before');
      const handle = comparisonHandle;

      beforeLayer.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
      handle.style.left = `${percentage}%`;
    }

    /* -----------------------------------------------------------------
       Interactive Event Handlers
       ----------------------------------------------------------------- */

    // Toggle quality control slider visibility based on output format
    function toggleQualityGroup() {
      const format = formatSelect.value;
      if (format === 'png') {
        qualityGroup.style.display = 'none';
      } else {
        qualityGroup.style.display = 'block';
      }
    }

    // Toggle background removal options panel
    removeBgToggle.addEventListener('change', () => {
      if (removeBgToggle.checked) {
        bgRemovalOptions.style.display = 'block';
        // Reset provider status dots
        const dots = providerStatus.querySelectorAll('.provider-dot');
        dots.forEach((dot, index) => {
          dot.classList.remove('success', 'error');
          if (index === 0) dot.classList.add('active');
        });
      } else {
        bgRemovalOptions.style.display = 'none';
        comparisonToggle.checked = false;
        updateComparisonView();
      }

      if (state.originalImg && !state.isProcessing) {
        performConversion();
      }
    });

    // Processing mode selection
    processingMode.querySelectorAll('.segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        processingMode.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.processingMode = btn.dataset.mode;

        if (state.originalImg && removeBgToggle.checked && !state.isProcessing) {
          performConversion();
        }
      });
    });

    // Edge refinement slider
    edgeRefinementSlider.addEventListener('change', () => {
      state.edgeRefinement = parseInt(edgeRefinementSlider.value);

      if (state.originalImg && removeBgToggle.checked && !state.isProcessing) {
        performConversion();
      }
    });

    // Comparison toggle
    comparisonToggle.addEventListener('change', () => {
      state.comparisonEnabled = comparisonToggle.checked;
      updateComparisonView();
    });

    function updateComparisonView() {
      if (state.comparisonEnabled && state.bgRemovedImg) {
        comparisonContainer.style.display = 'flex';
        normalPreview.style.display = 'none';
        beforeImgPreview.src = state.originalUrl;
        updateComparisonSlider(50);
      } else {
        comparisonContainer.style.display = 'none';
        normalPreview.style.display = 'flex';
      }
    }

    // Comparison slider interaction
    let isDragging = false;

    comparisonHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
    });
    comparisonHandle.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDragging = true;
    });

    document.addEventListener('mouseup', () => { isDragging = false; });
    document.addEventListener('touchend', () => { isDragging = false; });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      handleSliderMove(e.clientX);
    });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      if (e.touches.length > 0) {
        handleSliderMove(e.touches[0].clientX);
      }
    });

    function handleSliderMove(clientX) {
      const rect = comparisonContainer.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      updateComparisonSlider(percentage);
    }

    // Click to move slider
    comparisonContainer.addEventListener('click', (e) => {
      if (e.target === comparisonHandle || comparisonHandle.contains(e.target)) return;
      handleSliderMove(e.clientX);
    });

    // Trigger file selection on click
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    // Handle Drag over & Leave states
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelection(files[0]);
      }
    });

    // File input selection event
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });

    // Option changes trigger live reconversion
    formatSelect.addEventListener('change', () => {
      toggleQualityGroup();
      if (state.originalImg && !state.isProcessing) {
        performConversion();
      }
    });

    qualitySlider.addEventListener('input', (e) => {
      qualityVal.textContent = Math.round(e.target.value * 100) + '%';
    });

    qualitySlider.addEventListener('change', () => {
      if (state.originalImg && !state.isProcessing) {
        performConversion();
      }
    });

    // Download action handler
    downloadBtn.addEventListener('click', () => {
      if (!state.convertedBlob) return;

      const formatExtension = formatSelect.value === 'jpeg' ? 'jpg' : formatSelect.value;
      const outputName = `${cleanFileName(state.originalFile.name)}_converted.${formatExtension}`;

      const link = document.createElement('a');
      link.href = state.convertedUrl;
      link.download = outputName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    /* -----------------------------------------------------------------
       Core Loader & Converter Logic
       ----------------------------------------------------------------- */
    function handleFileSelection(file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload a valid image file.');
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        alert('File size exceeds the 20MB limit.');
        return;
      }

      // Reset previous state
      if (state.originalUrl) URL.revokeObjectURL(state.originalUrl);
      if (state.convertedUrl) URL.revokeObjectURL(state.convertedUrl);
      if (state.bgRemovedUrl) URL.revokeObjectURL(state.bgRemovedUrl);

      state.originalFile = file;
      state.convertedBlob = null;
      state.convertedUrl = null;
      state.bgRemovedImg = null;
      state.bgRemovedUrl = null;

      // Update UI metadata for original image
      origName.textContent = file.name;
      origSize.textContent = formatBytes(file.size);

      let rawFormat = file.type.split('/')[1] || 'unknown';
      if (rawFormat === 'jpeg') rawFormat = 'jpg';
      origFormat.textContent = rawFormat;

      // Start reading image
      state.originalUrl = URL.createObjectURL(file);
      origImgPreview.src = state.originalUrl;

      // Load image into memory for Canvas API
      const img = new Image();
      img.onload = function() {
        state.originalImg = img;
        origDims.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;

        // Hide empty placeholder and show previews
        emptyState.style.display = 'none';
        previewState.style.display = 'block';

        // Reset provider dots
        const dots = providerStatus.querySelectorAll('.provider-dot');
        dots.forEach((dot, index) => {
          dot.classList.remove('success', 'error', 'active');
          if (index === 0) dot.classList.add('active');
        });

        // Perform first conversion
        performConversion();
      };
      img.onerror = function() {
        alert('Error parsing uploaded image.');
      };
      img.src = state.originalUrl;
    }

    async function performConversion() {
      if (!state.originalImg || state.isProcessing) return;

      const removeBg = removeBgToggle.checked;
      let sourceImg = state.originalImg;

      // Show progress overlay if background removal is needed and not already cached
      if (removeBg && !state.bgRemovedImg) {
        showProgressOverlay();
        bgRemovalManager.setProgressCallback(updateProgressUI);
        bgRemovalManager.setProviderChangeCallback(updateProviderUI);

        try {
          const blob = await bgRemovalManager.process(
            state.originalUrl,
            state.processingMode,
            state.edgeRefinement
          );

          state.bgRemovedUrl = URL.createObjectURL(blob);
          state.bgRemovedImg = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load background-removed image'));
            img.src = state.bgRemovedUrl;
          });

        } catch (error) {
          console.error('Background removal failed:', error);

          // Show user-friendly error alert
          alert(
            `Background removal could not process this image.\n\n` +
            `${error.message || 'Unknown error'}\n\n` +
            `Please try with a different image or disable background removal.`
          );

          removeBgToggle.checked = false;
          bgRemovalOptions.style.display = 'none';
          sourceImg = state.originalImg;

          // Reset provider dots
          const dots = providerStatus.querySelectorAll('.provider-dot');
          dots.forEach(dot => dot.classList.remove('active', 'success', 'error'));
        } finally {
          hideProgressOverlay();
        }
      }

      if (removeBg && state.bgRemovedImg) {
        sourceImg = state.bgRemovedImg;
      }

      // Update status to loading
      conversionStatus.textContent = 'Converting...';
      conversionStatus.className = 'meta-value status-indicator converting';
      downloadBtn.disabled = true;

      const img = sourceImg;
      const targetFormat = formatSelect.value;
      const mimeType = targetFormat === 'jpeg' ? 'image/jpeg' : `image/${targetFormat}`;
      const quality = parseFloat(qualitySlider.value);

      // Create internal canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');

      // JPEG transparency guard: draw white background
      if (targetFormat === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw image into Canvas
      ctx.drawImage(img, 0, 0);

      // Convert to Blob asynchronously for accurate file sizes and performance
      canvas.toBlob((blob) => {
        if (!blob) {
          conversionStatus.textContent = 'Error';
          conversionStatus.className = 'meta-value status-indicator';
          return;
        }

        // Save converted blob state
        state.convertedBlob = blob;
        if (state.convertedUrl) URL.revokeObjectURL(state.convertedUrl);
        state.convertedUrl = URL.createObjectURL(blob);

        // Update preview images
        newImgPreview.src = state.convertedUrl;
        singleImgPreview.src = state.convertedUrl;

        // Update comparison view if enabled
        updateComparisonView();

        // Render target statistics
        newFormat.textContent = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
        newSize.textContent = formatBytes(blob.size);

        // Calculate and render space savings
        const savings = state.originalFile.size - blob.size;
        if (savings > 0) {
          const savingsPercentage = Math.round((savings / state.originalFile.size) * 100);
          savingsPct.textContent = `-${savingsPercentage}% Size`;
          savingsPct.style.display = 'inline-block';
        } else {
          savingsPct.style.display = 'none';
        }

        // Set status to fully ready
        conversionStatus.textContent = 'Ready';
        conversionStatus.className = 'meta-value status-indicator ready';
        downloadBtn.disabled = false;
      }, mimeType, quality);
    }

    // Initial UI Setup on load
    toggleQualityGroup();
  }

  // Hook into global SPA PageInitializers object
  window.PageInitializers = window.PageInitializers || {};
  window.PageInitializers['image-converter'] = initImageConverterPage;

  // Standalone page load handling
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImageConverterPage, { once: true });
  } else {
    initImageConverterPage();
  }
})();
