/**
 * 병합 정렬의 분할 트리와 단계 기록. 단계 진행(MergeSortTree)과 본문 정적 그림(MergeSortMerge)이
 * 같은 trace를 쓰므로, 본문 그림은 단계 진행의 한 장면과 정확히 같다.
 *
 * 트리의 노드 하나는 sortArray 호출 하나다. 노드의 칸에는 호출이 받은 값(input)과, 합친 뒤 돌려주는
 * 값(sorted)을 둘 다 미리 적어 두고 상태에 따라 한쪽만 보인다.
 */

export interface MsNode {
  id: number;
  depth: number;
  parent: number | null;
  children: number[];
  input: number[];
  sorted: number[];
  /** 이 노드의 첫 칸이 전체 칸 목록에서 몇 번째인지 */
  offset: number;
}

export interface MsStep {
  note: string;
  /** 칸마다 상태 코드 한 글자 (CELL_STATES 참고) */
  cells: string;
  /** 부모 → 자식 간선마다 상태 코드 (자식 노드 순서, 루트 제외) */
  edges: string;
  kind: 'start' | 'split' | 'merge' | 'end';
  node: number;
  mid: number | null;
  i: number | null;
  j: number | null;
  ret: number[] | null;
  /** 이 단계에서 호출 하나가 끝났는가 (다음 동작 안내를 붙이는 데 쓴다) */
  complete?: boolean;
}

/**
 * 칸 상태 코드
 * i 아직 나누지 않음(받은 값을 흐리게) / c 나눠 두고 기다림 / a 지금 나누는 배열
 * b 합칠 자리(빈칸) / p 이번 합치기에서 앞서 채운 칸 / n 방금 채운 칸
 * h 비교하는 맨 앞 칸 / t 이미 옮긴 칸 / d 정렬을 마친 배열 / w 최종 결과
 */
export const CELL_STATES: Record<string, string> = {
  i: 'idle',
  c: 'called',
  a: 'split',
  b: 'blank',
  p: 'placed',
  n: 'new',
  h: 'head',
  t: 'taken',
  d: 'done',
  w: 'answer',
};

export const EDGE_STATES: Record<string, string> = { i: 'idle', c: 'called', d: 'done' };

// 풀이 코드와 같은 합치기. 같으면 왼쪽을 먼저 옮긴다.
function merge(left: number[], right: number[]) {
  const result: number[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) result.push(left[i++]);
    else result.push(right[j++]);
  }
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);
  return result;
}

export function buildTree(nums: number[]) {
  const nodes: MsNode[] = [];
  let offset = 0;
  const make = (input: number[], depth: number, parent: number | null): number => {
    const id = nodes.length;
    const node: MsNode = { id, depth, parent, children: [], input, sorted: input, offset };
    offset += input.length;
    nodes.push(node);
    if (input.length > 1) {
      const mid = Math.floor(input.length / 2);
      node.children.push(make(input.slice(0, mid), depth + 1, id), make(input.slice(mid), depth + 1, id));
      node.sorted = merge(nodes[node.children[0]].sorted, nodes[node.children[1]].sorted);
    }
    return id;
  };
  make(nums, 0, null);
  return nodes;
}

// ── 한 줄 설명의 조사. 배열은 마지막 수를 읽는 소리로 고른다 (explaining.md 9절)
const last = (x: number | number[]) => (Array.isArray(x) ? x.at(-1)! : x);
const noBatchim = (x: number | number[]) => '2459'.includes(String(last(x)).at(-1)!);
const eul = (x: number | number[]) => (noBatchim(x) ? '를' : '을');
const gwa = (x: number | number[]) => (noBatchim(x) ? '와' : '과');
const eun = (x: number | number[]) => (noBatchim(x) ? '는' : '은');
const iga = (x: number | number[]) => (noBatchim(x) ? '가' : '이');
const ro = (x: number | number[]) => ('1245789'.includes(String(last(x)).at(-1)!) ? '로' : '으로');
export const arr = (xs: number[]) => `[${xs.join(', ')}]`;

