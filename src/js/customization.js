/*
  src/js/customization.js
  Improvements:
  - Guarded initialization (only when .customize-layout exists)
  - Debounce utility
  - Active-state management (.is-active on .customize-option)
  - Live price calculation + #priceDisplay updates
  - CTA enablement (#addToCartBtn)
  - Draft persistence to localStorage ("beautybite:customizeDraft")
  - Defensive coding (no errors if elements missing)
*/

function debounce(fn, ms = 300) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
    };
}

class CustomizationManager {
    constructor() {
        this.currentTab = 'text';
        this.uploadedImage = null;
        this.uploadedTexture = null;
        this.designHistory = [];
        this.historyPointer = -1;
        this.basePrice = 109.00; // safe default
        this.priceModifiers = {
            material: { matte: 0, glossy: 5, metallic: 20, transparent: 0 },
            size: { standard: 0, small: -10, large: 10 },
            engraving: { none: 0, text: 15, pattern: 25 }
        };

        this._initGuarded();
        if (window && window.DEBUG) {
            console.log('CustomizationManager ready');
        }
    }

    _initGuarded() {
        // Only initialize if page includes our customize layout (scoped)
        if (!document.querySelector('.customize-layout')) {
            // Do not initialize on other pages
            return;
        }

        // Ensure debounced compute exists before any listeners
        this._debouncedCompute = debounce(this.computePrice.bind(this), 300);

        // Minimal init
        this.setupTabSwitching();
        this.setupTextControls();
        this.setupImageControls();
        this.setupColorControls();
        this.setupMaterialControls();
        this.setupGlobalActions();
        this.setupFileUploads();
        this.setupActiveOptionHandlers();
        this.setupDraftPersistence();
        this.updatePriceDisplay();
        this.updateCTAState();

        // Debounced handlers for frequent inputs
        this._debouncedCompute = debounce(() => {
            this.updatePriceDisplay();
            this.saveDraft();
        }, 300);

        // Wire inputs to debounced compute
        ['base-color', 'accent-color', 'color-pattern', 'gradient-direction', 'opacity',
            'material-type', 'size-select', 'engrave-option', 'font-size', 'font-select'
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this._debouncedCompute());
            if (el) el.addEventListener('change', () => this._debouncedCompute());
        });

        console.log('Customization UI initialized');
    }

    // Restore draft from localStorage
    setupDraftPersistence() {
        try {
            const draftRaw = localStorage.getItem('beautybite:customizeDraft');
            if (!draftRaw) return;
            const draft = JSON.parse(draftRaw);

            // Restore simple selects/inputs safely
            ['base-color', 'accent-color', 'color-pattern', 'gradient-direction', 'opacity',
                'material-type', 'size-select', 'engrave-option', 'font-size', 'font-select', 'text-input'
            ].forEach(id => {
                if (!draft[id]) return;
                const el = document.getElementById(id);
                if (!el) return;
                try {
                    el.value = draft[id];
                    // For range inputs, update paired displays
                    if (id === 'font-size') {
                        const v = document.getElementById('font-size-value');
                        if (v) v.textContent = `${el.value}px`;
                    }
                    if (id === 'image-scale') {
                        const v = document.getElementById('image-scale-value');
                        if (v) v.textContent = `${Math.round(el.value * 100)}%`;
                    }
                    if (id === 'opacity') {
                        const v = document.getElementById('opacity-value');
                        if (v) v.textContent = `${Math.round(el.value * 100)}%`;
                    }
                } catch (e) { /* defensive */ }
            });

            // Restore selected swatches/options
            if (draft['customizeOptions'] && Array.isArray(draft['customizeOptions'])) {
                draft['customizeOptions'].forEach(opt => {
                    const btn = document.querySelector(`.customize-option[data-id="${opt}"]`);
                    if (btn) btn.classList.add('is-active');
                });
            }

            // Update price and CTA
            this.updatePriceDisplay();
            this.updateCTAState();
        } catch (e) {
            console.warn('Failed to restore customize draft', e);
        }
    }

    saveDraft() {
        try {
            const draft = {};
            ['base-color', 'accent-color', 'color-pattern', 'gradient-direction', 'opacity',
                'material-type', 'size-select', 'engrave-option', 'font-size', 'font-select', 'text-input'
            ].forEach(id => {
                const el = document.getElementById(id);
                if (el) draft[id] = el.value;
            });

            // active options
            const activeOpts = Array.from(document.querySelectorAll('.customize-option.is-active')).map(el => el.dataset.id || el.dataset.value || el.id);
            draft['customizeOptions'] = activeOpts;

            localStorage.setItem('beautybite:customizeDraft', JSON.stringify(draft));
        } catch (e) {
            console.warn('Failed to save draft', e);
        }
    }

    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');

                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Show corresponding tab content
                tabContents.forEach(content => content.classList.remove('active'));
                const panel = document.getElementById(`${tabId}-panel`);
                if (panel) panel.classList.add('active');

                this.currentTab = tabId;
            });
        });
    }

    setupTextControls() {
        const fontSizeSlider = document.getElementById('font-size');
        const fontSizeValue = document.getElementById('font-size-value');

        if (fontSizeSlider && fontSizeValue) {
            fontSizeSlider.addEventListener('input', (e) => {
                fontSizeValue.textContent = `${e.target.value}px`;
                this._debouncedCompute();
            });
        }

        const addTextBtn = document.getElementById('add-text');
        if (addTextBtn) {
            addTextBtn.addEventListener('click', () => {
                this.addTextToModel();
            });
        }

        const textInput = document.getElementById('text-input');
        if (textInput) {
            textInput.addEventListener('input', () => {
                // enable add-text only when there is content
                const btn = document.getElementById('add-text');
                if (btn) btn.disabled = textInput.value.trim().length === 0;
                this._debouncedCompute();
            });

            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addTextToModel();
                }
            });
        }
    }

    addTextToModel() {
        const textInput = document.getElementById('text-input');
        if (!textInput) return;

        const text = textInput.value.trim();
        if (!text) return;

        if (!window.threeEditor) {
            this.showNotification('3D editor not ready', 'error');
            return;
        }

        const textData = {
            text: text,
            font: (document.getElementById('font-select') && document.getElementById('font-select').value) || 'Arial',
            size: parseInt(document.getElementById('font-size') ? document.getElementById('font-size').value : '12'),
            position: (document.getElementById('text-position') && document.getElementById('text-position').value) || 'front',
            color: (document.getElementById('text-color') && document.getElementById('text-color').value) || '#000000',
            effect: (document.getElementById('text-effect') && document.getElementById('text-effect').value) || 'none'
        };

        this.saveToHistory();
        const textMesh = window.threeEditor.addText(textData);
        if (textMesh) {
            this.showNotification('Text added', 'success');
            textInput.value = '';
            this.saveDraft();
            this.updatePriceDisplay();
            this.updateCTAState();
        } else {
            this.showNotification('Failed to add text', 'error');
        }
    }

    setupImageControls() {
        const imageScale = document.getElementById('image-scale');
        const imageScaleValue = document.getElementById('image-scale-value');
        if (imageScale && imageScaleValue) {
            imageScale.addEventListener('input', (e) => {
                imageScaleValue.textContent = `${(e.target.value * 100).toFixed(0)}%`;
                this._debouncedCompute();
            });
        }

        const imageRotation = document.getElementById('image-rotation');
        const imageRotationValue = document.getElementById('image-rotation-value');
        if (imageRotation && imageRotationValue) {
            imageRotation.addEventListener('input', (e) => {
                imageRotationValue.textContent = `${e.target.value}°`;
                this._debouncedCompute();
            });
        }

        const applyImageBtn = document.getElementById('apply-image');
        if (applyImageBtn) {
            applyImageBtn.addEventListener('click', () => this.applyImageToModel());
        }
    }

    setupImageUpload() {
        const uploadArea = document.getElementById('image-upload-area');
        const fileInput = document.getElementById('image-upload');
        if (!uploadArea || !fileInput) return;

        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length) this.handleImageFile(files[0]);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.handleImageFile(e.target.files[0]);
        });
    }

    handleImageFile(file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
        const maxSize = 5 * 1024 * 1024;
        if (!validTypes.includes(file.type)) {
            this.showNotification('Please upload PNG/JPG/SVG', 'error');
            return;
        }
        if (file.size > maxSize) {
            this.showNotification('Max 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedImage = file;
            const uploadArea = document.getElementById('image-upload-area');
            if (uploadArea) {
                uploadArea.innerHTML = `
                    <div class="image-preview">
                        <img src="${e.target.result}" alt="Uploaded image" class="preview-image">
                        <button class="remove-image" onclick="customizationManager.removeUploadedImage()">×</button>
                    </div>
                `;
            }
            const applyBtn = document.getElementById('apply-image');
            if (applyBtn) applyBtn.disabled = false;
            this.showNotification('Image uploaded', 'success');
            this.saveDraft();
        };
        reader.readAsDataURL(file);
    }

    removeUploadedImage() {
        this.uploadedImage = null;
        const uploadArea = document.getElementById('image-upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <input type="file" id="image-upload" accept=".png,.jpg,.jpeg,.svg" style="display:none;">
                <div class="upload-placeholder">
                    <p>Drag & drop or click to upload</p>
                </div>
            `;
            this.setupImageUpload();
        }
        const applyBtn = document.getElementById('apply-image');
        if (applyBtn) applyBtn.disabled = true;
        this.saveDraft();
    }

    applyImageToModel() {
        if (!this.uploadedImage) {
            this.showNotification('Upload an image first', 'error');
            return;
        }
        if (!window.threeEditor) {
            this.showNotification('3D editor not ready', 'error');
            return;
        }

        const imageData = {
            image: this.uploadedImage,
            position: (document.getElementById('image-position') && document.getElementById('image-position').value) || 'front',
            effect: (document.getElementById('image-effect') && document.getElementById('image-effect').value) || 'printed',
            scale: parseFloat(document.getElementById('image-scale') ? document.getElementById('image-scale').value : '1'),
            rotation: parseInt(document.getElementById('image-rotation') ? document.getElementById('image-rotation').value : '0')
        };

        this.saveToHistory();
        const mesh = window.threeEditor.addImage(imageData);
        if (mesh) {
            this.showNotification('Image applied', 'success');
            this.removeUploadedImage();
            this.saveDraft();
            this.updatePriceDisplay();
            this.updateCTAState();
        } else {
            this.showNotification('Failed to apply image', 'error');
        }
    }

    setupColorControls() {
        const colorPattern = document.getElementById('color-pattern');
        const gradientControls = document.getElementById('gradient-controls');
        if (colorPattern) {
            colorPattern.addEventListener('change', (e) => {
                if (gradientControls) gradientControls.style.display = e.target.value === 'gradient' ? 'block' : 'none';
                this._debouncedCompute();
            });
        }
        const opacity = document.getElementById('opacity');
        const opacityValue = document.getElementById('opacity-value');
        if (opacity && opacityValue) {
            opacity.addEventListener('input', (e) => {
                opacityValue.textContent = `${Math.round(e.target.value * 100)}%`;
                this._debouncedCompute();
            });
        }

        const baseColor = document.getElementById('base-color');
        if (baseColor) baseColor.addEventListener('input', () => this._debouncedCompute());
        const accent = document.getElementById('accent-color');
        if (accent) accent.addEventListener('input', () => this._debouncedCompute());
    }

    setupMaterialControls() {
        const materialPreviews = document.querySelectorAll('.material-preview');
        materialPreviews.forEach(preview => {
            preview.addEventListener('click', () => {
                materialPreviews.forEach(p => p.classList.remove('active', 'is-active'));
                preview.classList.add('active', 'is-active');
                const matSelect = document.getElementById('material-type');
                if (matSelect) matSelect.value = preview.dataset.material || '';
                this._debouncedCompute();
                this.saveDraft();
            });
        });

        const matSelect = document.getElementById('material-type');
        if (matSelect) {
            matSelect.addEventListener('change', (e) => {
                materialPreviews.forEach(p => p.classList.remove('active', 'is-active'));
                const target = document.querySelector(`.material-preview[data-material="${e.target.value}"]`);
                if (target) target.classList.add('active', 'is-active');
                this._debouncedCompute();
                this.saveDraft();
            });
        }
    }

    setupTextureUpload() {
        const textureArea = document.getElementById('texture-upload-area');
        const textureInput = document.getElementById('texture-upload');
        if (!textureArea || !textureInput) return;

        textureArea.addEventListener('click', () => textureInput.click());
        textureInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.handleTextureFile(e.target.files[0]);
        });
    }

    handleTextureFile(file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        const maxSize = 5 * 1024 * 1024;
        if (!validTypes.includes(file.type)) return this.showNotification('Invalid texture type', 'error');
        if (file.size > maxSize) return this.showNotification('Texture too large', 'error');

        this.uploadedTexture = file;
        const textureArea = document.getElementById('texture-upload-area');
        if (textureArea) textureArea.innerHTML = `<div class="texture-preview"><span>${file.name}</span><button onclick="customizationManager.removeUploadedTexture()">×</button></div>`;
        this.saveDraft();
    }

    removeUploadedTexture() {
        this.uploadedTexture = null;
        const textureArea = document.getElementById('texture-upload-area');
        if (textureArea) {
            textureArea.innerHTML = `<input type="file" id="texture-upload" accept=".png,.jpg,.jpeg" style="display:none;"><div class="upload-placeholder"><p>Upload Custom Texture</p></div>`;
            this.setupTextureUpload();
        }
        this.saveDraft();
    }

    applyMaterialToModel() {
        const mat = document.getElementById('material-type') ? document.getElementById('material-type').value : '';
        if (!window.threeEditor) return this.showNotification('3D editor not ready', 'error');
        this.saveToHistory();
        window.threeEditor.changeMaterial(mat || 'matte');
        if (this.uploadedTexture) console.log('Applying texture', this.uploadedTexture.name);
        this.showNotification('Material applied', 'success');
        this.saveDraft();
        this.updatePriceDisplay();
        this.updateCTAState();
    }

    setupGlobalActions() {
        const resetDesignEl = document.getElementById('resetBtn') || document.getElementById('reset-design');
        if (resetDesignEl) {
            resetDesignEl.addEventListener('click', () => {
                if (confirm('Reset design?')) {
                    if (window.threeEditor) {
                        this.saveToHistory();
                        window.threeEditor.resetDesign();
                    }
                    // clear draft
                    localStorage.removeItem('beautybite:customizeDraft');
                    this.showNotification('Design reset', 'info');
                    this.updatePriceDisplay();
                    this.updateCTAState();
                }
            });
        }

        const exportBtn = document.getElementById('export-image');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportDesignImage());
        const shareBtn = document.getElementById('share-design');
        if (shareBtn) shareBtn.addEventListener('click', () => this.shareDesign());
        const proceedBtn = document.getElementById('proceed-checkout');
        if (proceedBtn) proceedBtn.addEventListener('click', () => this.proceedToCheckout());

        // AddToCart button (scoped)
        const addToCartBtn = document.getElementById('addToCartBtn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                // simple behaviour: collect design and add to local cart
                const design = window.threeEditor ? window.threeEditor.getDesignData() : { timestamp: new Date().toISOString() };
                const cart = JSON.parse(localStorage.getItem('beautybite:cart') || '[]');
                cart.push({ productId: 'custom-guard', design, price: this.computePrice() });
                localStorage.setItem('beautybite:cart', JSON.stringify(cart));
                this.showNotification('Added to cart', 'success');
            });
        }
    }

    // Active-state helper for generic .customize-option elements
    setupActiveOptionHandlers() {
        document.querySelectorAll('.customize-option').forEach(el => {
            el.addEventListener('click', (e) => {
                // toggle single active state within the group if data-group present
                const group = el.dataset.group;
                if (group) {
                    document.querySelectorAll(`.customize-option[data-group="${group}"]`).forEach(sib => sib.classList.remove('is-active'));
                    el.classList.add('is-active');
                } else {
                    el.classList.toggle('is-active');
                }
                this.saveDraft();
                this._debouncedCompute();
            });
        });
    }

    // Price calculation: base + modifiers
    computePrice() {
        let price = Number(this.basePrice) || 0;

        const mat = (document.getElementById('material-type') && document.getElementById('material-type').value) || '';
        const size = (document.getElementById('size-select') && document.getElementById('size-select').value) || 'standard';
        const engrave = (document.getElementById('engrave-option') && document.getElementById('engrave-option').value) || 'none';

        if (mat && this.priceModifiers.material[mat] !== undefined) price += this.priceModifiers.material[mat];
        if (size && this.priceModifiers.size[size] !== undefined) price += this.priceModifiers.size[size];
        if (engrave && this.priceModifiers.engraving[engrave] !== undefined) price += this.priceModifiers.engraving[engrave];

        // Add small surcharge if images/text exist
        const hasText = (document.getElementById('text-input') && document.getElementById('text-input').value.trim().length > 0);
        const imageApplied = this.uploadedImage ? true : false;
        if (hasText) price += 5;
        if (imageApplied) price += 10;

        return Number(price.toFixed(2));
    }

    updatePriceDisplay() {
        const display = document.getElementById('priceDisplay');
        if (!display) return;
        const price = this.computePrice();
        // Use cartUtils.formatCurrency if available
        let text;
        if (window.cartUtils && typeof window.cartUtils.formatCurrency === 'function') {
            text = window.cartUtils.formatCurrency(price);
        } else {
            text = `$${price.toFixed(2)}`;
        }
        display.textContent = text;
    }

    updateCTAState() {
        const addBtn = document.getElementById('addToCartBtn');
        if (!addBtn) return;
        // Enable when material and size are chosen (as example of required selections)
        const material = document.getElementById('material-type') ? document.getElementById('material-type').value : '';
        const size = document.getElementById('size-select') ? document.getElementById('size-select').value : '';
        const valid = material && size;
        addBtn.disabled = !valid;
    }

    // History management (kept minimal)
    saveToHistory() {
        if (!window.threeEditor) return;
        const design = window.threeEditor.getDesignData();
        if (!design) return;
        if (this.historyPointer < this.designHistory.length - 1) {
            this.designHistory = this.designHistory.slice(0, this.historyPointer + 1);
        }
        this.designHistory.push(JSON.parse(JSON.stringify(design)));
        this.historyPointer = this.designHistory.length - 1;
        this.updateUndoRedoButtons();
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-action');
        const redoBtn = document.getElementById('redo-action');
        if (undoBtn) undoBtn.disabled = this.historyPointer <= 0;
        if (redoBtn) redoBtn.disabled = this.historyPointer >= this.designHistory.length - 1;
    }

    undo() {
        if (this.historyPointer > 0) {
            this.historyPointer--;
            const data = this.designHistory[this.historyPointer];
            if (window.threeEditor && data) window.threeEditor.loadDesignData(data);
            this.updateUndoRedoButtons();
            this.showNotification('Undo applied', 'info');
            this.saveDraft();
            this._debouncedCompute();
        }
    }

    redo() {
        if (this.historyPointer < this.designHistory.length - 1) {
            this.historyPointer++;
            const data = this.designHistory[this.historyPointer];
            if (window.threeEditor && data) window.threeEditor.loadDesignData(data);
            this.updateUndoRedoButtons();
            this.showNotification('Redo applied', 'info');
            this.saveDraft();
            this._debouncedCompute();
        }
    }

    // Minimal wrappers retained from previous implementation
    exportDesignImage() {
        if (!window.threeEditor) return this.showNotification('3D editor not ready', 'error');
        window.threeEditor.exportImage();
        this.showNotification('Image exported', 'success');
    }

    shareDesign() {
        try {
            const designData = window.threeEditor ? window.threeEditor.getDesignData() : {};
            const shareData = btoa(JSON.stringify(designData));
            const shareUrl = `${window.location.origin}${window.location.pathname}?design=${shareData}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                this.showNotification('Share link copied', 'success');
            }).catch(() => {
                const temp = document.createElement('input');
                temp.value = shareUrl;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
                this.showNotification('Share link copied', 'success');
            });
        } catch (e) {
            this.showNotification('Unable to share design', 'error');
        }
    }

    proceedToCheckout() {
        if (!window.threeEditor) return this.showNotification('3D editor not ready', 'error');
        const designData = window.threeEditor.getDesignData();
        localStorage.setItem('beautybite_custom_design', JSON.stringify(designData));
        this.showNotification('Proceeding to checkout', 'success');
        setTimeout(() => {
            // placeholder
            alert('Checkout flow would continue here');
        }, 600);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()">×</button>`;
        document.body.appendChild(notification);
        setTimeout(() => { if (notification.parentElement) notification.remove(); }, 3000);
    }

    // Setup file upload inputs (image/texture). Safe no-op when elements are absent.
    setupFileUploads() {
        try {
            const hasImage = document.getElementById('image-upload-area') || document.getElementById('image-upload');
            if (hasImage) {
                this.setupImageUpload();
                const imgInput = document.getElementById('image-upload');
                if (imgInput && !imgInput.__bbDebouncedBound) {
                    imgInput.addEventListener('change', () => {
                        try { if (this._debouncedCompute) this._debouncedCompute(); } catch (e) { }
                        try {
                            if (window.threeEditor && typeof window.threeEditor.applyImage === 'function' && this.uploadedImage) {
                                window.threeEditor.applyImage(this.uploadedImage);
                            }
                        } catch (_) { }
                    });
                    imgInput.__bbDebouncedBound = true;
                }
            }

            const hasTexture = document.getElementById('texture-upload-area') || document.getElementById('texture-upload');
            if (hasTexture) {
                this.setupTextureUpload();
                const texInput = document.getElementById('texture-upload');
                if (texInput && !texInput.__bbDebouncedBound) {
                    texInput.addEventListener('change', () => {
                        try { if (this._debouncedCompute) this._debouncedCompute(); } catch (e) { }
                    });
                    texInput.__bbDebouncedBound = true;
                }
            }
        } catch (e) {
            // no-op: be defensive
        }
    }
}

// Initialize when DOM is ready (guarded)
let customizationManager = null;
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.customize-layout')) {
        customizationManager = new CustomizationManager();

        // wire undo/redo safely
        const undoBtn = document.getElementById('undo-action');
        const redoBtn = document.getElementById('redo-action');
        if (undoBtn) undoBtn.addEventListener('click', () => customizationManager.undo());
        if (redoBtn) redoBtn.addEventListener('click', () => customizationManager.redo());

        // wire some global change listeners to update CTA and price state
        document.body.addEventListener('change', (e) => {
            customizationManager.updateCTAState();
            customizationManager.saveDraft();
        });

        // ensure Add Text/Add Image are enabled when appropriate on load
        const textInput = document.getElementById('text-input');
        if (textInput) {
            const addTextBtn = document.getElementById('add-text');
            if (addTextBtn) addTextBtn.disabled = textInput.value.trim().length === 0;
        }

        // Restore draft already done in constructor
    }
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CustomizationManager };
}