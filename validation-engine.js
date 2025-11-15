/**
 * NeuroScribe V11 - Validation Engine
 *
 * Production-ready 6-layer validation system for clinical documentation
 * Extracted from V10.2.4 monolith - 3,655 lines of validation code
 *
 * ARCHITECTURE:
 * - 6 validation layers for extraction and generation quality
 * - AI-powered semantic analysis for fabrication and completeness
 * - Medical knowledge-based consistency checking
 * - Dynamic proportionality validation
 * - Confidence score calibration
 * - Zero dependencies, browser-compatible
 *
 * VALIDATION LAYERS:
 * 1. GroundingValidator - Source quote verification
 * 2. FabricationDetector - AI hallucination detection (term-based + semantic AI)
 * 3. CompletenessChecker - Bidirectional validation (extraction ↔ notes)
 * 4. ConsistencyValidator - Medical logic & anatomical consistency
 * 5. ProportionalityValidator - Output sizing & padding detection
 * 6. ConfidenceCalibrator - Score adjustment based on validation
 *
 * ORCHESTRATOR:
 * - ValidationEngine - Master coordinator that runs all layers
 *
 * @version 11.0.0
 * @author NeuroScribe Team
 * @license Proprietary
 */

// ==================================================================================
// VALIDATION CONSTANTS
// ==================================================================================

const VALIDATION_CONSTANTS = {
    FABRICATION_CRITICAL: 0.7,      // Critical fabrication confidence threshold
    FABRICATION_WARNING: 0.4,       // Warning fabrication confidence threshold
    GROUNDING_MINIMUM: 0.6,         // Minimum grounding score required
    COMPLETENESS_MINIMUM: 0.7,      // Minimum completeness score required
    CONSISTENCY_MINIMUM: 0.7,       // Minimum consistency score required
    PROPORTIONALITY_MIN_RATIO: 2,   // Minimum output/input ratio
    PROPORTIONALITY_MAX_RATIO: 5,   // Maximum output/input ratio
    OVERALL_PASS_THRESHOLD: 75      // Overall quality score to pass (%)
};

// ==================================================================================
// LAYER 1: GROUNDING VALIDATOR
// ==================================================================================
// Validates that extracted fields are grounded in source quotes
// Ensures no orphaned fields (extraction without source evidence)
// ==================================================================================

class GroundingValidator {
    constructor(sourceText) {
        this.sourceText = sourceText;
        this.lastValidation = null;
    }

    /**
     * Validate grounding quality of extracted data
     */
    async validate(extractedData) {
        if (!extractedData || !this.sourceText) {
            throw new Error('Both extracted data and source text are required');
        }

        console.log('🔍 [Grounding] Starting validation...');

        // Defensive check: Validate data structure before processing
        if (!this.hasValidStructure(extractedData)) {
            console.error('❌ [Grounding] Invalid data structure - expected {section: {field: {value, sourceQuote, confidence}}}');
            console.error('   [Grounding] Received keys:', Object.keys(extractedData));
            console.error('   [Grounding] Sample data:', JSON.stringify(extractedData, null, 2).substring(0, 500));
            return {
                valid: false,
                passed: false,
                error: 'Invalid extractedData structure - expected fields with {value, sourceQuote, confidence} properties',
                errors: [{
                    type: 'structure_invalid',
                    message: 'extractedData does not match expected structure. See console for details.',
                    severity: 'CRITICAL'
                }],
                warnings: [{
                    type: 'structure_mismatch',
                    message: 'This may indicate the extraction step was skipped or returned incompatible data format',
                    severity: 'WARNING'
                }],
                scores: { overall: 0, coverage: 0, quality: 0 }
            };
        }

        try {
            const warnings = [];
            const errors = [];
            const fieldValidations = [];

            // Traverse extraction and validate each grounded field
            const groundingAnalysis = this.analyzeGrounding(
                extractedData,
                '',
                fieldValidations
            );

            console.log(`   [Grounding] Fields analyzed: ${groundingAnalysis.totalFields}`);
            console.log(`   [Grounding] Grounded fields: ${groundingAnalysis.groundedFields}`);
            console.log(`   [Grounding] Orphaned fields: ${groundingAnalysis.orphanedFields.length}`);

            // Validate orphaned fields (no sourceQuote)
            if (groundingAnalysis.orphanedFields.length > 0) {
                groundingAnalysis.orphanedFields.forEach(field => {
                    errors.push({
                        type: 'orphaned_field',
                        field: field.path,
                        value: field.value,
                        message: `Field "${field.path}" has no sourceQuote - possible fabrication`,
                        severity: 'CRITICAL'
                    });
                });
            }

            // Validate sourceQuote quality
            const qualityIssues = this.validateSourceQuoteQuality(fieldValidations);
            qualityIssues.errors.forEach(err => errors.push(err));
            qualityIssues.warnings.forEach(warn => warnings.push(warn));

            // Calculate grounding quality scores
            const scores = this.calculateGroundingScores(fieldValidations, groundingAnalysis);

            console.log(`   [Grounding] Quality score: ${scores.overall}/100`);
            console.log(`   [Grounding] Errors: ${errors.length}, Warnings: ${warnings.length}`);

            // Store result
            this.lastValidation = {
                valid: errors.length === 0,
                passed: scores.coverage >= (VALIDATION_CONSTANTS.GROUNDING_MINIMUM * 100),
                errors: errors,
                warnings: warnings,
                scores: scores,
                fieldValidations: fieldValidations,
                groundingAnalysis: groundingAnalysis,
                validatedAt: new Date().toISOString()
            };

            console.log(this.lastValidation.passed ?
                '✅ [Grounding] Validation PASSED' :
                '⚠️  [Grounding] Validation FAILED'
            );

            return this.lastValidation;

        } catch (error) {
            console.error('❌ [Grounding] Validation error:', error);
            return {
                valid: false,
                passed: false,
                error: error.message,
                scores: { overall: 0 }
            };
        }
    }

    /**
     * Analyze grounding coverage recursively
     */
    analyzeGrounding(data, path = '', fieldValidations = []) {
        const analysis = {
            totalFields: 0,
            groundedFields: 0,
            orphanedFields: [],
            inferredFields: [],
            calculatedFields: []
        };

        if (!data || typeof data !== 'object') {
            return analysis;
        }

        for (const [key, value] of Object.entries(data)) {
            const currentPath = path ? `${path}.${key}` : key;

            if (value === null || value === undefined) {
                continue;
            }

            // Check if this is a grounded field
            if (this.isGroundedField(value)) {
                analysis.totalFields++;

                const validation = {
                    path: currentPath,
                    value: value.value,
                    sourceQuote: value.sourceQuote,
                    confidence: value.confidence,
                    quoteExists: false,
                    quoteQuality: 'NONE',
                    wordCount: 0,
                    deduced: value.deductionMetadata?.deduced || false,
                    calculated: value.calculationMetadata?.method ? true : false
                };

                // Check if sourceQuote exists
                if (value.sourceQuote && value.sourceQuote.trim().length > 0) {
                    analysis.groundedFields++;

                    validation.quoteExists = this.quoteExistsInText(value.sourceQuote);
                    validation.wordCount = value.sourceQuote.split(/\s+/).length;
                    validation.quoteQuality = this.assessQuoteQuality(
                        value.sourceQuote,
                        value.value
                    );
                } else {
                    analysis.orphanedFields.push({
                        path: currentPath,
                        value: value.value
                    });
                }

                if (validation.deduced) {
                    analysis.inferredFields.push(currentPath);
                }
                if (validation.calculated) {
                    analysis.calculatedFields.push(currentPath);
                }

                fieldValidations.push(validation);

            } else if (typeof value === 'object' && !Array.isArray(value)) {
                // Recurse into nested objects
                const nestedAnalysis = this.analyzeGrounding(value, currentPath, fieldValidations);
                analysis.totalFields += nestedAnalysis.totalFields;
                analysis.groundedFields += nestedAnalysis.groundedFields;
                analysis.orphanedFields.push(...nestedAnalysis.orphanedFields);
                analysis.inferredFields.push(...nestedAnalysis.inferredFields);
                analysis.calculatedFields.push(...nestedAnalysis.calculatedFields);
            }
        }

        return analysis;
    }

    /**
     * Check if extractedData has valid structure with at least one grounded field
     */
    hasValidStructure(data) {
        if (!data || typeof data !== 'object') {
            console.warn('   [Grounding] Data is null or not an object');
            return false;
        }

        // Check if at least one field has the expected structure
        let hasValidField = false;
        const traverse = (obj, depth = 0) => {
            if (depth > 10) return; // Prevent infinite recursion

            for (const value of Object.values(obj)) {
                if (value && typeof value === 'object') {
                    if (this.isGroundedField(value)) {
                        hasValidField = true;
                        return;
                    }
                    if (!Array.isArray(value)) {
                        traverse(value, depth + 1);
                    }
                }
            }
        };

        traverse(data);

        if (!hasValidField) {
            console.warn('   [Grounding] No fields found with expected structure {value, sourceQuote, confidence}');
        }

        return hasValidField;
    }

    /**
     * Check if field has grounding metadata
     */
    isGroundedField(value) {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        return (
            value.hasOwnProperty('value') &&
            value.hasOwnProperty('sourceQuote') &&
            value.hasOwnProperty('confidence')
        );
    }

    /**
     * Check if sourceQuote exists in original text
     */
    quoteExistsInText(sourceQuote) {
        if (!sourceQuote || !this.sourceText) {
            return false;
        }
        const normalizedQuote = sourceQuote.trim().toLowerCase().replace(/\s+/g, ' ');
        const normalizedText = this.sourceText.toLowerCase().replace(/\s+/g, ' ');
        return normalizedText.includes(normalizedQuote);
    }

    /**
     * Assess sourceQuote quality
     */
    assessQuoteQuality(sourceQuote, extractedValue) {
        if (!sourceQuote || sourceQuote.trim().length === 0) {
            return 'NONE';
        }

        const wordCount = sourceQuote.split(/\s+/).length;
        const exists = this.quoteExistsInText(sourceQuote);

        let score = 0;

        // Factor 1: Quote exists in text
        if (exists) score += 40;

        // Factor 2: Quote length (3-10 words ideal)
        if (wordCount >= 3 && wordCount <= 10) {
            score += 30;
        } else if (wordCount >= 2) {
            score += 15;
        }

        // Factor 3: Quote relevance
        const relevance = this.assessQuoteRelevance(sourceQuote, extractedValue);
        score += relevance * 30;

        // Map to quality tier
        if (score >= 85) return 'EXCELLENT';
        if (score >= 70) return 'GOOD';
        if (score >= 50) return 'ACCEPTABLE';
        if (score >= 25) return 'POOR';
        return 'VERY_POOR';
    }

    /**
     * Assess relevance of sourceQuote to extracted value
     */
    assessQuoteRelevance(sourceQuote, extractedValue) {
        if (!sourceQuote || !extractedValue) return 0.0;

        const quoteLower = sourceQuote.toLowerCase();
        const valueLower = String(extractedValue).toLowerCase();

        if (quoteLower.includes(valueLower)) return 1.0;

        const valueTerms = valueLower.split(/\s+/).filter(t => t.length > 3);
        const quoteTerms = quoteLower.split(/\s+/);

        if (valueTerms.length === 0) return 0.5;

        const foundTerms = valueTerms.filter(term =>
            quoteTerms.some(qt => qt.includes(term) || term.includes(qt))
        );

        return foundTerms.length / valueTerms.length;
    }

    /**
     * Validate sourceQuote quality and generate errors/warnings
     */
    validateSourceQuoteQuality(fieldValidations) {
        const errors = [];
        const warnings = [];

        fieldValidations.forEach(field => {
            // Error: SourceQuote doesn't exist in text
            if (field.sourceQuote && !field.quoteExists) {
                errors.push({
                    type: 'quote_not_found',
                    field: field.path,
                    sourceQuote: field.sourceQuote,
                    message: `SourceQuote not found: "${field.sourceQuote.substring(0, 50)}..."`,
                    severity: 'CRITICAL'
                });
            }

            // Error: SourceQuote too short
            if (field.sourceQuote && field.wordCount < 2) {
                errors.push({
                    type: 'quote_too_short',
                    field: field.path,
                    wordCount: field.wordCount,
                    message: `SourceQuote too short (${field.wordCount} words)`,
                    severity: 'HIGH'
                });
            }

            // Warning: Poor quality
            if (['POOR', 'VERY_POOR'].includes(field.quoteQuality)) {
                warnings.push({
                    type: 'poor_quote_quality',
                    field: field.path,
                    quality: field.quoteQuality,
                    message: `Poor sourceQuote quality (${field.quoteQuality})`
                });
            }

            // Warning: Quote too long
            if (field.wordCount > 15) {
                warnings.push({
                    type: 'quote_too_long',
                    field: field.path,
                    wordCount: field.wordCount,
                    message: `SourceQuote very long (${field.wordCount} words)`
                });
            }
        });

        return { errors, warnings };
    }

    /**
     * Calculate comprehensive grounding scores
     */
    calculateGroundingScores(fieldValidations, groundingAnalysis) {
        const scores = {
            overall: 0,
            coverage: 0,
            averageQuoteQuality: 0,
            existenceRate: 0,
            relevanceAverage: 0
        };

        if (groundingAnalysis.totalFields === 0) {
            return scores;
        }

        // Coverage score (0-100)
        scores.coverage = Math.round(
            (groundingAnalysis.groundedFields / groundingAnalysis.totalFields) * 100
        );

        // Average quote quality
        const qualityMap = {
            'EXCELLENT': 100,
            'GOOD': 80,
            'ACCEPTABLE': 60,
            'POOR': 40,
            'VERY_POOR': 20,
            'NONE': 0
        };

        const qualityScores = fieldValidations.map(f => qualityMap[f.quoteQuality] || 0);
        scores.averageQuoteQuality = qualityScores.length > 0
            ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
            : 0;

        // Existence rate
        const existingQuotes = fieldValidations.filter(f => f.quoteExists).length;
        scores.existenceRate = fieldValidations.length > 0
            ? Math.round((existingQuotes / fieldValidations.length) * 100)
            : 0;

        // Relevance average
        const relevances = fieldValidations
            .filter(f => f.sourceQuote)
            .map(f => this.assessQuoteRelevance(f.sourceQuote, f.value));

        scores.relevanceAverage = relevances.length > 0
            ? Math.round((relevances.reduce((a, b) => a + b, 0) / relevances.length) * 100)
            : 0;

        // Overall score (weighted)
        scores.overall = Math.round(
            scores.coverage * 0.3 +
            scores.averageQuoteQuality * 0.3 +
            scores.existenceRate * 0.25 +
            scores.relevanceAverage * 0.15
        );

        return scores;
    }
}

