import type { MessageChannel, MessagePayload, MessageResult } from "../types";

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

function getConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp Business API not configured (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID)");
  }
  return { token, phoneNumberId };
}

export class WhatsAppChannel implements MessageChannel {
  readonly name = "whatsapp";
  readonly displayName = "WhatsApp";

  async send(payload: MessagePayload): Promise<MessageResult> {
    try {
      const { token, phoneNumberId } = getConfig();

      const body = payload.templateId
        ? {
            messaging_product: "whatsapp",
            to: payload.to,
            type: "template",
            template: {
              name: payload.templateId,
              language: { code: "en" },
              components: payload.templateData
                ? [
                    {
                      type: "body",
                      parameters: Object.values(payload.templateData).map((v) => ({
                        type: "text",
                        text: v,
                      })),
                    },
                  ]
                : [],
            },
          }
        : {
            messaging_product: "whatsapp",
            to: payload.to,
            type: "text",
            text: { body: payload.body },
          };

      const response = await fetch(
        `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json();

      if (data.messages?.[0]?.id) {
        return {
          success: true,
          providerMessageId: data.messages[0].id,
        };
      }

      return {
        success: false,
        error: data.error?.message || "Failed to send WhatsApp message",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "WhatsApp send failed",
      };
    }
  }

  async sendBulk(payloads: MessagePayload[]): Promise<MessageResult[]> {
    // WhatsApp API doesn't support batch - send sequentially with rate limiting
    const results: MessageResult[] = [];
    for (const payload of payloads) {
      results.push(await this.send(payload));
      // WhatsApp rate limit: ~80 messages/second for business API
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return results;
  }
}
