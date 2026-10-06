import { groupTitlesInOrder } from "../rules/match";
import type { Rule, RuleTitles } from "../rules/types";
import { NO_TITLES } from "../rules/types";
import { TAB_GROUP_ID_NONE } from "./plan";
import type { GroupOperation, WindowSnapshot } from "./types";

/** タブバー上の並びの単位。グループは中のタブをまとめて1つ、グループに入っていないタブは1つずつ */
interface Block {
  /** グループなら ID、グループに入っていないタブなら null */
  groupId: number | null;
  size: number;
}

// ピン留めされていないタブを、左から順に並びの単位へまとめる
function toBlocks(window: WindowSnapshot): Block[] {
  const blocks: Block[] = [];
  for (const tab of window.tabs.filter((candidate) => !candidate.pinned)) {
    const last = blocks.at(-1);
    if (tab.groupId !== TAB_GROUP_ID_NONE && last?.groupId === tab.groupId) {
      last.size += 1;
    } else {
      blocks.push({ groupId: tab.groupId === TAB_GROUP_ID_NONE ? null : tab.groupId, size: 1 });
    }
  }
  return blocks;
}

/**
 * 管理対象のグループと無効なルールが持ち続けるタイトル（titles）のグループを、ピン留めされたタブの直後からルールの順に並べる移動の計画を組み立てる。
 *
 * @param window - 並べ替える対象のウィンドウのスナップショット
 * @param rules - 並べる順のもとになるルールの一覧
 * @param titles - ルールの ID から、そのルールが持っているグループのタイトルへのマップ
 * @returns 並べ替えの移動操作の一覧
 * @remarks 同名のグループが複数あるときは、今の左右の順のまま続けて並べる。管理対象でないタブ・グループは動かさず、管理対象のグループの後ろへ元の相対的な順のまま押し出される。すでに正しい位置にあるグループには操作を出さない
 */
export function planGroupOrder(
  window: WindowSnapshot,
  rules: readonly Rule[],
  titles: RuleTitles = NO_TITLES,
): GroupOperation[] {
  const rankByName = new Map(groupTitlesInOrder(rules, titles).map((title, rank) => [title, rank]));
  const groupsById = new Map(window.groups.map((group) => [group.id, group]));
  const blocks = toBlocks(window);

  // 管理対象のグループをルールの順に。同じルールのグループは今の並びの順を保つ（toSorted は安定）
  const managed = blocks
    .flatMap((block) => {
      const title = block.groupId === null ? undefined : groupsById.get(block.groupId)?.title;
      const rank = title === undefined ? undefined : rankByName.get(title);
      return block.groupId === null || rank === undefined ? [] : [{ block, groupId: block.groupId, rank }];
    })
    .toSorted((a, b) => a.rank - b.rank);

  // 左から順に正しい位置へ移したときの並びを追いながら、位置が違うグループだけを移動する。
  // position より左は並べ終えたグループだけのため、移動は常に今より左（または同じ位置）への移動になる
  const operations: GroupOperation[] = [];
  let index = window.tabs.filter((tab) => tab.pinned).length;
  for (const [position, { block, groupId }] of managed.entries()) {
    if (blocks[position] !== block) {
      blocks.splice(blocks.indexOf(block), 1);
      blocks.splice(position, 0, block);
      operations.push({ type: "move-group", groupId, index });
    }
    index += block.size;
  }
  return operations;
}
