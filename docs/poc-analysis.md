# Landing-slot POC analysis

This documents the committed [landing-slots.html](../landing-slots.html) for execution-plan Task 0.2. It describes actual behavior, which now provides the allocation-tool baseline in the [product brief](product-brief.md). Planned authentication, student records, and hosted persistence are not POC capabilities. The POC is unchanged; allocation fixtures and architecture decisions belong to Tasks 0.3 and 0.4.

## 1. Scope and implementation

SlotOps is a standalone, offline, instructor-only planning simulation. HTML, CSS, domain logic, and DOM/event handling live in one file. There are no dependencies, network requests, server, accounts, telemetry, student portal, or airport-clearance integration.

Two scripts separate responsibilities:

- `domain` exposes `globalThis.SlotOps`: validation, legacy restoration, transitions, allocation, and metrics (`landing-slots.html:464-728`).
- `application` owns the in-memory store, localStorage, rendering, dialogs, and events (`landing-slots.html:729-1373`).

Domain transitions clone their input and validate the result before returning it. `normalize` itself mutates its argument, and `validateState` returns the same object. Application persistence and DOM effects are outside the allocator.

## 2. Screen and workflow inventory

There is one page, not multiple routes. Its calendar, roster, metrics, and matrix reflect the displayed month; the roster membership and underlying workspace span all months.

| Surface | Workflow and important behavior |
| --- | --- |
| Header/help | Shows local save status, an instructor-demo avatar, and allocation instructions. The avatar is not an authenticated identity. Help also contains the full-workspace reset action. |
| Allocation toolbar | Compute immediately replaces automatic assignments in the displayed month. The top-level `CLEAR ASSIGNMENT` action clears assignments across **all months**, including manual assignments, after confirmation. |
| Workspace file toolbar | Export backs up the entire workspace. Import validates a selected JSON file, previews counts, and requires confirmation before replacing everything; it does not merge. |
| Monthly calendar | Previous/next month and Today navigation; Sunday-first grid, surrounding-month dates, weekends, and today highlighting. Slot buttons show time range, airport/runway, demand, assignment/status, and missing-end-time badges. Surrounding-month cells do not show their slots. |
| Add landing window | Enter `DD/MM/YYYY`, From/To as `HH:MM`, and airport/runway. From changes reset To to one hour later, even if To had been edited. Successful creation switches to the slot's month; the form is not cleared. |
| Student equity roster | Add a name-only student; inspect monthly preferences, assignments, manual counts, average, progress segments, and warnings. Removal confirms deletion of that student's preferences and release of their assignments across all months. There is no student-edit workflow. |
| Slot-control dialog | Open a calendar slot to toggle student upvote chips, inspect the current assignee/source, enable manual-assignment controls, force/replace an assignment, clear it, or remove the slot. Legacy incomplete slots also show an end-time repair form. |
| Preference matrix | Read-only students-by-monthly-slots table. Upvote marks and automatic/manual assignment outlines are independent. Neither cells nor headings edit data or open the slot dialog. |
| Confirmation dialog | Used for student/slot deletion, global assignment clearing, workspace reset, and replacement of blocked saved data. Cancel receives initial focus. Single-slot assignment clearing and replacement do not require confirmation. |
| Storage banner/toasts | Persistent storage warnings, inline form errors, and transient action messages. Storage failures permit in-memory edits but visibly report that data is not saved. |

Typical flow: start empty, add students and slots, open slots to record upvotes, compute the displayed month, review equity/matrix, then manually override or adjust preferences and recompute. There are no preference-open/closed states or restrictions on editing past slots.

Dialogs support close buttons, Escape via native `<dialog>`, and backdrop clicks outside their bounds. Rendering tries to retain selected focus targets and matrix scroll position. The layout stacks panels on smaller screens; the calendar remains at least 770 pixels wide and scrolls horizontally.

## 3. State and localStorage formats

### The only storage key

`STORAGE_KEY = "slotops.workspace.v1"` (`landing-slots.html:733`). Despite the key's `v1` suffix, current values use **schema version 2**. A single JSON string contains the whole workspace, including `viewMonth`; there are no separate preference, assignment, student, or settings keys.

Example of a valid current workspace:

