import { describe, it } from "node:test";
import assert from "node:assert/strict";

import conversions from "../lib/index.js";

describe("WebIDL undefined type", () => {
  const sut = conversions.undefined;

  it("should return `undefined` for everything", () => {
    assert.equal(sut(undefined), undefined);
    assert.equal(sut(null), undefined);
    assert.equal(sut(""), undefined);
    assert.equal(sut(123), undefined);
    assert.equal(sut("123"), undefined);
    assert.equal(sut({}), undefined);
    assert.equal(sut(Object.create(null)), undefined);
  });
});
