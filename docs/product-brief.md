# Flight Instructor App — Product Brief

## 1. Product Overview

A web application for flight instructors to manage students, record training activity, and fairly distribute scarce airport landing slots.

The product has three user types:

- **Administrator** — manages instructor accounts.
- **Instructor** — manages students, training records, landing slots, preferences, and allocations.
- **Student** — accesses their own information and landing-slot preferences through a secure personal link.

An existing local-only landing-slot allocation POC is available in `landing-slots.html`. Its current allocation rules and interactions are the behavioral baseline for the landing-slot tool described below; see [POC analysis](poc-analysis.md) for implementation details and limitations.

Accounts, training records, the student portal, and hosted persistence are planned extensions, not capabilities already present in the POC. Migrating the slots tool must preserve its behavior without preserving browser-storage defects.

---

## 2. Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Hosted on Vercel

### Backend
- Python
- FastAPI
- Hosted on Render

### Data and authentication
- Supabase PostgreSQL
- Supabase Auth
- SQLAlchemy for backend persistence
- Alembic for database migrations

### Development principle
Use PostgreSQL-compatible persistence in development and production. Do not use browser local storage as authoritative application storage.

The React application authenticates instructors through Supabase Auth and sends the Supabase access token to FastAPI. FastAPI validates authentication and enforces authorization and instructor ownership.

---

## 3. Administrator Functions

Administrators can:

- Create instructor accounts.
- List instructor accounts.
- Suspend and reactivate instructors.
- Delete instructor accounts.
- Initiate password recovery/reset.

Suspended instructors cannot use authenticated application functionality.

---

## 4. Instructor Authentication

Instructors sign in using Supabase Auth with email/username-compatible login and password.

All instructor-owned data must be isolated. An instructor must never access another instructor's students or landing-slot data by changing an object identifier.

---

## 5. Student Management

The instructor's main view is the student list.

Instructors can:

- Add students.
- Search and view students.
- Edit students.
- Permanently delete students.

Student fields include:

- First name
- Last name
- Birth date
- Email, optional
- Phone, optional
- General notes, optional

Student deletion is permanent and requires explicit confirmation.

---

## 6. Training Sessions

Training records are modeled as **sessions**, not flights, because instructor/student activity may include training without a flight.

Session types include:

- Flight
- Simulator
- Briefing
- Debriefing
- Ground lesson
- Other

A session can contain:

- Date/time
- Duration
- Location
- Aircraft or simulator identifier
- Briefing notes
- Debriefing notes
- Student-visible summary
- Instructor-only notes
- Whether a flight occurred

Instructors can create, edit, view, and delete sessions.

Instructor-only notes must never appear in the student portal.

---

## 7. Flight Log

Each student has a lightweight digital flight log.

A flight-log entry can contain:

- Date
- Departure airport
- Arrival airport
- Aircraft identifier/type
- Flight duration
- Number of landings
- Day/night classification
- Comments
- Optional related training session

This is a simple training record for the MVP, not a regulatory-grade logbook.

---

## 8. Student Personal Link

Each student can have a unique, secure, revocable link shared by their instructor.

Through the link, the student can:

- View their profile information exposed by the instructor.
- Review their sessions.
- Review their flight log.
- View their instructor's exposed landing slots, including Requested and Allocated slots, without seeing other students' identities or assignments.
- Add/remove their own landing-slot preferences.
- View their own current assignments.

Students cannot:

- Edit training/session/logbook data.
- See another student's data or preferences.
- Assign slots.
- Run allocation.
- Access instructor or administration functions.

Student links must use high-entropy opaque tokens. Store only a secure token hash in the database. Links can be revoked/regenerated.

---

## 9. Landing Slot Management

### Purpose

Help instructors distribute limited airport landing slots fairly among interested students, with at most one student assigned to each slot.

### Monthly slot workspace

Slots are individual landing windows, grouped for display and allocation by their start month. There is no separate multi-slot `LandingWindow` entity or Draft/Open/Allocated/Closed lifecycle in the baseline tool.

The instructor's roster spans all months. The primary experience is a monthly calendar with previous/next month and Today navigation, a student-equity sidebar, and a read-only preference matrix.

A landing slot has:

- A local start date/time, supported from January 2000 through December 2099.
- A required end time later than the start on the same date; overnight slots are not supported.
- A required airport / runway label.
- At most one assigned student and an assignment source: automatic or manual.
- A derived status: Available when unassigned without upvotes, Requested when unassigned with upvotes, or Allocated when assigned.

Dates display as `DD/MM/YYYY` and times as 24-hour `HH:MM`. Changing From proposes To one hour later; To remains editable and must satisfy the same-day rule. Adding a slot selects its month. Duplicate start times for the same trimmed, case-insensitive airport/runway label are rejected. Overlapping slots and simultaneous assignments to one student are not prevented by the baseline.