```json
{
  "version": 2,
  "students": [
    { "id": "student-a", "name": "Student A" }
  ],
  "slots": [
    {
      "id": "slot-a",
      "datetime": "2026-10-02T09:00",
      "endTime": "10:00",
      "runway": "TEST / 01",
      "status": "allocated",
      "allocatedStudentId": "student-a",
      "assignmentSource": "algorithmic"
    }
  ],
  "preferences": [
    { "studentId": "student-a", "slotIds": ["slot-a"] }
  ],
  "viewMonth": "2026-10"
}
```

| Structure/field | Format and invariant |
| --- | --- |
| Workspace | `{version, students, slots, preferences, viewMonth}`; current `version` must be numeric `2`. The three collections must be arrays. |
| `viewMonth` | `YYYY-MM`, January 2000 through December 2099. Persisted UI selection and default allocation/metric scope, not a domain landing-window identifier. |
| Student | `{id, name}`. Unique student ID; nonblank name, at most 60 characters, no ASCII control characters. No profile/contact/training fields. |
| IDs | Strings matching `[a-zA-Z0-9_-]{1,90}`. Student IDs are unique within students and slot IDs within slots; cross-collection uniqueness is not required. UI generates `student-${crypto.randomUUID()}` / `slot-${crypto.randomUUID()}`. |
| Slot `datetime` | Local start string `YYYY-MM-DDTHH:MM`, years 2000-2099, without offset, seconds, or timezone. A `Date` round-trip checks that the date and local clock time really exist on this device. |
| Slot `endTime` | `HH:MM` later than the start, on the same date and valid in the device's timezone; or explicit `null` for incomplete saved/migrated slots. Missing/undefined end times are invalid in v2. |
| Slot `runway` | Required nonblank label, at most 24 characters, no ASCII control characters. New entries are whitespace-normalized and uppercased. It combines airport/runway rather than modeling either separately. |
| Slot identity constraint | No duplicate start plus trimmed, case-insensitive runway. Different runways at the same start are allowed; overlapping ranges are not checked. |
| Slot assignment | `allocatedStudentId` is `null` or an existing student ID. `assignmentSource` is `null` when unassigned, otherwise `"algorithmic"` or `"manual"`. Only one assignee fits in a slot. |
| Slot `status` | Derived and stored: `"allocated"` when assigned; otherwise `"requested"` when demand is nonzero; otherwise `"available"`. It is not an availability/closed-state flag. |
| Preference | `{studentId, slotIds}`. Exactly one record per student, including students with no upvotes. IDs in `slotIds` are unique and must reference existing slots. There is no ranking, weight, source, timestamp, or window scope. |

`validateState` checks referential integrity, collection uniqueness, and status consistency. It does **not** require an algorithmic assignee to have a current upvote, require unique student names, strip unknown properties, or normalize imported labels. Student-name uniqueness and label normalization are creation-time rules, not complete schema invariants (`landing-slots.html:516-542,646-674`).

### Legacy version 1

`restoreState` accepts a version-1 workspace with the same roster, preferences, assignment metadata, and view month but single-time slots. It clones the input, sets version 2, and derives each valid slot's end time as start plus one clock hour. If that range crosses midnight or ends at an invalid local time, `endTime` becomes `null`; existing preferences and assignments remain intact. It then validates the entire result.

Other versions are not upgraded. Invalid migrated data fails restoration rather than being partially salvaged. End-time derivation overwrites any existing end-time property on a v1 slot. A restored v1 localStorage value is rewritten as v2 under the **same key** by startup saving when there is no storage issue (`landing-slots.html:544-557,1371`).

### Persistence lifecycle and error handling

| Operation | Actual behavior |
| --- | --- |
| Initial load | `load` reads the key and JSON-parses/restores it. No value means an empty workspace in the device's current month. |
| Unreadable storage | Starts empty with a warning; storage is not marked blocked, so later saving can be retried. |
| Malformed/invalid saved value | Starts empty, preserves the original saved value, and sets `persistenceBlocked`. Ordinary edits stay in memory without overwriting the invalid value. |
| Normal dispatch | Computes a validated next state, changes memory, attempts saving, then notifies render listeners. A failed write leaves the new in-memory state active. |
| Successful save | `persist` writes compact JSON and clears blocking/warnings; the header becomes `SAVED LOCALLY`. |
| Failed save | Console warning plus banner/header `NOT SAVED`. The latest state remains in memory; refreshing can lose it. |
| Blocked replacement/retry | Explicit confirmation permits overwriting saved data with this tab's current state. An unblocked retry simply attempts the write again. |
| Workspace reset | Creates an empty current-month state, unblocks saving, and writes it. It does not remove the localStorage key. A write failure still leaves memory empty. |
| Another tab changes storage | A matching-key or whole-storage-clear event blocks subsequent ordinary saving. This tab neither adopts nor merges the other state; the banner directs reload or explicit replacement. |

