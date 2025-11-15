/**
 * ========================================================================
 * NeuroScribe V11 - API Client Test & Usage Examples
 * ========================================================================
 *
 * This file demonstrates how to use the GeminiClient module
 */

import { GeminiClient } from './api-client.js';

/**
 * Example 1: Basic usage with default settings
 */
async function example1_BasicUsage() {
    console.log('\n========================================');
    console.log('Example 1: Basic Usage');
    console.log('========================================\n');

    const client = new GeminiClient('YOUR_API_KEY_HERE');

    try {
        const response = await client.generateContent(
            'Write a brief clinical note about a patient with cervical myelopathy'
        );
        console.log('Response:', response);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

/**
 * Example 2: Custom configuration
 */
async function example2_CustomConfig() {
    console.log('\n========================================');
    console.log('Example 2: Custom Configuration');
    console.log('========================================\n');

    const client = new GeminiClient('YOUR_API_KEY_HERE', {
        model: GeminiClient.MODELS.FLASH_2_0_EXP,
        temperature: 0.7,
        maxOutputTokens: 2048,
        timeout: 45000,  // 45 seconds
        maxRetries: 5,
        rateLimitCalls: 15,  // More permissive rate limit
        rateLimitWindow: 60000
    });

    console.log('Current config:', client.getConfig());
}

/**
 * Example 3: Testing API key
 */
async function example3_TestApiKey() {
    console.log('\n========================================');
    console.log('Example 3: Test API Key');
    console.log('========================================\n');

    const client = new GeminiClient('YOUR_API_KEY_HERE');

    const isValid = await client.testApiKey();
    console.log('API key valid:', isValid);
}

/**
 * Example 4: Per-request options
 */
async function example4_PerRequestOptions() {
    console.log('\n========================================');
    console.log('Example 4: Per-Request Options');
    console.log('========================================\n');

    const client = new GeminiClient('YOUR_API_KEY_HERE');

    try {
        // Use different model for this specific request
        const response1 = await client.generateContent(
            'Brief summary of spinal cord compression',
            {
                model: GeminiClient.MODELS.FLASH_2_0_EXP,
                temperature: 0.9,
                maxOutputTokens: 500
            }
        );

        // Use different settings for another request
        const response2 = await client.generateContent(
            'Generate DOAP note format',
            {
                temperature: 0.2,
                maxOutputTokens: 150,
                skipRateLimiting: true  // Bypass rate limiting for urgent request
            }
        );

        console.log('Response 1:', response1.substring(0, 100) + '...');
        console.log('Response 2:', response2.substring(0, 100) + '...');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

/**
 * Example 5: Rate limiting demonstration
 */
async function example5_RateLimiting() {
    console.log('\n========================================');
    console.log('Example 5: Rate Limiting');
    console.log('========================================\n');

    // Create client with very restrictive rate limit for demo
    const client = new GeminiClient('YOUR_API_KEY_HERE', {
        rateLimitCalls: 3,
        rateLimitWindow: 10000  // 3 calls per 10 seconds
    });

    console.log('Making 5 rapid requests (3 allowed per 10s)...\n');

    for (let i = 1; i <= 5; i++) {
        console.log(`Request ${i}:`);
        const status = client.getRateLimitStatus();
        console.log(`  - Remaining: ${status.remaining}/${status.limit}`);

        try {
            await client.generateContent(`Test request ${i}`, {
                maxOutputTokens: 10
            });
            console.log(`  - ✅ Success\n`);
        } catch (error) {
            console.error(`  - ❌ Failed: ${error.message}\n`);
        }
    }
}

/**
 * Example 6: Error handling
 */
async function example6_ErrorHandling() {
    console.log('\n========================================');
    console.log('Example 6: Error Handling');
    console.log('========================================\n');

    const client = new GeminiClient('YOUR_API_KEY_HERE');

    // Example 6a: Invalid prompt
    try {
        await client.generateContent('');
    } catch (error) {
        console.log('Empty prompt error:', error.message);
    }

    // Example 6b: Network error (simulated)
    try {
        await client.generateContent('Test prompt');
    } catch (error) {
        console.log('Network/API error:', error.message);
    }
}

/**
 * Example 7: Changing models mid-session
 */
async function example7_ModelSwitching() {
    console.log('\n========================================');
    console.log('Example 7: Model Switching');
    console.log('========================================\n');

    const client = new GeminiClient('YOUR_API_KEY_HERE');

    console.log('Initial model:', client.getConfig().model);

    // Generate with default model
    await client.generateContent('First request');

    // Switch to experimental model
    client.setModel(GeminiClient.MODELS.FLASH_2_0_EXP);
    console.log('New model:', client.getConfig().model);

    // Generate with new model
    await client.generateContent('Second request');
}

/**
 * Example 8: Advanced - Using in NeuroScribe context
 */
async function example8_NeuroScribeContext() {
    console.log('\n========================================');
    console.log('Example 8: NeuroScribe Integration');
    console.log('========================================\n');

    const client = new GeminiClient('YOUR_API_KEY_HERE', {
        model: GeminiClient.MODELS.FLASH_2_5,
        temperature: 0.3,  // Low temperature for medical accuracy
        maxOutputTokens: 4096
    });

    // Example clinical transcript
    const transcript = `
        Patient presents with 3-month history of progressive bilateral hand numbness.
        Positive Hoffman sign bilaterally. MRI shows C5-C6 stenosis with cord signal change.
        mJOA score: 14/18. Discussing surgical options.
    `;

    // Generate clinical note
    const prompt = `
        You are a neurosurgical consultant. Generate a professional clinical note from this transcript:

        ${transcript}

        Format as SOAP note with assessment and plan.
    `;

    try {
        console.log('Generating clinical note...\n');
        const clinicalNote = await client.generateContent(prompt, {
            temperature: 0.2,  // Extra low for clinical documentation
            maxOutputTokens: 2048
        });

        console.log('Generated Clinical Note:');
        console.log('========================');
        console.log(clinicalNote);
        console.log('========================\n');

        // Check remaining rate limit
        const status = client.getRateLimitStatus();
        console.log(`Rate limit status: ${status.remaining}/${status.limit} calls remaining`);

    } catch (error) {
        console.error('Generation failed:', error.message);
    }
}

/**
 * Example 9: Batch processing with rate limiting
 */
async function example9_BatchProcessing() {
    console.log('\n========================================');
    console.log('Example 9: Batch Processing');
    console.log('========================================\n');

    const client = new GeminiClient('YOUR_API_KEY_HERE');

    const prompts = [
        'Explain cervical myelopathy',
        'List red flags for cauda equina syndrome',
        'Describe mJOA scoring system',
        'Outline surgical approach for C5-C6 ACDF'
    ];

    const results = [];

    for (const [index, prompt] of prompts.entries()) {
        console.log(`\nProcessing ${index + 1}/${prompts.length}: ${prompt}`);

        try {
            const response = await client.generateContent(prompt, {
                maxOutputTokens: 200
            });
            results.push({ prompt, response, success: true });
            console.log('  ✅ Success');
        } catch (error) {
            results.push({ prompt, error: error.message, success: false });
            console.log('  ❌ Failed:', error.message);
        }
    }

    console.log('\n\nBatch Results Summary:');
    console.log('======================');
    console.log(`Total: ${results.length}`);
    console.log(`Success: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
}

/**
 * Run all examples (comment out the ones you don't want to run)
 */
async function runExamples() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  NeuroScribe V11 - Gemini API Client Usage Examples       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Uncomment the examples you want to run:

    // await example1_BasicUsage();
    // await example2_CustomConfig();
    // await example3_TestApiKey();
    // await example4_PerRequestOptions();
    // await example5_RateLimiting();
    // await example6_ErrorHandling();
    // await example7_ModelSwitching();
    // await example8_NeuroScribeContext();
    // await example9_BatchProcessing();

    console.log('\n✅ All examples completed!\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runExamples().catch(console.error);
}

export {
    example1_BasicUsage,
    example2_CustomConfig,
    example3_TestApiKey,
    example4_PerRequestOptions,
    example5_RateLimiting,
    example6_ErrorHandling,
    example7_ModelSwitching,
    example8_NeuroScribeContext,
    example9_BatchProcessing
};
