import { BookOpen } from "@phosphor-icons/react";

type IconType = typeof BookOpen;

export function ToolButton({ icon: Icon, label, active, onClick }: { icon: IconType; label: string; active?: boolean; onClick?: () => void }) {
  return <button className={`tool-button ${active ? "active" : ""}`} title={label} aria-label={label} onClick={onClick}><Icon size={18} weight={active ? "fill" : "regular"} /></button>;
}
