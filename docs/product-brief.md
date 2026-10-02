# Flight Instructor Management and Landing Slot Allocation

## 1. Document Status

- Status: Draft
- Target release: MVP
- Primary users: Flight instructors
- Secondary users: Flight students
- Administrative users: System administrators
- Existing asset to migrate: `landing-slots.html`

---

## 2. Product Summary

The product is a web application that helps flight instructors:

1. Manage students and their training records.
2. Record instructional sessions, including flights, simulator sessions, briefings, debriefings, and other activities.
3. Share selected student information through secure read-only student links.
4. Collect student preferences for airport landing slots.
5. Allocate scarce landing slots fairly and transparently.
6. Review demand, utilization, assignments, and allocation warnings.

The application replaces the existing local-only landing slot allocation proof of concept with a hosted multi-user system while preserving its useful workflows and allocation behavior.

---

## 3. Product Goals

### 3.1 Primary goals

- Give each instructor a private workspace for managing students.
- Keep a simple digital flight log and instructional session history.
- Enable students to access their own records without requiring a full user account.
- Allow both instructors and students to submit landing-slot preferences.
- Allocate landing slots fairly among interested students.
- Preserve instructor control over all final assignments.
- Migrate and reuse the existing landing-slot proof of concept wherever practical.
- Support the same application behavior during local development and public deployment.

### 3.2 Non-goals for the MVP

The following are outside the initial MVP unless explicitly added later:

- Aircraft fleet management.
- Aircraft maintenance tracking.
- Payments, invoices, or subscription billing.
- Airport authority system integration.
- Official regulatory logbook certification.
- Electronic signatures.
- Native mobile applications.
- Direct student-instructor messaging.
- Automated email, SMS, or push notifications.
- Multi-instructor ownership of the same student.
- Complex organizational hierarchies or flight-school tenancy.
- Automatic allocation across multiple instructors.

---

## 4. User Roles

### 4.1 Administrator

A system-level operator who can manage instructor accounts.

Permissions:

- View instructor accounts.
- Create instructor accounts.
- Suspend and reactivate instructor accounts.
- Delete instructor accounts.
- Reset or initiate password recovery for an instructor.
- View basic account metadata.
- Access administrative audit records.

An administrator must not automatically receive access to student training data unless such access is explicitly designed and authorized.

### 4.2 Instructor

An authenticated application user.

Permissions:

- Sign in and sign out.
- Manage only their own students.
- Manage sessions and flight log entries for their students.
- Create and revoke student access links.
- Create and manage landing windows and slots.
- Record preferences on behalf of students.
- Run automatic allocation.
- Create, modify, clear, and lock manual assignments.
- View allocation metrics, warnings, and preference matrices.

### 4.3 Student

A student is not an authenticated instructor account.

A student accesses a limited portal through a secure, revocable, read-only link.

Permissions:

- View selected personal details.
- View their own session history.
- View their own flight log.
- View available landing slots exposed to them.
- Add or remove their own slot preferences.
- View their own final slot assignments.

A student must not:

- View another student's information.
- View other students' preferences.
- View instructor administration functions.
- Modify session or logbook information.
- Assign landing slots.
- Run allocation.

Although most student data is read-only, slot preference submission is an explicitly permitted write operation.

---

## 5. Core Concepts

### 5.1 Instructor workspace

Each instructor has an isolated workspace. All students, sessions, landing windows, preferences, and assignments belong to that instructor.

### 5.2 Student

A person receiving instruction from an instructor.

A student belongs to exactly one instructor in the MVP.

### 5.3 Session

A session represents any instructor-student interaction. It is intentionally broader than a flight.

Supported session types:

- Flight
- Simulator
- Briefing
- Debriefing
- Ground lesson
- Other

A single session may contain both briefing and debriefing information.

### 5.4 Flight log entry

A structured record of flight activity. A flight log entry may optionally be associated with a session.

The MVP flight log is intentionally lightweight and is not presented as a legally certified aviation logbook.

### 5.5 Landing window

A date or period for which the instructor manages landing slots.

### 5.6 Landing slot

A specific landing opportunity within a landing window.

Each slot may have at most one assigned student.

### 5.7 Preference

A student's indication that they want a particular landing slot.

The UI may call this an "upvote," but the domain model should use a neutral term such as `SlotPreference`.

### 5.8 Assignment

