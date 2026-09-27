import { api, generateIdempotencyKey } from "./api";

// ---------------------------------------------------------------------------
// generateIdempotencyKey
// ---------------------------------------------------------------------------

describe("generateIdempotencyKey", () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("produces a v4-shaped UUID", () => {
    expect(generateIdempotencyKey()).toMatch(UUID_V4);
  });

  it("produces a different value on each call", () => {
    expect(generateIdempotencyKey()).not.toBe(generateIdempotencyKey());
  });
});

// ---------------------------------------------------------------------------
// api — request/response envelope handling
// ---------------------------------------------------------------------------

describe("api", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(status: number, body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  function lastRequestInit(): RequestInit {
    const calls = (global.fetch as jest.Mock).mock.calls;
    return calls[calls.length - 1][1];
  }

  it("GET unwraps the data field of the success envelope", async () => {
    mockFetch(200, { data: { uuid: "abc" } });
    const result = await api.get<{ uuid: string }>("/api/v1/exercises/abc");
    expect(result).toEqual({ uuid: "abc" });
  });

  it("GET does not attach an Idempotency-Key header", async () => {
    mockFetch(200, { data: [] });
    await api.get("/api/v1/exercises");
    const headers = lastRequestInit().headers as Record<string, string>;
    expect(headers).not.toHaveProperty("Idempotency-Key");
  });

  it("POST attaches a generated Idempotency-Key header when none is given", async () => {
    mockFetch(201, { data: { uuid: "new" } });
    await api.post("/api/v1/exercises", { name: "Squat" });
    const headers = lastRequestInit().headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBeTruthy();
  });

  it("POST reuses an explicitly passed Idempotency-Key instead of generating one", async () => {
    mockFetch(201, { data: {} });
    await api.post("/api/v1/exercises", { name: "Squat" }, "fixed-key-123");
    const headers = lastRequestInit().headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("fixed-key-123");
  });

  it("returns undefined for a 204 No Content response without reading a body", async () => {
    const json = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({ status: 204, ok: true, json }) as unknown as typeof fetch;
    const result = await api.delete("/api/v1/exercises/abc");
    expect(result).toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it("throws an ApiError carrying the server's code, message, status, and details on a non-ok response", async () => {
    mockFetch(422, {
      error: { code: "validation_failed", message: "name is required", details: [{ field: "name" }] },
    });

    await expect(api.post("/api/v1/exercises", {})).rejects.toMatchObject({
      name: "ApiError",
      code: "validation_failed",
      message: "name is required",
      status: 422,
      details: [{ field: "name" }],
    });
  });

  it("falls back to a generic code/message when the error envelope is missing them", async () => {
    mockFetch(500, {});

    await expect(api.get("/api/v1/exercises")).rejects.toMatchObject({
      name: "ApiError",
      code: "unknown_error",
      status: 500,
    });
  });
});
