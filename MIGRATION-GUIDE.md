# NeuroScribe V11 - API Client Migration Guide

Quick reference for migrating from V10.2.4 monolith API patterns to the new modular `api-client.js`.

---

## Quick Start

### 1. Import the module
```javascript
import { GeminiClient } from './api-client.js';
```

### 2. Initialize once at app load
```javascript
// Global instance
let geminiClient = null;

async function initializeApp() {
    const apiKey = await loadAPIKey(); // Your existing key loading logic

    geminiClient = new GeminiClient(apiKey, {
        temperature: 0.3,
        maxOutputTokens: 4096
    });

    // Test the key
    const isValid = await geminiClient.testApiKey();
    if (!isValid) {
        console.error('Invalid API key');
        // Show error to user
    }
}
```

### 3. Replace API calls
```javascript
// OLD PATTERN (V10.2.4):
const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 4096
            }
        })
    }
);
const data = await response.json();
const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

// NEW PATTERN (V11):
const text = await geminiClient.generateContent(prompt, {
    temperature: 0.3,
    maxOutputTokens: 4096
});
```

---

## Function-by-Function Migration

### 1. `testAPIKey()` → `geminiClient.testApiKey()`

#### V10.2.4 (Lines 7210-7250):
```javascript
async function testAPIKey() {
    const input = document.getElementById('apiKeyInput');
    const key = input.value.trim();

    if (!key) {
        showAPIKeyStatus('error', '❌ Please enter an API key to test');
        return;
    }

    if (!key.startsWith('AIza')) {
        showAPIKeyStatus('error', '❌ Invalid API key format');
        return;
    }

    showAPIKeyStatus('info', '⏳ Testing API key...');

    try {
        const testResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: 'Test' }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 10
                    }
                })
            }
        );

        if (testResponse.ok) {
            showAPIKeyStatus('success', '✅ API key is valid!');
        } else {
            const errorData = await testResponse.json();
            const errorMsg = errorData.error?.message || 'Invalid API key';
            showAPIKeyStatus('error', `❌ API key test failed: ${errorMsg}`);
        }
    } catch (error) {
        showAPIKeyStatus('error', `❌ Error: ${error.message}`);
    }
}
```

#### V11:
```javascript
async function testAPIKey() {
    const input = document.getElementById('apiKeyInput');
    const key = input.value.trim();

    if (!key) {
        showAPIKeyStatus('error', '❌ Please enter an API key to test');
        return;
    }

    showAPIKeyStatus('info', '⏳ Testing API key...');

    try {
        // Create temporary client to test key
        const testClient = new GeminiClient(key);
        const isValid = await testClient.testApiKey();

        if (isValid) {
            showAPIKeyStatus('success', '✅ API key is valid!');
        } else {
            showAPIKeyStatus('error', '❌ API key test failed');
        }
    } catch (error) {
        showAPIKeyStatus('error', `❌ Error: ${error.message}`);
    }
}
```

**Lines saved:** 30 → 15 (50% reduction)

---

### 2. `generateDeepBriefing()` → Use `geminiClient.generateContent()`

