---
title: 'FSD를 고민 없이 도입하면 안 되는 이유'
description: '실제 프로젝트에 FSD를 적용하며 Feature가 페이지별로 늘어나고 모델·API의 위치도 애매해졌습니다. 주문 코드에서 경계를 다시 정한 과정을 담았습니다.'
pubDate: '2026.09.03'
category: 'tech'
tags: ['FSD', 'Frontend Architecture', 'React', 'TypeScript', '도메인 모델링']
---

신규 웹 프로젝트를 시작하면서 기존 프로젝트에서 겪었던 구조상의 불편을 줄이고자 FSD를 도입했습니다. 도입 전에는 토이 프로젝트에 먼저 적용하며 활용 가능성을 확인했습니다. 그러나 실제 서비스의 요구사항과 여러 도메인이 들어오자 토이 프로젝트에서는 보이지 않던 문제가 생겼습니다.

FSD를 선택한 이유는 기능과 도메인의 경계를 분명하게 나누고, 비슷한 기능을 다시 사용할 수 있을 것이라고 기대했기 때문입니다. 실제로 적용하고 보니 페이지마다 이름이 비슷한 Feature가 하나씩 생겼고, 분리한 Feature도 대부분 해당 페이지에서만 사용했습니다.

디렉터리를 어떻게 나눌지 정하고 나면 끝날 줄 알았던 고민은 모델과 API로 번졌습니다. 백엔드 응답과 프론트엔드 모델 사이에 ViewModel까지 두어야 할지, 여러 Entity에서 쓰는 Enum은 `shared`로 올려야 할지, TanStack Query 코드는 어느 레이어가 가져야 할지 계속 판단해야 했습니다.

이 글은 그 과정에서 막혔던 지점과 지금까지 내린 결론을 정리한 기록입니다. FSD의 정답을 설명하기보다, 실제 코드에서 무엇이 애매했고 어떤 기준으로 정리해 나갔는지에 초점을 맞췄습니다.

## FSD는 어떻게 코드를 나누는가

> **Feature-Sliced Design이란?**
> 프론트엔드 코드를 책임과 의존성에 따라 나누는 아키텍처 방법론입니다. 코드의 위치와 참조 방향을 일정하게 만들어 변경 범위를 파악하기 쉽게 합니다.

먼저 이후의 고민과 직접 연결되는 FSD의 세 가지 개념을 짚어보겠습니다. FSD는 코드를 **Layer**, **Slice**, **Segment**로 나눕니다. Layer는 책임과 의존성의 범위를, Slice는 비즈니스 경계를, Segment는 코드가 맡은 역할을 나타냅니다.

| 구분    | 나누는 기준                            | 예시                            |
| ------- | -------------------------------------- | ------------------------------- |
| Layer   | 코드가 맡는 책임과 의존할 수 있는 범위 | `pages`, `features`, `entities` |
| Slice   | 같은 Layer 안의 비즈니스 도메인        | `user`, `order`, `product`      |
| Segment | Slice 안에서 코드가 수행하는 역할      | `ui`, `api`, `model`, `lib`     |

### Layer: 책임과 의존성의 범위

Layer의 이름과 순서는 정해져 있습니다. 위에 있는 Layer는 아래 Layer를 참조할 수 있지만 반대 방향은 허용하지 않습니다.

```text
app
pages
widgets
features
entities
shared
```

각 Layer는 대략 다음 역할을 맡습니다.

| Layer      | 역할                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `app`      | 라우팅, 전역 스타일, Provider처럼 애플리케이션을 실행하는 코드를 둡니다. |
| `pages`    | Route에 대응하는 화면을 구성합니다.                                      |
| `widgets`  | 여러 요소를 조합한 독립적인 화면 영역을 구성합니다.                      |
| `features` | 사용자가 수행하는 행동과 제품 기능을 구현합니다.                         |
| `entities` | 프로젝트가 다루는 비즈니스 개념과 관련 로직을 표현합니다.                |
| `shared`   | 특정 비즈니스 도메인에 속하지 않는 기반 코드를 둡니다.                   |

`pages`는 화면을 완성하는 레이어이므로 `features`와 `entities`의 코드를 가져와 조합할 수 있습니다. 반대로 `entities/order`가 `pages/checkout`을 참조하면 주문 규칙이 특정 화면에 의존하게 됩니다. 주문 규칙을 다른 화면에서 사용하거나 결제 화면을 변경할 때 Entity까지 함께 수정해야 하므로, 의존성은 Page에서 Entity를 향하는 방향으로만 흐르게 합니다.

```text
pages → features → entities → shared
```

이 목록을 모든 프로젝트가 그대로 사용할 필요는 없습니다. `widgets`처럼 Feature와 역할을 구분하기 어려운 Layer는 생략할 수 있고, 프로젝트에 필요한 Layer만 선택할 수 있습니다. 중요한 것은 폴더를 모두 만드는 일이 아니라, 각 Layer가 맡을 역할과 참조 방향을 팀에서 같은 기준으로 사용하는 것입니다.

