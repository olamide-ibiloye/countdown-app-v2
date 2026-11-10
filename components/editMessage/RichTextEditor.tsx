"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Toolbar from "./Toolbar";

const RichTextEditor = ({
  message,
  onChange,
  placeholder,
}: {
  message: string;
  onChange: (richText: string) => void;
  placeholder?: string;
}) => {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        link: false,
        trailingNode: false,
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          HTMLAttributes: {
            class: "list-disc",
          },
        },
      }),
    ],
    content: message,
    editorProps: {
      attributes: {
        ...(placeholder && {
          role: "textbox",
          "aria-label": "Message",
          "aria-multiline": "true",
          "aria-placeholder": placeholder,
        }),
        class:
          "flex flex-col px-4 py-3 min-h-[300px] justify-start border-b border-r border-l border-gray-700 text-foreground items-start w-full gap-3 font-medium text-[16px] pt-4 rounded-bl-md rounded-br-md outline-none",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div>
      <Toolbar editor={editor} />
      <div className="relative">
        {placeholder && editor.isEmpty && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-4 text-muted-foreground"
          >
            {placeholder}
          </span>
        )}
        <EditorContent style={{ whiteSpace: "pre-line" }} editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