#### V10.2.4 (Lines 7701-7900):
```javascript
async function generateDeepBriefing() {
    if (!selectedPathology && !customPathology) {
        alert('Please enter a specific pathology or select a common category');
        return;
    }

    if (!API_KEY) {
        alert('API key not configured.');
        return;
    }

    const depth = document.getElementById('briefingDepth').value;
    const btn = document.getElementById('briefingBtn');
    const output = document.getElementById('briefingOutput');

    btn.disabled = true;
    btn.textContent = '⏳ Generating Deep Research...';
    output.innerHTML = '<p style="color: #999; text-align: center; padding: 30px;">Performing deep search and generating clinical checklist...</p>';

    try {
        // ... lots of setup code ...

        const depthConfig = {
            quick: { tokens: 2048, focus: 'essential checklist items', detail: 'concise' },
            standard: { tokens: 4096, focus: 'comprehensive checklist with evidence', detail: 'detailed' },
            comprehensive: { tokens: 8192, focus: 'exhaustive analysis with decision algorithms', detail: 'exhaustive' }
        };

        const config = depthConfig[depth];

        // ... build prompt ...

        // Call Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: config.tokens
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        const briefingText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No briefing generated';

        // ... process response ...

    } catch (error) {
        console.error('❌ Deep briefing generation error:', error);
        alert(`Error generating briefing: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 Generate Deep Briefing';
    }
}
```

#### V11:
```javascript
async function generateDeepBriefing() {
    if (!selectedPathology && !customPathology) {
        alert('Please enter a specific pathology or select a common category');
        return;
    }

    if (!geminiClient) {
        alert('API key not configured.');
        return;
    }

    const depth = document.getElementById('briefingDepth').value;
    const btn = document.getElementById('briefingBtn');
    const output = document.getElementById('briefingOutput');

    btn.disabled = true;
    btn.textContent = '⏳ Generating Deep Research...';
    output.innerHTML = '<p style="color: #999; text-align: center; padding: 30px;">Performing deep search and generating clinical checklist...</p>';

    try {
        // ... same setup code ...

        const depthConfig = {
            quick: { tokens: 2048, focus: 'essential checklist items', detail: 'concise' },
            standard: { tokens: 4096, focus: 'comprehensive checklist with evidence', detail: 'detailed' },
            comprehensive: { tokens: 8192, focus: 'exhaustive analysis with decision algorithms', detail: 'exhaustive' }
        };

        const config = depthConfig[depth];

        // ... build prompt (same) ...

        // Call via client - ONE LINE!
        const briefingText = await geminiClient.generateContent(prompt, {
            temperature: 0.4,
            maxOutputTokens: config.tokens
        });

        // ... process response (same) ...

    } catch (error) {
        console.error('❌ Deep briefing generation error:', error);
        alert(`Error generating briefing: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 Generate Deep Briefing';
    }
}
```

**Lines saved:** 200 → 170 (30 line reduction in API logic)

---

### 3. `generate()` → Use `geminiClient.generateContent()`

#### V10.2.4 Pattern:
```javascript
async function generate() {
    // ... validation ...

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 4096
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            throw new Error('No content generated');
        }

        // ... process generatedText ...
    } catch (error) {
        // ... error handling ...
    }
}
```

#### V11 Pattern:
```javascript
async function generate() {
    // ... validation ...

    try {
        const generatedText = await geminiClient.generateContent(prompt, {
            temperature: 0.3,
            maxOutputTokens: 4096
        });

        // ... process generatedText (same) ...
    } catch (error) {
        // ... error handling (same) ...
    }
}
```

**Lines saved:** 35 → 10 (70% reduction in API logic)

---

### 4. `generateAttendingSummary()` → Use `geminiClient.generateContent()`

#### V10.2.4:
```javascript
async function generateAttendingSummary(clinicalNote) {
    try {
        const prompt = `Compress this clinical note to 500 tokens:\n${clinicalNote}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 500
                    }
                })
            }
        );

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
        console.error('Summary generation failed:', error);
        throw error;
    }
}
```

#### V11:
```javascript
async function generateAttendingSummary(clinicalNote) {
    try {
        const prompt = `Compress this clinical note to 500 tokens:\n${clinicalNote}`;

        return await geminiClient.generateContent(prompt, {
            temperature: 0.2,
            maxOutputTokens: 500
        });
    } catch (error) {
        console.error('Summary generation failed:', error);
        throw error;
    }
}
```

**Lines saved:** 25 → 10 (60% reduction)

---

## Pattern Reference

### Common Patterns

#### Pattern 1: Standard Generation
```javascript
// OLD:
const response = await fetch(`...?key=${API_KEY}`, {...});
const data = await response.json();
const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

// NEW:
const text = await geminiClient.generateContent(prompt);
```

#### Pattern 2: Custom Temperature
```javascript
// OLD:
body: JSON.stringify({
    generationConfig: {
        temperature: 0.7
    }
})

// NEW:
const text = await geminiClient.generateContent(prompt, {
    temperature: 0.7
});
```

#### Pattern 3: Custom Token Limit
```javascript
// OLD:
body: JSON.stringify({
    generationConfig: {
        maxOutputTokens: 2048
    }
})

// NEW:
const text = await geminiClient.generateContent(prompt, {
    maxOutputTokens: 2048
});
```

#### Pattern 4: Different Model
```javascript
// OLD:
const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
    {...}
);

// NEW:
const text = await geminiClient.generateContent(prompt, {
    model: GeminiClient.MODELS.FLASH_2_0_EXP
});
```

#### Pattern 5: Combined Options
```javascript
// OLD:
const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
    {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048
            }
        })
    }
);