The POC uses device-local wall times, without a stored timezone. The hosted migration must document how those times are interpreted rather than silently converting them. Legacy single-time slots receive a one-hour end time where valid; otherwise they remain marked as incomplete. An incomplete slot cannot be manually assigned, and any incomplete slot blocks computation for its month until repaired or removed.

Removing a slot requires confirmation and removes its assignment and associated upvotes. Removing a student releases all their assignments, including manual assignments, and removes their preferences across all months.

---

## 10. Landing Slot Preferences

A preference, called an **upvote** in the UI where appropriate, means a student wants a specific landing slot.

Preferences can be recorded in two ways:

1. The instructor selects students directly on a slot using student chips.
2. A student selects slots through their personal link.

Rules:

- A student can have at most one preference per slot.
- Preferences are boolean, unranked selections. There is no open/closed-window or past-date restriction in the baseline tool.
- Clearing/changing an assignment does not delete preferences.
- Instructor and student preference changes use the same underlying data model.
- Preference edits update demand and summaries immediately but do not trigger allocation or remove an existing assignment. An automatic assignment can remain after its upvote is removed until the instructor clears, replaces, or recomputes it.
- Manual overrides retain editable upvotes; dimmed chips indicate that upvotes do not change the current manual assignment.

The instructor can also view a read-only preference matrix with students as rows and slots as columns.

---

## 11. Automatic Allocation

The allocation tool distributes slots among students who preferred them.

### Current deterministic greedy policy

Compute operates on the displayed month only:

1. Preserve every manual assignment in that month and count it toward its student's total. Clear that month's previous automatic assignments. Other months are untouched and do not contribute to priority.
2. Find students with at least one still-unassigned upvoted slot in the month.
3. Give the next turn to the student with the fewest assignments in this calculation. Break ties by fewer **total monthly upvotes**, then stable student ID in ascending, non-locale string order.
4. Assign that student's earliest still-unassigned upvoted slot, ordered by local start date/time and then stable slot ID.
5. Increment their assignment count and repeat until no unassigned upvoted slot remains.

The monthly upvote count is fixed during computation: it includes preferences for already allocated or manually occupied slots. It is not the count of remaining free options. Slots are not processed by scarcity or demand.

Each slot has at most one assignee, and each new automatic assignment requires an upvote. There is no per-student quota, historical assignment weighting, overlap avoidance, or maximum count. Identical input, IDs, and month must produce identical results. Recreating equivalent students/slots with different IDs can change tied outcomes.

This is greedy equity, not a globally optimal fairness guarantee: an interested student can remain unassigned even when a different distribution could give everyone one slot. The migration must reproduce this policy rather than introduce a different optimizer.

### Manual instructor control

An instructor can:

- Manually assign any student to a slot, even without a preference.
- Replace an assignment.
- Clear an assignment without deleting preferences.
- Clear every assignment across all months, including manual assignments, after explicit confirmation, while preserving students, slots, and upvotes.

All manual assignments are preserved during automatic recalculation; there is no separate persisted lock/unlock state. Manual counts can exceed upvote counts.

The slot dialog's Enable force assignment switch enables/disables editing controls only. Switching it off does not clear an assignment or make a manual assignment eligible for recalculation. A single-slot clear action works regardless of this switch and does not require a separate confirmation.

### Allocation workflow

The instructor clicks Compute fair distribution to recalculate and immediately apply the displayed month's result. Show a busy state, then the allocated/total count and number of manual assignments preserved. There is no separate preview, compare, commit/cancel step, or per-assignment explanation in the baseline.

Validation failures preserve the previous assignments. In the hosted application, this single compute action must load authoritative data and persist atomically, reject conflicting concurrent edits, and report persistence failures explicitly. These reliability protections must not introduce a mandatory preview workflow.

---

## 12. Allocation Visibility

The calendar, roster, matrix, and dashboard reflect the displayed month:

- Total and unassigned slots. Unassigned includes Requested slots; it does not mean only slots with status Available.
- Assigned slots, broken down into manual and automatic counts.
- Allocation efficiency: assigned / total slots, rounded to a whole percentage; zero when no slots exist.
- Upvote count per slot and total monthly upvotes.
- Per-student assignment/upvote counts and monthly allocation average, using all roster students, including those without preferences.
- Independent upvote and assignment indicators, including manual assignments without upvotes.
- Coverage alerts and underallocation warnings.

Preserve the current warning formulas. A student is underallocated when they have zero assignments or fewer than the monthly average. Preference coverage is low when their monthly upvotes are fewer than `ceil(total monthly slots / roster size)`. With slots present, an underallocated student receives a Coverage warning if coverage is low, otherwise an Unfulfilled warning. With no slots there are no allocation warnings; with no students the average and coverage-alert count are zero.