The allocation of exactly one student to a landing slot.

Assignments may be:

- Automatic
- Manual

Manual assignments must be preserved during automatic recalculation unless the instructor explicitly unlocks or removes them.

---

## 6. Functional Requirements

## 6.1 Authentication and Account State

### AUTH-001: Instructor login

The application shall allow an active instructor to sign in using a username or email and password.

### AUTH-002: Suspended account

A suspended instructor shall not be allowed to access authenticated application functions.

### AUTH-003: Logout

An instructor shall be able to sign out.

### AUTH-004: Session persistence

An authenticated session may remain active across page refreshes until expiration or logout.

### AUTH-005: Authorization isolation

An instructor shall only be able to access resources owned by that instructor.

Object identifiers alone must never grant access to another instructor's data.

---

## 6.2 Administrator Functions

### ADMIN-001: List instructor accounts

An administrator shall be able to list instructor accounts and see:

- Display name
- Login identifier
- Account state
- Creation date
- Last update date

### ADMIN-002: Create instructor account

An administrator shall be able to create a new instructor account.

### ADMIN-003: Suspend instructor account

An administrator shall be able to suspend an instructor account without deleting its data.

### ADMIN-004: Reactivate instructor account

An administrator shall be able to reactivate a suspended account.

### ADMIN-005: Delete instructor account

An administrator shall be able to delete an instructor account.

The implementation must define whether deletion is immediate or uses a retention period. For the MVP, soft deletion of the instructor and their data is recommended even if the UI presents the action as deletion.

### ADMIN-006: Account administration audit

Administrative account lifecycle operations shall be audited.

---

## 6.3 Student Management

### STUDENT-001: Student list

The instructor's main view shall display their students.

The list should support:

- Search by name
- Sorting
- Opening a student's details
- Adding a student
- Editing a student
- Deleting a student

### STUDENT-002: Create student

An instructor shall be able to create a student with:

Required fields:

- First name
- Last name

Optional fields:

- Birth date
- Email
- Phone number
- General notes

### STUDENT-003: Edit student

An instructor shall be able to modify a student's details.

### STUDENT-004: Delete student

An instructor shall be able to permanently delete a student.

The UI must:

- Clearly state that deletion is permanent.
- Display which related records will be removed.
- Require an explicit confirmation action.
- Prevent accidental submission.

Related sessions, flight log entries, slot preferences, and future assignments must be handled consistently according to the deletion policy.

Recommended behavior:

- Delete the student, sessions, flight log entries, preferences, and student access tokens.
- Clear future slot assignments referring to the student.
- Preserve non-personal aggregate allocation data only if required.

### STUDENT-005: Empty state

The main view shall guide an instructor to create their first student when no students exist.

---

## 6.4 Student Details

### PROFILE-001: Student profile

The student details view shall display:

- First name
- Last name
- Birth date
- Contact information
- General notes
- Session history
- Flight log
- Student link status

### PROFILE-002: Student summary

The student view should show summary information such as:

- Total sessions
- Total flight sessions
- Most recent session
- Upcoming landing-slot assignments

Derived values must be computed from stored records rather than independently maintained counters.

---

## 6.5 Sessions

### SESSION-001: Create session

An instructor shall be able to record a session for a student.

Fields:

- Session type
- Start date and time
- Duration
- Location, optional
- Aircraft or simulator identifier, optional
- Instructor notes
- Briefing notes
- Debriefing notes
- Student-visible summary
- Internal instructor-only notes
- Flight occurred, yes or no

### SESSION-002: Briefing-only session

The system shall support sessions with no associated flight.

### SESSION-003: Simulator session

The system shall support simulator sessions without treating them as aircraft flights.

### SESSION-004: Edit session

An instructor shall be able to modify an existing session.

### SESSION-005: Delete session

An instructor shall be able to delete a session after explicit confirmation.

### SESSION-006: Session visibility

The instructor shall be able to control which notes are visible through the student link.

Internal instructor-only notes must never appear in the student portal.

---

## 6.6 Flight Log

### LOG-001: Flight log entry

An instructor shall be able to create a flight log entry containing:

- Date
- Departure airport
- Arrival airport
- Aircraft identifier, optional
- Aircraft type, optional
- Flight duration
- Number of landings, optional
- Day or night classification, optional
- Comments
- Associated session, optional

