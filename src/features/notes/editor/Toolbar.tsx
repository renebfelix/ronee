"use client";

import { useRef, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  Code,
  CodeXml,
  Columns3,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  PanelTop,
  Quote,
  Redo2,
  RemoveFormatting,
  Rows3,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
  Underline,
  Undo2,
  Unlink,
  Upload,
  WrapText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { CODE_LANGUAGES, FONT_FAMILIES, FONT_SIZES, HIGHLIGHT_COLORS, LINE_HEIGHTS, TEXT_COLORS } from "./extensions";
import { Popover } from "./Popover";
import styles from "./RichEditor.module.scss";

export function TBtn({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
  shortcut,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      className={cn(styles.tbtn, active && styles.tbtnOn)}
      aria-label={label}
      aria-pressed={active ?? undefined}
      title={title}
      disabled={disabled}
      // Mantém a seleção do editor ao clicar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon size={17} aria-hidden />
    </button>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className={styles.group}>{children}</div>;
}

function ColorGrid({
  colors,
  current,
  onPick,
  onClear,
  clearLabel,
}: {
  colors: string[];
  current: string | null;
  onPick: (c: string) => void;
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <div className={styles.colorPanel}>
      <div className={styles.colorGrid}>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            className={cn(styles.colorCell, current?.toLowerCase() === c.toLowerCase() && styles.colorCellOn)}
            style={{ background: c }}
            aria-label={c}
            title={c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
      <div className={styles.colorRow}>
        <label className={styles.customColor}>
          <input type="color" defaultValue={current ?? "#5b5bf0"} onChange={(e) => onPick(e.target.value)} />
          Personalizada
        </label>
        <button type="button" className={styles.linkBtn} onClick={onClear}>
          {clearLabel}
        </button>
      </div>
    </div>
  );
}

function LinkPanel({ editor, close }: { editor: Editor; close: () => void }) {
  const [url, setUrl] = useState<string>(() => editor.getAttributes("link").href ?? "");
  const apply = () => {
    const href = url.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) chain.unsetLink().run();
    else {
      const withProto = /^(https?:|mailto:|tel:|#|\/)/i.test(href) ? href : `https://${href}`;
      if (editor.state.selection.empty && !editor.isActive("link")) {
        editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href: withProto } }] }).run();
      } else chain.setLink({ href: withProto }).run();
    }
    close();
  };
  return (
    <form
      className={styles.formPanel}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <label className={styles.panelLabel}>Endereço do link</label>
      <input className={styles.panelInput} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoFocus />
      <div className={styles.panelActions}>
        {editor.isActive("link") && (
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              close();
            }}
          >
            Remover link
          </button>
        )}
        <button type="submit" className={styles.primaryBtn}>
          Aplicar
        </button>
      </div>
    </form>
  );
}

function ImagePanel({ close, onUpload, editor }: { editor: Editor; close: () => void; onUpload: (files: File[]) => void }) {
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.formPanel}>
      <button type="button" className={styles.primaryBtn} onClick={() => fileRef.current?.click()}>
        <Upload size={16} aria-hidden /> Enviar do dispositivo
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onUpload(files);
          close();
        }}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const src = url.trim();
          if (src) editor.chain().focus().setImage({ src }).run();
          close();
        }}
        className={styles.stack}
      >
        <label className={styles.panelLabel}>Ou cole o endereço da imagem</label>
        <input className={styles.panelInput} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/imagem.png" />
        <div className={styles.panelActions}>
          <button type="submit" className={styles.secondaryBtn} disabled={!url.trim()}>
            Inserir
          </button>
        </div>
      </form>
    </div>
  );
}

function TablePicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  const N = 8;
  return (
    <div className={styles.tablePicker}>
      <div className={styles.tableGrid} onMouseLeave={() => setHover([0, 0])}>
        {Array.from({ length: N * N }, (_, i) => {
          const r = Math.floor(i / N) + 1;
          const c = (i % N) + 1;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${r} × ${c}`}
              className={cn(styles.tableCell, r <= hover[0] && c <= hover[1] && styles.tableCellOn)}
              onMouseEnter={() => setHover([r, c])}
              onFocus={() => setHover([r, c])}
              onClick={() => onPick(r, c)}
            />
          );
        })}
      </div>
      <p className={styles.panelHint}>{hover[0] ? `${hover[0]} × ${hover[1]}` : "Escolha o tamanho"}</p>
    </div>
  );
}

export function Toolbar({ editor, onUploadImages }: { editor: Editor; onUploadImages: (files: File[]) => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes("textStyle");
      return {
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        block: e.isActive("heading", { level: 1 })
          ? "h1"
          : e.isActive("heading", { level: 2 })
            ? "h2"
            : e.isActive("heading", { level: 3 })
              ? "h3"
              : e.isActive("heading", { level: 4 })
                ? "h4"
                : "p",
        fontFamily: (ts.fontFamily as string | undefined) ?? "",
        fontSize: (ts.fontSize as string | undefined) ?? "",
        lineHeight: (ts.lineHeight as string | undefined) ?? "",
        color: (ts.color as string | undefined) ?? null,
        highlight: (e.getAttributes("highlight").color as string | undefined) ?? (e.isActive("highlight") ? "#fef08a" : null),
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        code: e.isActive("code"),
        sub: e.isActive("subscript"),
        sup: e.isActive("superscript"),
        link: e.isActive("link"),
        alignLeft: e.isActive({ textAlign: "left" }),
        alignCenter: e.isActive({ textAlign: "center" }),
        alignRight: e.isActive({ textAlign: "right" }),
        alignJustify: e.isActive({ textAlign: "justify" }),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        task: e.isActive("taskList"),
        canSink: e.can().sinkListItem("listItem") || e.can().sinkListItem("taskItem"),
        canLift: e.can().liftListItem("listItem") || e.can().liftListItem("taskItem"),
        quote: e.isActive("blockquote"),
        codeBlock: e.isActive("codeBlock"),
        codeLang: (e.getAttributes("codeBlock").language as string | undefined) ?? "plaintext",
        inTable: e.isActive("table"),
        canMerge: e.can().mergeCells(),
        canSplit: e.can().splitCell(),
      };
    },
  });

  const c = () => editor.chain().focus();
  const listItem = editor.isActive("taskList") ? "taskItem" : "listItem";

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatação">
      <Group>
        <TBtn icon={Undo2} label="Desfazer" shortcut="Ctrl+Z" disabled={!s.canUndo} onClick={() => c().undo().run()} />
        <TBtn icon={Redo2} label="Refazer" shortcut="Ctrl+Y" disabled={!s.canRedo} onClick={() => c().redo().run()} />
      </Group>

      <Group>
        <select
          className={cn(styles.tselect, styles.tselectBlock)}
          aria-label="Estilo do parágrafo"
          value={s.block}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") c().setParagraph().run();
            else c().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 }).run();
          }}
        >
          <option value="p">Parágrafo</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
          <option value="h4">Título 4</option>
        </select>
        <select
          className={cn(styles.tselect, styles.tselectFont)}
          aria-label="Fonte"
          value={FONT_FAMILIES.some((f) => f.value === s.fontFamily) ? s.fontFamily : ""}
          onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className={cn(styles.tselect, styles.tselectSize)}
          aria-label="Tamanho da fonte"
          value={s.fontSize}
          onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().run())}
        >
          <option value="">Tam.</option>
          {FONT_SIZES.map((f) => (
            <option key={f} value={f}>
              {f.replace("px", "")}
            </option>
          ))}
        </select>
      </Group>

      <Group>
        <TBtn icon={Bold} label="Negrito" shortcut="Ctrl+B" active={s.bold} onClick={() => c().toggleBold().run()} />
        <TBtn icon={Italic} label="Itálico" shortcut="Ctrl+I" active={s.italic} onClick={() => c().toggleItalic().run()} />
        <TBtn icon={Underline} label="Sublinhado" shortcut="Ctrl+U" active={s.underline} onClick={() => c().toggleUnderline().run()} />
        <TBtn icon={Strikethrough} label="Tachado" shortcut="Ctrl+Shift+S" active={s.strike} onClick={() => c().toggleStrike().run()} />
        <TBtn icon={Code} label="Código em linha" shortcut="Ctrl+E" active={s.code} onClick={() => c().toggleCode().run()} />
        <TBtn icon={Subscript} label="Subscrito" active={s.sub} onClick={() => c().toggleSubscript().run()} />
        <TBtn icon={Superscript} label="Sobrescrito" active={s.sup} onClick={() => c().toggleSuperscript().run()} />
      </Group>

      <Group>
        <Popover icon={Baseline} label="Cor do texto" swatch={s.color ?? "var(--color-text)"}>
          {(close) => (
            <ColorGrid
              colors={TEXT_COLORS}
              current={s.color}
              onPick={(col) => {
                c().setColor(col).run();
                close();
              }}
              onClear={() => {
                c().unsetColor().run();
                close();
              }}
              clearLabel="Cor padrão"
            />
          )}
        </Popover>
        <Popover icon={Highlighter} label="Marca-texto" swatch={s.highlight}>
          {(close) => (
            <ColorGrid
              colors={HIGHLIGHT_COLORS}
              current={s.highlight}
              onPick={(col) => {
                c().setHighlight({ color: col }).run();
                close();
              }}
              onClear={() => {
                c().unsetHighlight().run();
                close();
              }}
              clearLabel="Sem marca-texto"
            />
          )}
        </Popover>
        <TBtn icon={RemoveFormatting} label="Limpar formatação" onClick={() => c().unsetAllMarks().clearNodes().run()} />
      </Group>

      <Group>
        <TBtn icon={AlignLeft} label="Alinhar à esquerda" shortcut="Ctrl+Shift+L" active={s.alignLeft} onClick={() => c().setTextAlign("left").run()} />
        <TBtn icon={AlignCenter} label="Centralizar" shortcut="Ctrl+Shift+E" active={s.alignCenter} onClick={() => c().setTextAlign("center").run()} />
        <TBtn icon={AlignRight} label="Alinhar à direita" shortcut="Ctrl+Shift+R" active={s.alignRight} onClick={() => c().setTextAlign("right").run()} />
        <TBtn icon={AlignJustify} label="Justificar" shortcut="Ctrl+Shift+J" active={s.alignJustify} onClick={() => c().setTextAlign("justify").run()} />
        <Popover icon={WrapText} label="Espaçamento entre linhas">
          {(close) => (
            <div className={styles.menu}>
              {LINE_HEIGHTS.map((lh) => (
                <button
                  key={lh}
                  type="button"
                  className={cn(styles.menuItem, s.lineHeight === lh && styles.menuItemOn)}
                  onClick={() => {
                    c().setLineHeight(lh).run();
                    close();
                  }}
                >
                  {lh.replace(".", ",")}
                </button>
              ))}
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  c().unsetLineHeight().run();
                  close();
                }}
              >
                Padrão
              </button>
            </div>
          )}
        </Popover>
      </Group>

      <Group>
        <TBtn icon={List} label="Lista com marcadores" shortcut="Ctrl+Shift+8" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
        <TBtn icon={ListOrdered} label="Lista numerada" shortcut="Ctrl+Shift+7" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
        <TBtn icon={ListTodo} label="Lista de tarefas" shortcut="Ctrl+Shift+9" active={s.task} onClick={() => c().toggleTaskList().run()} />
        <TBtn icon={IndentDecrease} label="Diminuir recuo" shortcut="Shift+Tab" disabled={!s.canLift} onClick={() => c().liftListItem(listItem).run()} />
        <TBtn icon={IndentIncrease} label="Aumentar recuo" shortcut="Tab" disabled={!s.canSink} onClick={() => c().sinkListItem(listItem).run()} />
      </Group>

      <Group>
        <TBtn icon={Quote} label="Citação" shortcut="Ctrl+Shift+B" active={s.quote} onClick={() => c().toggleBlockquote().run()} />
        <TBtn icon={CodeXml} label="Bloco de código" shortcut="Ctrl+Alt+C" active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()} />
        {s.codeBlock && (
          <select
            className={cn(styles.tselect, styles.tselectLang)}
            aria-label="Linguagem do código"
            value={s.codeLang}
            onChange={(e) => c().updateAttributes("codeBlock", { language: e.target.value }).run()}
          >
            {CODE_LANGUAGES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
        <TBtn icon={Minus} label="Linha horizontal" onClick={() => c().setHorizontalRule().run()} />
      </Group>

      <Group>
        <Popover icon={Link2} label="Link" active={s.link} caret={false}>
          {(close) => <LinkPanel editor={editor} close={close} />}
        </Popover>
        {s.link && <TBtn icon={Unlink} label="Remover link" onClick={() => c().extendMarkRange("link").unsetLink().run()} />}
        <Popover icon={ImagePlus} label="Imagem" caret={false}>
          {(close) => <ImagePanel editor={editor} close={close} onUpload={onUploadImages} />}
        </Popover>
        <Popover icon={Table} label="Tabela" caret={false} active={s.inTable}>
          {(close) => (
            <TablePicker
              onPick={(rows, cols) => {
                c().insertTable({ rows, cols, withHeaderRow: true }).run();
                close();
              }}
            />
          )}
        </Popover>
      </Group>

      {s.inTable && (
        <Group>
          <TBtn icon={BetweenHorizontalStart} label="Inserir linha acima" onClick={() => c().addRowBefore().run()} />
          <TBtn icon={BetweenHorizontalEnd} label="Inserir linha abaixo" onClick={() => c().addRowAfter().run()} />
          <TBtn icon={BetweenVerticalStart} label="Inserir coluna à esquerda" onClick={() => c().addColumnBefore().run()} />
          <TBtn icon={BetweenVerticalEnd} label="Inserir coluna à direita" onClick={() => c().addColumnAfter().run()} />
          <TBtn icon={Rows3} label="Excluir linha" onClick={() => c().deleteRow().run()} />
          <TBtn icon={Columns3} label="Excluir coluna" onClick={() => c().deleteColumn().run()} />
          <TBtn icon={TableCellsMerge} label="Mesclar células" disabled={!s.canMerge} onClick={() => c().mergeCells().run()} />
          <TBtn icon={TableCellsSplit} label="Dividir célula" disabled={!s.canSplit} onClick={() => c().splitCell().run()} />
          <TBtn icon={PanelTop} label="Alternar linha de cabeçalho" onClick={() => c().toggleHeaderRow().run()} />
          <TBtn icon={Trash2} label="Excluir tabela" onClick={() => c().deleteTable().run()} />
        </Group>
      )}
    </div>
  );
}
