// ui-components.js - Zero-dependency UI controller
// Handles all DOM manipulation and UI state management

/**
 * UIController - Centralized UI management
 * Decouples UI manipulation from application logic
 */
export class UIController {
    constructor(selectors = {}) {
        // Cache DOM elements
        this.elements = {};
        this.initializeElements(selectors);
        
        // UI state
        this.modals = new Map();
        this.toasts = [];
        this.activeTab = 'input';
        
        // Initialize
        this.createCommonElements();
        this.attachGlobalListeners();
    }
    
    /**
     * Initialize and cache DOM elements
     */
    initializeElements(selectors) {
        const defaultSelectors = {
            // Main panels
            container: '.container',
            inputPanel: '.input-panel',
            outputPanel: '.output-panel',
            validationPanel: '.validation-panel',
            
            // Input elements
            transcript: '#transcript',
            generateBtn: '#generate-btn',
            validateBtn: '#validate-btn',
            
            // Output elements
            noteDisplay: '#note-output',
            validationDisplay: '#validation-results',
            scoreDisplay: '#quality-score',
            
            // SOAP fields
            soapSubjective: '#soapSubjective',
            soapObjective: '#soapObjective',
            soapAssessment: '#soapAssessment',
            soapPlan: '#soapPlan',
            
            // Status elements
            statusBar: '#status-bar',
            wordCount: '#word-count',
            
            // Tab navigation
            tabButtons: '.tab-button',
            tabPanels: '.tab-panel'
        };
        
        // Merge provided selectors with defaults
        const finalSelectors = { ...defaultSelectors, ...selectors };
        
        // Query and cache elements
        for (const [key, selector] of Object.entries(finalSelectors)) {
            const element = document.querySelector(selector);
            if (element) {
                this.elements[key] = element;
            }
        }
    }
    
    /**
     * Create common UI elements that might not exist yet
     */
    createCommonElements() {
        // Create loading overlay
        if (!document.getElementById('loading-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="spinner"></div>
                    <div class="loading-message"></div>
                </div>
            `;
            overlay.style.cssText = `
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.95);
                z-index: 9999;
                align-items: center;
                justify-content: center;
            `;
            document.body.appendChild(overlay);
        }
        
        // Create toast container
        if (!document.getElementById('toast-container')) {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(toastContainer);
        }
        
        // Create API key modal
        if (!document.getElementById('api-key-modal')) {
            const modal = document.createElement('div');
            modal.id = 'api-key-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h2>API Configuration</h2>
                    <p>Please enter your Google Gemini API key to continue.</p>
                    <p class="security-note">
                        🔒 Your API key will be stored securely in memory only 
                        and cleared when you close this tab.
                    </p>
                    <input type="password" 
                           id="api-key-input" 
                           class="api-key-input"
                           placeholder="Enter your Gemini API key"
                           style="width: 100%; padding: 10px; margin: 10px 0;">
                    <div class="modal-buttons">
                        <button id="save-api-key" class="btn btn-primary">Save</button>
                        <button id="cancel-api-key" class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            `;
            modal.style.cssText = `
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10001;
                align-items: center;
                justify-content: center;
            `;
            document.body.appendChild(modal);
        }
    }
    
