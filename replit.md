# Vocalize.ai — AI Interview Platform

## Overview

Full-stack AI Interviewer platform with two modes: **Candidate** (voice-based interview practice with anti-cheat) and **Employer** (schedule interviews, manage candidates, view results with XLSX export).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24 / **Python**: 3.11
- **API framework**: FastAPI (Python) + Uvicorn — replaced Node.js/Express
- **Database**: PostgreSQL + SQLAlchemy ORM (Python)
- **Frontend**: React + Vite (react-vite artifact) — fully rewritten
- **Auth**: Replit Auth (OIDC + PKCE, Google login) via `@workspace/replit-auth-web`
- **State management**: TanStack Query (React Query) with direct `fetch()` calls
- **UI**: Custom CSS variables with light/dark theme, framer-motion animations, sonner toasts
- **AI**: OpenAI via Replit AI Integrations (gpt-4o for questions/grading, TTS for voice, STT for answers)

## Directory Structure

```text
artifacts/
  api-server-py/      FastAPI Python backend (active)
    main.py           Entry point
    routes/           auth, interviews, jobs, scheduled_interviews, profile, health
    db/               SQLAlchemy models + database connection
    lib/              AI helpers (stutter, communication, facial, OpenAI client)
  api-server/         Original Node.js/Express backend (inactive/legacy)
  ai-interviewer/     React + Vite frontend (previewPath: /)
    src/
      components/     Layout, ThemeProvider, ErrorBoundary
      pages/          All page components (rewritten with new design)
      index.css       Light/dark CSS variables
  mockup-sandbox/     Design sandbox (unused in prod)
lib/
  replit-auth-web/    Browser auth hook (useAuth)
```

## Key Features

### Candidate Mode
1. Sign in with Google (Replit Auth)
2. Upload/paste resume text → skills extracted via AI
3. Optionally select an employer-defined job profile
4. Select interview role, difficulty, and style (Friendly, Professional, Strict)
5. AI generates adaptive personalized questions
6. Each question is spoken aloud via TTS (OpenAI alloy voice)
7. Candidate records answer via microphone → STT transcription
8. After all questions → AI grades English fluency, behavioral STAR structure, communication clarity, confidence, and each skill (0-100)
9. Detailed report with answer-level suggested better responses and recommendation (hire/no_hire/maybe)

### Employer Mode
1. Create job profiles with title, role, description, skills with required proficiency (1-10), and skill weightage
2. Schedule interviews: set start time, deadline, number of coding questions, link candidates by email
3. Candidates verify email at interview access link, then sign in to start
4. Employer views results with sorting by score and XLSX export (4 sheets)

### Anti-Cheat
- Fullscreen enforced at interview start; exit = warning + logged
- Tab switch / window blur logged and shown in malpractice alerts
- Ctrl+T, Ctrl+W, Ctrl+N keyboard shortcuts blocked during interview
- Right-click disabled during active interview session

### Coding Questions
- Employers set coding question count per scheduled interview (0–3+)
- AI generates role/difficulty-appropriate questions in candidate's chosen language
- Code written in a textarea; submitted with final interview for AI review

## API Endpoints (FastAPI)

All prefixed with `/api`:
- `GET /auth/user` — current auth state
- `GET|POST /jobs` — job profile CRUD
- `DELETE /jobs/:id`
- `GET|POST /interviews` — interview management
- `POST /interviews/:id/resume` — upload resume text
- `POST /interviews/:id/resume/upload` — upload resume file (PDF/DOCX/TXT)
- `POST /interviews/:id/next-question` — generate next question adaptively
- `GET /interviews/:id/questions/:qId/audio` — TTS audio (base64 mp3)
- `POST /interviews/:id/answers` — submit audio answer
- `POST /interviews/:id/complete` — grade interview, generate report
- `GET /interviews/:id/report` — fetch completed report
- `GET /interviews/:id/coding-questions` — generate coding questions
- `POST /interviews/:id/coding-submit` — save coding answers
- `DELETE /interviews/:id`
- `GET|POST /scheduled-interviews`
- `GET|DELETE /scheduled-interviews/:id`
- `POST /scheduled-interviews/:id/candidates` — add/remove candidates
- `POST /scheduled-interviews/validate-access` — check candidate eligibility
- `GET /scheduled-interviews/:id/results` — paginated results
- `GET /scheduled-interviews/:id/results/export` — XLSX download
- `GET|PATCH /profile/me` — profile management
- `GET /health` — health check

## Database Schema (SQLAlchemy)

- `users` — from Replit Auth + extended: phone, bio, publicResume, customProfileImage, isPhoneVerified
- `sessions` — OIDC session storage
- `jobs` — employer job profiles (title, role, description, skills JSON)
- `scheduled_interviews` — employer-scheduled interviews
- `interview_candidates` — allowed candidate emails per scheduled interview
- `interviews` — interview sessions (userId, jobId, scheduledInterviewId, role, difficulty, etc.)
- `interview_questions` — generated questions per interview
- `interview_answers` — transcribed answers per question
- `interview_reports` — grading results (scores, analysis, recommendation)

## Theme System

- CSS variables in `index.css`: `--background`, `--foreground`, `--primary`, etc.
- `ThemeProvider` context — stores preference in `localStorage`
- Dark mode: class `.dark` on `<html>`, toggled in `Layout.tsx`
- Dark theme: deep navy/charcoal background, indigo→purple gradient primary
- Light theme: white/gray background, same gradient primary
- Custom classes: `btn-gradient`, `glass-panel`, `badge-hire`, `badge-maybe`, `badge-no-hire`

## Environment Variables

Auto-provisioned by Replit:
- `DATABASE_URL` (PostgreSQL connection string)
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
- `REPLIT_DOMAINS`, `REPL_ID` (for auth)

## Development

```bash
# Start Python backend (port 8080)
PORT=8080 python artifacts/api-server-py/main.py

# Start frontend (port 19472)
PORT=19472 BASE_PATH=/ pnpm --filter @workspace/ai-interviewer run dev

# Both together (via workflow)
# Configured in .replit as "Start application" workflow
```

## Recent Changes

- **Backend migrated to Python FastAPI** from Node.js/Express — full feature parity
- **Frontend completely rewritten** — new design system with light/dark mode
- All pages redesigned: Landing, CandidateDashboard, EmployerDashboard, InterviewSetup, CreateJob, ScheduleInterview, ScheduledInterviewCandidates, ScheduledInterviewResults, InterviewAccess, ActiveInterview, InterviewReport, Profile, 404
- Removed dependency on `@workspace/api-client-react` generated hooks in new pages
- Added `sonner` for toast notifications throughout
- Fixed Python f-string backslash syntax errors in `lib/ai.py` and `routes/interviews.py`
