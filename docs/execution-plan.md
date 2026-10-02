# Flight Instructor App — Execution Plan

## Start Here

### Current setup state
Already done by the product owner:
- Supabase account, organization, and project created.
- Render account created.
- Vercel account created.

No further configuration on these platforms is assumed yet.

### Target stack
- Frontend: React + TypeScript + Vite, hosted on Vercel.
- Backend: Python + FastAPI, hosted on Render.
- Database: Supabase PostgreSQL.
- Authentication: Supabase Auth.
- Persistence: SQLAlchemy 2.x + Alembic.
- Tests: Pytest/Hypothesis, Vitest/React Testing Library, Playwright.

### How to use this plan
Give the coding agent **one numbered task at a time**. Do not ask it to implement the entire plan. A task is done only when its acceptance criteria pass.

The owner performs dashboard/account actions marked **OWNER**. The coding agent performs repository/code work marked **AGENT**.

---

# Phase 0 — Understand the Existing POC

## Task 0.1 — Prepare repository documentation
**OWNER:** Create an empty Git repository if needed and add:
```text
docs/product-brief.md
docs/execution-plan.md
landing-slots.html
```

**AGENT:** Add a concise README linking the brief and plan. Do not implement product functionality.

**Done when:** the three inputs are version controlled and README explains the project.

## Task 0.2 — Analyze `landing-slots.html`
**AGENT:** Create `docs/poc-analysis.md` covering:
- Screens/workflows and important JavaScript functions.
- Data structures and localStorage keys/formats.
- Allocation algorithm and tie breaking.
- Preferences/upvotes.
- Manual assignments and recalculation.
- Calendar, matrix, metrics, warnings.
- Useful UI concepts to preserve.
- Defects, assumptions, and migration risks.

Do not modify the POC.

**Done when:** every significant function and localStorage structure is documented.

## Task 0.3 — Capture POC allocation fixtures
**AGENT:** Create JSON fixtures for: empty cases, one student/slot, competition for one slot, multiple preferences, unequal assignment counts/options, manual assignments, recalculation, clearing assignments without preferences, and tie cases.

**Done when:** important POC behavior has explicit inputs and expected outputs; nondeterminism is documented.

## Task 0.4 — Record architecture decisions
**AGENT:** Create `docs/architecture.md`: React/Vite; FastAPI; Supabase PostgreSQL/Auth; SQLAlchemy/Alembic; Vercel; Render; JWT validation in API; opaque student links; REST; pure Python allocator. Explicitly reject localStorage as persistence, SQLite as primary DB, frontend service-role credentials, direct browser application-table writes, and trusting client instructor IDs.

---

# Phase 1 — Bootstrap Local Development

## Task 1.1 — Create repository structure
**AGENT:** Create:
```text
apps/
  web/       # React + TypeScript + Vite
  api/       # FastAPI

docs/
e2e/
supabase/
```

Backend baseline: FastAPI, Pydantic/pydantic-settings, Uvicorn, Pytest, Ruff, type checking.
Frontend baseline: React Router, TanStack Query, Vitest, React Testing Library, ESLint/Prettier.

Create placeholder routes: `/login`, `/students`, `/students/:studentId`, `/landing-slots`, `/admin`, `/student/:token`.

**Done when:** frontend/backend build and tests run locally.

## Task 1.2 — Prove React → FastAPI locally
**AGENT:** Implement unauthenticated `GET /health`; configure development CORS; display/check API health from React.

Target:
```text
React localhost:5173 --> FastAPI localhost:8000/health
```

**Done when:** browser call succeeds without CORS errors. No database/auth yet.

## Task 1.3 — Configure SQLAlchemy and Alembic
**AGENT:** Add SQLAlchemy 2.x, PostgreSQL driver, session lifecycle, Alembic, migration baseline, transaction helpers. Document sync vs async choice.

**Done when:** migrations can apply/rollback against PostgreSQL and sessions close correctly.

## Task 1.4 — Add CI
**AGENT:** CI must run Python format/lint/type checks/tests and frontend lint/type checks/tests/build.

---

# Phase 2 — Connect Existing Supabase Project

## Task 2.1 — Collect Supabase configuration
**OWNER:** Open the existing Supabase project and obtain the values needed for public client configuration, backend DB connectivity, and backend Auth/JWT administration. Keep secrets out of Git and chat.

**AGENT:** Create safe `.env.example` templates.

