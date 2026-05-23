# Make.com Gmail to Request Tracking

This flow watches incoming Gmail request emails and sends them to the app.
The app creates a new `requests` row when needed and stores every email in
`request_messages`.

## Required App Setup

Run this SQL first:

```text
docs/request_email_tracking_migration.sql
```

Set this Vercel environment variable:

```text
REQUEST_EMAIL_WEBHOOK_SECRET=<long random secret>
```

After setting it, redeploy the app.

## Make.com Scenario

Recommended first version:

1. Gmail > Watch emails
2. Optional filter: only messages from the website form or matching request labels
3. HTTP > Make a request

HTTP module:

```text
Method: POST
URL: https://<production-domain>/api/requests/email-webhook
Headers:
  x-request-email-secret: <REQUEST_EMAIL_WEBHOOK_SECRET>
  Content-Type: application/json
```

Body:

```json
{
  "provider": "gmail",
  "direction": "inbound",
  "threadId": "{{Thread ID}}",
  "messageId": "{{Message ID}}",
  "fromEmail": "{{From Email}}",
  "fromName": "{{From Name}}",
  "toEmails": ["{{To Email}}"],
  "ccEmails": [],
  "subject": "{{Subject}}",
  "bodyText": "{{Plain text body}}",
  "bodyHtml": "{{HTML body}}",
  "snippet": "{{Snippet}}",
  "receivedAt": "{{Date}}",
  "request": {
    "clientName": "{{Name}}",
    "email": "{{Email Address}}",
    "phone": "{{Phone Number}}",
    "tattooDescription": "{{Tattoo Description}}",
    "approximateSize": "{{Approximate Size (in inches)}}",
    "placement": "{{Placement on your Body}}",
    "requestedArtistLabel": "{{Artist you want to consult with}}",
    "ageConfirmed": true,
    "externalId": "{{Webflow Submission ID}}"
  }
}
```

If the Gmail message is only a reply and does not include the `request` object,
the app will attach it by `threadId` when a matching request already exists.

## Matching Rules

The webhook finds an existing request in this order:

1. `external_source = "webflow"` and `external_id`
2. `gmail_thread_id`
3. incoming email address + similar subject fallback

If no request is found, it creates a new request using the `request` object or
best-effort email fields.

Duplicate Gmail retries are safe because `provider + messageId` is unique.
