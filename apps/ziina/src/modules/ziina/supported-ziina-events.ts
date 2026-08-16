export const ZIINA_WEBHOOK_EVENTS = {
  PAYMENT_INTENT_STATUS_UPDATED: "payment_intent.status.updated",
  REFUND_STATUS_UPDATED: "refund.status.updated",
} as const;

export type SupportedZiinaEvent = (typeof ZIINA_WEBHOOK_EVENTS)[keyof typeof ZIINA_WEBHOOK_EVENTS];

export const supportedZiinaEvents: Array<SupportedZiinaEvent> = [
  ZIINA_WEBHOOK_EVENTS.PAYMENT_INTENT_STATUS_UPDATED,
  ZIINA_WEBHOOK_EVENTS.REFUND_STATUS_UPDATED,
];

/**
 * Ziina delivers webhooks from the following IP addresses.
 * Do not accept the webhook if it comes from a different IP address.
 */
export const ZIINA_WEBHOOK_ALLOWED_IPS = [
  "3.29.184.186",
  "3.29.190.95",
  "20.233.47.127",
  "13.202.161.181",
] as const;
