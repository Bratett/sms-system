import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getWhatsAppProvider,
  resetWhatsAppProvider,
} from "@/lib/messaging/whatsapp";

describe("WhatsApp provider selection", () => {
  const originalPhone = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const originalToken = process.env.META_WHATSAPP_ACCESS_TOKEN;

  beforeEach(() => {
    resetWhatsAppProvider();
  });

  afterEach(() => {
    // Restore env between tests.
    if (originalPhone === undefined) delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    else process.env.META_WHATSAPP_PHONE_NUMBER_ID = originalPhone;
    if (originalToken === undefined) delete process.env.META_WHATSAPP_ACCESS_TOKEN;
    else process.env.META_WHATSAPP_ACCESS_TOKEN = originalToken;
    resetWhatsAppProvider();
  });

  it("uses the mock provider when Meta credentials are absent", async () => {
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.META_WHATSAPP_ACCESS_TOKEN;
    const p = getWhatsAppProvider();
    const r = await p.send({ to: "+233241234567", message: "hello" });
    expect(r.success).toBe(true);
    expect(r.providerMessageId).toMatch(/^mock-wa-/);
  });

  it("uses the Meta provider when credentials are present", async () => {
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.META_WHATSAPP_ACCESS_TOKEN = "TOKEN";

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.abc" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p = getWhatsAppProvider();
    const r = await p.send({ to: "+233241234567", message: "hi" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/123/messages");
    expect(init.headers).toMatchObject({ Authorization: "Bearer TOKEN" });
    expect(r).toEqual({ success: true, providerMessageId: "wamid.abc" });

    vi.unstubAllGlobals();
  });

  it("returns failure on non-ok responses from Meta", async () => {
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.META_WHATSAPP_ACCESS_TOKEN = "TOKEN";

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "Invalid phone" } }), {
        status: 400,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p = getWhatsAppProvider();
    const r = await p.send({ to: "+bad", message: "hi" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Invalid phone/);

    vi.unstubAllGlobals();
  });

  it("sends template messages when templateName is provided", async () => {
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.META_WHATSAPP_ACCESS_TOKEN = "TOKEN";

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.tpl" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p = getWhatsAppProvider();
    await p.send({
      to: "+233241234567",
      message: "fallback text",
      templateName: "exeat_otp",
      templateParams: ["Ama", "123456"],
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("exeat_otp");
    expect(body.template.components[0].parameters).toHaveLength(2);

    vi.unstubAllGlobals();
  });
});