### LOG-002: Flight log list

The student details page shall show flight log entries in reverse chronological order.

### LOG-003: Flight log editing

An instructor shall be able to create, edit, and delete flight log entries.

### LOG-004: Student access

A student shall be able to view their flight log through their student link.

---

## 6.7 Student Access Links

### LINK-001: Generate link

An instructor shall be able to generate a unique access link for a student.

### LINK-002: Secure token storage

The raw access token must not be stored in the database. Only a cryptographic token hash shall be stored.

### LINK-003: Revoke link

An instructor shall be able to revoke a student link immediately.

### LINK-004: Regenerate link

An instructor shall be able to replace an existing link. Regeneration invalidates the previous link.

### LINK-005: Expiration

The instructor should be able to configure link expiration.

For the MVP, links may default to no expiration while remaining revocable.

### LINK-006: Student isolation

A student link shall grant access to exactly one student's permitted data.

### LINK-007: Privacy

Student pages shall not be indexed by search engines and must not expose private data through page metadata, logs, analytics, or error messages.

---

## 6.8 Landing Windows and Slots

### SLOT-001: Create landing window

An instructor shall be able to create a named landing window with:

- Name
- Start date
- End date
- Optional description
- Status

Suggested statuses:

- Draft
- Open for preferences
- Allocation completed
- Closed

### SLOT-002: Create slot

An instructor shall be able to add a slot with:

- Start date and time
- Optional end time or duration
- Optional runway or location
- Optional notes
- Availability state

### SLOT-003: Modify slot

An instructor shall be able to edit an unclosed landing slot.

### SLOT-004: Delete slot

An instructor shall be able to delete a slot after confirmation.

If the slot has preferences or an assignment, the interface must show the impact before deletion.

### SLOT-005: Monthly calendar

The instructor shall be able to review landing slots in a monthly calendar.

Each slot should show:

- Time
- Preference count
- Assigned student, if any
- Assignment type
- Warning state, if any

---

## 6.9 Preferences

### PREF-001: Instructor-recorded preference

An instructor shall be able to add or remove a student's preference directly from a landing slot by selecting student chips.

### PREF-002: Student-recorded preference

A student shall be able to add or remove their own preference through their student link while the landing window is open.

### PREF-003: Unique preference

A student may have at most one preference record for a given slot.

### PREF-004: Preference preservation

Clearing or changing an assignment shall not remove preferences.

### PREF-005: Preference closure

Students shall not be able to modify preferences after the landing window is closed.

The instructor may still adjust preferences if explicitly allowed by the business workflow.

### PREF-006: Preference matrix

The instructor shall be able to view a read-only matrix where:

- Rows represent students.
- Columns represent landing slots.
- Cells indicate preference and assignment status.

---

## 6.10 Automatic Allocation

### ALLOC-001: One student per slot

A landing slot may have zero or one assigned student.

### ALLOC-002: Eligible students

Automatic allocation shall only assign a student to a slot they preferred.

Manual assignment is exempt from this restriction.

### ALLOC-003: Primary fairness objective

The allocator shall prefer students who currently have fewer assignments.

### ALLOC-004: Preference scarcity objective

When students have the same assignment count, the allocator shall prefer the student with fewer remaining preferred options.

### ALLOC-005: Deterministic behavior

Given the same inputs and algorithm version, allocation should produce the same result.

A deterministic tie-breaker must be defined, such as stable student ID ordering.

The production fairness policy must not depend solely on array order from the UI.

### ALLOC-006: Preserve manual assignments

Automatic recalculation shall preserve locked manual assignments.

### ALLOC-007: Exclude occupied slots

A slot with a preserved manual assignment shall not be reassigned automatically.

### ALLOC-008: Clear automatic assignments

The instructor shall be able to clear automatic assignments without removing preferences or locked manual assignments.

### ALLOC-009: Allocation preview

Before committing a new automatic allocation, the system should display a preview containing:

- Proposed assignments
- Unassigned slots
- Students with preferences but no assignments
- Fairness warnings
- Changes from the current allocation

### ALLOC-010: Atomic commit

An allocation run shall be committed atomically. Partial assignment updates must not be saved.

### ALLOC-011: Concurrency control

The application shall detect if slots, preferences, or assignments changed between preview and commit.

If the data changed, the commit must fail safely and require recalculation.

