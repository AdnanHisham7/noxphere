// src/infrastructure/services/WhatsAppService.ts
//
// A single official WhatsApp Business number/account is configured once,
// centrally, for the whole platform (see config.whatsapp) — there is no
// per-academy WhatsApp account anywhere. Every message this service sends
// has the academy's name woven into its own text, which is how a guardian
// or coach who's linked to more than one academy can tell them apart.
import { config } from "../../config/app.config";
import { logger } from "../../shared/utils/logger";

export interface WhatsAppTextMessage {
  to: string;
  academyName: string;
  body: string;
}

export interface WhatsAppImageMessage {
  to: string;
  academyName: string;
  caption: string;
  imageUrl: string;
}

export interface WhatsAppDocumentMessage {
  to: string;
  academyName: string;
  caption: string;
  documentUrl: string;
  filename: string;
}

// WhatsApp requires E.164 (no leading +, digits only) for the Cloud API's
// "to" field. Guardians/coaches may have saved their number with spaces,
// dashes, a leading +, or a leading 0 — normalize defensively rather than
// silently failing to send.
function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/[^\d]/g, "");
  // A 10-digit Indian mobile number with no country code is the most
  // common shape guardians will have entered — default it to +91 rather
  // than sending an invalid, country-code-less number to the API.
  if (digitsOnly.length === 10) return `91${digitsOnly}`;
  return digitsOnly;
}

function prefixWithAcademy(academyName: string, body: string): string {
  return `*${academyName}*\n${body}`;
}

let warnedMissingConfig = false;

export class WhatsAppService {
  private isConfigured(): boolean {
    const configured = !!(config.whatsapp.phoneNumberId && config.whatsapp.accessToken);
    if (!configured && !warnedMissingConfig) {
      logger.warn(
        "[WhatsAppService] WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN are not set — WhatsApp alerts are disabled until configured.",
      );
      warnedMissingConfig = true;
    }
    return configured;
  }

  private endpoint(): string {
    return `${config.whatsapp.apiBaseUrl}/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`;
  }

  private async post(payload: Record<string, unknown>): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const response = await fetch(this.endpoint(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        logger.error(`[WhatsAppService] Send failed (${response.status}): ${errorBody}`);
      }
    } catch (err) {
      // A WhatsApp delivery failure should never take down the calling
      // flow (marking attendance, recording a payment, etc.) — log and
      // move on rather than throwing.
      logger.error("[WhatsAppService] Request error:", err);
    }
  }

  async sendText({ to, academyName, body }: WhatsAppTextMessage): Promise<void> {
    await this.post({
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "text",
      text: { body: prefixWithAcademy(academyName, body), preview_url: false },
    });
  }

  async sendImage({ to, academyName, caption, imageUrl }: WhatsAppImageMessage): Promise<void> {
    await this.post({
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "image",
      image: { link: imageUrl, caption: prefixWithAcademy(academyName, caption) },
    });
  }

  async sendDocument({ to, academyName, caption, documentUrl, filename }: WhatsAppDocumentMessage): Promise<void> {
    await this.post({
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "document",
      document: {
        link: documentUrl,
        caption: prefixWithAcademy(academyName, caption),
        filename,
      },
    });
  }
}

export const whatsAppService = new WhatsAppService();
