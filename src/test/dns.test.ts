import { describe, it, expect } from "vitest";

import { isBlocked } from "../dns";

describe("isBlocked", () => {
  it("blocks exact domain", () => {
    expect(isBlocked("example.com")).toBe(true);
  });

  it("does not block subdomain when pattern is only exact domain", () => {
    expect(isBlocked("www.example.com")).toBe(false);
  });

  it("blocks subdomains with pattern *.<base>", () => {
    expect(isBlocked("foo.blocked.com")).toBe(true);
    expect(isBlocked("bar.blocked.com")).toBe(true);
    expect(isBlocked("blocked.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBlocked("EXAMPLE.COM")).toBe(true);
    expect(isBlocked("WWW.EXAMPLE.COM")).toBe(false);
    expect(isBlocked("foo.BLOCKED.com")).toBe(true);
  });

  it("returns false for non-blocked domain", () => {
    expect(isBlocked("google.com")).toBe(false);
    expect(isBlocked("github.com")).toBe(false);
  });
});