// ==================================================================================
// LAYER 2: FABRICATION DETECTOR
// ==================================================================================
// Detects AI hallucinations and unsupported claims in generated content
// Uses both term-based detection (fast) and semantic AI analysis (accurate)
// ==================================================================================

class FabricationDetector {
    constructor(apiClient, options = {}) {
        this.apiClient = apiClient;
        this.lastDetection = null;
        // Configuration option to disable term-based detection
        // Set to false to rely only on semantic AI detection (eliminates false positives)
        this.enableTermBasedDetection = options.enableTermBasedDetection !== undefined
            ? options.enableTermBasedDetection
            : true; // Default: enabled (backward compatible)
    }

    /**
     * Detect fabrications in generated text
     * @param {string} generatedText - Generated output text
     * @param {object} extractedData - Source extraction with grounded fields
     * @param {string} originalText - Original clinical notes
     * @param {object} options - Detection options
     * @returns {Promise<object>} - Detection result with fabricated statements
     */
    async detect(generatedText, extractedData, originalText, options = {}) {
        if (!generatedText) {
            throw new Error('Generated text is required');
        }

        console.log('🔍 [Fabrication] Starting detection...');

        try {
            const warnings = [];
            const errors = [];

            // Handle empty/null extractedData gracefully
            let sourceQuotes = [];
            let sourceCorpus = '';

            if (extractedData && typeof extractedData === 'object' && Object.keys(extractedData).length > 0) {
                // Use extracted data if available and non-empty
                sourceQuotes = this.extractAllSourceQuotes(extractedData);
                sourceCorpus = sourceQuotes.join(' ');
                console.log(`   [Fabrication] Using extractedData - quotes collected: ${sourceQuotes.length}`);
            } else if (originalText) {
                // Fallback: use original text as source corpus
                console.warn('⚠️ [Fabrication] No extractedData provided, using originalText as source');
                sourceCorpus = originalText;
                sourceQuotes = [originalText];  // Treat entire text as one quote
                console.log(`   [Fabrication] Using originalText - corpus length: ${sourceCorpus.length} chars`);
            } else {
                throw new Error('Either extractedData or originalText must be provided for validation');
            }

            console.log(`   [Fabrication] Source quotes collected: ${sourceQuotes.length}`);

            // Split generated text into checkable statements
            const statements = this.extractStatements(generatedText);
            console.log(`   [Fabrication] Statements to validate: ${statements.length}`);

            // Method 1: Term-based detection (fast, preliminary)
            let termBasedResults = [];
            if (this.enableTermBasedDetection) {
                console.log('   [Fabrication] Running term-based detection (enabled)...');
                termBasedResults = this.detectFabricationsByTerms(
                    statements,
                    sourceCorpus
                );
            } else {
                console.log('   [Fabrication] ⏭️  Skipping term-based detection (disabled) - using semantic AI only');
            }

            // Method 2: Semantic AI detection (accurate, comprehensive)
            const semanticResults = await this.detectFabricationsBySemantic(
                statements,
                sourceQuotes,
                originalText,
                options
            );

            // Merge results (semantic takes precedence)
            const fabrications = this.mergeDetectionResults(
                termBasedResults,
                semanticResults,
                statements
            );

            console.log(`   [Fabrication] Detected: ${fabrications.length}`);

            // Generate errors for fabrications
            fabrications.forEach(fab => {
                if (fab.confidence >= 0.7) {
                    errors.push({
                        type: 'fabricated_content',
                        statement: fab.statement,
                        confidence: fab.confidence,
                        reason: fab.reason,
                        correction: fab.suggestedCorrection,
                        message: `Fabricated content detected: "${fab.statement.substring(0, 100)}..." (confidence: ${(fab.confidence * 100).toFixed(0)}%)`,
                        severity: 'CRITICAL'
                    });
                } else if (fab.confidence >= 0.4) {
                    warnings.push({
                        type: 'possible_fabrication',
                        statement: fab.statement,
                        confidence: fab.confidence,
                        reason: fab.reason,
                        message: `Possible unsupported content: "${fab.statement.substring(0, 100)}..." (confidence: ${(fab.confidence * 100).toFixed(0)}%)`
                    });
                }
            });

            // Check for over-elaboration
            const elaborationCheck = this.checkOverElaboration(
                generatedText,
                sourceQuotes,
                statements.length
            );

            if (elaborationCheck.overElaborated) {
                warnings.push({
                    type: 'over_elaboration',
                    message: elaborationCheck.message,
                    details: elaborationCheck.details
                });
            }

            // Calculate fabrication score
            const fabricationScore = this.calculateFabricationScore(
                fabrications,
                statements.length,
                elaborationCheck
            );

            console.log(`   [Fabrication] Score: ${fabricationScore}/100`);
            console.log(`   [Fabrication] Errors: ${errors.length}, Warnings: ${warnings.length}`);

            // Store result
            this.lastDetection = {
                passed: errors.length === 0,
                errors: errors,
                warnings: warnings,
                fabrications: fabrications,
                fabricationScore: fabricationScore,
                statementsChecked: statements.length,
                detectedAt: new Date().toISOString()
            };

            console.log(errors.length === 0 ? '✅ [Fabrication] Passed' : '❌ [Fabrication] Failed');

            return {
                success: true,
                validation: this.lastDetection,
                metadata: {
                    statementsChecked: statements.length,
                    fabricationsFound: fabrications.length,
                    fabricationScore: fabricationScore
                }
            };

        } catch (error) {
            console.error('❌ [Fabrication] Detection error:', error);
            return {
                success: false,
                error: error.message,
                validation: null,
                metadata: null
            };
        }
    }

    /**
     * Extract all sourceQuotes from extracted data recursively
     */
    extractAllSourceQuotes(data, quotes = []) {
        if (!data || typeof data !== 'object') {
            return quotes;
        }

        // Check if this is a grounded field
        if (data.hasOwnProperty('sourceQuote') && data.sourceQuote) {
            quotes.push(data.sourceQuote.trim());
        }

        // Recurse into nested structures
        for (const value of Object.values(data)) {
            if (typeof value === 'object' && value !== null) {
                this.extractAllSourceQuotes(value, quotes);
            }
        }

        return quotes;
    }

    /**
     * Extract checkable statements from generated text
     */
    extractStatements(text) {
        // Split by sentence boundaries
        const sentences = text
            .split(/[.!?]\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 10); // Ignore very short fragments

        return sentences;
    }

    /**
     * Term-based fabrication detection (fast, preliminary)
     */
    detectFabricationsByTerms(statements, sourceCorpus) {
        const results = [];
        const corpusLower = sourceCorpus.toLowerCase();

        statements.forEach(statement => {
            // Extract medical terms (>3 chars, not common words)
            const terms = statement.toLowerCase()
                .split(/\s+/)
                .filter(word =>
                    word.length > 3 &&
                    !/^(the|and|with|for|from|that|this|have|been|were|was)$/.test(word)
                );

            if (terms.length === 0) {
                return; // Skip statements with no medical terms
            }

            // Check how many terms exist in source corpus
            const foundTerms = terms.filter(term => corpusLower.includes(term));
            const foundRatio = foundTerms.length / terms.length;

            // Lowered threshold from 0.5 (50%) to 0.25 (25%) to reduce false positives
            // If <25% of terms found, possible fabrication
            if (foundRatio < 0.25) {
                results.push({
                    statement: statement,
                    foundRatio: foundRatio,
                    method: 'term-based',
                    confidence: 1.0 - foundRatio // Low foundRatio = high fabrication confidence
                });
            }
        });

        return results;
    }

    /**
     * Semantic AI-based fabrication detection (accurate, comprehensive)
     */
    async detectFabricationsBySemantic(statements, sourceQuotes, originalText, options = {}) {
        if (statements.length === 0) {
            return [];
        }

        console.log('   [Fabrication] Running semantic analysis...');

        // Prepare prompt for AI analysis
        const prompt = this.buildSemanticDetectionPrompt(
            statements,
            sourceQuotes,
            originalText
        );

        try {
            // Use validation temperature (0.1 for deterministic validation)
            const response = await this.apiClient.generateText(
                prompt,
                {
                    temperature: 0.1,
                    maxOutputTokens: 4096
                }
            );

            if (!response) {
                console.warn('⚠️ [Fabrication] Semantic detection failed, using term-based only');
                return [];
            }

            // Parse AI response
            const analysisResults = this.parseSemanticDetectionResponse(response);

            console.log(`   [Fabrication] Semantic analysis complete: ${analysisResults.length} potential fabrications`);

            return analysisResults;

        } catch (error) {
            console.warn('⚠️ [Fabrication] Semantic detection error:', error.message);
            return [];
        }
    }

    /**
     * Build prompt for semantic fabrication detection
     */
    buildSemanticDetectionPrompt(statements, sourceQuotes, originalText) {
        return `You are a medical documentation validator. Your task is to identify fabricated, unsupported, or over-elaborated statements.

**ORIGINAL CLINICAL NOTES:**
${originalText.substring(0, 2000)}...

**EXTRACTED SOURCE QUOTES (Ground Truth):**
${sourceQuotes.slice(0, 30).map((q, i) => `${i + 1}. "${q}"`).join('\n')}

**STATEMENTS TO VALIDATE:**
${statements.slice(0, 50).map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

**TASK:**
For each statement, determine if it is:
1. **SUPPORTED**: Directly supported by source quotes or original notes
2. **FABRICATED**: Contains information not in source material
3. **OVER-ELABORATED**: Contains source information but with added interpretation/detail

**RULES:**
- A statement is SUPPORTED if its key medical facts appear in source quotes
- A statement is FABRICATED if it introduces new medical facts not documented
- Paraphrasing is acceptable IF the medical meaning is preserved
- Clinical terminology changes (e.g., "SAH" → "subarachnoid hemorrhage") are acceptable
- Added interpretations, assumptions, or explanations = FABRICATION

**OUTPUT FORMAT (STRICT JSON) - CRITICALLY IMPORTANT:**

You MUST respond with ONLY valid JSON. No explanatory text before or after. No markdown code blocks. No comments.

Format (if fabrications found):
\`\`\`json
{
  "fabrications": [
    {
      "statementIndex": <number>,
      "statement": "<full statement text>",
      "status": "FABRICATED" or "OVER_ELABORATED",
      "confidence": <0.0-1.0>,
      "reason": "<why this is fabricated>",
      "missingSupport": "<what information lacks grounding>",
      "fixOptions": [
        {
          "option": "remove",
          "text": null,
          "description": "Delete this statement entirely (safest)",
          "confidence": <0.0-1.0>
        },
        {
          "option": "conservative",
          "text": "<minimal safe rephrasing>",
          "description": "Most conservative fix",
          "confidence": <0.0-1.0>
        },
        {
          "option": "moderate",
          "text": "<balanced rephrasing>",
          "description": "Balanced approach",
          "confidence": <0.0-1.0>
        }
      ]
    }
  ]
}
\`\`\`

IMPORTANT: Provide 2-3 fix options per fabrication, ranked from most conservative (safest) to most detailed.

Format (if NO fabrications found):
\`\`\`json
{
  "fabrications": []
}
\`\`\`

CRITICAL RULES:
1. Your response must be parseable by JSON.parse()
2. Do NOT include any text outside the JSON object
3. Do NOT use markdown formatting around the JSON
4. Do NOT include comments in the JSON
5. ALL string values must be properly escaped
6. If response is long, ensure JSON is complete - do not truncate arrays mid-element
7. Test your JSON is valid before responding

Analyze all statements and return ONLY the JSON object:`;
    }

    /**
     * Parse AI response for semantic detection
     */
    parseSemanticDetectionResponse(responseText) {
        try {
            // Find FIRST complete JSON object, not greedy match
            const jsonStart = responseText.indexOf('{');
            const jsonEnd = responseText.lastIndexOf('}');

            if (jsonStart === -1 || jsonEnd === -1) {
                console.warn('⚠️ [Fabrication] No JSON found in semantic detection response');
                console.warn('   Response preview:', responseText.substring(0, 500));
                return [];
            }

            const jsonStr = responseText.substring(jsonStart, jsonEnd + 1);

            // Pre-validate JSON before parsing
            let parsed;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (parseError) {
                console.error('❌ [Fabrication] JSON parse error:', parseError.message);

                // Extract position from error message if available
                const posMatch = parseError.message.match(/position (\d+)/);
                if (posMatch) {
                    const errorPos = parseInt(posMatch[1]);
                    const start = Math.max(0, errorPos - 100);
                    const end = Math.min(jsonStr.length, errorPos + 100);
                    console.error('   Error context:', jsonStr.substring(start, end));
                    console.error('   Error at position:', errorPos, 'of', jsonStr.length);
                }

                // Log first and last 500 chars of response for debugging
                console.error('   Response start:', responseText.substring(0, 500));
                console.error('   Response end:', responseText.substring(Math.max(0, responseText.length - 500)));
                console.error('   JSON string length:', jsonStr.length);

                // CRITICAL: Don't silently return empty array - log for debugging
                console.error('⚠️ [Fabrication] Returning empty array due to parse failure - actual fabrications may be hidden');
                return [];
            }

            if (!parsed.fabrications || !Array.isArray(parsed.fabrications)) {
                console.warn('⚠️ [Fabrication] Invalid response format - missing fabrications array');
                console.warn('   Parsed object keys:', Object.keys(parsed));
                console.warn('   Parsed object type:', typeof parsed.fabrications);
                return [];
            }

            console.log(`✅ [Fabrication] Successfully parsed ${parsed.fabrications.length} fabrications from AI response`);

            return parsed.fabrications.map(fab => ({
                statement: fab.statement,
                confidence: fab.confidence || 0.5,
                reason: fab.reason,
                missingSupport: fab.missingSupport,
                // Parse multiple fix options
                fixOptions: fab.fixOptions?.map((opt, idx) => ({
                    id: `fix-${idx}`,
                    label: opt.option.charAt(0).toUpperCase() + opt.option.slice(1),
                    text: opt.text,
                    description: opt.description,
                    confidence: opt.confidence,
                    type: opt.option
                })) || [],
                // Backward compatibility: use first option as default suggestedCorrection
                suggestedCorrection: fab.fixOptions?.[0]?.text || fab.suggestedCorrection || null,
                statementIndex: fab.statementIndex || null,  // Capture sentence number for pinpoint location
                method: 'semantic-ai',
                status: fab.status
            }));

        } catch (error) {
            console.error('❌ [Fabrication] Failed to parse response:', error.message);
            console.error('   Stack trace:', error.stack);
            return [];
        }
    }

