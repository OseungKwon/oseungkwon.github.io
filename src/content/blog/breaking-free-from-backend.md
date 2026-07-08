---
title: '백엔드 의존성에서 탈출하기. with MSW & 어댑터 패턴'
description: 'Domain Model 분리와 어댑터 패턴, MSW 도입으로 백엔드 의존성에서 벗어나 프론트엔드 주도 개발 환경을 구축하는 방법'
pubDate: '2026.01.15'
heroImage: '@assets/post/breaking-free-from-backend/1.png'
category: 'tech'
tags: ['MSW', '어댑터 패턴', '프론트엔드', '아키텍처', 'Domain Model', 'Mock']
---

“API 문서는 언제 나오나요?”, “서버 배포되려면 얼마나 걸리나요?”
프론트엔드 개발자라면 한 번쯤 겪어봤을 대화입니다.

서비스 초기에는 보통 백엔드 API가 완성된 뒤에 프론트엔드 작업을 시작하는 게 당연했습니다.  
API 응답을 약간만 가공해서 비즈니스 로직을 작성하고, 곧바로 UI에 렌더링하면 되었기 때문에 개발 속도 면에서도 훨씬 효율적으로 보였습니다.

하지만 조직이 커지고 요구사항이 복잡해지면서, 백엔드에 종속된 **수동적인 개발 방식**은 분명한 한계에 부딪혔습니다.

가장 기억에 남는 사건들은 이렇습니다.

![백엔드 의존성 때문에 겪은 문제 상황들](@assets/post/breaking-free-from-backend/2.png)

백엔드 스케줄에 프론트엔드 일정이 종속되는 병목이 반복됐고, 백엔드 로직이 바뀌면 프론트엔드 UI가 깨지는 일도 잦았습니다. 그래서 우리는 이 의존성을 끊고, **프론트엔드가 주도적으로 개발할 수 있는 환경**을 만들기로 했습니다.

핵심 전략은 세 가지입니다.

1. **Domain Model 분리:** 서버 데이터와 UI 데이터를 철저히 분리한다.
2. **어댑터 패턴:** 두 세계를 느슨하게, 하지만 일관되게 연결한다.
3. **MSW 도입:** 서버가 없어도 요청과 응답을 실제처럼 시뮬레이션한다.

## Domain Model 정의하기

가장 먼저 한 일은 “서버에서 내려오는 데이터”와 “우리가 화면에 그릴 데이터”를 구분하는 것이었습니다.

- **DTO(Data Transfer Object):** 백엔드 API가 내려주는 데이터입니다.
  프론트엔드와 네이밍 컨벤션이 다를 수 있고, 필요 없는 필드가 섞여 있거나, UI에 적합하지 않은 구조일 수 있습니다.
- **Domain Model(UI Model):** 프론트엔드 컴포넌트가 렌더링하기에 가장 편한 형태의 데이터입니다.

기존에는 DTO를 그대로 끌어다 쓰는 경우가 많았습니다.
하지만 이제는 프론트엔드 **독자적인 Model**을 먼저 정의합니다.
서버 API가 아직 없어도, 기획서와 화면 설계서를 기반으로 모델을 정의하고 이를 기준으로 비즈니스 로직과 UI 로직을 구성할 수 있습니다.

장바구니를 예시로 살펴보겠습니다.

**DTO(서버 응답) 예시**

```tsx
interface CartResponse {
  cart_id: number;
  user_idx: number;
  item_list: Array<{
    item_nm: string;
    item_prc: number;
    opt_yn: 'Y' | 'N';
    stock_count: number;
    added_date: string;
  }>;
  total_pay_amt: number;
  coupon_applied: boolean;
}
```

**Domain Model 예시**

```tsx
interface CartItem {
  id: string;
  name: string;
  price: number;
  hasOption: boolean;
  quantity: number;
  isOutOfStock: boolean;
}

interface CartModel {
  id: number;
  items: CartItem[];
  totalPrice: number;
  canCheckout: boolean;
}
```

만약 서버 응답을 그대로 UI 데이터로 사용했다면, 사용하는 쪽에서 매번 옵션 여부를 확인하기 위해 `hasOption()`과 같은 함수를 만들어 써야 했을 것입니다.

반면 프론트엔드 전용 모델을 도입하면 네이밍 컨벤션을 프론트 기준으로 통일할 수 있고, 필요 없는 필드는 과감히 버릴 수 있으며, 화면에 최적화된 구조로 데이터를 다룰 수 있습니다.

## Adapter Pattern (DTO ↔ Domain Model)

서버에서 내려오는 **DTO**와 우리가 정의한 **Domain Model**은 형태가 다릅니다.
이 둘을 연결해 주는 것이 바로 **어댑터(Adapter)**입니다.

어댑터는 본질적으로 **변환 함수**입니다.
서버 데이터를 받아서 프론트엔드가 쓰기 좋은 모양으로 바꿔줍니다.

