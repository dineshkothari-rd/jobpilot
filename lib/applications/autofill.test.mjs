import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { autofillPayload, isApplicationPackage } from "./package.ts";
import { fillReviewedFields } from "../../extensions/autofill/fill.mjs";

test("autofill exports only known contact facts, never legal answers or salary", () => {
  const answers = ["Full name", "Work authorization", "Current CTC", "OCI", "Email"]
    .map((question) => ({ question, answer: "Reviewed value", source: "Profile" }));
  const payload = JSON.parse(autofillPayload("https://jobs.example.com/role", answers));
  assert.deepEqual(payload.fields.map((item) => item.question), ["Full name", "Email"]);
  assert.throws(() => autofillPayload("javascript:alert(1)", answers));
  assert.throws(() => autofillPayload("https://user:pass@jobs.example.com/role", answers));
  assert.equal(isApplicationPackage({ status: "prepared", application_answers: [null] }), false);
});

test("autofill fills only unambiguous empty visible contact fields on the matching job; never submits", () => {
  class Input {
    constructor(name, value = "", type = "text") {
      this.name = name; this.id = ""; this.type = type; this.value = value;
      this.labels = []; this.events = []; this.disabled = false; this.readOnly = false;
    }
    get value() { return this.currentValue; }
    set value(value) { this.currentValue = value; }
    getClientRects() { return [1]; }
    getAttribute() { return null; }
    dispatchEvent(event) { this.events.push(event.type); }
  }
  class Textarea extends Input {}
  const name = new Input("name");
  const email = new Input("email", "existing@example.com", "email");
  const file = new Input("phone", "", "file");
  const legal = new Input("OCI");
  const duplicatePhone = [new Input("phone"), new Input("phone")];
  const fields = [name, email, file, legal, ...duplicatePhone];
  const location = { origin: "https://jobs.example.com", pathname: "/role/apply" };
  const context = { URL, Event, location, HTMLInputElement: Input, HTMLTextAreaElement: Textarea,
    document: { querySelectorAll: () => fields }, payload: { applicationUrl: "https://jobs.example.com/role",
      fields: ["Full name", "Email", "Phone", "OCI"].map((question) => ({ question, answer: "Reviewed" })) } };
  const run = () => vm.runInNewContext("(" + fillReviewedFields.toString() + ")(payload)", context);
  const result = run();
  assert.equal(result.filled, 1);
  assert.equal(result.skipped, 3);
  assert.deepEqual(Array.from(result.details, (item) => item.reason), ["Verify on the company form", "Existing answer kept", "Ambiguous fields — fill manually", "Unsupported or missing reviewed answer"]);
  assert.equal(name.value, "Reviewed");
  assert.deepEqual(name.events, ["input", "change"]);
  assert.equal(email.value, "existing@example.com");
  assert.equal(file.value, "");
  assert.equal(legal.value, "");
  location.pathname = "/different-job";
  assert.throws(run, /matching JobPilot/);
  location.pathname = "/role/apply";
  location.origin = "https://other.example.com";
  assert.throws(run, /matching JobPilot/);
});
