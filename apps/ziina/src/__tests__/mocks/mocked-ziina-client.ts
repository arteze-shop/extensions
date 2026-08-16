import { vi } from "vitest";

import { type IZiinaClient } from "@/modules/ziina/types";

export const mockedZiinaClient = {
  createPaymentIntent: vi.fn(),
  getPaymentIntent: vi.fn(),
  createRefund: vi.fn(),
  getRefund: vi.fn(),
  getAccount: vi.fn(),
  createWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
} satisfies IZiinaClient;