### Slice: 비즈니스 경계

`features`나 `entities` 아래에는 비즈니스 도메인을 기준으로 Slice를 만듭니다. `entities/user`, `entities/order`, `features/add-to-cart`가 각각 하나의 Slice가 됩니다.

같은 Layer의 Slice는 원칙적으로 서로 참조하지 않습니다. `entities/order`와 `entities/user`를 함께 써야 한다면 둘 중 한쪽이 다른 쪽을 가져오는 대신 상위 Layer에서 조합합니다. 한 Slice의 변경이 옆 Slice로 번지지 않게 하려는 규칙입니다.

### Segment: Slice 안에서 맡은 역할

하나의 Slice는 코드의 역할에 따라 Segment로 나뉩니다.

```text
features/
└── add-to-cart/
    ├── ui/
    ├── api/
    ├── model/
    └── lib/
```

`ui`에는 화면 표현을, `api`에는 요청 함수와 서버 통신 타입을 둡니다. `model`에는 상태, 타입, 스키마, 비즈니스 로직이 들어가고 `lib`에는 Slice 내부에서 함께 쓰는 코드를 둡니다.

Layer와 Slice, Segment의 역할이 정해지면 새 파일을 둘 위치를 예측할 수 있습니다. Import 규칙으로 참조 방향을 제한하면 한 모듈의 변경이 예상하지 못한 화면으로 퍼지는 것도 줄일 수 있습니다. 다만 사용자 행동 하나를 어느 크기의 Feature로 볼지, 도메인 UI를 Entity에 둘지처럼 정의만으로 결정하기 어려운 문제는 남았습니다.

## FSD를 도입하며 기대한 효과

FSD 공식 문서는 이 구조의 장점으로 일관성, 격리성, 재사용 범위 제어, 도메인 중심 구조를 설명합니다. 제가 프로젝트에 FSD를 도입하며 기대했던 변화도 이 네 가지와 크게 다르지 않았습니다.

폴더의 역할과 참조 방향이 일정하면 새로 합류한 개발자도 코드를 찾는 기준을 익힐 수 있습니다. Layer와 Slice가 서로 의존할 수 있는 범위를 제한하면 기능을 수정할 때 함께 확인해야 할 코드도 줄어듭니다. `order`, `payment`처럼 서비스에서 사용하는 용어로 Slice를 나누면 기획 요구사항과 코드의 위치를 같은 언어로 이야기할 수 있고, 공통 코드도 무조건 `shared`로 올리는 대신 필요한 범위 안에서만 공유할 수 있습니다.

특히 기대한 것은 변경 범위를 예측할 수 있다는 점이었습니다. 주문과 관련된 요구사항이 바뀌면 주문 Slice 안에서 수정이 끝나고, 다른 화면에서 같은 기능이 필요하면 이미 분리한 Feature를 가져다 쓸 수 있을 것으로 봤습니다.

## FSD 도입 이후 마주한 문제

앞에서 정리한 기대 효과만 보면 FSD를 도입한 뒤 코드의 위치와 변경 범위가 이전보다 분명해져야 합니다. 과연 실제 프로젝트에서도 그 효과를 온전히 얻을 수 있었을까요? 가장 먼저 막힌 지점은 Feature의 크기였습니다. Feature의 범위를 정하지 못하자 그 안에 들어갈 UI와 모델, API의 위치도 함께 결정하기 어려웠습니다.

### Feature를 분리했지만 재사용되지 않았습니다

페이지 하나를 만들 때 Page와 이름이 비슷한 Feature가 함께 생겼습니다. 화면에서 쓰는 Entity 몇 개가 그 아래에 붙는 형태였습니다.

```text
pages/
└── checkout/

features/
└── checkout/

entities/
├── cart/
├── order/
└── payment/
```

이 구조에서 `pages/checkout`은 `features/checkout`을 조합하기보다 그대로 전달하는 파일에 가까웠습니다. Feature도 해당 페이지에서만 쓰이니 둘을 나눈 이유를 설명하기 어려웠습니다.

Feature의 이름이 너무 크다고 보고 사용자 행동 단위로 더 잘게 나눠 보기도 했습니다.

```text
features/
├── apply-coupon/
├── select-payment-method/
└── submit-order/
```

이름은 구체적이 됐지만 한 페이지를 만들 때마다 작은 Feature 폴더가 늘어났습니다. 찾기 어렵다는 이유로 `features/checkout` 아래에 다시 모으면 처음의 `1 Page - 1 Feature`와 별 차이가 없었습니다.

이때 Feature를 재사용 가능성만 보고 미리 분리하는 방식이 맞는지 다시 생각했습니다. 같은 사용자 행동이라도 화면이 달라지면 문구와 배치뿐 아니라 앞뒤 처리 과정까지 달라질 수 있습니다. 아직 다른 사용처가 없는 기능을 먼저 나누자, 한 화면의 흐름을 이해하기 위해 Page와 여러 Feature 폴더를 오가야 했습니다. 재사용은 일어나지 않았지만 기능 하나를 수정할 때 확인할 위치는 늘어났습니다.

