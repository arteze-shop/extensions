import { createZiinaRestrictedKey } from "@/modules/ziina/ziina-restricted-key";

export const mockedZiinaAccessToken = createZiinaRestrictedKey(
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6aWluYS1hY2NvdW50Iiwic2NvcGVzIjpbIndyaXRlX3BheW1lbnRfaW50ZW50cyJdLCJpYXQiOjE3MTY3MTQwMDB9.c2lnbmF0dXJlX3BsYWNlaG9sZGVy",
)._unsafeUnwrap();
