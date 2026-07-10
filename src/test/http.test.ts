import { describe, it, expect } from "vitest";
import request from "supertest";

import { app, setRedirectUrlForTest } from "../http";

describe("HTTP block behavior", () => {
  it("redirects when redirectUrl is configured", async () => {
    setRedirectUrlForTest("https://example-not-blocked.com");

    const response = await request(app).get("/");
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://example-not-blocked.com");

    setRedirectUrlForTest(null);
  });

  it("falls back to static block page when redirectUrl is empty", async () => {
    setRedirectUrlForTest(null);

    const response = await request(app).get("/");
    expect(response.status).toBe(200);
  });
});