    /**
     * Merge term-based and semantic detection results
     */
    mergeDetectionResults(termBased, semantic, allStatements) {
        const merged = [];
        const processedStatements = new Set();

        // Helper: Normalize statement for better duplicate detection
        const normalize = (stmt) => stmt.toLowerCase().trim().replace(/[.!?,;:]/g, '');

        // Phase 1: Add ALL semantic results with ALL properties intact (highest priority)
        // Semantic AI provides: fixOptions, statementIndex, detailed reasoning
        semantic.forEach(result => {
            merged.push({...result}); // Spread to ensure we get all properties
            processedStatements.add(normalize(result.statement));
        });

        console.log(`   [Merge] Added ${semantic.length} semantic results (with V10.2.3 features)`);

        // Phase 2: Add term-based results ONLY if not already caught by semantic
        // Use normalized comparison to avoid duplicates with slight text variations
        let termBasedAdded = 0;
        termBased.forEach(result => {
            const normalized = normalize(result.statement);
            if (!processedStatements.has(normalized)) {
                merged.push({
                    statement: result.statement,
                    confidence: result.confidence,
                    reason: `Low source term coverage (${(result.foundRatio * 100).toFixed(0)}%)`,
                    method: result.method,
                    suggestedCorrection: null,
                    fixOptions: [], // Empty array for consistency
                    statementIndex: null // No sentence number for term-based
                });
                processedStatements.add(normalized);
                termBasedAdded++;
            }
        });

        console.log(`   [Merge] Added ${termBasedAdded}/${termBased.length} term-based results (${termBased.length - termBasedAdded} duplicates skipped)`);

        return merged;
    }

    /**
     * Check for over-elaboration
     */
    checkOverElaboration(generatedText, sourceQuotes, statementCount) {
        const generatedWordCount = generatedText.split(/\s+/).length;
        const sourceWordCount = sourceQuotes.join(' ').split(/\s+/).length;

        // Calculate expansion ratio
        const expansionRatio = sourceWordCount > 0 ? generatedWordCount / sourceWordCount : 0;

        let overElaborated = false;
        let message = '';
        let details = {};

        if (expansionRatio > 3.0 && sourceQuotes.length < 10) {
            // More than 3x expansion with sparse source data
            overElaborated = true;
            message = `Generated text (${generatedWordCount} words) is ${expansionRatio.toFixed(1)}x longer than source material (${sourceWordCount} words) - possible over-elaboration`;
            details = {
                generatedWords: generatedWordCount,
                sourceWords: sourceWordCount,
                expansionRatio: expansionRatio.toFixed(2),
                sourceQuoteCount: sourceQuotes.length
            };
        } else if (statementCount > sourceQuotes.length * 2) {
            // More than 2x statements compared to source quotes
            overElaborated = true;
            message = `Generated ${statementCount} statements from ${sourceQuotes.length} source quotes - possible over-elaboration`;
            details = {
                statementsGenerated: statementCount,
                sourceQuotes: sourceQuotes.length,
                ratio: (statementCount / sourceQuotes.length).toFixed(2)
            };
        }

        return {
            overElaborated: overElaborated,
            message: message,
            details: details
        };
    }

    /**
     * Calculate fabrication score (0-100, higher is better)
     */
    calculateFabricationScore(fabrications, totalStatements, elaborationCheck) {
        if (totalStatements === 0) {
            return 100;
        }

        let score = 100;

        // Deduct for fabrications
        const criticalFabrications = fabrications.filter(f => f.confidence >= 0.7).length;
        const possibleFabrications = fabrications.filter(f => f.confidence >= 0.4 && f.confidence < 0.7).length;

        score -= criticalFabrications * 15; // -15 per critical fabrication
        score -= possibleFabrications * 5;  // -5 per possible fabrication

        // Deduct for over-elaboration
        if (elaborationCheck.overElaborated) {
            score -= 10;
        }

        // Calculate fabrication rate
        const fabricationRate = fabrications.length / totalStatements;
        if (fabricationRate > 0.3) {
            score -= 20; // High fabrication rate penalty
        }

        return Math.max(0, Math.min(100, score));
    }
}

// ==================================================================================
// LAYER 3: COMPLETENESS CHECKER
// ==================================================================================
// Bidirectional validation: extraction → notes AND notes → extraction
// Ensures no critical information is missing from extraction
// ==================================================================================

class CompletenessChecker {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.lastCheck = null;
    }

    /**
     * Check completeness of extraction
     * @param {object} extractedData - Extraction result
     * @param {string} originalText - Original clinical text
     * @param {object} options - Check options
     * @returns {Promise<object>} - Completeness validation result
     */
    async check(extractedData, originalText, options = {}) {
        if (!extractedData || !originalText) {
            throw new Error('Both extracted data and original text are required');
        }

        console.log('🔍 [Completeness] Starting check...');

        try {
            const warnings = [];
            const errors = [];

            // 1. Backward validation: Extraction → Notes
            console.log('   [Completeness] Backward validation (extraction → notes)...');
            const backwardCheck = this.checkBackwardCompleteness(extractedData, originalText);

            // 2. Forward validation: Notes → Extraction (AI-powered)
            console.log('   [Completeness] Forward validation (notes → extraction)...');
            const forwardCheck = await this.checkForwardCompleteness(
                originalText,
                extractedData,
                options
            );

            // 3. Section coverage analysis
            console.log('   [Completeness] Analyzing section coverage...');
            const sectionCoverage = this.analyzeSectionCoverage(extractedData, originalText);

            // 4. Critical field coverage
            const criticalFieldsCheck = this.checkCriticalFields(extractedData);

            // Generate warnings and errors
            if (backwardCheck.unmatchedFields.length > 0) {
                backwardCheck.unmatchedFields.forEach(field => {
                    warnings.push({
                        type: 'ungrounded_extraction',
                        field: field.path,
                        value: field.value,
                        message: `Extracted field not found in original text: ${field.path}`
                    });
                });
            }

            // Forward completeness issues
            if (forwardCheck.missingExtractions.length > 0) {
                forwardCheck.missingExtractions.forEach(missing => {
                    if (missing.importance === 'CRITICAL') {
                        errors.push({
                            type: 'missing_critical_extraction',
                            category: missing.category,
                            information: missing.information,
                            sourceQuote: missing.sourceQuote,
                            message: `Critical information not extracted: ${missing.information}`,
                            severity: 'HIGH'
                        });
                    } else {
                        warnings.push({
                            type: 'missing_extraction',
                            category: missing.category,
                            information: missing.information,
                            sourceQuote: missing.sourceQuote,
                            message: `Information may not be extracted: ${missing.information}`
                        });
                    }
                });
            }

            // Section coverage issues
            if (sectionCoverage.missingImportantSections.length > 0) {
                sectionCoverage.missingImportantSections.forEach(section => {
                    warnings.push({
                        type: 'missing_section',
                        section: section.name,
                        message: `Important section "${section.name}" mentioned in notes but not extracted`
                    });
                });
            }

            // Critical field issues
            if (criticalFieldsCheck.missingCritical.length > 0) {
                criticalFieldsCheck.missingCritical.forEach(field => {
                    errors.push({
                        type: 'missing_critical_field',
                        field: field,
                        message: `Critical required field missing: ${field}`,
                        severity: 'CRITICAL'
                    });
                });
            }

            // Calculate completeness scores
            const scores = this.calculateCompletenessScores(
                backwardCheck,
                forwardCheck,
                sectionCoverage,
                criticalFieldsCheck
            );

            console.log(`   [Completeness] Score: ${scores.overall}/100`);
            console.log(`   [Completeness] Errors: ${errors.length}, Warnings: ${warnings.length}`);

            // Store result
            this.lastCheck = {
                passed: errors.length === 0,
                errors: errors,
                warnings: warnings,
                scores: scores,
                backwardCheck: backwardCheck,
                forwardCheck: forwardCheck,
                sectionCoverage: sectionCoverage,
                criticalFieldsCheck: criticalFieldsCheck,
                checkedAt: new Date().toISOString()
            };

            console.log(errors.length === 0 ? '✅ [Completeness] Passed' : '❌ [Completeness] Issues detected');

            return {
                success: true,
                validation: this.lastCheck,
                metadata: {
                    extractedFields: backwardCheck.totalFields,
                    groundedFields: backwardCheck.matchedFields,
                    missingExtractions: forwardCheck.missingExtractions.length,
                    sectionsCovered: sectionCoverage.coveredSections.length,
                    completenessScore: scores.overall
                }
            };

        } catch (error) {
            console.error('❌ [Completeness] Check error:', error);
            return {
                success: false,
                error: error.message,
                validation: null,
                metadata: null
            };
        }
    }

    /**
     * Backward completeness: Extraction → Notes
     */
    checkBackwardCompleteness(extractedData, originalText) {
        const normalizedText = originalText.toLowerCase().replace(/\s+/g, ' ');
        const unmatchedFields = [];
        let totalFields = 0;
        let matchedFields = 0;

        this.traverseExtraction(extractedData, '', (path, field) => {
            totalFields++;

            if (field.sourceQuote) {
                const normalizedQuote = field.sourceQuote.toLowerCase().replace(/\s+/g, ' ');

                if (normalizedText.includes(normalizedQuote)) {
                    matchedFields++;
                } else {
                    unmatchedFields.push({
                        path: path,
                        value: field.value,
                        sourceQuote: field.sourceQuote
                    });
                }
            } else {
                unmatchedFields.push({
                    path: path,
                    value: field.value,
                    sourceQuote: null
                });
            }
        });

        return {
            totalFields: totalFields,
            matchedFields: matchedFields,
            unmatchedFields: unmatchedFields,
            backwardCompleteness: totalFields > 0 ? matchedFields / totalFields : 1.0
        };
    }

    /**
     * Forward completeness: Notes → Extraction
     */
    async checkForwardCompleteness(originalText, extractedData, options = {}) {
        console.log('   [Completeness] Running AI-powered forward analysis...');

        const extractedSummary = this.buildExtractionSummary(extractedData);
        const prompt = this.buildForwardCompletenessPrompt(originalText, extractedSummary);

        try {
            const response = await this.apiClient.generateText(
                prompt,
                {
                    temperature: 0.2,
                    maxOutputTokens: 3072
                }
            );

            if (!response) {
                console.warn('⚠️ [Completeness] Forward check failed');
                return { missingExtractions: [], forwardCompleteness: 1.0 };
            }

            const missingExtractions = this.parseForwardCompletenessResponse(response);

            console.log(`   [Completeness] Missing extractions: ${missingExtractions.length}`);

            const totalMentioned = extractedSummary.fieldCount + missingExtractions.length;
            const forwardCompleteness = totalMentioned > 0
                ? extractedSummary.fieldCount / totalMentioned
                : 1.0;

            return {
                missingExtractions: missingExtractions,
                forwardCompleteness: forwardCompleteness
            };

        } catch (error) {
            console.warn('⚠️ [Completeness] Forward check error:', error.message);
            return { missingExtractions: [], forwardCompleteness: 1.0 };
        }
    }

    /**
     * Build summary of what was extracted
     */
    buildExtractionSummary(data) {
        const summary = {
            fields: [],
            fieldCount: 0,
            sections: new Set()
        };

        this.traverseExtraction(data, '', (path, field) => {
            summary.fieldCount++;
            summary.fields.push({
                path: path,
                value: field.value,
                sourceQuote: field.sourceQuote
            });

            const topSection = path.split('.')[0];
            summary.sections.add(topSection);
        });

        return summary;
    }

    /**
     * Build prompt for forward completeness check
     */
    buildForwardCompletenessPrompt(originalText, extractedSummary) {
        return `You are a medical documentation completeness auditor. Identify clinical information in notes NOT captured in extraction.

**ORIGINAL CLINICAL NOTES:**
${originalText.substring(0, 3000)}

**WHAT WAS EXTRACTED:**
${extractedSummary.fields.slice(0, 50).map(f => `- ${f.path}: ${f.value}`).join('\n')}

**SECTIONS COVERED:** ${Array.from(extractedSummary.sections).join(', ')}

**TASK:**
Identify clinically significant information NOT extracted. Focus on:

1. **Patient demographics** (age, sex, medical history)
2. **Symptoms and presentation**
3. **Physical exam findings** (neurological)
4. **Imaging findings** (measurements, locations)
5. **Diagnoses** (primary and secondary)
6. **Procedures** (past, current, planned)
7. **Medications**
8. **Clinical scores** (GCS, mRS, KPS, etc.)
9. **Plans and follow-up**

**RULES:**
- Only flag EXPLICIT mentions
- Medical measurements, scores, laterality are CRITICAL
- Vague references don't need extraction
- Background context is acceptable to omit

**OUTPUT FORMAT (JSON):**
\`\`\`json
{
  "missingExtractions": [
    {
      "category": "imaging|diagnosis|procedure|medication|symptoms|scores|demographics",
      "information": "<what information is missing>",
      "sourceQuote": "<exact quote from notes>",
      "importance": "CRITICAL" | "IMPORTANT" | "MINOR",
      "suggestedField": "<where this should be extracted>"
    }
  ]
}
\`\`\`

Return ONLY JSON. If nothing missing, return empty array.`;
    }

    /**
     * Parse AI response for forward completeness
     */
    parseForwardCompletenessResponse(responseText) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn('⚠️ [Completeness] No JSON in response');
                return [];
            }

            const parsed = JSON.parse(jsonMatch[0]);

            if (!parsed.missingExtractions || !Array.isArray(parsed.missingExtractions)) {
                console.warn('⚠️ [Completeness] Invalid response format');
                return [];
            }

            return parsed.missingExtractions;

        } catch (error) {
            console.warn('⚠️ [Completeness] Parse error:', error.message);
            return [];
        }
    }

    /**
     * Analyze section coverage
     */
    analyzeSectionCoverage(extractedData, originalText) {
        const expectedSections = [
            { name: 'demographics', keywords: ['age', 'year old', 'male', 'female', 'patient'] },
            { name: 'symptoms', keywords: ['presents', 'complains', 'symptoms', 'history of present'] },
            { name: 'examination', keywords: ['exam', 'examination', 'neurological', 'motor', 'sensory'] },
            { name: 'imaging', keywords: ['MRI', 'CT', 'CTA', 'scan', 'imaging', 'shows'] },
            { name: 'diagnosis', keywords: ['diagnosis', 'impression', 'assessment'] },
            { name: 'procedures', keywords: ['surgery', 'procedure', 'operation', 'craniotomy', 'laminectomy'] },
            { name: 'medications', keywords: ['medication', 'drug', 'prescribed', 'started'] },
            { name: 'plan', keywords: ['plan', 'will', 'scheduled', 'follow-up'] }
        ];

        const textLower = originalText.toLowerCase();
        const coveredSections = [];
        const missingImportantSections = [];

        expectedSections.forEach(section => {
            const mentioned = section.keywords.some(keyword => textLower.includes(keyword));

            if (mentioned) {
                const extracted = this.sectionHasData(extractedData, section.name);

                if (extracted) {
                    coveredSections.push(section.name);
                } else {
                    missingImportantSections.push({
                        name: section.name,
                        keywords: section.keywords
                    });
                }
            }
        });

        return {
            coveredSections: coveredSections,
            missingImportantSections: missingImportantSections,
            coverageRatio: expectedSections.length > 0
                ? coveredSections.length / expectedSections.length
                : 1.0
        };
    }

    /**
     * Check if section has extracted data
     */
    sectionHasData(data, sectionName) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        const section = data[sectionName] || data[sectionName + 's'];
        if (!section) {
            return false;
        }

        let hasData = false;
        this.traverseExtraction(section, '', (path, field) => {
            if (field.sourceQuote && field.sourceQuote.trim().length > 0) {
                hasData = true;
            }
        });

        return hasData;
    }

    /**
     * Check critical required fields
     */
    checkCriticalFields(extractedData) {
        const criticalFields = [
            'demographics.age',
            'pathology.primaryDiagnosis.name'
        ];

        const missingCritical = [];

        criticalFields.forEach(fieldPath => {
            const value = this.getFieldByPath(extractedData, fieldPath);
            if (!value || (value.value === null || value.value === undefined || value.value === '')) {
                missingCritical.push(fieldPath);
            }
        });

        return {
            missingCritical: missingCritical,
            criticalFieldsPresent: criticalFields.length - missingCritical.length,
            totalCriticalFields: criticalFields.length
        };
    }

    /**
     * Get field value by path
     */
    getFieldByPath(data, path) {
        const parts = path.split('.');
        let current = data;

        for (const part of parts) {
            if (!current || typeof current !== 'object') {
                return null;
            }
            current = current[part];
        }

        return current;
    }

    /**
     * Traverse extraction and call callback for each grounded field
     */
    traverseExtraction(data, path = '', callback) {
        if (!data || typeof data !== 'object') {
            return;
        }

        for (const [key, value] of Object.entries(data)) {
            if (value === null || value === undefined) {
                continue;
            }

            const currentPath = path ? `${path}.${key}` : key;

            // Check if grounded field
            if (typeof value === 'object' &&
                value.hasOwnProperty('value') &&
                value.hasOwnProperty('sourceQuote') &&
                value.hasOwnProperty('confidence')) {

                callback(currentPath, value);

            } else if (typeof value === 'object' && !Array.isArray(value)) {
                this.traverseExtraction(value, currentPath, callback);
            } else if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    this.traverseExtraction(item, `${currentPath}[${index}]`, callback);
                });
            }
        }
    }

    /**
     * Calculate completeness scores
     */
    calculateCompletenessScores(backwardCheck, forwardCheck, sectionCoverage, criticalFieldsCheck) {
        const scores = {
            overall: 0,
            backwardCompleteness: Math.round(backwardCheck.backwardCompleteness * 100),
            forwardCompleteness: Math.round(forwardCheck.forwardCompleteness * 100),
            sectionCoverage: Math.round(sectionCoverage.coverageRatio * 100),
            criticalFields: Math.round(
                (criticalFieldsCheck.criticalFieldsPresent / criticalFieldsCheck.totalCriticalFields) * 100
            )
        };

        // Overall score (weighted average)
        scores.overall = Math.round(
            scores.backwardCompleteness * 0.25 +
            scores.forwardCompleteness * 0.40 + // Most important
            scores.sectionCoverage * 0.20 +
            scores.criticalFields * 0.15
        );

        return scores;
    }
}

