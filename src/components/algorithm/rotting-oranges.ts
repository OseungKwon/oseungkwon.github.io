/**
 * BFS — 썩은 귤(LeetCode 994)의 계산 모음. 단계 진행(RottingOrangesSpread)과 본문 정적 그림
 * (RottingOrangesMinutes)이 같은 계산을 쓴다.
 *
 * 격자 값: 0 빈 칸 / 1 싱싱한 귤 / 2 썩은 귤. 이웃을 보는 순서는 풀이 코드와 같은 아래·위·오른쪽·왼쪽이다.
 */

export type Grid = number[][];

export const MOVES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const DIRECTION = ['아래', '위', '오른쪽', '왼쪽'];

export const pos = (i: number, cols: number) => `(${Math.floor(i / cols)}, ${i % cols})`;

// ── 조사. 좌표 "(r, c)"는 읽을 때 숫자 c로 끝난다 (writing/explaining.md 9절)
const noBatchim = (n: number) => '2459'.includes(String(n).at(-1)!);
const obj = (n: number) => (noBatchim(n) ? '를' : '을');
const top = (n: number) => (noBatchim(n) ? '는' : '은');
const subj = (n: number) => (noBatchim(n) ? '가' : '이');

/** 본문에 싣는 참고 풀이와 같은 코드. 빌드 시점에 예제 출력을 확인하는 데 쓴다. */
export function orangesRotting(input: Grid): number {
  const grid = input.map((row) => [...row]);
  const rows = grid.length;
  const cols = grid[0].length;
  let queue: [number, number][] = [];
  let fresh = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 2) queue.push([r, c]);
      else if (grid[r][c] === 1) fresh++;
    }
  }
  let minutes = 0;
  while (queue.length > 0 && fresh > 0) {
    minutes++;
    const next: [number, number][] = [];
    for (const [r, c] of queue) {
      for (const [dr, dc] of MOVES) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (grid[nr][nc] !== 1) continue;
        grid[nr][nc] = 2;
        fresh--;
        next.push([nr, nc]);
      }
    }
    queue = next;
  }
  return fresh === 0 ? minutes : -1;
}

/** 칸마다 썩는 시각(분)과 그 칸을 썩게 한 칸. 닿지 못하는 칸은 null. */
export function bfsMinutes(grid: Grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const minute: (number | null)[] = Array(rows * cols).fill(null);
  const edges: [number, number][] = [];
  let queue: number[] = [];
  grid.flat().forEach((v, i) => {
    if (v === 2) {
      minute[i] = 0;
      queue.push(i);
    }
  });
  for (let m = 1; queue.length > 0; m++) {
    const next: number[] = [];
    for (const i of queue) {
      for (const [dr, dc] of MOVES) {
        const r = Math.floor(i / cols) + dr;
        const c = (i % cols) + dc;
        const j = r * cols + c;
        if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] !== 1 || minute[j] !== null) continue;
        minute[j] = m;
        edges.push([i, j]);
        next.push(j);
      }
    }
    queue = next;
  }
  return { minute, edges };
}

/** 첫 썩은 귤에서 DFS로 들어간 깊이. 본문의 BFS와 비교하는 그림에 쓴다. */
export function dfsDepth(grid: Grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const depth: (number | null)[] = Array(rows * cols).fill(null);
  const edges: [number, number][] = [];
  const start = grid.flat().indexOf(2);
  const go = (i: number, d: number) => {
    depth[i] = d;
    for (const [dr, dc] of MOVES) {
      const r = Math.floor(i / cols) + dr;
      const c = (i % cols) + dc;
      const j = r * cols + c;
      if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] === 0 || depth[j] !== null) continue;
      edges.push([i, j]);
      go(j, d + 1);
    }
  };
  go(start, 0);
  return { depth, edges };
}

// ── 단계 진행 trace
// 칸: e 빈 칸 / f 싱싱한 귤 / q 이번 분의 큐 / n 다음 큐(next) / a 지금 퍼뜨리는 칸 / d 퍼뜨리기를 마친 칸
//     w 마지막으로 썩은 칸(답) / x 잘못 들어간 칸
// 값: 칸마다 격자 값 0·1·2
// 화살표: h 숨김 / s 이번 분에 퍼짐 / d 지난 분 / x 잘못 넣음
export interface Step {
  note: string;
  cells: string;
  values: string;
  edges: string;
  minutes: number;
  fresh: number;
  queue: string[];
  next: string[];
  /** queue의 맨 앞이 지금 퍼뜨리는 칸인가 */
  head?: boolean;
  minutesChanged?: boolean;
  freshChanged?: boolean;
  nextAdded?: boolean;
  wrong?: boolean;
  result?: number;
}

