import { expect, test } from "vitest";
import { STUDYBUDDY_VERSION } from "@studybuddy/core";
import { FIXTURE_VERSION } from "@studybuddy/test-fixtures";

test("workspace packages resolve", () => {
  expect(STUDYBUDDY_VERSION).toBe(1);
  expect(FIXTURE_VERSION).toBe(1);
});
