---
title: '프론트엔드 트래킹, 선언적으로 풀어보니'
description: '명령형 트래킹이 컴포넌트를 무겁게 만드는 문제를 data attribute 기반 선언적 트래킹으로 풀어낸 설계와 구현 기록.'
pubDate: '2026.07.07'
heroImage: '@assets/post/declarative-tracking.png'
category: 'tech'
tags: ['트래킹', '선언적 프로그래밍', 'MutationObserver', 'IntersectionObserver', '아키텍처', '프론트엔드']
---

프론트엔드에서 트래킹 코드가 비즈니스 로직보다 많아지는 순간이 옵니다. 처음에는 클릭 한두 개를 보내는 정도라 부담이 없지만, GA 이벤트가 30개를 넘고 자체 로그 서버까지 붙으면 컴포넌트마다 `onClick` 안에 트래킹 코드가 쌓입니다. 리뷰에서 "이거 트래킹을 빼면 세 줄인데요"라는 말이 나오기 시작하면, 구조를 다시 볼 때입니다.

저는 이 문제를 직접 만든 트래킹 패키지로 풀어봤습니다. 컴포넌트에는 **선언적(declarative)**으로 트래킹 대상만 표시하고, 무엇을 어디로 보낼지는 한곳에 모으는 방식입니다. 이 글에서는 명령형 트래킹이 왜 컴포넌트를 무겁게 만드는지 살펴보고, 선언적 방식으로 옮기며 마주친 설계 문제와 해결 과정을 정리합니다.

## 트래킹 코드가 컴포넌트를 무겁게 만드는 과정

보통 다음과 같이 시작합니다.

```tsx
function BannerButton() {
  const handleClick = () => {
    gtag('event', 'banner_click', { campaign: 'summer' });
    amplitude.track('Banner Click', { campaign: 'summer' });
    // 실제 로직...
  };
  return <button onClick={handleClick}>배너</button>;
}
```

간단해 보이지만 문제는 금방 커집니다. GA 외에 Amplitude도 보내야 하고, 페이지뷰 이벤트도 필요하고, 스크롤 깊이도 측정해야 합니다. 컴포넌트에 `useEffect`가 추가되고, `IntersectionObserver`를 직접 다루는 훅이 생기면서, 어느 순간 트래킹이 컴포넌트의 중심을 차지합니다.

채널을 교체할 때는 부담이 더 큽니다. GA4에서 Amplitude로 이관하려면 트래킹 코드가 박힌 컴포넌트를 전부 찾아 고쳐야 합니다.

이 불편함은 결국 한 곳에서 비롯됩니다. **컴포넌트가 '무엇을 추적할지'와 '어디로 보낼지'를 동시에 떠안고 있다는 점**입니다. 버튼은 자신이 클릭됐다는 사실만 알면 되는데, GA 이벤트 이름과 Amplitude 페이로드 형식까지 짊어지고 있습니다.

그래서 이 두 책임을 분리해 보기로 했습니다. 컴포넌트에는 추적 대상이라는 표시만 남기고, 구체적으로 무엇을 어디로 보낼지는 바깥에서 정하는 방식입니다.

## 선언적 트래킹으로 다시 설계하기

분리하고 나면 구조가 명확해집니다. 마크업에는 추적 대상 표시만 남고, 무엇을 어디로 보낼지는 **맵**과 **어댑터**가 나눠 맡습니다. 여기에 동적 데이터를 얹는 방법까지 순서대로 살펴보겠습니다.

### 마크업에는 의도만 적기

그 '표시'는 마크업에 남깁니다. 요소에 `data-track` 속성 하나를 붙이는 것입니다.

```html
<button data-track="banner-click">배너</button>
```

컴포넌트 코드에는 GA도 Amplitude도 흔적이 없습니다. 이 한 줄이 '추적 대상'이라는 표시의 전부입니다.

무엇을 어디로 보낼지는 **맵(map)**에 모읍니다.

```ts
const map = {
  'banner-click': {
    trigger: 'click',
    targets: [
      { type: 'ga', event: 'banner_click' },
      { type: 'amplitude', eventName: 'Banner Click' },
    ],
  },
};
```

`banner-click` 키 하나에 GA와 Amplitude 두 채널이 묶여 있습니다. 채널을 추가하거나 제거하려면 이 맵만 고치면 됩니다.

### 동적 파라미터 넘기기

맵에 정의된 이벤트에 런타임 데이터를 실어 보내야 할 때가 많습니다. 상품 ID, 캠페인명 같은 값입니다. 컴포넌트에서 이 값을 넘기는 방법은 두 가지입니다.

먼저 개별 속성 방식입니다.

```tsx
<div
  data-track="product-click"
  data-track-product-id={product.id}
  data-track-category={product.category}
/>
```

`data-track-` 접두사 뒤의 문자열이 파라미터 키가 됩니다. `data-track-product-id="123"`이면 `{ 'product-id': '123' }`으로 **어댑터(adapter)**에 전달됩니다.

