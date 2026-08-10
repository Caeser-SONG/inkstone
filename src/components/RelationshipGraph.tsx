import { Graph } from "@phosphor-icons/react";
import type { StoryAnalysis } from "../types/story";

export function RelationshipGraph({ analysis }: { analysis: StoryAnalysis | null }) {
  const people = analysis?.characters.slice(0, 4) || [];
  return <div className="graph-wrap"><div className="graph-note"><Graph size={17} weight="fill" />{analysis ? "根据已保存章节更新" : "保存章节后自动生成"}</div><div className="graph-canvas">{people.length ? <><div className="edge edge-a" /><div className="edge edge-b" /><div className="edge edge-c" />{people.map((person, index) => <div className={`graph-node graph-node-${index}`} key={person.name}>{person.name}<span>{person.role}</span></div>)}</> : <div className="empty-graph-state">保存正文后，故事 Agent 会在这里绘制人物关系。</div>}</div><div className="graph-legend">{analysis?.relations.slice(0, 2).map((relation) => <span key={`${relation.from}-${relation.to}`}><i className="relation-line" />{relation.from} · {relation.label} · {relation.to}</span>)}</div></div>;
}