There is no server synchronization or atomic compare-and-swap. The storage event is only a best-effort overwrite guard, not a concurrency protocol (`landing-slots.html:767-837,1343-1371`).

### Import/export

Exports use the same state schema, without an envelope, checksum, or export-version field. `serializeWorkspace` validates and pretty-prints with two-space indentation. A JSON Blob downloads as `slotops-workspace-<UTC ISO timestamp with colons/dots replaced>.json`; the UTC filename timestamp does not convert slot times. The temporary link and object URL are cleaned up.

Import reads a local file with `File.text()`, strips a leading BOM, JSON-parses, and runs restoration/validation. The file picker suggests JSON but content validation is authoritative. Its summary includes all-month student/slot/upvote counts, assignments/manual counts, displayed month, and incomplete slots. Request IDs invalidate stale asynchronous reads when another file is selected or the dialog closes.

Confirmation performs write-first `store.replace`: clone/validate, persist, then replace memory and render. A storage-write failure preserves both the prior saved and in-memory workspace. Import explicitly replaces all months and bypasses the ordinary blocked-save path. No file-size limit is enforced (`landing-slots.html:559-571,829-835,1205-1294`).

### In-memory-only application state

`persistenceBlocked` and `storageIssue` track save warnings; `currentSlotId` selects a dialog slot; `overrideEditing` enables force-assignment controls; `confirmAction` stores a pending callback; `busy` guards computation; `toastTimer` schedules dismissal; and `importRequest`/`pendingImport` manage file validation and confirmation. None is serialized. Store listeners are a `Set` of callbacks; there is no unsubscribe method.

## 4. Preferences, manual assignments, and transitions

Upvotes are boolean membership in a student's `slotIds`, toggled by clicking that student's chip in a slot dialog. There is at most one upvote per student/slot. Chips expose `aria-pressed`, while a separate Assigned badge identifies the assignee even without an upvote.

Preference changes update demand, statuses, metrics, roster, and matrix immediately, but **never recalculate or remove an existing assignment**. Removing the current algorithmic assignee's upvote therefore leaves that assignment in place until recomputation/clearing/replacement. Manual overrides dim chips but keep them editable and retain all preferences.

All `transition` actions except `compute` clone the state, apply the action, normalize statuses, and validate (`landing-slots.html:634-718`):

| Action | Mutation and scope |
| --- | --- |
| `month` | Validate and change only `viewMonth`. |
| `addStudent` | Trim/collapse name whitespace; reject case-insensitive duplicate names; append student and empty preference record. Caller supplies ID. |
| `removeStudent` | Remove student and preference record; clear every assignment to that student across all months, including manual ones. Remaining demand determines released-slot status. |
| `addSlot` | Validate date/range/runway and duplicate start/runway; append unassigned slot; select its month. Caller supplies ID. |
| `setEndTime` | Validate and set a slot's end time without altering assignment or preferences. UI exposes this only for incomplete slots, not general editing. |
| `deleteSlot` | Remove the slot and its assignment; remove its ID from every student's preferences. |
| `vote` | Require existing slot/student; add or remove the slot ID in that student's preferences. No assignment mutation. |
| `assign` | Require existing student/slot and nonnull end time; replace assignee and set source `"manual"`. An upvote is not required or added. |
| `clear` | Clear one slot's assignee/source, retaining all upvotes. Available regardless of the force-control switch. |
| `clearAssignments` | Clear assignee/source on every slot across all months; preserve roster, slots, and preferences. |
| `compute` | Delegate directly to monthly allocation. |

An unknown action or missing referenced entity throws. Rejected domain transitions leave the input unchanged.

