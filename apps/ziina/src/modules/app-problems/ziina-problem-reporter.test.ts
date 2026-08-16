import { AppProblemsReporter } from "@saleor/app-problems";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROBLEM_KEYS, ZiinaProblemReporter } from "./ziina-problem-reporter";

vi.mock("@saleor/app-problems", () => {
  return {
    AppProblemsReporter: vi.fn(),
  };
});

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockReportProblem = vi.fn();
const mockClearProblems = vi.fn();

describe("ZiinaProblemReporter", () => {
  const mockClient = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReportProblem.mockReset();
    mockClearProblems.mockReset();
    vi.mocked(AppProblemsReporter).mockImplementation(
      () =>
        ({
          reportProblem: mockReportProblem,
          clearProblems: mockClearProblems,
        }) as unknown as AppProblemsReporter,
    );
  });

  describe("reportAuthFailure", () => {
    it("calls reportProblem with correct key and message", async () => {
      mockReportProblem.mockResolvedValue(ok(undefined));
      const reporter = new ZiinaProblemReporter(mockClient);

      await reporter.reportAuthFailure("config-123", "My Config");

      expect(mockReportProblem).toHaveBeenCalledWith({
        key: "ziina-auth-failure:config-123",
        criticalThreshold: 1,
        message: expect.stringContaining("invalid or expired"),
      });
      expect(mockReportProblem).toHaveBeenCalledWith({
        key: "ziina-auth-failure:config-123",
        criticalThreshold: 1,
        message: expect.stringContaining('"My Config"'),
      });
    });

    it("does not throw when reportProblem fails", async () => {
      mockReportProblem.mockResolvedValue(err(new Error("network error")));
      const reporter = new ZiinaProblemReporter(mockClient);

      await expect(reporter.reportAuthFailure("config-123", "My Config")).resolves.toBeUndefined();
    });
  });

  describe("reportWebhookSecretMismatch", () => {
    it("calls reportProblem with correct key and message", async () => {
      mockReportProblem.mockResolvedValue(ok(undefined));
      const reporter = new ZiinaProblemReporter(mockClient);

      await reporter.reportWebhookSecretMismatch("config-789", "Test Config");

      expect(mockReportProblem).toHaveBeenCalledWith({
        key: "ziina-webhook-secret-mismatch:config-789",
        criticalThreshold: 1,
        message: expect.stringContaining("Webhook signature verification failed"),
      });
      expect(mockReportProblem).toHaveBeenCalledWith({
        key: "ziina-webhook-secret-mismatch:config-789",
        criticalThreshold: 1,
        message: expect.stringContaining('"Test Config"'),
      });
    });
  });

  describe("reportConfigMissing", () => {
    it("calls reportProblem with correct key and message", async () => {
      mockReportProblem.mockResolvedValue(ok(undefined));
      const reporter = new ZiinaProblemReporter(mockClient);

      await reporter.reportConfigMissing("config-000");

      expect(mockReportProblem).toHaveBeenCalledWith({
        key: "ziina-config-missing:config-000",
        criticalThreshold: 1,
        message: expect.stringContaining("no matching configuration was found"),
      });
      expect(mockReportProblem).toHaveBeenCalledWith({
        key: "ziina-config-missing:config-000",
        criticalThreshold: 1,
        message: expect.stringContaining('"config-000"'),
      });
    });
  });

  describe("reportApiProblem", () => {
    it("calls reportProblem with correct key and message", async () => {
      mockReportProblem.mockResolvedValue(ok(undefined));
      const reporter = new ZiinaProblemReporter(mockClient);

      await reporter.reportApiProblem(new Error("api error"), {
        id: "config-1",
        name: "My Config",
      });

      expect(mockReportProblem).toHaveBeenCalledWith({
        key: "ziina-api-problem:config-1",
        criticalThreshold: 1,
        message: expect.stringContaining("Ziina API returned an error"),
      });
      expect(mockReportProblem).toHaveBeenCalledWith({
        key: "ziina-api-problem:config-1",
        criticalThreshold: 1,
        message: expect.stringContaining('"My Config"'),
      });
    });
  });

  describe("clearProblemsForConfig", () => {
    it("clears all 4 problem keys for the given configId", async () => {
      mockClearProblems.mockResolvedValue(ok(undefined));
      const reporter = new ZiinaProblemReporter(mockClient);

      await reporter.clearProblemsForConfig("config-abc");

      expect(mockClearProblems).toHaveBeenCalledWith([
        "ziina-auth-failure:config-abc",
        "ziina-webhook-secret-mismatch:config-abc",
        "ziina-config-missing:config-abc",
        "ziina-api-problem:config-abc",
      ]);
    });

    it("does not throw when clearProblems fails", async () => {
      mockClearProblems.mockResolvedValue(err(new Error("network error")));
      const reporter = new ZiinaProblemReporter(mockClient);

      await expect(reporter.clearProblemsForConfig("config-abc")).resolves.toBeUndefined();
    });
  });
});

describe("PROBLEM_KEYS", () => {
  it("generates correct key patterns", () => {
    expect(PROBLEM_KEYS.authFailure("id1")).toBe("ziina-auth-failure:id1");
    expect(PROBLEM_KEYS.webhookSecretMismatch("id1")).toBe("ziina-webhook-secret-mismatch:id1");
    expect(PROBLEM_KEYS.configMissing("id1")).toBe("ziina-config-missing:id1");
    expect(PROBLEM_KEYS.apiProblem("id1")).toBe("ziina-api-problem:id1");
  });
});
