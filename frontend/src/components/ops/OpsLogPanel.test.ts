import { describe, it, expect } from "vitest";
import { stripAnsi } from "./OpsLogPanel";

describe("stripAnsi", () => {
  it("remove sequências de cor SGR", () => {
    expect(stripAnsi("\x1b[1;36mbuild\x1b[0m ok")).toBe("build ok");
  });

  it("remove múltiplos escapes na mesma linha", () => {
    expect(stripAnsi("\x1b[31merro\x1b[0m: \x1b[33mwarn\x1b[0m")).toBe(
      "erro: warn",
    );
  });

  it("preserva texto sem escapes", () => {
    expect(stripAnsi("docker push ghcr.io/x:tag")).toBe(
      "docker push ghcr.io/x:tag",
    );
  });
});
