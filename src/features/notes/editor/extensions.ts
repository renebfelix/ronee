import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Typography from "@tiptap/extension-typography";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

export function buildExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
    }),
    TextStyleKit,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Image.configure({ allowBase64: false, resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 60, minHeight: 40 } }),
    TableKit.configure({ table: { resizable: true } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Subscript,
    Superscript,
    Typography,
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),
    CharacterCount,
    Placeholder.configure({ placeholder }),
  ];
}

export const FONT_FAMILIES = [
  { label: "Padrão", value: "" },
  { label: "Sans-serif", value: "Inter, Arial, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Monoespaçada", value: "ui-monospace, Consolas, monospace" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

export const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "40px", "48px", "64px"];

export const LINE_HEIGHTS = ["1", "1.15", "1.5", "1.75", "2", "2.5"];

export const TEXT_COLORS = [
  "#161a2b", "#636b85", "#959cb3", "#e0384f", "#f97316", "#d98a06",
  "#16a571", "#0ea5a4", "#1f8ae0", "#5b5bf0", "#c04fd8", "#db2777",
];

export const HIGHLIGHT_COLORS = [
  "#fef08a", "#fde68a", "#fed7aa", "#fecaca", "#fbcfe8", "#e9d5ff",
  "#c7d2fe", "#bfdbfe", "#a5f3fc", "#bbf7d0", "#d9f99d", "#e5e7eb",
];

export const CODE_LANGUAGES = [
  ["plaintext", "Texto"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["python", "Python"],
  ["java", "Java"],
  ["csharp", "C#"],
  ["cpp", "C++"],
  ["go", "Go"],
  ["rust", "Rust"],
  ["php", "PHP"],
  ["ruby", "Ruby"],
  ["sql", "SQL"],
  ["bash", "Bash"],
  ["json", "JSON"],
  ["xml", "HTML/XML"],
  ["css", "CSS"],
  ["scss", "SCSS"],
  ["yaml", "YAML"],
  ["markdown", "Markdown"],
] as const;
