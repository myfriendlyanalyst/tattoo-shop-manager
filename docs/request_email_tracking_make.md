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

Recommended first version if the shop only needs to import emails that already
arrived at Gmail:

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
    "firstName": "{{First Name}}",
    "lastName": "{{Last Name}}",
    "clientName": "{{First Name}} {{Last Name}}",
    "email": "{{Email Address}}",
    "phone": "{{Phone Number}}",
    "tattooDescription": "{{Tattoo Description}}",
    "approximateSize": "{{Approximate Size (in inches)}}",
    "placement": "{{Placement on your Body}}",
    "requestedArtistLabel": "{{Artist you want to consult with}}",
    "tattooTimingPreference": "{{When are you looking to get tattooed?}}",
    "ageConfirmed": true,
    "externalId": "{{Webflow Submission ID}}"
  }
}
```

If the initial contact email also needs the short request code in the subject,
use this order instead:

1. Webflow > Watch Events
2. HTTP > Make a request to `/api/requests/email-webhook`
3. Gmail > Send an Email

The HTTP response includes `requestCode`, for example `REQ-00025`. Use that
Gmail subject format:

```text
{{HTTP.requestCode}} | Request from {{First Name}} {{Last Name}} for {{Artists}}
```

The app cannot know `REQ-00025` until the webhook creates the request row, so
Gmail must run after the HTTP module if the first contact email should include
that code.

If the Gmail message is only a reply and does not include the `request` object,
the app will attach it by `threadId` when a matching request already exists.

The webhook accepts human Webflow timing labels and stores the app-safe value:

```text
ASAP                  -> asap
Within 1~2 Weeks      -> within_1_2_weeks
Flexible / Anytime    -> flexible
```

## Matching Rules

The webhook finds an existing request in this order:

1. `external_source = "webflow"` and `external_id`
2. `[REQ:<external_id>]` inside the email subject
3. `gmail_thread_id`
4. incoming email address + similar subject fallback

If no request is found, it creates a new request using the `request` object or
best-effort email fields.

Duplicate Gmail retries are safe because `provider + messageId` is unique.

## Artist First Email Test

For testing with `admin@oyabuntattoo.com` as the artist inbox:

1. Make sure the selected staff artist has `email = admin@oyabuntattoo.com`.
2. Run `docs/request_number_and_artist_forwarding.sql` so requests get short codes such as `REQ-00023`.
3. Assign the artist in the Request detail. The app sends the artist email automatically through Resend.
4. The artist clicks `Accept / draft client email`, edits the prepared client email, then sends it.
5. The client email uses Reply-To = artist email, so later client replies go directly to the artist.

When the artist sends the client draft, the request moves to
`client_waiting_for_reply` and the outbound email is recorded in `request_messages`.
For now, the app intentionally stops tracking after this first client email.
