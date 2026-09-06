import { useState } from "react";
import { BookBookmark, CheckCircle, X } from "@phosphor-icons/react";
import type { CreativeCharter } from "../types/story";

type Props = {
  charter: CreativeCharter;
  onClose: () => void;
  onSaved: (charter: CreativeCharter) => void;
};

const fields: Array<{ key: Exclude<keyof CreativeCharter, "updatedAt">; label: string; hint: string; placeholder: string }> = [
  { key: "perspective", label: "叙述视角与语言", hint: "让续写知道由谁看见、怎样表达", placeholder: "例如：第三人称限知；克制、具象，不解释角色未意识到的事。" },
  { key: "tone", label: "文风与情绪", hint: "让编辑建议不偏离作品气质", placeholder: "例如：悬疑底色，情绪收着写；避免网络热梗和过度抒情。" },
  { key: "audience", label: "目标读者", hint: "帮助读者 Agent 判断信息密度与期待", placeholder: "例如：喜欢都市悬疑和人物关系伏笔的成年读者。" },
  { key: "pacing", label: "章节节奏与章末", hint: "约束推进速度与钩子的强度", placeholder: "例如：每章推进一项信息；章末留一个可验证的新疑问，不强行反转。" },
  { key: "boundaries", label: "角色底线与设定边界", hint: "用于检查动机和行为是否失真", placeholder: "例如：沈砚不会主动伤害无辜者；林见山不能无缘无故泄露父亲去向。" },
  { key: "prohibitions", label: "禁区与禁用表达", hint: "明确哪些内容与表达不能出现", placeholder: "例如：不使用校园感网络语；不以巧合解决核心冲突。" },
];

export function CreativeCharterModal({ charter, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState(charter);
  const [saved, setSaved] = useState(false);
  const update = (key: Exclude<keyof CreativeCharter, "updatedAt">, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const save = () => {
    onSaved({ ...draft, updatedAt: new Date().toISOString() });
    setSaved(true);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="charter-modal" role="dialog" aria-modal="true" aria-labelledby="charter-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span><BookBookmark size={15} weight="fill" />作品级 Agent 规则</span><h2 id="charter-title">创作宪章</h2><p>保存后，续写、写作搭档、圆桌工作组与故事检查都会参考这些规则；它们不会被当作已发生的剧情事实。</p></div>
        <button onClick={onClose} aria-label="关闭创作宪章"><X size={19} /></button>
      </header>
      <div className="charter-body">
        <div className="charter-intro"><b>作者是最终裁决者</b><span>宪章只约束 Agent 的建议与生成，不会自动改写正文、故事记忆或已采纳的创作决定。</span></div>
        <div className="charter-fields">{fields.map((field) => <label key={field.key}><span><b>{field.label}</b><small>{field.hint}</small></span><textarea value={draft[field.key]} onChange={(event) => update(field.key, event.target.value)} placeholder={field.placeholder} /></label>)}</div>
      </div>
      <footer>{saved && <span className="charter-saved"><CheckCircle size={16} weight="fill" />已保存到本地作品库</span>}<button className="secondary-action" onClick={onClose}>关闭</button><button className="primary-action" onClick={save}>保存创作宪章</button></footer>
    </section>
  </div>;
}
