// main.js - Main application entry point
// Zero-dependency architecture with ES modules

import { ValidationEngine } from './validation-engine.js';
import { ClinicalScales } from './clinical-scales.js';
import { GeminiClient } from './api-client.js';
import { UIController, UIUtils } from './ui-components.js';
import { appStore, actions, computed } from './app-state.js';

/**
 * NeuroScribe V11 - Main Application
 * Modular, maintainable, zero-dependency clinical documentation
 */
class NeuroScribeApp {
    constructor() {
        // Initialize core services
        this.validator = null;
        this.scales = null;
        this.apiClient = null;
        this.ui = null;
        
        // Debounced functions
        this.debouncedValidate = UIUtils.debounce(this.validateContent.bind(this), 1000);
        this.debouncedWordCount = UIUtils.debounce(this.updateWordCount.bind(this), 300);
        
        // Initialize application
        this.initialize();
    }
    
    /**
     * Initialize application
     */
    async initialize() {
        console.log('🚀 NeuroScribe V11 initializing...');
        
        try {
            // Initialize UI first
            this.ui = new UIController({
                // Custom selectors if needed
            });
            
            // Check for API key
            const apiKey = await this.loadApiKey();
            if (!apiKey) {
                // Show API key modal
                const key = await this.ui.showApiKeyModal();
                appStore.setState({ apiKey: key });
            } else {
                appStore.setState({ apiKey });
            }
            
            // Initialize services
            await this.initializeServices();
            
            // Subscribe to state changes
            this.subscribeToState();
            
            // Attach event listeners
            this.attachEventListeners();
            
            // Load saved data
            this.loadSavedData();
            
            console.log('✅ NeuroScribe ready!');
            this.ui.showSuccess('NeuroScribe initialized successfully');
            
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.ui.showError(`Failed to initialize: ${error.message}`);
        }
    }
    
    /**
     * Initialize core services
     */
    async initializeServices() {
        // Initialize validation engine
        this.validator = new ValidationEngine({
            ultrathinkMode: false,
            confidenceThreshold: 0.7
        });
        
        // Initialize clinical scales
        this.scales = new ClinicalScales();
        
        // Initialize API client
        this.apiClient = new GeminiClient();
        const apiKey = appStore.getState('apiKey');
        if (apiKey) {
            this.apiClient.setKey(apiKey);
        }
        
        console.log('✅ Services initialized');
    }
    
    /**
     * Subscribe to state changes
     */
    subscribeToState() {
        // Subscribe to state changes
        appStore.subscribe((state) => {
            // Update UI based on state changes
            
            // Update word count
            if (state.transcript) {
                this.ui.updateWordCount(state.transcript);
            }
            
            // Update validation display
            if (state.validationResults) {
                this.ui.displayValidation(state.validationResults);
            }
            
            // Update note display
            if (state.currentNote) {
                this.ui.displayNote(state.currentNote);
            }
            
            // Update loading state
            if (state.isLoading) {
                this.ui.showLoading(state.loadingMessage);
            } else {
                this.ui.hideLoading();
            }
        });
    }
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Generate button
        this.ui.elements.generateBtn?.addEventListener('click', () => {
            this.generateClinicalNote();
        });
        
        // Validate button
        this.ui.elements.validateBtn?.addEventListener('click', () => {
            this.validateContent();
        });
        
        // Transcript input
        this.ui.elements.transcript?.addEventListener('input', (e) => {
            appStore.setState({ transcript: e.target.value });
            this.debouncedWordCount(e.target.value);
            
            // Auto-validate if enabled
            if (computed.canValidate() && appStore.getState('preferences.autoValidate')) {
                this.debouncedValidate();
            }
        });
        