**Manual preservation is implicit, not a lock field.** All assignments whose source is `"manual"` survive recomputation. The dialog's force switch only toggles `overrideEditing`; turning it off locks the controls, not the assignment. Opening a manual slot initially enables those controls. There is no persisted lock/unlock action and no way to mark a manual assignment as eligible for recalculation except clearing it or replacing its representation outside the UI.

## 5. Allocation algorithm and tie breaking

`computeFairDistribution(state, month = state.viewMonth)` (`landing-slots.html:599-632`) implements a deterministic **student-first greedy** algorithm:

1. Validate the requested month, clone the workspace, and obtain that month's slots sorted by `datetime`, then slot ID. Reject the whole computation if **any** scoped slot has `endTime === null`, even one with no demand or a manual assignment.
2. Initialize every student's allocation count to zero. Preserve manual assignments in the selected month and count them. Clear all nonmanual assignments in that month. Other-month assignments are untouched and do not count.
3. Build a fixed set of each student's preferred slot IDs in the month.
4. Select students who still have at least one unassigned preferred slot. Sort them by current allocation count ascending, then **total monthly preference-set size** ascending, then student ID ascending.
5. Give the first student their earliest unassigned preferred slot in the chronological/slot-ID ordering. Mark it `"algorithmic"` and increment their count.
6. Rebuild the eligible queue and repeat until no student has an unassigned preferred slot. Normalize and validate the entire workspace.

The preference-size tie breaker is fixed for the run: it includes preferences for already allocated slots and manually occupied slots. It is **not** the number of remaining free preferred options. Slots are not ordered by demand or scarcity.

`compare` uses JavaScript `<`/`>` string comparison, not locale-aware name sorting. Names, roster insertion order, and preference-array order do not break ties. Equal start times use slot IDs, not runway. Identical validated state and month produce identical assignments; creation uses random UUIDs, so re-entering equivalent names/slots with new IDs can change tied outcomes. A backend port must specify equivalent stable ordering rather than depend on database row order.

Manual assignments can be to nonvoters and can exceed a student's preference count. There is no per-student maximum, quota, historical equity, timetable conflict detection, or duration weighting. Under the present unlimited-assignment model, the loop fills every unassigned slot with at least one upvote; slots without demand remain empty unless manually assigned. This does not imply globally optimal equity or a maximum-utilization guarantee after adding scheduling constraints.

### Greedy equity limitation

Consider three chronological slots `x`, `y`, `z` and lexically ordered students `A`, `B`, `C`, all initially unassigned. A prefers x/y; B and C each prefer x/z. All have two monthly upvotes. The POC gives x to A, z to B, then y to A, leaving C unassigned. A feasible alternative gives y to A, x to B, z to C, one each.

This outcome, retention of an algorithmic assignment after removing its upvote, and v1 late-night migration to `endTime: null` were confirmed by executing the unchanged domain script. Task 0.3 now captures these and the other required allocation behaviors in [characterization fixtures](../tests/fixtures/poc-allocation.json), with a [format/coverage guide and verification command](../tests/fixtures/README.md). These characterize limitations without changing the allocator.

### Recalculation workflow

The compute handler sets `busy`, disables compute/import/export/global-clear controls, advertises `aria-busy`, and waits 380 ms for presentation before calling the synchronous allocator. Ordinary UI dispatch is blocked while busy. There is no worker, cancellation, preview, explanation record, undo, or separate commit: the result replaces the in-memory state and is immediately saved.

On a domain error, previous assignments remain intact. On a storage-write error, the computed result remains in memory with a not-saved warning; a completion toast can still appear. Finally, the handler restores controls and month-boundary navigation (`landing-slots.html:1308-1341`).

## 6. Calendar, matrix, metrics, and warnings

`monthSlots` scopes by the first seven characters of start datetime and sorts by start/ID. Calendar rendering builds complete Sunday-first weeks, including leading/trailing dates. Dates display as `DD/MM/YYYY`, month labels in English, time ranges as `From - To`; incomplete ranges show `?`. All dates/times are local to the device.

The matrix has one row per roster student and one column per scoped slot, with sticky headings/student names and scroll retention. Upvotes use a check; no upvote uses a minus. Assignment outlines are cyan for automatic and purple for manual, independently of whether the student voted. Tooltips and accessible labels include both facts. `LIVE SYNC` means same-tab rerendering, not server or cross-tab synchronization.

`getMetrics` computes the following per month (`landing-slots.html:573-597`):