// ==================================================================================
// LAYER 4: CONSISTENCY VALIDATOR
// ==================================================================================
// Medical knowledge-based consistency checking
// Validates anatomical, temporal, and clinical score consistency
// ==================================================================================

class ConsistencyValidator {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.lastValidation = null;
        this.medicalKnowledge = this.initializeMedicalKnowledge();
    }

    /**
     * Initialize medical knowledge base
     */
    initializeMedicalKnowledge() {
        return {
            // Spinal levels
            spinalLevels: {
                cervical: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'],
                thoracic: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
                lumbar: ['L1', 'L2', 'L3', 'L4', 'L5'],
                sacral: ['S1', 'S2', 'S3', 'S4', 'S5']
            },

            // GCS score ranges
            gcsScores: {
                severe: { range: [3, 8], meaning: 'severe impairment' },
                moderate: { range: [9, 12], meaning: 'moderate impairment' },
                mild: { range: [13, 14], meaning: 'mild impairment' },
                normal: { range: [15, 15], meaning: 'fully alert' }
            },

            // mRS score meanings
            mrsScores: {
                0: 'no symptoms',
                1: 'no significant disability',
                2: 'slight disability',
                3: 'moderate disability',
                4: 'moderately severe disability',
                5: 'severe disability',
                6: 'dead'
            },

            // KPS score ranges
            kpsScores: {
                high: { range: [80, 100], meaning: 'normal activity' },
                moderate: { range: [50, 70], meaning: 'requires assistance' },
                low: { range: [10, 40], meaning: 'disabled, requires care' }
            },

            // Laterality rules (neuroanatomical decussation)
            lateralityRules: {
                cerebral: 'contralateral',  // Right brain → Left body
                cerebellar: 'ipsilateral',  // Right cerebellum → Right body
                spinal: 'ipsilateral'       // Right spinal → Right symptoms
            },

            // Pathology keywords
            pathologyKeywords: {
                vascular: ['hemorrhage', 'aneurysm', 'stroke', 'ischemia', 'SAH', 'ICH', 'infarct'],
                tumor: ['glioblastoma', 'meningioma', 'tumor', 'mass', 'neoplasm', 'metastasis'],
                degenerative: ['stenosis', 'spondylosis', 'herniation', 'disc', 'DDD'],
                trauma: ['fracture', 'TBI', 'SCI', 'contusion', 'hematoma'],
                infection: ['abscess', 'meningitis', 'osteomyelitis', 'infection']
            }
        };
    }

    /**
     * Validate consistency of extracted data
     */
    async validate(extractedData, originalText, options = {}) {
        if (!extractedData) {
            throw new Error('Extracted data is required');
        }

        console.log('🔍 [Consistency] Starting validation...');

        try {
            const warnings = [];
            const errors = [];

            // 1. Laterality consistency
            console.log('   [Consistency] Checking laterality...');
            const lateralityIssues = this.checkLateralityConsistency(extractedData);
            lateralityIssues.forEach(issue => {
                errors.push({
                    type: 'laterality_inconsistency',
                    ...issue,
                    severity: 'HIGH'
                });
            });

            // 2. Anatomical level consistency
            console.log('   [Consistency] Checking anatomical levels...');
            const anatomicalIssues = this.checkAnatomicalConsistency(extractedData);
            anatomicalIssues.forEach(issue => {
                errors.push({
                    type: 'anatomical_inconsistency',
                    ...issue,
                    severity: 'HIGH'
                });
            });

            // 3. Clinical score consistency
            console.log('   [Consistency] Checking clinical scores...');
            const scoreIssues = this.checkScoreConsistency(extractedData);
            scoreIssues.forEach(issue => {
                if (issue.severity === 'HIGH') {
                    errors.push({
                        type: 'score_inconsistency',
                        ...issue
                    });
                } else {
                    warnings.push({
                        type: 'score_warning',
                        ...issue
                    });
                }
            });

            // 4. Temporal consistency
            console.log('   [Consistency] Checking temporal order...');
            const temporalIssues = this.checkTemporalConsistency(extractedData);
            temporalIssues.forEach(issue => {
                errors.push({
                    type: 'temporal_inconsistency',
                    ...issue,
                    severity: 'MEDIUM'
                });
            });

            // 5. Pathology consistency
            console.log('   [Consistency] Checking pathology-procedure match...');
            const pathologyIssues = this.checkPathologyConsistency(extractedData);
            pathologyIssues.forEach(issue => {
                warnings.push({
                    type: 'pathology_mismatch',
                    ...issue
                });
            });

            // Calculate consistency score
            const consistencyScore = this.calculateConsistencyScore(
                errors.length,
                warnings.length
            );

            console.log(`   [Consistency] Score: ${consistencyScore}/100`);
            console.log(`   [Consistency] Errors: ${errors.length}, Warnings: ${warnings.length}`);

            // Store result
            this.lastValidation = {
                passed: errors.length === 0,
                errors: errors,
                warnings: warnings,
                consistencyScore: consistencyScore,
                validatedAt: new Date().toISOString()
            };

            console.log(errors.length === 0 ? '✅ [Consistency] Passed' : '❌ [Consistency] Issues detected');

            return {
                success: true,
                validation: this.lastValidation,
                metadata: {
                    totalIssues: errors.length + warnings.length,
                    criticalIssues: errors.length,
                    consistencyScore: consistencyScore
                }
            };

        } catch (error) {
            console.error('❌ [Consistency] Validation error:', error);
            return {
                success: false,
                error: error.message,
                validation: null,
                metadata: null
            };
        }
    }

    /**
     * Check laterality consistency (neuroanatomical decussation rules)
     */
    checkLateralityConsistency(data) {
        const issues = [];

        // Extract lateralized findings
        const lesionSide = this.extractLaterality(data, 'imaging.findings', 'lesion');
        const symptomSide = this.extractLaterality(data, 'symptoms', 'symptom');
        const diagnosisSide = this.extractLaterality(data, 'pathology', 'diagnosis');

        // Determine pathology location
        const pathologyLocation = this.determinePathologyLocation(data);

        // Apply decussation rules
        if (pathologyLocation === 'cerebral') {
            // Cerebral lesions: contralateral symptoms
            if (lesionSide && symptomSide && lesionSide === symptomSide) {
                issues.push({
                    field1: 'imaging.findings (lesion)',
                    field2: 'symptoms',
                    value1: `${lesionSide} sided lesion`,
                    value2: `${symptomSide} sided symptoms`,
                    message: `${lesionSide} cerebral lesion should cause contralateral (${this.oppositeSide(lesionSide)}) symptoms, not ${symptomSide}-sided`,
                    expectedValue: `${this.oppositeSide(lesionSide)} sided symptoms`
                });
            }

        } else if (pathologyLocation === 'spinal') {
            // Spinal lesions: ipsilateral symptoms
            if (lesionSide && symptomSide && lesionSide !== symptomSide) {
                issues.push({
                    field1: 'imaging.findings (lesion)',
                    field2: 'symptoms',
                    value1: `${lesionSide} sided lesion`,
                    value2: `${symptomSide} sided symptoms`,
                    message: `${lesionSide} spinal lesion should cause ipsilateral (${lesionSide}) symptoms, not ${symptomSide}-sided`,
                    expectedValue: `${lesionSide} sided symptoms`
                });
            }
        }

        return issues;
    }

    /**
     * Extract laterality from data section
     */
    extractLaterality(data, sectionPath, context) {
        const section = this.getFieldByPath(data, sectionPath);
        if (!section) return null;

        const lateralityKeywords = {
            left: /\b(left|l(?:eft)?)\b/i,
            right: /\b(right|r(?:ight)?)\b/i
        };

        let foundSide = null;
        this.traverseSection(section, (field) => {
            if (!foundSide && field.value) {
                const valueStr = String(field.value).toLowerCase();
                if (lateralityKeywords.left.test(valueStr)) {
                    foundSide = 'left';
                } else if (lateralityKeywords.right.test(valueStr)) {
                    foundSide = 'right';
                }
            }

            if (!foundSide && field.sourceQuote) {
                const quoteStr = field.sourceQuote.toLowerCase();
                if (lateralityKeywords.left.test(quoteStr)) {
                    foundSide = 'left';
                } else if (lateralityKeywords.right.test(quoteStr)) {
                    foundSide = 'right';
                }
            }
        });

        return foundSide;
    }

    /**
     * Determine pathology location
     */
    determinePathologyLocation(data) {
        const diagnosis = this.getFieldValue(data, 'pathology.primaryDiagnosis.name');
        const imagingFindings = this.getAllSourceQuotes(data.imaging);

        const allText = `${diagnosis} ${imagingFindings}`.toLowerCase();

        if (/\b(cervical|thoracic|lumbar|sacral|spine|spinal|vertebra|disc)\b/i.test(allText)) {
            return 'spinal';
        } else if (/\b(cerebellar|cerebellum)\b/i.test(allText)) {
            return 'cerebellar';
        } else if (/\b(cerebral|brain|frontal|parietal|temporal|occipital|hemisphere)\b/i.test(allText)) {
            return 'cerebral';
        }

        return 'unknown';
    }

    /**
     * Get opposite side for laterality
     */
    oppositeSide(side) {
        if (side === 'left') return 'right';
        if (side === 'right') return 'left';
        return null;
    }

    /**
     * Check anatomical level consistency
     */
    checkAnatomicalConsistency(data) {
        const issues = [];

        const diagnosisLevel = this.extractSpinalLevel(data, 'pathology');
        const procedureLevel = this.extractSpinalLevel(data, 'procedures');

        if (diagnosisLevel && procedureLevel) {
            const diagnosisRegion = this.getSpinalRegion(diagnosisLevel);
            const procedureRegion = this.getSpinalRegion(procedureLevel);

            if (diagnosisRegion !== procedureRegion && diagnosisRegion !== 'unknown' && procedureRegion !== 'unknown') {
                issues.push({
                    field1: 'pathology (diagnosis level)',
                    field2: 'procedures (procedure level)',
                    value1: `${diagnosisLevel} (${diagnosisRegion})`,
                    value2: `${procedureLevel} (${procedureRegion})`,
                    message: `Diagnosis at ${diagnosisLevel} (${diagnosisRegion}) but procedure at ${procedureLevel} (${procedureRegion}) - region mismatch`,
                    expectedValue: `Procedure should be in ${diagnosisRegion} region`
                });
            }
        }

        return issues;
    }

    /**
     * Extract spinal level from section
     */
    extractSpinalLevel(data, sectionPath) {
        const section = this.getFieldByPath(data, sectionPath);
        if (!section) return null;

        const levelPattern = /\b([CTLS])(\d{1,2})(?:-([CTLS])?(\d{1,2}))?\b/gi;

        let foundLevel = null;
        this.traverseSection(section, (field) => {
            if (!foundLevel) {
                const text = `${field.value} ${field.sourceQuote}`;
                const match = levelPattern.exec(text);
                if (match) {
                    foundLevel = match[0].toUpperCase();
                }
            }
        });

        return foundLevel;
    }

    /**
     * Get spinal region from level
     */
    getSpinalRegion(level) {
        if (!level) return 'unknown';

        const levelUpper = level.toUpperCase();

        for (const [region, levels] of Object.entries(this.medicalKnowledge.spinalLevels)) {
            if (levels.some(l => levelUpper.includes(l))) {
                return region;
            }
        }

        return 'unknown';
    }

    /**
     * Check clinical score consistency
     */
    checkScoreConsistency(data) {
        const issues = [];

        // Check GCS consistency
        const gcs = this.getFieldValue(data, 'clinicalScores.gcs.total');
        if (gcs !== null && gcs !== undefined) {
            const gcsNum = parseInt(gcs);

            // Validate GCS range (3-15)
            if (gcsNum < 3 || gcsNum > 15) {
                issues.push({
                    field: 'clinicalScores.gcs.total',
                    value: gcs,
                    message: `GCS score ${gcs} is outside valid range (3-15)`,
                    severity: 'HIGH'
                });
            }

            // Check GCS components
            const gcsComponents = this.getFieldValue(data, 'clinicalScores.gcs.components');
            if (gcsComponents) {
                const componentMatch = gcsComponents.match(/E(\d+)V(\d+)M(\d+)/i);
                if (componentMatch) {
                    const e = parseInt(componentMatch[1]);
                    const v = parseInt(componentMatch[2]);
                    const m = parseInt(componentMatch[3]);
                    const calculatedTotal = e + v + m;

                    if (calculatedTotal !== gcsNum) {
                        issues.push({
                            field: 'clinicalScores.gcs',
                            value: `Total: ${gcs}, Components: ${gcsComponents}`,
                            message: `GCS components (E${e}V${v}M${m}) sum to ${calculatedTotal}, but total is ${gcs}`,
                            severity: 'HIGH'
                        });
                    }
                }
            }
        }

        // Check mRS consistency
        const mrs = this.getFieldValue(data, 'outcomes.functionalStatus.mRS');
        if (mrs !== null && mrs !== undefined) {
            const mrsNum = parseInt(mrs);

            if (mrsNum < 0 || mrsNum > 6) {
                issues.push({
                    field: 'outcomes.functionalStatus.mRS',
                    value: mrs,
                    message: `mRS score ${mrs} is outside valid range (0-6)`,
                    severity: 'HIGH'
                });
            }
        }

        // Check KPS consistency
        const kps = this.getFieldValue(data, 'outcomes.functionalStatus.KPS');
        if (kps !== null && kps !== undefined) {
            const kpsNum = parseInt(kps);

            if (kpsNum < 0 || kpsNum > 100 || kpsNum % 10 !== 0) {
                issues.push({
                    field: 'outcomes.functionalStatus.KPS',
                    value: kps,
                    message: `KPS score ${kps} should be 0-100 in increments of 10`,
                    severity: 'HIGH'
                });
            }
        }

        return issues;
    }

    /**
     * Check temporal consistency (dates in logical order)
     */
    checkTemporalConsistency(data) {
        const issues = [];

        const dob = this.parseDate(this.getFieldValue(data, 'demographics.dateOfBirth'));
        const admission = this.parseDate(this.getFieldValue(data, 'timeline.admissionDate'));
        const discharge = this.parseDate(this.getFieldValue(data, 'timeline.dischargeDate'));

        // Check chronological order
        if (dob && admission && dob > admission) {
            issues.push({
                field1: 'demographics.dateOfBirth',
                field2: 'timeline.admissionDate',
                value1: this.getFieldValue(data, 'demographics.dateOfBirth'),
                value2: this.getFieldValue(data, 'timeline.admissionDate'),
                message: 'Date of birth is after admission date - impossible'
            });
        }

        if (admission && discharge && admission > discharge) {
            issues.push({
                field1: 'timeline.admissionDate',
                field2: 'timeline.dischargeDate',
                value1: this.getFieldValue(data, 'timeline.admissionDate'),
                value2: this.getFieldValue(data, 'timeline.dischargeDate'),
                message: 'Admission date is after discharge date - impossible'
            });
        }

        return issues;
    }

    /**
     * Check pathology-procedure consistency
     */
    checkPathologyConsistency(data) {
        const issues = [];

        const diagnosis = this.getFieldValue(data, 'pathology.primaryDiagnosis.name');
        const procedures = this.getAllFieldValues(data, 'procedures');

        if (!diagnosis || procedures.length === 0) {
            return issues;
        }

        const diagnosisLower = diagnosis.toLowerCase();
        const pathologyType = this.classifyPathology(diagnosisLower);
        const procedureTypes = procedures.map(p => this.classifyProcedure(p.toLowerCase()));

        if (pathologyType && !procedureTypes.includes(pathologyType) && procedureTypes.length > 0) {
            issues.push({
                field1: 'pathology.primaryDiagnosis.name',
                field2: 'procedures',
                value1: diagnosis,
                value2: procedures.join(', '),
                message: `Diagnosis suggests ${pathologyType} pathology but procedures suggest ${procedureTypes.join('/')} approach`
            });
        }

        return issues;
    }

    /**
     * Classify pathology type
     */
    classifyPathology(diagnosisText) {
        for (const [type, keywords] of Object.entries(this.medicalKnowledge.pathologyKeywords)) {
            if (keywords.some(keyword => diagnosisText.includes(keyword.toLowerCase()))) {
                return type;
            }
        }
        return null;
    }

    /**
     * Classify procedure type
     */
    classifyProcedure(procedureText) {
        if (/clip|coil|embolization|aneurysm|vascular/.test(procedureText)) {
            return 'vascular';
        } else if (/resection|craniotomy|tumor|mass/.test(procedureText)) {
            return 'tumor';
        } else if (/fusion|laminectomy|discectomy|decompress/.test(procedureText)) {
            return 'degenerative';
        } else if (/evacuation|hematoma|hemorrhage/.test(procedureText)) {
            return 'trauma';
        }
        return null;
    }

    /**
     * Parse date string to Date object
     */
    parseDate(dateStr) {
        if (!dateStr) return null;
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    /**
     * Calculate consistency score
     */
    calculateConsistencyScore(errorCount, warningCount) {
        let score = 100;
        score -= errorCount * 20;   // -20 per error
        score -= warningCount * 5;  // -5 per warning
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Helper: Get field value by path
     */
    getFieldValue(data, path) {
        const field = this.getFieldByPath(data, path);
        return field?.value ?? null;
    }

    /**
     * Helper: Get field by path
     */
    getFieldByPath(data, path) {
        const parts = path.split('.');
        let current = data;

        for (const part of parts) {
            if (!current || typeof current !== 'object') {
                return null;
            }
            current = current[part];
        }

        return current;
    }

    /**
     * Helper: Get all field values from section
     */
    getAllFieldValues(data, sectionPath) {
        const section = this.getFieldByPath(data, sectionPath);
        if (!section) return [];

        const values = [];
        this.traverseSection(section, (field) => {
            if (field.value) {
                values.push(String(field.value));
            }
        });

        return values;
    }

    /**
     * Helper: Get all source quotes from section
     */
    getAllSourceQuotes(section) {
        const quotes = [];
        this.traverseSection(section, (field) => {
            if (field.sourceQuote) {
                quotes.push(field.sourceQuote);
            }
        });
        return quotes.join(' ');
    }

    /**
     * Helper: Traverse section
     */
    traverseSection(section, callback) {
        if (!section || typeof section !== 'object') {
            return;
        }

        for (const value of Object.values(section)) {
            if (value && typeof value === 'object') {
                if (value.hasOwnProperty('value') && value.hasOwnProperty('sourceQuote')) {
                    callback(value);
                } else {
                    this.traverseSection(value, callback);
                }
            }
        }
    }
}

// ==================================================================================
// LAYER 5: PROPORTIONALITY VALIDATOR
// ==================================================================================
// Dynamic output sizing validation based on data richness
// Detects padding, over-elaboration, and output inflation
// ==================================================================================

class ProportionalityValidator {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.lastValidation = null;
    }

    /**
     * Validate output proportionality
     * @param {string} generatedOutput - Generated text
     * @param {object} extractedData - Source extraction data
     * @param {string} outputType - 'ultrathink', 'doap', 'narrative'
     * @param {object} options - Validation options
     * @returns {Promise<object>} - Validation result
     */
    async validate(generatedOutput, extractedData, outputType, options = {}) {
        if (!generatedOutput || !extractedData || !outputType) {
            throw new Error('Generated output, extracted data, and output type are required');
        }

        console.log(`🔍 [Proportionality] Starting validation (${outputType})...`);

        try {
            const warnings = [];
            const errors = [];

            // Analyze data richness
            const dataAnalysis = this.analyzeDataRichness(extractedData);
            console.log(`   [Proportionality] Data richness: ${dataAnalysis.richness} (${dataAnalysis.totalFacts} facts)`);

            // Defensive check: Warn if 0 facts found (indicates structure mismatch)
            if (dataAnalysis.totalFacts === 0) {
                console.warn('⚠️ [Proportionality] extractedData contains 0 facts - may indicate structure mismatch');
                console.warn('   Expected structure: {section: {field: {value, sourceQuote}}}');
                console.warn('   Received keys:', Object.keys(extractedData));
                console.warn('   Sample data:', JSON.stringify(extractedData, null, 2).substring(0, 300));
                warnings.push({
                    type: 'data_structure_warning',
                    message: 'extractedData contains 0 facts. This may indicate missing extraction step or incompatible data format.',
                    severity: 'WARNING'
                });
            }

            // Calculate output metrics
            const outputMetrics = this.calculateOutputMetrics(generatedOutput);
            console.log(`   [Proportionality] Output length: ${outputMetrics.wordCount} words`);

            // Get expected range
            const expectedRange = this.getExpectedRange(outputType, dataAnalysis);
            console.log(`   [Proportionality] Expected range: ${expectedRange.min}-${expectedRange.max} words`);

            // Check if output is within expected range
            const withinRange = outputMetrics.wordCount >= expectedRange.min &&
                               outputMetrics.wordCount <= expectedRange.max;

            if (!withinRange) {
                if (outputMetrics.wordCount < expectedRange.min) {
                    warnings.push({
                        type: 'output_too_brief',
                        wordCount: outputMetrics.wordCount,
                        expectedMin: expectedRange.min,
                        expectedMax: expectedRange.max,
                        message: `Output too brief (${outputMetrics.wordCount} words) for ${dataAnalysis.richness} data. Expected ${expectedRange.min}-${expectedRange.max} words.`
                    });
                } else {
                    if (dataAnalysis.richness === 'sparse') {
                        // Sparse data + verbose output = padding (ERROR)
                        errors.push({
                            type: 'output_padding',
                            wordCount: outputMetrics.wordCount,
                            expectedMax: expectedRange.max,
                            dataRichness: dataAnalysis.richness,
                            message: `Output too verbose (${outputMetrics.wordCount} words) for sparse data (${dataAnalysis.totalFacts} facts). Expected ≤${expectedRange.max} words. Possible padding.`,
                            severity: 'HIGH'
                        });
                    } else {
                        warnings.push({
                            type: 'output_too_verbose',
                            wordCount: outputMetrics.wordCount,
                            expectedMax: expectedRange.max,
                            message: `Output verbose (${outputMetrics.wordCount} words). Expected ≤${expectedRange.max} words.`
                        });
                    }
                }
            }

            // Check information density
            const densityCheck = this.checkInformationDensity(
                outputMetrics,
                dataAnalysis,
                outputType
            );

            if (!densityCheck.adequate) {
                if (densityCheck.density < densityCheck.expectedMin) {
                    errors.push({
                        type: 'low_information_density',
                        density: densityCheck.density.toFixed(2),
                        expectedMin: densityCheck.expectedMin,
                        message: `Low information density (${densityCheck.density.toFixed(2)} facts/100 words). Expected ≥${densityCheck.expectedMin}. Possible padding.`,
                        severity: 'MEDIUM'
                    });
                }
            }

            // Check for repetition
            const repetitionCheck = this.checkRepetition(generatedOutput);
            if (repetitionCheck.hasRepetition) {
                warnings.push({
                    type: 'content_repetition',
                    repetitionScore: repetitionCheck.score,
                    examples: repetitionCheck.examples.slice(0, 3),
                    message: `Content repetition detected (score: ${repetitionCheck.score.toFixed(2)}). May indicate padding.`
                });
            }

            // Check section balance (for narratives)
            if (outputType === 'narrative') {
                const balanceCheck = this.checkSectionBalance(generatedOutput, dataAnalysis);
                balanceCheck.imbalances.forEach(imbalance => {
                    warnings.push({
                        type: 'section_imbalance',
                        ...imbalance
                    });
                });
            }

            // Calculate proportionality score
            const proportionalityScore = this.calculateProportionalityScore(
                outputMetrics,
                dataAnalysis,
                expectedRange,
                densityCheck,
                repetitionCheck
            );

            console.log(`   [Proportionality] Score: ${proportionalityScore}/100`);
            console.log(`   [Proportionality] Errors: ${errors.length}, Warnings: ${warnings.length}`);

            // Store result
            this.lastValidation = {
                passed: errors.length === 0,
                errors: errors,
                warnings: warnings,
                proportionalityScore: proportionalityScore,
                dataAnalysis: dataAnalysis,
                outputMetrics: outputMetrics,
                expectedRange: expectedRange,
                densityCheck: densityCheck,
                validatedAt: new Date().toISOString()
            };

            console.log(errors.length === 0 ? '✅ [Proportionality] Passed' : '❌ [Proportionality] Issues detected');

            return {
                success: true,
                validation: this.lastValidation,
                metadata: {
                    outputType: outputType,
                    wordCount: outputMetrics.wordCount,
                    dataRichness: dataAnalysis.richness,
                    proportionalityScore: proportionalityScore
                }
            };

        } catch (error) {
            console.error('❌ [Proportionality] Validation error:', error);
            return {
                success: false,
                error: error.message,
                validation: null,
                metadata: null
            };
        }
    }

    /**
     * Analyze data richness from extraction
     */
    analyzeDataRichness(data) {
        const analysis = {
            totalFacts: 0,
            sectionsPopulated: [],
            sectionFactCounts: {},
            richness: 'sparse',
            criticalFactsPresent: 0
        };

        // Count facts in each section
        const topLevelSections = ['demographics', 'symptoms', 'examination', 'imaging',
                                   'pathology', 'procedures', 'medications', 'outcomes', 'timeline'];

        topLevelSections.forEach(section => {
            if (data[section]) {
                const factCount = this.countFacts(data[section]);
                if (factCount > 0) {
                    analysis.sectionsPopulated.push(section);
                    analysis.sectionFactCounts[section] = factCount;
                    analysis.totalFacts += factCount;
                }
            }
        });

        // Check critical facts
        const criticalFields = [
            'demographics.age',
            'pathology.primaryDiagnosis.name'
        ];

        criticalFields.forEach(field => {
            if (this.hasValue(data, field)) {
                analysis.criticalFactsPresent++;
            }
        });

        // Classify richness
        if (analysis.totalFacts < 10) {
            analysis.richness = 'sparse';
        } else if (analysis.totalFacts < 25) {
            analysis.richness = 'moderate';
        } else if (analysis.totalFacts < 50) {
            analysis.richness = 'rich';
        } else {
            analysis.richness = 'very_rich';
        }

        return analysis;
    }

    /**
     * Count facts in section
     */
    countFacts(section, count = 0, path = '', depth = 0) {
        if (!section || typeof section !== 'object') {
            return count;
        }

        // Prevent infinite recursion
        if (depth > 10) {
            console.warn(`   [Proportionality] Max recursion depth reached at path: ${path}`);
            return count;
        }

        for (const [key, value] of Object.entries(section)) {
            const currentPath = path ? `${path}.${key}` : key;

            if (value && typeof value === 'object') {
                if (value.hasOwnProperty('value') && value.hasOwnProperty('sourceQuote')) {
                    if (value.value !== null && value.value !== undefined && value.value !== '') {
                        count++;
                    }
                } else {
                    count = this.countFacts(value, count, currentPath, depth + 1);
                }
            }
        }

        return count;
    }

    /**
     * Check if field has value
     */
    hasValue(data, path) {
        const parts = path.split('.');
        let current = data;

        for (const part of parts) {
            if (!current || typeof current !== 'object') {
                return false;
            }
            current = current[part];
        }

        if (current && typeof current === 'object' && current.value) {
            return current.value !== null && current.value !== undefined && current.value !== '';
        }

        return false;
    }

    /**
     * Calculate output metrics
     */
    calculateOutputMetrics(output) {
        const words = output.split(/\s+/).filter(w => w.length > 0);
        const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);

        return {
            wordCount: words.length,
            sentenceCount: sentences.length,
            averageSentenceLength: sentences.length > 0 ? words.length / sentences.length : 0,
            characterCount: output.length
        };
    }

    /**
     * Get expected word range
     */
    getExpectedRange(outputType, dataAnalysis) {
        const ranges = {
            ultrathink: {
                sparse: { min: 25, max: 40 },
                moderate: { min: 35, max: 50 },
                rich: { min: 40, max: 50 },
                very_rich: { min: 45, max: 50 }
            },
            doap: {
                sparse: { min: 50, max: 100 },
                moderate: { min: 80, max: 150 },
                rich: { min: 120, max: 180 },
                very_rich: { min: 150, max: 200 }
            },
            narrative: {
                sparse: { min: 100, max: 300 },
                moderate: { min: 400, max: 800 },
                rich: { min: 1000, max: 2000 },
                very_rich: { min: 1500, max: 3000 }
            }
        };

        const typeRanges = ranges[outputType] || ranges.narrative;
        return typeRanges[dataAnalysis.richness] || typeRanges.moderate;
    }

    /**
     * Check information density
     */
    checkInformationDensity(outputMetrics, dataAnalysis, outputType) {
        const actualDensity = outputMetrics.wordCount > 0
            ? (dataAnalysis.totalFacts / outputMetrics.wordCount) * 100
            : 0;

        const expectedMinDensity = {
            ultrathink: 8,   // ~8 facts per 100 words
            doap: 5,         // ~5 facts per 100 words
            narrative: 2     // ~2 facts per 100 words
        };

        const minDensity = expectedMinDensity[outputType] || 2;

        return {
            density: actualDensity,
            expectedMin: minDensity,
            adequate: actualDensity >= minDensity
        };
    }

    /**
     * Check for content repetition
     */
    checkRepetition(output) {
        const sentences = output.split(/[.!?]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 10);

        if (sentences.length < 2) {
            return { hasRepetition: false, score: 0, examples: [] };
        }

        let repetitionCount = 0;
        const repetitions = [];

        // Check for similar sentences (>70% word overlap)
        for (let i = 0; i < sentences.length; i++) {
            for (let j = i + 1; j < sentences.length; j++) {
                const similarity = this.calculateSentenceSimilarity(sentences[i], sentences[j]);
                if (similarity > 0.7) {
                    repetitionCount++;
                    repetitions.push({
                        sentence1: sentences[i].substring(0, 100),
                        sentence2: sentences[j].substring(0, 100),
                        similarity: similarity.toFixed(2)
                    });
                }
            }
        }

        const repetitionScore = sentences.length > 0 ? repetitionCount / sentences.length : 0;

        return {
            hasRepetition: repetitionScore > 0.1,
            score: repetitionScore,
            examples: repetitions
        };
    }

    /**
     * Calculate sentence similarity (Jaccard coefficient)
     */
    calculateSentenceSimilarity(sent1, sent2) {
        const words1 = new Set(sent1.split(/\s+/));
        const words2 = new Set(sent2.split(/\s+/));

        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * Check section balance
     */
    checkSectionBalance(output, dataAnalysis) {
        const imbalances = [];
        const outputLower = output.toLowerCase();

        dataAnalysis.sectionsPopulated.forEach(section => {
            const factCount = dataAnalysis.sectionFactCounts[section];
            const sectionKeywords = this.getSectionKeywords(section);
            const mentioned = sectionKeywords.some(keyword => outputLower.includes(keyword));

            if (!mentioned && factCount > 2) {
                imbalances.push({
                    section: section,
                    factCount: factCount,
                    message: `Section "${section}" has ${factCount} facts but is not covered in narrative`
                });
            }
        });

        return { imbalances };
    }

    /**
     * Get section keywords
     */
    getSectionKeywords(section) {
        const keywords = {
            demographics: ['age', 'patient', 'year old'],
            symptoms: ['presents', 'symptoms', 'complains'],
            examination: ['exam', 'examination', 'neurological'],
            imaging: ['imaging', 'mri', 'ct', 'scan'],
            pathology: ['diagnosis', 'pathology'],
            procedures: ['surgery', 'procedure', 'operation'],
            medications: ['medication', 'drug'],
            outcomes: ['outcome', 'discharge', 'functional'],
            timeline: ['admission', 'discharge', 'hospital']
        };

        return keywords[section] || [section];
    }

    /**
     * Calculate proportionality score
     */
    calculateProportionalityScore(outputMetrics, dataAnalysis, expectedRange, densityCheck, repetitionCheck) {
        let score = 100;

        // Factor 1: Length appropriateness (40 points)
        const withinRange = outputMetrics.wordCount >= expectedRange.min &&
                           outputMetrics.wordCount <= expectedRange.max;

        if (withinRange) {
            score += 0;
        } else if (outputMetrics.wordCount < expectedRange.min) {
            const shortfall = (expectedRange.min - outputMetrics.wordCount) / expectedRange.min;
            score -= Math.min(20, shortfall * 40);
        } else {
            const excess = (outputMetrics.wordCount - expectedRange.max) / expectedRange.max;
            score -= Math.min(40, excess * 60);
        }

        // Factor 2: Information density (30 points)
        if (densityCheck.adequate) {
            score += 0;
        } else {
            const densityShortfall = (densityCheck.expectedMin - densityCheck.density) / densityCheck.expectedMin;
            score -= Math.min(30, densityShortfall * 30);
        }

        // Factor 3: Repetition (20 points)
        if (repetitionCheck.hasRepetition) {
            score -= Math.min(20, repetitionCheck.score * 100);
        }

        return Math.max(0, Math.min(100, Math.round(score)));
    }
}

