// Design Manager for BeautyBite 3D Editor
// Handles saving, loading, and managing custom designs

class DesignManager {
    constructor() {
        this.storageKey = 'beautybite_designs';
        this.currentDraftKey = 'beautybite_current_draft';
        this.savedDesigns = [];
        this.currentDesign = null;

        this.init();
    }

    init() {
        this.loadSavedDesigns();
        this.setupEventListeners();
        this.setupAutoSave();

        // Load any existing draft
        this.loadCurrentDraft();

        console.log('Design Manager initialized');
    }

    setupEventListeners() {
        // Save draft button
        document.getElementById('save-draft')?.addEventListener('click', () => {
            this.saveCurrentDesign();
        });

        // Reset design button (already handled in customization.js, but we'll update last saved)
        document.getElementById('reset-design')?.addEventListener('click', () => {
            this.updateLastSaved();
        });

        // Update last saved when design changes (delegated through custom events)
        document.addEventListener('designChanged', () => {
            this.updateLastSaved();
        });
    }

    setupAutoSave() {
        // Auto-save every 30 seconds if there are changes
        setInterval(() => {
            if (this.hasUnsavedChanges()) {
                this.autoSaveDraft();
            }
        }, 30000);
    }

    hasUnsavedChanges() {
        if (!window.threeEditor) return false;

        const currentDesign = window.threeEditor.getDesignData();
        const savedDesign = this.getCurrentDraft();

        return JSON.stringify(currentDesign) !== JSON.stringify(savedDesign);
    }

    autoSaveDraft() {
        if (!window.threeEditor) return;

        const designData = window.threeEditor.getDesignData();
        localStorage.setItem(this.currentDraftKey, JSON.stringify(designData));

        // Update last saved time quietly (no notification)
        this.updateLastSaved();

        console.log('Auto-saved draft');
    }

