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

For the landing-slot tool, preserve the current `landing-slots.html` behavior documented in `docs/product-brief.md` and `docs/poc-analysis.md`: monthly student-first greedy computation, total monthly upvotes for ties, earliest preferred slot, automatic preservation of every manual assignment, and immediate application. Do not add a separate landing-window lifecycle, assignment lock/unlock state, or preview/commit workflow to the MVP. Authentication, student records, the portal, and hosted persistence remain planned extensions.

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
**AGENT:** Create JSON fixtures for: empty cases, one student/slot, competition for one slot, multiple preferences, unequal assignment counts/total monthly upvotes, manual assignments with/without upvotes, recalculation, single/all-month clearing while retaining preferences, and student-ID/slot-ID tie cases. Include other-month isolation, occupied preferences still contributing to the tie-break count, the greedy equity limitation, preference removal retaining an existing assignment, and incomplete end-time rejection/legacy migration.

**Done when:** important POC behavior has explicit inputs and expected outputs; identical IDs/input produce identical results, and changes caused by regenerating random IDs are documented. Do not encode a remaining-options or constrained-slot policy.

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
Explicit irreversible confirmation. Transactionally handle sessions, log entries, access tokens, preferences, and assignments across all months, including manual assignments. Released-slot status reflects remaining demand. Deleted links stop functioning.

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
Explicit public schemas only: permitted profile, student-visible sessions, flight log, instructor's exposed landing-slot details (including Requested/Allocated slots), own assignments. Never serialize ORM entities directly or expose instructor-private notes/other students' identities, preferences, or assignments.

## Task 7.3 — Student portal UI
Responsive portal without instructor authentication. History/log/landing preferences/assignments; no instructor/admin navigation; discourage search indexing.

## Task 7.4 — Public endpoint protection
Rate limiting, safe cache/referrer policies, token/log redaction, safe errors.

---

# Phase 8 — Monthly Landing Slots

## Task 8.1 — Models
LandingSlot: instructor, local start/end, required airport/runway label, concurrency version. Model assignment separately; derive Available/Requested/Allocated from assignment and upvotes, not a window lifecycle. Enforce ownership and uniqueness of start plus normalized airport/runway. Support explicitly incomplete legacy end times without allowing new incomplete slots. No separate LandingWindow entity.

## Task 8.2 — Monthly workspace queries
Owned month-scoped slot listing and all-roster student data; month navigation supported from January 2000 through December 2099. No window selector/status endpoints. Define the hosted timezone interpretation of POC local wall times explicitly; do not silently convert legacy times.

## Task 8.3 — Landing-slot API
Owned create/get/delete and incomplete-end-time repair. Require valid same-day end-after-start ranges and normalized airport/runway; reject duplicate start/runway. Do not add overlap avoidance or overnight support. Confirmed deletion removes assignments and associated preferences transactionally; concurrency conflicts return 409.

## Task 8.4 — Calendar shell
Monthly calendar with previous/next/Today, create-slot form using DD/MM/YYYY and 24-hour From/To, one-hour editable end-time proposal, details panel, incomplete-slot repair and deletion; desktop/mobile states. Adding a slot selects its month. No general slot editor, window selector/status, or allocation yet.

---

# Phase 9 — Migrate POC Interactions

## Task 9.1 — Map POC UI concepts
Using `landing-slots.html` and `poc-analysis.md`, map slot cards, chips, calendar indicators, matrix, metrics/warnings, force-control switch, and single/all-month clearing to React. Preserve specified greedy behavior and independent upvotes/assignments, including the documented limitations. Do not port localStorage persistence, races, or success notifications for failed saves. The POC's local JSON backup/replacement/reset workflows are documented reference behavior; hosted data-transfer/backup UI remains post-MVP.

## Task 9.2 — Slot cards/student chips
Accessible typed React components; independent upvoted/assigned states, Available/Requested/Allocated statuses, manual distinction and incomplete-end-time indicator; keyboard operation. Dimmed manual-override chips remain editable.

## Task 9.3 — Preference matrix
Read-only student rows × slot columns showing preference, assignment, and manual override; scrolling and legend.

---

# Phase 10 — Slot Preferences

## Task 10.1 — SlotPreference model
Instructor/student/slot/source (Instructor or Student), timestamps, unique student+slot, ownership consistency.

## Task 10.2 — Instructor preference API/UI
Idempotent add/remove/bulk replacement. Reject foreign student IDs. React chips persist through API; failures restore/invalidate optimistic state. Removing preference must not silently remove assignment.

