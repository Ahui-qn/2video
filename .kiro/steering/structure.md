# Project Structure

## Root Files
- `App.tsx` - Main application component, handles routing between auth/home/workspace views
- `index.tsx` - React entry point
- `types.ts` - Shared TypeScript interfaces and types
- `index.html` - HTML entry point
- `vite.config.ts` - Vite configuration
- `vitest.config.ts` - Test configuration
- `tsconfig.json` - TypeScript configuration

## Directories

### `/components`
React components for the UI:
- `Auth.tsx` - Login/registration
- `ProjectList.tsx` - Project selection and management
- `Workspace.tsx` - Main workspace container (script editor + storyboard + assets)
- `ScriptEditor.tsx` - Episode management and script input
- `StoryboardTable.tsx` - Shot-by-shot breakdown table
- `AssetPanel.tsx` - Character and location library
- `CollaborationContext.tsx` - WebSocket context provider for real-time sync
- `CreateProjectModal.tsx` - New project creation
- `UploadScriptModal.tsx` - Script file upload
- `SettingsModal.tsx` - AI model and API key configuration
- `TeamModal.tsx` - Collaboration and sharing
- `ManualShotModal.tsx` - Manual shot creation

### `/services`
Business logic and external integrations:
- `geminiService.ts` - AI analysis logic, handles multiple LLM providers
- `fileService.ts` - File parsing (PDF, DOCX, TXT)

### `/server`
Express backend:
- `index.js` - Server entry point
- `auth.js` - Authentication routes
- `project.js` - Project CRUD routes
- `socket.js` - WebSocket event handlers
- `middleware.js` - Auth middleware
- `db.js` - SQLite database initialization
- `database.sqlite` - SQLite database file

### `/tests`
Test files:
- `api.test.js` - API endpoint tests
- `collaboration.test.ts` - Real-time collaboration tests
- `setup.ts` - Test environment setup

## Key Patterns

### State Management
- Local state with React hooks (useState, useEffect)
- Context API for collaboration (CollaborationContext)
- No external state management library

### Data Flow
1. User uploads script → `fileService` parses → stored in episode
2. User triggers analysis → `geminiService` calls AI → returns structured data
3. Structured data stored in `result` state → rendered in StoryboardTable
4. Changes broadcast via Socket.IO → synced across collaborators

### Collaboration Architecture
- WebSocket connection established in `CollaborationContext`
- Project state synced via `project-updated` events
- Debounced updates (1s) to prevent excessive broadcasts
- Remote update flag prevents sync loops

### Type System
All shared types defined in `types.ts`:
- `Project` - Project metadata and data
- `AnalysisResult` - AI analysis output structure
- `Episode`, `Scene`, `Shot` - Storyboard hierarchy
- `CharacterProfile`, `AssetProfile` - Asset library items
