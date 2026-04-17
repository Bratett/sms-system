/**
 * WhatsApp Cloud API provider (Meta).
 *
 * This is a Phase-2 stub: when `META_WHATSAPP_PHONE_NUMBER_ID` and
 * `META_WHATSAPP_ACCESS_TOKEN` are set, it sends real messages via Meta's
 * Graph API. Otherwise it no-ops with success — so every downstream caller
 * (dispatcher, workers, tests) works without Meta credentials.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

import { logger } from "@/lib/logger";

const log = logger.child({ component: "whatsapp" });

interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

interface WhatsAppProvider {
  send(params: {
    to: string;
    message: string;
    templateName?: string;
    templateParams?: string[];
  }): Promise<SendResult>;
}

class MetaWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private phoneNumberId: string,
    private accessToken: string,
    private apiVersion = "v20.0",
  ) {}

  async send(params: {
    to: string;
    message: string;
    templateName?: string;
    templateParams?: string[];
  }): Promise<SendResult> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const body = params.templateName
      ? {
          messaging_product: "whatsapp",
          to: params.to,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: "en" },
            components: params.templateParams
              ? [
                  {
                    type: "body",
                    parameters: params.templateParams.map((text) => ({
                      type: "text",
                      text,
                    })),
                  },
                ]
              : undefined,
          },
        }
      : {
          messaging_product: "whatsapp",
          to: params.to,
          type: "text",
          text: { body: params.message },
        };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        messages?: { id: string }[];
        error?: { message: string };
      };
      if (!res.ok) {
        return { success: false, error: json.error?.message ?? `HTTP ${res.status}` };
      }
      return { success: true, providerMessageId: json.messages?.[0]?.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }
}

class MockWhatsAppProvider implements WhatsAppProvider {
  async send(params: { to: string; message: string }): Promise<SendResult> {
    log.info("mock whatsapp send", {
      to: params.to,
      bodyPreview: params.message.slice(0, 60),
    });
    return {
      success: true,
      providerMessageId: `mock-wa-${Date.now()}`,
    };
  }
}

let cached: WhatsAppProvider | undefined;

export function getWhatsAppProvider(): WhatsAppProvider {
  if (cached) return cached;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (phoneNumberId && accessToken) {
    cached = new MetaWhatsAppProvider(phoneNumberId, accessToken);
  } else {
    cached = new MockWhatsAppProvider();
  }
  return cached;
}

// Exported for tests to force a fresh read of env vars after mocking.
export function resetWhatsAppProvider(): void {
  cached = undefined;
}

export type { WhatsAppProvider, SendResult };
