/* =====================================================================
   mxo.me — Image Converter & Background Remover Implementation
   image-converter.js — handles client-side image processing using Canvas API
   ===================================================================== */

(function() {
  'use strict';

  function initImageConverterPage() {
    // DOM Element References
    const pageTitle         = document.getElementById('pageTitle');
    const pageDescription   = document.getElementById('pageDescription');
    const modeBtns          = document.querySelectorAll('.mode-btn');
    const converterSettings = document.getElementById('converterSettings');
    const bgRemoverSettings = document.getElementById('bgRemoverSettings');
    
    const dropZone          = document.getElementById('dropZone');
    const fileInput         = document.getElementById('fileInput');
    const formatSelect      = document.getElementById('formatSelect');
    const qualitySlider     = document.getElementById('qualitySlider');
    const qualityVal        = document.getElementById('qualityVal');
    const qualityGroup      = document.getElementById('qualityGroup');
    
    const methodCards       = document.querySelectorAll('.method-card');
    const chromaOptions     = document.getElementById('chromaOptions');
    const chromaColor       = document.getElementById('chromaColor');
    const presetColors      = document.querySelectorAll('.preset-color');
    const thresholdSlider   = document.getElementById('thresholdSlider');
    const thresholdVal      = document.getElementById('thresholdVal');
    const thresholdLabel     = document.getElementById('thresholdLabel');
    const edgeRefinementSlider = document.getElementById('edgeRefinementSlider');
    const edgeSmoothingVal  = document.getElementById('edgeSmoothingVal');
    const comparisonToggle  = document.getElementById('comparisonToggle');
    
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

    if (!dropZone) return;

    const state = {
      mode: 'converter', // 'converter' or 'bg-remover'
      method: 'canvas-color', // 'canvas-color', 'canvas-edge', 'canvas-chroma'
      originalFile: null,
      originalImg: null,
      originalUrl: null,
      processedImg: null,
      processedUrl: null,
      convertedBlob: null,
      convertedUrl: null,
      threshold: 40,
      edgeSmoothing: 50,
      chromaKey: '#00ff00',
      comparisonEnabled: false,
      isProcessing: false
    };

    /* -----------------------------------------------------------------
       Mode Switching
       ----------------------------------------------------------------- */
    function setMode(mode) {
      state.mode = mode;
      modeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });

      if (mode === 'converter') {
        pageTitle.innerHTML = 'Offline <span class="grad-text">Image Converter</span>';
        pageDescription.textContent = 'Convert PNG, JPG, WebP, GIF, BMP, and SVG completely client-side.';
        converterSettings.style.display = 'block';
        bgRemoverSettings.style.display = 'none';
      } else {
        pageTitle.innerHTML = 'Offline <span class="grad-text-alt">Background Remover</span>';
        pageDescription.textContent = 'Remove backgrounds 100% client-side using Smart Edge and Chroma Key algorithms.';
        converterSettings.style.display = 'none';
        bgRemoverSettings.style.display = 'block';
      }

      if (state.originalImg) {
        performConversion();
      }
    }

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    /* -----------------------------------------------------------------
       Background Removal Algorithms
       ----------------------------------------------------------------- */
    
    async function removeWithCanvasColor(img, threshold) {
      const canvas = document.createElement('canvas');
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Sample corners to identify background color
      const cornerOffsets = [
        { x: 5, y: 5 }, { x: w - 5, y: 5 },
        { x: 5, y: h - 5 }, { x: w - 5, y: h - 5 },
        { x: Math.floor(w/2), y: 5 }, { x: Math.floor(w/2), y: h - 5 }
      ];

      let bgR = 0, bgG = 0, bgB = 0;
      cornerOffsets.forEach(off => {
        const idx = (off.y * w + off.x) * 4;
        bgR += data[idx]; bgG += data[idx+1]; bgB += data[idx+2];
      });
      bgR /= cornerOffsets.length;
      bgG /= cornerOffsets.length;
      bgB /= cornerOffsets.length;

      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - bgR;
        const dg = data[i+1] - bgG;
        const db = data[i+2] - bgB;
        const dist = Math.sqrt(dr*dr + dg*dg + db*db);
        if (dist < threshold) {
          data[i+3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    async function removeWithCanvasChroma(img, keyColor, threshold) {
      const canvas = document.createElement('canvas');
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Convert hex to RGB
      const r_key = parseInt(keyColor.slice(1, 3), 16);
      const g_key = parseInt(keyColor.slice(3, 5), 16);
      const b_key = parseInt(keyColor.slice(5, 7), 16);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];

        const dr = r - r_key;
        const dg = g - g_key;
        const db = b - b_key;
        const dist = Math.sqrt(dr*dr + dg*dg + db*db);

        if (dist < threshold) {
          data[i+3] = 0;
        } else if (dist < threshold + 20) {
          // Feathering near threshold
          data[i+3] = Math.round(((dist - threshold) / 20) * 255);
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    async function removeWithCanvasEdge(img, threshold) {
      const canvas = document.createElement('canvas');
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Sobel Edge Detection
      const gray = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        gray[i] = (data[idx] * 0.3 + data[idx+1] * 0.59 + data[idx+2] * 0.11);
      }

      const grad = new Float32Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          const gx = -gray[idx-w-1] + gray[idx-w+1] - 2*gray[idx-1] + 2*gray[idx+1] - gray[idx+w-1] + gray[idx+w+1];
          const gy = -gray[idx-w-1] - 2*gray[idx-w] - gray[idx-w+1] + gray[idx+w-1] + 2*gray[idx+w] + gray[idx+w+1];
          grad[idx] = Math.sqrt(gx*gx + gy*gy);
        }
      }

      // Flood fill from center (assuming subject is central)
      const visited = new Uint8Array(w * h);
      const stack = [[Math.floor(w/2), Math.floor(h/2)]];
      const edgeThreshold = threshold * 0.5;

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
        const idx = cy * w + cx;
        if (visited[idx] || grad[idx] > edgeThreshold) continue;
        visited[idx] = 1;
        stack.push([cx-1, cy], [cx+1, cy], [cx, cy-1], [cx, cy+1]);
      }

      for (let i = 0; i < w * h; i++) {
        if (!visited[i]) {
          data[i*4 + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    function applyEdgeSmoothing(canvas, level) {
      if (level <= 0) return canvas;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      const radius = Math.floor(level / 20) + 1;

      const tempAlpha = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) tempAlpha[i] = data[i*4 + 3];

      for (let y = radius; y < h - radius; y++) {
        for (let x = radius; x < w - radius; x++) {
          const idx = y * w + x;
          if (tempAlpha[idx] > 0 && tempAlpha[idx] < 255) {
            let sum = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                sum += tempAlpha[(y+dy)*w + (x+dx)];
                count++;
              }
            }
            data[idx*4 + 3] = sum / count;
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    /* -----------------------------------------------------------------
       UI Event Listeners
       ----------------------------------------------------------------- */
    
    methodCards.forEach(card => {
      card.addEventListener('click', () => {
        methodCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.method = card.dataset.method;
        
        chromaOptions.style.display = state.method === 'canvas-chroma' ? 'block' : 'none';
        
        if (state.method === 'canvas-edge') {
          thresholdLabel.textContent = 'Edge Strength';
          thresholdSlider.max = 100;
          if (state.threshold > 100) state.threshold = 30;
        } else {
          thresholdLabel.textContent = 'Color Tolerance';
          thresholdSlider.max = 200;
        }
        
        thresholdSlider.value = state.threshold;
        thresholdVal.textContent = state.threshold;

        if (state.originalImg) performConversion();
      });
    });

    thresholdSlider.addEventListener('input', (e) => {
      state.threshold = parseInt(e.target.value);
      thresholdVal.textContent = state.threshold;
    });

    thresholdSlider.addEventListener('change', () => {
      if (state.originalImg) performConversion();
    });

    edgeRefinementSlider.addEventListener('input', (e) => {
      state.edgeSmoothing = parseInt(e.target.value);
      edgeSmoothingVal.textContent = state.edgeSmoothing + '%';
    });

    edgeRefinementSlider.addEventListener('change', () => {
      if (state.originalImg) performConversion();
    });

    chromaColor.addEventListener('change', (e) => {
      state.chromaKey = e.target.value;
      if (state.originalImg) performConversion();
    });

    presetColors.forEach(btn => {
      btn.addEventListener('click', () => {
        state.chromaKey = btn.dataset.color;
        chromaColor.value = state.chromaKey;
        if (state.originalImg) performConversion();
      });
    });

    comparisonToggle.addEventListener('change', () => {
      state.comparisonEnabled = comparisonToggle.checked;
      updateComparisonView();
    });

    formatSelect.addEventListener('change', () => {
      qualityGroup.style.display = formatSelect.value === 'png' ? 'none' : 'block';
      if (state.originalImg) performConversion();
    });

    qualitySlider.addEventListener('input', (e) => {
      qualityVal.textContent = Math.round(e.target.value * 100) + '%';
    });

    qualitySlider.addEventListener('change', () => {
      if (state.originalImg) performConversion();
    });

    /* -----------------------------------------------------------------
       Core Logic
       ----------------------------------------------------------------- */

    function updateProgress(step, message, details = '') {
      const steps = progressSteps.querySelectorAll('.progress-step');
      steps.forEach((s, i) => {
        s.classList.toggle('active', (i + 1) === step);
        s.classList.toggle('completed', (i + 1) < step);
      });
      progressTitle.textContent = message;
      progressDetails.textContent = details;
    }

    async function performConversion() {
      if (!state.originalImg || state.isProcessing) return;
      state.isProcessing = true;

      if (state.mode === 'bg-remover') {
        progressOverlay.style.display = 'flex';
        updateProgress(1, 'Reading Image', 'Loading pixel data...');
        
        let canvas;
        try {
          updateProgress(2, 'Analyzing', `Applying ${state.method} algorithm...`);
          if (state.method === 'canvas-color') {
            canvas = await removeWithCanvasColor(state.originalImg, state.threshold);
          } else if (state.method === 'canvas-edge') {
            canvas = await removeWithCanvasEdge(state.originalImg, state.threshold);
          } else if (state.method === 'canvas-chroma') {
            canvas = await removeWithCanvasChroma(state.originalImg, state.chromaKey, state.threshold);
          }

          updateProgress(4, 'Smoothing', 'Refining edges...');
          canvas = applyEdgeSmoothing(canvas, state.edgeSmoothing);

          updateProgress(5, 'Finalizing', 'Generating preview...');
          state.processedImg = canvas;
          if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
          
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          state.processedUrl = URL.createObjectURL(blob);
          state.convertedBlob = blob;
          
        } catch (err) {
          console.error(err);
          alert('Processing failed.');
        } finally {
          progressOverlay.style.display = 'none';
        }
      } else {
        // Simple conversion
        const canvas = document.createElement('canvas');
        canvas.width = state.originalImg.naturalWidth;
        canvas.height = state.originalImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        
        const format = formatSelect.value;
        if (format === 'jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(state.originalImg, 0, 0);
        
        const mime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, parseFloat(qualitySlider.value)));
        
        state.processedImg = canvas;
        if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
        state.processedUrl = URL.createObjectURL(blob);
        state.convertedBlob = blob;
      }

      // Update UI
      newImgPreview.src = state.processedUrl;
      singleImgPreview.src = state.processedUrl;
      beforeImgPreview.src = state.originalUrl;
      
      newFormat.textContent = state.mode === 'bg-remover' ? 'png' : (formatSelect.value === 'jpeg' ? 'jpg' : formatSelect.value);
      newSize.textContent = formatBytes(state.convertedBlob.size);
      
      const savings = state.originalFile.size - state.convertedBlob.size;
      savingsPct.style.display = savings > 0 ? 'inline-block' : 'none';
      if (savings > 0) {
        savingsPct.textContent = `-${Math.round((savings / state.originalFile.size) * 100)}% Size`;
      }

      updateComparisonView();
      state.isProcessing = false;
      downloadBtn.disabled = false;
      conversionStatus.textContent = 'Ready';
      conversionStatus.className = 'meta-value status-indicator ready';
    }

    function updateComparisonView() {
      if (state.comparisonEnabled && state.mode === 'bg-remover') {
        comparisonContainer.style.display = 'flex';
        normalPreview.style.display = 'none';
        updateComparisonSlider(50);
      } else {
        comparisonContainer.style.display = 'none';
        normalPreview.style.display = 'flex';
      }
    }

    function updateComparisonSlider(percentage) {
      const beforeLayer = comparisonContainer.querySelector('.comparison-before');
      beforeLayer.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
      comparisonHandle.style.left = `${percentage}%`;
    }

    /* Slider Interaction */
    let isDragging = false;
    comparisonHandle.addEventListener('mousedown', () => isDragging = true);
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = comparisonContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      updateComparisonSlider(pct);
    });

    /* -----------------------------------------------------------------
       File Handling
       ----------------------------------------------------------------- */
    function handleFile(file) {
      if (!file.type.startsWith('image/')) return;
      state.originalFile = file;
      state.originalUrl = URL.createObjectURL(file);
      
      const img = new Image();
      img.onload = () => {
        state.originalImg = img;
        origName.textContent = file.name;
        origSize.textContent = formatBytes(file.size);
        origDims.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
        origFormat.textContent = file.type.split('/')[1].replace('jpeg', 'jpg');
        origImgPreview.src = state.originalUrl;
        
        emptyState.style.display = 'none';
        previewState.style.display = 'block';
        performConversion();
      };
      img.src = state.originalUrl;
    }

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => e.target.files[0] && handleFile(e.target.files[0]));
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]);
    });

    downloadBtn.addEventListener('click', () => {
      if (!state.convertedBlob) return;
      const ext = state.mode === 'bg-remover' ? 'png' : (formatSelect.value === 'jpeg' ? 'jpg' : formatSelect.value);
      const name = state.originalFile.name.split('.')[0] + '_mxo.' + ext;
      const a = document.createElement('a');
      a.href = state.processedUrl;
      a.download = name;
      a.click();
    });

    function formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
  }

  window.PageInitializers = window.PageInitializers || {};
  window.PageInitializers['image-converter'] = initImageConverterPage;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImageConverterPage);
  } else {
    initImageConverterPage();
  }
})();
