# Make.com: Oyabun Webflow Request Form to Supabase

Use this after Oyabun's Webflow form submissions are already flowing through
Make.com. The current website form appears in the `Consult with our artists`
section at `https://oyabuntattoo.com/`.

The recommended scenario is:

1. Webflow form submission
2. Send/forward Gmail notification
3. Insert one row into Supabase `requests`

## Current Webflow Fields

These are the fields visible on the Oyabun website request form:

- `Name`
- `Email Address`
- `Phone Number`
- `Artist you want to consult with`
  - `Any available artist`
  - `YUSHI`
  - `BAKI`
  - `JC`
  - `Phangs`
- `Tattoo Description`
- `Approximate Size (in inches)`
- `Placement on your Body`
- `Reference image`
- `Yes, I am 18 years or older.`

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

Recommended first-version body:

```json
{
  "client_name": "{{Name}}",
  "email": "{{Email Address}}",
  "phone": "{{Phone Number}}",
  "subject": "{{Tattoo Description}}",
  "artist_id": null,
  "priority": "normal",
  "status": "new",
  "notes": "Requested artist: {{Artist you want to consult with}}\nTattoo description: {{Tattoo Description}}\nApproximate size: {{Approximate Size (in inches)}}\nPlacement: {{Placement on your Body}}\nReference image: {{Reference image}}\nAge confirmation: {{Yes, I am 18 years or older.}}"
}
```

If Make.com field tokens have different names, use the Webflow module output
tokens that correspond to the labels above.

## Artist Selection

Recommended first version:

- Always keep `artist_id` as `null`.
- Store the submitted artist label in `notes`.
- Owner reviews the request in the app and chooses candidate artists.
- If the client selected `Any available artist`, owner sends it to multiple
  candidate artists.
- If the client selected a specific artist, owner can send it to that artist
  first, while still keeping the final selection inside the app.

Later version:

- Add a Make.com lookup table mapping artist names to Supabase staff UUIDs.
- Set `artist_id` only when the form selection is an exact known artist.
- Keep `Any available artist` as `null`.

## Duplicate Control

Webflow/Make retries can accidentally insert duplicates. A future improvement is
to add `external_source` and `external_id` columns to `requests`, then make the
pair unique.

For now, keep the Gmail notification and app request list visible so duplicates
can be spotted quickly.

## Reference Image Handling

First version:

- Store the Webflow/Make.com reference image URL inside `notes`.
- Keep the actual uploaded file in Webflow/Gmail/Make.com storage.

Later version:

- Upload the image to Supabase Storage.
- Insert one row into `files` with `request_id`, `file_type = 'reference'`,
  and the Supabase storage path.

## Next Email Thread Step

For ongoing Gmail conversation tracking, add a later table such as
`request_messages` and store Gmail thread/message IDs from Make.com. The app can
then show a read-only email timeline inside each Request.

Recommended first email-thread version:

- Gmail remains the place where owner replies.
- Make.com watches new messages in the Gmail thread.
- Make.com inserts read-only message records into Supabase later.
