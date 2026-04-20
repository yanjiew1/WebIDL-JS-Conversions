import { describe, it } from "node:test";
import assert from "node:assert/strict";

import conversions from "../lib/index.js";

describe("WebIDL DOMTimeStamp type", () => {
  const sut = conversions.DOMTimeStamp;

  it("should have the same conversion routine as unsigned long long type", () => {
    assert.equal(sut, conversions["unsigned long long"]);
  });
});