    saveCurrentDesign() {
        if (!window.threeEditor) {
            this.showNotification('3D editor not ready', 'error');
            return;
        }

        const designData = window.threeEditor.getDesignData();
        const designName = prompt('Enter a name for your design:', `My Design ${new Date().toLocaleDateString()}`);

        if (!designName) return;

        const design = {
            id: this.generateId(),
            name: designName,
            data: designData,
            thumbnail: this.generateThumbnail(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Check if we're updating an existing design
        const existingIndex = this.savedDesigns.findIndex(d => d.id === this.currentDesign?.id);
        if (existingIndex !== -1) {
            this.savedDesigns[existingIndex] = design;
            this.currentDesign = design;
        } else {
            this.savedDesigns.unshift(design); // Add to beginning
            this.currentDesign = design;
        }

        this.saveToStorage();
        this.updateSavedDesignsList();
        this.updateLastSaved();

        this.showNotification('Design saved successfully!', 'success');
    }

    loadDesign(designId) {
        const design = this.savedDesigns.find(d => d.id === designId);
        if (!design) {
            this.showNotification('Design not found', 'error');
            return;
        }

        if (!window.threeEditor) {
            this.showNotification('3D editor not ready', 'error');
            return;
        }

        // Save current state to history before loading
        if (window.customizationManager) {
            window.customizationManager.saveToHistory();
        }

        window.threeEditor.loadDesignData(design.data);
        this.currentDesign = design;

        this.updateLastSaved();
        this.showNotification(`Loaded design: ${design.name}`, 'success');
    }

    deleteDesign(designId) {
        if (!confirm('Are you sure you want to delete this design?')) {
            return;
        }

        this.savedDesigns = this.savedDesigns.filter(d => d.id !== designId);

        // If we're deleting the current design, clear it
        if (this.currentDesign?.id === designId) {
            this.currentDesign = null;
        }

        this.saveToStorage();
        this.updateSavedDesignsList();
        this.showNotification('Design deleted', 'info');
    }

    duplicateDesign(designId) {
        const original = this.savedDesigns.find(d => d.id === designId);
        if (!original) return;

        const duplicate = {
            ...original,
            id: this.generateId(),
            name: `${original.name} (Copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.savedDesigns.unshift(duplicate);
        this.saveToStorage();
        this.updateSavedDesignsList();
        this.showNotification('Design duplicated', 'success');
    }

    loadCurrentDraft() {
        try {
            const draftData = localStorage.getItem(this.currentDraftKey);
            if (draftData) {
                const design = JSON.parse(draftData);

                // Check if draft is significantly different from any saved design
                const isUnique = !this.savedDesigns.some(saved =>
                    JSON.stringify(saved.data) === JSON.stringify(design)
                );

                if (isUnique && Object.keys(design).length > 0) {
                    // Offer to restore draft
                    if (confirm('We found an unsaved design. Would you like to restore it?')) {
                        if (window.threeEditor) {
                            window.threeEditor.loadDesignData(design);
                            this.showNotification('Draft restored', 'success');
                        }
                    } else {
                        // Clear the draft if user doesn't want it
                        this.clearCurrentDraft();
                    }
                }
            }
        } catch (error) {
            console.error('Error loading draft:', error);
            this.clearCurrentDraft();
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.savedDesigns));
        } catch (error) {
            console.error('Error saving designs to storage:', error);
            this.showNotification('Error saving designs. Storage might be full.', 'error');
        }
    }

    loadSavedDesigns() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.savedDesigns = JSON.parse(stored);

                // Ensure all designs have required fields
                this.savedDesigns = this.savedDesigns.map(design => ({
                    id: design.id || this.generateId(),
                    name: design.name || 'Unnamed Design',
                    data: design.data || {},
                    thumbnail: design.thumbnail || '',
                    createdAt: design.createdAt || new Date().toISOString(),
                    updatedAt: design.updatedAt || new Date().toISOString()
                }));
            }
        } catch (error) {
            console.error('Error loading saved designs:', error);
            this.savedDesigns = [];
        }

        this.updateSavedDesignsList();
    }

    updateSavedDesignsList() {
        const container = document.getElementById('saved-designs-list');
        if (!container) return;

        if (this.savedDesigns.length === 0) {
            container.innerHTML = '<p class="no-designs">No saved designs yet</p>';
            return;
        }

        container.innerHTML = this.savedDesigns.map(design => `
            <div class="saved-design-item" data-design-id="${design.id}">
                <div class="design-thumbnail-small">
                    ${design.thumbnail ?
                `<img src="${design.thumbnail}" alt="${design.name}">` :
                `<div class="thumbnail-placeholder-small">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21,15 16,10 5,21"></polyline>
                            </svg>
                        </div>`
            }
                </div>
                <div class="design-info-small">
                    <h4>${this.escapeHtml(design.name)}</h4>
                    <span class="design-date">${new Date(design.updatedAt).toLocaleDateString()}</span>
                </div>
                <div class="design-actions">
                    <button class="btn-load-design" title="Load Design">↻</button>
                    <button class="btn-duplicate-design" title="Duplicate Design">⎘</button>
                    <button class="btn-delete-design" title="Delete Design">×</button>
                </div>
            </div>
        `).join('');

        // Add event listeners to the buttons
        container.querySelectorAll('.btn-load-design').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const designId = e.target.closest('.saved-design-item').dataset.designId;
                this.loadDesign(designId);
            });
        });

        container.querySelectorAll('.btn-duplicate-design').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const designId = e.target.closest('.saved-design-item').dataset.designId;
                this.duplicateDesign(designId);
            });
        });

        container.querySelectorAll('.btn-delete-design').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const designId = e.target.closest('.saved-design-item').dataset.designId;
                this.deleteDesign(designId);
            });
        });
    }

    updateLastSaved() {
        const lastSavedElement = document.getElementById('last-saved');
        if (lastSavedElement) {
            lastSavedElement.textContent = new Date().toLocaleString();
        }
    }

    generateThumbnail() {
        // This would generate an actual thumbnail from the 3D scene
        // For now, return a placeholder or use the Three.js export functionality
        if (window.threeEditor) {
            return window.threeEditor.generateThumbnail();
        }
        return ''; // Return empty string if no thumbnail can be generated
    }

    generateId() {
        return 'design_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getCurrentDraft() {
        try {
            const draft = localStorage.getItem(this.currentDraftKey);
            return draft ? JSON.parse(draft) : null;
        } catch (error) {
            return null;
        }
    }

    clearCurrentDraft() {
        localStorage.removeItem(this.currentDraftKey);
    }

    exportDesign(designId) {
        const design = designId ?
            this.savedDesigns.find(d => d.id === designId) :
            this.currentDesign;

        if (!design) {
            this.showNotification('No design to export', 'error');
            return;
        }

        const designJson = JSON.stringify(design, null, 2);
        const blob = new Blob([designJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `beautybite-design-${design.name.replace(/\s+/g, '-').toLowerCase()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Design exported as JSON', 'success');
    }

    importDesign(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const design = JSON.parse(e.target.result);

                // Validate design structure
                if (!design.name || !design.data) {
                    throw new Error('Invalid design file format');
                }

                // Add required fields if missing
                const importedDesign = {
                    id: this.generateId(),
                    name: design.name,
                    data: design.data,
                    thumbnail: design.thumbnail || '',
                    createdAt: design.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                this.savedDesigns.unshift(importedDesign);
                this.saveToStorage();
                this.updateSavedDesignsList();

                this.showNotification('Design imported successfully!', 'success');

            } catch (error) {
                this.showNotification('Error importing design: ' + error.message, 'error');
            }
        };

        reader.readAsText(file);
    }

    getDesignStats() {
        return {
            totalDesigns: this.savedDesigns.length,
            totalCustomizations: this.savedDesigns.reduce((acc, design) =>
                acc + (design.data.customizations?.length || 0), 0),
            storageUsage: this.getStorageUsage(),
            lastBackup: this.getLastBackupTime()
        };
    }

    getStorageUsage() {
        try {
            const designsJson = JSON.stringify(this.savedDesigns);
            return (new Blob([designsJson]).size / 1024).toFixed(2) + ' KB';
        } catch (error) {
            return 'Unknown';
        }
    }

    getLastBackupTime() {
        // This would track when designs were last backed up to cloud
        // For now, return last save time
        return this.savedDesigns.length > 0 ?
            new Date(Math.max(...this.savedDesigns.map(d => new Date(d.updatedAt)))) :
            'Never';
    }

    escapeHtml(unsafe) {
        return (unsafe || '').toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    showNotification(message, type = 'info') {
        // Use the same notification system as customization manager
        if (window.customizationManager && window.customizationManager.showNotification) {
            window.customizationManager.showNotification(message, type);
        } else {
            // Fallback notification
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    // Method to be called when the page is about to unload
    handlePageUnload() {
        if (this.hasUnsavedChanges() && window.threeEditor) {
            // Modern browsers require preventing default and setting returnValue
            const designData = window.threeEditor.getDesignData();
            localStorage.setItem(this.currentDraftKey, JSON.stringify(designData));
        }
    }
}

// Initialize when DOM is loaded
let designManager;

document.addEventListener('DOMContentLoaded', () => {
    designManager = new DesignManager();
});

// Handle page unload to save draft
window.addEventListener('beforeunload', (e) => {
    if (designManager && designManager.hasUnsavedChanges()) {
        // Modern browsers require preventing default and setting returnValue
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
    }
});

window.addEventListener('unload', () => {
    if (designManager) {
        designManager.handlePageUnload();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DesignManager };
}