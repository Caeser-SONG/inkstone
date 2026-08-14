import { ClockCounterClockwise, Pause, Play, Stop } from "@phosphor-icons/react";
import type { ActiveWritingSession } from "../types/story";

type WritingSessionSummaryProps = {
  session: ActiveWritingSession | null;
  wordCount: number;
  elapsedSeconds: number;
  onToggle: () => void;
  onEnd: () => void;
  onOpenHistory: () => void;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function WritingSessionSummary({ session, wordCount, elapsedSeconds, onToggle, onEnd, onOpenHistory }: WritingSessionSummaryProps) {
  const netWords = session ? wordCount - session.startWordCount : 0;
  const speed = elapsedSeconds > 0 ? Math.max(0, Math.round(netWords / (elapsedSeconds / 60))) : 0;
  const isRunning = session?.status === "running";

  return <div className="topbar-writing-session" aria-live="polite">
    <div className="topbar-session-stat"><span>本次</span><strong>{session ? `${netWords >= 0 ? "+" : ""}${netWords.toLocaleString()} 字` : "尚未开始"}</strong></div>
    <div className="topbar-session-stat"><span>速度</span><strong>{session ? `${speed.toLocaleString()} 字/分` : "—"}</strong></div>
    <div className="topbar-session-stat topbar-session-duration"><span>时长</span><strong>{session ? formatDuration(elapsedSeconds) : "00:00:00"}</strong></div>
    <button className={`topbar-session-toggle ${isRunning ? "running" : ""}`} onClick={onToggle}>
      {isRunning ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
      {isRunning ? "暂停" : session ? "继续" : "开始码字"}
    </button>
    {session && <button className="topbar-session-stop" onClick={onEnd} aria-label="结束并记录本次码字" title="结束并记录"><Stop size={14} weight="fill" /></button>}
    <button className="topbar-session-history" onClick={onOpenHistory} aria-label="查看码字记录" title="码字记录"><ClockCounterClockwise size={15} /></button>
  </div>;
}
