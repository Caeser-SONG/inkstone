import { useMemo, useState } from "react";
import { CheckCircle, DownloadSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { availableSkills, parseSkillManifest } from "../services/skills";
import type { WritingSkill } from "../types/story";

export function SkillManager({ skills, onChange, onClose }: { skills: WritingSkill[]; onChange: (skills: WritingSkill[]) => void; onClose: () => void }) {
  const [manifest, setManifest] = useState("");
  const [message, setMessage] = useState("");
  const allSkills = useMemo(() => availableSkills(skills), [skills]);
  const toggle = (skill: WritingSkill) => {
    const override = { ...skill, enabled: !skill.enabled };
    const next = skill.source === "builtin" ? [...skills.filter((item) => item.id !== skill.id), override] : skills.map((item) => item.id === skill.id ? override : item);
    onChange(next);
  };
  const install = () => {
    try {
      const parsed = parseSkillManifest(manifest);
      const next: WritingSkill = { ...parsed, id: `skill-${Date.now()}`, enabled: true, source: "installed", installedAt: new Date().toISOString() };
      onChange([...skills, next]); setManifest(""); setMessage(`已安装「${next.name}」，并默认启用。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Skill 安装失败。"); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="skill-modal" role="dialog" aria-modal="true" aria-labelledby="skill-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>PI AGENT</span><h2 id="skill-title">写作 Skills</h2><p>每部作品独立启用。启用的 Skill 会成为 Agent 的可执行写作规则。</p></div><button onClick={onClose} aria-label="关闭 Skill 管理"><X size={19} /></button></header><div className="skill-body"><div className="skill-list">{allSkills.map((skill) => <article key={skill.id} className="skill-card"><div><b>{skill.name}</b><small>{skill.source === "builtin" ? "内置" : "已安装"}</small><p>{skill.description}</p></div><div className="skill-actions"><button className={`switch ${skill.enabled ? "enabled" : ""}`} onClick={() => toggle(skill)} aria-label={`${skill.enabled ? "停用" : "启用"}${skill.name}`}><i /></button>{skill.source === "installed" && <button className="remove-skill" onClick={() => onChange(skills.filter((item) => item.id !== skill.id))} aria-label={`移除${skill.name}`}><Trash size={15} /></button>}</div></article>)}</div><div className="skill-import"><div><DownloadSimple size={18} weight="bold" /><div><b>安装自定义 Skill</b><p>粘贴 JSON 清单后保存到当前作品。</p></div></div><textarea value={manifest} onChange={(event) => setManifest(event.target.value)} placeholder={'{\n  "name": "场景调度",\n  "description": "让场景更有动作感",\n  "instructions": "..."\n}'} aria-label="Skill JSON 清单" /><button className="secondary-action" onClick={install}><Plus size={15} weight="bold" />安装 Skill</button>{message && <span className="skill-message"><CheckCircle size={15} weight="fill" />{message}</span>}</div></div></section></div>;
}