<!-- TODO: 실제 프로젝트의 초기 디렉터리 구조를 추가합니다. -->

---

### Feature의 UI는 어디까지 가져야 할까

Feature의 크기를 정하려면 UI를 어디까지 함께 둘지도 결정해야 했습니다. `apply-coupon`이 하나의 Feature라면 API 호출과 상태 변경뿐 아니라 버튼과 입력 폼까지 같은 Slice에 두는 편이 한눈에 이해하기 좋습니다.

```text
features/
└── apply-coupon/
    ├── api/
    ├── model/
    └── ui/
```

하지만 UI와 비즈니스 로직을 한 컴포넌트로 묶어 놓으면 동작만 가져다 쓰기 어려웠습니다. 화면마다 버튼의 위치와 문구가 달랐고, 같은 동작을 모달과 페이지에서 서로 다른 모습으로 제공하기도 했습니다. 그렇다고 로직만 Feature에 남기면 Page가 다시 상태와 이벤트를 일일이 연결해야 했습니다.

Entity의 `ui` Segment에서도 같은 문제가 생겼습니다. FSD에서는 `entities/product/ui`처럼 도메인 데이터를 표현하는 UI를 Entity 가까이에 둘 수 있습니다. 그런데 같은 Item도 장바구니와 주문서, 상품 선택 화면에서 필요한 정보와 동작이 달랐습니다.

```tsx
// 장바구니에서는 수량 변경과 삭제가 필요합니다.
<CartItem item={item} quantityControl deleteButton />

// 주문서에서는 결제 대상과 금액만 보여줍니다.
<OrderItem item={item} />
```

공통 Item 컴포넌트 하나로 버티려면 조건과 Variant가 계속 붙었습니다. 반대로 화면별 완성형 UI를 Entity 안에 모으면 Entity가 장바구니와 주문서의 표현까지 알아야 했습니다. 데이터가 속한 곳과 그 데이터를 보여 주는 UI가 속할 곳은 같지 않을 수 있었습니다.

데이터가 속한 곳과 UI가 속할 곳을 분리하되, 화면 사이에서 반복되는 동작은 남길 방법이 필요했습니다. 그래서 상태와 접근성만 공통으로 제공하고 최종 마크업과 Tailwind 스타일은 Page에서 조합하는 Headless UI와 합성 패턴을 검토했습니다. 다만 모든 도메인 UI를 Headless 컴포넌트로 만들면 각 화면을 구현하기 전에 추상화부터 설계해야 합니다. 여러 화면에서 구조나 동작이 실제로 반복된다는 사실을 확인한 뒤 적용하는 편이 나았습니다.

그래서 Entity UI를 기본 구조로 삼지는 않기로 했습니다. 화면마다 달라지는 UI는 Page 가까이에 두고, 반복되는 것이 확인된 작은 UI나 Headless 동작만 `shared/ui`로 옮기고 있습니다.

<!-- TODO: Entity UI를 사용했다가 변경이 어려웠던 실제 컴포넌트 사례를 추가합니다. -->

---

### 모델을 분리할수록 매퍼가 늘어났습니다

UI를 어디에 둘지 정리한 뒤에는 데이터가 섞여 생기는 문제를 개선하기 위해 모델의 경계도 검토했습니다. 서버 응답과 프론트엔드 전반에서 사용하는 모델, 특정 화면에 필요한 데이터는 서로 다른 형태를 가질 수 있습니다. 처음에는 DTO, Model, ViewModel을 차례로 분리하면 각 단계의 역할이 분명해질 것으로 봤습니다.

```text
Server
  ↓
DTO
  ↓ Mapper
Domain Model
  ↓ Mapper
ViewModel
  ↓
View
```

DTO와 Model 사이의 변환은 필요성을 설명하기 쉬웠습니다. 문자열 날짜를 `Date`로 바꾸고, 알 수 없는 상태값을 걸러 내고, 서버의 필드명을 프론트엔드에서 쓰는 이름으로 바꿀 수 있습니다. TypeScript 타입만으로는 런타임 응답을 검증할 수 없으니 Zod 스키마도 이 경계에 두었습니다.

```ts
const orderResponseSchema = z.object({
  order_id: z.string(),
  status: z.enum(['PENDING', 'PAID', 'CANCELED']),
});

type OrderResponse = z.infer<typeof orderResponseSchema>;
```

Model과 ViewModel 사이의 매퍼는 달랐습니다. 이미 검증한 값을 화면에 맞춘다는 이유로 타입과 매퍼, 테스트를 매번 추가하자 화면 하나에 딸린 코드가 빠르게 늘었습니다.

예를 들어 전체 User 모델에 `id`, `name`, `phone`이 있고 특정 화면에서는 `name`과 `phone`만 사용할 수 있습니다.

```ts
interface User {
  id: string;
  name: string;
  phone: string;
}

type UserContact = Pick<User, 'name' | 'phone'>;
```