    /**
     * Attach global event listeners
     */
    attachGlobalListeners() {
        // Tab switching
        if (this.elements.tabButtons) {
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    this.switchTab(e.target.dataset.tab);
                });
            });
        }
        
        // Close modals on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }
    
    // ============================================
    // Loading States
    // ============================================
    
    /**
     * Show loading overlay with message
     */
    showLoading(message = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        const messageEl = overlay?.querySelector('.loading-message');
        
        if (overlay) {
            overlay.style.display = 'flex';
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
        
        // Disable interactive elements
        this.setInteractiveElementsState(false);
    }
    
    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        // Re-enable interactive elements
        this.setInteractiveElementsState(true);
    }
    
    /**
     * Show progress with percentage
     */
    showProgress(percent, message = '') {
        const overlay = document.getElementById('loading-overlay');
        const messageEl = overlay?.querySelector('.loading-message');
        
        if (overlay) {
            overlay.style.display = 'flex';
            if (messageEl) {
                messageEl.innerHTML = `
                    <div>${message}</div>
                    <div class="progress-bar" style="width: 200px; height: 4px; background: #e0e0e0; margin-top: 10px;">
                        <div style="width: ${percent}%; height: 100%; background: #4A90E2; transition: width 0.3s;"></div>
                    </div>
                    <div>${percent}%</div>
                `;
            }
        }
    }
    
    // ============================================
    // Notifications
    // ============================================
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        
        toast.style.cssText = `
            padding: 15px 20px;
            background: ${colors[type]};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            max-width: 350px;
        `;
        
        toast.textContent = message;
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
        
        this.toasts.push(toast);
    }
    
    /**
     * Show error notification
     */
    showError(message, duration = 5000) {
        this.showToast(message, 'error', duration);
        console.error('[UI Error]:', message);
    }
    
    /**
     * Show success notification
     */
    showSuccess(message, duration = 3000) {
        this.showToast(message, 'success', duration);
    }
    
    /**
     * Show warning notification
     */
    showWarning(message, duration = 4000) {
        this.showToast(message, 'warning', duration);
    }
    
    // ============================================
    // Modal Management
    // ============================================
    
    /**
     * Show API key modal
     */
    showApiKeyModal() {
        return new Promise((resolve, reject) => {
            const modal = document.getElementById('api-key-modal');
            const input = document.getElementById('api-key-input');
            const saveBtn = document.getElementById('save-api-key');
            const cancelBtn = document.getElementById('cancel-api-key');
            
            if (!modal) {
                reject(new Error('API key modal not found'));
                return;
            }
            
            modal.style.display = 'flex';
            input.focus();
            
            const save = () => {
                const key = input.value.trim();
                if (key) {
                    modal.style.display = 'none';
                    input.value = '';
                    resolve(key);
                } else {
                    this.showError('Please enter a valid API key');
                }
            };
            
            const cancel = () => {
                modal.style.display = 'none';
                input.value = '';
                reject(new Error('API key entry cancelled'));
            };
            
            // Event listeners
            saveBtn.onclick = save;
            cancelBtn.onclick = cancel;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') save();
            };
        });
    }
    
    /**
     * Close all modals
     */
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
    
    // ============================================
    // Content Display
    // ============================================
    
    /**
     * Display clinical note
     */
    displayNote(note) {
        if (!this.elements.noteDisplay) return;
        
        // Parse note sections if structured
        if (typeof note === 'object') {
            this.elements.noteDisplay.innerHTML = `
                <div class="clinical-note">
                    <div class="note-section">
                        <h3>Subjective</h3>
                        <p>${note.subjective || ''}</p>
                    </div>
                    <div class="note-section">
                        <h3>Objective</h3>
                        <p>${note.objective || ''}</p>
                    </div>
                    <div class="note-section">
                        <h3>Assessment</h3>
                        <p>${note.assessment || ''}</p>
                    </div>
                    <div class="note-section">
                        <h3>Plan</h3>
                        <p>${note.plan || ''}</p>
                    </div>
                </div>
            `;
        } else {
            // Display as plain text
            this.elements.noteDisplay.textContent = note;
        }
        
        // Scroll to output
        this.elements.noteDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    /**
     * Display validation results
     */
    displayValidation(validation) {
        if (!this.elements.validationDisplay) return;
        
        const scoreColor = validation.score >= 80 ? 'green' : 
                          validation.score >= 60 ? 'yellow' : 'red';
        
        let html = `
            <div class="validation-results">
                <div class="score-badge" style="background: ${scoreColor};">
                    <span class="score-value">${validation.score}</span>
                    <span class="score-label">Quality Score</span>
                </div>
        `;
        
        // Display layer results
        if (validation.layers) {
            html += '<div class="layer-results">';
            for (const [layer, result] of Object.entries(validation.layers)) {
                const layerScore = result.score || 0;
                const layerColor = layerScore >= 80 ? '#4CAF50' : 
                                  layerScore >= 60 ? '#ff9800' : '#f44336';
                
                html += `
                    <div class="layer-result">
                        <div class="layer-name">${this.formatLayerName(layer)}</div>
                        <div class="layer-score" style="color: ${layerColor};">
                            ${layerScore.toFixed(0)}%
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        }
        
        // Display issues
        if (validation.issues && validation.issues.length > 0) {
            html += '<div class="validation-issues">';
            html += '<h4>Issues Found:</h4>';
            html += '<ul>';
            
            validation.issues.forEach(issue => {
                const icon = issue.severity === 'error' ? '❌' : '⚠️';
                html += `<li>${icon} ${issue.message}</li>`;
            });
            
            html += '</ul></div>';
        }
        
        html += '</div>';
        
        this.elements.validationDisplay.innerHTML = html;
    }
    
    /**
     * Update word count display
     */
    updateWordCount(text) {
        if (!this.elements.wordCount) return;
        
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        const count = words.length;
        
        this.elements.wordCount.innerHTML = `
            <span class="word-count-value">${count}</span> words
        `;
    }
    
    // ============================================
    // Tab Management
    // ============================================
    
    /**
     * Switch active tab
     */
    switchTab(tabName) {
        // Update buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.style.display = panel.dataset.panel === tabName ? 'block' : 'none';
        });
        
        this.activeTab = tabName;
    }
    
    // ============================================
    // Form Management
    // ============================================
    
    /**
     * Get form values
     */
    getFormValues() {
        return {
            transcript: this.elements.transcript?.value || '',
            soap: {
                subjective: this.elements.soapSubjective?.value || '',
                objective: this.elements.soapObjective?.value || '',
                assessment: this.elements.soapAssessment?.value || '',
                plan: this.elements.soapPlan?.value || ''
            }
        };
    }
    
    /**
     * Set form values
     */
    setFormValues(values) {
        if (values.transcript && this.elements.transcript) {
            this.elements.transcript.value = values.transcript;
        }
        
        if (values.soap) {
            if (values.soap.subjective && this.elements.soapSubjective) {
                this.elements.soapSubjective.value = values.soap.subjective;
            }
            if (values.soap.objective && this.elements.soapObjective) {
                this.elements.soapObjective.value = values.soap.objective;
            }
            if (values.soap.assessment && this.elements.soapAssessment) {
                this.elements.soapAssessment.value = values.soap.assessment;
            }
            if (values.soap.plan && this.elements.soapPlan) {
                this.elements.soapPlan.value = values.soap.plan;
            }
        }
    }
    
    /**
     * Clear all forms
     */
    clearForms() {
        this.elements.transcript && (this.elements.transcript.value = '');
        this.elements.soapSubjective && (this.elements.soapSubjective.value = '');
        this.elements.soapObjective && (this.elements.soapObjective.value = '');
        this.elements.soapAssessment && (this.elements.soapAssessment.value = '');
        this.elements.soapPlan && (this.elements.soapPlan.value = '');
    }
    
    // ============================================
    // Utility Methods
    // ============================================
    
    /**
     * Enable/disable interactive elements
     */
    setInteractiveElementsState(enabled) {
        const elements = [
            this.elements.generateBtn,
            this.elements.validateBtn,
            this.elements.transcript,
            ...document.querySelectorAll('button, input, textarea, select')
        ];
        
        elements.forEach(el => {
            if (el) {
                el.disabled = !enabled;
            }
        });
    }
    
    /**
     * Format layer name for display
     */
    formatLayerName(name) {
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }
    
    /**
     * Highlight element temporarily
     */
    highlightElement(element, duration = 2000) {
        if (!element) return;
        
        const originalBorder = element.style.border;
        element.style.border = '2px solid #4A90E2';
        element.style.transition = 'border 0.3s';
        
        setTimeout(() => {
            element.style.border = originalBorder;
        }, duration);
    }
    
    /**
     * Scroll to element smoothly
     */
    scrollToElement(element) {
        if (!element) return;
        
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
    
    /**
     * Animate value change (for scores, counts, etc.)
     */
    animateValue(element, start, end, duration = 1000) {
        if (!element) return;
        
        const startTime = performance.now();
        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out-cubic)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            const current = Math.floor(start + (end - start) * easeOut);
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        
        requestAnimationFrame(update);
    }
}

/**
 * Standalone UI utility functions
 * Can be used without instantiating UIController
 */
export const UIUtils = {
    /**
     * Create element with attributes
     */
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        // Set attributes
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key === 'class') {
                element.className = value;
            } else {
                element.setAttribute(key, value);
            }
        }
        
        // Add children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        });
        
        return element;
    },
    
    /**
     * Debounce function for input events
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Throttle function for scroll/resize events
     */
    throttle(func, limit = 100) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * Format date for display
     */
    formatDate(date, format = 'short') {
        const d = new Date(date);
        
        if (format === 'short') {
            return d.toLocaleDateString();
        } else if (format === 'long') {
            return d.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        } else if (format === 'time') {
            return d.toLocaleTimeString();
        } else {
            return d.toLocaleString();
        }
    },
    
    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            } catch (err) {
                document.body.removeChild(textarea);
                return false;
            }
        }
    }
};

// Export default for convenience
export default UIController;