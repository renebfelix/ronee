"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Highlighter, Italic, Link2, Strikethrough, Underline } from "lucide-react";
import { uploadImage, MAX_IMAGE_BYTES } from "@/features/shopping/lib/upload";
import { cn } from "@/lib/utils/cn";
import { buildExtensions } from "./extensions";
import { TBtn, Toolbar } from "./Toolbar";
import styles from "./RichEditor.module.scss";

export interface RichEditorChange {
  html: string;
  text: string;
  words: number;
}

export interface RichEditorProps {
  initialHtml: string;
  onChange: (change: RichEditorChange) => void;
  /** "page" = documento em folha; "plain" = nota. */
  layout: "page" | "plain";
  placeholder?: string;
  onReady?: (editor: Editor) => void;
  onError?: (message: string) => void;
  /** Conteúdo acima do texto, dentro da área rolável (ex.: campo de título). */
  header?: React.ReactNode;
}

function imageFiles(list: FileList | null | undefined) {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
}

export function RichEditor({ initialHtml, onChange, layout, placeholder, onReady, onError, header }: RichEditorProps) {
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onChangeRef.current = onChange;
    onErrorRef.current = onError;
  });
  const editorRef = useRef<Editor | null>(null);
  const [uploading, setUploading] = useState(0);

  const upload = async (files: File[], pos?: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) {
        onErrorRef.current?.(`“${file.name}” passa de 8 MB.`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const src = await uploadImage(file);
        const chain = ed.chain().focus();
        if (pos != null) chain.insertContentAt(pos, { type: "image", attrs: { src, alt: file.name } }).run();
        else chain.setImage({ src, alt: file.name }).run();
      } catch (e) {
        onErrorRef.current?.(e instanceof Error ? e.message : "Falha ao enviar a imagem.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  const uploadRef = useRef(upload);
  useEffect(() => {
    uploadRef.current = upload;
  });

  const editor = useEditor({
    extensions: buildExtensions(placeholder ?? "Comece a escrever…"),
    content: initialHtml,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: cn(styles.prose, "ronee-prose"), spellcheck: "true" },
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length) return false;
        event.preventDefault();
        void uploadRef.current(files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = imageFiles((event as DragEvent).dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void uploadRef.current(files, coords?.pos);
        return true;
      },
    },
    onCreate: ({ editor: e }) => {
      editorRef.current = e;
      onReady?.(e);
    },
    onUpdate: ({ editor: e }) => {
      const text = e.getText({ blockSeparator: "\n" });
      onChangeRef.current({ html: e.getHTML(), text, words: e.storage.characterCount.words() });
    },
  });

  const counts = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e ? { words: e.storage.characterCount.words() as number, chars: e.storage.characterCount.characters() as number } : { words: 0, chars: 0 },
  }) ?? { words: 0, chars: 0 };

  if (!editor) return <div className={styles.loading} />;

  const minutes = Math.max(1, Math.round(counts.words / 200));

  return (
    <div className={cn(styles.editor, layout === "page" && styles.pageLayout)}>
      <Toolbar editor={editor} onUploadImages={(f) => void upload(f)} />

      <div className={styles.scroller}>
        <div className={layout === "page" ? styles.page : styles.plain}>
          {header}
          <EditorContent editor={editor} />
        </div>
      </div>

      <BubbleMenu editor={editor} className={styles.bubble} shouldShow={({ editor: e, state }) => !state.selection.empty && !e.isActive("image") && !e.isActive("codeBlock")}>
        <BubbleButtons editor={editor} />
      </BubbleMenu>

      <div className={styles.footer}>
        {uploading > 0 && <span className={styles.uploading}>Enviando {uploading === 1 ? "imagem" : `${uploading} imagens`}…</span>}
        <span>
          {counts.words.toLocaleString("pt-BR")} {counts.words === 1 ? "palavra" : "palavras"}
        </span>
        <span>{counts.chars.toLocaleString("pt-BR")} caracteres</span>
        {counts.words > 0 && <span>~{minutes} min de leitura</span>}
      </div>
    </div>
  );
}

function BubbleButtons({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
    }),
  });
  const c = () => editor.chain().focus();
  return (
    <>
      <TBtn icon={Bold} label="Negrito" active={s.bold} onClick={() => c().toggleBold().run()} />
      <TBtn icon={Italic} label="Itálico" active={s.italic} onClick={() => c().toggleItalic().run()} />
      <TBtn icon={Underline} label="Sublinhado" active={s.underline} onClick={() => c().toggleUnderline().run()} />
      <TBtn icon={Strikethrough} label="Tachado" active={s.strike} onClick={() => c().toggleStrike().run()} />
      <TBtn icon={Highlighter} label="Marca-texto" active={s.highlight} onClick={() => c().toggleHighlight({ color: "#fef08a" }).run()} />
      <TBtn
        icon={Link2}
        label={s.link ? "Remover link" : "Link"}
        active={s.link}
        onClick={() => {
          if (s.link) return c().extendMarkRange("link").unsetLink().run();
          const url = window.prompt("Endereço do link");
          if (url?.trim()) {
            const href = /^(https?:|mailto:|tel:|#|\/)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
            c().extendMarkRange("link").setLink({ href }).run();
          }
        }}
      />
    </>
  );
}
