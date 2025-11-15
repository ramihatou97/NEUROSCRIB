/**
 * ========================================================================
 * NeuroScribe V11 - Gemini API Client Module
 * ========================================================================
 *
 * Production-ready Gemini API client with built-in:
 * - Rate limiting (sliding window: 10 calls per 60 seconds)
 * - Retry logic with exponential backoff (max 3 retries)
 * - Timeout handling (30 second default)
 * - Comprehensive error handling
 * - Support for multiple Gemini models
 * - Zero external dependencies
 *
 * Extracted from NeuroScribe V10.2.4 monolith (16,646 lines)
 * Consolidates API logic from lines 2323-2330, 7050-7250, 7701-7900, 8841+
 *
 * @author NeuroScribe Development Team
 * @version 11.0.0
 * @license MIT
 */

/**
 * ========================================================================
 * RATE LIMITER CLASS
 * ========================================================================
 * Implements sliding window rate limiting to prevent API quota exhaustion
 */
class RateLimiter {
    /**
     * Create a rate limiter
     * @param {number} maxCalls - Maximum number of calls allowed per time window
     * @param {number} perMilliseconds - Time window in milliseconds
     */
    constructor(maxCalls = 10, perMilliseconds = 60000) {
        this.maxCalls = maxCalls;
        this.perMilliseconds = perMilliseconds;
        this.callTimestamps = [];
    }

    /**
     * Throttle an async function call
     * @param {Function} fn - Async function to throttle
     * @returns {Promise} Result of the function
     */
    async throttle(fn) {
        const now = Date.now();

        // Remove timestamps older than the time window (sliding window)
        this.callTimestamps = this.callTimestamps.filter(
            timestamp => now - timestamp < this.perMilliseconds
        );

        // Check if we're at the rate limit
        if (this.callTimestamps.length >= this.maxCalls) {
            const oldestCall = Math.min(...this.callTimestamps);
            const waitTime = this.perMilliseconds - (now - oldestCall);

            console.warn(
                `⚠️  Rate limit reached (${this.maxCalls} calls per ${this.perMilliseconds / 1000}s). ` +
                `Waiting ${Math.ceil(waitTime / 1000)}s before next API call...`
            );

            // Wait for the required time before proceeding
            await new Promise(resolve => setTimeout(resolve, waitTime + 100));

            // Clean up old timestamps again after waiting
            const newNow = Date.now();
            this.callTimestamps = this.callTimestamps.filter(
                timestamp => newNow - timestamp < this.perMilliseconds
            );
        }

        // Record this call timestamp
        this.callTimestamps.push(Date.now());

        // Execute the function
        return await fn();
    }

    /**
     * Get current rate limit status
     * @returns {Object} Status object with remaining calls and reset time
     */
    getStatus() {
        const now = Date.now();
        this.callTimestamps = this.callTimestamps.filter(
            timestamp => now - timestamp < this.perMilliseconds
        );

        const remaining = this.maxCalls - this.callTimestamps.length;
        const resetTime = this.callTimestamps.length > 0
            ? Math.max(...this.callTimestamps) + this.perMilliseconds
            : now;

        return {
            remaining,
            limit: this.maxCalls,
            resetIn: Math.max(0, resetTime - now),
            resetTime: new Date(resetTime)
        };
    }

    /**
     * Reset the rate limiter (useful for testing or manual override)
     */
    reset() {
        this.callTimestamps = [];
        console.log('✅ Rate limiter reset');
    }
}

/**
 * ========================================================================
 * GEMINI API CLIENT
 * ========================================================================
 * Main class for interacting with Google Gemini API
 */
export class GeminiClient {
    /**
     * Available Gemini models
     */
    static MODELS = {
        FLASH_2_5: 'gemini-2.5-flash',
        FLASH_2_0_EXP: 'gemini-2.0-flash-exp'
    };

    /**
     * Default configuration constants
     */
    static DEFAULTS = {
        RATE_LIMIT_CALLS: 10,           // Max API calls per time window
        RATE_LIMIT_WINDOW: 60000,       // Time window in milliseconds (60 seconds)
        TIMEOUT_DURATION: 30000,        // API timeout in milliseconds (30 seconds)
        MAX_RETRIES: 3,                 // Maximum retry attempts for failed requests
        RETRY_DELAY_BASE: 1000,         // Base delay for exponential backoff (milliseconds)
        TEMPERATURE: 0.3,               // Default temperature for generation
        MAX_OUTPUT_TOKENS: 4096         // Default max output tokens
    };

    /**
     * API endpoint base URL
     */
    static API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

