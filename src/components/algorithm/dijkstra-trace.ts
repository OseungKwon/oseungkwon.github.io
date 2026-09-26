/**
 * 다익스트라 — 프로그래머스 「배달」 예제 1의 계산 모음. 단계 진행(DijkstraWalk)과 본문 정적 그림
 * (DijkstraScene)이 같은 계산을 쓴다.
 *
 * 마을은 1번부터 N번, 도로 [a, b, c]는 a와 b를 잇는 양방향 도로이고 지나는 데 c시간이 걸린다.
 * 이웃을 보는 순서는 풀이 코드와 같이 road에 적힌 순서다.
 */

export const N = 5;
export const K = 3;
export const START = 1;
export const ROAD: [number, number, number][] = [
  [1, 2, 1],
  [2, 3, 3],
  [5, 2, 2],
  [1, 4, 2],
  [5, 3, 1],
  [5, 4, 2],
];
/** 예제 1 출력 */
export const EXPECTED = 4;

/** 마을 좌표(1번부터). 도로가 서로 겹치지 않게 손으로 정했다 */
export const POS: Record<number, { x: number; y: number; label: 'above' | 'below' }> = {
  1: { x: 46, y: 70, label: 'above' },
  2: { x: 176, y: 46, label: 'above' },
  3: { x: 318, y: 78, label: 'above' },
  4: { x: 86, y: 196, label: 'below' },
  5: { x: 246, y: 186, label: 'below' },
};

// ── 조사 (writing/explaining.md 9절)
const noBatchim = (n: number) => '2459'.includes(String(n).at(-1)!);
const obj = (n: number) => (noBatchim(n) ? '를' : '을');
const topic = (n: number) => (noBatchim(n) ? '는' : '은');
const toward = (n: number) => `${n}${'1245789'.includes(String(n).at(-1)!) ? '로' : '으로'}`;
const show = (d: number | null) => (d === null ? '∞' : String(d));

function adjacency() {
  const graph: [number, number, number][][] = Array.from({ length: N + 1 }, () => []);
  ROAD.forEach(([a, b, c], road) => {
    graph[a].push([b, c, road]);
    graph[b].push([a, c, road]);
  });
  return graph;
}

/** 본문에 싣는 참고 풀이와 같은 계산(우선순위 큐는 정렬 배열로 흉내 낸다). 빌드 시점에 예제 출력을 확인하는 데 쓴다. */
export function solution(n: number, road: [number, number, number][], k: number): number {
  const graph: [number, number][][] = Array.from({ length: n + 1 }, () => []);
  for (const [a, b, c] of road) {
    graph[a].push([b, c]);
    graph[b].push([a, c]);
  }
  const dist = Array(n + 1).fill(Infinity);
  dist[1] = 0;
  const pq: [number, number][] = [[0, 1]];
  while (pq.length > 0) {
    pq.sort((p, q) => p[0] - q[0]);
    const [d, u] = pq.shift()!;
    if (d > dist[u]) continue;
    for (const [v, w] of graph[u]) {
      if (d + w < dist[v]) {
        dist[v] = d + w;
        pq.push([dist[v], v]);
      }
    }
  }
  return dist.filter((d) => d <= k).length;
}

// 마을: i 아직 모름(∞) / q 거리 후보가 있음(pq에 있음) / a 지금 확정해 이웃을 보는 마을 / d 확정 / w 답(K 이하) / o K 초과
// 도로: i 보통 / t 지금까지의 최단 경로 / y 이번에 줄인 도로 / f 이번에 줄이지 못한 도로
export interface Step {
  note: string;
  kind: 'start' | 'confirm' | 'relax' | 'skip' | 'end';
  nodes: string;
  edges: string;
  dist: (number | null)[];
  /** 줄이지 못한 후보 거리 (마을 번호 → 값). 한 단계만 빨간 취소선으로 보인다 */
  cand: (number | null)[];
  pq: [number, number][];
  popped: [number, number] | null;
  changed: number | null;
  settled: number;
  result: number | null;
}

