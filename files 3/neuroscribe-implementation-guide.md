# NeuroScribe V10.2.4 - Technical Implementation Guide

## Priority 1: Breaking the Monolith (Week 1)

### Step 1: Create Project Structure

```bash
# Create modular structure
mkdir -p neuroscribe-refactored/{src,tests,docs,public,config}
mkdir -p neuroscribe-refactored/src/{core,validation,scales,api,ui,utils}
mkdir -p neuroscribe-refactored/src/validation/{layers,detectors,resolvers}
```

### Step 2: Extract Validation Engine

```javascript
// src/validation/ValidationEngine.js
export class ValidationEngine {
    constructor(config = {}) {
        this.config = {
            enableSemanticOnly: false,
            enableTermBased: true,
            confidenceThreshold: 0.7,
            ...config
        };
        
        this.layers = new Map();
        this.initializeLayers();
    }
    
    initializeLayers() {
        // Import validation layers dynamically
        this.layers.set('sourceGrounding', new SourceGroundingValidator());
        this.layers.set('fabrication', new FabricationDetector(this.config));
        this.layers.set('completeness', new CompletenessChecker());
        this.layers.set('consistency', new ConsistencyValidator());
        this.layers.set('proportionality', new ProportionalityChecker());
        this.layers.set('confidence', new ConfidenceCalibrator());
        this.layers.set('blacklist', new BlacklistFirewall());
        this.layers.set('interactive', new InteractiveResolver());
    }
    
    async validate(content, options = {}) {
        const startTime = performance.now();
        const results = new Map();
        
        // Run validation layers in parallel where possible
        const parallelLayers = ['sourceGrounding', 'fabrication', 'completeness'];
        const parallelResults = await Promise.all(
            parallelLayers.map(layer => 
                this.runLayer(layer, content, options)
            )
        );
        
        parallelLayers.forEach((layer, index) => {
            results.set(layer, parallelResults[index]);
        });
        
        // Run sequential layers that depend on previous results
        const sequentialLayers = ['consistency', 'proportionality', 'confidence'];
        for (const layer of sequentialLayers) {
            results.set(layer, await this.runLayer(layer, content, {
                ...options,
                previousResults: results
            }));
        }
        
        // Calculate overall score
        const score = this.calculateOverallScore(results);
        
        return {
            score,
            duration: performance.now() - startTime,
            layers: Object.fromEntries(results),
            timestamp: new Date().toISOString()
        };
    }
    
    async runLayer(layerName, content, options) {
        const layer = this.layers.get(layerName);
        if (!layer) {
            console.warn(`Layer ${layerName} not found`);
            return null;
        }
        
        try {
            return await layer.validate(content, options);
        } catch (error) {
            console.error(`Error in layer ${layerName}:`, error);
            return {
                error: true,
                message: error.message,
                layer: layerName
            };
        }
    }
    
    calculateOverallScore(results) {
        const weights = {
            sourceGrounding: 0.25,
            fabrication: 0.25,
            completeness: 0.20,
            consistency: 0.15,
            proportionality: 0.10,
            confidence: 0.05
        };
        
        let totalScore = 0;
        let totalWeight = 0;
        
        for (const [layer, result] of results) {
            if (result && !result.error && weights[layer]) {
                totalScore += (result.score || 0) * weights[layer];
                totalWeight += weights[layer];
            }
        }
        
        return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
    }
}
```

### Step 3: Extract Fabrication Detector

