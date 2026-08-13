import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import type { EditorPreferences } from "../types/story";

const fontFamilies: Record<EditorPreferences["fontFamily"], string> = {
  songti: '"Songti SC", "STSong", "Noto Serif CJK SC", serif',
  heiti: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  kaiti: '"Kaiti SC", "STKaiti", "KaiTi", serif',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
};

const paragraphGaps: Record<EditorPreferences["paragraphStyle"], string> = { compact: "0.55em", body: "1.05em", relaxed: "1.65em" };

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function toEditorHtml(text: string) {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n\n");
  return paragraphs.map((paragraph) => `<p>${paragraph ? escapeHtml(paragraph).replace(/\n/g, "<br />") : "<br />"}</p>`).join("");
}

export function ComfortableEditor({ activeChapter, chapterTitle, draft, setDraft, preferences }: { activeChapter: number; chapterTitle: string; draft: string; setDraft: (value: string) => void; preferences: EditorPreferences }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const resizeEditor = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.style.minHeight = `${Math.max(300, editor.scrollHeight)}px`;
  };

  const positionWritingArea = () => {
    const editor = editorRef.current;
    const viewport = viewportRef.current;
    if (!editor || !viewport) return;
    const cursorLine = editor.offsetTop + editor.scrollHeight;
    viewport.scrollTo({ top: Math.max(0, cursorLine - viewport.clientHeight * 0.55), behavior: "auto" });
  };

  useLayoutEffect(() => {
    resizeEditor();
  }, [draft]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.innerText.replace(/\r\n/g, "\n").trimEnd() === draft.trimEnd()) return;
    editor.innerHTML = toEditorHtml(draft);
    resizeEditor();
  }, [draft]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(positionWritingArea);
    return () => window.cancelAnimationFrame(frame);
  }, [activeChapter]);

  const editorStyle = { fontFamily: fontFamilies[preferences.fontFamily], fontSize: `${preferences.fontSize}px`, lineHeight: 1.58, "--paragraph-gap": paragraphGaps[preferences.paragraphStyle] } as CSSProperties;
  return <div className="writing-viewport" ref={viewportRef}><article className="paper" aria-label="小说正文编辑器"><header className="chapter-heading"><span>第一卷 · 回城</span><h1>第{activeChapter || "—"}章 {chapterTitle}</h1><p>2026年8月8日 · 本章草稿</p></header><div ref={editorRef} className="text-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="正文内容" spellCheck={false} style={editorStyle} onInput={(event) => { setDraft(event.currentTarget.innerText.replace(/\r\n/g, "\n").trimEnd()); resizeEditor(); }} dangerouslySetInnerHTML={{ __html: toEditorHtml(draft) }} /><div className="writing-breathing-room" aria-hidden="true" /></article></div>;
}
