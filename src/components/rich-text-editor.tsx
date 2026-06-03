"use client";

import Link from "@tiptap/extension-link";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useState } from "react";

type RichTextEditorProps = {
  disabled?: boolean;
  html: string;
  onChange: (html: string, text: string) => void;
};

const colors = [
  "#111827",
  "#6b7280",
  "#9ca3af",
  "#d1d5db",
  "#ffffff",
  "#991b1b",
  "#ef4444",
  "#fca5a5",
  "#9a3412",
  "#f97316",
  "#fdba74",
  "#92400e",
  "#f59e0b",
  "#fcd34d",
  "#854d0e",
  "#eab308",
  "#fde047",
  "#4d7c0f",
  "#84cc16",
  "#bef264",
  "#166534",
  "#22c55e",
  "#86efac",
  "#0f766e",
  "#14b8a6",
  "#5eead4",
  "#0369a1",
  "#06b6d4",
  "#67e8f9",
  "#1d4ed8",
  "#3b82f6",
];

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

function toolbarButtonClass(active = false) {
  return `h-8 min-w-8 rounded border px-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
    active
      ? "border-[#1f2428] bg-[#1f2428] text-white"
      : "border-[#cfc7b8] bg-white text-[#1f2428] hover:bg-[#fdfbf7]"
  }`;
}

export function RichTextEditor({ disabled = false, html, onChange }: RichTextEditorProps) {
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);
  const [customColor, setCustomColor] = useState("#1f2428");
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      TextStyle,
      Color,
      Underline,
      Image.configure({
        allowBase64: false,
        inline: false,
      }),
      Link.configure({
        autolink: true,
        openOnClick: false,
        protocols: ["mailto", "https"],
      }),
    ],
    content: sanitizeEditorHtml(html),
    editorProps: {
      attributes: {
        class:
          "min-h-80 px-4 py-4 text-sm leading-6 outline-none [&_a]:text-[#315f82] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#d9d3c7] [&_blockquote]:pl-4 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6",
      },
    },
    onUpdate({ editor: nextEditor }) {
      const nextHtml = sanitizeEditorHtml(nextEditor.getHTML());
      onChange(nextHtml, nextEditor.getText().trim());
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const nextHtml = sanitizeEditorHtml(html);
    if (nextHtml !== editor.getHTML()) {
      editor.commands.setContent(nextHtml, { emitUpdate: false });
    }
  }, [editor, html]);

  function setLink() {
    if (!editor || disabled) return;

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "https://");
    if (url === null) return;

    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function setImage() {
    if (!editor || disabled) return;

    const url = window.prompt("Image URL", "https://");
    if (!url?.trim()) return;

    editor.chain().focus().setImage({ src: url.trim() }).run();
  }

  if (!editor) {
    return (
      <div className="mt-2 rounded-md border border-[#cfc7b8] bg-white px-4 py-8 text-sm font-semibold text-[#697178]">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-[#cfc7b8] bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#e5dfd4] bg-[#f7f2e9] px-2 py-2">
        <select
          className="h-8 rounded border border-[#cfc7b8] bg-white px-2 text-sm font-semibold"
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
            if (value === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
            if (value === "p") editor.chain().focus().setParagraph().run();
          }}
          value={
            editor.isActive("heading", { level: 2 })
              ? "h2"
              : editor.isActive("heading", { level: 3 })
                ? "h3"
                : "p"
          }
        >
          <option value="p">Paragraph</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </select>
        <button
          className={toolbarButtonClass(editor.isActive("bold"))}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          type="button"
        >
          B
        </button>
        <button
          className={`${toolbarButtonClass(editor.isActive("italic"))} italic`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
          type="button"
        >
          I
        </button>
        <button
          className={`${toolbarButtonClass(editor.isActive("underline"))} underline`}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
          type="button"
        >
          U
        </button>
        <button
          className={toolbarButtonClass(editor.isActive("bulletList"))}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bulleted list"
          type="button"
        >
          List
        </button>
        <button
          className={toolbarButtonClass(editor.isActive("orderedList"))}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
          type="button"
        >
          1.
        </button>
        <button
          className={toolbarButtonClass(editor.isActive("blockquote"))}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
          type="button"
        >
          Quote
        </button>
        <div className="relative">
          <button
            className={toolbarButtonClass(colorPaletteOpen)}
            disabled={disabled}
            onClick={() => setColorPaletteOpen((open) => !open)}
            title="Text color"
            type="button"
          >
            Color
          </button>
          {colorPaletteOpen ? (
            <div className="absolute left-0 top-10 z-20 w-72 rounded-md border border-[#cfc7b8] bg-white p-3 shadow-xl">
              <div className="grid grid-cols-10 gap-1.5">
                {colors.map((color) => (
                  <button
                    aria-label={`Set text color ${color}`}
                    className="h-6 w-6 rounded border border-[#cfc7b8] ring-offset-1 transition hover:ring-2 hover:ring-[#8a6f4d]"
                    key={color}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      setColorPaletteOpen(false);
                    }}
                    style={{ backgroundColor: color }}
                    title={color}
                    type="button"
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#e5dfd4] pt-3">
                <label className="flex items-center gap-2 text-xs font-bold text-[#697178]">
                  Custom
                  <input
                    aria-label="Custom text color"
                    className="h-7 w-9 cursor-pointer rounded border border-[#cfc7b8] bg-white p-0.5"
                    onChange={(event) => {
                      const nextColor = event.target.value;
                      setCustomColor(nextColor);
                      editor.chain().focus().setColor(nextColor).run();
                    }}
                    title="Custom color"
                    type="color"
                    value={customColor}
                  />
                </label>
                <button
                  className="h-8 rounded border border-[#cfc7b8] px-2 text-xs font-bold text-[#697178] hover:bg-[#f7f2e9]"
                  onClick={() => {
                    editor.chain().focus().unsetColor().run();
                    setColorPaletteOpen(false);
                  }}
                  title="Clear color"
                  type="button"
                >
                  Clear color
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <button
          className={toolbarButtonClass(editor.isActive("link"))}
          disabled={disabled}
          onClick={setLink}
          title="Link"
          type="button"
        >
          Link
        </button>
        <button
          className={toolbarButtonClass()}
          disabled={disabled}
          onClick={setImage}
          title="Image"
          type="button"
        >
          Image
        </button>
        <button
          className={toolbarButtonClass()}
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
          type="button"
        >
          Undo
        </button>
        <button
          className={toolbarButtonClass()}
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
          type="button"
        >
          Redo
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