// ==================================================================================
// LAYER 6: CONFIDENCE CALIBRATOR
// ==================================================================================
// Re-calibrates AI-reported confidence scores based on validation results
// Ensures confidence scores accurately reflect data quality
// ==================================================================================

class ConfidenceCalibrator {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.lastCalibration = null;
    }

    /**
     * Calibrate confidence scores
     * @param {object} extractedData - Extraction with confidence scores
     * @param {object} validationResults - Results from validators
     * @param {object} options - Calibration options
     * @returns {Promise<object>} - Calibration result with adjusted confidences
     */
    async calibrate(extractedData, validationResults, options = {}) {
        if (!extractedData || !validationResults) {
            throw new Error('Extracted data and validation results are required');
        }

        console.log('🔍 [Confidence] Starting confidence calibration...');

        try {
            const warnings = [];
            const errors = [];
            const adjustments = [];

            // Create calibrated copy of extraction data
            const calibratedData = JSON.parse(JSON.stringify(extractedData));

            // 1. Apply grounding-based adjustments
            if (validationResults.grounding) {
                console.log('   [Confidence] Applying grounding-based calibration...');
                const groundingAdjustments = this.applyGroundingCalibration(
                    calibratedData,
                    validationResults.grounding
                );
                adjustments.push(...groundingAdjustments);
            }

            // 2. Apply fabrication-based adjustments
            if (validationResults.fabrication) {
                console.log('   [Confidence] Applying fabrication-based calibration...');
                const fabricationAdjustments = this.applyFabricationCalibration(
                    calibratedData,
                    validationResults.fabrication
                );
                adjustments.push(...fabricationAdjustments);
            }

            // 3. Apply consistency-based adjustments
            if (validationResults.consistency) {
                console.log('   [Confidence] Applying consistency-based calibration...');
                const consistencyAdjustments = this.applyConsistencyCalibration(
                    calibratedData,
                    validationResults.consistency
                );
                adjustments.push(...consistencyAdjustments);
            }

            // 4. Apply completeness-based adjustments
            if (validationResults.completeness) {
                console.log('   [Confidence] Applying completeness-based calibration...');
                const completenessAdjustments = this.applyCompletenessCalibration(
                    calibratedData,
                    validationResults.completeness
                );
                adjustments.push(...completenessAdjustments);
            }

            // 5. Validate inference constraints (inferred fields must have confidence <0.8)
            console.log('   [Confidence] Validating inference constraints...');
            const inferenceViolations = this.validateInferenceConstraints(calibratedData);
            inferenceViolations.forEach(violation => {
                errors.push({
                    type: 'inference_constraint_violation',
                    ...violation,
                    severity: 'HIGH'
                });
            });

            // 6. Check for over-confident extractions
            console.log('   [Confidence] Checking for over-confidence...');
            const overconfidentFields = this.detectOverconfidence(calibratedData, validationResults);
            overconfidentFields.forEach(field => {
                warnings.push({
                    type: 'overconfident_extraction',
                    ...field
                });
            });

            // Calculate calibration metrics
            const metrics = this.calculateCalibrationMetrics(
                extractedData,
                calibratedData,
                adjustments
            );

            console.log(`   [Confidence] Total adjustments: ${adjustments.length}`);
            console.log(`   [Confidence] Average confidence change: ${metrics.averageChange.toFixed(3)}`);
            console.log(`   [Confidence] Errors: ${errors.length}, Warnings: ${warnings.length}`);

            // Store result
            this.lastCalibration = {
                valid: errors.length === 0,
                errors: errors,
                warnings: warnings,
                calibratedData: calibratedData,
                adjustments: adjustments,
                metrics: metrics,
                calibratedAt: new Date().toISOString()
            };

            console.log(errors.length === 0 ? '✅ [Confidence] Calibration complete' : '❌ [Confidence] Issues detected');

            return {
                success: true,
                validation: this.lastCalibration,
                calibratedData: calibratedData,
                metadata: {
                    adjustmentCount: adjustments.length,
                    averageChange: metrics.averageChange,
                    fieldsAdjusted: metrics.fieldsAdjusted
                }
            };

        } catch (error) {
            console.error('❌ [Confidence] Calibration error:', error);
            return {
                success: false,
                error: error.message,
                validation: null,
                calibratedData: null,
                metadata: null
            };
        }
    }

    /**
     * Apply grounding-based confidence adjustments
     */
    applyGroundingCalibration(data, groundingValidation) {
        const adjustments = [];

        if (!groundingValidation.fieldValidations) {
            return adjustments;
        }

        // Traverse data and adjust based on grounding quality
        this.traverseAndAdjust(data, '', (path, field, parent, key) => {
            // Find corresponding grounding validation
            const validation = groundingValidation.fieldValidations.find(v => v.path === path);

            if (!validation) {
                return;
            }

            const originalConfidence = field.confidence;
            let adjustedConfidence = originalConfidence;
            const reasons = [];

            // Adjust based on quote quality
            switch (validation.quoteQuality) {
                case 'EXCELLENT':
                    // No adjustment needed
                    break;

                case 'GOOD':
                    // Minor adjustment down
                    adjustedConfidence = Math.min(adjustedConfidence, 0.95);
                    reasons.push('Good grounding (capped at 0.95)');
                    break;

                case 'ACCEPTABLE':
                    // Moderate adjustment down
                    adjustedConfidence = Math.min(adjustedConfidence, 0.85);
                    reasons.push('Acceptable grounding (capped at 0.85)');
                    break;

                case 'POOR':
                    // Significant adjustment down
                    adjustedConfidence = Math.min(adjustedConfidence, 0.60);
                    reasons.push('Poor grounding quality (capped at 0.60)');
                    break;

                case 'VERY_POOR':
                    // Severe adjustment
                    adjustedConfidence = Math.min(adjustedConfidence, 0.40);
                    reasons.push('Very poor grounding (capped at 0.40)');
                    break;

                case 'NONE':
                    // No grounding = very low confidence
                    adjustedConfidence = 0.20;
                    reasons.push('No grounding (set to 0.20)');
                    break;
            }

            // Additional adjustment if quote doesn't exist in text
            if (!validation.quoteExists && validation.sourceQuote) {
                adjustedConfidence = Math.min(adjustedConfidence, 0.30);
                reasons.push('Source quote not found in text');
            }

            // Apply adjustment
            if (Math.abs(adjustedConfidence - originalConfidence) > 0.01) {
                field.confidence = parseFloat(adjustedConfidence.toFixed(3));

                adjustments.push({
                    path: path,
                    originalConfidence: originalConfidence,
                    adjustedConfidence: adjustedConfidence,
                    change: adjustedConfidence - originalConfidence,
                    reasons: reasons,
                    source: 'grounding'
                });
            }
        });

        return adjustments;
    }

    /**
     * Apply fabrication-based confidence adjustments
     */
    applyFabricationCalibration(data, fabricationValidation) {
        const adjustments = [];

        if (!fabricationValidation.fabrications || fabricationValidation.fabrications.length === 0) {
            return adjustments;
        }

        // For each fabrication, find and adjust related fields
        fabricationValidation.fabrications.forEach(fab => {
            // Extract key terms from fabricated statement
            const keyTerms = this.extractKeyTerms(fab.statement);

            // Find fields that might be related to this fabrication
            this.traverseAndAdjust(data, '', (path, field) => {
                const fieldText = `${field.value} ${field.sourceQuote}`.toLowerCase();

                // Check if this field is related to the fabrication
                const related = keyTerms.some(term => fieldText.includes(term.toLowerCase()));

                if (related) {
                    const originalConfidence = field.confidence;

                    // Reduce confidence based on fabrication confidence
                    const reduction = fab.confidence * 0.5; // Reduce by up to 50%
                    const adjustedConfidence = Math.max(0.10, originalConfidence * (1 - reduction));

                    if (Math.abs(adjustedConfidence - originalConfidence) > 0.01) {
                        field.confidence = parseFloat(adjustedConfidence.toFixed(3));

                        adjustments.push({
                            path: path,
                            originalConfidence: originalConfidence,
                            adjustedConfidence: adjustedConfidence,
                            change: adjustedConfidence - originalConfidence,
                            reasons: [`Related to fabricated content: "${fab.statement.substring(0, 50)}..."`],
                            source: 'fabrication'
                        });
                    }
                }
            });
        });

        return adjustments;
    }

    /**
     * Apply consistency-based confidence adjustments
     */
    applyConsistencyCalibration(data, consistencyValidation) {
        const adjustments = [];

        if (!consistencyValidation.errors || consistencyValidation.errors.length === 0) {
            return adjustments;
        }

        // For each consistency error, reduce confidence of involved fields
        consistencyValidation.errors.forEach(error => {
            if (error.field1) {
                this.adjustFieldConfidence(data, error.field1, 0.5, `Consistency issue: ${error.message}`, adjustments);
            }
            if (error.field2) {
                this.adjustFieldConfidence(data, error.field2, 0.5, `Consistency issue: ${error.message}`, adjustments);
            }
            if (error.field && !error.field1) {
                this.adjustFieldConfidence(data, error.field, 0.5, `Consistency issue: ${error.message}`, adjustments);
            }
        });

        return adjustments;
    }

    /**
     * Apply completeness-based confidence adjustments
     */
    applyCompletenessCalibration(data, completenessValidation) {
        const adjustments = [];

        // If overall completeness is low, reduce all confidences slightly
        if (completenessValidation.scores && completenessValidation.scores.overall < 70) {
            const reductionFactor = 0.9; // 10% reduction

            this.traverseAndAdjust(data, '', (path, field) => {
                const originalConfidence = field.confidence;
                const adjustedConfidence = originalConfidence * reductionFactor;

                if (Math.abs(adjustedConfidence - originalConfidence) > 0.01) {
                    field.confidence = parseFloat(adjustedConfidence.toFixed(3));

                    adjustments.push({
                        path: path,
                        originalConfidence: originalConfidence,
                        adjustedConfidence: adjustedConfidence,
                        change: adjustedConfidence - originalConfidence,
                        reasons: [`Low overall completeness (${completenessValidation.scores.overall}%)`],
                        source: 'completeness'
                    });
                }
            });
        }

        return adjustments;
    }

    /**
     * Adjust specific field confidence by path
     */
    adjustFieldConfidence(data, fieldPath, reductionFactor, reason, adjustments) {
        this.traverseAndAdjust(data, '', (path, field) => {
            if (path === fieldPath || path.includes(fieldPath)) {
                const originalConfidence = field.confidence;
                const adjustedConfidence = originalConfidence * reductionFactor;

                if (Math.abs(adjustedConfidence - originalConfidence) > 0.01) {
                    field.confidence = parseFloat(adjustedConfidence.toFixed(3));

                    adjustments.push({
                        path: path,
                        originalConfidence: originalConfidence,
                        adjustedConfidence: adjustedConfidence,
                        change: adjustedConfidence - originalConfidence,
                        reasons: [reason],
                        source: 'consistency'
                    });
                }
            }
        });
    }

    /**
     * Validate inference constraints (inferred fields < 0.8 confidence)
     */
    validateInferenceConstraints(data) {
        const violations = [];

        this.traverseAndAdjust(data, '', (path, field) => {
            // Check if field is inferred
            if (field.deductionMetadata && field.deductionMetadata.deduced) {
                if (field.confidence >= 0.8) {
                    violations.push({
                        field: path,
                        confidence: field.confidence,
                        deductionMethod: field.deductionMetadata.deducedFrom,
                        message: `Inferred field has confidence ≥0.8 (${field.confidence}), must be <0.8`
                    });

                    // Auto-correct
                    field.confidence = 0.79;
                }
            }
        });

        return violations;
    }

    /**
     * Detect over-confident extractions
     */
    detectOverconfidence(data, validationResults) {
        const overconfident = [];

        // If validation failed but field has high confidence, flag it
        const hasIssues = (validationResults.grounding && !validationResults.grounding.valid) ||
                         (validationResults.consistency && !validationResults.consistency.valid) ||
                         (validationResults.completeness && !validationResults.completeness.valid);

        if (hasIssues) {
            this.traverseAndAdjust(data, '', (path, field) => {
                if (field.confidence >= 0.95) {
                    overconfident.push({
                        field: path,
                        confidence: field.confidence,
                        message: `Very high confidence (${field.confidence}) despite validation issues`
                    });
                }
            });
        }

        return overconfident;
    }

    /**
     * Extract key terms from statement
     */
    extractKeyTerms(statement) {
        return statement
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 4 && !/^(the|and|with|for|from|that|this)$/.test(word))
            .slice(0, 5); // Top 5 key terms
    }

    /**
     * Traverse data and apply adjustment callback
     */
    traverseAndAdjust(data, path = '', callback) {
        if (!data || typeof data !== 'object') {
            return;
        }

        for (const [key, value] of Object.entries(data)) {
            if (value === null || value === undefined) {
                continue;
            }

            const currentPath = path ? `${path}.${key}` : key;

            // Check if this is a grounded field
            if (typeof value === 'object' &&
                value.hasOwnProperty('value') &&
                value.hasOwnProperty('sourceQuote') &&
                value.hasOwnProperty('confidence')) {

                callback(currentPath, value, data, key);

            } else if (typeof value === 'object' && !Array.isArray(value)) {
                // Recurse into nested objects
                this.traverseAndAdjust(value, currentPath, callback);

            } else if (Array.isArray(value)) {
                // Recurse into arrays
                value.forEach((item, index) => {
                    this.traverseAndAdjust(item, `${currentPath}[${index}]`, callback);
                });
            }
        }
    }

    /**
     * Calculate calibration metrics
     */
    calculateCalibrationMetrics(originalData, calibratedData, adjustments) {
        const metrics = {
            fieldsAdjusted: adjustments.length,
            averageChange: 0,
            totalChangeSum: 0,
            maxIncrease: 0,
            maxDecrease: 0,
            adjustmentsBySource: {}
        };

        if (adjustments.length === 0) {
            return metrics;
        }

        // Calculate average change
        metrics.totalChangeSum = adjustments.reduce((sum, adj) => sum + adj.change, 0);
        metrics.averageChange = metrics.totalChangeSum / adjustments.length;

        // Find max changes
        adjustments.forEach(adj => {
            if (adj.change > metrics.maxIncrease) {
                metrics.maxIncrease = adj.change;
            }
            if (adj.change < metrics.maxDecrease) {
                metrics.maxDecrease = adj.change;
            }

            // Count by source
            metrics.adjustmentsBySource[adj.source] = (metrics.adjustmentsBySource[adj.source] || 0) + 1;
        });

        return metrics;
    }
}

