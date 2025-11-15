/**
 * ========================================================================
 * NeuroScribe V11 - Main Application Entry Point
 * ========================================================================
 *
 * Production-ready clinical documentation application
 * Extracted and refactored from V10.2.4 monolith (16,646 lines)
 *
 * ARCHITECTURE:
 * - Modular design with clear separation of concerns
 * - Event-driven state management via appStore
 * - Comprehensive error handling and logging
 * - Zero external dependencies
 * - Full V10.2.4 feature parity
 *
 * MODULES:
 * - ValidationEngine: 8-layer validation system
 * - ClinicalScales: mJOA, Nurick, NDI, ODI, GCS
 * - GeminiClient: Rate-limited API client with retry logic
 * - UIController: All UI interactions and feedback
 * - appStore: Centralized state management
 *
 * @version 11.0.0
 * @author NeuroScribe Development Team
 * @license Proprietary
 */

import { ValidationEngine } from './validation-engine.js';
import { ClinicalScales } from './clinical-scales.js';
import { GeminiClient } from './api-client.js';
import { UIController, UIUtils } from './ui-components.js';
import { appStore, actions, computed } from './app-state.js';

/**
 * ========================================================================
 * MAIN APPLICATION CLASS
 * ========================================================================
 */
class NeuroScribeApp {
    constructor() {
        // Core services
        this.validator = null;
        this.scales = null;
        this.apiClient = null;
        this.ui = null;

        // Speech recognition
        this.recognition = null;
        this.isRecording = false;
        this.confidenceScores = [];

        // Auto-save timer
        this.autoSaveInterval = null;

        // Debounced functions
        this.debouncedValidate = UIUtils.debounce(this.validateContent.bind(this), 1000);
        this.debouncedWordCount = UIUtils.debounce(this.updateWordCount.bind(this), 300);

        // Flag to prevent duplicate initialization
        this.initialized = false;
    }

    /**
     * ====================================================================
     * INITIALIZATION
     * ====================================================================
     */

