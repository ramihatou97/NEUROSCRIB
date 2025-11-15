# DCAPP → NeuroScribe Porting Guide

## Quick Reference: Python to JavaScript Patterns

### 1. Regex Patterns (Direct Port)

```python
# Python (DCAPP)
age_pattern = re.compile(r'(\d{1,3})\s*(?:year|yr|y)[\s-]*old', re.IGNORECASE)
matches = age_pattern.findall(text)
```

```javascript
// JavaScript (NeuroScribe)
const agePattern = /(\d{1,3})\s*(?:year|yr|y)[\s-]*old/gi;
const matches = text.match(agePattern) || [];
```

### 2. Entity Classes

```python
# Python (DCAPP)
class MedicalEntity:
    def __init__(self, entity_type, value, position):
        self.type = entity_type
        self.value = value
        self.position = position
        self.confidence = 0.0
    
    def validate(self, source_text):
        return self.value.lower() in source_text.lower()
```

```javascript
// JavaScript (NeuroScribe)
class MedicalEntity {
    constructor(type, value, position) {
        this.type = type;
        this.value = value;
        this.position = position;
        this.confidence = 0.0;
    }
    
    validate(sourceText) {
        return sourceText.toLowerCase().includes(this.value.toLowerCase());
    }
}
```

### 3. List Comprehensions → Array Methods

```python
# Python (DCAPP)
critical_meds = [med for med in medications if med.dose > med.max_dose]
high_values = [lab for lab in labs if lab.value > lab.upper_limit]
```

```javascript
// JavaScript (NeuroScribe)
const criticalMeds = medications.filter(med => med.dose > med.maxDose);
const highValues = labs.filter(lab => lab.value > lab.upperLimit);
```

### 4. Dictionary Operations → Object/Map

```python
# Python (DCAPP)
lab_ranges = {
    'sodium': {'low': 135, 'high': 145, 'unit': 'mEq/L'},
    'potassium': {'low': 3.5, 'high': 5.0, 'unit': 'mEq/L'}
}

for lab_name, ranges in lab_ranges.items():
    if value < ranges['low'] or value > ranges['high']:
        alert(f"{lab_name} out of range")
```

```javascript
// JavaScript (NeuroScribe)
const labRanges = {
    sodium: { low: 135, high: 145, unit: 'mEq/L' },
    potassium: { low: 3.5, high: 5.0, unit: 'mEq/L' }
};

Object.entries(labRanges).forEach(([labName, ranges]) => {
    if (value < ranges.low || value > ranges.high) {
        alert(`${labName} out of range`);
    }
});
```

### 5. Pattern Matching → Switch/Object Lookup

```python
# Python (DCAPP)
def get_severity(score):
    if score >= 90: return 'CRITICAL'
    elif score >= 70: return 'HIGH'
    elif score >= 50: return 'MEDIUM'
    else: return 'LOW'
```

```javascript
// JavaScript (NeuroScribe)
function getSeverity(score) {
    if (score >= 90) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    return 'LOW';
}

// Or using object lookup
const severityThresholds = [
    { min: 90, level: 'CRITICAL' },
    { min: 70, level: 'HIGH' },
    { min: 50, level: 'MEDIUM' },
    { min: 0, level: 'LOW' }
];

const getSeverity = (score) => 
    severityThresholds.find(t => score >= t.min).level;
```

## Key DCAPP Algorithms to Port

### 1. Fabrication Detector Core Logic

```python
# Python (DCAPP - fabricationDetector.py)
def detect_fabrications(generated_text, source_data):
    entities_generated = extract_entities(generated_text)
    entities_source = extract_entities(source_data)
    
    fabrications = []
    for entity in entities_generated:
        if not verify_entity(entity, entities_source):
            risk_score = calculate_risk(entity)
            fabrications.append({
                'entity': entity,
                'risk': risk_score,
                'type': entity.type
            })
    
    return fabrications
```

