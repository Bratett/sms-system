import { describe, it, expect, beforeEach } from "vitest";
import { getCached, invalidateCachePrefix, __resetCacheForTests } from "@/lib/analytics-cache";

describe("getCached", () => {
  beforeEach(() => __resetCacheForTests());

  it("runs loader on first call (cache miss)", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return "value-1";
    };

    const result = await getCached("key-a", loader);
    expect(result).toBe("value-1");
    expect(calls).toBe(1);
  });

  it("returns cached value on second call within TTL", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return `value-${calls}`;
    };

    const a = await getCached("key-a", loader, 60_000);
    const b = await getCached("key-a", loader, 60_000);
    expect(a).toBe("value-1");
    expect(b).toBe("value-1");
    expect(calls).toBe(1);
  });

  it("re-runs loader when TTL has elapsed", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return `value-${calls}`;
    };

    await getCached("key-a", loader, 10);
    await new Promise((r) => setTimeout(r, 15));
    const b = await getCached("key-a", loader, 10);
    expect(b).toBe("value-2");
    expect(calls).toBe(2);
  });

  it("does not cache loader errors", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return "value-ok";
    };

    await expect(getCached("key-a", loader)).rejects.toThrow("boom");
    const b = await getCached("key-a", loader);
    expect(b).toBe("value-ok");
    expect(calls).toBe(2);
  });
});

describe("invalidateCachePrefix", () => {
  beforeEach(() => __resetCacheForTests());

  it("removes only entries matching the prefix", async () => {
    let aCalls = 0;
    let bCalls = 0;
    await getCached("analytics:school-1:year-1", async () => { aCalls++; return "A"; });
    await getCached("analytics:school-2:year-1", async () => { bCalls++; return "B"; });

    invalidateCachePrefix("analytics:school-1");

    await getCached("analytics:school-1:year-1", async () => { aCalls++; return "A"; });
    await getCached("analytics:school-2:year-1", async () => { bCalls++; return "B"; });

    expect(aCalls).toBe(2);
    expect(bCalls).toBe(1);
  });
});
