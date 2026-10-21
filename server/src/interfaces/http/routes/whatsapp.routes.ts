// src/interfaces/http/routes/whatsapp.routes.ts
import { Router, Request, Response } from "express";
import { config } from "../../../config/app.config";
import { logger } from "../../../shared/utils/logger";

export const whatsappRouter = Router();

/**
 * GET /api/v1/whatsapp/webhook
 * Handshake verification endpoint required by Meta.
 * When configuring Webhooks in Meta Developer Dashboard, Meta sends a GET request
 * with hub.mode, hub.verify_token, and hub.challenge.
 */
whatsappRouter.get("/webhook", (req: Request, res: Response) => {
  const mode =
    req.query["hub.mode"] ||
    req.query["hub_mode"] ||
    (req.query.hub as any)?.mode;

  const token =
    req.query["hub.verify_token"] ||
    req.query["hub_verify_token"] ||
    (req.query.hub as any)?.verify_token;

  const challenge =
    req.query["hub.challenge"] ||
    req.query["hub_challenge"] ||
    (req.query.hub as any)?.challenge;

  const expectedToken =
    config.whatsapp?.webhookVerifyToken ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    "noxphere_wa_verify_2026";

  logger.info("[WhatsApp Webhook] Handshake check:", {
    receivedMode: mode,
    receivedToken: token,
    expectedToken,
    query: req.query,
  });

  if (mode === "subscribe" && token === expectedToken) {
    logger.info(`[WhatsApp Webhook] Verification successful. Challenge accepted: ${challenge}`);
    return res.status(200).send(challenge);
  }

  return res.status(403).send("Forbidden: Verification token mismatch");
});

/**
 * POST /api/v1/whatsapp/webhook
 * Receives real-time updates from Meta:
 * - Message delivery statuses (sent, delivered, read, failed)
 * - Inbound messages from guardians/recipients
 */
whatsappRouter.post("/webhook", (req: Request, res: Response) => {
  // Acknowledge Meta immediately with 200 OK so Meta doesn't retry
  res.status(200).send("EVENT_RECEIVED");

  try {
    const body = req.body;

    if (body.object === "whatsapp_business_account") {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;

          // 1. Message Status Updates (sent, delivered, read, failed)
          if (value?.statuses && value.statuses.length > 0) {
            for (const statusObj of value.statuses) {
              const { id, status, recipient_id, errors } = statusObj;
              logger.info(`[WhatsApp Webhook] Message ${id} to ${recipient_id} status: ${status}`);
              if (errors && errors.length > 0) {
                logger.error(`[WhatsApp Webhook] Delivery error for ${recipient_id}:`, errors);
              }
            }
          }

          // 2. Inbound Messages from recipients (replies)
          if (value?.messages && value.messages.length > 0) {
            for (const msg of value.messages) {
              logger.info(`[WhatsApp Webhook] Inbound message received from ${msg.from}:`, {
                type: msg.type,
                text: msg.text?.body,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error("[WhatsApp Webhook] Error processing incoming webhook payload:", err);
  }
});