The Coverage alerts card counts only Coverage warnings, not every unassigned student. Zero-assignment/low-coverage students receive the stronger Critical label. These warnings are heuristic signals, not causal explanations or allocator inputs. Allocated/upvoted counts are not quotas; manual assignments can exceed the denominator.

The matrix is read-only, with students as rows, monthly slots as columns, and distinct automatic/manual outlines. Preference editing happens through slot-dialog chips; an Assigned badge is independent of upvote selection. Missing end times must remain visibly marked.

---

## 13. Existing `landing-slots.html` POC

The existing POC currently:

- Runs entirely in the browser.
- Stores data in local storage.
- Maintains a simple name-only student list.
- Allows instructors to record upvotes.
- Computes the displayed month's deterministic greedy distribution.
- Preserves all manual assignments during recomputation.
- Clears individual assignments or all-month assignments without deleting upvotes.
- Provides a calendar, student-equity sidebar, read-only matrix, and monthly metrics/warnings.
- Exports the whole local workspace as JSON and validates/conditionally upgrades JSON imports before confirmed replacement, not merging.
- Starts empty and supports confirmed full-workspace reset.

The POC stores schema version 2 under `slotops.workspace.v1` and supports restoration of version-1 single-time slots. Imports/exports contain the name-only roster, slots, preferences, assignments, and displayed month. Local JSON replacement/reset is not permission to erase unrelated training records in the hosted application; broader hosted data-transfer/backup features remain post-MVP.

The new application should reuse this allocation behavior and useful UI interactions rather than blindly copy the file. Preserve independent preferences/assignments, explicit all-month destructive scope, accessible controls, and visible save/error states; replace best-effort localStorage writes with reliable backend persistence.

Migration approach:

1. Analyze and document POC behavior.
2. Capture representative behavior as test fixtures.
3. Port the same monthly, student-first allocation policy into a pure Python domain component and verify fixture parity; do not replace it with a constrained-slot or remaining-options policy.
4. Recreate useful UI interactions in React.
5. Replace local storage with the FastAPI/Supabase persistence model.
6. Extend preferences so students can submit their own through personal links.

---

## 14. Core Data Entities

The expected model consists of:

- InstructorProfile
- Student
- TrainingSession
- FlightLogEntry
- StudentAccessToken
- LandingSlot
- SlotPreference
- SlotAssignment
- AllocationRun

All instructor-owned entities must enforce instructor isolation on the backend. Month is the allocation scope, not a separate LandingWindow entity. SlotAssignment records automatic/manual source; manual source itself determines preservation. AllocationRun records the applied monthly calculation for auditing, not a pending preview.

---

## 15. Security Requirements

- Instructor authentication uses Supabase Auth.
- FastAPI validates authentication and authorization server-side.
- The backend derives instructor identity from the validated token, never from client-supplied instructor IDs.
- Supabase service-role and database credentials never appear in frontend code.
- Student access tokens are secure, revocable, and stored only as hashes.
- Sensitive student data and authentication tokens must not be written to logs.
- Public student endpoints should be rate-limited.
- Student/slot deletion and clearing all assignments require explicit confirmation; single-slot clearing and manual replacement follow the direct POC controls.
- Administrative and allocation-sensitive actions should be auditable.

---

## 16. MVP Completion Criteria

The MVP is complete when:

1. Administrators can manage instructor accounts.
2. Instructors can authenticate securely.
3. Instructor data is isolated from other instructors.
4. Instructors can manage students.
5. Instructors can record sessions and flight-log entries.
6. Students can securely view their own permitted records through a personal link.
7. Instructors can create individual landing slots and manage them in a monthly calendar.
8. Instructors and students can submit slot preferences.
9. Automatic allocation reproduces the documented monthly greedy policy and stable tie-breaking.
10. Instructors can manually override assignments, with every manual assignment preserved during recalculation.
11. Clearing one assignment or all-month assignments preserves preferences.
12. Instructors can review the calendar, preference matrix, allocations, metrics, and warnings.
13. The full local flow works with React, FastAPI, Supabase Auth, and PostgreSQL.
14. The hosted application works with React on Vercel, FastAPI on Render, and Supabase for Auth/PostgreSQL.

---

## 17. Out of Scope for MVP

- Aircraft fleet/maintenance management
- Payments and billing
- Airport-system integration
- Regulatory-grade logbook certification
- Electronic signatures
- Native mobile applications
- Instructor/student messaging
- Notifications
- Multi-instructor ownership of one student
- Flight-school tenancy/organization hierarchy
- Historical allocation fairness
- Weighted/ranked preferences
- Alternative constrained-slot/remaining-options allocation policies
- Separate multi-slot landing windows and open/closed preference periods
- Independent manual assignment lock/unlock
- Allocation preview/compare/commit UI and per-assignment explanations
- Configurable coverage-warning policies
- Per-student slot maximums
- Hosted data export/backup/restore UI (distinct from the existing local POC JSON tools)