JSON 방식은 키가 많을 때 편합니다.

```tsx
<div
  data-track="product-click"
  data-track-params={JSON.stringify({
    productId: product.id,
    category: product.category,
    price: product.price,
  })}
/>
```

두 방식을 함께 쓸 수도 있습니다. 같은 키가 겹치면 JSON 쪽이 우선합니다.

```tsx
<div
  data-track="product-click"
  data-track-category="default"
  data-track-params={JSON.stringify({ category: 'override' })}
/>
// → dynamicParams: { category: 'override' }
```

content-view **트리거(trigger)**와 조합하면, 상품 카드가 화면에 보일 때 노출 이벤트를 자동으로 보낼 수 있습니다.

```tsx
function ProductCard({ product }: { product: Product }) {
  return (
    <div
      data-track="product-impression"
      data-track-product-id={product.id}
      data-track-params={JSON.stringify({
        productName: product.name,
        position: product.listIndex,
      })}
    >
      {/* 카드 내용 */}
    </div>
  );
}
```

맵에는 다음과 같이 정의합니다.

```ts
'product-impression': {
  trigger: 'content-view',
  targets: [
    { type: 'ga', event: 'view_item', item_list_name: 'product_list' },
    { type: 'amplitude', eventName: 'Product Impression' },
  ],
},
```

화면에 50% 이상 노출된 시점에 두 채널로 함께 나갑니다. 컴포넌트는 `IntersectionObserver`를 직접 다룰 필요가 없습니다.

### 어댑터: 어디로 보낼지

맵이 "무엇을 언제"를 정의하면, 어댑터가 "어디로"를 담당합니다.

```ts
const gaAdapter = {
  type: 'ga',
  execute(target, dynamicParams) {
    gtag('event', target.event, { ...dynamicParams });
  },
};

const amplitudeAdapter = {
  type: 'amplitude',
  execute(target, dynamicParams) {
    amplitude.track(target.eventName, { ...dynamicParams });
  },
};
```

`enabled` 플래그가 있어서, 개발 환경에서 GA는 끄고 콘솔 로그만 확인하고 싶을 때 맵은 그대로 두고 어댑터만 꺼두면 됩니다.

### 타겟에 함수로 채널별 매핑

이 함수 매핑은 나중에 추가한 기능입니다. GA에는 `param_01` 같은 슬롯 이름으로, Amplitude에는 `userSegment` 같은 서술적 키로 보내야 하는 상황이 있었습니다. 같은 데이터인데 채널마다 키 이름이 다른 경우입니다.

```ts
'landing-view': {
  trigger: 'pageview',
  targets: [
    {
      type: 'ga',
      event: 'view_landing',
      params: (p) => ({ param_01: p.user_segment, param_02: p.coupon_state }),
    },
    {
      type: 'amplitude',
      eventName: 'Landing View',
      properties: (p) => ({ userSegment: p.user_segment, couponState: p.coupon_state }),
    },
  ],
},
```

호출하는 쪽은 어떤 채널이 붙어 있는지 몰라도 됩니다.

```tsx
// 선언형
<div
  data-track="landing-view"
  data-track-params={JSON.stringify({
    user_segment: 'guest_user',
    coupon_state: 'default',
  })}
/>

// 명령형
track('landing-view', { user_segment: 'guest_user', coupon_state: 'default' });
```

채널별 매핑은 맵이 담당합니다. 함수가 있는 타겟은 `dynamicParams`를 어댑터에 직접 넘기지 않습니다. 반환값이 이미 타겟에 합쳐져 있기 때문입니다. 이렇게 해야 GA 어댑터에 `user_segment` 같은 값이 새어드는 것을 막을 수 있습니다.

## 브라우저 API로 요소 감지하기

여기까지가 개발자가 마주하는 인터페이스입니다. 이제 이 선언들을 브라우저에서 실제로 감지하고 실행하는 내부를 살펴봅니다. 특정 프레임워크에 기대지 않기로 한 이유부터 짚겠습니다.

### React에 묶지 않은 이유

처음에는 React 훅으로 만들까 고민했습니다. `useTracking('banner-click')` 같은 형태입니다. 그러나 그렇게 하면 프레임워크가 바뀔 때 다시 만들어야 합니다.

그래서 브라우저 API만 쓰기로 했습니다. `MutationObserver`로 DOM 변화를 감시하고, `IntersectionObserver`로 노출을 추적하고, `document.addEventListener('click', ..., true)`로 클릭을 캡처 단계에서 위임합니다. React든 Vue든 결국 DOM을 만드는 것은 같기 때문입니다.

### MutationObserver와 rAF 배칭

먼저 `data-track`이 붙은 요소를 찾아야 합니다. 요소는 언제든 새로 마운트되므로, `MutationObserver`로 DOM 변화를 지켜봅니다.