### ALLOC-012: Allocation audit

Each committed allocation run shall record:

- Instructor
- Timestamp
- Algorithm version
- Input snapshot or reproducible input reference
- Result
- Manual assignments preserved
- Warnings

---

## 6.11 Manual Assignment

### MANUAL-001: Assign any student

An instructor shall be able to manually assign any of their students to an available slot, even if the student did not prefer that slot.

### MANUAL-002: Manual assignment warning

When assigning a student without a preference, the UI shall clearly identify the assignment as an override.

### MANUAL-003: Preserve manual assignment

Manual assignments shall be locked by default and preserved during recalculation.

### MANUAL-004: Replace assignment

Replacing an existing assignment shall require explicit confirmation.

### MANUAL-005: Clear assignment

An instructor shall be able to clear an assignment without deleting slot preferences.

### MANUAL-006: Unlock assignment

An instructor shall be able to make a manual assignment eligible for replacement by a later calculation.

---

## 6.12 Allocation Visibility

### METRIC-001: Utilization

Display the number and percentage of slots that are assigned.

### METRIC-002: Student allocation count

Display the number of assigned slots per student.

### METRIC-003: Demand

Display the number of preferences per slot.

### METRIC-004: Limited preference coverage

Warn when a student has too few preferred options to have a reasonable chance of allocation.

The exact warning threshold shall be configuration-driven.

### METRIC-005: Unmet demand

Identify students who expressed preferences but received no assignment.

### METRIC-006: Unrequested assignment

Clearly mark manual assignments where the assigned student did not prefer the slot.

---

## 7. Allocation Algorithm Specification

## 7.1 Inputs

The allocation engine receives:

- Available slots.
- Active students.
- Student-slot preferences.
- Existing locked manual assignments.
- Optional existing automatic assignments.
- Algorithm version.
- Stable deterministic tie-break key.

## 7.2 Constraints

- At most one student per slot.
- A student may receive multiple slots unless a configurable maximum is introduced.
- Automatic assignments require an existing preference.
- Locked manual assignments are immutable during that allocation run.
- A student and slot must belong to the same instructor workspace.

## 7.3 Baseline allocation strategy

For each unassigned slot:

1. Determine the students who preferred the slot.
2. Exclude ineligible or inactive students.
3. Rank eligible students by:
   1. Fewest total assignments after locked assignments and allocations already made in this run.
   2. Fewest remaining preferred unassigned slots.
   3. Stable deterministic tie-break key.
4. Assign the highest-ranked student.
5. Update the in-memory assignment counts and remaining-option counts.
6. Continue until all slots have been evaluated.

## 7.4 Slot processing order

To protect scarce opportunities, process slots in this order:

1. Slots with the fewest eligible interested students.
2. Slot start date and time.
3. Stable slot ID.

This reduces the likelihood that highly constrained slots are consumed by students who have many alternatives.

## 7.5 Algorithm isolation

The allocation algorithm shall be implemented as a pure domain component:

- No database access.
- No HTTP access.
- No UI dependencies.
- No system clock dependency unless supplied explicitly.
- Input DTOs in, allocation result out.

This allows reuse of the allocation logic from `landing-slots.html` after it is characterized with tests.

## 7.6 Fairness limitations

The MVP implements an explainable heuristic, not a mathematically proven globally optimal allocation.

Future versions may introduce:

- Maximum assignments per student.
- Weighted preferences.
- Priority levels.
- Historical allocation balancing.
- Optimization-based matching.
- Randomized but auditable tie-breaking.

---

## 8. Data Model

## 8.1 InstructorProfile

- Id
- AuthenticationUserId
- DisplayName
- Email
- Status
- CreatedAt
- UpdatedAt
- DeletedAt, optional

## 8.2 Student

- Id
- InstructorId
- FirstName
- LastName
- BirthDate, optional
- Email, optional
- Phone, optional
- Notes, optional
- CreatedAt
- UpdatedAt

## 8.3 TrainingSession

- Id
- InstructorId
- StudentId
- SessionType
- StartTime
- DurationMinutes
- Location, optional
- AircraftOrSimulator, optional
- BriefingNotes, optional
- DebriefingNotes, optional
- StudentVisibleSummary, optional
- InternalNotes, optional
- FlightOccurred
- CreatedAt
- UpdatedAt

## 8.4 FlightLogEntry

