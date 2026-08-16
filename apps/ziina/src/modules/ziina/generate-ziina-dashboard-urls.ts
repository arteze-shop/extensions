import { type ZiinaPaymentIntent, type ZiinaRefund } from "./types";

export const generatePaymentIntentZiinaDashboardUrl = (paymentIntent: ZiinaPaymentIntent): string =>
  paymentIntent.redirect_url;

export const generateRefundZiinaDashboardUrl = (_refund: ZiinaRefund): string => "";