필드 일부만 필요하다면 새 객체를 만드는 매퍼 없이 Props 타입이나 Selector로 범위를 좁힐 수 있습니다. 여러 값을 합친 파생 데이터는 사용하는 Feature나 Page 가까이에 순수 함수로 두면 됐습니다. 로딩이나 선택 여부처럼 UI에만 필요한 상태는 컴포넌트나 커스텀 훅이 다뤘습니다.

화면에서 여러 값을 조합하면 변환 로직은 생깁니다. 그렇더라도 모든 화면에 별도의 ViewModel 계층을 만들 필요는 없다고 생각합니다. 복잡한 화면 상태를 하나의 모델로 설명해야 할 때는 ViewModel이 유용하지만, 일부 필드만 선택하는 화면까지 같은 단계를 거칠 이유는 없었습니다.

### ViewModel은 표현 방법을 결정하지 않습니다

ViewModel에서 금액을 미리 포맷한 적이 있습니다.

```ts
return {
  formattedTotal: `${total.toLocaleString()}원`,
};
```

이후 숫자와 `원`의 글꼴을 다르게 보여 달라는 요구사항이 들어왔습니다. 숫자와 단위를 문자열 하나로 합쳐 둔 탓에 View에서 둘을 나누기 어려웠습니다.

```tsx
<span className="text-xl">{total.toLocaleString()}</span>
<span className="text-sm">원</span>
```

합계를 계산하는 일과 합계를 보여 주는 일은 나눠야 했습니다. UI가 달라져도 유지되는 계산 규칙은 모델이나 도메인 로직에 둘 수 있습니다. 단위를 어느 태그에 넣고 어떤 서식을 쓸지는 View가 결정할 일입니다.

여러 화면이 같은 숫자 표기 규칙을 쓴다면 포맷터는 공유할 수 있습니다. 다만 포맷터가 마크업에서 나눠야 할 경계까지 합쳐 버리면 작은 디자인 변경에도 다시 모델을 건드리게 됩니다.

---

### 하나의 모델에 모든 필드를 넣어야 할까

모델의 범위도 비슷했습니다. 앱에 User 타입이 하나 있다고 해서 모든 화면이 같은 User를 필요로 하지는 않았습니다.

```ts
interface User {
  id: string;
  name: string;
  phone: string;
}
```

어떤 화면은 `name`과 `phone`만 사용합니다. 그렇다고 `UserForProfile`, `UserForOrder`, `UserForList`처럼 화면마다 타입을 만들면 이름만 다른 타입이 쌓입니다. 반대로 모든 필드를 User 하나에 모으면 화면이 필요하지 않은 정보와 변경까지 알게 됩니다.

여기서 필드의 모양보다 의미가 더 중요했습니다. User와 주문자는 이름과 전화번호를 똑같이 가져도 같은 모델이 아닙니다. User는 현재 회원 정보이고, 주문자는 주문 시점의 정보를 보존한 스냅샷입니다. 회원의 전화번호가 바뀌었다고 과거 주문의 주문자 정보까지 바뀌면 안 됩니다.

```ts
interface User {
  id: string;
  name: string;
  phone: string;
}

interface Orderer {
  name: string;
  phone: string;
}
```

`Orderer = Pick<User, 'name' | 'phone'>`으로 연결하면 코드 중복은 줄지만 User의 변경이 Order까지 전파됩니다. 이 경우에는 필드 중복을 받아들이고 각 맥락의 타입을 따로 두는 쪽을 택했습니다.

그래서 모델의 범위는 필드의 개수보다 데이터가 사용되는 맥락을 기준으로 정했습니다. 화면마다 새로운 모델을 만들지는 않지만, 서로 다른 시점과 규칙을 나타내는 데이터는 필드 구성이 같더라도 별도의 타입으로 두고 있습니다.

### 같은 Enum을 여러 Entity가 사용한다면

Enum을 어디에 둘지 정할 때도 모양이 같다는 이유에 자주 끌렸습니다. `OrderStatus`가 주문 조회뿐 아니라 활동 내역과 대시보드 응답에도 들어오면 `shared`로 옮기고 싶어집니다.

하지만 서버가 같은 문자열을 내려주는 것과 프론트엔드에서 같은 의미로 다루는 것은 다른 일입니다. 주문 화면은 `PENDING`, `PAID`, `CANCELED`를 모두 구분해도 활동 내역에는 완료 여부만 필요할 수 있습니다. 한쪽에만 상태가 추가되는 순간 공통 Enum은 관계없는 맥락까지 함께 바꿉니다.

Enum의 위치도 몇 곳에서 사용하는지가 아니라 어떤 도메인의 상태를 표현하는지를 기준으로 정했습니다.

- 주문의 생명주기를 설명하는 상태는 Order가 소유합니다.
- 언어, 통화처럼 특정 도메인에 속하지 않는 값은 `shared`에 둘 수 있습니다.
- 값이 우연히 같지만 의미가 다르면 각 맥락에 타입을 따로 정의합니다.
- 자동 생성한 API 타입은 도메인 모델이 아니라 서버 계약으로 취급합니다.

