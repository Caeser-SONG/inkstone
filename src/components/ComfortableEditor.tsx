import { useEffect, useLayoutEffect, useRef } from "react";
import type { EditorPreferences } from "../types/story";

const fontFamilies: Record<EditorPreferences["fontFamily"], string> = {
  songti: '"Songti SC", "STSong", "Noto Serif CJK SC", serif',
  heiti: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  kaiti: '"Kaiti SC", "STKaiti", "KaiTi", serif',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
};

const lineHeights: Record<EditorPreferences["paragraphStyle"], number> = { compact: 1.75, body: 2.05, relaxed: 2.35 };

export function ComfortableEditor({ activeChapter, chapterTitle, draft, setDraft, preferences }: { activeChapter: number; chapterTitle: string; draft: string; setDraft: (value: string) => void; preferences: EditorPreferences }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeEditor = () => {
    const editor = textareaRef.current;
    if (!editor) return;
    editor.style.height = "auto";
    editor.style.height = `${editor.scrollHeight}px`;
  };

  const positionWritingArea = () => {
    const editor = textareaRef.current;
    const viewport = viewportRef.current;
    if (!editor || !viewport) return;
    const cursorLine = editor.offsetTop + editor.scrollHeight;
    viewport.scrollTo({ top: Math.max(0, cursorLine - viewport.clientHeight * 0.55), behavior: "auto" });
  };

  useLayoutEffect(() => {
    resizeEditor();
  }, [draft]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(positionWritingArea);
    return () => window.cancelAnimationFrame(frame);
  }, [activeChapter]);

  const editorStyle = { fontFamily: fontFamilies[preferences.fontFamily], fontSize: `${preferences.fontSize}px`, lineHeight: lineHeights[preferences.paragraphStyle] };
  return <div className="writing-viewport" ref={viewportRef}><article className="paper" aria-label="小说正文编辑器"><header className="chapter-heading"><span>第一卷 · 回城</span><h1>第{activeChapter || "—"}章 {chapterTitle}</h1><p>2026年8月8日 · 本章草稿</p></header><textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} aria-label="正文内容" style={editorStyle} /><div className="writing-breathing-room" aria-hidden="true" /></article></div>;
}
