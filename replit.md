# AI Interviewer — Vocalize.ai

## Overview

Full-stack AI Interviewer platform with two modes: **Candidate** (voice-based interview practice with anti-cheat) and **Employer** (schedule interviews, manage candidates, view results with XLSX export).

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
2. Schedule interviews: set start time, deadline, number of coding questions, link candidates by email
3. Candidates can enter their email at the interview access link to validate eligibility
4. Employer views results with sorting by score and XLSX export (4 sheets: Strongly Hire, Hire, No Hire, Not Attempted)

### Anti-Cheat
- Fullscreen enforced at interview start; exit = warning + logged
- Tab switch / window blur logged and shown in malpractice alerts
- Ctrl+T, Ctrl+W, Ctrl+N keyboard shortcuts blocked during interview
- Right-click disabled during active interview session

### Coding Questions
- Employers can set coding question count per scheduled interview (0–5)
- AI generates role/difficulty-appropriate questions in candidate's chosen language
- Code written in a textarea; submitted with the final interview for review

## API Endpoints

- `GET /api/auth/user` — current auth state
- `GET /api/jobs` / `POST /api/jobs` — job profile CRUD
- `GET /api/interviews` / `POST /api/interviews` — interview management (accepts scheduledInterviewId)
- `POST /api/interviews/:id/resume` — upload resume text
- `POST /api/interviews/:id/start` — generate 8 AI questions
- `GET /api/interviews/:id/questions/:qId/audio` — TTS audio (base64 mp3)
- `POST /api/interviews/:id/answers` — submit audio answer (STT transcription)
- `POST /api/interviews/:id/complete` — grade interview, generate report
- `GET /api/interviews/:id/report` — fetch completed report
- `GET /api/interviews/:id/coding-questions` — generate coding questions for this interview
- `POST /api/interviews/:id/coding-submit` — save candidate coding answers
- `GET /api/scheduled-interviews` / `POST /api/scheduled-interviews` — employer scheduled interview CRUD
- `GET|DELETE /api/scheduled-interviews/:id` — single scheduled interview management
- `POST /api/scheduled-interviews/:id/candidates` — add candidates by pasted email list
- `DELETE /api/scheduled-interviews/:id/candidates/:email` — remove a candidate
- `GET /api/scheduled-interviews/:id/results` — paginated results with sorting
- `GET /api/scheduled-interviews/:id/results/export` — XLSX download (4 sheets)
- `GET /api/profile/me` / `PATCH /api/profile/me` — profile management
- `GET /api/profile/:userId/public` — public profile (name, bio, avg score, resume)

## Database Schema

- `users` — from Replit Auth + extended: phone, bio, publicResume, customProfileImage, isPhoneVerified
- `sessions` — OIDC session storage
- `jobs` — employer job profiles (title, role, description, skills JSON with required level and weight)
- `scheduled_interviews` — employer-scheduled interviews (jobId, role, difficulty, style, startTime, deadlineTime, codingQuestionsCount)
- `interview_candidates` — allowed candidate emails per scheduled interview
- `interviews` — interview sessions (userId, jobId, scheduledInterviewId, role, difficulty, interviewStyle, codingLanguage, codingAnswers, status, resumeText)
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
