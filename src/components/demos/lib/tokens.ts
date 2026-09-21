/**
 * 무대 위의 작은 블록(토큰)을 자리(앵커) 사이로 옮기는 공용 헬퍼.
 *
 * 토큰과 앵커는 모두 .astro 템플릿에 미리 그려 둔다(스코프 스타일이 걸리도록).
 * 스크립트는 "어느 토큰이 어느 앵커에 있는가"만 넘기고, 위치 계산은 여기서
 * getBoundingClientRect로 한다. 위치는 인라인 transform이라 CSS transition이
 * 이동을 애니메이션한다.
 *
 * 마크업 계약:
 *   무대   — position: relative 인 요소 (createTokens의 인수)
 *   토큰   — [data-token="이름"], position: absolute; top: 0; left: 0
 *   앵커   — [data-anchor="이름"], 토큰이 가운데 놓일 빈 자리
 *
 * 앵커가 null이면 토큰은 마지막 자리에서 사라지고(data-gone), 다시 나타날 때는
 * 새 자리로 순간이동한 뒤 보인다. 없던 블록이 무대를 가로질러 날아오지 않게 하려는 것이다.
 */
export type Placement = Record<string, string | null | undefined>;

export function createTokens(stage: HTMLElement) {
  const tokens = new Map<string, HTMLElement>();
  stage.querySelectorAll<HTMLElement>('[data-token]').forEach((t) => tokens.set(t.dataset.token!, t));

  let current: Placement = {};

  const layout = (instant: boolean) => {
    const base = stage.getBoundingClientRect();
    tokens.forEach((tok, name) => {
      const at = current[name];
      const anchor = at ? stage.querySelector<HTMLElement>(`[data-anchor="${at}"]`) : null;
      if (!anchor || anchor.offsetParent === null) {
        tok.setAttribute('data-gone', '');
        return;
      }
      const r = anchor.getBoundingClientRect();
      const x = r.left - base.left + (r.width - tok.offsetWidth) / 2;
      const y = r.top - base.top + (r.height - tok.offsetHeight) / 2;
      const appearing = tok.hasAttribute('data-gone') || !tok.style.transform;
      if (instant || appearing) {
        tok.style.transition = 'none';
        tok.style.transform = `translate(${x}px, ${y}px)`;
        void tok.offsetWidth; // 순간이동을 확정한 뒤 전환을 되살린다
        tok.style.transition = '';
      } else {
        tok.style.transform = `translate(${x}px, ${y}px)`;
      }
      tok.removeAttribute('data-gone');
    });
  };

  // 폭이 바뀌면 앵커 위치도 바뀐다. 이때는 미끄러지지 않고 바로 따라간다.
  new ResizeObserver(() => layout(true)).observe(stage);

  return {
    place(next: Placement, instant = false) {
      current = next;
      layout(instant);
    },
  };
}