Frontend variables:
```text
VITE_API_BASE_URL
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Backend variables:
```text
DATABASE_URL
SUPABASE_URL
SUPABASE_JWT_ISSUER
SUPABASE_JWKS_URL
SUPABASE_SERVICE_ROLE_KEY
ALLOWED_ORIGINS
LOG_LEVEL
```

**Done when:** actual values live only in ignored local environment files or platform secret stores.

## Task 2.2 — Configure Supabase email/password Auth
**OWNER:** Configure email/password authentication in the existing project as needed and create a development instructor identity.

**AGENT:** Implement React login/logout/session restore/token refresh using Supabase Auth.

**Done when:** local login, refresh, and logout work.

## Task 2.3 — Validate Supabase JWT in FastAPI
**AGENT:** Validate signature/signing key, issuer, audience when applicable, and expiration. Derive identity from validated `sub`. Add protected `GET /api/me`.

**Done when:** no token/invalid token returns 401; valid token succeeds; client-supplied user ID is never trusted.

## Task 2.4 — Connect FastAPI to Supabase PostgreSQL
**AGENT:** Configure DB access through environment settings. Extend health behavior to test DB connectivity without leaking credentials.

**Milestone:**
```text
local React --> Supabase Auth --> JWT --> local FastAPI --> Supabase PostgreSQL
```

Do not configure hosted services until this milestone works.

---

# Phase 3 — Configure Existing Vercel and Render Accounts

## Task 3.1 — Create Vercel project
**OWNER:** In the existing Vercel account, import/connect the Git repository once `apps/web` exists.

**AGENT/GUIDE:** Configure root `apps/web`, Vite build/output, SPA rewrites, preview configuration, and only public frontend variables.

**Done when:** React deploys and nested routes survive direct navigation/refresh.

## Task 3.2 — Create Render Web Service
**OWNER:** In the existing Render account, create a Web Service from the same Git repository once `apps/api` works locally.

**AGENT/GUIDE:** Configure root `apps/api`, Python dependencies/runtime, `/health`, environment secrets, and start command equivalent to:
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Done when:** public `/health` succeeds and Render can reach Supabase PostgreSQL.

## Task 3.3 — Connect hosted services
**AGENT/GUIDE + OWNER dashboard actions:**
- Set Vercel `VITE_API_BASE_URL` to Render API.
- Allow Vercel origin in FastAPI CORS.
- Configure appropriate Supabase hosted Auth redirect URLs.

Verify:
```text
Browser --> Vercel React --> Supabase Auth
                  |
                  +--> Render FastAPI --> Supabase PostgreSQL
```

**Done when:** hosted login and authenticated API+DB call succeed.

## Task 3.4 — Document environment separation
**AGENT:** Create `docs/environments.md`:
```text
LOCAL
React localhost + FastAPI localhost + Supabase development project

PREVIEW/DEV
Vercel preview + Render development + Supabase development project