/**
 * markOnPush = true: 풀이 코드 그대로, 큐(next)에 넣는 순간 2로 표시한다.
 * markOnPush = false: 꺼낼 때 표시한다. 아직 1로 남은 칸을 다른 칸이 한 번 더 넣어 fresh가 두 번 줄어든다.
 */
export function trace(grid: Grid, markOnPush: boolean, edgeList: [number, number][]): Step[] {
  const rows = grid.length;
  const cols = grid[0].length;
  const at = (r: number, c: number) => r * cols + c;
  const P = (i: number) => pos(i, cols);
  const col = (i: number) => i % cols;
  const value = grid.flat();
  const steps: Step[] = [];
  const edgeState = new Map<number, string>();
  const edgeIndex = (a: number, b: number) => {
    let k = edgeList.findIndex(([x, y]) => x === a && y === b);
    if (k < 0) {
      edgeList.push([a, b]);
      k = edgeList.length - 1;
    }
    return k;
  };

  let queue: number[] = [];
  let fresh = 0;
  value.forEach((v, i) => {
    if (v === 2) queue.push(i);
    else if (v === 1) fresh++;
  });
  let next: number[] = [];
  let minutes = 0;
  let cursor = -1; // queue에서 지금 퍼뜨리는 칸의 위치
  const processed = new Set<number>(); // 퍼뜨리기를 마친 칸

  const snap = (
    note: string,
    extra: { active?: number; wrongCells?: number[]; answer?: number[] } & Partial<Step> = {},
  ) => {
    const { active, wrongCells = [], answer = [], ...rest } = extra;
    const remaining = cursor >= 0 ? queue.slice(cursor) : queue;
    const cells = value
      .map((v, i) => {
        if (wrongCells.includes(i)) return 'x';
        if (i === active) return 'a';
        if (answer.includes(i)) return 'w';
        if (next.includes(i)) return 'n';
        if (remaining.includes(i)) return 'q';
        if (processed.has(i)) return 'd';
        if (grid[Math.floor(i / cols)][col(i)] === 0) return 'e';
        return v === 2 ? 'd' : 'f';
      })
      .join('');
    steps.push({
      note,
      cells,
      values: value.join(''),
      edges: edgeList.map((_, k) => edgeState.get(k) ?? 'h').join(''),
      minutes,
      fresh,
      queue: remaining.map(P),
      next: next.map(P),
      head: cursor >= 0,
      ...rest,
    });
  };

  snap(
    `처음부터 썩어 있는 ${queue.map(P).join(', ')}${obj(col(queue.at(-1)!))} 큐에 넣고, 싱싱한 귤 ${fresh}개를 세며 시작합니다. "다음"을 눌러 보세요`,
  );

  let firstInLayer = true;
  let explainedLate = false; // next에 넣는 이유(와 '꺼낼 때 표시'의 값)는 첫 번째 넣기에서 한 번만 적는다
  while (queue.length > 0 && fresh > 0) {
    minutes++;
    next = [];
    firstInLayer = true;
    for (cursor = 0; cursor < queue.length; cursor++) {
      const i = queue[cursor];
      const r = Math.floor(i / cols);
      const c = col(i);
      const again = queue.slice(0, cursor).includes(i); // 두 번 들어간 칸을 한 번 더 꺼냈다
      let markedNow = false;
      if (!markOnPush && value[i] === 1) {
        value[i] = 2; // 꺼낼 때 표시
        markedNow = true;
      }
      // 이 칸의 첫 사건 문장 앞머리: 몇 분째인지, 꺼내며 표시했는지
      const opening = () => {
        const lead = firstInLayer ? `${minutes}분째입니다. ` : '';
        if (again) return `${lead}두 번 들어간 ${P(i)}${obj(c)} 한 번 더 꺼냅니다. `;
        if (markedNow) return `${lead}${P(i)}${obj(c)} 꺼내며 2로 표시합니다. `;
        return lead;
      };
      let spread = false;
      const passed: [number, number][] = []; // 이번 분에 이미 썩은 이웃 [칸, 방향]
      for (let d = 0; d < MOVES.length; d++) {
        const nr = r + MOVES[d][0];
        const nc = c + MOVES[d][1];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const j = at(nr, nc);
        if (value[j] !== 1) {
          if (next.includes(j)) passed.push([j, d]);
          continue;
        }
        const duplicate = next.includes(j) || queue.slice(cursor + 1).includes(j);
        if (markOnPush) value[j] = 2;
        fresh--;
        next.push(j);
        const k = edgeIndex(i, j);
        edgeState.set(k, duplicate ? 'x' : 's');
        // 문장 앞머리: 같은 칸의 두 번째 사건이면 "이어서", 꺼내며 표시했으면 그 사실, 아니면 "(r, c)에서"
        const head = opening();
        const from = spread ? '이어서 ' : head !== '' && head !== `${minutes}분째입니다. ` ? head : `${head}${P(i)}에서 `;
        // 이번 분에 다른 칸이 먼저 썩힌 이웃은 건너뛴다는 것을 같은 문장에 적는다
        const skip = passed.length
          ? `${passed.map(([p, pd]) => `${DIRECTION[pd]} ${P(p)}`).join(', ')}${top(col(passed.at(-1)![0]))} 이미 썩어 건너뛰고, `
          : '';
        // 같은 칸이 연달아 썩힐 때는 '도'로 잇는다
        const target = `${DIRECTION[d]} ${P(j)}${spread ? '도' : obj(nc)}`;
        let note: string;
        if (duplicate && again) {
          note = `${from}${DIRECTION[d]} ${P(j)}${top(nc)} 아직 1이라 또 넣고, fresh가 ${fresh}${subj(Math.abs(fresh))} 됩니다`;
        } else if (duplicate) {
          note = `${from}${DIRECTION[d]} ${P(j)}${obj(nc)} 보니 아직 1로 남아 있습니다. next에 한 번 더 넣고, fresh도 또 줄어듭니다`;
        } else if (markOnPush && !explainedLate) {
          note = `${from}${skip}${target} 썩게 합니다. ${minutes}분에 썩은 귤이라 next에 넣어 두고, 다음 1분에 퍼뜨립니다`;
          explainedLate = true;
        } else if (markOnPush) {
          note = `${from}${skip}${target} 썩게 해 next에 넣습니다`;
        } else if (!explainedLate) {
          note = `${from}${skip}${target} next에 넣습니다. 2로 표시하는 건 꺼낼 때라 값은 아직 1입니다`;
          explainedLate = true;
        } else {
          note = `${from}${skip}${target} next에 넣습니다`;
        }
        spread = true;
        snap(note, {
          active: i,
          wrongCells: duplicate ? [j] : [],
          minutesChanged: firstInLayer,
          freshChanged: true,
          nextAdded: true,
          wrong: duplicate,
        });
        firstInLayer = false;
        passed.length = 0;
      }
      if (!spread) {
        const head = opening();
        const who = head !== '' && head !== `${minutes}분째입니다. ` ? head : `${head}${P(i)}의 `;
        snap(`${who}이웃에는 싱싱한 귤이 없어, 아무것도 넣지 않고 넘어갑니다`, {
          active: i,
          minutesChanged: firstInLayer,
        });
        firstInLayer = false;
      }
      processed.add(i);
    }
    // 한 분이 끝났다. 이번 분에 썩은 칸들이 다음 분의 큐가 된다
    const doneLayer = next;
    for (const [k, s] of edgeState) if (s === 's') edgeState.set(k, 'd');
    queue = next;
    next = [];
    cursor = -1;
    if (queue.length > 0 && fresh > 0) {
      const dup = doneLayer.find((p, k) => doneLayer.indexOf(p) !== k);
      snap(
        markOnPush
          ? `${minutes}분이 끝났습니다. 이번에 썩은 ${doneLayer.map(P).join(', ')}${subj(col(doneLayer.at(-1)!))} 새 큐가 되어 ${minutes + 1}분째에 퍼뜨립니다`
          : `${minutes}분이 끝났습니다. next에 모인 ${doneLayer.map(P).join(', ')}${subj(col(doneLayer.at(-1)!))} 새 큐가 됩니다${dup !== undefined ? `. ${P(dup)}${subj(col(dup))} 두 번 들어 있습니다` : ''}`,
      );
    }
  }

  // 끝 장면
  cursor = -1;
  const result = fresh === 0 ? minutes : -1;
  if (markOnPush) {
    const last = queue; // 마지막 분에 썩은 칸
    queue = [];
    snap(`싱싱한 귤이 0개가 되어 반복을 멈춥니다. 마지막 귤이 ${minutes}분에 썩었으니 ${minutes}${obj(minutes)} 돌려줍니다`, {
      answer: last,
      result,
    });
  } else {
    const left = value.map((v, i) => (v === 1 && !queue.includes(i) ? i : -1)).filter((i) => i >= 0);
    snap(
      `fresh가 ${fresh}로 0을 지나쳐 반복이 멈춥니다. ${left.map(P).join(', ')}${top(col(left.at(-1)!))} 아직 싱싱한데 ${result}${obj(Math.abs(result))} 돌려줍니다. 정답은 ${orangesRotting(grid)}입니다`,
      { wrongCells: left, result, wrong: true },
    );
  }
  return steps;
}
