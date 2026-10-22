/**
 * Markdown → clean Arabic text for chat bubbles.
 *
 * The assistant (and any model behind it) writes with Markdown markers —
 * `**bold**`, `* bullet`, `_italic_`, backticks. The chat renders plain text,
 * so those markers used to show up literally («* **دولار أمريكي:** 10,386»).
 * This normaliser keeps the meaning and drops the punctuation:
 *
 *   **الدولار**        → الدولار
 *   *  الدولار …       → • الدولار …
 *   _المصدر_           → المصدر
 *   `10386`            → 10386
 */
export function toChatText(input: string): string {
  if (!input) return '';
  let text = String(input);

  // Fenced code blocks → their content only
  text = text.replace(/```[a-zA-Z]*\n?([\s\S]*?)```/g, '$1');

  // Inline code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Bold / italic markers (**, __, *, _) wrapped around a word
  text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1');
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  text = text.replace(/__([^_\n]+)__/g, '$1');
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,،:؛!?)]|$)/g, '$1$2');
  text = text.replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,،:؛!?)]|$)/g, '$1$2');

  // Markdown list markers at the start of a line → a real bullet
  text = text.replace(/^[ \t]*[-*+][ \t]+/gm, '• ');
  text = text.replace(/^[ \t]*(\d+)[.)][ \t]+/gm, '$1. ');

  // Headings (## title) → plain line
  text = text.replace(/^[ \t]*#{1,6}[ \t]*/gm, '');

  // Stray asterisks left over (e.g. a lone "*" used as a separator)
  text = text.replace(/(^|\s)\*(?=\s|$)/g, '$1');

  // Collapse 3+ blank lines into one
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