    /**
     * Create a Gemini API client
     * @param {string} apiKey - Google Gemini API key
     * @param {Object} options - Configuration options
     * @param {string} options.model - Model to use (default: gemini-2.5-flash)
     * @param {number} options.rateLimitCalls - Max calls per window
     * @param {number} options.rateLimitWindow - Time window in ms
     * @param {number} options.timeout - Request timeout in ms
     * @param {number} options.maxRetries - Max retry attempts
     * @param {number} options.retryDelayBase - Base delay for retries in ms
     * @param {number} options.temperature - Default temperature
     * @param {number} options.maxOutputTokens - Default max tokens
     */
    constructor(apiKey, options = {}) {
        if (!apiKey) {
            throw new Error('API key is required');
        }

        if (!apiKey.startsWith('AIza')) {
            throw new Error('Invalid API key format. Gemini API keys start with "AIza"');
        }

        this.apiKey = apiKey;
        this.model = options.model || GeminiClient.MODELS.FLASH_2_5;
        this.timeout = options.timeout || GeminiClient.DEFAULTS.TIMEOUT_DURATION;
        this.maxRetries = options.maxRetries || GeminiClient.DEFAULTS.MAX_RETRIES;
        this.retryDelayBase = options.retryDelayBase || GeminiClient.DEFAULTS.RETRY_DELAY_BASE;
        this.defaultTemperature = options.temperature || GeminiClient.DEFAULTS.TEMPERATURE;
        this.defaultMaxTokens = options.maxOutputTokens || GeminiClient.DEFAULTS.MAX_OUTPUT_TOKENS;

        // Initialize rate limiter
        this.rateLimiter = new RateLimiter(
            options.rateLimitCalls || GeminiClient.DEFAULTS.RATE_LIMIT_CALLS,
            options.rateLimitWindow || GeminiClient.DEFAULTS.RATE_LIMIT_WINDOW
        );

        console.log(`✅ GeminiClient initialized with model: ${this.model}`);
    }

    /**
     * Generate content from a prompt
     * @param {string} prompt - The prompt to send to the model
     * @param {Object} options - Generation options
     * @param {number} options.temperature - Sampling temperature (0.0 to 1.0)
     * @param {number} options.maxOutputTokens - Maximum tokens to generate
     * @param {string} options.model - Override the default model for this request
     * @param {boolean} options.skipRateLimiting - Skip rate limiting for this request
     * @returns {Promise<string>} Generated text
     * @throws {Error} If generation fails after all retries
     */
    async generateContent(prompt, options = {}) {
        if (!prompt || typeof prompt !== 'string') {
            throw new Error('Prompt must be a non-empty string');
        }

        const model = options.model || this.model;
        const temperature = options.temperature ?? this.defaultTemperature;
        const maxOutputTokens = options.maxOutputTokens || this.defaultMaxTokens;
        const skipRateLimiting = options.skipRateLimiting || false;

        console.log(`📡 Generating content with ${model}...`);
        console.log(`   Temperature: ${temperature}, Max tokens: ${maxOutputTokens}`);

        // Wrap the API call with rate limiting
        const apiCall = async () => {
            return await this._generateWithRetry(prompt, {
                model,
                temperature,
                maxOutputTokens
            });
        };

        // Apply rate limiting unless explicitly skipped
        if (skipRateLimiting) {
            return await apiCall();
        } else {
            return await this.rateLimiter.throttle(apiCall);
        }
    }