- Id
- InstructorId
- StudentId
- SessionId, optional
- FlightDate
- DepartureAirport
- ArrivalAirport
- AircraftIdentifier, optional
- AircraftType, optional
- DurationMinutes
- LandingCount, optional
- DayNightClassification, optional
- Comments, optional
- CreatedAt
- UpdatedAt

## 8.5 StudentAccessToken

- Id
- InstructorId
- StudentId
- TokenHash
- ExpiresAt, optional
- RevokedAt, optional
- CreatedAt
- LastUsedAt, optional

## 8.6 LandingWindow

- Id
- InstructorId
- Name
- Description, optional
- StartDate
- EndDate
- Status
- CreatedAt
- UpdatedAt

## 8.7 LandingSlot

- Id
- InstructorId
- LandingWindowId
- StartTime
- EndTime, optional
- Location, optional
- Runway, optional
- Notes, optional
- IsAvailable
- RowVersion or concurrency token
- CreatedAt
- UpdatedAt

## 8.8 SlotPreference

- Id
- InstructorId
- LandingSlotId
- StudentId
- Source
- CreatedAt
- UpdatedAt

Unique constraint:

- LandingSlotId + StudentId

## 8.9 SlotAssignment

- Id
- InstructorId
- LandingSlotId
- StudentId
- AssignmentType
- IsLocked
- AllocationRunId, optional
- CreatedAt
- UpdatedAt

Unique constraint:

- LandingSlotId

## 8.10 AllocationRun

- Id
- InstructorId
- LandingWindowId
- AlgorithmVersion
- InputRevision
- Status
- ResultJson or audit representation
- CreatedAt
- CommittedAt, optional

---

## 9. API Areas

Recommended route groups:

- `/api/auth`
- `/api/admin/instructors`
- `/api/students`
- `/api/students/{studentId}/sessions`
- `/api/students/{studentId}/flight-log`
- `/api/students/{studentId}/access-link`
- `/api/landing-windows`
- `/api/landing-windows/{windowId}/slots`
- `/api/landing-slots/{slotId}/preferences`
- `/api/landing-slots/{slotId}/assignment`
- `/api/landing-windows/{windowId}/allocation/preview`
- `/api/landing-windows/{windowId}/allocation/commit`
- `/api/student-portal/{token}`
- `/api/student-portal/{token}/preferences`

API endpoints must validate ownership on the server. Client-side filtering is not an authorization mechanism.

---

## 10. Security and Privacy Requirements

### SEC-001: Authentication

Instructor authentication shall use a managed identity provider.

### SEC-002: Backend authorization

The backend shall validate authentication tokens and derive the instructor identity from the validated token.

### SEC-003: Service credentials

Database administrative credentials and authentication service-role credentials must exist only in backend configuration.

They must never be exposed to the React application.

### SEC-004: Tenant isolation

Every instructor-owned query and mutation shall enforce instructor ownership.

### SEC-005: Student token protection

Student access tokens shall:

- Contain sufficient entropy.
- Be transmitted only over HTTPS.
- Be stored as hashes.
- Be revocable.
- Avoid embedding student identifiers or personal information.

### SEC-006: Sensitive student data

Birth dates, notes, briefing records, and debriefing records must not appear in logs.

### SEC-007: Destructive operations

Permanent deletion shall require explicit confirmation and server-side authorization.

### SEC-008: Auditability

Administrative actions, link lifecycle operations, manual assignments, and allocation commits shall be auditable.

### SEC-009: Rate limiting

Public student-link endpoints and authentication endpoints should be rate-limited.

### SEC-010: Data export and deletion

The architecture should allow later implementation of instructor and student data export or deletion requests.

---

## 11. User Experience Requirements

- Responsive layout for desktop, tablet, and mobile.
- Primary instructor navigation:
  - Students
  - Landing slots
  - Account
- Administrator navigation must be separate from instructor functionality.
- Destructive actions use warning styling and explicit confirmation.
- Manual and automatic assignments are visually distinguishable.
- Student-visible and instructor-only notes are clearly differentiated while editing.
- Allocation results include a concise explanation of why each student was selected.
- Loading, empty, success, and error states are defined for every main view.
- Accessibility support includes keyboard navigation, semantic HTML, labels, focus handling, and adequate contrast.

---

## 12. Technical Architecture

