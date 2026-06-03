"use client";

import { useMemo, useState } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { renderTemplateContent } from "@/lib/email-templates/custom-email-templates";

type EditorMode = "visual" | "html" | "preview";

type EmailTemplateEditorProps = {
  disabled?: boolean;
  html: string;
  onChange: (html: string) => void;
  subject: string;
};

const sampleVariables = {
  artistName: "YUSHI",
  artistPreference: "YUSHI",
  appointmentTime: "Friday, June 5, 2:00 PM PDT",
  customerName: "Test Client",
  newAppointmentTime: "Saturday, June 6, 3:00 PM PDT",
  oldAppointmentTime: "Friday, June 5, 2:00 PM PDT",
  projectName: "Backpiece tattoo",
};

function modeButtonClass(active: boolean) {
  return `h-9 rounded-md px-3 text-sm font-semibold transition ${
    active ? "bg-[#1f2428] text-white" : "text-[#4d555c] hover:bg-[#eee8dd]"
  }`;
}

export function EmailTemplateEditor({
  disabled = false,
  html,
  onChange,
  subject,
}: EmailTemplateEditorProps) {
  const [mode, setMode] = useState<EditorMode>("visual");
  const preview = useMemo(
    () => renderTemplateContent({ html, subject }, sampleVariables),
    [html, subject],
  );

  function insertImageHtml() {
    if (disabled) return;

    const url = window.prompt("Image URL", "https://");
    if (!url?.trim()) return;

    const alt = window.prompt("Image alt text", "") ?? "";
    const imageHtml = `<p><img src="${url.trim()}" alt="${alt.trim()}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`;
    onChange(`${html}\n${imageHtml}`);
  }

  return (
    <div className="rounded-md border border-[#cfc7b8] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5dfd4] bg-[#f7f2e9] px-3 py-2">
        <div className="grid grid-cols-3 rounded-md border border-[#d9d3c7] bg-white p-1">
          <button
            className={modeButtonClass(mode === "visual")}
            onClick={() => setMode("visual")}
            type="button"
          >
            Visual
          </button>
          <button
            className={modeButtonClass(mode === "html")}
            onClick={() => setMode("html")}
            type="button"
          >
            HTML
          </button>
          <button
            className={modeButtonClass(mode === "preview")}
            onClick={() => setMode("preview")}
            type="button"
          >
            Preview
          </button>
        </div>
        <button
          className="h-9 rounded-md border border-[#cfc7b8] bg-white px-3 text-sm font-semibold hover:bg-[#fdfbf7] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={insertImageHtml}
          type="button"
        >
          Insert image URL
        </button>
      </div>

      <div className="p-3">
        {mode === "visual" ? (
          <RichTextEditor disabled={disabled} html={html} onChange={(nextHtml) => onChange(nextHtml)} />
        ) : null}

        {mode === "html" ? (
          <textarea
            className="min-h-[28rem] w-full resize-y rounded-md border border-[#cfc7b8] bg-[#111827] px-4 py-3 font-mono text-sm leading-6 text-[#f9fafb] outline-none focus:border-[#9f5c3c]"
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            value={html}
          />
        ) : null}

        {mode === "preview" ? (
          <div className="overflow-hidden rounded-md border border-[#d9d3c7] bg-[#f6f4ef]">
            <div className="border-b border-[#e5dfd4] bg-white px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a6f4d]">
                Preview subject
              </p>
              <p className="mt-1 text-sm font-semibold">{preview.subject}</p>
            </div>
            <iframe
              className="h-[36rem] w-full bg-white"
              sandbox=""
              srcDoc={preview.html}
              title="Email template preview"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