PRODUCTION
Vercel production + Render production + separate Supabase production project
```
The existing Supabase project is development initially. Create a separate production project before storing real user/student data. Never document secret values.

---

# Phase 4 — Instructor Accounts and Administration

## Task 4.1 — Instructor profile model
Add `InstructorProfile`: ID, Supabase Auth user ID, display name, email, status (Active/Suspended/Deleted), timestamps. Migration + API current-profile endpoint. Prevent duplicate Auth mappings.

## Task 4.2 — Enforce account state
Reusable FastAPI authorization dependency. Suspended/deleted users cannot access protected APIs.

## Task 4.3 — Bootstrap administrator authorization
Use controlled DB role or validated claim. No public privilege-grant endpoint. Document safe bootstrap.

## Task 4.4 — Admin API
List/create/suspend/reactivate/delete instructors and initiate password recovery/reset. Supabase administrative calls only from FastAPI. Audit lifecycle actions and handle multi-step failures safely.

## Task 4.5 — Admin UI
Account list, create dialog, suspend/reactivate, delete confirmation, status/error/loading states. Normal instructors cannot access it.

---

# Phase 5 — Student Management

## Task 5.1 — Student data model
Instructor-owned student: first/last name required; optional birth date, email, phone, notes; timestamps/indexes. Alembic migration.

## Task 5.2 — Student CRUD API
List/search/sort/get/create/update/permanently delete. Enforce instructor ownership server-side and test identifier tampering.

## Task 5.3 — Student list UI
List/search/sort/add/edit/delete, loading/error/empty states. API-backed only.

## Task 5.4 — Permanent deletion workflow
Explicit irreversible confirmation. Transactionally handle sessions, log entries, access tokens, preferences, and future assignments. Deleted links stop functioning.

---

# Phase 6 — Sessions and Flight Log

## Task 6.1 — Training sessions
Model types: Flight, Simulator, Briefing, Debriefing, Ground Lesson, Other. Store timing/duration/location/aircraft-or-simulator, briefing/debriefing, student-visible summary, private notes, flight-occurred flag. Briefing-only and simulator sessions must work.

## Task 6.2 — Session API and UI
Owned CRUD, timeline, forms/details/type badges/delete confirmation. Private and student-visible notes must remain clearly separated.

## Task 6.3 — Flight log model/API
Student, optional session, date, departure/arrival, optional aircraft identifier/type, duration, optional landing count/day-night classification, comments. Validate nonnegative numeric fields.

## Task 6.4 — Flight log UI
Reverse chronological management from student details.

---

# Phase 7 — Secure Student Portal

## Task 7.1 — Student access tokens
Cryptographically secure opaque tokens; store only hash. Generate/status/revoke/regenerate endpoints. Raw token returned only at creation; revocation immediate.

## Task 7.2 — Public student read API
Explicit public schemas only: permitted profile, student-visible sessions, flight log, available landing slots, own assignments. Never serialize ORM entities directly or expose instructor-private notes/other students.

## Task 7.3 — Student portal UI
Responsive portal without instructor authentication. History/log/landing preferences/assignments; no instructor/admin navigation; discourage search indexing.

## Task 7.4 — Public endpoint protection
Rate limiting, safe cache/referrer policies, token/log redaction, safe errors.

---

# Phase 8 — Landing Windows and Slots

## Task 8.1 — Models
LandingWindow: instructor, name/description, dates, Draft/Open/Allocated/Closed. LandingSlot: instructor/window, start/end, location/runway/notes, availability, concurrency version. Enforce same ownership.

## Task 8.2 — Landing-window API
Owned list/get/create/update/status/delete; validate dates/dependencies.

## Task 8.3 — Landing-slot API
Owned CRUD; validate times; deletion impact; concurrency conflicts return 409.

## Task 8.4 — Calendar shell
Window selector/status, monthly calendar, create/edit slot, details panel; desktop/mobile states. No allocation yet.

---

# Phase 9 — Migrate POC Interactions

## Task 9.1 — Map POC UI concepts
Using `landing-slots.html` and `poc-analysis.md`, map slot cards, chips, calendar indicators, matrix, metrics/warnings to React. Do not port localStorage persistence or known defects.

## Task 9.2 — Slot cards/student chips
Accessible typed React components; selected/assigned/unavailable states; keyboard operation.

## Task 9.3 — Preference matrix
Read-only student rows × slot columns showing preference, assignment, and manual override; scrolling and legend.

---

# Phase 10 — Slot Preferences

## Task 10.1 — SlotPreference model
Instructor/student/slot/source (Instructor or Student), timestamps, unique student+slot, ownership consistency.

## Task 10.2 — Instructor preference API/UI
Idempotent add/remove/bulk replacement. Reject foreign student IDs. React chips persist through API; failures restore/invalidate optimistic state. Removing preference must not silently remove assignment.

## Task 10.3 — Student preference API/UI
Student-link holder can alter only their own preferences in open windows. No arbitrary student ID, hidden/closed slot mutation, or visibility of other students' preferences.

---

# Phase 11 — Allocation Engine

## Task 11.1 — Pure Python allocation contracts
Framework-independent domain objects for students, slots, preferences, existing/locked assignments, proposals, warnings, explanations.

## Task 11.2 — Reproduce POC algorithm first
Use POC fixtures to port current behavior into pure Python. No browser/database/network/framework dependency. Document differences.

## Task 11.3 — Implement target fairness policy
1. Preserve locked manual assignments.
2. Exclude their occupied slots.
3. Process slots with fewest eligible interested students first.
4. Prefer students with fewer assignments.
5. Then fewer remaining preferred options.
6. Stable deterministic tie-breaker.
7. Return explanations/warnings.

Automatic assignment requires preference; at most one student per slot; identical input yields identical output.

## Task 11.4 — Comprehensive unit tests
Cover empty/full/over/under-subscribed cases, equal/unequal allocations, scarce preferences, locks, overrides, ties, inactive students, multiple slots/student, shared demand.

## Task 11.5 — Property tests
Use Hypothesis: max one assignment/slot; automatic assignment implies preference; locks unchanged; valid references; deterministic; input not mutated.

---

# Phase 12 — Allocation API and Instructor Controls

## Task 12.1 — Preview
Load authoritative state; calculate without persistence; return retained/added/removed/changed, warnings, explanations, input revision.

## Task 12.2 — Atomic commit
Landing-window ID + input revision + algorithm version + DB transaction + concurrency checks. Stale preview returns 409; no partial assignments; audit successful run.

## Task 12.3 — Manual assignment
Assign any owned student regardless of preference; replace/clear/lock/unlock. Record overrides. Clearing assignment preserves preferences.

## Task 12.4 — Preview/manual UI
Recalculate, compare, warnings/explanations, commit/cancel, stale handling; manual overrides visibly distinct and replacements confirmed.

---

# Phase 13 — Metrics and Warnings

## Task 13.1 — Metrics
Total/assigned slots, utilization, preferences per slot, assignments per student, interested students with no assignment, manual unrequested assignments. Test empty data.

## Task 13.2 — Limited-preference warnings
Configurable warning rules, kept separate from allocation decision logic.

## Task 13.3 — Dashboard
Display utilization, per-student totals, demand, unmet demand, limited coverage, overrides. Explain metrics via labels/tooltips and do not rely only on color.

---

# Phase 14 — Security, Audit, Reliability

## Task 14.1 — Audit events
Audit instructor administration, student-link lifecycle, student deletion, manual assignment changes, allocation commits, window closure/reopening. Store actor/action/target/time but no sensitive note contents.

## Task 14.2 — Optimistic concurrency
Apply where necessary to students/sessions/windows/slots/preferences/assignments; return 409 and support refresh/retry.

## Task 14.3 — Security tests
Cross-instructor IDs, forged object IDs/instructor IDs, suspension, admin isolation, expired/revoked student links, closed-window writes, error leakage.

## Task 14.4 — Logging/redaction
Safe correlation/actor/operation/result/duration; never log passwords, JWTs, student tokens, birth dates, notes/comments, DB/service credentials or complete sensitive request bodies.

---

# Phase 15 — End-to-End Testing

## Task 15.1 — Development seed
Deterministic development-only admin, two instructors, students, session types, flight entries, window/slots/preferences/manual lock. Must not accidentally run in production.

## Task 15.2 — Instructor E2E
Login → student → session → log → window → slots → preferences → preview → commit → manual override → recalculate preserving lock → clear assignment retaining preferences.

## Task 15.3 — Student E2E
Valid link → permitted records → add/remove preference → assignment → revoked link rejected → closed-window modification rejected. Never expose private/other-student data.

## Task 15.4 — Admin E2E
Create → suspend → verify rejection → reactivate → delete; normal instructor cannot access admin surface.

---

# Phase 16 — Production Preparation and Launch

## Task 16.1 — Create production Supabase project
**OWNER:** Before real user/student data, create a separate production Supabase project.

**AGENT/GUIDE:** Apply migrations, configure production Auth redirect URLs/password settings/RLS/indexes and appropriate recovery configuration. Keep service credentials only on backend.

## Task 16.2 — Production Render configuration
Create/configure production backend with production Supabase values, CORS, health check, logging and controlled Alembic migration process. Do not allow concurrent app instances to race migrations.

## Task 16.3 — Production Vercel configuration
Set production frontend variables specifically to production Render + production Supabase. Preview must remain on development services.

## Task 16.4 — Production smoke test
Verify admin lifecycle, login, student/session/log CRUD, link lifecycle, instructor/student preferences, preview/commit, manual-lock preservation, UI responsiveness, audit/errors.

---

# Phase 17 — Post-MVP Only

Do not implement until MVP is stable:
- Historical fairness.
- Per-student slot maximums.
- Weighted/ranked preferences.
- Bulk slot import.
- Calendar export.
- Notifications.
- Data export.
- Authenticated student accounts.
- Multi-instructor schools.
- Aircraft management.
- Regulatory-grade logbook.
- Offline support.
- Backup/restore UI.

---

# Immediate Next Steps

Given the current state, do **only these next**:

1. Put `product-brief.md`, this `execution-plan.md`, and `landing-slots.html` in the Git repository.
2. Give the coding agent **Task 0.2** only.
3. After the POC analysis, complete Tasks 0.3 and 0.4.
4. Then run Tasks 1.1 and 1.2 to reach the first technical milestone:

```text
local React --> local FastAPI /health
```

5. Only after that, start Phase 2 and connect the Supabase project you already created.
6. Do not configure Vercel/Render projects until the local skeleton is working.

## First coding-agent prompt

```markdown
Implement Task 0.2 from `docs/execution-plan.md`.

Read:
- `docs/product-brief.md`
- `docs/execution-plan.md`
- `landing-slots.html`

Analyze the existing landing-slot POC and create `docs/poc-analysis.md` as required by Task 0.2.

Do not modify `landing-slots.html` and do not implement the new application yet.

Before finishing, verify that you documented all significant JavaScript functions, data structures, localStorage keys, allocation behavior, manual assignment/recalculation behavior, UI concepts worth preserving, defects, assumptions, and migration risks.

Report files changed, key findings, assumptions, and unresolved questions.
```
