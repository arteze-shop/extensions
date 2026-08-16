import { vi } from "vitest";

import { type AppConfigRepo } from "@/modules/app-config/repositories/app-config-repo";

export const mockedAppConfigRepo = {
  getZiinaConfig: vi.fn(),
  saveZiinaConfig: vi.fn(),
  getRootConfig: vi.fn(),
  updateMapping: vi.fn(),
  removeConfig: vi.fn(),
} satisfies AppConfigRepo;