```javascript
// src/validation/detectors/FabricationDetector.js
export class FabricationDetector {
    constructor(config = {}) {
        this.semanticOnlyMode = config.enableSemanticOnly || false;
        this.confidenceThreshold = config.confidenceThreshold || 0.7;
        this.apiClient = new GeminiClient(config.apiKey);
    }
    
    async validate(content, options = {}) {
        const { originalText, generatedText, extractedData } = content;
        
        // V10.2.4: Use semantic-only for ULTRATHINK mode
        if (this.isUltrathinkMode(generatedText) || this.semanticOnlyMode) {
            return this.semanticOnlyDetection(content, options);
        }
        
        // Hybrid mode for standard notes
        return this.hybridDetection(content, options);
    }
    
    async semanticOnlyDetection(content, options) {
        const statements = this.extractStatements(content.generatedText);
        const fabrications = [];
        
        // Batch process statements for efficiency
        const batchSize = 5;
        for (let i = 0; i < statements.length; i += batchSize) {
            const batch = statements.slice(i, i + batchSize);
            const results = await this.checkBatchWithAI(batch, content.originalText);
            
            results.forEach((result, index) => {
                if (result.fabricated && result.confidence >= this.confidenceThreshold) {
                    fabrications.push({
                        statement: batch[index],
                        statementIndex: i + index,
                        confidence: result.confidence,
                        reason: result.reason,
                        fixOptions: this.generateFixOptions(batch[index], content.originalText)
                    });
                }
            });
        }
        
        return {
            score: this.calculateScore(statements.length, fabrications.length),
            fabrications,
            mode: 'semantic-only',
            totalStatements: statements.length
        };
    }
    
    async hybridDetection(content, options) {
        // Implement hybrid detection logic
        const termBasedResults = this.termBasedDetection(content);
        const semanticResults = await this.semanticOnlyDetection(content, options);
        
        // Merge results with semantic taking precedence
        return this.mergeResults(termBasedResults, semanticResults);
    }
    
    generateFixOptions(statement, sourceText) {
        // Generate 2-3 alternative corrections
        const fixes = [];
        
        // Option 1: Remove the statement entirely
        fixes.push({
            type: 'remove',
            description: 'Remove this statement',
            action: () => ''
        });
        
        // Option 2: Replace with factual content from source
        const relevantSource = this.findRelevantSource(statement, sourceText);
        if (relevantSource) {
            fixes.push({
                type: 'replace',
                description: 'Replace with source content',
                action: () => this.rephrase(relevantSource)
            });
        }
        
        // Option 3: Soften the claim
        fixes.push({
            type: 'soften',
            description: 'Make claim less definitive',
            action: () => this.softenClaim(statement)
        });
        
        return fixes;
    }
    
    isUltrathinkMode(text) {
        const ultrathinkMarkers = ['ULTRATHINK:', 'DOAP:', 'COMPRESSED:'];
        return ultrathinkMarkers.some(marker => text.includes(marker));
    }
    
    calculateScore(total, fabricated) {
        if (total === 0) return 100;
        return Math.max(0, 100 - (fabricated / total) * 100);
    }
}
```

### Step 4: Create Secure API Client