export function traceDijkstra(): Step[] {
  const graph = adjacency();
  const dist: number[] = Array(N + 1).fill(Infinity);
  const parent: (number | null)[] = Array(N + 1).fill(null);
  const done: boolean[] = Array(N + 1).fill(false);
  dist[START] = 0;
  let pq: [number, number][] = [[0, START]];
  const steps: Step[] = [];
  let settled = 0;

  const snap = (
    note: string,
    kind: Step['kind'],
    opt: { active?: number; road?: number; ok?: boolean; cand?: [number, number]; popped?: [number, number]; changed?: number; end?: boolean } = {},
  ) => {
    const nodes = Array.from({ length: N }, (_, k) => {
      const v = k + 1;
      if (opt.end) return dist[v] <= K ? 'w' : 'o';
      if (v === opt.active) return 'a';
      if (done[v]) return 'd';
      if (dist[v] < Infinity) return 'q';
      return 'i';
    }).join('');
    const tree = new Set(parent.filter((r): r is number => r !== null));
    const edges = ROAD.map((_, r) => {
      if (r === opt.road) return opt.ok ? 'y' : 'f';
      return tree.has(r) ? 't' : 'i';
    }).join('');
    const cand: (number | null)[] = Array(N).fill(null);
    if (opt.cand) cand[opt.cand[0] - 1] = opt.cand[1];
    steps.push({
      note,
      kind,
      nodes,
      edges,
      dist: dist.slice(1).map((d) => (d === Infinity ? null : d)),
      cand,
      pq: [...pq].sort((p, q) => p[0] - q[0] || p[1] - q[1]),
      popped: opt.popped ?? null,
      changed: opt.changed ?? null,
      settled,
      result: opt.end ? dist.filter((d) => d <= K).length : null,
    });
  };

  snap(`출발지 ${START}번 마을의 거리만 0이고 나머지는 모두 ∞입니다. pq에 [0, ${START}]${obj(START)} 넣고 시작합니다. "다음"을 눌러 보세요`, 'start');

  while (pq.length > 0) {
    pq.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const [d, u] = pq.shift()!;
    if (d > dist[u]) {
      snap(`pq에서 꺼낸 [${d}, ${u}]${topic(u)} ${u}번의 확정 거리 ${dist[u]}보다 커서 버립니다`, 'skip', { popped: [d, u] });
      continue;
    }
    done[u] = true;
    settled++;
    const open = graph[u].filter(([v]) => !done[v]).map(([v]) => v);
    const next = open.length ? `이웃 ${open.join(', ')}번을 ${open.length > 1 ? '차례로 ' : ''}봅니다` : '확정되지 않은 이웃이 없어 볼 곳이 없습니다';
    snap(`pq에서 거리가 가장 작은 [${d}, ${u}]${obj(u)} 꺼내 ${u}번 마을의 거리를 ${toward(d)} 확정합니다. ${next}`, 'confirm', {
      active: u,
      popped: [d, u],
    });

    for (const [v, w, road] of graph[u]) {
      // 이미 확정한 이웃은 거리가 d 이하라 줄어들 수 없다. 도형이 바뀌지 않으므로 단계로 남기지 않는다
      if (done[v]) continue;
      const alt = d + w;
      if (alt < dist[v]) {
        const before = dist[v];
        dist[v] = alt;
        parent[v] = road;
        pq.push([alt, v]);
        snap(
          `${u}번에서 ${v}번으로 가면 ${d} + ${w} = ${alt}입니다. ${show(before === Infinity ? null : before)}보다 작아 dist[${v}]${obj(v)} ${toward(alt)} 줄이고 pq에 [${alt}, ${v}]${obj(v)} 넣습니다`,
          'relax',
          { active: u, road, ok: true, changed: v },
        );
      } else {
        snap(
          `${u}번에서 ${v}번으로 가면 ${d} + ${w} = ${alt}입니다. 이미 적힌 ${dist[v]}보다 작지 않아 dist[${v}]${topic(v)} 그대로 둡니다`,
          'relax',
          { active: u, road, ok: false, cand: [v, alt] },
        );
      }
    }
  }

  const reach = Array.from({ length: N }, (_, k) => k + 1).filter((v) => dist[v] <= K);
  snap(`pq가 비어 모든 마을의 거리가 확정됐습니다. ${K}시간 이하인 마을은 ${reach.join(', ')}번, 모두 ${reach.length}개입니다`, 'end', {
    end: true,
  });
  return steps;
}

/** 본문 정적 그림용: 마을 settled개를 확정하고 그 이웃까지 본 직후의 장면 */
export function sceneAfter(settledCount: number): Step {
  const steps = traceDijkstra();
  const nextConfirm = steps.findIndex((s) => s.kind === 'confirm' && s.settled === settledCount + 1);
  const scene = nextConfirm === -1 ? steps.at(-1)! : steps[nextConfirm - 1];
  // 정적 그림에서는 '지금 보는 마을'과 '이번 도로'를 따로 칠하지 않는다
  return {
    ...scene,
    nodes: scene.nodes.replace(/a/g, 'd'),
    edges: scene.edges.replace(/y/g, 't').replace(/f/g, 'i'),
    cand: scene.cand.map(() => null),
  };
}
