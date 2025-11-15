# NeuroScribe V11 Migration Checklist

## Pre-Migration Backup
- [ ] Create backup folder: `neuroscribe-v10-backup/`
- [ ] Copy current `index.html` to backup
- [ ] Test backup file works correctly
- [ ] Commit to version control if using Git

## Day 1: Foundation Setup (2 hours)

### Morning Session (1 hour)
- [ ] Create new folder: `neuroscribe-v11/`
- [ ] Copy these ready-to-use files:
  - [ ] `app-state.js` (state management)
  - [ ] `ui-components.js` (UI controller)
  - [ ] `main.js` (application orchestrator)
- [ ] Create placeholder files:
  - [ ] `validation-engine.js`
  - [ ] `clinical-scales.js`
  - [ ] `api-client.js`
  - [ ] `neuroscribe.css`

### Afternoon Session (1 hour)
- [ ] Extract CSS from `index.html`:
  ```javascript
  // Find all <style> tags
  // Copy content to neuroscribe.css
  // Remove <style> tags from HTML
  ```
- [ ] Create minimal `index.html`:
  - [ ] Remove all JavaScript from `<script>` tags
  - [ ] Add: `<script type="module" src="main.js"></script>`
  - [ ] Add: `<link rel="stylesheet" href="neuroscribe.css">`
- [ ] Test that page loads without errors

## Day 2: Extract Validation Engine (3 hours)

### Validation Classes to Extract
- [ ] Copy to `validation-engine.js`:
  - [ ] `class SourceGroundingValidator` (~500 lines)
  - [ ] `class FabricationDetector` (~1000 lines)
  - [ ] `class CompletenessChecker` (~400 lines)
  - [ ] `class ConsistencyValidator` (~400 lines)
  - [ ] `class ProportionalityChecker` (~300 lines)
  - [ ] `class ConfidenceCalibrator` (~200 lines)  
  - [ ] `class BlacklistFirewall` (~300 lines)
  - [ ] `class InteractiveResolver` (~400 lines)

### Add Module Structure
- [ ] Wrap in module pattern:
  ```javascript
  // At the top
  export class ValidationEngine { /*...*/ }
  
  // Individual validators
  class SourceGroundingValidator { /*...*/ }
  // ... other validators ...
  
  // At the bottom
  export { 
    SourceGroundingValidator,
    FabricationDetector,
    // ... other exports
  };
  ```

### Test Validation Module
- [ ] Create simple test in browser console:
  ```javascript
  import { ValidationEngine } from './validation-engine.js';
  const validator = new ValidationEngine();
  console.log('Validator loaded:', validator);
  ```

## Day 3: Extract Clinical Components (2 hours)

### Extract Clinical Scales
- [ ] Copy to `clinical-scales.js`:
  - [ ] mJOA scale definition
  - [ ] Nurick scale definition
  - [ ] NDI scale definition
  - [ ] ODI scale definition
  - [ ] VAS scale definition
  - [ ] GCS scale definition
  - [ ] Scale calculation functions
  - [ ] Scale storage/retrieval functions

### Extract API Client
- [ ] Copy to `api-client.js`:
  - [ ] Gemini API configuration
  - [ ] Rate limiter class
  - [ ] API call functions
  - [ ] Prompt building logic
  - [ ] Response parsing

### Add Export Statements
- [ ] Clinical scales:
  ```javascript
  export class ClinicalScales { /*...*/ }
  export const scalesDatabase = { /*...*/ };
  ```
- [ ] API client:
  ```javascript
  export class GeminiClient { /*...*/ }
  export class RateLimiter { /*...*/ }
  ```

## Day 4: Integration & Testing (3 hours)

### Connect All Modules
- [ ] Update `main.js` imports:
  ```javascript
  import { ValidationEngine } from './validation-engine.js';
  import { ClinicalScales } from './clinical-scales.js';
  import { GeminiClient } from './api-client.js';
  ```

### Test Core Functions
- [ ] Test note generation:
  - [ ] Enter test transcript
  - [ ] Click generate
  - [ ] Verify note appears
- [ ] Test validation:
  - [ ] Run validation on generated note
  - [ ] Verify 8 layers execute
  - [ ] Check validation scores display
- [ ] Test clinical scales:
  - [ ] Open scale calculator
  - [ ] Enter test values
  - [ ] Verify calculation works

