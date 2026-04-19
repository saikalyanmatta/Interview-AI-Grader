# AI Interviewer — Vocalize.ai

## Overview

Full-stack AI Interviewer platform with two modes: **Candidate** (voice-based interview practice) and **Employer** (define job requirements, get hire/no-hire recommendations).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (react-vite artifact)
- **Auth**: Replit Auth (OIDC + PKCE, Google login)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2 for questions/grading, TTS for interviewer voice, STT for answers)

## Structure

```text
artifacts/
  api-server/         Express API — auth, interviews, jobs, audio
  ai-interviewer/     React + Vite frontend (previewPath: /)
  interview-coach/    Placeholder scaffold moved to /interview-coach/ during feature work
  mockup-sandbox/     Design sandbox (unused in prod)
lib/
  api-spec/           OpenAPI spec + Orval codegen config
  api-client-react/   Generated React Query hooks
  api-zod/            Generated Zod schemas from OpenAPI
  db/                 Drizzle ORM schema + DB connection
  replit-auth-web/    Browser auth hook (useAuth)
  integrations-openai-ai-server/  OpenAI SDK server helpers
  integrations-openai-ai-react/   React audio recording hooks
```

## Key Features

### Candidate Mode
1. Sign in with Google (Replit Auth)
2. Upload/paste resume text → skills extracted via AI
3. Optionally select an employer-defined job profile
4. Select interview role, difficulty, and style (Friendly, Strict, Technical Deep Dive)
5. AI generates adaptive personalized questions with role-aware focus and contextual follow-ups
6. Each question is spoken aloud via TTS (OpenAI alloy voice)
7. Candidate records answer via microphone → STT transcription
8. After all questions → AI grades English fluency, behavioral STAR structure, communication clarity, confidence, and each skill (0-100)
9. Detailed report with answer-level suggested better responses and recommendation (hire/no_hire/maybe)

### Employer Mode
1. Create job profiles with title, role, description, skills with required proficiency (1-10), and skill weightage (0-100)
2. Candidates can select a job profile when starting an interview
3. Grading report shows whether candidate meets each skill requirement

## API Endpoints

- `GET /api/auth/user` — current auth state
- `GET /api/jobs` / `POST /api/jobs` — job profile CRUD
- `GET /api/interviews` / `POST /api/interviews` — interview management
- `POST /api/interviews/:id/resume` — upload resume text
- `POST /api/interviews/:id/start` — generate 8 AI questions
- `GET /api/interviews/:id/questions/:qId/audio` — TTS audio (base64 mp3)
- `POST /api/interviews/:id/answers` — submit audio answer (STT transcription)
- `POST /api/interviews/:id/complete` — grade interview, generate report
- `GET /api/interviews/:id/report` — fetch completed report

## Database Schema

- `users` — from Replit Auth (id, email, firstName, lastName, profileImageUrl)
- `sessions` — OIDC session storage
- `jobs` — employer job profiles (title, role, description, skills JSON with required level and weight)
- `interviews` — interview sessions (userId, jobId, role, difficulty, interviewStyle, status, resumeText)
- `interview_questions` — generated questions per interview
- `interview_answers` — transcribed answers per question
- `interview_reports` — grading results (englishScore, behavioralScore, communicationAnalysis, answerQualityBreakdown, skillScores, recommendation)

## Environment Variables

Auto-provisioned by Replit:
- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
- `REPLIT_DOMAINS`, `REPL_ID` (for auth)

## Development

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/ai-interviewer run dev

# Run codegen after API spec changes
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes
pnpm --filter @workspace/db run push
```

## Notes

- ElevenLabs was considered for TTS/STT but user chose OpenAI audio (Replit credits)
- OpenAI alloy voice used for TTS interviewer questions
- Audio recording uses useVoiceRecorder hook from integrations-openai-ai-react
- Web Speech API is NOT used (OpenAI audio only)
- The duplicate Interview Coach preview redirects to the real Vocalize.ai app at `/` so old preview links no longer show the scaffold build screen.