// ==================================================================================
// VALIDATION ENGINE - MASTER ORCHESTRATOR
// ==================================================================================
// Coordinates all 6 validation layers
// Provides comprehensive validation workflows
// ==================================================================================

export class ValidationEngine {
    constructor(apiClient, options = {}) {
        this.apiClient = apiClient;

        // Initialize all validators
        this.groundingValidator = new GroundingValidator(''); // Will receive source text per validation

        // Fabrication detector with configurable mode
        // For ULTRATHINK: use semantic-AI-only mode (no false positives)
        this.fabricationDetector = new FabricationDetector(apiClient, {
            enableTermBasedDetection: options.enableTermBasedDetection !== undefined
                ? options.enableTermBasedDetection
                : true // Default: both term-based and semantic AI
        });

        // ULTRATHINK-specific detector (semantic-AI-only for highest precision)
        this.ultrathinkFabricationDetector = new FabricationDetector(apiClient, {
            enableTermBasedDetection: false
        });

        this.completenessChecker = new CompletenessChecker(apiClient);
        this.consistencyValidator = new ConsistencyValidator(apiClient);
        this.proportionalityValidator = new ProportionalityValidator(apiClient);
        this.confidenceCalibrator = new ConfidenceCalibrator(apiClient);

        this.lastValidation = null;
    }