나중에 다른 곳에서도 쓸 가능성만으로 처음부터 `shared`에 올리지는 않습니다. 두 번째 사용처가 생겼을 때 두 값의 의미까지 같은지 확인한 뒤 옮겨도 늦지 않았습니다.

---

### API는 한곳에 모아야 관리하기 쉬울까

TanStack Query를 붙이면서 API 폴더도 여러 Layer로 흩어졌습니다. 사용자 조회는 `entities/user/api`에, 여러 도메인을 조합하는 결제 Mutation은 `features/checkout/api`에, 대시보드 전용 응답은 `pages/dashboard/api`에 둘 수 있었습니다.

```text
shared/api/          # HTTP 클라이언트와 공통 설정
entities/user/api/   # 사용자 데이터 조회
features/checkout/api/ # 결제 유스케이스
pages/dashboard/api/  # 화면 전용 집계 응답
```

관련 코드 옆에 API를 두면 기능을 고치거나 지울 때 함께 살필 범위가 보입니다. 대신 특정 엔드포인트가 어디에서 호출되는지 찾으려면 여러 레이어를 확인해야 합니다.

`GET`은 Entity, `POST`는 Feature처럼 HTTP 메서드로 나눠 보기도 했지만 오래 가지 못했습니다. 비밀번호 변경은 `PATCH`여도 User에 속할 수 있고, 대시보드 조회는 `GET`이어도 여러 도메인을 조합한 화면 전용 API일 수 있습니다. 명사와 동사만으로도 실제 사용 맥락을 설명하기 어려웠습니다.

현재는 응답 형태보다 API가 어떤 목적으로 사용되고 어떤 코드와 함께 변경되는지를 기준으로 보고 있습니다. 한 도메인의 여러 화면에서 같은 의미로 사용하는 API는 Entity 가까이에 둡니다. 특정 행동을 완료하기 위한 API는 Feature에, 한 화면만을 위한 집계 API는 Page에 둘 수 있습니다. HTTP 클라이언트와 인증, 공통 오류 처리는 `shared/api`가 맡습니다.

API의 위치를 정하면서 서버 상태를 어디에 보관할지도 같은 기준으로 살펴봤습니다. 여러 화면에서 사용하는 데이터라도 서버에서 가져온 값은 TanStack Query의 캐시로 공유합니다. 같은 데이터를 Zustand에 다시 저장하면 원본이 두 곳이 되고, 어느 값을 최신 상태로 볼지 동기화해야 하기 때문입니다. Zustand는 여러 컴포넌트가 함께 변경해야 하는 클라이언트 상태를 관리할 때 사용하고 있습니다.

<!-- TODO: 실제 프로젝트에서 TanStack Query와 Zustand가 중복됐던 사례가 있다면 추가합니다. -->

### 클래스와 순수 함수 중 무엇이 모델에 적합할까

도메인 모델에 행위를 붙이려면 클래스가 자연스러워 보였습니다. React의 상태 갱신은 불변 데이터와 함수형 API를 중심으로 돌아갑니다. 클래스 인스턴스의 내부 값만 바꾸면 React가 참조 변화를 알아차리지 못할 수 있었습니다.

불변 클래스를 만들 수도 있지만 인터페이스와 순수 함수의 조합이 React 코드에는 더 익숙했습니다.

```ts
interface Cart {
  items: CartItem[];
}

function changeQuantity(cart: Cart, itemId: string, quantity: number): Cart {
  return {
    ...cart,
    items: cart.items.map((item) =>
      item.id === itemId ? { ...item, quantity } : item,
    ),
  };
}
```

이 부분은 아직 한쪽으로 결론 내리지 못했습니다. React와 상태 관리 도구에 연결할 때는 순수 함수가 편하지만, 복잡한 규칙과 불변 조건을 객체 하나로 묶을 때는 클래스가 더 잘 읽힐 수도 있습니다.

다만 문법보다 먼저 지키려는 선은 있습니다. 도메인 규칙이 React Hook이나 API 클라이언트, 라우터를 직접 참조하지 않게 만드는 것입니다. 이 선 안에서는 모델의 복잡도와 팀의 익숙함에 따라 클래스와 순수 함수 중 하나를 고를 수 있다고 봅니다.

---

## 고민 끝에 선택한 주문 코드 구조

앞에서 정리한 고민을 주문 영역에 적용할 때는 FSD의 폴더를 먼저 만들지 않았습니다. 주문 상태와 상세 화면을 수정하면서 실제로 함께 바뀌는 코드를 확인한 뒤 경계를 나눴습니다. 지금은 Next.js 라우트, 화면 조합, 주문을 확인하는 흐름, 화면과 무관한 주문 규칙을 각각 다른 레이어에서 관리하고 있습니다.

