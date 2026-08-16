import { describe, expect, it } from "vitest";

import {
  createZiinaRestrictedKey,
  type ZiinaRestrictedKey,
  ZiinaRestrictedKeyValidationError,
} from "./ziina-restricted-key";

describe("ZiinaRestrictedKey", () => {
  describe("createZiinaRestrictedKey", () => {
    it("should create instance for valid key", () => {
      const result = createZiinaRestrictedKey("ziina_live_valid123");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe("ziina_live_valid123");
    });

    it("should create instance for test key", () => {
      const result = createZiinaRestrictedKey("ziina_test_valid456");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe("ziina_test_valid456");
    });

    it("should return error if key is empty", () => {
      const result = createZiinaRestrictedKey("");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaRestrictedKeyValidationError);
    });

    it("should return error if key is null", () => {
      const result = createZiinaRestrictedKey(null);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ZiinaRestrictedKeyValidationError);
    });

    it("Nominal typing works", () => {
      const fn = (v: ZiinaRestrictedKey) => v;

      // @ts-expect-error - should be error, only string must be accepted
      fn("ziina_live_XXX");

      expect(() => fn(createZiinaRestrictedKey("ziina_live_XXX")._unsafeUnwrap())).not.toThrow();
    });
  });
});