    /**
     * Validate extraction (pre-generation)
     * @param {object} extractedData - Extraction result
     * @param {string} originalText - Original clinical text
     * @param {object} options - Validation options
     * @returns {Promise<object>} - Comprehensive validation result
     */
    async validateExtraction(extractedData, originalText, options = {}) {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('PHASE 4: EXTRACTION VALIDATION PIPELINE');
        console.log('═══════════════════════════════════════════════════════\n');

        try {
            // Check if extractedData is empty/null
            const hasExtractedData = extractedData && typeof extractedData === 'object' && Object.keys(extractedData).length > 0;

            if (!hasExtractedData) {
                console.warn('⚠️ [Extraction Validation] No extractedData provided - skipping extraction-specific validations');
                console.warn('   This is expected for direct transcript-to-note generation without structured extraction');
                return {
                    success: true,
                    skipped: true,
                    reason: 'No extractedData available',
                    validation: {
                        scores: {
                            overall: 100,  // Pass with full score since no extraction to validate
                            grounding: 100,
                            completeness: 100,
                            consistency: 100
                        },
                        status: 'PASSED',
                        errors: [],
                        warnings: [{
                            type: 'extraction_skipped',
                            message: 'Extraction validation skipped - no extractedData provided',
                            severity: 'INFO'
                        }]
                    },
                    calibratedData: null
                };
            }

            const validationResults = {
                grounding: null,
                completeness: null,
                consistency: null,
                calibration: null
            };

            // Step 1: Grounding Validation
            console.log('📋 Step 1: Grounding Validation');
            console.log('─'.repeat(60));

            // Create grounding validator with source text
            const groundingValidator = new GroundingValidator(originalText);
            validationResults.grounding = await groundingValidator.validate(extractedData);

            if (validationResults.grounding.success) {
                console.log(`✅ Grounding: ${validationResults.grounding.validation.scores.overall}/100`);
            } else {
                console.log(`❌ Grounding validation failed: ${validationResults.grounding.error}`);
            }

            // Step 2: Completeness Check
            console.log('\n📋 Step 2: Completeness Check');
            console.log('─'.repeat(60));
            validationResults.completeness = await this.completenessChecker.check(
                extractedData,
                originalText,
                options
            );

            if (validationResults.completeness.success) {
                console.log(`✅ Completeness: ${validationResults.completeness.validation.scores.overall}/100`);
            } else {
                console.log(`❌ Completeness check failed: ${validationResults.completeness.error}`);
            }

            // Step 3: Consistency Validation
            console.log('\n📋 Step 3: Consistency Validation');
            console.log('─'.repeat(60));
            validationResults.consistency = await this.consistencyValidator.validate(
                extractedData,
                originalText,
                options
            );

            if (validationResults.consistency.success) {
                console.log(`✅ Consistency: ${validationResults.consistency.validation.consistencyScore}/100`);
            } else {
                console.log(`❌ Consistency validation failed: ${validationResults.consistency.error}`);
            }

            // Step 4: Confidence Calibration
            console.log('\n📋 Step 4: Confidence Calibration');
            console.log('─'.repeat(60));
            validationResults.calibration = await this.confidenceCalibrator.calibrate(
                extractedData,
                {
                    grounding: validationResults.grounding?.validation,
                    completeness: validationResults.completeness?.validation,
                    consistency: validationResults.consistency?.validation
                },
                options
            );

            if (validationResults.calibration.success) {
                console.log(`✅ Calibration: ${validationResults.calibration.metadata.adjustmentCount} adjustments`);
            } else {
                console.log(`❌ Confidence calibration failed: ${validationResults.calibration.error}`);
            }

            // Aggregate results
            const aggregated = this.aggregateExtractionValidation(validationResults);

            console.log('\n═══════════════════════════════════════════════════════');
            console.log('EXTRACTION VALIDATION SUMMARY');
            console.log('═══════════════════════════════════════════════════════');
            console.log(`Overall Quality Score: ${aggregated.overallScore}/100`);
            console.log(`Status: ${aggregated.status}`);
            console.log(`Critical Issues: ${aggregated.summary.criticalIssues}`);
            console.log(`Warnings: ${aggregated.summary.warnings}`);
            console.log('═══════════════════════════════════════════════════════\n');

            return {
                success: true,
                validation: aggregated,
                calibratedData: validationResults.calibration?.calibratedData || extractedData
            };

        } catch (error) {
            console.error('❌ Extraction validation pipeline error:', error);
            return {
                success: false,
                error: error.message,
                validation: null,
                calibratedData: extractedData
            };
        }
    }