```text
app/(order)/orders/[orderId]/
├── page.tsx
├── auth/page.tsx
└── detail/page.tsx

src/
├── views/
│   ├── order-status/
│   ├── order-auth/
│   └── order-detail/
├── features/order/
│   ├── hooks/
│   ├── ui/
│   │   ├── order-status-page/
│   │   ├── order-auth-page/
│   │   └── order-detail-page/
│   └── utils/
├── entities/
│   ├── order/
│   ├── payment/
│   └── discount/
└── shared/
    ├── api/
    └── ui/
```

### `app`은 라우팅만 담당합니다

App Router의 `page.tsx`에는 주문 로직을 두지 않았습니다. URL에서 주문 식별자를 읽고 알맞은 View에 전달하는 것이 전부입니다.

```tsx
export default async function OrderStatusRoute({ params }: RouteProps) {
  const { orderId } = await params;

  return <OrderStatusView orderIdentifier={orderId} />;
}
```

`views/order-status`는 전역 헤더와 푸터, 주문 인증 가드, 주문 상태 화면을 조합합니다. 데이터를 조회하거나 주문 상태를 해석하지는 않습니다. Next.js의 라우트와 주문 Feature 사이에서 한 화면의 바깥 구조만 완성합니다. 역할로 보면 FSD의 Page Layer에 가깝지만, App Router의 `page.tsx`와 구분하기 위해 `views`라는 이름을 사용했습니다.

```tsx
<OrderAuthGuard orderIdentifier={orderIdentifier}>
  <OrderStatusPage orderIdentifier={orderIdentifier} />
</OrderAuthGuard>
```

처음에는 Page와 Feature가 거의 같은 코드를 가졌습니다. 지금은 라우트 하나마다 Feature를 만들지 않습니다. `views`는 라우트에 대응하지만 `features/order`는 인증, 상태 확인, 상세 조회로 이어지는 주문 경험 전체를 가집니다.

### Feature는 주문을 확인하는 흐름을 묶습니다

`features/order`에는 주문 인증, 주문 상태, 주문 상세 화면이 함께 있습니다. 각 화면의 UI뿐 아니라 TanStack Query Hook, 로딩과 오류 처리, 화면 이동, 트래킹도 이 Slice 안에서 관리합니다.

세 화면은 서로 다른 URL을 사용하지만 같은 주문을 조회하고 같은 인증 절차를 거칩니다. 상태 화면과 상세 화면은 Query Key도 공유합니다. 화면 수에 맞춰 Feature를 세 개로 나누면 인증과 조회 로직을 다시 공유할 위치가 필요했습니다. 주문 흐름 하나로 묶으니 함께 바뀌는 코드를 Slice 안에서 바로 찾을 수 있었습니다.

`features/order`라는 이름만 보면 `entities/order`와 역할이 겹쳐 보일 수 있습니다. 두 Slice는 주문이라는 같은 대상을 다루지만, 소유하는 코드가 다릅니다. Entity가 주문의 상태와 규칙을 표현한다면 Feature는 사용자가 주문을 인증하고, 처리 상태를 확인하고, 상세 내역을 살펴보는 과정을 구현합니다.

따라서 이 Feature의 경계는 재사용 횟수가 아니라 하나의 사용자 목적과 함께 변경되는 코드로 정했습니다. 인증 방식이나 주문 조회 흐름이 바뀌면 세 화면을 함께 살펴봐야 하므로 같은 Slice에 두었습니다. 반대로 주문 상태의 의미처럼 다른 흐름에서도 유지돼야 하는 규칙은 Entity로 분리했습니다.

### Entity에는 화면이 바뀌어도 유지되는 규칙을 둡니다

이 글에서 도메인은 서비스가 다루는 업무 개념과 그 개념에 적용되는 규칙을 뜻합니다. 주문, 결제, 할인 같은 개념과 주문 상태가 어떤 순서로 진행되는지, 어떤 상태를 취소로 판단하는지가 여기에 해당합니다.

비즈니스 로직이라는 표현은 이보다 넓게 사용했습니다. 주문 데이터를 조회하고, 인증 결과에 따라 화면을 이동하고, 오류 메시지를 노출하는 과정도 비즈니스 요구사항을 구현한 로직입니다. 이 가운데 특정 화면이나 React에 의존하지 않고 주문 자체에 계속 적용되는 규칙을 도메인 로직으로 구분해 Entity에 두었습니다. 화면에서 사용자를 안내하는 순서와 API 호출 시점은 Feature가 담당합니다.

`entities/order`에는 React 컴포넌트가 없습니다. 서버의 숫자 상태를 프론트엔드의 `OrderStatus`로 바꾸고, 주문 진행 단계를 계산하고, 취소 여부와 결제 결과를 판정하는 코드가 들어 있습니다.

```ts
const status = mapOrderStatus(response.status);

return {
  status,
  progressIndex: orderProgressIndex(status),
  isCanceled: isCanceledStatus(status),
};
```

