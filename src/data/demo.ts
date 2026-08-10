import type { Chapter } from "../types/story";

export const initialDraft = `雨落在旧城的青瓦上，像有人从很远的地方轻轻叩门。

沈砚推开“归舟书局”的门时，风铃没有响。他抬头看见柜台后的林见山，正把一封没有署名的信放进抽屉。那封信的火漆印是褪色的赭红，和三年前父亲失踪那夜留在书桌上的一模一样。

“你不该回来。”林见山说。

沈砚没有回答。他的手指停在湿透的袖口上，那里藏着半枚铜钱。另一半，在林见山颈间的旧银链上。

窗外的雨忽然大了起来。`;

export const chapters: Chapter[] = [
  { id: 1, title: "雨夜归舟", words: "3,286", status: "writing" },
  { id: 2, title: "旧信与铜钱", words: "2,941", status: "ready" },
  { id: 3, title: "南渡口", words: "草稿", status: "draft" },
];