그런데 `MutationObserver`를 그대로 쓰면 문제가 하나 있습니다. React가 한 커밋 안에서 DOM을 여러 번 수정하면 observer 콜백도 연달아 호출됩니다. 매번 요소를 해석하고 핸들러에 연결하면 같은 요소를 여러 번 처리하게 됩니다.

변경분을 `Set`에 모았다가 `requestAnimationFrame` 한 번에 처리하는 방식으로 풀었습니다.

```ts
const pendingAdded = new Set<Element>();
const pendingRemoved = new Set<Element>();

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    mergeMutationIntoPending(mutation);
  }
  scheduleMutationBatchFlush(); // rAF 한 번 예약
});
```

같은 틱에 rAF가 여러 번 예약되면 `cancelAnimationFrame`으로 이전 것을 취소하고 다시 예약합니다. 결과적으로 프레임당 한 번만 flush됩니다. `setTimeout(0)` 대신 rAF를 쓴 이유는, 브라우저 렌더 주기에 맞춰 타이밍이 덜 흔들리기 때문입니다.

flush 순서는 제거가 먼저, 추가가 나중입니다. `IntersectionObserver` 구독이 이미 빠진 노드에 남아 있으면 안 되기 때문입니다.

### 클릭: 캡처 단계 리스너 하나

요소마다 리스너를 붙이는 대신, 루트에 캡처 단계 리스너 하나를 두었습니다.

```ts
root.addEventListener('click', handleClick, true);

function handleClick(e: Event) {
  const target = (e.target as Element)?.closest?.('[data-track]');
  if (!target) return;
  // resolve → dispatch
}
```

캡처 단계를 쓴 데에는 이유가 있습니다. 하위 컴포넌트에서 `stopPropagation()`을 호출해도 트래킹은 이미 잡혀 있습니다. 실제로 모달 닫기 버튼에서 이벤트 전파를 막고 있었는데, 버블링 단계였다면 트래킹까지 함께 막혀 데이터가 누락됐을 것입니다.

### WeakSet으로 요소당 한 번

pageview나 content-view는 요소당 한 번만 보내야 합니다. 이때 `Set` 대신 `WeakSet`을 씁니다.

```ts
const triggered = new WeakSet<Element>();

if (triggered.has(el)) continue;
triggered.add(el);
observer.unobserve(el);
```

DOM에서 빠진 요소에 강한 참조가 남지 않으므로, SPA에서 라우트가 바뀌면 이전 요소들이 자동으로 GC됩니다. `Set`이었다면 계속 메모리를 점유했을 것입니다. 새 라우트에서 같은 `data-track` 키를 가진 요소가 마운트되면 새 인스턴스이므로 `WeakSet`에 없고, 다시 발화됩니다.

## 몇 달 써보니

트래킹 리뷰가 빨라졌습니다. 예전에는 "이 이벤트를 어디서 보내지?"를 확인하려면 컴포넌트를 뒤져야 했지만, 이제는 맵 파일 하나만 보면 됩니다. 기획자가 이벤트 이름 변경을 요청하면 맵에서 한 줄만 고치면 됩니다.

컴포넌트도 깔끔해졌습니다. 트래킹 때문에 `useEffect`나 `useRef`를 쓸 일이 없어졌습니다.

Amplitude를 추가로 붙일 때는 어댑터 하나를 만들고 맵의 `targets`에 한 줄을 추가하면 됐습니다. 컴포넌트는 건드리지 않았습니다.

물론 개선할 점도 있습니다. `data-track` 문자열이 맵의 키와 맞아야 하는데, 오타가 나면 에러 없이 조용히 무시됩니다. debug 모드에서 경고를 띄우기는 하지만 프로덕션에서는 알기 어렵습니다. 타입 레벨에서 키를 강제하는 것은 아직 과제로 남아 있습니다. DOM 속성 기반이라 서버 사이드에서는 동작하지 않는 점도 제약입니다. 저희는 클라이언트 전용 라우트라 문제가 없었지만, SSR 프로젝트라면 별도 처리가 필요합니다.

트래킹 시스템을 직접 만들어야 하느냐고 묻는다면, 웬만한 경우에는 GTM으로 충분하다고 답하겠습니다. 다만 채널이 두 개 이상이고, 이벤트가 수십 개를 넘어, 컴포넌트마다 트래킹 코드가 비즈니스 로직보다 많아지는 상황이라면 고려해 볼 만합니다. 방법이 반드시 data attribute일 필요는 없습니다. 커스텀 훅이든 디렉티브든 괜찮습니다. 트래킹이 비즈니스 로직을 잠식하지 않도록 선을 긋는 것이 핵심입니다.

## 참고

- [MutationObserver — MDN](https://developer.mozilla.org/ko/docs/Web/API/MutationObserver)
- [Intersection Observer API — MDN](https://developer.mozilla.org/ko/docs/Web/API/Intersection_Observer_API)
