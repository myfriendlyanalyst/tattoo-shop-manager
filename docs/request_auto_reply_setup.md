# Request auto-reply setup

Request auto-reply is managed in the app at:

`Settings > Email templates > Request auto reply`

Run `docs/operations_email_templates_migration.sql` before using the screen.

Default behavior:

- `Enabled = false`
- `Test mode = true`

When `Test mode` is on, it sends only when the Make.com HTTP body includes:

```json
{
  "sendAutoReply": true
}
```

When `Test mode` is off, it sends for normal new requests as long as the template is enabled.

Emergency kill switch:

- Set Vercel env `REQUEST_AUTO_REPLY_ENABLED=false` to prevent all request auto-replies.

The template supports variables such as `{{customerName}}`, `{{artistPreference}}`, and `{{projectName}}`.
