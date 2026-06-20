import { describe, it, expect } from "vitest";
import { isOpsMessage } from "./useOpsStream";

describe("isOpsMessage", () => {
  it("aceita só ops.*", () => {
    expect(isOpsMessage({ type: "ops.log", line: "x" })).toBe(true);
    expect(isOpsMessage({ type: "ops.step" })).toBe(true);
    expect(isOpsMessage({ type: "ops.result" })).toBe(true);
    expect(isOpsMessage({ type: "agent.update" })).toBe(false);
    expect(isOpsMessage({})).toBe(false);
    expect(isOpsMessage(null)).toBe(false);
  });
});
