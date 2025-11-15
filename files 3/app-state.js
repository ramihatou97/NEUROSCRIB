// app-state.js - Zero-dependency state management with pub/sub pattern
// This prevents main.js from becoming the new monolith

/**
 * Application state store with reactive updates
 * Zero dependencies - just 50 lines of clean JavaScript
 */
const state = {
    // Core application state
    currentNote: null,
    validationResults: null,
    apiKey: null,
    
    // UI state
    activeTab: 'input',
    isLoading: false,
    loadingMessage: '',
    
    // Clinical data
    transcript: '',
    soapData: {
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
    },
    
    // Validation state
    validationMode: 'standard', // 'standard' | 'ultrathink'
    validationScore: null,
    validationIssues: [],
    
    // Clinical scales responses
    scaleResponses: {
        mJOA: null,
        Nurick: null,
        NDI: null,
        ODI: null,
        VAS: null,
        GCS: null
    },
    
    // User preferences (non-sensitive)
    preferences: {
        autoValidate: true,
        showDetailedScores: false,
        compressionMode: 'standard' // 'standard' | 'DOAP' | 'ULTRATHINK'
    }
};

// Set of subscriber callbacks
const listeners = new Set();

// History for undo/redo functionality
const stateHistory = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

/**
 * Main state store API
 */
export const appStore = {
    /**
     * Update state and notify all subscribers
     * @param {Object|Function} updates - New state or updater function
     */
    setState(updates) {
        // Save current state to history
        if (historyIndex < stateHistory.length - 1) {
            // Clear forward history if we're not at the end
            stateHistory.splice(historyIndex + 1);
        }
        
        stateHistory.push(JSON.parse(JSON.stringify(state)));
        if (stateHistory.length > MAX_HISTORY) {
            stateHistory.shift();
        } else {
            historyIndex++;
        }
        
        // Apply updates
        if (typeof updates === 'function') {
            // Allow functional updates like React's setState
            updates = updates(state);
        }
        
        // Deep merge for nested objects
        deepMerge(state, updates);
        
        // Notify all subscribers with new state
        notifyListeners();
    },
    
    /**
     * Subscribe to state changes
     * @param {Function} callback - Called with state on every change
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        listeners.add(callback);
        
        // Send current state immediately
        callback(getStateCopy());
        
        // Return unsubscribe function
        return () => listeners.delete(callback);
    },
    
    /**
     * Get a snapshot of current state
     * @param {String} path - Optional dot-notation path (e.g., 'soapData.subjective')
     * @returns {*} State copy or specific value
     */
    getState(path) {
        const stateCopy = getStateCopy();
        
        if (!path) return stateCopy;
        
        // Support dot notation for nested access
        return path.split('.').reduce((obj, key) => obj?.[key], stateCopy);
    },
    
    /**
     * Reset state to initial values
     * @param {Boolean} preserveApiKey - Keep API key in memory
     */
    reset(preserveApiKey = true) {
        const apiKey = preserveApiKey ? state.apiKey : null;
        
        // Reset to initial state
        Object.keys(state).forEach(key => {
            if (key === 'apiKey' && preserveApiKey) {
                return; // Skip API key
            }
            state[key] = getInitialState()[key];
        });
        
        // Clear history
        stateHistory.length = 0;
        historyIndex = -1;
        
        notifyListeners();
    },
    
    /**
     * Undo last state change
     */
    undo() {
        if (historyIndex > 0) {
            historyIndex--;
            Object.assign(state, JSON.parse(JSON.stringify(stateHistory[historyIndex])));
            notifyListeners();
        }
    },
    
    /**
     * Redo previously undone state change
     */
    redo() {
        if (historyIndex < stateHistory.length - 1) {
            historyIndex++;
            Object.assign(state, JSON.parse(JSON.stringify(stateHistory[historyIndex])));
            notifyListeners();
        }
    },
    
    /**
     * Check if a specific condition is met in state
     * @param {Function} predicate - Function that receives state and returns boolean
     * @returns {Boolean}
     */
    hasState(predicate) {
        return predicate(getStateCopy());
    },
    
    /**
     * Wait for a specific state condition
     * @param {Function} predicate - Condition to wait for
     * @returns {Promise} Resolves when condition is met
     */
    waitFor(predicate) {
        return new Promise(resolve => {
            if (predicate(getStateCopy())) {
                resolve();
                return;
            }
            
            const unsubscribe = this.subscribe(state => {
                if (predicate(state)) {
                    unsubscribe();
                    resolve();
                }
            });
        });
    }
};

