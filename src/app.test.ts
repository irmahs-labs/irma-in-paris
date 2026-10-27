import { describe, expect, it } from "vitest";

import { reply } from "./app.js";

describe("reply", () => {
  it("answers the health check the container and the deploy wait on", () => {
    expect(reply("/healthz")).toEqual({ body: "ok", status: 200 });
  });

  it("is not found anywhere else but the home page", () => {
    expect(reply("/").status).toBe(200);
    expect(reply("/nope").status).toBe(404);
  });
});
