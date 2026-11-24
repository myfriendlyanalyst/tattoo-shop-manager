-- FND-01 deployed-catalog alignment for a fresh disposable Supabase only.
-- Source: supabase/snapshots/production-catalog-20261123.json
-- Do not apply this reconstruction chain to the existing production database.
-- Captured privileges are preserved here; capability redesign belongs to FND-04.

-- Only the deployed accounting_users_updated_at trigger should remain.
drop trigger if exists set_accounting_users_updated_at on public.accounting_users;

-- Production protects the shop feed-token table with RLS and no client policy.
alter table public.calendar_feed_tokens enable row level security;

revoke all privileges on function public."can_access_accounting"() from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."can_access_accounting"() to PUBLIC;
grant EXECUTE on function public."can_access_accounting"() to "authenticated";
grant EXECUTE on function public."can_access_accounting"() to "service_role";

revoke all privileges on function public."current_staff_id"() from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."current_staff_id"() to PUBLIC;
grant EXECUTE on function public."current_staff_id"() to "authenticated";

revoke all privileges on function public."current_user_role"() from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."current_user_role"() to PUBLIC;
grant EXECUTE on function public."current_user_role"() to "authenticated";

revoke all privileges on function public."has_staff_permission"(required_key text) from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."has_staff_permission"(required_key text) to PUBLIC;
grant EXECUTE on function public."has_staff_permission"(required_key text) to "authenticated";

revoke all privileges on function public."is_accounting_admin"() from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."is_accounting_admin"() to PUBLIC;
grant EXECUTE on function public."is_accounting_admin"() to "authenticated";
grant EXECUTE on function public."is_accounting_admin"() to "service_role";

revoke all privileges on function public."is_operations_user"() from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."is_operations_user"() to PUBLIC;
grant EXECUTE on function public."is_operations_user"() to "authenticated";

revoke all privileges on function public."is_owner_or_admin"() from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."is_owner_or_admin"() to PUBLIC;
grant EXECUTE on function public."is_owner_or_admin"() to "authenticated";

revoke all privileges on function public."normalize_customer_phone"(phone_value text) from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."normalize_customer_phone"(phone_value text) to PUBLIC;

revoke all privileges on function public."prevent_overlapping_active_payouts"() from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."prevent_overlapping_active_payouts"() to PUBLIC;

revoke all privileges on function public."set_customer_phone_normalized"() from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."set_customer_phone_normalized"() to PUBLIC;

revoke all privileges on function public."set_updated_at"() from PUBLIC, "anon", "authenticated", "service_role";
grant EXECUTE on function public."set_updated_at"() to PUBLIC;
grant EXECUTE on function public."set_updated_at"() to "authenticated";

revoke all privileges on table public."accounting_entries" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."accounting_entries" to "anon";
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public."accounting_entries" to "authenticated";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."accounting_entries" to "service_role";

revoke all privileges on table public."accounting_users" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."accounting_users" to "anon";
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public."accounting_users" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."accounting_users" to "service_role";

revoke all privileges on table public."appointment_google_calendar_events" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."appointment_google_calendar_events" to "anon";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."appointment_google_calendar_events" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."appointment_google_calendar_events" to "service_role";

revoke all privileges on table public."appointments" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."appointments" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."appointments" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."appointments" to "service_role";

revoke all privileges on table public."calendar_feed_tokens" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."calendar_feed_tokens" to "anon";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."calendar_feed_tokens" to "authenticated";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."calendar_feed_tokens" to "service_role";

revoke all privileges on table public."customers" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."customers" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."customers" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."customers" to "service_role";

revoke all privileges on table public."deposit_applications" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."deposit_applications" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."deposit_applications" to "authenticated";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."deposit_applications" to "service_role";

revoke all privileges on table public."deposits" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."deposits" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."deposits" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."deposits" to "service_role";

revoke all privileges on table public."email_logs" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."email_logs" to "anon";
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public."email_logs" to "authenticated";
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."email_logs" to "service_role";

revoke all privileges on table public."files" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."files" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."files" to "authenticated";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."files" to "service_role";

revoke all privileges on table public."operations_email_templates" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."operations_email_templates" to "anon";
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public."operations_email_templates" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."operations_email_templates" to "service_role";

revoke all privileges on table public."payout_items" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."payout_items" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."payout_items" to "authenticated";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."payout_items" to "service_role";

revoke all privileges on table public."payouts" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."payouts" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."payouts" to "authenticated";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."payouts" to "service_role";

revoke all privileges on table public."profiles" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."profiles" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."profiles" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."profiles" to "service_role";

revoke all privileges on table public."projects" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."projects" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."projects" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."projects" to "service_role";

revoke all privileges on table public."request_artist_action_tokens" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."request_artist_action_tokens" to "anon";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."request_artist_action_tokens" to "authenticated";
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."request_artist_action_tokens" to "service_role";

revoke all privileges on table public."request_artist_candidates" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."request_artist_candidates" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."request_artist_candidates" to "authenticated";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."request_artist_candidates" to "service_role";

revoke all privileges on table public."request_client_action_tokens" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."request_client_action_tokens" to "anon";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."request_client_action_tokens" to "authenticated";
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."request_client_action_tokens" to "service_role";

revoke all privileges on table public."request_messages" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."request_messages" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."request_messages" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."request_messages" to "service_role";

revoke all privileges on sequence public."request_number_seq" from PUBLIC, "anon", "authenticated", "service_role";
grant UPDATE on sequence public."request_number_seq" to "anon";
grant SELECT, UPDATE, USAGE on sequence public."request_number_seq" to "authenticated";
grant SELECT, UPDATE, USAGE on sequence public."request_number_seq" to "service_role";

revoke all privileges on table public."requests" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."requests" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."requests" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."requests" to "service_role";

revoke all privileges on table public."session_entries" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."session_entries" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."session_entries" to "authenticated";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."session_entries" to "service_role";

revoke all privileges on table public."session_payments" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."session_payments" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."session_payments" to "authenticated";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."session_payments" to "service_role";

revoke all privileges on table public."staff" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."staff" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."staff" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."staff" to "service_role";

revoke all privileges on table public."staff_google_calendar_connections" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."staff_google_calendar_connections" to "anon";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."staff_google_calendar_connections" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."staff_google_calendar_connections" to "service_role";

revoke all privileges on table public."staff_permissions" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."staff_permissions" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."staff_permissions" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."staff_permissions" to "service_role";

revoke all privileges on table public."staff_schedules" from PUBLIC, "anon", "authenticated", "service_role";
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public."staff_schedules" to "anon";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."staff_schedules" to "authenticated";
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public."staff_schedules" to "service_role";

revoke all privileges on schema public from PUBLIC, "anon", "authenticated", "service_role";
grant USAGE on schema public to PUBLIC;
grant USAGE on schema public to "anon";
grant USAGE on schema public to "authenticated";
grant USAGE on schema public to "service_role";

