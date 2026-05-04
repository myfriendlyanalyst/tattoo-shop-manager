# Make.com: Webflow Request Form to Supabase

Use this after Webflow form submissions are already flowing through Make.com.
The recommended scenario is:

1. Webflow form submission
2. Send/forward Gmail notification
3. Insert one row into Supabase `requests`

## Supabase Request

Make.com module: `HTTP > Make a request`

Method: `POST`

URL:

```text
https://tkblwbahhtnoxbzkgvbb.supabase.co/rest/v1/requests
```

Headers:

```text
apikey: <SUPABASE_PUBLISHABLE_KEY>
Authorization: Bearer <SUPABASE_PUBLISHABLE_KEY>
Content-Type: application/json
Prefer: return=representation
```

Body type: Raw JSON

Example body:

```json
{
  "client_name": "{{webflow.name}}",
  "email": "{{webflow.email}}",
  "phone": "{{webflow.phone}}",
  "subject": "{{webflow.tattoo_subject}}",
  "artist_id": null,
  "priority": "normal",
  "status": "new",
  "notes": "Placement: {{webflow.placement}}\nSize: {{webflow.size}}\nBudget: {{webflow.budget}}\nMessage: {{webflow.message}}"
}
```

## Artist Selection

If the Webflow form has an artist dropdown, Make.com needs to map that label to
the matching Supabase `staff.id`.

Recommended first version:

- If client chose a specific artist, leave a readable note such as
  `Requested artist: YUSHI`.
- Owner selects the final artist inside the app.
- If client chose `Any available`, keep `artist_id` as `null`.

Later version:

- Add a Make.com lookup table mapping artist names to Supabase staff UUIDs.
- Set `artist_id` only when the form selection is an exact known artist.

## Duplicate Control

Webflow/Make retries can accidentally insert duplicates. A future improvement is
to add `external_source` and `external_id` columns to `requests`, then make the
pair unique.

For now, keep the Gmail notification and app request list visible so duplicates
can be spotted quickly.

## Next Email Thread Step

For ongoing Gmail conversation tracking, add a later table such as
`request_messages` and store Gmail thread/message IDs from Make.com. The app can
then show a read-only email timeline inside each Request.
