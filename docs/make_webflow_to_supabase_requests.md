# Make.com: Oyabun Webflow Request Form to Supabase

Use this after Oyabun's Webflow form submissions are already flowing through
Make.com. The current website form appears in the `Consult with our artists`
section at `https://oyabuntattoo.com/`.

The recommended scenario is:

1. Webflow form submission
2. Send/forward Gmail notification
3. Insert one row into Supabase `requests`
4. Upload the reference image to Supabase Storage
5. Insert one row into Supabase `files`

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
  "tattoo_description": "{{Tattoo Description}}",
  "approximate_size": "{{Approximate Size (in inches)}}",
  "placement": "{{Placement on your Body}}",
  "reference_image_url": null,
  "requested_artist_label": "{{Artist you want to consult with}}",
  "age_confirmed": true,
  "artist_id": null,
  "status": "new",
  "notes": null
}
```

If Make.com field tokens have different names, use the Webflow module output
tokens that correspond to the labels above.

`subject` is still required by the database, but the app treats it as an
internal summary and fills it from `Tattoo Description`. Operators do not need a
separate short subject field.

## Required Request Columns

Before using the JSON body above, run this SQL once in Supabase:

```text
docs/supabase_request_form_columns.sql
docs/supabase_request_reference_storage.sql
```

The app expects these Webflow-specific fields to be stored as separate columns:

- `tattoo_description`
- `approximate_size`
- `placement`
- `reference_image_url`
- `requested_artist_label`
- `age_confirmed`

When using `POST /api/requests/email-webhook`, send the Webflow `When` label as
`request.tattooTimingPreference`. The webhook normalizes labels such as
`Within 1~2 Weeks` to the database value `within_1_2_weeks`.

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

The app now expects reference images to be stored as files, not as plain URL
text.

Make.com flow:

1. Create the `requests` row using the JSON above.
2. Read the returned request `id`.
3. Download the Webflow reference image file.
4. Upload the binary file to Supabase Storage bucket `request-references`.
5. Insert a matching metadata row into public `files`.

Storage upload request:

Method: `POST`

URL:

```text
https://tkblwbahhtnoxbzkgvbb.supabase.co/storage/v1/object/request-references/requests/{{request_id}}/{{safe_file_name}}
```

Headers:

```text
apikey: <SUPABASE_PUBLISHABLE_KEY>
Authorization: Bearer <SUPABASE_PUBLISHABLE_KEY>
Content-Type: {{reference_image_mime_type}}
```

Body: raw binary file data from Webflow/Make.com.

After upload succeeds, insert into `files`:

```json
{
  "request_id": "{{request_id}}",
  "file_type": "reference",
  "storage_path": "requests/{{request_id}}/{{safe_file_name}}",
  "original_name": "{{original_file_name}}",
  "mime_type": "{{reference_image_mime_type}}",
  "size_bytes": "{{reference_image_size_bytes}}"
}
```

If Make.com cannot upload the file in the first automation version, keep the
reference image in Gmail and let the owner upload it manually in the app. Avoid
using `reference_image_url` except as a temporary legacy fallback.

## Next Email Thread Step

For ongoing Gmail conversation tracking, add a later table such as
`request_messages` and store Gmail thread/message IDs from Make.com. The app can
then show a read-only email timeline inside each Request.

Recommended first email-thread version:

- Gmail remains the place where owner replies.
- Make.com watches new messages in the Gmail thread.
- Make.com inserts read-only message records into Supabase later.

Implemented app-side setup:

```text
docs/request_email_tracking_migration.sql
docs/request_email_tracking_make.md
POST /api/requests/email-webhook
```
