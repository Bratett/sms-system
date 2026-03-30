/**
 * Messaging channel abstraction types.
 * All channels implement the MessageChannel interface.
 */

export interface MessagePayload {
  to: string; // Phone number, email, user ID, etc.
  body: string;
  subject?: string; // For email
  templateId?: string;
  templateData?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  providerMessageId?: string;
  cost?: number;
  error?: string;
}

export interface MessageChannel {
  readonly name: string;
  readonly displayName: string;

  send(payload: MessagePayload): Promise<MessageResult>;
  sendBulk(payloads: MessagePayload[]): Promise<MessageResult[]>;
}

export type ChannelType = "sms" | "whatsapp" | "email" | "push" | "in_app";
