"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Code,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  TextQuote,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import styles from "./Tasks.module.scss";

interface ToolbarButton {
  label: string;
  icon: LucideIcon;
  run: (editor: Editor) => void;
  active?: (editor: Editor) => boolean;
  disabled?: (editor: Editor) => boolean;
}

function toggleLink(editor: Editor) {
  if (editor.isActive("link")) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  const url = window.prompt("Endereço do link:", "https://");
  if (!url || url === "https://") return;
  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}

const GROUPS: ToolbarButton[][] = [
  [
    { label: "Negrito", icon: Bold, run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive("bold") },
    { label: "Itálico", icon: Italic, run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive("italic") },
    { label: "Sublinhado", icon: Underline, run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive("underline") },
    { label: "Tachado", icon: Strikethrough, run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive("strike") },
  ],
  [
    { label: "Título", icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive("heading") },
    { label: "Lista", icon: List, run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive("bulletList") },
    { label: "Lista numerada", icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive("orderedList") },
    { label: "Citação", icon: TextQuote, run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive("blockquote") },
    { label: "Código", icon: Code, run: (e) => e.chain().focus().toggleCode().run(), active: (e) => e.isActive("code") },
    { label: "Link", icon: Link, run: toggleLink, active: (e) => e.isActive("link") },
  ],
  [
    { label: "Desfazer", icon: Undo2, run: (e) => e.chain().focus().undo().run(), disabled: (e) => !e.can().undo() },
    { label: "Refazer", icon: Redo2, run: (e) => e.chain().focus().redo().run(), disabled: (e) => !e.can().redo() },
  ],
];

function Toolbar({ editor }: { editor: Editor }) {
  // Re-renderiza a barra quando a seleção ou o conteúdo mudam.
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      GROUPS.map((group) => group.map((b) => ({ active: b.active?.(editor) ?? false, disabled: b.disabled?.(editor) ?? false }))),
  });

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatação">
      {GROUPS.map((group, gi) => (
        <div key={gi} className={styles.toolbarGroup}>
          {group.map(({ label, icon: Icon, run }, bi) => (
            <button
              type="button"
              key={label}
              className={cn(styles.toolbarBtn, state[gi][bi].active && styles.toolbarBtnOn)}
              disabled={state[gi][bi].disabled}
              onClick={() => run(editor)}
              aria-label={label}
              aria-pressed={state[gi][bi].active}
              title={label}
            >
              <Icon size={15} aria-hidden />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Editor simples (Tiptap) para a descrição opcional da tarefa. Vazio vira "". */
export function DescriptionEditor({
  value,
  onChange,
  placeholder = "Adicione detalhes...",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { class: cn(styles.editorContent, styles.richText) } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  if (!editor) return <div className={cn(styles.editor, styles.editorLoading)} />;

  return (
    <div className={styles.editor}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