    /**
     * Internal method to generate content with retry logic
     * @private
     * @param {string} prompt - The prompt text
     * @param {Object} config - Generation configuration
     * @returns {Promise<string>} Generated text
     */
    async _generateWithRetry(prompt, config) {
        let lastError = null;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                // If this is a retry, wait with exponential backoff
                if (attempt > 0) {
                    const delay = this.retryDelayBase * Math.pow(2, attempt - 1);
                    console.log(`🔄 Retry attempt ${attempt + 1}/${this.maxRetries} (waiting ${delay}ms)...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Make the API request with timeout
                const response = await this._fetchWithTimeout(prompt, config);

                console.log(`✅ Content generated successfully (attempt ${attempt + 1})`);
                return response;

            } catch (error) {
                lastError = error;
                console.error(`❌ Generation attempt ${attempt + 1} failed:`, error.message);

                // Don't retry on certain errors
                if (this._isNonRetryableError(error)) {
                    console.error('   Error is non-retryable, aborting...');
                    throw error;
                }

                // If this was the last attempt, throw the error
                if (attempt === this.maxRetries - 1) {
                    console.error('   Max retries reached, giving up');
                    throw new Error(
                        `API request failed after ${this.maxRetries} attempts. Last error: ${error.message}`
                    );
                }
            }
        }

        // This should never be reached, but just in case
        throw lastError || new Error('Unknown error during API request');
    }

    /**
     * Make an API request with timeout handling
     * @private
     * @param {string} prompt - The prompt text
     * @param {Object} config - Generation configuration
     * @returns {Promise<string>} Generated text
     */
    async _fetchWithTimeout(prompt, config) {
        const { model, temperature, maxOutputTokens } = config;

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const url = `${GeminiClient.API_BASE_URL}/${model}:generateContent?key=${this.apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature,
                        maxOutputTokens
                    }
                })
            });

            clearTimeout(timeoutId);

            // Handle HTTP errors
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText };
                }

                const errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
                throw new Error(`API Error ${response.status}: ${errorMessage}`);
            }

            // Parse response
            const data = await response.json();

            // Extract generated text
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!generatedText) {
                throw new Error('No content generated by API (empty response)');
            }

            return generatedText;

        } catch (error) {
            clearTimeout(timeoutId);

            // Handle timeout
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout / 1000} seconds`);
            }

            // Handle network errors
            if (error.message.includes('fetch')) {
                throw new Error(`Network error: ${error.message}`);
            }

            // Re-throw other errors
            throw error;
        }
    }

    /**
     * Determine if an error should not be retried
     * @private
     * @param {Error} error - The error to check
     * @returns {boolean} True if error is non-retryable
     */
    _isNonRetryableError(error) {
        const message = error.message.toLowerCase();

        // Non-retryable error patterns
        const nonRetryablePatterns = [
            'invalid api key',
            'api key not valid',
            'authentication',
            'permission denied',
            'quota exceeded',
            '400',  // Bad request
            '401',  // Unauthorized
            '403',  // Forbidden
            '404'   // Not found
        ];

        return nonRetryablePatterns.some(pattern => message.includes(pattern));
    }

    /**
     * Test if the API key is valid
     * @returns {Promise<boolean>} True if API key is valid
     */
    async testApiKey() {
        console.log('🧪 Testing API key...');

        try {
            // Use minimal request to test key
            await this.generateContent('Test', {
                maxOutputTokens: 10,
                skipRateLimiting: true
            });

            console.log('✅ API key is valid');
            return true;

        } catch (error) {
            console.error('❌ API key test failed:', error.message);
            return false;
        }
    }

    /**
     * Get rate limiter status
     * @returns {Object} Status object with remaining calls and reset time
     */
    getRateLimitStatus() {
        return this.rateLimiter.getStatus();
    }

    /**
     * Reset the rate limiter
     */
    resetRateLimit() {
        this.rateLimiter.reset();
    }

    /**
     * Change the model for subsequent requests
     * @param {string} model - New model name
     */
    setModel(model) {
        if (!Object.values(GeminiClient.MODELS).includes(model)) {
            throw new Error(`Invalid model: ${model}. Use GeminiClient.MODELS constants.`);
        }
        this.model = model;
        console.log(`✅ Model changed to: ${model}`);
    }

    /**
     * Get current configuration
     * @returns {Object} Current client configuration
     */
    getConfig() {
        return {
            model: this.model,
            timeout: this.timeout,
            maxRetries: this.maxRetries,
            retryDelayBase: this.retryDelayBase,
            defaultTemperature: this.defaultTemperature,
            defaultMaxTokens: this.defaultMaxTokens,
            rateLimitStatus: this.getRateLimitStatus()
        };
    }
}

/**
 * ========================================================================
 * USAGE EXAMPLE
 * ========================================================================
 *
 * ```javascript
 * import { GeminiClient } from './api-client.js';
 *
 * // Initialize client
 * const client = new GeminiClient('YOUR_API_KEY', {
 *     model: GeminiClient.MODELS.FLASH_2_5,
 *     temperature: 0.3,
 *     maxOutputTokens: 4096
 * });
 *
 * // Test API key
 * const isValid = await client.testApiKey();
 *
 * // Generate content
 * try {
 *     const response = await client.generateContent('Write a haiku about coding', {
 *         temperature: 0.7,
 *         maxOutputTokens: 100
 *     });
 *     console.log(response);
 * } catch (error) {
 *     console.error('Generation failed:', error.message);
 * }
 *
 * // Check rate limit status
 * const status = client.getRateLimitStatus();
 * console.log(`Remaining calls: ${status.remaining}/${status.limit}`);
 *
 * // Change model
 * client.setModel(GeminiClient.MODELS.FLASH_2_0_EXP);
 *
 * // Get current config
 * const config = client.getConfig();
 * console.log('Current config:', config);
 * ```
 *
 * ========================================================================
 * ERROR HANDLING
 * ========================================================================
 *
 * The client throws errors in the following scenarios:
 *
 * 1. Invalid API key format (constructor)
 * 2. Empty/invalid prompt (generateContent)
 * 3. Network errors (after retries)
 * 4. API errors (400, 401, 403, 404 - no retry)
 * 5. Timeout errors (after retries)
 * 6. Quota exceeded (no retry)
 * 7. Max retries reached (transient errors)
 *
 * All errors include descriptive messages for debugging.
 *
 * ========================================================================
 * RATE LIMITING
 * ========================================================================
 *
 * Rate limiting uses a sliding window algorithm:
 * - Default: 10 calls per 60 seconds
 * - Automatically queues requests when limit reached
 * - Shows warning in console with wait time
 * - Can be customized via constructor options
 * - Can be bypassed per-request with skipRateLimiting option
 *
 * ========================================================================
 * RETRY LOGIC
 * ========================================================================
 *
 * Exponential backoff retry strategy:
 * - Default: 3 retries maximum
 * - Delay calculation: baseDelay * 2^(attempt-1)
 * - Example delays: 1s, 2s, 4s
 * - Non-retryable errors skip retry logic
 * - Configurable via constructor options
 *
 * ========================================================================
 */
