import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../setup";
import {
  renderHandlebarsLike,
  resolveTemplate,
  resolveAndRender,
} from "@/lib/notifications/templates";

describe("renderHandlebarsLike", () => {
  it("substitutes top-level placeholders", () => {
    expect(renderHandlebarsLike("Hello {{name}}!", { name: "Ama" })).toBe("Hello Ama!");
  });

  it("supports nested paths", () => {
    expect(
      renderHandlebarsLike("Class: {{student.class.name}}", {
        student: { class: { name: "Form 1B" } },
      }),
    ).toBe("Class: Form 1B");
  });

  it("renders missing keys as empty strings (no stray {{...}})", () => {
    expect(renderHandlebarsLike("Hi {{a}}/{{b}}", { a: "x" })).toBe("Hi x/");
  });

  it("HTML-escapes string values by default", () => {
    expect(renderHandlebarsLike("{{name}}", { name: "<script>" })).toBe(
      "&lt;script&gt;",
    );
  });

  it("{{{raw}}} bypasses HTML escaping", () => {
    expect(renderHandlebarsLike("{{{html}}}", { html: "<b>x</b>" })).toBe("<b>x</b>");
  });

  it("coerces non-string values", () => {
    expect(renderHandlebarsLike("{{n}}", { n: 42 })).toBe("42");
    expect(renderHandlebarsLike("{{f}}", { f: true })).toBe("true");
  });

  it("tolerates whitespace inside braces", () => {
    expect(renderHandlebarsLike("{{  name  }}", { name: "Kofi" })).toBe("Kofi");
  });
});

describe("resolveTemplate", () => {
  beforeEach(() => {
    prismaMock.notificationTemplate.findMany.mockReset();
  });

  it("returns null when no candidates exist", async () => {
    prismaMock.notificationTemplate.findMany.mockResolvedValue([] as never);
    const r = await resolveTemplate({
      key: "fee_reminder",
      channel: "EMAIL",
      schoolId: "s1",
    });
    expect(r).toBeNull();
  });

  it("prefers school-scoped over global default", async () => {
    prismaMock.notificationTemplate.findMany.mockResolvedValue([
      { schoolId: null, locale: "en", subject: "global", body: "global body" },
      { schoolId: "s1", locale: "en", subject: "tenant", body: "tenant body" },
    ] as never);

    const r = await resolveTemplate({
      key: "fee_reminder",
      channel: "EMAIL",
      schoolId: "s1",
    });
    expect(r).toEqual({ subject: "tenant", body: "tenant body" });
  });

  it("prefers exact locale over default locale within the same scope", async () => {
    prismaMock.notificationTemplate.findMany.mockResolvedValue([
      { schoolId: "s1", locale: "en", subject: "en", body: "english body" },
      { schoolId: "s1", locale: "tw", subject: "tw", body: "twi body" },
    ] as never);

    const r = await resolveTemplate({
      key: "fee_reminder",
      channel: "EMAIL",
      schoolId: "s1",
      locale: "tw",
    });
    expect(r).toEqual({ subject: "tw", body: "twi body" });
  });

  it("falls back to global default when school has no override", async () => {
    prismaMock.notificationTemplate.findMany.mockResolvedValue([
      { schoolId: null, locale: "en", subject: "global", body: "global body" },
    ] as never);

    const r = await resolveTemplate({
      key: "fee_reminder",
      channel: "EMAIL",
      schoolId: "s1",
    });
    expect(r).toEqual({ subject: "global", body: "global body" });
  });
});

describe("resolveAndRender", () => {
  beforeEach(() => {
    prismaMock.notificationTemplate.findMany.mockReset();
  });

  it("renders the resolved DB template with provided data", async () => {
    prismaMock.notificationTemplate.findMany.mockResolvedValue([
      {
        schoolId: "s1",
        locale: "en",
        subject: "Fees for {{studentName}}",
        body: "Balance: GHS {{amount}}",
      },
    ] as never);

    const r = await resolveAndRender({
      key: "fee_reminder",
      channel: "EMAIL",
      schoolId: "s1",
      data: { studentName: "Ama", amount: "250.00" },
    });
    expect(r.source).toBe("db");
    expect(r.subject).toBe("Fees for Ama");
    expect(r.body).toBe("Balance: GHS 250.00");
  });

  it("returns source=fallback when no DB template exists", async () => {
    prismaMock.notificationTemplate.findMany.mockResolvedValue([] as never);
    const r = await resolveAndRender({
      key: "nothing",
      channel: "EMAIL",
      data: {},
    });
    expect(r).toEqual({ subject: null, body: "", source: "fallback" });
  });
});