    /**
     * Initialize application
     */
    async initialize() {
        if (this.initialized) {
            console.warn('⚠️ App already initialized, skipping...');
            return;
        }

        console.log('🚀 NeuroScribe V11 initializing...');
        console.log('   Version: 11.0.0');
        console.log('   Build: Production');

        try {
            // Initialize UI controller first
            this.ui = new UIController({
                // Custom selectors if needed
            });

            // Check for API key
            const apiKey = await this.loadApiKey();
            if (!apiKey) {
                console.log('📝 No API key found, prompting user...');
                const key = await this.ui.showApiKeyModal();
                if (key) {
                    await this.saveApiKey(key);
                    appStore.setState({ apiKey: key });
                } else {
                    throw new Error('API key is required to use NeuroScribe');
                }
            } else {
                console.log('✅ API key loaded from session storage');
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

            // Initialize speech recognition if available
            this.initSpeechRecognition();

            // Start auto-save timer
            this.startAutoSave();

            // Restore panel states
            this.restorePanelStates();

            this.initialized = true;

            console.log('✅ NeuroScribe ready!');
            this.ui.showSuccess('NeuroScribe initialized successfully');

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.ui.showError(`Failed to initialize: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initialize core services
     */
    async initializeServices() {
        console.log('⚙️ Initializing core services...');

        // Initialize validation engine
        this.validator = new ValidationEngine({
            ultrathinkMode: false,
            confidenceThreshold: 0.7
        });
        console.log('   ✓ ValidationEngine initialized');

        // Initialize clinical scales
        this.scales = new ClinicalScales();
        console.log('   ✓ ClinicalScales initialized');

        // Initialize API client
        this.apiClient = new GeminiClient();
        const apiKey = appStore.getState('apiKey');
        if (apiKey) {
            this.apiClient.setKey(apiKey);
        }
        console.log('   ✓ GeminiClient initialized');

        console.log('✅ All services initialized');
    }

    /**
     * ====================================================================
     * STATE MANAGEMENT
     * ====================================================================
     */

    /**
     * Subscribe to state changes
     */
    subscribeToState() {
        appStore.subscribe((state, previousState) => {
            // Update word count display
            if (state.transcript !== previousState?.transcript) {
                this.updateWordCountDisplay();
            }

            // Update validation display
            if (state.validationResults !== previousState?.validationResults) {
                if (state.validationResults) {
                    this.ui.displayValidation(state.validationResults);
                }
            }

            // Update note display
            if (state.currentNote !== previousState?.currentNote) {
                if (state.currentNote) {
                    this.displayNote(state.currentNote);
                }
            }

            // Update loading state
            if (state.isLoading !== previousState?.isLoading) {
                if (state.isLoading) {
                    this.ui.showLoading(state.loadingMessage);
                } else {
                    this.ui.hideLoading();
                }
            }
        });
    }

    /**
     * ====================================================================
     * EVENT HANDLERS
     * ====================================================================
     */

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        console.log('🎯 Attaching event listeners...');

        // Generate button
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateNote());
        }

        // Validate button
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateContent());
        }

        // Transcript input
        const transcriptArea = document.getElementById('transcript');
        if (transcriptArea) {
            transcriptArea.addEventListener('input', (e) => {
                appStore.setState({ transcript: e.target.value });
                this.debouncedWordCount();

                // Auto-validate if enabled
                const state = appStore.getState();
                if (computed.canValidate() && state.preferences?.autoValidate) {
                    this.debouncedValidate();
                }
            });
        }

        // SOAP inputs
        ['subjective', 'objective', 'assessment', 'plan'].forEach(section => {
            const element = document.getElementById(`soap${section.charAt(0).toUpperCase() + section.slice(1)}`);
            if (element) {
                element.addEventListener('input', (e) => {
                    actions.updateSOAP(section, e.target.value);
                });
            }
        });

        // Copy button
        const copyBtn = document.getElementById('copyBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyToClipboard());
        }

        // Download button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadNote());
        }

        // Clear transcript button
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearTranscript());
        }

        // Speech recognition buttons
        const startRecordingBtn = document.getElementById('startBtn');
        const stopRecordingBtn = document.getElementById('stopBtn');

        if (startRecordingBtn) {
            startRecordingBtn.addEventListener('click', () => this.startRecording());
        }

        if (stopRecordingBtn) {
            stopRecordingBtn.addEventListener('click', () => this.stopRecording());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        console.log('✅ Event listeners attached');
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Ctrl+S: Save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveCurrentWork();
        }

        // Ctrl+G: Generate
        if (e.ctrlKey && e.key === 'g') {
            e.preventDefault();
            if (computed.canGenerate()) {
                this.generateNote();
            }
        }

        // Ctrl+V: Validate (only if not in input field)
        if (e.ctrlKey && e.key === 'v' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
            e.preventDefault();
            if (computed.canValidate()) {
                this.validateContent();
            }
        }

        // Ctrl+Z: Undo
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                e.preventDefault();
                appStore.undo();
            }
        }

        // Ctrl+Y or Ctrl+Shift+Z: Redo
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                e.preventDefault();
                appStore.redo();
            }
        }
    }

    /**
     * ====================================================================
     * CORE GENERATION FUNCTIONALITY
     * ====================================================================
     */

    /**
     * Generate clinical note - main entry point
     */
    async generateNote() {
        // Detect input mode
        const inputMode = this.detectActiveInputPanel();

        if (inputMode === 'soap') {
            await this.generateFromSOAP();
        } else {
            await this.generateFromTranscript();
        }
    }

    /**
     * Detect which input panel is active
     */
    detectActiveInputPanel() {
        const state = appStore.getState();
        const { soapData } = state;

        // Check if any SOAP field has content
        const hasSOAPContent = Object.values(soapData || {}).some(v => v && v.trim().length > 0);

        if (hasSOAPContent) {
            return 'soap';
        }

        return 'transcript';
    }

    /**
     * Generate clinical note from transcript
     */
    async generateFromTranscript() {
        if (!computed.canGenerate()) {
            this.ui.showWarning('Please enter a transcript and ensure API key is configured');
            return;
        }

        actions.setLoading(true, 'Generating clinical note...');

        try {
            const state = appStore.getState();
            const { transcript, preferences } = state;

            console.log('📝 Starting transcript generation...');
            console.log(`   Mode: ${preferences.compressionMode || 'standard'}`);
            console.log(`   Transcript length: ${transcript.length} chars`);

            // Build generation prompt based on mode
            const prompt = this.buildTranscriptPrompt(transcript, preferences);

            // Generate note using API client
            const generatedNote = await this.apiClient.generateContent(prompt, {
                temperature: 0.4,
                maxOutputTokens: 8192
            });

            console.log('✅ Note generated successfully');

            // Apply blacklist filter for safety
            const filteredNote = this.applyBlacklistFilter(generatedNote, transcript);

            // Auto-validate if enabled
            let validationResults = null;
            if (preferences.autoValidate) {
                console.log('🔍 Running auto-validation...');
                actions.setLoading(true, 'Validating generated note...');

                try {
                    validationResults = await this.validator.validate({
                        originalText: transcript,
                        generatedText: filteredNote
                    });

                    console.log(`✅ Validation complete: ${validationResults.score}%`);
                } catch (validError) {
                    console.error('⚠️ Validation failed (non-fatal):', validError);
                }
            }

            // Save results to state
            appStore.setState({
                currentNote: filteredNote,
                validationResults,
                lastGenerated: new Date().toISOString()
            });

            // Update UI
            this.ui.showSuccess('Clinical note generated successfully');
            actions.switchTab('output');

        } catch (error) {
            console.error('❌ Generation failed:', error);
            this.ui.showError(`Generation failed: ${error.message}`);
        } finally {
            actions.setLoading(false);
        }
    }

    /**
     * Generate clinical note from SOAP entry
     */
    async generateFromSOAP() {
        const state = appStore.getState();
        const { soapData } = state;

        // Validate SOAP entry
        const hasContent = Object.values(soapData || {}).some(v => v && v.trim().length > 0);

        if (!hasContent) {
            this.ui.showWarning('Please enter SOAP data first');
            return;
        }

        actions.setLoading(true, 'Generating from SOAP entry...');

        try {
            console.log('📝 Starting SOAP generation...');

            // Build SOAP text
            let soapText = '';
            if (soapData.subjective) soapText += `Subjective: ${soapData.subjective}\n\n`;
            if (soapData.objective) soapText += `Objective: ${soapData.objective}\n\n`;
            if (soapData.assessment) soapText += `Assessment: ${soapData.assessment}\n\n`;
            if (soapData.plan) soapText += `Plan: ${soapData.plan}\n\n`;

            // Build generation prompt
            const prompt = this.buildSOAPPrompt(soapText, state.preferences);

            // Generate note
            const generatedNote = await this.apiClient.generateContent(prompt, {
                temperature: 0.4,
                maxOutputTokens: 8192
            });

            console.log('✅ SOAP note generated successfully');

            // Apply blacklist filter
            const filteredNote = this.applyBlacklistFilter(generatedNote, soapText);

            // Save results
            appStore.setState({
                currentNote: filteredNote,
                lastGenerated: new Date().toISOString()
            });

            // Update UI
            this.ui.showSuccess('Note generated from SOAP entry');
            actions.switchTab('output');

        } catch (error) {
            console.error('❌ SOAP generation failed:', error);
            this.ui.showError(`SOAP generation failed: ${error.message}`);
        } finally {
            actions.setLoading(false);
        }
    }

    /**
     * Build transcript generation prompt
     */
    buildTranscriptPrompt(transcript, preferences) {
        const mode = preferences.compressionMode || 'standard';

        if (mode === 'ultrathin') {
            return this.buildUltraThinPrompt(transcript);
        }

        return this.buildStandardPrompt(transcript);
    }

    /**
     * Build standard generation prompt
     */
    buildStandardPrompt(transcript) {
        return `You are a medical documentation assistant. Convert this clinical consultation transcript into professional clinical documentation.

CRITICAL RULES - WHAT YOU MUST DO:
✅ Extract all information from transcript systematically
✅ Organize into proper SOAP/consultation format
✅ Use correct medical terminology and grammar
✅ Expand common abbreviations appropriately
✅ Maintain chronological narrative in HPI

CRITICAL RULES - WHAT YOU MUST NOT DO:
❌ DO NOT add medical facts, symptoms, or findings not in transcript
❌ DO NOT infer or assume clinical information
❌ DO NOT add differential diagnoses beyond what clinician stated
❌ DO NOT add workup studies not discussed in transcript
❌ DO NOT add treatment recommendations not mentioned
❌ DO NOT add examination findings not documented
❌ If information not mentioned, note "[Not documented]"

EXTRACTION REQUIREMENTS:
- Extract EVERY clinical detail mentioned in transcript
- Quantify when possible (pain scores, duration, frequency, ranges)
- Note temporal patterns (onset, progression, alleviating/aggravating factors)
- Document all examination findings with precise descriptions
- Identify any red flags or concerning features
- Note information gaps that should be obtained

📋 CHIEF COMPLAINT FORMATTING RULES:
- START with clinical summary using precise anatomical/pathological terminology
- END with direct patient quote if emotionally significant
- Format when quote present: [Clinical summary]. Patient states, "[Direct verbatim quote]."
- Prioritize quotes expressing pain severity, functional impact, emotional distress, urgency
- ONLY include quotes that are VERBATIM from transcript

🔍 PHYSICAL EXAMINATION DOCUMENTATION REQUIREMENTS:
- Document ALL examination elements that were performed with findings
- For examination elements NOT performed: State "not documented"
- Never leave exam subsections blank - always document presence or absence
- Complete documentation shows thoroughness and identifies information gaps

📝 PLAN SECTION FORMATTING REQUIREMENTS:
- Structure the plan with SPECIFIC, ACTIONABLE steps
- Include TIMELINES when discussed
- Document PATIENT EDUCATION topics covered
- Address PATIENT QUESTIONS/CONCERNS if discussed
- For surgical cases: Include post-op expectations, recovery timeline, restrictions

# NEUROSURGICAL CONSULTATION NOTE

## CHIEF COMPLAINT
[Clinical summary using anatomical terminology]

## HISTORY OF PRESENT ILLNESS
[Comprehensive narrative including: onset, location, duration, character, alleviating/aggravating factors, radiation, temporal pattern, associated symptoms, treatments tried, functional impact]

## PAST MEDICAL HISTORY
[List all conditions mentioned]

## PAST SURGICAL HISTORY
[List all surgeries with approximate dates if provided]

## MEDICATIONS
[List all medications with dosages if mentioned]

## ALLERGIES
[List drug/environmental allergies and reactions]

## PHYSICAL EXAMINATION
- **Vital Signs:** [Extract if mentioned, otherwise state "not documented"]
- **General Appearance:** [Patient's overall presentation if described, otherwise "not documented"]
- **Neurological Examination:**
  - Mental Status: [Orientation, attention, memory if assessed, otherwise "not documented"]
  - Cranial Nerves: [I-XII assessment results if performed, otherwise "not documented"]
  - Motor: [Strength by muscle group, tone, bulk if examined, otherwise "not documented"]
  - Sensory: [Modalities tested and distributions if assessed, otherwise "not documented"]
  - Reflexes: [DTRs, pathological reflexes if tested, otherwise "not documented"]
  - Cerebellar: [Coordination, dysmetria if examined, otherwise "not documented"]
  - Gait: [Pattern, stability, aids needed if observed, otherwise "not documented"]

## DIAGNOSTIC RESULTS
[Imaging, labs, EMG/NCS - extract findings if discussed]

## ASSESSMENT
[Clinician's stated diagnosis/impression from transcript]

## PLAN
[Structure the management plan with specific, actionable steps if discussed]

## ICD-10 CODES
[Only if diagnosis clearly stated in transcript]

FINAL CHECK - CRITICAL:
✓ Used ONLY information explicitly in transcript
✓ Added NO medical facts, symptoms, or findings
✓ Professional language and organization from transcript content only

Transcript:
${transcript}`;
    }

    /**
     * Build ULTRATHIN compression prompt
     */
    buildUltraThinPrompt(transcript) {
        return `You are a medical documentation assistant specialized in creating ultra-concise clinical notes.

COMPRESSION RULES:
✅ Include ONLY critical information: chief complaint, key findings, diagnosis, plan
✅ Use medical abbreviations appropriately
✅ Eliminate all non-essential details
✅ Target length: 150-300 words maximum

❌ DO NOT add information not in transcript
❌ DO NOT sacrifice critical clinical details
❌ DO NOT omit red flags or concerning findings

# ULTRATHIN CLINICAL NOTE

**CC:** [Brief chief complaint - 1 line]

**HPI:** [Essential history - 2-3 sentences max]

**PMH/PSH:** [Relevant conditions only - 1 line]

**Meds:** [Current relevant meds only]

**Exam:** [Key positive/negative findings only - 2-3 lines]

**Assessment:** [Primary diagnosis - 1-2 lines]

**Plan:** [Action items only - bullet points]

Transcript:
${transcript}`;
    }

    /**
     * Build SOAP generation prompt
     */
    buildSOAPPrompt(soapText, preferences) {
        return `You are a medical documentation assistant. Expand the following SOAP notes into a professional clinical note.

CRITICAL RULES:
✅ Expand brief SOAP notes into professional narrative
✅ Use proper medical terminology and grammar
✅ Maintain all information from SOAP notes

❌ DO NOT add information not in SOAP notes
❌ DO NOT infer or fabricate clinical details
❌ DO NOT add differential diagnoses not mentioned
❌ DO NOT add workup or treatments not documented

# CLINICAL NOTE

## SUBJECTIVE
[Expand subjective section professionally]

## OBJECTIVE
[Expand objective section professionally]

## ASSESSMENT
[Expand assessment section professionally]

## PLAN
[Expand plan section professionally]

SOAP Notes:
${soapText}`;
    }

    /**
     * Apply blacklist filter to remove fabricated terms
     */
    applyBlacklistFilter(generatedText, sourceText) {
        console.log('🛡️ Applying blacklist filter...');

        const blacklistTerms = [
            // Psychiatric terms
            'suicidal ideation', 'suicide', 'suicidal thoughts', 'suicidal',
            'depression', 'depressive', 'depressed',
            'mental health concerns', 'mental health', 'psychiatric symptoms',
            'psychological distress', 'anxiety disorder', 'psychosis',
            'mood disorder', 'bipolar', 'schizophrenia',
            'substance abuse', 'drug-seeking', 'opioid dependency',
            // Commonly hallucinated medications
            'propranolol', 'beta-blocker', 'beta blocker',
            'warfarin', 'anticoagulant', 'anticoagulation',
            'clopidogrel', 'plavix',
            'apixaban', 'eliquis',
            'lisinopril', 'ace inhibitor',
            'metformin', 'insulin',
            'sertraline', 'zoloft', 'antidepressant'
        ];

        const sourceLower = sourceText.toLowerCase();
        let filtered = generatedText;
        let removedTerms = [];
        let sentencesRemoved = 0;

        // Check each blacklist term
        blacklistTerms.forEach(term => {
            const termRegex = new RegExp(`\\b${term}\\b`, 'gi');

            // If term appears in generated text but NOT in source
            if (termRegex.test(filtered) && !sourceLower.includes(term.toLowerCase())) {
                // Remove sentences containing this term
                const sentences = filtered.split(/([.!?](?:\s+|\n+))/);
                const filteredSentences = [];

                for (let i = 0; i < sentences.length; i++) {
                    const sentence = sentences[i];
                    const hasTerm = termRegex.test(sentence);

                    if (hasTerm && !sentence.match(/^[.!?]\s*$/)) {
                        removedTerms.push(term);
                        sentencesRemoved++;
                        console.warn(`⚠️ [BLACKLIST] Removed sentence containing: "${term}"`);
                    } else {
                        filteredSentences.push(sentence);
                    }
                }

                filtered = filteredSentences.join('');
            }
        });

        if (removedTerms.length > 0) {
            const uniqueTerms = [...new Set(removedTerms)];
            console.warn(`🚨 BLACKLIST FILTER ACTIVATED`);
            console.warn(`   Removed ${sentencesRemoved} sentence(s) containing ${uniqueTerms.length} blacklisted term(s)`);
            console.warn(`   Terms: ${uniqueTerms.join(', ')}`);

            this.ui.showWarning(`Blacklist filter removed ${sentencesRemoved} fabricated sentence(s)`);
        } else {
            console.log('✅ No blacklisted terms detected');
        }

        return filtered;
    }

    /**
     * ====================================================================
     * VALIDATION
     * ====================================================================
     */

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

            console.log('🔍 Starting validation...');

            // Run validation with progress tracking
            const validationResults = await this.validator.validate({
                originalText: transcript,
                generatedText: currentNote
            });

            console.log(`✅ Validation complete: ${validationResults.score}%`);

            // Update state
            appStore.setState({
                validationResults,
                validationScore: validationResults.score,
                validationIssues: validationResults.issues || []
            });

            // Show results
            const score = validationResults.score;
            const message = `Validation complete: ${score.toFixed(0)}%`;

            if (score >= 80) {
                this.ui.showSuccess(message);
            } else if (score >= 60) {
                this.ui.showWarning(message);
            } else {
                this.ui.showError(message);
            }

            // Switch to validation tab
            actions.switchTab('validation');

        } catch (error) {
            console.error('❌ Validation failed:', error);
            this.ui.showError(`Validation failed: ${error.message}`);
        } finally {
            actions.setLoading(false);
        }
    }

    /**
     * ====================================================================
     * SPEECH RECOGNITION
     * ====================================================================
     */

    /**
     * Initialize speech recognition
     */
    initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('⚠️ Speech recognition not supported in this browser');
            const startBtn = document.getElementById('startBtn');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.title = 'Speech recognition not supported';
            }
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 3;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this.isRecording = true;
            this.updateRecordingUI();
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                const confidence = event.results[i][0].confidence;

                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                    if (confidence) {
                        this.confidenceScores.push(confidence);
                    }
                }
            }

            if (finalTranscript) {
                const transcriptArea = document.getElementById('transcript');
                if (transcriptArea) {
                    transcriptArea.value += finalTranscript;
                    appStore.setState({ transcript: transcriptArea.value });
                    this.updateWordCountDisplay();
                }
            }
        };

        this.recognition.onerror = (event) => {
            console.error('❌ Speech recognition error:', event.error);
            this.ui.showError(`Speech recognition error: ${event.error}`);
            this.isRecording = false;
            this.updateRecordingUI();
        };

        this.recognition.onend = () => {
            console.log('🛑 Speech recognition ended');
            this.isRecording = false;
            this.updateRecordingUI();
        };

        console.log('✅ Speech recognition initialized');
    }

    /**
     * Start recording
     */
    startRecording() {
        if (!this.recognition) {
            this.ui.showError('Speech recognition not available');
            return;
        }

        try {
            this.recognition.start();
            this.ui.showInfo('Recording started');
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.ui.showError('Failed to start recording');
        }
    }

    /**
     * Stop recording
     */
    stopRecording() {
        if (!this.recognition || !this.isRecording) {
            return;
        }

        try {
            this.recognition.stop();
            this.ui.showInfo('Recording stopped');
        } catch (error) {
            console.error('Failed to stop recording:', error);
        }
    }

    /**
     * Update recording UI
     */
    updateRecordingUI() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const status = document.getElementById('status');

        if (this.isRecording) {
            if (startBtn) startBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;
            if (status) {
                status.className = 'status recording';
                status.textContent = '🔴 Recording in progress...';
            }
        } else {
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            if (status) {
                status.className = 'status connected';
                status.textContent = '✅ Ready to generate';
            }
        }
    }

    /**
     * ====================================================================
     * CONTENT MANAGEMENT
     * ====================================================================
     */

    /**
     * Update word count display
     */
    updateWordCountDisplay() {
        const state = appStore.getState();
        const transcript = state.transcript || '';
        const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;

        const wordCountEl = document.getElementById('wordCount');
        if (wordCountEl) {
            wordCountEl.textContent = wordCount;
        }
    }

    /**
     * Update word count (for external calls)
     */
    updateWordCount() {
        this.updateWordCountDisplay();
    }

    /**
     * Clear transcript
     */
    clearTranscript() {
        if (!confirm('Clear transcript? This action cannot be undone.')) {
            return;
        }

        appStore.setState({ transcript: '' });

        const transcriptArea = document.getElementById('transcript');
        if (transcriptArea) {
            transcriptArea.value = '';
        }

        this.updateWordCountDisplay();
        this.confidenceScores = [];

        this.ui.showInfo('Transcript cleared');
    }

    /**
     * Display generated note
     */
    displayNote(note) {
        const outputArea = document.getElementById('output');
        if (outputArea) {
            outputArea.value = note;
        }

        // Also update formatted output if available
        const formattedOutput = document.getElementById('formattedOutput');
        if (formattedOutput) {
            // Convert markdown-style formatting to HTML
            const formatted = note
                .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');

            formattedOutput.innerHTML = formatted;
        }
    }

    /**
     * ====================================================================
     * EXPORT & SAVE
     * ====================================================================
     */

    /**
     * Copy to clipboard
     */
    async copyToClipboard() {
        const state = appStore.getState();
        const { currentNote } = state;

        if (!currentNote) {
            this.ui.showWarning('No note to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(currentNote);
            this.ui.showSuccess('Note copied to clipboard');
        } catch (error) {
            console.error('Failed to copy:', error);

            // Fallback method
            const outputArea = document.getElementById('output');
            if (outputArea) {
                outputArea.select();
                document.execCommand('copy');
                this.ui.showSuccess('Note copied to clipboard');
            } else {
                this.ui.showError('Failed to copy to clipboard');
            }
        }
    }

    /**
     * Download note
     */
    downloadNote() {
        const state = appStore.getState();
        const { currentNote } = state;

        if (!currentNote) {
            this.ui.showWarning('No note to download');
            return;
        }

        const filename = `clinical-note-${new Date().toISOString().split('T')[0]}.txt`;
        const blob = new Blob([currentNote], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.ui.showSuccess('Note downloaded');
    }

    /**
     * Save current work
     */
    saveCurrentWork() {
        const state = appStore.getState();

        // Save non-sensitive data to localStorage
        const dataToSave = {
            transcript: state.transcript || '',
            soapData: state.soapData || {},
            scaleResponses: state.scaleResponses || {},
            preferences: state.preferences || {},
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem('neuroscribe_draft', JSON.stringify(dataToSave));
            this.ui.showSuccess('Draft saved');
            console.log('✅ Draft saved to localStorage');
        } catch (error) {
            console.error('Failed to save draft:', error);
            this.ui.showError('Failed to save draft');
        }
    }

    /**
     * Auto-save functionality
     */
    autoSave() {
        const wordCount = computed.totalWordCount();
        if (wordCount > 0) {
            this.saveCurrentWork();
        }
    }

    /**
     * Start auto-save timer
     */
    startAutoSave() {
        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            this.autoSave();
        }, 30000);

        console.log('✅ Auto-save enabled (30s interval)');
    }

    /**
     * Load saved data
     */
    loadSavedData() {
        try {
            const draft = localStorage.getItem('neuroscribe_draft');
            if (!draft) {
                return;
            }

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
                    preferences: { ...appStore.getState().preferences, ...data.preferences }
                });

                // Update UI
                const transcriptArea = document.getElementById('transcript');
                if (transcriptArea && data.transcript) {
                    transcriptArea.value = data.transcript;
                }

                // Update SOAP fields
                if (data.soapData) {
                    ['subjective', 'objective', 'assessment', 'plan'].forEach(section => {
                        const element = document.getElementById(`soap${section.charAt(0).toUpperCase() + section.slice(1)}`);
                        if (element && data.soapData[section]) {
                            element.value = data.soapData[section];
                        }
                    });
                }

                this.updateWordCountDisplay();

                console.log('✅ Draft loaded from previous session');
                this.ui.showInfo('Draft loaded from previous session');
            } else {
                // Clear old draft
                localStorage.removeItem('neuroscribe_draft');
                console.log('🗑️ Removed old draft (>24h)');
            }

        } catch (error) {
            console.error('Failed to load saved data:', error);
        }
    }

    /**
     * ====================================================================
     * API KEY MANAGEMENT
     * ====================================================================
     */

    /**
     * Load API key from storage
     */
    async loadApiKey() {
        // Try sessionStorage first (clears on tab close)
        const key = sessionStorage.getItem('neuroscribe_api_key');

        // NEVER use localStorage for API keys for security reasons

        return key;
    }

    /**
     * Save API key
     */
    async saveApiKey(key) {
        if (!key) {
            throw new Error('API key is required');
        }

        // Save to sessionStorage only (clears on tab close)
        sessionStorage.setItem('neuroscribe_api_key', key);

        // Update API client
        if (this.apiClient) {
            this.apiClient.setKey(key);
        }

        // Test the key
        const isValid = await this.testApiKey();
        if (!isValid) {
            sessionStorage.removeItem('neuroscribe_api_key');
            throw new Error('Invalid API key');
        }

        console.log('✅ API key saved and validated');
        return true;
    }

    /**
     * Test API key
     */
    async testApiKey() {
        if (!this.apiClient) {
            return false;
        }

        try {
            const isValid = await this.apiClient.testApiKey();
            return isValid;
        } catch (error) {
            console.error('API key test failed:', error);
            return false;
        }
    }

    /**
     * ====================================================================
     * PATHOLOGY & CLINICAL SCALES
     * ====================================================================
     */

    /**
     * Select pathology
     */
    selectPathology(pathologyId) {
        appStore.setState({ selectedPathology: pathologyId });

        // Update UI
        document.querySelectorAll('.pathology-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const selectedBtn = document.querySelector(`[data-pathology="${pathologyId}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        console.log(`✅ Pathology selected: ${pathologyId}`);
    }

    /**
     * Update clinical scales
     */
    updateClinicalScales() {
        if (!this.scales) {
            return;
        }

        const scaleData = this.scales.getAllResponses();
        appStore.setState({ scaleResponses: scaleData });
    }

    /**
     * ====================================================================
     * UI UTILITIES
     * ====================================================================
     */

    /**
     * Restore panel states
     */
    restorePanelStates() {
        try {
            ['briefing', 'transcript'].forEach(panelId => {
                const isCollapsed = localStorage.getItem(`panel_${panelId}_collapsed`) === 'true';
                if (isCollapsed) {
                    const content = document.getElementById(`${panelId}-content`);
                    const icon = document.getElementById(`${panelId}-icon`);
                    if (content) {
                        content.classList.add('collapsed');
                    }
                    if (icon) {
                        icon.classList.add('collapsed');
                    }
                }
            });
        } catch (error) {
            console.error('Error restoring panel states:', error);
        }
    }
}

/**
 * ========================================================================
 * APPLICATION BOOTSTRAP
 * ========================================================================
 */

// Create global instance
let app = null;

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new NeuroScribeApp();
        app.initialize().catch(error => {
            console.error('Fatal initialization error:', error);
            alert(`Failed to initialize NeuroScribe: ${error.message}`);
        });
    });
} else {
    // DOM already loaded
    app = new NeuroScribeApp();
    app.initialize().catch(error => {
        console.error('Fatal initialization error:', error);
        alert(`Failed to initialize NeuroScribe: ${error.message}`);
    });
}

// Export for testing and debugging
export { NeuroScribeApp, app };

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.NeuroScribeApp = NeuroScribeApp;
    window.neuroScribeApp = app;
}

console.log('📦 NeuroScribe V11 main.js loaded');