```javascript
// JavaScript (NeuroScribe)
function detectFabrications(generatedText, sourceData) {
    const entitiesGenerated = extractEntities(generatedText);
    const entitiesSource = extractEntities(sourceData);
    
    const fabrications = [];
    for (const entity of entitiesGenerated) {
        if (!verifyEntity(entity, entitiesSource)) {
            const riskScore = calculateRisk(entity);
            fabrications.push({
                entity: entity,
                risk: riskScore,
                type: entity.type
            });
        }
    }
    
    return fabrications;
}
```

### 2. Clinical Rule Pattern

```python
# Python (DCAPP - clinical_rules.py)
class DVTProphylaxisRule:
    def detect(self, clinical_data):
        has_surgery = bool(re.search(r'surgery|craniotomy', clinical_data.text))
        has_prophylaxis = bool(re.search(r'heparin|lovenox', clinical_data.text))
        
        if has_surgery and not has_prophylaxis:
            return Alert(
                severity='HIGH',
                message='Missing DVT prophylaxis post-surgery'
            )
        return None
```

```javascript
// JavaScript (NeuroScribe)
class DVTProphylaxisRule {
    detect(clinicalData) {
        const hasSurgery = /surgery|craniotomy/i.test(clinicalData.text);
        const hasProphylaxis = /heparin|lovenox/i.test(clinicalData.text);
        
        if (hasSurgery && !hasProphylaxis) {
            return {
                severity: 'HIGH',
                message: 'Missing DVT prophylaxis post-surgery'
            };
        }
        return null;
    }
}
```

### 3. Temporal Extraction

```python
# Python (DCAPP - temporal_reasoning.py)
def extract_pod_references(text):
    pod_pattern = r'POD\s*#?\s*(\d+)'
    matches = re.finditer(pod_pattern, text, re.IGNORECASE)
    
    references = []
    for match in matches:
        references.append({
            'day': int(match.group(1)),
            'position': match.start(),
            'text': match.group(0)
        })
    
    return references
```

```javascript
// JavaScript (NeuroScribe)
function extractPODReferences(text) {
    const podPattern = /POD\s*#?\s*(\d+)/gi;
    const references = [];
    
    let match;
    while ((match = podPattern.exec(text)) !== null) {
        references.push({
            day: parseInt(match[1]),
            position: match.index,
            text: match[0]
        });
    }
    
    return references;
}
```

## Critical Patterns to Preserve

### 1. Entity Extraction Patterns (Exact Port)

These regex patterns are language-agnostic and should be copied exactly:

```javascript
// From DCAPP - These work identically in JavaScript
const patterns = {
    // Medications with doses
    medication: /(\w+)\s+(\d+\.?\d*)\s*(mg|mcg|g|ml|units?)/gi,
    
    // Lab values
    labValue: /(sodium|na|potassium|k|hemoglobin|hgb|wbc|platelets?|plt)\s*[:=]?\s*(\d+\.?\d*)/gi,
    
    // Dates and times
    pod: /POD\s*#?\s*(\d+)/gi,
    hospitalDay: /(?:HD|hospital\s*day)\s*#?\s*(\d+)/gi,
    
    // Procedures
    procedure: /(craniotomy|craniectomy|laminectomy|fusion|ventriculostomy|EVD|shunt)/gi,
    
    // Anatomical locations
    anatomy: /(frontal|parietal|temporal|occipital|C\d|T\d|L\d|S\d)/gi,
    
    // Clinical scores
    scores: /(?:GCS|NIHSS|mRS|hunt.?hess)\s*(?:of|score|:|=)?\s*(\d{1,2})/gi
};
```

### 2. Risk Scoring Logic (Direct Port)

```javascript
// From DCAPP - Preserve exact thresholds
const riskScores = {
    medication: {
        wrongDose: 0.9,      // CRITICAL
        wrongRoute: 0.8,     // HIGH
        wrongFrequency: 0.6  // MEDIUM
    },
    laboratory: {
        criticalValue: 1.0,  // CRITICAL (e.g., K+ = 6.5)
        abnormalValue: 0.7,  // HIGH
        borderlineValue: 0.4 // LOW
    },
    temporal: {
        impossibleSequence: 0.9, // CRITICAL
        inconsistentDates: 0.7,  // HIGH
        ambiguousTime: 0.3       // LOW
    }
};
```

