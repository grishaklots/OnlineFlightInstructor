# Architecture decisions

These decisions originated in execution-plan Task 0.4; Task 1.3 resolves the persistence driver/session choice. They describe the planned application, not infrastructure or application code already deployed.

Requirements come from the [product brief](product-brief.md) and [execution plan](execution-plan.md). The [POC analysis](poc-analysis.md) and [characterization fixtures](../tests/fixtures/README.md) define the existing landing-slot behavior to preserve. `landing-slots.html` remains a standalone reference, not the production application.

## 1. System boundaries

```text
Instructor browser
  React/TypeScript/Vite on Vercel
    |-- sign in / refresh / sign out --> Supabase Auth
    |-- HTTPS REST + access JWT ------> Python/FastAPI on Render
                                          |-- SQLAlchemy --> Supabase PostgreSQL
                                          |-- Auth administration --> Supabase Auth
                                          |-- pure Python allocation domain

Student browser
  React portal on Vercel
    |-- HTTPS REST + opaque student credential --> FastAPI
                                                    |-- hash lookup / authorization
                                                    |-- PostgreSQL
```

The browser is an untrusted client. FastAPI owns application-data access, validation, authorization, allocation, and persistence. Supabase Auth owns instructor authentication; PostgreSQL owns durable application state. Administrative Auth operations stay on the backend.

## 2. Decision record