```javascript
// src/api/SecureAPIClient.js
export class SecureAPIClient {
    constructor() {
        // Never store API keys in frontend
        this.baseURL = process.env.REACT_APP_API_URL || '/api';
        this.sessionToken = null;
    }
    
    async initialize() {
        // Get session token from backend
        const response = await fetch(`${this.baseURL}/auth/session`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to initialize session');
        }
        
        const data = await response.json();
        this.sessionToken = data.sessionToken;
        
        // Set up token refresh
        this.setupTokenRefresh(data.expiresIn);
    }
    
    setupTokenRefresh(expiresIn) {
        // Refresh token before expiry
        const refreshTime = (expiresIn - 60) * 1000; // 1 minute before expiry
        
        setTimeout(async () => {
            await this.refreshToken();
        }, refreshTime);
    }
    
    async refreshToken() {
        const response = await fetch(`${this.baseURL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${this.sessionToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            this.sessionToken = data.sessionToken;
            this.setupTokenRefresh(data.expiresIn);
        }
    }
    
    async generateClinicalNote(data) {
        return this.makeRequest('/clinical/generate', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    async makeRequest(endpoint, options = {}) {
        if (!this.sessionToken) {
            await this.initialize();
        }
        
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.sessionToken}`,
                'X-CSRF-Token': this.getCSRFToken(),
                ...options.headers
            },
            credentials: 'include'
        });
        
        if (response.status === 401) {
            // Token expired, try refresh
            await this.refreshToken();
            return this.makeRequest(endpoint, options);
        }
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return response.json();
    }
    
    getCSRFToken() {
        // Get CSRF token from meta tag or cookie
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : this.getCookie('csrf-token');
    }
    
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
    }
}
```

### Step 5: Backend API Proxy (Node.js/Express)

```javascript
// backend/server.js
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

const app = express();

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});

app.use('/api/', limiter);

// Session management
const sessions = new Map();

class SessionManager {
    static createSession(userId) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const session = {
            userId,
            createdAt: Date.now(),
            expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
            csrfToken: crypto.randomBytes(32).toString('hex')
        };
        
        sessions.set(sessionId, session);
        return { sessionId, csrfToken: session.csrfToken };
    }
    
    static validateSession(sessionId, csrfToken) {
        const session = sessions.get(sessionId);
        
        if (!session) return false;
        if (session.expiresAt < Date.now()) {
            sessions.delete(sessionId);
            return false;
        }
        if (session.csrfToken !== csrfToken) return false;
        
        return session;
    }
}

// Authentication endpoint
app.post('/api/auth/session', async (req, res) => {
    try {
        // In production, validate user credentials here
        const { sessionId, csrfToken } = SessionManager.createSession('user-id');
        
        res.cookie('sessionId', sessionId, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000
        });
        
        res.json({
            sessionToken: sessionId,
            csrfToken,
            expiresIn: 3600
        });
    } catch (error) {
        res.status(500).json({ error: 'Session creation failed' });
    }
});

// Clinical note generation endpoint
app.post('/api/clinical/generate', async (req, res) => {
    try {
        // Validate session
        const sessionId = req.headers.authorization?.replace('Bearer ', '');
        const csrfToken = req.headers['x-csrf-token'];
        
        const session = SessionManager.validateSession(sessionId, csrfToken);
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Input validation
        const { transcript, mode, options } = req.body;
        
        if (!transcript || transcript.length > 50000) {
            return res.status(400).json({ error: 'Invalid input' });
        }
        
        // Initialize Gemini (API key from environment)
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        // Generate note with timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Generation timeout')), 30000)
        );
        
        const result = await Promise.race([
            model.generateContent(buildPrompt(transcript, mode, options)),
            timeoutPromise
        ]);
        
        // Log for audit
        console.log(`Note generated for session ${sessionId} at ${new Date().toISOString()}`);
        
        res.json({
            success: true,
            note: result.response.text(),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({ error: 'Generation failed' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`NeuroScribe API running on port ${PORT}`);
});

function buildPrompt(transcript, mode, options) {
    // Build secure, sanitized prompt
    return {
        contents: [{
            role: 'user',
            parts: [{
                text: `Generate clinical note from transcript: ${transcript.substring(0, 10000)}`
            }]
        }]
    };
}
```

### Step 6: TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@validation/*": ["src/validation/*"],
      "@scales/*": ["src/scales/*"],
      "@api/*": ["src/api/*"],
      "@ui/*": ["src/ui/*"]
    },
    "types": ["node", "jest"],
    "allowJs": true,
    "checkJs": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 7: Webpack Configuration

```javascript
// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
      clean: true
    },
    
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader']
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource'
        }
      ]
    },
    
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@validation': path.resolve(__dirname, 'src/validation'),
        '@scales': path.resolve(__dirname, 'src/scales'),
        '@api': path.resolve(__dirname, 'src/api'),
        '@ui': path.resolve(__dirname, 'src/ui')
      }
    },
    
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction
            }
          }
        })
      ],
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10
          },
          validation: {
            test: /[\\/]src[\\/]validation[\\/]/,
            name: 'validation',
            priority: 5
          },
          scales: {
            test: /[\\/]src[\\/]scales[\\/]/,
            name: 'scales',
            priority: 5
          }
        }
      },
      runtimeChunk: 'single'
    },
    
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        minify: isProduction
      }),
      
      isProduction && new CompressionPlugin({
        algorithm: 'gzip',
        test: /\.(js|css|html|svg)$/,
        threshold: 8192,
        minRatio: 0.8
      }),
      
      process.env.ANALYZE && new BundleAnalyzerPlugin()
    ].filter(Boolean),
    
    devServer: {
      static: {
        directory: path.join(__dirname, 'public')
      },
      compress: true,
      port: 3000,
      hot: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          secure: false,
          changeOrigin: true
        }
      }
    }
  };
};
```

### Step 8: Testing Setup

```javascript
// tests/validation/FabricationDetector.test.ts
import { FabricationDetector } from '@/validation/detectors/FabricationDetector';

describe('FabricationDetector', () => {
    let detector: FabricationDetector;
    
    beforeEach(() => {
        detector = new FabricationDetector({
            enableSemanticOnly: false,
            confidenceThreshold: 0.7
        });
    });
    
    describe('ULTRATHINK mode detection', () => {
        it('should use semantic-only mode for ULTRATHINK content', async () => {
            const content = {
                generatedText: 'ULTRATHINK: Patient improved significantly',
                originalText: 'Patient condition unchanged',
                extractedData: {}
            };
            
            const result = await detector.validate(content);
            
            expect(result.mode).toBe('semantic-only');
            expect(result.fabrications).toHaveLength(1);
            expect(result.fabrications[0].confidence).toBeGreaterThan(0.7);
        });
        
        it('should provide fix options for detected fabrications', async () => {
            const content = {
                generatedText: 'Patient shows dramatic improvement',
                originalText: 'Patient stable',
                extractedData: {}
            };
            
            const result = await detector.validate(content);
            
            expect(result.fabrications[0].fixOptions).toBeDefined();
            expect(result.fabrications[0].fixOptions.length).toBeGreaterThanOrEqual(2);
            expect(result.fabrications[0].fixOptions[0].type).toBeDefined();
        });
    });
    
    describe('Hybrid mode detection', () => {
        it('should use hybrid mode for standard notes', async () => {
            const detector = new FabricationDetector({
                enableSemanticOnly: false
            });
            
            const content = {
                generatedText: 'Standard clinical note content',
                originalText: 'Source material',
                extractedData: {}
            };
            
            const result = await detector.validate(content);
            expect(result.mode).not.toBe('semantic-only');
        });
    });
});

// jest.config.js
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    collectCoverageFrom: [
        'src/**/*.{js,ts}',
        '!src/**/*.d.ts',
        '!src/index.ts'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@validation/(.*)$': '<rootDir>/src/validation/$1',
        '^@scales/(.*)$': '<rootDir>/src/scales/$1',
        '^@api/(.*)$': '<rootDir>/src/api/$1',
        '^@ui/(.*)$': '<rootDir>/src/ui/$1'
    }
};
```

### Step 9: Package.json Scripts

```json
{
  "name": "neuroscribe-refactored",
  "version": "11.0.0",
  "scripts": {
    "dev": "webpack serve --mode development",
    "build": "webpack --mode production",
    "build:analyze": "ANALYZE=true npm run build",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css}\"",
    "pre-commit": "npm run lint && npm run type-check && npm run test",
    "start:backend": "node backend/server.js",
    "start:all": "concurrently \"npm run start:backend\" \"npm run dev\""
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "compression-webpack-plugin": "^10.0.0",
    "concurrently": "^8.0.0",
    "eslint": "^8.0.0",
    "html-webpack-plugin": "^5.5.0",
    "jest": "^29.5.0",
    "prettier": "^3.0.0",
    "terser-webpack-plugin": "^5.3.0",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.0",
    "typescript": "^5.0.0",
    "webpack": "^5.88.0",
    "webpack-bundle-analyzer": "^4.9.0",
    "webpack-cli": "^5.1.0",
    "webpack-dev-server": "^4.15.0"
  }
}
```

## Implementation Timeline

### Day 1-2: Setup & Structure
- Initialize new project structure
- Set up TypeScript and Webpack
- Configure testing framework

### Day 3-5: Core Extraction
- Extract ValidationEngine class
- Extract FabricationDetector
- Create modular layer system

### Day 6-7: API Security
- Implement backend proxy
- Set up session management
- Add CSRF protection

### Day 8-9: Testing
- Write unit tests for validators
- Add integration tests
- Set up CI/CD pipeline

### Day 10: Deployment
- Build production bundle
- Deploy backend service
- Update documentation

## Success Metrics

1. **Bundle Size**: < 200KB (from 786KB)
2. **Load Time**: < 2 seconds
3. **Test Coverage**: > 80%
4. **Security Score**: A+ on Mozilla Observatory
5. **Lighthouse Score**: > 90 for all metrics

## Next Steps

After completing this refactor:
1. Add service worker for offline capability
2. Implement WebAssembly for heavy computations
3. Add real-time collaboration features
4. Create mobile app with React Native
5. Add ML model fine-tuning capabilities