"use client";

import { useEffect, useRef } from "react";

type RichTextEditorProps = {
  disabled?: boolean;
  html: string;
  onChange: (html: string, text: string) => void;
};

const colors = ["#1f2428", "#8a3030", "#2f6658", "#315f82", "#8a5130"];

function sanitizeEditorHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "");
}

export function htmlToPlainText(html: string) {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const element = document.createElement("div");
  element.innerHTML = html;
  return element.innerText.trim();
}

export function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function RichTextEditor({ disabled = false, html, onChange }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== html) {
      editor.innerHTML = sanitizeEditorHtml(html);
    }
  }, [html]);

  function sync() {
    const nextHtml = sanitizeEditorHtml(editorRef.current?.innerHTML ?? "");
    onChange(nextHtml, htmlToPlainText(nextHtml));
  }

  function command(name: string, value?: string) {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    sync();
  }

  return (
    <div className="mt-2 rounded-md border border-[#cfc7b8] bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#e5dfd4] bg-[#f7f2e9] px-2 py-2">
        <button
          className="h-8 min-w-8 rounded border border-[#cfc7b8] px-2 text-sm font-black hover:bg-white disabled:opacity-50"
          disabled={disabled}
          onClick={() => command("bold")}
          title="Bold"
          type="button"
        >
          B
        </button>
        <button
          className="h-8 min-w-8 rounded border border-[#cfc7b8] px-2 text-sm font-bold italic hover:bg-white disabled:opacity-50"
          disabled={disabled}
          onClick={() => command("italic")}
          title="Italic"
          type="button"
        >
          I
        </button>
        <button
          className="h-8 rounded border border-[#cfc7b8] px-2 text-sm font-semibold hover:bg-white disabled:opacity-50"
          disabled={disabled}
          onClick={() => command("insertUnorderedList")}
          title="Bulleted list"
          type="button"
        >
          List
        </button>
        <select
          className="h-8 rounded border border-[#cfc7b8] bg-white px-2 text-sm"
          disabled={disabled}
          onChange={(event) => command("foreColor", event.target.value)}
          title="Text color"
          value=""
        >
          <option value="" disabled>
            Color
          </option>
          {colors.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </div>
      <div
        className="min-h-80 w-full px-3 py-3 text-sm leading-6 outline-none disabled:bg-[#eee8dd] [&_a]:text-[#315f82] [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
        contentEditable={!disabled}
        onBlur={sync}
        onInput={sync}
        ref={editorRef}
        suppressContentEditableWarning
      />
    </div>
  );
}
