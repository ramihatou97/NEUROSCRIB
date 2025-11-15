# NeuroScribe

A modular, zero-dependency clinical documentation application built with native ES modules.

## Overview

NeuroScribe V11 is a modern clinical documentation system designed with portability and maintainability in mind. It uses zero external dependencies and native ES modules to provide a clean, modular architecture for generating and managing clinical notes.

## Key Features

- **Zero Dependencies**: Built entirely with native JavaScript - no npm packages required
- **Modular Architecture**: Clean separation of concerns with ES modules
- **State Management**: Built-in pub/sub pattern with undo/redo support
- **Clinical Scales**: Integrated clinical assessment tools
- **Validation Engine**: Real-time content validation
- **Modern UI**: Responsive interface with toast notifications, modals, and progress tracking

## Architecture

The application follows a modular design with three key components:

### 1. State Management (`app-state.js`)
- Pub/sub pattern for reactive updates
- Undo/redo with history tracking
- Computed values (derived state)
- Actions (encapsulated mutations)
- Deep merge for nested objects
- Async state waiting

### 2. UI Controller (`ui-components.js`)
- Centralized DOM element caching
- Loading states and progress bars
- Toast notifications (success/error/warning)
- Modal management
- Form management
- Animation utilities

### 3. Core Application (`main.js`)
- Application initialization
- Service coordination
- Event handling
- Business logic orchestration

## Project Structure

```
NEUROSCRIB/
├── files/              # Core application files
│   ├── main.js
│   ├── app-state.js
│   └── ui-components.js
├── files 2/            # Integration documentation
│   ├── dcapp-to-neuroscribe-porting-guide.md
│   ├── neuroscribe-dcapp-integration-plan.md
│   └── neuroscribe-dcapp-strategic-assessment.md
├── files 3/            # Implementation documentation
│   ├── neuroscribe-v11-implementation-summary.md
│   ├── neuroscribe-implementation-guide.md
│   ├── neuroscribe-v11-migration-checklist.md
│   └── day-0-preparation-checklist.md
└── .gitignore
```

## Documentation

The project includes comprehensive documentation:

- **Implementation Summary**: Overview of V11 architecture and refinements
- **Migration Checklist**: Step-by-step guide for upgrading
- **Integration Plans**: DCAPP integration strategies
- **Assessment Reports**: Technical analysis and recommendations

## Getting Started

Since this is a zero-dependency project, you can run it directly in a modern browser:

1. Clone the repository
   ```bash
   git clone https://github.com/ramihatou97/NEUROSCRIB.git
   cd NEUROSCRIB
   ```

2. Serve the files with any local server
   ```bash
   # Using Python 3
   python -m http.server 8000

   # Using Node.js http-server
   npx http-server
   ```

3. Open your browser to the local server address

## Browser Compatibility

Requires a modern browser with ES module support:
- Chrome/Edge 61+
- Firefox 60+
- Safari 11+

## License

This project is open source and available for use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
