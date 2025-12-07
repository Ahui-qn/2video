# Tech Stack

## Frontend
- **React 19** with TypeScript
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library
- **Socket.IO Client** - Real-time collaboration

## Backend
- **Express 5** - REST API server
- **Socket.IO** - WebSocket server for real-time sync
- **SQLite3** - Database for projects and users
- **bcryptjs** - Password hashing
- **jsonwebtoken** - Authentication

## AI/ML Services
- **Google Gemini AI** (@google/genai) - Primary LLM for script analysis
- Support for multiple providers: DeepSeek, OpenAI, Moonshot

## File Processing
- **mammoth** - DOCX parsing
- **pdfjs-dist** - PDF parsing

## Testing
- **Vitest** - Test runner
- **@testing-library/react** - Component testing
- **jsdom** - DOM environment for tests

## Build Configuration
- TypeScript with ES2022 target
- ESNext modules with bundler resolution
- Path alias: `@/*` maps to project root
- Dev server runs on port 3000
- API server runs on port 3001

## Common Commands

```bash
# Development
npm run dev              # Start Vite dev server (port 3000)
node server/index.js     # Start API server (port 3001)

# Build
npm run build            # Production build

# Testing
npm test                 # Run tests once
npm run test:watch       # Run tests in watch mode

# Preview
npm run preview          # Preview production build
```

## Environment Variables
- `GEMINI_API_KEY` - Required for AI analysis (set in .env)