## Task 10.3 — Student preference API/UI
Student-link holder can alter only their own preferences for their instructor's exposed slots. No arbitrary student ID, foreign-instructor slot mutation, or visibility of other students' preferences. Preserve the baseline's absence of open/closed-window and past-date restrictions; editing preferences does not silently change assignments.

---

# Phase 11 — Allocation Engine

## Task 11.1 — Pure Python allocation contracts
Framework-independent domain objects for students, local-time slots, preferences, existing assignments with automatic/manual source, target month, and calculated assignments/counts. No independent lock field, pending proposal, or per-assignment explanation requirement.

## Task 11.2 — Reproduce POC algorithm first
Use POC fixtures to port current behavior into pure Python. No browser/database/network/framework dependency. Preserve the specified behavior; document representation/timezone differences, not a replacement fairness policy.

## Task 11.3 — Verify monthly policy parity
1. Reject computation if any slot in the target month lacks a valid end time.
2. Preserve all manual assignments in that month and count them; reset that month's automatic assignments only.
3. Select students with an unassigned upvoted slot in the month.
4. Prioritize fewer current-month assignments, then fewer total monthly upvotes (including occupied preferences), then ascending stable student ID.
5. Assign the selected student's earliest unassigned preferred slot by local start time, then ascending stable slot ID.
6. Repeat until no eligible demand remains. Leave other months unchanged and exclude them from priority counts.

New automatic assignment requires preference; at most one student per slot; identical IDs/input/month yield identical output. Existing automatic assignments can lack a current upvote until recomputation. Use POC-compatible non-locale ID ordering; do not sort slots by constraint count or dynamically count remaining preferred options. No quota, historical weighting, overlap check, or globally optimal equity guarantee.

**Done when:** all allocation fixtures match the POC, including manual nonvoters and the greedy equity limitation; there is no second target allocator with different rules.

## Task 11.4 — Comprehensive unit tests
Cover empty/full/over/under-subscribed cases, equal/unequal allocations, total-preference tie-breaking, manual overrides with/without preferences, ties, students without preferences, multiple slots/student, shared demand, other-month isolation, incomplete slots, and greedy equity limitations.

## Task 11.5 — Property tests
Use Hypothesis: max one assignment/slot; newly computed automatic assignments imply preferences; every manual assignment is unchanged; other-month state is unchanged; valid references; deterministic for identical IDs/input/month; input not mutated.

---

# Phase 12 — Allocation API and Instructor Controls

## Task 12.1 — Monthly calculation service
Load an authoritative instructor-owned snapshot for the requested month and complete roster/preferences; invoke the pure allocator and retain a revision for conflict detection during persistence. Return calculated assignments/counts internally. This is part of one compute action, not a user-facing preview endpoint.

## Task 12.2 — Atomic compute API
One request identifies month and expected workspace revision; calculate from authoritative state and persist within a transaction with concurrency checks. Changed inputs return 409; no partial assignments or success on failed persistence. Preserve all manual assignments and other-month state; record algorithm version/month and audit the applied run. No preview token or separate commit request.

## Task 12.3 — Manual assignment
Assign any owned student regardless of preference; replace or clear a single assignment. All manual assignments are implicitly preserved during computation; no lock/unlock endpoint. Require a complete end time to assign. Also provide confirmed all-month assignment clearing scoped to the instructor, including manual assignments. Both clear scopes retain students, slots, and preferences; record changes and reject stale writes.

## Task 12.4 — Compute/manual UI
Compute displayed month and immediately apply the saved response; busy state, result/manual-preservation counts, conflict refresh/retry, explicit errors. No compare/commit/cancel stage. Manual overrides visibly distinct; Enable force assignment changes editing controls only, not stored assignment preservation. Single-slot replacement/clearing is direct; all-month clearing requires explicit scope/count confirmation and retains upvotes.

---

# Phase 13 — Metrics and Warnings

## Task 13.1 — Metrics
Reproduce monthly total/unassigned/assigned slots, manual/automatic breakdown, whole-percentage utilization, preferences per slot/total, and per-student preferences/assignments/manual counts. Average uses every roster student. Unassigned includes Requested and incomplete slots; manual assignments may exceed upvotes. Test empty data and POC-compatible percentage rounding.