이 함수들은 React Hook이나 라우터를 참조하지 않습니다. 입력을 받아 결과를 반환하므로 화면 밖에서도 같은 주문 규칙을 사용할 수 있고, 상태별 동작도 단위 테스트로 확인할 수 있습니다. 장바구니 역시 인터페이스와 불변 연산을 묶은 함수 형태로 구현했습니다. 클래스를 쓰지 않는다는 규칙을 세운 것은 아니지만, React 상태와 연결되는 모델은 우선 순수 함수로 작성했습니다.

주문 생성처럼 장바구니, 메뉴, 결제를 함께 알아야 하는 코드는 한 Entity에 밀어 넣지 않고 `features/cart`에서 최종 요청을 조립합니다. 다만 요청 필드를 변환하는 일부 코드는 아직 `entities/order`의 Mapper가 다른 Entity 타입을 참조합니다. 같은 Layer의 Slice가 서로 독립적이어야 한다는 FSD 규칙에서 벗어난 부분입니다. 이를 `shared`로 옮겨 의존성을 숨기기보다 현재는 예외로 드러내 두었고, 변환 범위가 더 커지면 Feature로 옮길 수 있습니다.

### API 통신과 화면 데이터는 Feature에서 연결합니다

HTTP 클라이언트와 서버 API Service는 `shared/api`에 모았습니다. TanStack Query를 호출하는 코드는 `features/order/hooks`에 둡니다. API Service 자체는 어느 화면에서 데이터를 쓰는지 모르고, Feature Hook이 Query Key와 조회 시점, 로딩 상태를 결정합니다.

ViewModel도 같은 위치 원칙을 따랐습니다. 주문 상태 화면은 필요한 값이 적어서 Hook 안에서 `OrderStatusSummary`를 만듭니다. 주문 상세 화면은 주문 정보, 메뉴, 할인, 결제 금액을 정해진 순서로 보여 줘야 하므로 `toOrderDetailVM`이라는 변환 함수를 Feature에 두었습니다.

```text
API Response
  ↓ shared/api
TanStack Query Hook
  ↓ features/order
OrderDetailVM
  ↓
OrderDetailPage
```

모든 화면에 ViewModel을 만들지 않고, 서버 응답만으로 UI의 구조를 설명하기 어려운 화면에만 사용했습니다. ViewModel에는 화면에 필요한 데이터의 순서와 조합을 담되, 금액과 단위를 하나의 문자열로 합치는 식으로 마크업 선택까지 고정하지 않았습니다.

이렇게 나눈 주문 영역은 FSD의 표준 구조와 조금 다릅니다. App Router의 `page.tsx`와 화면 조합 코드를 구분하기 위해 `views` 레이어를 사용했고, `features/order`도 작은 행동 여러 개로 나누지 않고 하나의 주문 확인 흐름으로 묶었습니다. 구조의 이름을 그대로 따르기보다 라우트에서 비즈니스 로직을 분리하고, 도메인 규칙을 React와 격리하며, 외부에서는 Slice의 공개 API만 참조한다는 원칙을 선택해 적용했습니다.

---

## 이 구조로 얻은 효과

구조를 바꾼 뒤에는 요구사항에 따라 어디부터 수정해야 하는지가 이전보다 분명해졌습니다. 주문 상태의 의미가 바뀌면 Entity를 먼저 확인하고, 주문 상세 화면에 표시할 정보가 바뀌면 Feature의 변환 함수와 UI를 살펴봅니다. 같은 주문을 보여 주는 화면은 TanStack Query의 캐시도 공유하게 됐습니다.

### 서버 상태 해석을 Entity로 모았습니다

서버는 주문 상태를 숫자로 내려줍니다. 이 숫자를 결제 복귀 화면과 주문 상태 화면이 각자 분기하면 같은 값을 서로 다르게 해석할 수 있습니다. 지금은 숫자를 `OrderStatus`로 바꾸고 결제 결과를 판정하는 함수를 `entities/order`에 두었습니다.

```ts
const status = mapOrderStatus(response.status);
const state = resolvePaymentReturnState(status, { code, msg });
```

주문 상태 화면과 결제 복귀 로직은 서버의 숫자를 직접 비교하지 않고 `mapOrderStatus`가 반환한 `OrderStatus`를 사용합니다. 결제 복귀 로직에서는 이 값을 다시 `completed`, `failed`, `canceled`, `in-progress` 중 하나로 해석합니다. 서버 상태 코드와 프론트엔드 상태의 대응이 바뀌면 Entity의 변환 함수와 테스트를 먼저 수정하므로, 두 사용처가 서로 다른 숫자를 기준으로 분기할 가능성이 줄었습니다.

```ts
it('결제 확인 중에는 결과를 확정하지 않습니다', () => {
  expect(resolvePaymentReturnState('PAYMENT_CHECKING', {})).toEqual({
    kind: 'in-progress',
    status: 'PAYMENT_CHECKING',
  });
});
```

React 없이 입력과 출력만 검증할 수 있다는 점도 도움이 됐습니다. 취소, 실패, 승인 대기처럼 화면에서 재현하기 번거로운 분기를 컴포넌트를 렌더링하지 않고 확인합니다.