| Metric | Exact meaning |
| --- | --- |
| `total` | Number of slots in the month. |
| `allocated` / `manual` | Assigned slots / slots with manual source. Automatic count is their difference. |
| `available` | `total - allocated`: **all unassigned slots**, including requested and incomplete ones, not just slots with status `"available"`. |
| `efficiency` | Rounded integer `100 * allocated / total`, or zero with no slots. It measures slot count, not used minutes or fairness. |
| `average` | Assigned monthly slots divided by **all roster students**, or zero with no students. |
| `votes` | Sum of monthly preference counts, equivalent to student-slot upvote pairs. |
| Student `preferences`, `allocated`, `manual` | Counts of that student's scoped upvotes, assignments, and manual assignments. |
| `coverageAlerts` | Number of students with alert `"coverage"`; does not include `"unfulfilled"` alerts. |

Alert formulas:

- `underAllocated = assignedCount === 0 || assignedCount < average`.
- `lowCoverage = total > 0 && preferenceCount < ceil(total / rosterSize)`.
- If there are slots and the student is underallocated: alert `"coverage"` when lowCoverage, otherwise `"unfulfilled"`. Otherwise alert is `null`.

Zero-assignment/low-coverage roster entries say `Critical: low preference coverage`; below-average ones say `Below average: low preference coverage`. Adequately covered but underallocated entries suggest reviewing demand/recomputing or competing demand. With no monthly slots there are no allocation alerts and the roster says so. Students who expressed no preferences are included in the warning population. These signals are heuristics, not evidence of why allocation failed.

Roster counts are allocated/upvoted, not quotas; manual assignments can exceed the denominator. Decorative segments are capped at 16 and can underrepresent large counts. The four metric cards show unassigned slots, allocated slots with source breakdown, efficiency, and coverage alerts.

Incomplete end times trigger a monthly banner plus calendar/matrix badges and a dialog repair form. Individual force assignment is blocked for an incomplete slot; monthly computation is blocked if any scoped slot is incomplete. Existing migrated assignments can remain visible despite missing end times.

## 7. Significant JavaScript function inventory

The tables cover named functions, meaningful function-valued helpers, store methods, and event-only workflows. Source ranges refer to the analyzed POC.

### Domain script

| Function/helper | Responsibility |
| --- | --- |
| `SlotOps` IIFE (`476-727`) | Defines version 2 and exports the public domain API. |
| `compare`, `slotOrder` (`478-479`) | Stable scalar ordering and chronological/ID slot ordering. Internal helpers. |
| `monthOf`, `localDate` (`480-481`) | Extract month; format a `Date` using local calendar components. |
| `validMonth`, `validTime`, `defaultEndTime` (`482-487`) | Validate supported month/clock formats; propose one hour later modulo 24. The proposal alone does not ensure a valid same-day range. |
| `validDateTime` (`488-493`) | Validate supported local datetime syntax and date/time round-trip, including DST gaps. |
| `isRecord`, `isId`, `isLabel`, `unique` (`494-497`) | Internal object, identifier, bounded-label, and array-uniqueness predicates. |
| `demand`, `monthSlots` (`498-499`) | Count voters for a slot; filter and order monthly slots. |
| `validRange`, `requireRange` (`500-507`) | Internal same-date end-after-start validation and explanatory throwing guard. |
| `normalize` (`509-514`) | Recompute stored slot statuses from assignee and demand. |
| `validateState` (`516-542`) | Validate v2 shape, IDs, dates/ranges, references, uniqueness, and derived statuses. |
| `restoreState` (`544-557`) | Upgrade v1 end times or validate current input. |
| `parseWorkspaceFile`, `serializeWorkspace` (`559-571`) | BOM-aware JSON import with invalid-JSON message; validated pretty JSON export. |
| `getMetrics` (`573-597`) | Monthly totals, per-student equity counters, and heuristic alerts. |
| `computeFairDistribution` (`599-632`) | Pure monthly greedy allocation with manual preservation. |
| `transition` / nested `findSlot` (`634-718`) | Dispatch actions; nested lookup throws if a slot no longer exists. |
| `createEmptyState` (`720-725`) | Empty validated v2 workspace in the supplied/default local current month. |

### Application script