## 12.1 Recommended stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- A lightweight component system
- Hosted on Vercel

### Backend

- ASP.NET Core Web API
- Current supported .NET release selected at project creation
- Entity Framework Core
- PostgreSQL provider
- OpenAPI
- Structured logging
- Hosted on a platform that supports ASP.NET Core containers or applications

### Authentication and database

- Supabase Auth
- Supabase PostgreSQL
- Backend validation of Supabase-issued JWTs

### Local development

Preferred:

- Local PostgreSQL through Docker Compose, or
- Local Supabase stack when authentication integration is being tested

Avoid using SQLite as the main local database if identical production behavior is required. PostgreSQL and SQLite differ in data types, constraints, concurrency, date handling, and migrations.

### Tests

- xUnit for backend unit and integration tests
- Testcontainers for PostgreSQL integration tests
- Vitest and React Testing Library for frontend tests
- Playwright for end-to-end tests

---

## 13. Deployment Model

### Frontend

Deploy the React application to Vercel.

### Backend

Deploy the ASP.NET Core API separately to a container-capable or .NET-capable host.

Vercel should not be assumed to be the primary host for a conventional long-running ASP.NET Core API.

### Database and authentication

Use Supabase for hosted PostgreSQL and managed authentication.

### Environment configuration

Required environments:

- Local
- Test or preview
- Production

Configuration includes:

- API base URL
- Supabase project URL
- Supabase public client key
- Supabase JWT issuer and audience settings
- Backend-only database connection string
- Backend-only Supabase administrative credential
- Allowed frontend origins

Secrets must not be committed to source control.

---

## 14. Existing POC Migration

The existing `landing-slots.html` shall be treated as a behavioral reference and source asset.

Migration process:

1. Inventory the POC's UI, data structures, algorithms, and local-storage keys.
2. Capture current behavior with characterization tests or representative fixtures.
3. Separate the allocation algorithm from DOM and local-storage code.
4. Port the algorithm into a testable backend domain service, unless a deliberate decision is made to keep preview calculation client-side.
5. Recreate the useful POC UI behaviors as React components.
6. Replace local storage with API-backed persistence.
7. Map POC students to canonical server-side student records.
8. Add student-submitted preferences.
9. Preserve manual assignment and recalculation behavior.
10. Compare old and new allocation outputs using shared fixtures.
11. Remove remaining runtime dependency on `landing-slots.html`.

No POC behavior should be considered a product requirement until it is documented and covered by a test.

---

## 15. MVP Acceptance Criteria

The MVP is complete when:

1. An administrator can create, suspend, reactivate, and delete instructor accounts.
2. An active instructor can sign in.
3. A suspended instructor cannot use the application.
4. Instructors can create, edit, view, and permanently delete their own students.
5. Instructors cannot access another instructor's students by changing an identifier.
6. Instructors can record multiple session types.
7. Instructors can maintain a lightweight flight log.
8. Instructors can create, revoke, and regenerate student access links.
9. Students can view only their own permitted information.
10. Students can add and remove their own landing-slot preferences while a window is open.
11. Instructors can create landing windows and slots.
12. Instructors can record preferences on behalf of students.
13. The allocator produces deterministic results from deterministic input.
14. Automatic assignments only use submitted preferences.
15. Manual assignments can ignore preferences and survive recalculation.
16. Clearing assignments does not delete preferences.
17. Each slot has at most one assigned student.
18. Allocation commit is atomic and protected from stale previews.
19. The calendar, preference matrix, utilization, and per-student allocation counts are available.
20. The application runs locally using PostgreSQL and deploys without changing application data-access code.

---

## 16. Open Product Decisions

These decisions should be resolved before their corresponding implementation tasks:

- Whether an instructor is identified by username, email, or both.
- Whether instructor deletion is immediate or retained as soft-deleted data.
- Whether a student may belong to multiple instructors in a future version.
- Whether students should eventually receive authenticated accounts.
- Whether access links expire by default.
- Whether students may see briefing and debriefing notes in full or only a student-visible summary.
- Whether a student may receive unlimited slots in one landing window.
- Whether fairness includes historical allocations from previous landing windows.
- Whether landing slots have a fixed duration.
- Whether slots can be imported in bulk.
- Whether instructors need data export or backup.
- Whether the application will store information subject to aviation-specific regulation.