### Fix Integration Issues
- [ ] Check browser console for errors
- [ ] Fix any missing exports/imports
- [ ] Ensure all event listeners attached
- [ ] Verify state updates propagate to UI

## Day 5: Polish & Documentation (2 hours)

### Create Test Suite
- [ ] Create `test.html`:
  ```html
  <!DOCTYPE html>
  <html>
  <head>
      <title>NeuroScribe Tests</title>
      <link rel="stylesheet" href="https://code.jquery.com/qunit/qunit-2.20.0.css">
  </head>
  <body>
      <div id="qunit"></div>
      <script src="https://code.jquery.com/qunit/qunit-2.20.0.js"></script>
      <script type="module" src="tests.js"></script>
  </body>
  </html>
  ```

- [ ] Write core tests in `tests.js`:
  - [ ] State management test
  - [ ] Validation engine test
  - [ ] Clinical scales test
  - [ ] UI controller test

### Update Documentation
- [ ] Update README.md:
  - [ ] New architecture diagram
  - [ ] Module descriptions
  - [ ] Updated line counts
- [ ] Create MIGRATION.md:
  - [ ] Migration steps taken
  - [ ] Lessons learned
  - [ ] Performance improvements

### Performance Verification
- [ ] Measure load time:
  ```javascript
  // In browser console
  performance.timing.loadEventEnd - performance.timing.navigationStart
  ```
- [ ] Check file sizes:
  ```bash
  ls -lah *.js
  # Each should be <200KB
  ```
- [ ] Verify zero dependencies:
  ```bash
  # Should return nothing
  grep -r "require\|import.*from.*node_modules" *.js
  ```

## Post-Migration Validation

### Functional Testing
- [ ] All 8 validation layers work
- [ ] Clinical scales calculate correctly
- [ ] Note generation produces quality output
- [ ] Export formats work (DOAP, ULTRATHINK)
- [ ] Auto-save functions
- [ ] Keyboard shortcuts work

### Security Verification
- [ ] API key NOT in localStorage
- [ ] API key clears on tab close
- [ ] No sensitive data persisted
- [ ] Input sanitization in place

### Performance Metrics
- [ ] Page load: < 2 seconds
- [ ] Note generation: < 30 seconds
- [ ] Validation: < 5 seconds
- [ ] Each JS file: < 200KB

### Browser Compatibility
- [ ] Chrome/Edge: Full functionality
- [ ] Firefox: All except voice
- [ ] Safari: All except voice
- [ ] Works offline (except API calls)
- [ ] Runs from file:// protocol

## Rollback Plan

If issues arise:
1. [ ] Copy backup `index.html` back
2. [ ] Document what failed
3. [ ] Try migration again with smaller steps

## Success Criteria

✅ **Migration successful when:**
- Same functionality as V10.2.4
- Code split into 6-8 files
- Each file < 3,000 lines
- Zero build process required
- Runs from local file/USB
- All tests pass

## Celebration Checklist

When complete:
- [ ] Take screenshot of new structure
- [ ] Calculate lines saved (16,647 → ~3,000 per file)
- [ ] Run performance comparison
- [ ] Share success with team
- [ ] Plan next features for V12

## Quick Commands Reference

```bash
# Check line counts
wc -l *.js *.html *.css

# Test in browser
open index.html

# Run tests
open test.html

# Check for dependencies (should be empty)
grep -h "require\|from.*node_modules" *.js

# Create backup
cp -r neuroscribe-v11 neuroscribe-v11-backup-$(date +%Y%m%d)
```

## Troubleshooting Guide

### "Cannot use import statement"
- Ensure `<script type="module">` in HTML
- Check file is served via HTTP or file://

### "Module not found"
- Check file paths (use ./ for relative)
- Ensure .js extension included
- Verify export/import names match

### "Validation not working"
- Check ValidationEngine initialized
- Verify all 8 layers exported
- Check console for specific layer errors

### "UI not updating"
- Verify state subscriptions active
- Check UIController initialized
- Ensure DOM elements exist

## Notes Section

```
Migration started: ___________
Migration completed: ___________
Total time: ___________
Issues encountered:
_________________________________
_________________________________
_________________________________

Performance improvements:
Before: ___________
After: ___________

Lines of code:
Before: 16,647 (single file)
After: ___________
```

---

**Remember**: The goal is maintainability WITHOUT sacrificing the zero-dependency portability that makes NeuroScribe valuable in clinical settings. Take your time, test thoroughly, and celebrate the improved architecture! 🎉