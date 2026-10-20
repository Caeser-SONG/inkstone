import { useLayoutEffect, useRef, type CSSProperties } from "react";
import type { EditorPreferences } from "../types/story";

const fontFamilies: Record<EditorPreferences["fontFamily"], string> = {
  songti: '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif',
  songtiLight: '"Songti SC Light", "Songti SC", "STSong", "SimSun", serif',
  kaiti: '"Kaiti SC", "STKaiti", "KaiTi", "KaiTi_GB2312", serif',
  fangsong: '"STFangsong", "FangSong", "FangSong_GB2312", serif',
  heiti: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  hiragino: '"Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", sans-serif',
  system: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const paragraphGaps: Record<EditorPreferences["paragraphStyle"], string> = {
  compact: "0.55em",
  body: "1.05em",
  relaxed: "1.65em",
};

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toEditorHtml(text: string) {
  if (!text.trim()) return "";
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n\n");
  return paragraphs
    .map(
      (paragraph) =>
        `<p>${paragraph ? escapeHtml(paragraph).replace(/\n/g, "<br />") : "<br />"}</p>`,
    )
    .join("");
}

function editorText(editor: HTMLElement) {
  return editor.innerText.replace(/\r\n/g, "\n");
}

export function ComfortableEditor({
  activeChapter,
  chapterTitle,
  draft,
  setDraft,
  preferences,
}: {
  activeChapter: number;
  chapterTitle: string;
  draft: string;
  setDraft: (value: string) => void;
  preferences: EditorPreferences;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const displayedChapterRef = useRef<number | null>(null);
  const chapterScrollPositionsRef = useRef(new Map<number, number>());
  const lastTypedDraftRef = useRef(draft);

  const resizeEditor = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.style.minHeight = `${Math.max(300, editor.scrollHeight)}px`;
  };

  useLayoutEffect(() => {
    const editor = editorRef.current;
    const viewport = viewportRef.current;
    if (!editor) return;
    const changedChapter = displayedChapterRef.current !== activeChapter;
    const previousChapter = displayedChapterRef.current;
    if (changedChapter && previousChapter !== null && viewport) {
      chapterScrollPositionsRef.current.set(
        previousChapter,
        viewport.scrollTop,
      );
    }
    const isLocalTyping =
      document.activeElement === editor &&
      !changedChapter &&
      draft === lastTypedDraftRef.current;

    // ContentEditable must stay uncontrolled while the user is typing. Replacing
    // its HTML on each input resets the selection and makes subsequent text land
    // in new blocks (which looked like vertical input).
    if (!isLocalTyping && editorText(editor) !== draft) {
      editor.innerHTML = toEditorHtml(draft);
    }
    displayedChapterRef.current = activeChapter;
    resizeEditor();
    if (changedChapter && viewport) {
      // First opening begins at the top; returning restores the author's last position.
      viewport.scrollTop =
        chapterScrollPositionsRef.current.get(activeChapter) ?? 0;
    }
  }, [activeChapter, draft]);

  const editorStyle = {
    fontFamily: fontFamilies[preferences.fontFamily],
    fontSize: `${preferences.fontSize}px`,
    lineHeight: 1.58,
    "--paragraph-gap": paragraphGaps[preferences.paragraphStyle],
  } as CSSProperties;
  return (
    <div
      className="writing-viewport"
      ref={viewportRef}
      onScroll={(event) =>
        chapterScrollPositionsRef.current.set(
          activeChapter,
          event.currentTarget.scrollTop,
        )
      }
    >
      <article className="paper" aria-label="小说正文编辑器">
        <header className="chapter-heading">
          <span>第一卷 · 回城</span>
          <h1>
            第{activeChapter || "—"}章 {chapterTitle}
          </h1>
          <p>2026年8月8日 · 本章草稿</p>
        </header>
        <div className="editor-shell">
          {!draft.trim() && (
            <span className="editor-placeholder" aria-hidden="true">
              开始写作…
            </span>
          )}
          <div
            ref={editorRef}
            className="text-editor"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="正文内容"
            spellCheck={false}
            style={editorStyle}
            onInput={(event) => {
              const nextDraft = editorText(event.currentTarget);
              lastTypedDraftRef.current = nextDraft;
              setDraft(nextDraft);
              resizeEditor();
            }}
          />
        </div>
        <div className="writing-breathing-room" aria-hidden="true" />
      </article>
    </div>
  );
}
