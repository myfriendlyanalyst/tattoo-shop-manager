# Request auto-reply setup

The request received auto-reply is intentionally disabled by default.

It sends only when both conditions are true:

1. Vercel env `REQUEST_AUTO_REPLY_ENABLED=true`
2. The Make.com HTTP body includes `"sendAutoReply": true`

This double gate prevents live Webflow requests from emailing clients before the workflow is approved.

Example Make.com test field:

```json
{
  "sendAutoReply": true
}
```

The email says the shop received the request and usually replies within 2 business days.