export function trace(nums: number[]) {
  const nodes = buildTree(nums);
  const total = nodes.reduce((sum, n) => sum + n.input.length, 0);
  const status = nodes.map(() => 'idle' as 'idle' | 'called' | 'done');
  const steps: MsStep[] = [];

  interface Scene {
    active?: number;
    splitting?: boolean;
    placed?: number;
    fresh?: number[];
    heads?: number[];
    taken?: Set<number>;
    final?: boolean;
  }

  const snap = (note: string, scene: Scene, rest: Omit<MsStep, 'note' | 'cells' | 'edges'>) => {
    const { active, splitting, placed = 0, fresh = [], heads = [], taken = new Set<number>(), final } = scene;
    let cells = '';
    for (const node of nodes) {
      node.input.forEach((_, k) => {
        const idx = node.offset + k;
        if (final) cells += node.id === 0 ? 'w' : 'd';
        else if (node.id === active) cells += splitting ? 'a' : fresh.includes(k) ? 'n' : k < placed ? 'p' : 'b';
        else if (heads.includes(idx)) cells += 'h';
        else if (taken.has(idx)) cells += 't';
        else cells += status[node.id] === 'done' ? 'd' : status[node.id] === 'called' ? 'c' : 'i';
      });
    }
    const edges = nodes
      .slice(1)
      .map((node) => (status[node.id] === 'done' ? 'd' : status[node.id] === 'called' || node.id === active ? 'c' : 'i'))
      .join('');
    steps.push({ note, cells, edges, ...rest });
  };

  snap(`${arr(nums)}${eul(nums)} 정렬합니다. 한 칸이 될 때까지 반씩 나눈 뒤, 거꾸로 합치며 올라옵니다. "다음"을 눌러 보세요`, {}, {
    kind: 'start',
    node: 0,
    mid: null,
    i: null,
    j: null,
    ret: null,
  });

  const sort = (id: number): number[] => {
    const node = nodes[id];
    if (node.children.length === 0) {
      status[id] = 'done';
      return node.input;
    }
    const [L, R] = node.children.map((c) => nodes[c]);
    const leaves = [L, R].filter((c) => c.children.length === 0);

    // ① 나누기. 두 절반이 나눠져 기다리는 배열이 되고, 한 칸짜리 절반은 호출되자마자 그대로
    // 돌아오므로 같은 단계에서 끝난 것으로 보인다.
    status[id] = 'called';
    [L, R].forEach((c) => (status[c.id] = c.children.length === 0 ? 'done' : 'called'));
    let note = `${arr(node.input)}${eul(node.input)} ${arr(L.input)}${gwa(L.input)} ${arr(R.input)}${ro(R.input)} 나눕니다.`;
    if (leaves.length === 2) note += ' 둘 다 한 칸이라 이미 정렬된 상태이니, 바로 합칩니다';
    else if (leaves.length === 1) note += ` ${arr(leaves[0].input)}${eun(leaves[0].input)} 한 칸이라 이미 정렬된 상태입니다. 이어서 ${arr(R.input)}${eul(R.input)} 나눕니다`;
    else note += ` 왼쪽 ${arr(L.input)}부터 정렬합니다`;
    snap(note, { active: id, splitting: true }, { kind: 'split', node: id, mid: L.input.length, i: null, j: null, ret: null });

    const left = sort(L.id);
    const right = sort(R.id);

    // ② 합치기. 비교 한 번 = 한 단계. 한쪽이 먼저 비면 남은 칸을 옮기는 일은 그 단계에 합친다.
    const result: number[] = [];
    const taken = new Set<number>();
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
      const hi = L.offset + i;
      const hj = R.offset + j;
      const takeLeft = left[i] <= right[j];
      const [ci, cj] = [i, j];
      const value = takeLeft ? left[i++] : right[j++];
      result.push(value);
      const fresh = [result.length - 1];
      const heads = [hi, hj];
      let note =
        left[ci] === right[cj]
          ? `맨 앞의 ${left[ci]}${gwa(left[ci])} ${right[cj]}${iga(right[cj])} 같아서 왼쪽 ${value}${eul(value)} 먼저 옮깁니다`
          : `맨 앞의 ${left[ci]}${gwa(left[ci])} ${right[cj]}${eul(right[cj])} 비교해, 더 작은 ${value}${eul(value)} 옮깁니다`;
      let complete = false;
      if (i === left.length || j === right.length) {
        const leftSide = i < left.length;
        const restFrom = leftSide ? i : j;
        const rest = (leftSide ? left : right).slice(restFrom);
        const restNode = leftSide ? L : R;
        rest.forEach((v, k) => {
          result.push(v);
          fresh.push(result.length - 1);
          heads.push(restNode.offset + restFrom + k);
        });
        note += `. ${leftSide ? '오른쪽' : '왼쪽'}이 비었으니 남은 ${rest.join(', ')}${eul(rest)} 그대로 붙여 ${arr(result)}${eul(result)} 돌려줍니다`;
        complete = true;
      }
      snap(note, { active: id, placed: result.length, fresh, heads, taken: new Set(taken) }, {
        kind: 'merge',
        node: id,
        mid: null,
        // 옮긴 뒤의 i·j (남은 칸까지 붙였다면 배열 끝)
        i: complete ? left.length : i,
        j: complete ? right.length : j,
        ret: complete ? [...result] : null,
        complete,
      });
      taken.add(takeLeft ? hi : hj);
      if (complete) heads.slice(2).forEach((idx) => taken.add(idx));
    }

    if (JSON.stringify(result) !== JSON.stringify(node.sorted)) {
      throw new Error('merge-sort-trace: 단계 기록의 합치기 결과가 분할 트리에 미리 적은 값과 다릅니다.');
    }
    status[id] = 'done';
    return result;
  };

  const sorted = sort(0);

  // 끝 장면: 강조를 걷고 맨 위 배열을 최종 결과로 칠한다.
  snap(`맨 위 배열이 ${arr(sorted)}${ro(sorted)} 정렬됐습니다`, { final: true }, {
    kind: 'end',
    node: 0,
    mid: null,
    i: null,
    j: null,
    ret: sorted,
  });

  // 호출 하나가 끝난 단계에는 구체적인 다음 동작을 붙인다.
  steps.forEach((step, index) => {
    const next = steps[index + 1];
    if (!step.complete || next.kind === 'end') return;
    const n = nodes[next.node];
    if (next.kind === 'split') step.note += `. 이제 ${arr(n.input)}${eul(n.input)} 나눕니다`;
    else {
      const [a, b] = n.children.map((c) => nodes[c].sorted);
      step.note += `. 이제 ${arr(a)}${gwa(a)} ${arr(b)}${eul(b)} 합칩니다`;
    }
  });

  if (steps.some((s) => s.cells.length !== total)) throw new Error('merge-sort-trace: 칸 수가 맞지 않습니다.');
  return { nodes, steps, sorted };
}
