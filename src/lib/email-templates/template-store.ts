import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultOperationsEmailTemplates,
  defaultTemplateForKey,
  renderTemplateContent,
  type OperationsEmailTemplate,
  type OperationsEmailTemplateKey,
  type RenderedEmail,
} from "@/lib/email-templates/custom-email-templates";

type StoredTemplateRow = {
  body_html: string | null;
  enabled: boolean | null;
  subject: string | null;
  template_key: string;
  test_mode: boolean | null;
};

export type TemplateVariables = Record<string, string | null | undefined>;

function normalizeStoredTemplate(row: StoredTemplateRow): OperationsEmailTemplate | null {
  const fallback = defaultTemplateForKey(row.template_key as OperationsEmailTemplateKey);
  if (!fallback) return null;

  return {
    ...fallback,
    subject: row.subject ?? fallback.subject,
    html: row.body_html ?? fallback.html,
    enabled: row.enabled ?? fallback.enabled,
    testMode: row.test_mode ?? fallback.testMode,
  };
}

export async function fetchOperationsEmailTemplates(
  adminClient: SupabaseClient,
): Promise<OperationsEmailTemplate[]> {
  const { data, error } = await adminClient
    .from("operations_email_templates")
    .select("template_key, subject, body_html, enabled, test_mode");

  if (error) {
    return defaultOperationsEmailTemplates;
  }

  const byKey = new Map(
    ((data as StoredTemplateRow[] | null) ?? [])
      .map(normalizeStoredTemplate)
      .filter((template): template is OperationsEmailTemplate => Boolean(template))
      .map((template) => [template.key, template]),
  );

  return defaultOperationsEmailTemplates.map((fallback) => byKey.get(fallback.key) ?? fallback);
}

export async function fetchOperationsEmailTemplate(
  adminClient: SupabaseClient,
  key: OperationsEmailTemplateKey,
): Promise<OperationsEmailTemplate> {
  const fallback = defaultTemplateForKey(key);
  if (!fallback) {
    throw new Error(`Unknown email template key: ${key}`);
  }

  const { data, error } = await adminClient
    .from("operations_email_templates")
    .select("template_key, subject, body_html, enabled, test_mode")
    .eq("template_key", key)
    .maybeSingle();

  if (error || !data) {
    return fallback;
  }

  return normalizeStoredTemplate(data as StoredTemplateRow) ?? fallback;
}

export async function renderOperationsEmailTemplate(
  adminClient: SupabaseClient,
  key: OperationsEmailTemplateKey,
  variables: TemplateVariables,
  fallback: RenderedEmail,
): Promise<RenderedEmail> {
  const template = await fetchOperationsEmailTemplate(adminClient, key);
  if (!template.enabled) {
    return fallback;
  }

  return renderTemplateContent(template, variables);
}

