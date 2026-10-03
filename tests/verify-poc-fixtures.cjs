"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "landing-slots.html"), "utf8");
const script = html.match(/<script id="domain">([\s\S]*?)<\/script>/);
assert.ok(script, "The POC domain script must exist.");
vm.runInThisContext(script[1], { filename: "landing-slots.html:domain" });
const domain = globalThis.SlotOps;
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "poc-allocation.json"), "utf8"));
assert.equal(fixtures.formatVersion, 1);
assert.ok(Array.isArray(fixtures.cases) && fixtures.cases.length > 0);
assert.equal(new Set(fixtures.cases.map(fixture => fixture.id)).size, fixtures.cases.length);

function execute(state, step) {
  switch (step.operation) {
    case "compute":
      return domain.computeFairDistribution(state, step.month);
    case "transition":
      assert.ok(["assign", "clear", "clearAssignments", "vote", "setEndTime"].includes(step.action?.type), "Unsupported fixture action.");
      return domain.transition(state, step.action);
    case "restore":
      return domain.restoreState(state);
    default:
      throw new Error(`Unsupported fixture operation: ${step.operation}`);
  }
}

function expectedState(before, step) {
  const expected = structuredClone(before);
  expected.version = step.expectedVersion ?? before.version;
  expected.preferences = structuredClone(step.expectedPreferences ?? before.preferences);
  assert.ok(Array.isArray(step.expectedSlots), "Successful steps require expectedSlots.");
  assert.deepEqual(step.expectedSlots.map(slot => slot.id), before.slots.map(slot => slot.id), "Expected slots must include every slot in input order.");
  expected.slots = before.slots.map((slot, index) => {
    const outcome = step.expectedSlots[index];
    assert.deepEqual(Object.keys(outcome).sort(), ["endTime", "id", "source", "status", "studentId"]);
    return {
      ...slot,
      endTime: outcome.endTime,
      allocatedStudentId: outcome.studentId,
      assignmentSource: outcome.source,
      status: outcome.status
    };
  });
  return expected;
}

let steps = 0;
for (const fixture of fixtures.cases) {
  try {
    assert.ok(typeof fixture.id === "string" && typeof fixture.description === "string");
    assert.ok(Array.isArray(fixture.steps) && fixture.steps.length > 0);
    let state = structuredClone(fixture.input);
    if (state.version === 2) domain.validateState(state);
    else {
      assert.equal(state.version, 1);
      assert.equal(fixture.steps[0].operation, "restore");
    }
    for (const [index, step] of fixture.steps.entries()) {
      const label = `${fixture.id}, step ${index + 1}`;
      const before = structuredClone(state);
      if (Object.hasOwn(step, "expectedError")) {
        assert.equal(typeof step.expectedError, "string");
        assert.equal(Object.hasOwn(step, "expectedSlots"), false);
        for (let attempt = 0; attempt < 2; attempt++) {
          assert.throws(() => execute(state, step), error => error.message === step.expectedError, label);
          assert.deepEqual(state, before, `${label}: rejected operation mutated input`);
        }
      } else {
        const expected = expectedState(before, step);
        const first = execute(state, step);
        assert.deepEqual(state, before, `${label}: operation mutated input`);
        const second = execute(state, step);
        assert.deepEqual(state, before, `${label}: repeated operation mutated input`);
        assert.deepEqual(first, second, `${label}: nondeterministic output`);
        assert.deepEqual(first, expected, `${label}: unexpected output`);
        domain.validateState(first);
        state = first;
      }
      steps++;
    }
    console.log(`PASS ${fixture.id}`);
  } catch (error) {
    throw new Error(`Fixture failed: ${fixture.id}`, { cause: error });
  }
}
console.log(`Verified ${fixtures.cases.length} fixtures / ${steps} steps against the unchanged POC domain.`);