## Task 13.2 — Limited-preference warnings
Preserve POC formulas separately from allocation decision logic: underallocated means zero assignments or below monthly average; low coverage means preferences below ceil(total monthly slots / roster size). With slots present, underallocated students receive Coverage if low coverage, otherwise Unfulfilled. No slots means no alerts; no students means zero average/coverage alerts. Coverage-alert count excludes Unfulfilled; zero-assignment Coverage receives the Critical label. No configurable policy in the MVP.

## Task 13.3 — Dashboard
Display the POC's four cards (unassigned slots, assigned slots, efficiency, Coverage alerts), student-equity roster, per-slot demand, and independent preference/assignment indicators, including manual nonvoters. Explain scope and heuristic warnings via labels/tooltips; show incomplete end-time warnings and do not rely only on color.

---

# Phase 14 — Security, Audit, Reliability

## Task 14.1 — Audit events
Audit instructor administration, student-link lifecycle, student/slot deletion, manual assignment changes, single/all-month assignment clearing, and applied monthly allocation runs. Store actor/action/target/time but no sensitive note contents.

## Task 14.2 — Optimistic concurrency
Apply where necessary to students/sessions/slots/preferences/assignments and the monthly compute snapshot, including roster changes; return 409 and support refresh/retry.

## Task 14.3 — Security tests
Cross-instructor IDs, forged object IDs/instructor IDs, suspension, admin isolation, expired/revoked student links, foreign-slot preference writes, unauthorized compute/all-month clearing, error leakage.

## Task 14.4 — Logging/redaction
Safe correlation/actor/operation/result/duration; never log passwords, JWTs, student tokens, birth dates, notes/comments, DB/service credentials or complete sensitive request bodies.

---

# Phase 15 — End-to-End Testing

## Task 15.1 — Development seed
Deterministic development-only admin, two instructors, students, session types, flight entries, multiple months of slots/preferences/manual assignments. Must not accidentally run in production.

## Task 15.2 — Instructor E2E
Login → student → session → log → monthly slots → preferences → compute/apply → manual override → recalculate preserving every manual assignment → clear one assignment retaining preferences → confirmed all-month clear retaining upvotes. Verify other-month isolation, control-switch semantics, and computation/persistence failure feedback.

## Task 15.3 — Student E2E
Valid link → permitted records → add/remove preference without silently changing assignments → current assignment → revoked link rejected; foreign-student/instructor slot access rejected. Never expose private/other-student data.

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
Verify admin lifecycle, login, student/session/log CRUD, link lifecycle, instructor/student preferences, immediate monthly compute, all-manual preservation, single/all-month clearing retaining upvotes, UI responsiveness, audit/errors.

---

# Phase 17 — Post-MVP Only

Do not implement until MVP is stable:
- Historical fairness.
- Alternative constrained-slot/remaining-options allocation policies.
- Separate multi-slot landing windows and open/closed preference periods.
- Independent manual assignment lock/unlock.
- Allocation preview/compare/commit UI and per-assignment explanations.
- Configurable coverage-warning policies.
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

The POC's local workspace JSON import/export already exists; hosted data export/backup/restore is a separate feature, not authorization to replace full student records from a name-only POC file.

---

# Immediate Next Steps

Given the current state, do **only these next**:

1. The three original inputs are already committed, and `docs/poc-analysis.md` has been created for Task 0.2.
2. Give the coding agent **Task 0.3** only, then complete Task 0.4 separately.
3. Then run Tasks 1.1 and 1.2 to reach the first technical milestone:

```text
local React --> local FastAPI /health
```

4. Only after that, start Phase 2 and connect the Supabase project you already created.
5. Do not configure Vercel/Render projects until the local skeleton is working.

## Next coding-agent prompt

```markdown
Implement Task 0.3 from `docs/execution-plan.md`.

Read:
- `docs/product-brief.md`
- `docs/execution-plan.md`
- `docs/poc-analysis.md`
- `landing-slots.html`

Capture representative JSON inputs and expected outputs from the unchanged POC as required by Task 0.3.

Do not modify `landing-slots.html` and do not implement the new application yet.

Before finishing, verify fixture outputs against the actual POC. Cover total monthly upvote and stable-ID ties, earliest-slot selection, manual preservation, other-month isolation, clearing without deleting preferences, preference removal without immediate assignment changes, and incomplete end-time behavior. Document the greedy equity limitation and random-ID recreation effects; do not substitute a different fairness policy.

Report files changed, key findings, assumptions, and unresolved questions.
```
