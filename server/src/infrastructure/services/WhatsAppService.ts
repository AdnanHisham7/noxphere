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
  let digitsOnly = phone.replace(/[^\d]/g, "");
  // Strip leading 0 if 11 digits (e.g. 09037532036 -> 9037532036)
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    digitsOnly = digitsOnly.slice(1);
  }
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

// WhatsApp Cloud API strictly requires image/jpeg or image/png for `type: "image"` messages.
// Formats like WebP, GIF, TIFF, etc. are rejected with OAuthException code 131053.
// For Cloudinary assets, we dynamically rewrite the URL to force PNG format (`/f_png/` and `.png`),
// ensuring the CDN delivers a valid PNG with the correct Content-Type header.
export function ensureWhatsAppCompatibleImageUrl(url: string): string {
  if (!url || typeof url !== "string") return url;

  const trimmed = url.trim();

  // Cloudinary image URL handling
  if (trimmed.includes("res.cloudinary.com") && trimmed.includes("/image/upload/")) {
    let clean = trimmed;

    // 1. Replace .webp (or .gif/.bmp/.tiff/.svg) extension with .png
    clean = clean.replace(/\.(webp|gif|bmp|tiff|svg)(?=[?#]|$)/gi, ".png");

    // 2. If it does not end with .png or .jpg or .jpeg, append .png
    const urlWithoutQuery = clean.split(/[?#]/)[0];
    if (!/\.(png|jpe?g)$/i.test(urlWithoutQuery)) {
      const parts = clean.split(/([?#].*)$/);
      clean = `${parts[0]}.png${parts[1] || ""}`;
    }

    // 3. Ensure Cloudinary transformation forces PNG format (f_png)
    if (!clean.match(/\/image\/upload\/[^/]*f_(?:png|jpe?g)[^/]*\//i)) {
      clean = clean.replace("/image/upload/", "/image/upload/f_png/");
    }

    return clean;
  }

  return trimmed;
}

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
        if (response.status === 401) {
          logger.warn(
            `[WhatsAppService] (Dev simulation) Meta Token expired. Message for ${payload.to}: ${JSON.stringify(
              payload.text || payload.image || payload.document
            )}`
          );
        }
      } else {
        logger.info(`[WhatsAppService] Message sent successfully to ${payload.to}`);
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
    const formattedUrl = ensureWhatsAppCompatibleImageUrl(imageUrl);

    // If still an unsupported image format (e.g. non-Cloudinary external .webp/.gif),
    // WhatsApp Cloud API will reject it as an image with error 131053.
    // Fall back to sending as document so the recipient receives it!
    const cleanPath = formattedUrl.split(/[?#]/)[0].toLowerCase();
    if (cleanPath.endsWith(".webp") || cleanPath.endsWith(".gif") || cleanPath.endsWith(".bmp") || cleanPath.endsWith(".svg")) {
      logger.warn(`[WhatsAppService] Image URL "${formattedUrl}" is not PNG/JPEG. Sending as document fallback to ensure delivery.`);
      return this.sendDocument({
        to,
        academyName,
        caption,
        documentUrl: formattedUrl,
        filename: "image" + (cleanPath.match(/\.[a-z0-9]+$/)?.[0] || ".webp"),
      });
    }

    await this.post({
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "image",
      image: { link: formattedUrl, caption: prefixWithAcademy(academyName, caption) },
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

  async sendTemplate({
    to,
    templateName = "hello_world",
    languageCode = "en_US",
    components,
  }: {
    to: string;
    templateName?: string;
    languageCode?: string;
    components?: any[];
  }): Promise<void> {
    const payload: any = {
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };
    if (components && components.length > 0) {
      payload.template.components = components;
    }
    await this.post(payload);
  }
}

export const whatsAppService = new WhatsAppService();
