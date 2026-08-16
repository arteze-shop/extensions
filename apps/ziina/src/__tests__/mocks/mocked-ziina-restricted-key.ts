import { createZiinaRestrictedKey } from "@/modules/ziina/ziina-restricted-key";

export const mockedZiinaRestrictedKey = createZiinaRestrictedKey(
  "ziina_live_AAAAABBBBCCCCCEEEEEEEFFFFFGGGGG",
)._unsafeUnwrap();

export const mockedZiinaRestrictedKeyTest = createZiinaRestrictedKey(
  "ziina_test_AAAAABBBBCCCCCEEEEEEEFFFFFGGGGG",
)._unsafeUnwrap();