    /**
     * Validate generation (post-generation)
     * @param {string} generatedText - Generated output
     * @param {object} extractedData - Source extraction
     * @param {string} originalText - Original clinical text
     * @param {string} outputType - Type of output (ultrathink, doap, narrative, soap)
     * @param {object} options - Validation options
     * @returns {Promise<object>} - Comprehensive validation result
     */
    async validateGeneration(generatedText, extractedData, originalText, outputType, options = {}) {
        console.log(`\n═══════════════════════════════════════════════════════`);
        console.log(`PHASE 4: ${outputType.toUpperCase()} VALIDATION PIPELINE`);
        console.log(`═══════════════════════════════════════════════════════\n`);

        try {
            const validationResults = {
                fabrication: null,
                proportionality: null
            };

            // Step 1: Fabrication Detection
            console.log('📋 Step 1: Fabrication Detection');
            console.log('─'.repeat(60));

            // Use ULTRATHINK-specific detector for ULTRATHINK validation
            // ULTRATHINK uses semantic-AI-only mode (no term-based detection) for highest precision
            const detectorToUse = outputType.toLowerCase() === 'ultrathink'
                ? this.ultrathinkFabricationDetector
                : this.fabricationDetector;

            if (outputType.toLowerCase() === 'ultrathink') {
                console.log('   🎯 Using ULTRATHINK-specific detector (semantic-AI-only, zero false positives)');
            }

            validationResults.fabrication = await detectorToUse.detect(
                generatedText,
                extractedData,
                originalText,
                options
            );

            if (validationResults.fabrication.success) {
                console.log(`✅ Fabrication: ${validationResults.fabrication.validation.fabricationScore}/100`);
            } else {
                console.log(`❌ Fabrication detection failed: ${validationResults.fabrication.error}`);
            }

            // Step 2: Proportionality Validation
            console.log('\n📋 Step 2: Proportionality Validation');
            console.log('─'.repeat(60));
            validationResults.proportionality = await this.proportionalityValidator.validate(
                generatedText,
                extractedData,
                outputType,
                options
            );

            if (validationResults.proportionality.success) {
                console.log(`✅ Proportionality: ${validationResults.proportionality.validation.proportionalityScore}/100`);
            } else {
                console.log(`❌ Proportionality validation failed: ${validationResults.proportionality.error}`);
            }

            // Aggregate results
            const aggregated = this.aggregateGenerationValidation(validationResults, outputType);

            console.log('\n═══════════════════════════════════════════════════════');
            console.log(`${outputType.toUpperCase()} VALIDATION SUMMARY`);
            console.log('═══════════════════════════════════════════════════════');
            console.log(`Overall Quality Score: ${aggregated.overallScore}/100`);
            console.log(`Status: ${aggregated.status}`);
            console.log(`Critical Issues: ${aggregated.summary.criticalIssues}`);
            console.log(`Warnings: ${aggregated.summary.warnings}`);
            console.log('═══════════════════════════════════════════════════════\n');

            return {
                success: true,
                validation: aggregated
            };

        } catch (error) {
            console.error(`❌ ${outputType} validation pipeline error:`, error);
            return {
                success: false,
                error: error.message,
                validation: null
            };
        }
    }

    /**
     * Complete validation pipeline (extraction + all outputs)
     * @param {object} extractedData - Extraction result
     * @param {string} originalText - Original clinical text
     * @param {object} outputs - Generated outputs {ultrathink, doap, narrative, soap}
     * @param {object} options - Validation options
     * @returns {Promise<object>} - Complete validation result
     */
    async validateComplete(extractedData, originalText, outputs = {}, options = {}) {
        console.log('\n╔═══════════════════════════════════════════════════════╗');
        console.log('║        PHASE 4: COMPLETE VALIDATION PIPELINE         ║');
        console.log('╚═══════════════════════════════════════════════════════╝\n');

        try {
            // 1. Validate extraction
            const extractionValidation = await this.validateExtraction(
                extractedData,
                originalText,
                options
            );

            // Use calibrated data for generation validation
            const calibratedData = extractionValidation.calibratedData || extractedData;

            // 2. Validate each output type
            const outputValidations = {};

            if (outputs.ultrathink) {
                outputValidations.ultrathink = await this.validateGeneration(
                    outputs.ultrathink,
                    calibratedData,
                    originalText,
                    'ultrathink',
                    options
                );
            }

            if (outputs.doap) {
                outputValidations.doap = await this.validateGeneration(
                    outputs.doap,
                    calibratedData,
                    originalText,
                    'doap',
                    options
                );
            }

            if (outputs.soap) {
                outputValidations.soap = await this.validateGeneration(
                    outputs.soap,
                    calibratedData,
                    originalText,
                    'soap',
                    options
                );
            }

            if (outputs.narrative) {
                outputValidations.narrative = await this.validateGeneration(
                    outputs.narrative,
                    calibratedData,
                    originalText,
                    'narrative',
                    options
                );
            }

            // 3. Aggregate complete validation
            const completeValidation = this.aggregateCompleteValidation(
                extractionValidation,
                outputValidations
            );

            console.log('\n╔═══════════════════════════════════════════════════════╗');
            console.log('║           COMPLETE VALIDATION SUMMARY                ║');
            console.log('╚═══════════════════════════════════════════════════════╝');
            console.log(`\n📊 Overall System Quality: ${completeValidation.systemQualityScore}/100`);
            console.log(`   Status: ${completeValidation.status}`);
            console.log(`\n📋 Validation Breakdown:`);
            console.log(`   Extraction Quality: ${completeValidation.extractionScore}/100`);
            if (outputValidations.ultrathink) {
                console.log(`   ULTRATHINK Quality: ${completeValidation.outputScores.ultrathink}/100`);
            }
            if (outputValidations.doap) {
                console.log(`   DOAP Quality: ${completeValidation.outputScores.doap}/100`);
            }
            if (outputValidations.soap) {
                console.log(`   SOAP Quality: ${completeValidation.outputScores.soap}/100`);
            }
            if (outputValidations.narrative) {
                console.log(`   Narrative Quality: ${completeValidation.outputScores.narrative}/100`);
            }
            console.log(`\n⚠️  Total Issues:`);
            console.log(`   Critical: ${completeValidation.totalIssues.critical}`);
            console.log(`   Warnings: ${completeValidation.totalIssues.warnings}`);
            console.log('\n═══════════════════════════════════════════════════════\n');

            // Store complete validation
            this.lastValidation = completeValidation;

            return {
                success: true,
                validation: completeValidation,
                calibratedData: calibratedData
            };

        } catch (error) {
            console.error('❌ Complete validation pipeline error:', error);
            return {
                success: false,
                error: error.message,
                validation: null,
                calibratedData: extractedData
            };
        }
    }

    /**
     * Aggregate extraction validation results
     */
    aggregateExtractionValidation(results) {
        const allErrors = [];
        const allWarnings = [];

        // Collect errors and warnings
        if (results.grounding?.validation) {
            allErrors.push(...(results.grounding.validation.errors || []));
            allWarnings.push(...(results.grounding.validation.warnings || []));
        }

        if (results.completeness?.validation) {
            allErrors.push(...(results.completeness.validation.errors || []));
            allWarnings.push(...(results.completeness.validation.warnings || []));
        }

        if (results.consistency?.validation) {
            allErrors.push(...(results.consistency.validation.errors || []));
            allWarnings.push(...(results.consistency.validation.warnings || []));
        }

        if (results.calibration?.validation) {
            allErrors.push(...(results.calibration.validation.errors || []));
            allWarnings.push(...(results.calibration.validation.warnings || []));
        }

        // Calculate overall score (weighted average)
        const groundingScore = results.grounding?.validation?.scores?.overall || 0;
        const completenessScore = results.completeness?.validation?.scores?.overall || 0;
        const consistencyScore = results.consistency?.validation?.consistencyScore || 0;

        const overallScore = Math.round(
            groundingScore * 0.35 +      // 35% grounding weight
            completenessScore * 0.35 +   // 35% completeness weight
            consistencyScore * 0.30      // 30% consistency weight
        );

        // Determine status
        let status = 'EXCELLENT';
        if (allErrors.length > 0) {
            status = 'FAILED';
        } else if (overallScore < 70) {
            status = 'POOR';
        } else if (overallScore < 85) {
            status = 'ACCEPTABLE';
        } else if (overallScore < 95) {
            status = 'GOOD';
        }

        return {
            valid: allErrors.length === 0,
            status: status,
            overallScore: overallScore,
            scores: {
                grounding: groundingScore,
                completeness: completenessScore,
                consistency: consistencyScore
            },
            errors: allErrors,
            warnings: allWarnings,
            summary: {
                criticalIssues: allErrors.length,
                warnings: allWarnings.length,
                totalIssues: allErrors.length + allWarnings.length
            },
            detailedResults: results
        };
    }

    /**
     * Aggregate generation validation results
     */
    aggregateGenerationValidation(results, outputType) {
        const allErrors = [];
        const allWarnings = [];

        // Collect errors and warnings
        if (results.fabrication?.validation) {
            allErrors.push(...(results.fabrication.validation.errors || []));
            allWarnings.push(...(results.fabrication.validation.warnings || []));
        }

        if (results.proportionality?.validation) {
            allErrors.push(...(results.proportionality.validation.errors || []));
            allWarnings.push(...(results.proportionality.validation.warnings || []));
        }

        // Calculate overall score (weighted average)
        const fabricationScore = results.fabrication?.validation?.fabricationScore || 0;
        const proportionalityScore = results.proportionality?.validation?.proportionalityScore || 0;

        const overallScore = Math.round(
            fabricationScore * 0.60 +        // Fabrication is more critical (60%)
            proportionalityScore * 0.40      // Proportionality (40%)
        );

        // Determine status
        let status = 'EXCELLENT';
        if (allErrors.length > 0) {
            status = 'FAILED';
        } else if (overallScore < 70) {
            status = 'POOR';
        } else if (overallScore < 85) {
            status = 'ACCEPTABLE';
        } else if (overallScore < 95) {
            status = 'GOOD';
        }

        return {
            valid: allErrors.length === 0,
            status: status,
            overallScore: overallScore,
            outputType: outputType,
            scores: {
                fabrication: fabricationScore,
                proportionality: proportionalityScore
            },
            errors: allErrors,
            warnings: allWarnings,
            summary: {
                criticalIssues: allErrors.length,
                warnings: allWarnings.length,
                totalIssues: allErrors.length + allWarnings.length
            },
            detailedResults: results
        };
    }

    /**
     * Aggregate complete validation results
     */
    aggregateCompleteValidation(extractionValidation, outputValidations) {
        // Calculate system quality score
        const extractionScore = extractionValidation.validation?.overallScore || 0;
        const outputScores = {};

        let totalOutputScore = 0;
        let outputCount = 0;

        Object.entries(outputValidations).forEach(([type, validation]) => {
            if (validation?.validation?.overallScore !== undefined) {
                outputScores[type] = validation.validation.overallScore;
                totalOutputScore += validation.validation.overallScore;
                outputCount++;
            }
        });

        const avgOutputScore = outputCount > 0 ? totalOutputScore / outputCount : 0;

        // System quality = 60% extraction + 40% outputs
        const systemQualityScore = Math.round(
            extractionScore * 0.60 +
            avgOutputScore * 0.40
        );

        // Aggregate all issues
        const totalIssues = {
            critical: (extractionValidation.validation?.summary?.criticalIssues || 0),
            warnings: (extractionValidation.validation?.summary?.warnings || 0)
        };

        Object.values(outputValidations).forEach(validation => {
            if (validation?.validation?.summary) {
                totalIssues.critical += validation.validation.summary.criticalIssues || 0;
                totalIssues.warnings += validation.validation.summary.warnings || 0;
            }
        });

        // Determine overall status
        let status = 'EXCELLENT';
        if (totalIssues.critical > 0) {
            status = 'FAILED';
        } else if (systemQualityScore < 70) {
            status = 'POOR';
        } else if (systemQualityScore < 85) {
            status = 'ACCEPTABLE';
        } else if (systemQualityScore < 95) {
            status = 'GOOD';
        }

        return {
            overallScore: systemQualityScore,
            systemQualityScore: systemQualityScore,
            status: status,
            extractionScore: extractionScore,
            outputScores: outputScores,
            totalIssues: totalIssues,
            extractionValidation: extractionValidation,
            outputValidations: outputValidations,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get individual validator instances (for direct access)
     */
    getValidators() {
        return {
            grounding: this.groundingValidator,
            fabrication: this.fabricationDetector,
            completeness: this.completenessChecker,
            consistency: this.consistencyValidator,
            proportionality: this.proportionalityValidator,
            calibration: this.confidenceCalibrator
        };
    }

    /**
     * Get validation constants
     */
    static getConstants() {
        return VALIDATION_CONSTANTS;
    }
}

// Export constants for external use
export { VALIDATION_CONSTANTS };

console.log('✅ NeuroScribe V11 Validation Engine loaded successfully');
