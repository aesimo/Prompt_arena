/* =====================================================================
   mxo.me — Image Converter Implementation
   image-converter.js — handles client-side image loading, Canvas conversion,
   quality adjustments, live previews, metadata rendering, and downloads.
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
    const savingsPct        = document.getElementById('savingsPct');
    const downloadBtn       = document.getElementById('downloadBtn');

    if (!dropZone) return; // Guard for SPA context swaps

    // State container to hold current active conversion details
    const state = {
      originalFile: null,
      originalImg: null, // Image element loaded in memory
      convertedBlob: null,
      convertedUrl: null,
      originalUrl: null
    };

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
      // Strips extension from filename
      return name.substring(0, name.lastIndexOf('.')) || name;
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
      if (state.originalImg) {
        performConversion();
      }
    });

    qualitySlider.addEventListener('input', (e) => {
      qualityVal.textContent = Math.round(e.target.value * 100) + '%';
    });

    qualitySlider.addEventListener('change', () => {
      if (state.originalImg) {
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
      state.originalFile = file;
      state.convertedBlob = null;
      state.convertedUrl = null;

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

    function performConversion() {
      if (!state.originalImg) return;

      // Update status to loading
      conversionStatus.textContent = 'Converting...';
      conversionStatus.className = 'meta-value status-indicator converting';
      downloadBtn.disabled = true;

      const img = state.originalImg;
      const targetFormat = formatSelect.value; // 'webp', 'png', 'jpeg'
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

      // Draw original image into Canvas
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

        // Update preview image
        newImgPreview.src = state.convertedUrl;

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
          // If output format/quality results in larger file size than input
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