| Function/helper | Responsibility |
| --- | --- |
| Application IIFE (`731-1372`) | Encapsulates store, transient UI state, events, and startup. |
| `$`, `escape`, `icon` (`734-749`) | DOM ID lookup, HTML escaping of dynamic text, and trusted SVG icon markup from `iconPaths`. |
| `monthText`, `dateText`, `timeRange`, `initialLetters` (`750-756`) | English month/optional weekday formatting, day-first dates, end-time placeholder, and up-to-two Unicode initials. |
| `storageError` (`767-775`) | Set blocking/warning state and update storage banner/header. |
| `load`, `persist`, `save` (`777-810`) | Restore initial saved data; write state/update status; catch write failures or skip blocked writes. |
| `store` IIFE / `get`, `subscribe`, `dispatch`, `reset`, `replace` (`812-837`) | Hold state, register render listeners, apply/save actions, reset, and write-first import replacement. `get` exposes the held object rather than cloning it. |
| `toast` (`839-845`) | Replace transient status/error message; dismiss after 4.5 seconds or 7 seconds for errors. |
| UI `dispatch` (`847-860`) | Busy guard; invoke store; return success boolean; show/log domain errors inline or in a toast. Does not treat a caught save failure as action failure. |
| `renderMetrics`, `renderCalendar`, `renderRoster`, `renderMatrix` (`862-966`) | Generate monthly dashboard, grid, student-equity cards, and read-only summary table. |
| `syncWorkspaceActions` (`968-972`) | Disable global clear when busy/no assignments; disable import/export while busy. |
| `render` (`974-989`) | Recompute metrics/render sections; refresh open slot details; preserve matrix scrolling and keyed focus. |
| `openSlot` (`991-1037`) | Construct/show slot dialog and its chips, repair form, override controls, and destructive actions. |
| `syncSlotDetails` (`1039-1073`) | Update chips/voters, assignee/source, control-switch state, override hints, and button eligibility without replacing the dialog. |
| `confirm` (`1075-1082`) | Populate confirmation dialog, retain callback, and focus Cancel. |
| `changeMonth` (`1084-1088`) | Move from first-of-month local noon and dispatch a month selection. |
| `validateTimeFields` (`1150-1160`) | Inline same-day From/To validation and HTML custom validity; full date/time validation remains in the domain. |

### Event handlers without separate named functions

| Source range | Workflow |
| --- | --- |
| `1090-1093` | Previous/next/Today navigation and help opening. |
| `1095-1127` | Delegated button clicks: dialog closing, transient override switch, slot opening, vote toggling, confirmed student removal, single assignment clearing, confirmed slot removal. |
| `1129-1148` | Delegated end-time repair and manual-assignment submissions; force editing must be enabled. |
| `1162-1183` | From input proposes To; To input validates; add-slot/add-student submissions generate UUIDs and dispatch. |
| `1185-1203` | Run/clear confirmation callback; restore slot-button focus when appropriate; invalidate closed confirmations; close dialogs on backdrop clicks. |
| `1205-1223` | Download validated export; report errors; remove link/revoke object URL. |
| `1225-1275` | Open import dialog; asynchronously read/validate/summarize selected file; invalidate reads and pending data on close. |
| `1277-1294` | Confirm write-first workspace import and display explicit storage-failure error. |
| `1296-1306` | Confirm clearing all-month assignments while preserving preferences. |
| `1308-1341` | Busy presentation, delayed synchronous compute, result/error toast, and control restoration. |
| `1343-1364` | Retry saving or confirm blocked replacement; confirm/reset full workspace from help. |
| `1365-1371` | Block ordinary persistence on another-tab storage change; subscribe render; render/save initial state. |

## 8. Useful UI concepts to preserve

Preserve the monthly operational calendar, concise time/runway/demand cards, same-dialog student chips, independent preference and Assigned states, and visually distinct automatic/manual assignments. Keep the read-only matrix as a complementary summary, not a second preference-editing surface.

The student-equity sidebar, explicit scope labels, manual-source breakdown, local form feedback, destructive confirmations, empty states, and visible saving/failure status are useful patterns. Preserve accessibility concepts: native buttons/dialogs, labeled fields, fieldsets, pressed/switch states, live status/error announcements, non-color status text, visible keyboard focus, skip link, reduced-motion support, and deliberate focus restoration.

