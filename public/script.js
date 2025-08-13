document.addEventListener('DOMContentLoaded', () => {
  const MAX_FILE_SIZE_MB = 10;
  const uploadInput = document.getElementById('imageInput');
  const progressSection = document.getElementById('progress-section');
  const outputSection = document.getElementById('output-section');
  const progressBar = document.getElementById('compression-progress');
  const qualityRange = document.getElementById('qualitySlider');
  const qualityValue = document.getElementById('qualityValue');
  const sizeInfo = document.getElementById('sizeInfo');
  const imagePreviews = document.getElementById('imagePreviews');

  // Show error message
  function showError(message) {
    alert(message);
  }

  // Update quality value text
  qualityRange.addEventListener('input', () => {
    qualityValue.textContent = qualityRange.value + '%';
  });

  // Clear UI and reset input
  function reset() {
    uploadInput.value = '';
    sizeInfo.textContent = '';
    progressSection.classList.add('hidden');
    outputSection.classList.add('hidden');
    outputSection.innerHTML = '';
    progressBar.value = 0;
    imagePreviews.innerHTML = '';
  }

  // Compress images using Netlify Functions
  async function compressImages(files) {
    if (!files.length) {
      showError('No files selected.');
      return;
    }

    const imageFiles = Array.from(files).filter(
      file => (file.type === 'image/jpeg' || file.type === 'image/png') && file.size <= MAX_FILE_SIZE_MB * 1024 * 1024
    );

    if (imageFiles.length === 0) {
      showError('Please upload valid JPEG or PNG images smaller than 10MB.');
      return;
    }

    sizeInfo.textContent = `Selected ${imageFiles.length} image(s). Processing...`;
    progressSection.classList.remove('hidden');
    progressBar.value = 0;
    outputSection.classList.add('hidden');
    outputSection.innerHTML = '';
    imagePreviews.innerHTML = '';

    const zip = new JSZip();
    let progress = 0;
    const progressIncrement = 100 / imageFiles.length;

    for (const [index, file] of imageFiles.entries()) {
      try {
        // Read file as DataURL
        const dataUrl = await readFileAsDataURL(file);

        // Send to Netlify Function for compression
        const response = await fetch('/.netlify/functions/compress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: dataUrl,
            format: 'webp',
            quality: qualityRange.value
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Compression failed');
        }

        const compressedDataUrl = result.compressedImage;
        const compressedBlob = dataURLtoBlob(compressedDataUrl);

        // Add compressed file to ZIP
        zip.file(`compressed-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`, compressedBlob);

        // Calculate sizes
        const originalSizeKB = (file.size / 1024).toFixed(2);
        const compressedSizeKB = (compressedBlob.size / 1024).toFixed(2);

        // Create preview container
        const container = document.createElement('div');
        container.classList.add('compressor-card', 'p-3');
        container.innerHTML = `
          <div class="flex flex-col">
            <img src="${compressedDataUrl}" alt="Compressed ${file.name}" class="image-preview mb-2" loading="lazy" />
            <div class="flex justify-between items-center text-xs text-gray-500">
              <span>Original: ${originalSizeKB}KB</span>
              <span>→</span>
              <span>Compressed: ${compressedSizeKB}KB</span>
            </div>
            <div class="flex gap-2 mt-2">
              <a href="${compressedDataUrl}" download="compressed-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}" 
                 class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-center text-xs transition-colors">
                 Download
              </a>
              <button class="preview-btn flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded text-xs">
                Preview
              </button>
            </div>
          </div>
        `;

        // Preview modal handler
        container.querySelector('.preview-btn').addEventListener('click', () => {
          const modal = document.createElement('div');
          modal.classList.add('fixed', 'inset-0', 'bg-black', 'bg-opacity-50', 'flex', 'justify-center', 'items-center', 'z-50');
          modal.innerHTML = `
            <div class="bg-white p-4 rounded-lg max-w-[90%] max-h-[90%] overflow-auto">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 class="font-bold mb-2">Original (${originalSizeKB}KB)</h3>
                  <img src="${dataUrl}" alt="Original ${file.name}" class="max-w-full h-auto" />
                </div>
                <div>
                  <h3 class="font-bold mb-2">Compressed (${compressedSizeKB}KB)</h3>
                  <img src="${compressedDataUrl}" alt="Compressed ${file.name}" class="max-w-full h-auto" />
                </div>
              </div>
              <button class="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg">Close</button>
            </div>
          `;
          document.body.appendChild(modal);
          modal.querySelector('button').addEventListener('click', () => modal.remove());
        });

        imagePreviews.appendChild(container);

        // Update progress bar
        progress += progressIncrement;
        progressBar.value = Math.min(progress, 100);
      } catch (error) {
        showError(`Error processing image ${file.name}: ${error.message}`);
        reset();
        return;
      }
    }

    // Show output buttons
    progressSection.classList.add('hidden');
    outputSection.classList.remove('hidden');
    outputSection.innerHTML = `
      <div class="flex flex-col items-center gap-4">
        <h2 class="text-gray-900 text-xl font-bold">Your ${imageFiles.length} compressed images are ready!</h2>
        <div class="flex gap-4">
          <button id="downloadZipBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
            Download All as ZIP
          </button>
          <button id="resetBtn" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium">
            Compress More Images
          </button>
        </div>
      </div>
    `;

    // Add event listeners for output buttons
    document.getElementById('downloadZipBtn').addEventListener('click', async () => {
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'compressed-images.zip';
      link.click();
      URL.revokeObjectURL(link.href);
    });

    document.getElementById('resetBtn').addEventListener('click', reset);
  }

  // Utility: Read file as DataURL
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // Utility: Convert DataURL to Blob
  function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  // On file input change
  uploadInput.addEventListener('change', () => {
    if (uploadInput.files.length === 0) {
      showError('No files selected.');
      return;
    }
    compressImages(uploadInput.files);
  });

  // Cookie Consent Manager
  const cookieConsent = document.getElementById('cookie-consent');
  const cookieAccept = document.getElementById('cookie-accept');
  const cookieReject = document.getElementById('cookie-reject');
  const cookieSettings = document.getElementById('cookie-settings');
  const cookieModal = document.getElementById('cookie-settings-modal');
  const cookieModalClose = document.getElementById('cookie-modal-close');
  const analyticsToggle = document.getElementById('analytics-cookies');

  function checkConsent() {
    return localStorage.getItem('cookieConsent');
  }

  if (!checkConsent()) {
    cookieConsent.classList.remove('hidden');
  }

  function setConsent(consent) {
    localStorage.setItem('cookieConsent', JSON.stringify(consent));
    cookieConsent.classList.add('hidden');
    if (consent.analytics) {
      console.log('Analytics cookies enabled');
    } else {
      console.log('Analytics cookies disabled');
    }
  }

  cookieAccept.addEventListener('click', () => {
    setConsent({ essential: true, analytics: true });
  });

  cookieReject.addEventListener('click', () => {
    setConsent({ essential: true, analytics: false });
  });

  cookieSettings.addEventListener('click', () => {
    const consent = checkConsent() ? JSON.parse(checkConsent()) : { analytics: false };
    analyticsToggle.checked = consent.analytics || false;
    cookieModal.classList.remove('hidden');
  });

  cookieModalClose.addEventListener('click', () => {
    cookieModal.classList.add('hidden');
  });

  document.getElementById('save-cookie-settings').addEventListener('click', () => {
    setConsent({ essential: true, analytics: analyticsToggle.checked });
    cookieModal.classList.add('hidden');
  });

  const existingConsent = checkConsent();
  if (existingConsent && JSON.parse(existingConsent).analytics) {
    console.log('Loading existing analytics consent');
  }
});

// Modal control functions
function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
  document.body.style.overflow = '';
}

document.querySelectorAll('[id$="-modal"]').forEach(modal => {
  modal.addEventListener('click', function (e) {
    if (e.target === this) {
      closeModal(this.id);
    }
  });
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('[id$="-modal"]').forEach(modal => {
      if (!modal.classList.contains('hidden')) {
        closeModal(modal.id);
      }
    });
  }
});