### 상태 화면과 상세 화면이 같은 캐시를 봅니다

주문 상태와 주문 상세는 URL과 UI가 다르지만 같은 주문을 조회합니다. 두 Hook에서 같은 Query Key를 사용해 별도의 서버 상태를 만들지 않았습니다.

```ts
// useOrderStatus와 useOrderDetail이 같은 키를 사용합니다.
useQuery({
  queryKey: ['order-detail', orderIdentifier],
  queryFn: () => orderService.getOrderDetail(orderIdentifier),
});
```

상태 화면에서 받아 둔 응답은 상세 화면에서도 같은 캐시 항목으로 읽습니다. TanStack Query의 설정에 따라 상세 화면에서 다시 조회할 수는 있지만, 화면 사이에 데이터를 전달하려고 조회 결과를 Zustand나 별도 Context에 복사할 필요는 없습니다.

### 화면용 변환이 컴포넌트 밖으로 나왔습니다

주문 상세 화면은 서버 응답 하나만 보여 주지 않습니다. 주문 정보와 메뉴, 할인 설정, 결제 금액을 합쳐 여러 영역을 만들어야 합니다. 이 조합을 JSX 안에서 처리하지 않고 `toOrderDetailVM`으로 분리했습니다.

```ts
const detail = data
  ? toOrderDetailVM(
      data,
      DiscountMapper.toStoreDiscounts(store?.discounts ?? []),
    )
  : null;
```

컴포넌트는 변환이 끝난 데이터를 각 영역에 전달합니다.

```tsx
<OrderInformationList rows={detail.information} />
<OrderMenuList menus={detail.menus} />
<OrderPaymentSummary payment={detail.payment} />
```

서버 필드와 할인 계산을 따라가야 할 때는 Feature의 변환 함수를 보고, 화면 배치를 바꿀 때는 UI 폴더를 봅니다. 모든 화면에 ViewModel 계층을 추가하지 않아도 복잡한 화면에서만 이 경계를 사용할 수 있었습니다.

이 구조를 적용했다고 파일 수가 줄어들지는 않았습니다. 대신 주문 상태를 판단하는 코드는 Entity에서, 화면에 필요한 데이터를 조합하는 코드는 Feature에서, 전역 레이아웃을 구성하는 코드는 View에서 찾을 수 있습니다. 수정하려는 요구사항에 따라 확인할 시작점이 정해졌다는 것이 주문 영역에서 확인한 가장 큰 변화였습니다.

---

## 사실, 가장 중요한 것은 팀의 방향입니다

FSD의 Layer와 Slice는 코드의 위치를 이야기할 때 쓸 수 있는 공통 언어입니다. 하지만 같은 디렉터리 구조를 만들었다고 같은 방식으로 일하게 되는 것은 아니었습니다. Feature의 크기와 Entity의 책임을 팀원마다 다르게 이해하면 비슷한 코드가 서로 다른 Layer에 놓입니다.

누군가는 두 화면에서 쓰는 타입을 바로 `shared`로 옮기고, 누군가는 도메인의 의미가 남아 있다는 이유로 Entity에 둡니다. 같은 API도 Entity 조회로 볼 수 있고 특정 화면의 유스케이스로 볼 수 있습니다. 이 차이를 합의하지 않으면 새 코드를 추가할 때 기존 구조를 참고하는 대신, 앞선 작성자의 의도를 추측하게 됩니다.

Lint 규칙을 추가하면 Layer를 거꾸로 참조하는 코드는 잡을 수 있습니다. 그러나 `OrderStatus`의 주인이 Order인지 `shared`인지, `apply-coupon`이 독립된 Feature인지 결제 Page의 일부인지는 도구가 판단하지 못합니다. Feature를 분리하는 신호, Entity가 소유할 모델과 UI의 범위, `shared`로 옮길 조건은 결국 팀이 정해야 합니다. 기준이 달라졌다면 기존 코드를 옮기고 문서와 코드 리뷰에도 반영해야 합니다.

돌아보면 FSD의 장점은 폴더 이름만 맞춘다고 얻어지지 않았습니다. 팀원 모두가 Feature를 나누는 기준과 Entity가 맡을 규칙, Layer 사이의 의존 방향을 같은 방식으로 이해해야 새 코드가 들어갈 위치를 예상할 수 있습니다. 코드 리뷰에서도 같은 기준으로 경계를 확인할 수 있을 때 변경 범위가 조금씩 안정됐고, 그때부터 FSD를 도입하며 기대했던 효과도 실제 개발 과정에서 확인할 수 있었습니다.

## 참고 자료

- [Feature-Sliced Design 한국어 문서: Overview](https://fsd.how/kr/docs/get-started/overview/)
- [Feature-Sliced Design: Layers](https://feature-sliced.design/docs/reference/layers)
- [Feature-Sliced Design: Public API](https://feature-sliced.design/docs/reference/public-api)