/**
 * Helper: Deep merge objects
 */
function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
}

/**
 * Helper: Get deep copy of state
 */
function getStateCopy() {
    return JSON.parse(JSON.stringify(state));
}

/**
 * Helper: Get initial state structure
 */
function getInitialState() {
    return {
        currentNote: null,
        validationResults: null,
        apiKey: null,
        activeTab: 'input',
        isLoading: false,
        loadingMessage: '',
        transcript: '',
        soapData: {
            subjective: '',
            objective: '',
            assessment: '',
            plan: ''
        },
        validationMode: 'standard',
        validationScore: null,
        validationIssues: [],
        scaleResponses: {
            mJOA: null,
            Nurick: null,
            NDI: null,
            ODI: null,
            VAS: null,
            GCS: null
        },
        preferences: {
            autoValidate: true,
            showDetailedScores: false,
            compressionMode: 'standard'
        }
    };
}

/**
 * Helper: Notify all listeners with current state
 */
function notifyListeners() {
    const stateCopy = getStateCopy();
    for (const listener of listeners) {
        // Use setTimeout to ensure async behavior
        setTimeout(() => listener(stateCopy), 0);
    }
}

/**
 * Computed values derived from state
 * These are functions that calculate values based on current state
 */
export const computed = {
    /**
     * Check if note generation is ready
     */
    canGenerate: () => {
        const state = appStore.getState();
        return state.transcript?.length > 10 && state.apiKey && !state.isLoading;
    },
    
    /**
     * Check if validation can run
     */
    canValidate: () => {
        const state = appStore.getState();
        return state.currentNote && !state.isLoading;
    },
    
    /**
     * Get validation status color
     */
    validationColor: () => {
        const score = appStore.getState('validationScore');
        if (!score) return 'gray';
        if (score >= 80) return 'green';
        if (score >= 60) return 'yellow';
        return 'red';
    },
    
    /**
     * Check if any clinical scales have responses
     */
    hasScaleData: () => {
        const responses = appStore.getState('scaleResponses');
        return Object.values(responses).some(r => r !== null);
    },
    
    /**
     * Calculate total word count across all inputs
     */
    totalWordCount: () => {
        const state = appStore.getState();
        const transcript = state.transcript || '';
        const soap = Object.values(state.soapData || {}).join(' ');
        const allText = transcript + ' ' + soap;
        return allText.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
};

/**
 * Actions - Predefined state mutations for common operations
 * These encapsulate business logic and can be imported by components
 */
export const actions = {
    /**
     * Set loading state with message
     */
    setLoading(isLoading, message = '') {
        appStore.setState({ isLoading, loadingMessage: message });
    },
    
    /**
     * Save clinical note and validation results
     */
    saveNote(note, validation) {
        appStore.setState({
            currentNote: note,
            validationResults: validation,
            validationScore: validation?.score || null,
            validationIssues: validation?.issues || []
        });
    },
    
    /**
     * Update SOAP section
     */
    updateSOAP(section, value) {
        if (!['subjective', 'objective', 'assessment', 'plan'].includes(section)) {
            throw new Error(`Invalid SOAP section: ${section}`);
        }
        
        appStore.setState(state => ({
            soapData: {
                ...state.soapData,
                [section]: value
            }
        }));
    },
    
    /**
     * Switch active tab
     */
    switchTab(tabName) {
        appStore.setState({ activeTab: tabName });
    },
    
    /**
     * Update scale response
     */
    updateScaleResponse(scaleName, responses) {
        appStore.setState(state => ({
            scaleResponses: {
                ...state.scaleResponses,
                [scaleName]: responses
            }
        }));
    },
    
    /**
     * Toggle preference
     */
    togglePreference(prefName) {
        appStore.setState(state => ({
            preferences: {
                ...state.preferences,
                [prefName]: !state.preferences[prefName]
            }
        }));
    },
    
    /**
     * Clear all clinical data (keep API key and preferences)
     */
    clearClinicalData() {
        appStore.setState({
            currentNote: null,
            validationResults: null,
            validationScore: null,
            validationIssues: [],
            transcript: '',
            soapData: {
                subjective: '',
                objective: '',
                assessment: '',
                plan: ''
            },
            scaleResponses: {
                mJOA: null,
                Nurick: null,
                NDI: null,
                ODI: null,
                VAS: null,
                GCS: null
            }
        });
    }
};

// Export default for convenience
export default appStore;