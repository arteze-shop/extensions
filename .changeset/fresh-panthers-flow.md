---
"saleor-app-payment-ziina": minor
---

Added Upstash Redis and a local JSON file as alternative storage backends to DynamoDB for the app configuration and transaction recording.

- `CONFIG_STORAGE_MODE=upstash` with `UPSTASH_URL` and `UPSTASH_TOKEN` stores data in Upstash Redis.
- `CONFIG_STORAGE_MODE=file` reads and writes a local companion file (default `.ziina-config.json`, configurable via `CONFIG_STORAGE_FILE_PATH`), separate from the `.saleor-app-auth.json` file managed by the Saleor App SDK.

AWS/DynamoDB environment variables are now only required when using the DynamoDB storage.
