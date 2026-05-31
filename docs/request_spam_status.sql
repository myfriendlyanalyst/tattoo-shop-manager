-- Add a recoverable spam state for request triage.
-- Spam requests stay in the request log but are hidden from the default queue
-- and should not be assigned or converted into projects.

alter type public.request_status
add value if not exists 'spam';
