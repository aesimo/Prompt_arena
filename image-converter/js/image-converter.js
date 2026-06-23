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
      abortController: null
    };

    // Provider configurations
    const PROVIDERS = {
      IMGLY: {
        name: 'Imgly',
        url: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.0/dist/index.mjs',
        fallbackIndex: 0
      },
      BRIA: {
        name: 'Bria AI',
        url: 'https://cdn.jsdelivr.net/npm/@briaai/bg-remove@1.0.0/dist/index.mjs',
        fallbackIndex: 1
      },
      BODYPIX: {
        name: 'BodyPix',
        url: null, // Will be handled differently
        fallbackIndex: 2
      }
    };

    /* -----------------------------------------------------------------
       Background Removal Manager
       ----------------------------------------------------------------- */
    class BackgroundRemovalManager {
      constructor() {
        this.providers = [
          { ...PROVIDERS.IMGLY, instance: null },
          { ...PROVIDERS.BRIA, instance: null },
          { ...PROVIDERS.BODYPIX, instance: null }
        ];
        this.currentProvider = null;
        this.onProgress = null;
        this.maxImageSize = 2048;
      }

      setProgressCallback(callback) {
        this.onProgress = callback;
      }

      updateProgress(step, message, details = '') {
        if (this.onProgress) {
          this.onProgress({ step, message, details });
        }
      }

      async preprocessImage(imageUrl) {
        this.updateProgress(1, 'Preprocessing', 'Analyzing image dimensions...');
        
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            let { naturalWidth: width, naturalHeight: height } = img;
            
            // Resize if image is too large
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
              this.updateProgress(1, 'Preprocessing', 'Image size optimal, no resizing needed.');
              resolve(imageUrl);
            }
          };
          
          img.onerror = () => reject(new Error('Failed to load image for preprocessing'));
          img.src = imageUrl;
        });
      }

      async loadProvider(provider) {
        if (provider.instance) return provider.instance;
        
        if (!provider.url) {
          // BodyPix doesn't need external loading in the same way
          return { type: 'bodypix' };
        }

        try {
          const module = await import(provider.url);
          provider.instance = module.default || module.removeBackground || module;
          return provider.instance;
        } catch (error) {
          console.warn(`Failed to load ${provider.name}:`, error);
          throw error;
        }
      }

      async removeWithImgly(imageUrl, mode) {
        const removeBackground = await this.loadProvider(this.providers[0]);
        
        const options = {
          progress: (key, current, total) => {
            const percent = Math.round((current / total) * 100);
            this.updateProgress(3, 'Segmenting', `Imgly AI: ${percent}% complete`);
          },
          device: mode === 'fast' ? 'cpu' : 'gpu',
          model: mode === 'quality' ? 'large' : 'medium'
        };

        return await removeBackground(imageUrl, options);
      }

      async removeWithBria(imageUrl) {
        // Bria AI implementation
        const briaModule = await this.loadProvider(this.providers[1]);
        
        this.updateProgress(3, 'Segmenting', 'Bria AI: Initializing model...');
        
        // Fetch image as blob for Bria
        const response = await fetch(imageUrl);
        const imageBlob = await response.blob();
        
        this.updateProgress(3, 'Segmenting', 'Bria AI: Processing image...');
        
        // Use Bria's API
        const result = await briaModule(imageBlob);
        return result;
      }

      async removeWithBodyPix(imageUrl) {
        this.updateProgress(2, 'Loading AI Model', 'Loading TensorFlow BodyPix (offline mode)...');
        
        // Dynamic import for TensorFlow.js and BodyPix
        const [tf, bodyPix] = await Promise.all([
          import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.esm.js'),
          import('https://cdn.jsdelivr.net/npm/@tensorflow-models/body-pix@2.2.0/dist/body-pix.esm.js')
        ]);

        this.updateProgress(3, 'Segmenting', 'BodyPix: Analyzing image...');

        // Load image
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = imageUrl;
        });

        // Load BodyPix model
        const model = await bodyPix.load({
          architecture: 'MobileNetV1',
          outputStride: 16,
          multiplier: 0.75,
          quantBytes: 2
        });

        this.updateProgress(3, 'Segmenting', 'BodyPix: Segmenting person...');

        // Segment person
        const segmentation = await model.segmentPerson(img, {
          internalResolution: 'medium',
          segmentationThreshold: 0.7,
          scoreThreshold: 0.3
        });

        // Create mask canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const mask = segmentation.data;

        // Apply mask
        for (let i = 0; i < mask.length; i++) {
          const pixelIndex = i * 4;
          if (mask[i] === 0) {
            data[pixelIndex + 3] = 0; // Set alpha to 0 for background
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Convert to blob
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
      }

      applyEdgeRefinement(canvas, refinementLevel) {
        if (refinementLevel === 0) return canvas;

        this.updateProgress(4, 'Refining Edges', `Applying edge smoothing (${refinementLevel}%)...`);

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Apply slight blur to edges based on refinement level
        const radius = Math.max(1, Math.floor(refinementLevel / 20));
        
        if (radius > 1) {
          // Simple box blur for edge areas
          const tempData = new Uint8ClampedArray(data);
          
          for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
              const idx = (y * width + x) * 4;
              
              // Only process edge pixels (where alpha changes)
              const isEdge = this.isEdgePixel(tempData, idx, width);
              
              if (isEdge && tempData[idx + 3] > 0) {
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                
                for (let dy = -radius; dy <= radius; dy++) {
                  for (let dx = -radius; dx <= radius; dx++) {
                    const nIdx = ((y + dy) * width + (x + dx)) * 4;
                    if (tempData[nIdx + 3] > 0) {
                      r += tempData[nIdx];
                      g += tempData[nIdx + 1];
                      b += tempData[nIdx + 2];
                      a += tempData[nIdx + 3];
                      count++;
                    }
                  }
                }
                
                if (count > 0) {
                  data[idx] = r / count;
                  data[idx + 1] = g / count;
                  data[idx + 2] = b / count;
                  data[idx + 3] = a / count;
                }
              }
            }
          }
          
          ctx.putImageData(imageData, 0, 0);
        }

        return canvas;
      }

      isEdgePixel(data, idx, width) {
        const alpha = data[idx + 3];
        const neighbors = [
          idx - width * 4 + 3, // top
          idx + width * 4 + 3, // bottom
          idx - 4 + 3,         // left
          idx + 4 + 3          // right
        ];
        
        for (const nIdx of neighbors) {
          if (nIdx >= 0 && nIdx < data.length && Math.abs(data[nIdx] - alpha) > 50) {
            return true;
          }
        }
        return false;
      }

      async process(imageUrl, mode = 'balanced', edgeRefinement = 50, onProviderChange = null) {
        let processedUrl = null;
        let lastError = null;

        try {
          // Step 1: Preprocess
          processedUrl = await this.preprocessImage(imageUrl);

          // Step 2-4: Try providers in order
          for (let i = 0; i < this.providers.length; i++) {
            const provider = this.providers[i];
            this.currentProvider = provider;
            
            if (onProviderChange) {
              onProviderChange(i);
            }

            this.updateProgress(2, 'Loading AI Model', `${provider.name}: Loading model...`);

            try {
              let blob;
              
              switch (i) {
                case 0:
                  blob = await this.removeWithImgly(processedUrl, mode);
                  break;
                case 1:
                  blob = await this.removeWithBria(processedUrl);
                  break;
                case 2:
                  blob = await this.removeWithBodyPix(processedUrl);
                  break;
              }

              // Step 4: Edge refinement
              if (edgeRefinement > 0) {
                const img = await new Promise((resolve, reject) => {
                  const image = new Image();
                  image.onload = () => resolve(image);
                  image.onerror = reject;
                  image.src = URL.createObjectURL(blob);
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
              }

              this.updateProgress(5, 'Finalizing', 'Background removal complete!');
              
              if (onProviderChange) {
                onProviderChange(i, 'success');
              }

              return blob;

            } catch (error) {
              console.warn(`${provider.name} failed:`, error);
              lastError = error;
              
              if (onProviderChange) {
                onProviderChange(i, 'error');
              }
              
              // Continue to next provider
              continue;
            }
          }

          throw new Error(`All background removal providers failed. Last error: ${lastError?.message}`);

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
        } else if (index < providerIndex && status === 'success') {
          dot.classList.add('success');
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
      // Reset steps
      const steps = progressSteps.querySelectorAll('.progress-step');
      steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index === 0) step.classList.add('active');
      });
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

    comparisonHandle.addEventListener('mousedown', () => isDragging = true);
    comparisonHandle.addEventListener('touchstart', () => isDragging = true);

    document.addEventListener('mouseup', () => isDragging = false);
    document.addEventListener('touchend', () => isDragging = false);

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      handleSliderMove(e.clientX);
    });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      handleSliderMove(e.touches[0].clientX);
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

      // Show progress overlay if background removal is needed and not cached
      if (removeBg && !state.bgRemovedImg) {
        showProgressOverlay();
        bgRemovalManager.setProgressCallback(updateProgressUI);

        try {
          const blob = await bgRemovalManager.process(
            state.originalUrl,
            state.processingMode,
            state.edgeRefinement,
            updateProviderUI
          );
          
          state.bgRemovedUrl = URL.createObjectURL(blob);
          state.bgRemovedImg = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load background-removed image'));
            img.src = state.bgRemovedUrl;
          });

          updateProviderUI(0, 'success');

        } catch (error) {
          console.error('Background removal failed:', error);
          alert('Background removal failed. Please try again with a different image or disable the feature.');
          removeBgToggle.checked = false;
          bgRemovalOptions.style.display = 'none';
          sourceImg = state.originalImg;
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
