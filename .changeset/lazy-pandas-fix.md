---
"saleor-app-payment-ziina": patch
"saleor-app-smtp": patch
---

Fixed auth data collisions when the apps share a single Upstash instance. Installed apps now store their auth data under app-specific Redis keys instead of overwriting each other.