| Area | Decision and rationale |
| --- | --- |
| Frontend | React with TypeScript and Vite. Rebuild calendar, chips, roster, matrix, and forms as typed components rather than copying the POC's DOM/event implementation. React Router handles instructor/admin/student routes; TanStack Query manages API-backed server state. |
| Backend | Python with FastAPI. Explicit request/response schemas, reusable authorization dependencies, and application services keep HTTP handling separate from persistence and domain policy. A single backend is sufficient for the MVP; no microservices or allocation queue is required. |
| Database | Supabase-hosted PostgreSQL in development and production. One relational source of truth supports ownership constraints, preferences, exclusive assignments, transactions, and concurrency checks. |
| Instructor authentication | Supabase Auth for sign-in, session restoration, token refresh, and sign-out. The browser sends the access JWT to FastAPI; an Auth session alone does not authorize access to application records. |
| Persistence | Synchronous SQLAlchemy 2.x with psycopg 3 and Alembic migrations. Short MVP database operations do not justify async session/migration complexity; database-consuming FastAPI routes/dependencies use `def` and its thread pool. Requests use scoped sessions, explicit transactions, and cleanup on success/failure; no global mutable session. See the [backend lifecycle documentation](../apps/api/README.md#session-and-transaction-lifecycle). |
| Frontend hosting | Vercel serves the Vite build. Configure SPA rewrites for direct navigation to nested routes. Build-time frontend variables are public configuration, never secrets. |
| Backend hosting | Render hosts FastAPI as a web service. Configuration and credentials come from environment/secret stores; health checks and CORS are explicit. Migrations run through a controlled release process, not concurrently in every application instance. |
| API style | HTTPS REST with JSON and explicit schemas. Instructor application endpoints are under `/api`; a narrowly scoped public student API uses separate authorization/response schemas. No GraphQL, direct application-table browser API, or realtime channel is needed for the MVP. |
| Student access | High-entropy, opaque, revocable personal-link tokens, independent of instructor JWTs. Tokens authorize one student's limited portal operations; they do not create an instructor session. |
| Allocation | A framework-independent pure Python domain component reproduces the current POC's deterministic monthly greedy policy. Fixtures, not a newly invented optimizer, define parity. |

## 3. Authentication and authorization

### Instructor requests

React uses Supabase Auth for authentication and sends `Authorization: Bearer <access-token>` with protected API calls. FastAPI verifies the signature using trusted signing keys/JWKS, an allowlisted signing algorithm, issuer, audience where applicable, and expiration. Missing or invalid credentials return 401; unverified token contents never establish identity.

Resolve the validated JWT `sub` to `InstructorProfile`, check its account state, and derive the request's instructor ownership scope from that mapping. Suspended/deleted instructors cannot use protected application operations even if a JWT has not yet expired. Administrator access requires a controlled database role or validated claim; normal instructors cannot grant it to themselves.

Every read/write is scoped server-side to the authenticated instructor. Referenced students, slots, preferences, assignments, sessions, and logs must belong to that same instructor. Changing an object ID, query parameter, or request body must not cross this boundary. Database ownership constraints and appropriate RLS can provide defense in depth, but do not replace API authorization, especially for privileged backend connections.

### Student requests

Generate cryptographically random tokens with at least 256 bits of entropy. Return the raw credential only when creating/regenerating a link; store only its secure hash and lifecycle metadata with the student association. On a portal request, hash the presented credential, find its active record, and derive the student/instructor scope from that record, never from a client-supplied student ID.

Revocation/regeneration takes effect on subsequent requests. The student can read explicitly permitted profile/session/log fields, exposed slot details, and their own assignments, and add/remove only their own preferences. They cannot see other students' identities/preferences/assignments, instructor-private notes, or invoke allocation/manual-assignment/admin operations. The baseline has no open/closed-window or past-date preference restriction.

Treat the link token as a bearer secret: redact it from application/proxy logs, avoid leaking it through referrers or caches, discourage indexing, and rate-limit public endpoints. Do not persist it in localStorage. The precise API transport and route/logging controls are implemented in Phase 7; they must account for the planned `/student/:token` link route.

## 4. Data ownership and persistence

Core application entities are `InstructorProfile`, `Student`, `TrainingSession`, `FlightLogEntry`, `StudentAccessToken`, `LandingSlot`, `SlotPreference`, `SlotAssignment`, and `AllocationRun`. Supabase Auth identities are separate from instructor application profiles.

Students and their training records belong to an instructor. Slots also belong to an instructor; preferences and assignments reference owned students/slots with ownership consistency enforced. Use database uniqueness for at most one preference per student/slot and at most one current assignment per slot. Normalize the required airport/runway label and enforce duplicate-start/runway rejection.

There is no separate multi-slot `LandingWindow` entity or lifecycle in the MVP. Slot status is derived from assignment and demand: Allocated, otherwise Requested when upvoted, otherwise Available. Keep preferences independent of assignments. Clearing/replacing an assignment does not delete upvotes; removing an upvote does not silently clear an existing assignment.

Student/slot deletion and assignment changes use transactions for dependent records. Student deletion releases assignments and removes preferences across all months, including manual assignments; deleted personal links stop working. All-month clearing is restricted to the instructor and preserves roster, slots, and preferences.

Application success is reported only after durable persistence succeeds. Failed validation or persistence must not leave partially applied allocations/deletions. Optimistic-concurrency conflicts return 409 with a refresh/retry path rather than silently overwriting another user's changes.

## 5. Allocation boundary and parity contract

The pure allocator takes explicit students, slots, preferences, existing assignments with their sources, and a target month. It returns a calculated result without reading/writing a database, calling a network, consulting browser storage, using framework objects, generating random IDs, or mutating input.

Preserve these rules:

1. Scope to the requested start month. Reject calculation if any scoped slot has an incomplete end time.
2. Preserve every scoped manual assignment and count it; reset scoped automatic assignments only. Other-month assignments and preferences do not affect priority.
3. Among students with an unassigned preferred slot, choose fewer current calculation assignments, then fewer total monthly upvotes, then ascending stable student ID.
4. Assign that student's earliest free preferred slot by local start time, then ascending stable slot ID. Repeat until eligible demand is exhausted.

Upvote totals remain fixed during the calculation and include occupied slots. Do not replace them with remaining free options or order slots by scarcity. No quota, historical weighting, overlap avoidance, or global equity optimization is added. Manual source itself implies preservation; the UI force switch changes editing controls, not a stored lock field.

Use POC-compatible non-locale comparison for stable IDs; do not rely on database collation, row order, or student names. The fixture IDs are ASCII and explicit. Fixed inputs/IDs/month produce identical results, while recreating equivalent records with new IDs can change ties.

`AllocationRun` records a successfully applied monthly calculation and algorithm version for auditing, not a pending preview. FastAPI loads an authoritative snapshot, invokes the allocator, and atomically persists the result with revision/concurrency checks. Slot/preference/assignment and roster changes must invalidate a stale snapshot. The UI has one Compute action, not a mandatory preview/compare/commit workflow.

The existing JSON fixtures are portable: later Python tests map POC fields into domain contracts and compare static expected outcomes. Transition/restoration cases belong to workspace/adapter tests, not extra responsibilities of the pure allocator.

## 6. Dates and POC migration

The POC uses device-local wall-time strings with no timezone, years 2000-2099, and same-date end-after-start ranges. New slots require a valid end time; legacy version-1 slots receive one hour where valid, otherwise remain explicitly incomplete until repaired/removed. Overnight and schedule-conflict support are not baseline features.

Do not silently reinterpret wall times as UTC. Task 8.2 must establish the hosted timezone interpretation and document DST validation/ambiguity before implementing slot persistence. SQL storage types and serialization must follow that decision; server-local timezone defaults must not determine an instructor's schedule.

The local POC's JSON import/export is reference behavior, not a hosted full-record replacement mechanism. Its name-only roster cannot replace training records or grant ownership. Hosted import/export/backup UI remains post-MVP; any later migration must map records within an authorized instructor scope.

## 7. Deployment and configuration

Development first proves `React localhost:5173 -> FastAPI localhost:8000/health`, then connects instructor Auth and PostgreSQL using the existing development Supabase project. Configure Vercel/Render projects only after the local authenticated API/database milestone.

Preview/development and production must use distinct backend/database configuration. A separate production Supabase project is required before storing real student data; Vercel previews must not use production services. CORS allows only the intended frontend origins and does not substitute for authentication.

React receives only public configuration such as API base URL, Supabase URL, and its public anon key. Render receives database credentials, trusted Auth issuer/JWKS configuration, permitted origins, and any Supabase service-role credential needed for backend administration. Keep actual values out of Git, documentation, and frontend bundles.

## 8. Explicitly rejected alternatives

| Rejected | Reason / chosen boundary |
| --- | --- |
| localStorage as authoritative application persistence | Device/origin-specific, best-effort writes and cross-tab races do not support durable multiuser state. PostgreSQL is authoritative; transient UI state and query caches are not a persistence substitute. |
| SQLite as the primary or development substitute database | It would diverge from production PostgreSQL constraints, transactions, and concurrency behavior. Use PostgreSQL-compatible persistence in every application environment. |
| Frontend Supabase service-role or database credentials | Browser assets are public and these credentials grant privileged access. Only backend secret stores may hold them. |
| Direct browser application-table writes | They bypass the chosen FastAPI authorization, validation, audit, and transactional allocation boundary. Browser calls to Supabase Auth are allowed; application records go through REST. |
| Trusting client-supplied instructor IDs | A caller can alter them. Ownership derives from validated JWT identity/profile, or from the validated student-token association for portal operations. |
| Copying the POC application as the hosted backend | Its localStorage/DOM logic, absence of identity, and nontransactional writes are not production architecture. Reuse characterized domain behavior and UI concepts instead. |
| Changing allocation policy during migration | Remaining-options/constrained-slot ordering, independent locks, and preview/commit would change the agreed baseline. They are explicitly post-MVP, not architectural prerequisites. |

## 9. Implementation limits for this task

Task 0.4 created this decision record only; Task 1.3 adds the synchronous persistence decision and empty migration baseline. Neither task implements application entity schemas, the Python allocator, credential setup, dashboard configuration, or deployment. Follow the numbered execution plan for those changes. Hosted timezone interpretation and concrete student-token transport remain assigned to their respective implementation tasks rather than being implied by this document.
