import DOMPurify from "dompurify";

// Só o que o editor de descrição consegue gerar.
const ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "s", "code", "a", "h3", "ul", "ol", "li", "blockquote"];

/** A descrição é HTML salvo no Firestore: limpa antes de renderizar. */
export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ["href", "target", "rel"] });
}