### 3. Clinical Rules (Exact Logic)

```javascript
// From DCAPP - Preserve clinical decision thresholds
const clinicalRules = {
    sodiumCorrection: {
        maxDaily: 10,  // mEq/L per 24h
        critical: 12,  // Risk of ODS
        message: 'Rapid sodium correction - ODS risk'
    },
    
    dvtProphylaxis: {
        requiresFor: ['surgery', 'craniotomy', 'immobile', 'paralysis'],
        acceptableProphylaxis: ['heparin', 'lovenox', 'enoxaparin', 'SCD', 'TED'],
        message: 'DVT prophylaxis required but not documented'
    },
    
    seizureProphylaxis: {
        requiresFor: ['tumor', 'hemorrhage', 'trauma', 'craniotomy'],
        acceptableMeds: ['levetiracetam', 'keppra', 'phenytoin', 'dilantin'],
        message: 'Seizure prophylaxis indicated but not documented'
    }
};
```

## Testing Equivalence

### Create Parallel Test Cases

```javascript
// test-cases.js - Run same tests on both DCAPP and NeuroScribe

const testCases = [
    {
        name: 'Medication dose fabrication',
        source: 'Patient on levetiracetam 500mg BID',
        generated: 'Patient on levetiracetam 1000mg TID',
        expectedFabrication: true,
        expectedRisk: 'HIGH'
    },
    {
        name: 'POD mismatch',
        source: 'Surgery on 1/1/2024',
        generated: 'POD#3 on 1/2/2024',  // Should be POD#1
        expectedConflict: true,
        expectedType: 'temporal'
    },
    {
        name: 'Missing DVT prophylaxis',
        text: 'POD#2 from craniotomy. Ambulating with assistance.',
        expectedAlert: 'DVT_001',
        expectedSeverity: 'HIGH'
    }
];

// Run against both systems
testCases.forEach(testCase => {
    const dcappResult = runDCAPP(testCase);
    const neuroResult = runNeuroScribe(testCase);
    
    assertEqual(dcappResult, neuroResult, testCase.name);
});
```

## Common Pitfalls & Solutions

### 1. Regex Flag Differences
```javascript
// Python re.IGNORECASE → JavaScript 'i' flag
// Python re.MULTILINE → JavaScript 'm' flag
// Python re.DOTALL → JavaScript 's' flag (ES2018+)
```

### 2. String Methods
```javascript
// Python: text.lower() → JavaScript: text.toLowerCase()
// Python: text.strip() → JavaScript: text.trim()
// Python: text.startswith('x') → JavaScript: text.startsWith('x')
```

### 3. Type Checking
```javascript
// Python: isinstance(x, str) → JavaScript: typeof x === 'string'
// Python: isinstance(x, list) → JavaScript: Array.isArray(x)
// Python: isinstance(x, dict) → JavaScript: typeof x === 'object' && x !== null
```

### 4. Null/None Handling
```javascript
// Python: if value is None → JavaScript: if (value === null || value === undefined)
// Python: value or default → JavaScript: value || defaultValue
// Python: value.get('key', default) → JavaScript: value.key ?? defaultValue
```

## Validation Checklist

Before considering any algorithm successfully ported:

- [ ] All regex patterns produce identical matches
- [ ] Risk scores match exactly
- [ ] Clinical thresholds unchanged
- [ ] Test cases pass with same results
- [ ] Performance within 10% of Python version
- [ ] No runtime errors on edge cases
- [ ] Memory usage comparable

## Final Notes

1. **Start with regex patterns** - They're language-agnostic
2. **Preserve exact thresholds** - Clinical values are critical
3. **Test against known cases** - Use DCAPP's test suite
4. **Maintain clinical logic** - Don't "optimize" medical rules
5. **Document deviations** - If any changes needed, document why

The goal is functional equivalence, not line-by-line translation. Focus on preserving the clinical intelligence while adapting to JavaScript idioms.