// NEW:
const text = await geminiClient.generateContent(prompt, {
    model: GeminiClient.MODELS.FLASH_2_0_EXP,
    temperature: 0.7,
    maxOutputTokens: 2048
});
```

---

## All Functions to Update

Here's every function in V10.2.4 that calls the Gemini API:

| Function | Lines | Model Used | Temp | Tokens |
|----------|-------|------------|------|--------|
| `testAPIKey()` | 7210-7250 | `2.0-flash-exp` | 0.3 | 10 |
| `extractReasonFromTranscript()` | 7639-7690 | `2.0-flash-exp` | 0.3 | 100 |
| `generateDeepBriefing()` | 7701-7900 | `2.5-flash` | 0.4 | 2048-8192 |
| `generate()` | 8841-10100 | `2.5-flash` | 0.3 | 4096 |
| `generateFromSOAP()` | 10104-10800 | `2.5-flash` | 0.3 | 4096 |
| `generateAttendingSummary()` | 12745-12900 | `2.5-flash` | 0.2 | 500 |
| `generateUltraAttendingSummary()` | 13171-13290 | `2.5-flash` | 0.2 | 300 |
| `generateTelegramSummary()` | 13300-13420 | `2.5-flash` | 0.2 | 200 |
| `generateResolvedNote()` | 16058-16200 | `2.5-flash` | 0.3 | 4096 |

---

## Migration Checklist

### Phase 1: Setup
- [ ] Copy `api-client.js` to project
- [ ] Add import statement at top of script
- [ ] Initialize `geminiClient` in app startup
- [ ] Test initialization with existing API key

### Phase 2: Update Functions (in order)
- [ ] `testAPIKey()` - Easiest, good test case
- [ ] `extractReasonFromTranscript()` - Small function
- [ ] `generateAttendingSummary()` - No UI logic
- [ ] `generateUltraAttendingSummary()` - Similar to above
- [ ] `generateTelegramSummary()` - Similar to above
- [ ] `generateDeepBriefing()` - More complex
- [ ] `generate()` - Most complex, core function
- [ ] `generateFromSOAP()` - Similar to generate()
- [ ] `generateResolvedNote()` - Similar to generate()

### Phase 3: Cleanup
- [ ] Remove old fetch() calls
- [ ] Remove manual error handling (now in client)
- [ ] Remove manual retry logic (now in client)
- [ ] Remove manual timeout logic (now in client)
- [ ] Remove manual rate limiting (now in client)

### Phase 4: Testing
- [ ] Test API key validation
- [ ] Test basic generation
- [ ] Test all generation functions
- [ ] Test error handling
- [ ] Test rate limiting
- [ ] Test timeout scenarios

---

## Benefits After Migration

### Code Reduction
- **Remove ~300 lines** of repetitive API calling code
- **Remove ~100 lines** of manual error handling
- **Remove ~100 lines** of manual rate limiting

**Total: ~500 lines removed from V11**

### Reliability Improvements
- ✅ Consistent error handling across all API calls
- ✅ Automatic retries with exponential backoff
- ✅ Rate limiting prevents quota exhaustion
- ✅ Timeout protection prevents hanging

### Maintainability
- ✅ Single source of truth for API logic
- ✅ Easy to update API patterns globally
- ✅ Clear separation of concerns
- ✅ Better testability

---

## Example: Complete Migration

### Before (V10.2.4):
```javascript
// Somewhere at the top
let API_KEY = null;

// Load API key
async function loadAPIKey() {
    const encrypted = localStorage.getItem('neuroscribe_gemini_key');
    if (encrypted) {
        API_KEY = await decryptAPIKey(encrypted);
    }
}

// Generate function
async function generate() {
    if (!API_KEY) {
        alert('API key not configured');
        return;
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 4096
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('No content generated');
        }

        // Process text...
    } catch (error) {
        console.error('Generation failed:', error);
        alert('Generation failed: ' + error.message);
    }
}
```

### After (V11):
```javascript
// At the top
import { GeminiClient } from './api-client.js';
let geminiClient = null;

// Initialize on load
async function loadAPIKey() {
    const encrypted = localStorage.getItem('neuroscribe_gemini_key');
    if (encrypted) {
        const apiKey = await decryptAPIKey(encrypted);
        geminiClient = new GeminiClient(apiKey, {
            temperature: 0.3,
            maxOutputTokens: 4096
        });
    }
}

// Generate function - much simpler!
async function generate() {
    if (!geminiClient) {
        alert('API key not configured');
        return;
    }

    try {
        const text = await geminiClient.generateContent(prompt);
        // Process text...
    } catch (error) {
        console.error('Generation failed:', error);
        alert('Generation failed: ' + error.message);
    }
}
```

**Result:**
- Lines: 55 → 28 (49% reduction)
- API logic: Centralized and reusable
- Error handling: Automatic with retries
- Rate limiting: Built-in

---

## Testing Your Migration

### 1. Test API Key
```javascript
const isValid = await geminiClient.testApiKey();
console.log('API key valid:', isValid);
```

### 2. Test Basic Generation
```javascript
const response = await geminiClient.generateContent('Test prompt');
console.log('Response:', response);
```

### 3. Test Rate Limiting
```javascript
// Make 12 rapid requests (limit is 10)
for (let i = 0; i < 12; i++) {
    console.log(`Request ${i + 1}...`);
    await geminiClient.generateContent(`Test ${i}`, {
        maxOutputTokens: 10
    });
}
// Should see rate limiting after 10 calls
```

### 4. Test Error Handling
```javascript
try {
    // This should fail gracefully
    await geminiClient.generateContent('');
} catch (error) {
    console.log('Expected error:', error.message);
}
```

### 5. Monitor Console
The client logs all operations:
```
✅ GeminiClient initialized with model: gemini-2.5-flash
📡 Generating content with gemini-2.5-flash...
   Temperature: 0.3, Max tokens: 4096
✅ Content generated successfully (attempt 1)
```

---

## Support

If you encounter issues:

1. Check the console for detailed error messages
2. Verify API key is valid: `await geminiClient.testApiKey()`
3. Check rate limit status: `geminiClient.getRateLimitStatus()`
4. Review examples in `api-client-test.js`
5. Consult `API-CLIENT-README.md`

---

**Ready to migrate!** Start with the simple functions and work your way up to the complex ones.