Do not carry over misleading labels uncritically: `AVAILABLE SLOTS` includes requested unassigned slots, `CLEAR ASSIGNMENT` clears all months, `LIVE SYNC` is local only, and control locking is not assignment lock/unlock.

## 9. Defects, assumptions, and migration risks

| Finding | Consequence and migration implication |
| --- | --- |
| Policy must survive migration | The aligned brief preserves total monthly preferences and earliest slots, not remaining free options and most-constrained slots. Verify POC fixture parity rather than silently substituting a different optimizer. |
| Greedy equity can strand a student | The x/y/z example leaves an interested student unassigned despite a one-each solution. Aggregate utilization can look perfect while equity is poor. |
| No independent assignment lock/unlock | Source `"manual"` acts as unconditional preservation, as specified in the aligned brief. The force-control switch changes editing only; adding a separate persisted lock would change the baseline. |
| Immediate compute without reliable commit | Immediate application is the specified workflow. There is no allocation-run record, input revision, stale-result rejection, transactional commit, or per-assignment explanation in the POC. The hosted migration must add atomic persistence/concurrency protection without a mandatory preview step. |
| Edits leave stale automatic assignments | Removing a preference does not invalidate its assignment and validation permits this. Display such staleness intentionally or define a different policy; do not accidentally erase preferences when clearing assignments. |
| Monthly allocation scope | There is no separate `LandingWindow` entity, dates/status/description, or relationship to slots. A POC "landing window" is one slot. The aligned brief preserves month grouping; a multi-slot window lifecycle would be a later extension. |
| No authentication or ownership | Any user of the browser workspace can edit everything. Students have only names/IDs, not instructor ownership or personal links. The file is not a safe production multiuser design. |
| Device-local time is ambiguous | No timezone is stored. Validation/import can differ by device timezone; DST gaps are rejected but repeated clock times have no disambiguation. Migration needs a defined airport/instructor timezone and an explicit interpretation of legacy wall times. |
| End-time limits and migration gaps | Overnight windows are forbidden. Late-night v1 slots can become incomplete; a start at 23:59 cannot be repaired with a later minute on the same date and needs removal/recreation. Null-end-time assignments are accepted from saved data. |
| No overlap/resource checks | Same-runway overlapping slots with different start times are allowed, and one student can receive simultaneous slots/runways. Slot capacity one does not enforce schedule feasibility. |
| Validation and creation rules differ | Import can accept duplicate student names, irregular whitespace/casing, extra properties, and automatic assignments without upvotes. Normalize/map explicitly at migration boundaries rather than assuming all records came through UI creation. |
| Browser persistence is best effort | Dispatch updates memory before writing; save catches write errors, so success-shaped action/compute/reset toasts can coexist with `NOT SAVED`. Import is deliberately stricter and preserves the previous state on write failure. Production mutations need authoritative persistence feedback. |
| Cross-tab guard has races | Storage events arrive after writes and there is no revision check; simultaneous edits can overwrite before blocking. Explicit import/reset/replacement can overwrite a competing tab's data. |
| Whole-state storage and synchronous work | Every edit clones/validates/stringifies the entire workspace and rerenders summaries. Allocation repeatedly scans candidates/slots. Large files have no size limit; larger rosters/matrices can block the UI or exceed localStorage quota. |
| Metrics are heuristic | Unassigned is not the same as unused/no-demand; all roster members affect average/coverage, including nonparticipants. Coverage warnings are not causal explanations; nonvoting manual assignments have only indirect chip/matrix visibility, not a dedicated warning metric. |
| No history or recovery | No undo, allocation history, audit trail, or automatic backup. Deleting students/slots and replacing/resetting workspaces is destructive. Exports include student names and require appropriate handling; they are not encrypted. |
| Browser/API assumptions | Requires `structuredClone`, `crypto.randomUUID`, native dialog methods, `File.text`, optional chaining, Blob/object URLs, and writable origin-scoped localStorage. `file:` storage behavior and secure-context API availability vary by browser. |

These are observations and migration considerations, not fixes implemented by Task 0.2. The Task 0.3 fixtures preserve the current monthly greedy policy, all-manual preservation, preference retention, and documented limitations. Hosted authentication, authoritative persistence, concurrency protection, and auditing are planned reliability/platform extensions, not changes to the allocation policy or interaction model.
