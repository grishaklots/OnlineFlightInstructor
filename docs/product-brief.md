# Flight Instructor App — Product Brief

## 1. Product Overview

A web application for flight instructors to manage students, record training activity, and fairly distribute scarce airport landing slots.

The product has three user types:

- **Administrator** — manages instructor accounts.
- **Instructor** — manages students, training records, landing slots, preferences, and allocations.
- **Student** — accesses their own information and landing-slot preferences through a secure personal link.

An existing local-only landing-slot allocation POC is available in `landing-slots.html`. Its useful behavior and UI concepts should be reused where practical.

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
- View available landing slots.
- Add/remove their landing-slot preferences while preferences are open.
- View their own final assignments.

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

### Landing windows

Instructors can create landing windows containing multiple slots.

A landing window has:

- Name
- Start/end date
- Optional description
- Status: Draft, Open, Allocated, or Closed

A landing slot has:

- Date/time
- Optional end time/duration
- Optional location/runway
- Optional notes
- Availability state

The primary instructor experience includes a monthly calendar.

---

## 10. Landing Slot Preferences

A preference, called an **upvote** in the UI where appropriate, means a student wants a specific landing slot.

Preferences can be recorded in two ways:

1. The instructor selects students directly on a slot using student chips.
2. A student selects slots through their personal link.

Rules:

- A student can have at most one preference per slot.
- Students can change preferences only while the landing window is open.
- Clearing/changing an assignment does not delete preferences.
- Instructor and student preference changes use the same underlying data model.

The instructor can also view a read-only preference matrix with students as rows and slots as columns.

---

## 11. Automatic Allocation

The allocation tool distributes slots among students who preferred them.

### Core rules

- Each slot can have at most one assigned student.
- Automatic allocation assigns a student only to a slot they preferred.
- Students with fewer existing assignments have priority.
- When assignment counts are equal, students with fewer remaining preferred options have priority.
- More constrained slots should be processed first.
- Identical input must produce identical results using a stable tie-breaker.

### Manual instructor control

An instructor can:

- Manually assign any student to a slot, even without a preference.
- Replace an assignment.
- Clear an assignment without deleting preferences.
- Lock/unlock a manual assignment.

Locked manual assignments are preserved during automatic recalculation.

### Allocation workflow

Automatic allocation should support:

1. Calculate/preview proposed assignments.
2. Show changes, warnings, and allocation explanations.
3. Commit the result explicitly.

Allocation commits must be atomic and must reject stale results if underlying preferences, slots, or assignments changed after preview.

---

## 12. Allocation Visibility

The instructor should be able to see:

- Assigned vs. available slots and utilization.
- Preference count per slot.
- Allocation count per student.
- Students who expressed preferences but received no assignment.
- Students with limited preference coverage.
- Manual assignments made without a corresponding preference.
- Manual vs. automatic assignments.

---

## 13. Existing `landing-slots.html` POC

The existing POC currently:

- Runs entirely in the browser.
- Stores data in local storage.
- Maintains a simple name-only student list.
- Allows instructors to record upvotes.
- Performs landing-slot allocation.
- Supports manual assignment behavior.

The new application should reuse useful behavior rather than blindly rewrite or copy the file.

Migration approach:

1. Analyze and document POC behavior.
2. Capture representative behavior as test fixtures.
3. Port allocation logic into a pure Python domain component.
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
- LandingWindow
- LandingSlot
- SlotPreference
- SlotAssignment
- AllocationRun

All instructor-owned entities must enforce instructor isolation on the backend.

---

## 15. Security Requirements

- Instructor authentication uses Supabase Auth.
- FastAPI validates authentication and authorization server-side.
- The backend derives instructor identity from the validated token, never from client-supplied instructor IDs.
- Supabase service-role and database credentials never appear in frontend code.
- Student access tokens are secure, revocable, and stored only as hashes.
- Sensitive student data and authentication tokens must not be written to logs.
- Public student endpoints should be rate-limited.
- Destructive actions require explicit confirmation.
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
7. Instructors can create landing windows and slots.
8. Instructors and students can submit slot preferences.
9. Automatic allocation follows the documented fairness rules.
10. Instructors can manually override assignments and preserve them during recalculation.
11. Clearing assignments preserves preferences.
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