앞선 장바구니 예시를 그대로 이어서 보겠습니다.

```tsx
export const mapCartResponseToModel = (dto: CartResponse): CartModel => {
  const items: CartItem[] = dto.item_list.map((item) => ({
    id: `${item.item_nm}_${item.added_date}`,
    name: item.item_nm,
    price: item.item_prc,
    hasOption: item.opt_yn === 'Y',
    quantity: item.stock_count,
    isOutOfStock: item.stock_count === 0,
  }));

  return {
    id: dto.cart_id,
    items: items,
    totalPrice: dto.total_pay_amt,
    canCheckout: items.length > 0 && items.every((item) => !item.isOutOfStock),
  };
};
```

이 함수는 필드 이름만 바꾸는 데 그치지 않습니다. `opt_yn === 'Y'`를 `hasOption` 불리언으로 바꾸고, `stock_count`로 `isOutOfStock`을, 아이템 목록으로 `canCheckout`을 계산해 냅니다. 서버가 내려주지 않는 파생 값을 이 지점에서 만들어 두면, 컴포넌트는 옵션 여부나 결제 가능 여부를 매번 다시 계산하지 않고 모델을 읽기만 하면 됩니다.

덕분에 이후 서버 응답 구조가 바뀌더라도 모든 사용처를 뒤질 필요 없이 어댑터 함수 한 곳만 고치면 되어, 유지보수 비용을 크게 줄일 수 있습니다.

## MSW: 서버가 없으면 만들어서 쓴다

모델을 정의했다면, 이제 실제로 화면에 데이터를 흘려보며 개발해야 합니다.
하지만 현실에서는 아직 백엔드 API가 준비되지 않은 경우가 많습니다.

예전에는 이를 대응하기 위해 컴포넌트 안에 하드코딩 데이터를 넣거나, `Promise`를 사용해 비동기 데이터를 흉내 내는 mock API를 직접 만들었습니다.
그러나 이 방식은 mock 데이터를 주입하는 코드가 컴포넌트 곳곳에 섞여 들어가고, 실제 네트워크 계층을 거치지 않아 로딩·에러 같은 통신 상태를 온전히 재현하기 어렵습니다.

이 문제를 보완하기 위해 우리는 **MSW(Mock Service Worker)**를 도입했습니다. MSW는 Service Worker로 브라우저의 네트워크 요청을 가로채, 우리가 미리 정의한 DTO 형태의 mock 데이터를 응답으로 내려줍니다. 앞서 만든 `CartResponse` 형태를 그대로 돌려주는 핸들러는 이렇게 생겼습니다.

```tsx
// GET /api/cart 요청을 가로채 DTO 형태로 응답한다
http.get('/api/cart', () => {
  return HttpResponse.json<CartResponse>({
    cart_id: 1,
    user_idx: 1001,
    item_list: [
      { item_nm: '아메리카노', item_prc: 4500, opt_yn: 'Y', stock_count: 3, added_date: '2026-01-10' },
    ],
    total_pay_amt: 4500,
    coupon_applied: false,
  });
});
```

컴포넌트 입장에서는 실제 API를 부르는 것과 똑같이 `/api/cart`로 요청을 보내고, 그 응답을 어댑터에 통과시켜 모델로 다룹니다. 덕분에 백엔드 API 개발을 기다리지 않고도 실제와 거의 같은 통신 환경에서 UI 개발과 예외 처리 테스트를 먼저 진행할 수 있게 되었습니다.

물론 MSW를 도입해도 기존과 비슷한 고민, 즉 **mock 데이터 생성이 번거롭다**는 문제는 남아 있습니다.
하지만 이 부분은 AI를 통해 상당 부분 해소할 수 있었습니다.
서버 응답 인터페이스와 다양한 예외 케이스를 AI에게 넘겨주면, **MSW에서 바로 사용할 수 있는 mock 코드**를 생성해 줍니다.
이를 통해 여러 가지 엣지 케이스를 사전에 탐지하고, 실제 배포 전에 미리 대응할 수 있었습니다.

---

## 결론

이 아키텍처(MSW + Domain Model + Adapter)를 도입한 뒤, 팀이 얻은 이점은 다음과 같습니다.

- 백엔드 의존성 없이, 핸드오프 직후부터 프론트엔드 개발을 시작할 수 있습니다.
- 백엔드 API 응답 구조가 변경되더라도, 어댑터를 중심으로 빠르게 대응할 수 있습니다.
- 다양한 엣지 케이스와 네트워크 환경을 미리 시뮬레이션해 코드의 완성도를 높일 수 있습니다.

외부의 변화에 쉽게 흔들리지 않는 **단단하고 주도적인 프론트엔드 환경**을 구축하고 싶다면, **Adapter 패턴과 MSW 도입**은 충분히 고려해 볼 만한 해법입니다.