        // SOAP inputs
        ['subjective', 'objective', 'assessment', 'plan'].forEach(section => {
            const element = this.ui.elements[`soap${section.charAt(0).toUpperCase() + section.slice(1)}`];
            element?.addEventListener('input', (e) => {
                actions.updateSOAP(section, e.target.value);
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+S: Save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveCurrentWork();
            }
            
            // Ctrl+G: Generate
            if (e.ctrlKey && e.key === 'g') {
                e.preventDefault();
                if (computed.canGenerate()) {
                    this.generateClinicalNote();
                }
            }
            
            // Ctrl+V: Validate
            if (e.ctrlKey && e.key === 'v') {
                e.preventDefault();
                if (computed.canValidate()) {
                    this.validateContent();
                }
            }
            
            // Ctrl+Z: Undo
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                appStore.undo();
            }
            
            // Ctrl+Y: Redo
            if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                appStore.redo();
            }
        });
        
        // Auto-save every 30 seconds
        setInterval(() => {
            this.autoSave();
        }, 30000);
    }
    
    // ============================================
    // Core Functionality
    // ============================================
    
    /**
     * Generate clinical note
     */
    async generateClinicalNote() {
        if (!computed.canGenerate()) {
            this.ui.showWarning('Please enter a transcript and ensure API key is configured');
            return;
        }
        
        actions.setLoading(true, 'Generating clinical note...');
        
        try {
            const state = appStore.getState();
            const { transcript, soapData } = state;
            
            // Combine transcript with SOAP if available
            let input = transcript;
            if (Object.values(soapData).some(v => v)) {
                input += '\n\nSOAP Data:\n';
                if (soapData.subjective) input += `Subjective: ${soapData.subjective}\n`;
                if (soapData.objective) input += `Objective: ${soapData.objective}\n`;
                if (soapData.assessment) input += `Assessment: ${soapData.assessment}\n`;
                if (soapData.plan) input += `Plan: ${soapData.plan}\n`;
            }
            
            // Generate note
            const note = await this.apiClient.generateNote(input, {
                mode: state.preferences.compressionMode,
                includeScales: computed.hasScaleData(),
                scaleData: state.scaleResponses
            });
            
            // Auto-validate if enabled
            let validation = null;
            if (state.preferences.autoValidate) {
                actions.setLoading(true, 'Validating generated note...');
                validation = await this.validator.validate({
                    originalText: input,
                    generatedText: note
                });
            }
            
            // Save results
            actions.saveNote(note, validation);
            
            // Show success
            this.ui.showSuccess('Clinical note generated successfully');
            
            // Switch to output tab
            actions.switchTab('output');
            
        } catch (error) {
            console.error('Generation failed:', error);
            this.ui.showError(`Generation failed: ${error.message}`);
        } finally {
            actions.setLoading(false);
        }
    }
    
    /**
     * Validate current content
     */
    async validateContent() {
        if (!computed.canValidate()) {
            this.ui.showWarning('No content to validate');
            return;
        }
        
        actions.setLoading(true, 'Running 8-layer validation...');
        
        try {
            const state = appStore.getState();
            const { currentNote, transcript } = state;
            
            // Run validation with progress updates
            let layerIndex = 0;
            const layerNames = [
                'Source Grounding', 'Fabrication Detection', 
                'Completeness Check', 'Consistency Validation',
                'Proportionality Check', 'Confidence Calibration',
                'Blacklist Firewall', 'Interactive Resolution'
            ];
            
            // Create progress callback
            const onProgress = (layer) => {
                const percent = Math.round((layerIndex / layerNames.length) * 100);
                this.ui.showProgress(percent, `Validating: ${layerNames[layerIndex]}`);
                layerIndex++;
            };
            
            // Run validation
            const validation = await this.validator.validate({
                originalText: transcript,
                generatedText: currentNote
            }, {
                onProgress,
                mode: state.validationMode
            });
            
            // Update state
            appStore.setState({
                validationResults: validation,
                validationScore: validation.score,
                validationIssues: validation.issues || []
            });
            
            // Show results
            const scoreColor = computed.validationColor();
            const message = `Validation complete: ${validation.score.toFixed(0)}%`;
            
            if (scoreColor === 'green') {
                this.ui.showSuccess(message);
            } else if (scoreColor === 'yellow') {
                this.ui.showWarning(message);
            } else {
                this.ui.showError(message);
            }
            
            // Switch to validation tab
            actions.switchTab('validation');
            
        } catch (error) {
            console.error('Validation failed:', error);
            this.ui.showError(`Validation failed: ${error.message}`);
        } finally {
            actions.setLoading(false);
        }
    }
    
    /**
     * Update word count
     */
    updateWordCount(text) {
        const count = computed.totalWordCount();
        this.ui.updateWordCount(text || appStore.getState('transcript'));
    }
    
    // ============================================
    // Data Management
    // ============================================
    
    /**
     * Load API key from storage
     */
    async loadApiKey() {
        // Try sessionStorage first (clears on tab close)
        let key = sessionStorage.getItem('neuroscribe_api_key');
        
        // Never use localStorage for API keys
        // If you need persistence, implement secure backend storage
        
        return key;
    }
    
    /**
     * Save current work
     */
    saveCurrentWork() {
        const state = appStore.getState();
        
        // Save non-sensitive data to localStorage
        const dataToSave = {
            transcript: state.transcript,
            soapData: state.soapData,
            scaleResponses: state.scaleResponses,
            preferences: state.preferences,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('neuroscribe_draft', JSON.stringify(dataToSave));
        this.ui.showSuccess('Draft saved');
    }
    
    /**
     * Auto-save functionality
     */
    autoSave() {
        // Only auto-save if there's content
        if (computed.totalWordCount() > 0) {
            this.saveCurrentWork();
        }
    }
    
    /**
     * Load saved data
     */
    loadSavedData() {
        try {
            // Load draft
            const draft = localStorage.getItem('neuroscribe_draft');
            if (draft) {
                const data = JSON.parse(draft);
                
                // Check if draft is recent (less than 24 hours old)
                const draftAge = Date.now() - new Date(data.timestamp).getTime();
                const oneDayMs = 24 * 60 * 60 * 1000;
                
                if (draftAge < oneDayMs) {
                    // Load draft data
                    appStore.setState({
                        transcript: data.transcript || '',
                        soapData: data.soapData || {},
                        scaleResponses: data.scaleResponses || {},
                        preferences: data.preferences || {}
                    });
                    
                    // Update UI
                    this.ui.setFormValues({
                        transcript: data.transcript,
                        soap: data.soapData
                    });
                    
                    this.ui.showToast('Draft loaded from previous session', 'info');
                } else {
                    // Clear old draft
                    localStorage.removeItem('neuroscribe_draft');
                }
            }
            
            // Load scale responses
            this.scales.loadSavedResponses();
            
        } catch (error) {
            console.error('Failed to load saved data:', error);
        }
    }
    
    // ============================================
    // Export Functionality
    // ============================================
    
    /**
     * Export current note
     */
    async exportNote(format = 'text') {
        const state = appStore.getState();
        const { currentNote, validationResults } = state;
        
        if (!currentNote) {
            this.ui.showWarning('No note to export');
            return;
        }
        
        let content = '';
        let filename = `clinical_note_${new Date().toISOString().split('T')[0]}`;
        
        switch (format) {
            case 'json':
                content = JSON.stringify({
                    note: currentNote,
                    validation: validationResults,
                    metadata: {
                        generated: new Date().toISOString(),
                        version: 'V11.0'
                    }
                }, null, 2);
                filename += '.json';
                break;
                
            case 'html':
                content = this.generateHTMLExport(currentNote, validationResults);
                filename += '.html';
                break;
                
            case 'text':
            default:
                content = currentNote;
                if (validationResults) {
                    content += `\n\n---\nValidation Score: ${validationResults.score}%`;
                }
                filename += '.txt';
        }
        
        // Create download
        this.downloadFile(content, filename);
        this.ui.showSuccess('Note exported successfully');
    }
    
    /**
     * Generate HTML export
     */
    generateHTMLExport(note, validation) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Clinical Note Export</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #4A90E2; }
        .validation { background: #f0f0f0; padding: 10px; border-radius: 5px; margin-top: 20px; }
        .score { font-size: 24px; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Clinical Note</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <div class="note">${note.replace(/\n/g, '<br>')}</div>
    ${validation ? `
        <div class="validation">
            <h2>Validation Results</h2>
            <div class="score">Quality Score: ${validation.score}%</div>
        </div>
    ` : ''}
</body>
</html>
        `;
    }
    
    /**
     * Download file utility
     */
    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// ============================================
// Application Bootstrap
// ============================================

// Create global instance
let app = null;

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new NeuroScribeApp();
    });
} else {
    // DOM already loaded
    app = new NeuroScribeApp();
}

// Export for testing and debugging
export { NeuroScribeApp, app };

// Make available globally for debugging
window.NeuroScribeApp = NeuroScribeApp;
window.neuroScribeApp = app;