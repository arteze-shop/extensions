---
"saleor-app-payment-ziina": patch
---

Fixed app configuration loading when using Upstash for configuration storage (`CONFIG_STORAGE_MODE=upstash`). Fetching the app config from Upstash no longer fails after installation.