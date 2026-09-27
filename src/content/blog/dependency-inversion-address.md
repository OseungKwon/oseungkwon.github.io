---
title: '초기 구현에서 시작한 단계별 리팩터링'
description: '배송지 입력 예제에서 카카오 주소 검색 SDK와 배송 가능 지역 판단이 컴포넌트에 섞이는 과정을 따라가며, 책임과 의존 방향을 차례로 정리합니다.'
pubDate: '2026.08.04'
category: 'tech'
tags:
  ['React', 'TypeScript', '의존성 역전', '리팩터링', '아키텍처', '프론트엔드']
---

> **글을 시작하기 전에**
> 이 글은 신입 개발자였던 과거의 제가 짰을 법한 코드를 지금의 관점으로 다시 고쳐 보면 재미있겠다는 생각에서 시작했습니다. 이를 위해 AI와 함께 가상의 요구사항과 초기 코드를 구성했습니다. AI는 출발점을 만드는 데 활용했고, 문제를 찾고 각 단계의 개선 방향과 최종 구조를 결정하는 과정은 제가 직접 진행했습니다.

가상의 요구사항은 주소 검색 버튼으로 카카오 우편번호 서비스를 열고, 사용자가 선택한 주소가 배송 가능 지역인지 확인하는 기능입니다. 요구사항만 놓고 보면 이 정도 구현으로 충분해 보입니다.

하지만 막상 코드를 작성해 보니 컴포넌트 안에 UI 상태와 카카오 SDK 응답 처리, 배송 가능 지역을 판단하는 규칙, API 호출이 모두 섞여 있었습니다. 이 글에서는 당시의 제가 작성했을 법한 코드에서 출발해 책임과 타입, 의존 방향을 차례로 정리해 보겠습니다.

## 처음 받은 요구사항

이때 처음 설정한 요구사항은 다음과 같습니다.

- 사용자가 주소 검색 버튼을 누르면 카카오 우편번호 서비스를 엽니다.
- 사용자가 선택한 우편번호, 도로명 주소, 지번 주소를 배송지 입력란에 반영합니다.
- 법정동과 건물명은 도로명 주소의 참고 항목으로 함께 표시합니다.
- 사용자가 상세 주소를 직접 입력할 수 있어야 합니다.
- 선택한 우편번호로 배송 가능 지역 API를 호출합니다.
- 배송할 수 없는 지역이면 오류 메시지를 표시합니다.
- 배송 가능한 지역이면 추가 배송비를 포함한 최종 배송지를 상위 폼에 전달합니다.

이 시점에는 다른 주소 검색 서비스로 교체할 가능성보다, 한 화면에서 요구사항을 빠르게 구현하는 일이 우선이었다고 가정했습니다.

## 과거의 나라면 어떻게 짰을까

[카카오 우편번호 서비스](https://postcode.map.kakao.com/guide)는 사용자가 주소를 선택하면 `zonecode`, `roadAddress`, `jibunAddress`, `buildingName` 등의 값을 콜백으로 전달합니다. 처음 구현할 때는 이 콜백을 컴포넌트 안에서 바로 처리하는 방식이 가장 먼저 떠오릅니다.

`DeliveryAddressField.tsx`

```tsx
type Props = {
  onChange: (address: any) => void;
};

export function DeliveryAddressField({ onChange }: Props) {
  const [address, setAddress] = useState<any>(null);
  const [detailAddress, setDetailAddress] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  function handleFindAddress() {
    new window.kakao.Postcode({
      oncomplete: async (data: any) => {
        setIsChecking(true);
        setError('');

        const baseAddress = data.roadAddress || data.address;
        const extraAddress = [data.bname, data.buildingName]
          .filter(Boolean)
          .join(', ');
        const roadAddress = extraAddress
          ? `${baseAddress} (${extraAddress})`
          : baseAddress;

        try {
          const response = await fetch(
            `/api/delivery/areas?postalCode=${data.zonecode}`,
          );
          const deliveryArea: any = await response.json();

          if (!deliveryArea.available) {
            setError('배송할 수 없는 지역입니다.');
            return;
          }

          const selectedAddress = {
            postalCode: data.zonecode,
            roadAddress,
            lotAddress: data.jibunAddress,
            buildingName: data.buildingName,
            detailAddress,
            extraDeliveryFee: deliveryArea.extraFee,
          };

          setAddress(selectedAddress);
          onChange(selectedAddress);
        } finally {
          setIsChecking(false);
        }
      },
    }).open();
  }

  return (
    <div>
      <button onClick={handleFindAddress} disabled={isChecking}>
        주소 검색
      </button>

      <input value={address?.roadAddress ?? ''} readOnly />
      <input
        value={detailAddress}
        onChange={(event) => {
          const nextDetailAddress = event.target.value;
          setDetailAddress(nextDetailAddress);

          if (address) {
            const nextAddress = {
              ...address,
              detailAddress: nextDetailAddress,
            };

            setAddress(nextAddress);
            onChange(nextAddress);
          }
        }}
        placeholder="상세 주소"
      />

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

컴포넌트 하나가 다음 책임을 모두 가지고 있습니다.

- 주소 검색 위젯을 실행합니다.
- 카카오 응답을 서비스에서 사용하는 주소로 변환합니다.
- 배송 가능 지역 API를 호출합니다.
- 배송 가능 여부를 판단합니다.
- 선택한 주소와 오류 상태를 화면에 표시합니다.

그 결과 카카오 응답 필드나 배송 가능 조건 중 어느 하나만 바뀌어도 React 컴포넌트를 수정해야 합니다. 테스트할 때도 `window.kakao`와 `fetch`를 모두 준비해야 하므로 배송지 선택 규칙만 따로 검증하기 어렵습니다.

---

## 첫 번째 개선: 책임부터 분리하기

가장 먼저 UI, 배송지 선택 규칙, 주소 검색 SDK, API 호출을 서로 다른 모듈로 분리했습니다. 아직 동작을 바꾸는 단계는 아니므로 기존 조건과 데이터 구조는 유지하고, 변경 이유가 다른 코드의 위치만 나눴습니다.

> **책임의 분리란?**
> 서로 다른 이유로 변경되는 코드를 각각의 모듈로 나누는 것입니다.

### UI는 사용자 상호작용만 처리합니다

컴포넌트에는 주소 검색 버튼과 입력 상태만 남깁니다.

`DeliveryAddressField.tsx`

```tsx
import { selectDeliveryAddress } from './selectDeliveryAddress';

export function DeliveryAddressField({ onChange }: Props) {
  const [address, setAddress] = useState<any>(null);
  const [detailAddress, setDetailAddress] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  async function handleFindAddress() {
    setIsSearching(true);
    setError('');

    try {
      const selectedAddress = await selectDeliveryAddress();

      if (selectedAddress) {
        const nextAddress = {
          ...selectedAddress,
          detailAddress,
        };

        setAddress(nextAddress);
        onChange(nextAddress);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '주소 검색에 실패했습니다.',
      );
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div>
      <button onClick={handleFindAddress} disabled={isSearching}>
        주소 검색
      </button>

      <input value={address?.roadAddress ?? ''} readOnly />
      <input
        value={detailAddress}
        onChange={(event) => {
          const nextDetailAddress = event.target.value;
          setDetailAddress(nextDetailAddress);

          if (address) {
            const nextAddress = {
              ...address,
              detailAddress: nextDetailAddress,
            };

            setAddress(nextAddress);
            onChange(nextAddress);
          }
        }}
        placeholder="상세 주소"
      />

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

이제 컴포넌트는 주소 검색 SDK나 배송 가능 지역 API를 알지 않고, 검색을 시작하고 결과를 화면에 반영하는 사용자 상호작용만 담당합니다.

### 배송지 선택 규칙을 함수로 옮깁니다

주소를 선택한 뒤 배송 가능 지역을 확인하는 흐름은 애플리케이션 함수인 `selectDeliveryAddress`로 옮겼습니다.

`selectDeliveryAddress.ts`

```ts
import { getDeliveryArea } from './deliveryAreaApi';
import { findAddressWithKakao } from './kakaoPostcode';

export async function selectDeliveryAddress() {
  const result = await findAddressWithKakao();

  if (!result) {
    return null;
  }

  const deliveryArea = await getDeliveryArea(result.zonecode);

  if (!deliveryArea.available) {
    throw new Error('배송할 수 없는 지역입니다.');
  }

  const baseAddress = result.roadAddress || result.address;
  const extraAddress = [result.bname, result.buildingName]
    .filter(Boolean)
    .join(', ');
  const roadAddress = extraAddress
    ? `${baseAddress} (${extraAddress})`
    : baseAddress;

  return {
    postalCode: result.zonecode,
    roadAddress,
    lotAddress: result.jibunAddress,
    buildingName: result.buildingName,
    extraDeliveryFee: deliveryArea.extraFee,
  };
}
```

### 외부 의존성을 별도 모듈로 옮깁니다

카카오 위젯은 콜백 기반이므로, 애플리케이션 함수에서 사용하기 쉽도록 `Promise`로 감쌉니다.

`kakaoPostcode.ts`

```ts
export function findAddressWithKakao(): Promise<any | null> {
  return new Promise((resolve) => {
    new window.kakao.Postcode({
      oncomplete: resolve,
      onclose: () => resolve(null),
    }).open();
  });
}
```

같은 이유로 배송 가능 지역을 조회하는 `fetch`도 API 모듈로 옮깁니다.

`deliveryAreaApi.ts`

```ts
export async function getDeliveryArea(postalCode: string): Promise<any> {
  const response = await fetch(
    `/api/delivery/areas?postalCode=${encodeURIComponent(postalCode)}`,
  );

  return response.json();
}
```

첫 번째 개선을 마치면 각 모듈의 변경 이유가 나뉩니다.

| 모듈                    | 담당하는 변경                  |
| ----------------------- | ------------------------------ |
| `DeliveryAddressField`  | 입력 UI와 검색 상태            |
| `selectDeliveryAddress` | 배송지 선택 순서와 검증 규칙   |
| `kakaoPostcode`         | 카카오 우편번호 서비스 연동    |
| `deliveryAreaApi`       | 배송 가능 지역 API 요청과 응답 |

컴포넌트의 크기는 줄었지만 `selectDeliveryAddress`는 여전히 카카오 함수와 배송 지역 API를 직접 가져오며, `any`도 모듈 사이를 그대로 이동합니다. 즉, 책임을 나눴을 뿐 타입 안정성과 의존 방향은 아직 개선되지 않았습니다.

---

## 두 번째 개선: `any`를 제거하며 도메인 분리하기

현재 `selectDeliveryAddress`는 카카오 응답의 `zonecode`와 `roadAddress`를 직접 사용합니다. 반환 타입도 `any`이므로 필드 이름을 잘못 적어도 컴파일 단계에서 확인할 수 없습니다.

`selectDeliveryAddress.ts`

```ts
const result = await findAddressWithKakao();

// 오타가 있어도 result가 any라서 오류가 발생하지 않습니다.
const postalCode = result.zoneCode;
```

카카오 응답 타입을 정의하면 필드명의 오타는 막을 수 있지만, 애플리케이션 함수는 여전히 `zonecode`라는 외부 SDK의 언어에 의존합니다. 이 결합까지 끊으려면 외부 데이터와 서비스 내부에서 사용하는 주소를 구분해야 하므로, 먼저 도메인 모델을 정의합니다.

### 주소를 서비스의 언어로 정의합니다

카카오가 어떤 이름으로 값을 반환하는지와 관계없이, 배송 기능에는 우편번호와 도로명 주소가 필요합니다.

`address.ts`

```ts
export interface Address {
  postalCode: string;
  roadAddress: string;
  lotAddress?: string;
  buildingName?: string;
}

export interface DeliverableAddress extends Address {
  extraDeliveryFee: number;
}

export interface DeliveryAddress extends DeliverableAddress {
  detailAddress: string;
}

export interface DeliveryArea {
  available: boolean;
  extraFee: number;
}
```

주소 검색 결과는 `Address`로 표현합니다. 배송 가능 여부를 확인한 결과에는 추가 배송비가 필요하므로 `DeliverableAddress`를 사용하고, UI에서 사용자가 입력한 상세 주소까지 더한 최종 값은 `DeliveryAddress`로 표현합니다.

`DeliveryAddressField.tsx`

```tsx
const deliveryAddress: DeliveryAddress = {
  ...selectedAddress,
  detailAddress,
};

onChange(deliveryAddress);
```

### 카카오 응답은 어댑터에서 변환합니다

카카오의 데이터 구조는 SDK 모듈 안에서만 관리하고, `zonecode`를 `postalCode`로 바꾸는 작업도 이 경계에서 처리합니다.

`kakaoPostcode.ts`

```ts
import type { Address } from './address';

interface KakaoPostcodeResult {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  bname: string;
  buildingName: string;
}

function toAddress(result: KakaoPostcodeResult): Address {
  const baseAddress = result.roadAddress || result.address;
  const extraAddress = [result.bname, result.buildingName]
    .filter(Boolean)
    .join(', ');

  return {
    postalCode: result.zonecode,
    roadAddress: extraAddress
      ? `${baseAddress} (${extraAddress})`
      : baseAddress,
    lotAddress: result.jibunAddress || undefined,
    buildingName: result.buildingName || undefined,
  };
}

export function findAddressWithKakao(): Promise<Address | null> {
  return new Promise((resolve) => {
    new window.kakao.Postcode({
      oncomplete: (result: KakaoPostcodeResult) => {
        resolve(toAddress(result));
      },
      onclose: () => resolve(null),
    }).open();
  });
}
```

이렇게 변환하면 애플리케이션에는 카카오 필드명이 전달되지 않습니다. 카카오 SDK의 응답이 변경되더라도 `KakaoPostcodeResult`와 `toAddress`만 수정하면 됩니다.

### API 응답도 도메인 모델로 변환합니다

배송 가능 지역 API의 응답 형식도 API 모듈 밖으로 전달하지 않습니다.

`deliveryAreaApi.ts`

```ts
import type { DeliveryArea } from './address';

interface DeliveryAreaResponse {
  isAvailable: boolean;
  extraDeliveryFee: number;
}

export async function getDeliveryArea(
  postalCode: string,
): Promise<DeliveryArea> {
  const response = await fetch(
    `/api/delivery/areas?postalCode=${encodeURIComponent(postalCode)}`,
  );

  if (!response.ok) {
    throw new Error('배송 가능 지역을 확인하지 못했습니다.');
  }

  const result: DeliveryAreaResponse = await response.json();

  return {
    available: result.isAvailable,
    extraFee: result.extraDeliveryFee,
  };
}
```

`selectDeliveryAddress`는 외부 SDK나 API의 필드 대신 도메인 모델만 사용합니다.

`selectDeliveryAddress.ts`

```ts
import type { DeliverableAddress } from './address';
import { getDeliveryArea } from './deliveryAreaApi';
import { findAddressWithKakao } from './kakaoPostcode';

export async function selectDeliveryAddress(): Promise<DeliverableAddress | null> {
  const address = await findAddressWithKakao();

  if (!address) {
    return null;
  }

  const deliveryArea = await getDeliveryArea(address.postalCode);

  if (!deliveryArea.available) {
    throw new Error('배송할 수 없는 지역입니다.');
  }

  return {
    ...address,
    extraDeliveryFee: deliveryArea.extraFee,
  };
}
```

타입과 데이터의 경계는 정리됐지만 의존성은 여전히 그대로입니다. 상위 수준의 배송지 선택 함수가 `findAddressWithKakao`와 `getDeliveryArea`라는 구체적인 구현을 직접 가져오기 때문입니다.

---

## 세 번째 개선: 주소 검색 구현에 대한 의존성 역전하기

입점사 전용 페이지에서는 카카오 우편번호 서비스 대신 파트너사가 제공하는 주소 검색 SDK를 사용해야 한다는 요구사항이 추가됐다고 가정해 보겠습니다. 현재 구조에 조건문을 추가하면 배송지 선택 함수가 두 SDK를 모두 알게 됩니다.

`selectDeliveryAddress.ts`

```ts
const address =
  provider === 'partner'
    ? await findAddressWithPartnerSdk()
    : await findAddressWithKakao();
```

이 구조에서는 주소 검색 구현이 늘어날 때마다 배송지 선택 규칙까지 수정해야 합니다. 조건문 자체보다 더 중요한 문제는 의존 방향입니다. 배송지 선택이라는 상위 수준의 기능이 카카오와 파트너 SDK라는 하위 수준의 구현을 직접 선택하고 있기 때문입니다.

> **의존성 역전이란?**
> 상위 수준의 정책과 하위 수준의 구현이 모두 애플리케이션이 정의한 추상화에 의존하도록 만드는 것입니다.

### 애플리케이션이 필요한 계약을 정의합니다

배송지 선택 함수는 카카오 SDK 자체가 아니라, 어떤 구현을 사용하든 사용자가 고른 주소를 `Address`로 돌려받을 수 있는 기능에만 의존하면 됩니다. 배송 가능 지역 조회도 마찬가지로 구체적인 HTTP 요청 대신, 우편번호로 `DeliveryArea`를 가져오는 기능으로 표현할 수 있습니다.

`deliveryAddressPorts.ts`

```ts
import type { Address, DeliveryArea } from './address';

export interface AddressFinder {
  find(): Promise<Address | null>;
}

export interface DeliveryAreaReader {
  findByPostalCode(postalCode: string): Promise<DeliveryArea>;
}
```

두 인터페이스는 카카오 SDK나 HTTP 같은 구현 정보를 드러내지 않고, 애플리케이션이 배송지를 선택하는 데 필요한 동작만 정의합니다.

### 배송지 선택 함수는 계약을 주입받습니다

이제 구체적인 함수를 직접 가져오는 대신, 팩토리 함수가 필요한 의존성을 일반 객체로 받도록 변경합니다.

`createSelectDeliveryAddress.ts`

```ts
import type { DeliverableAddress } from './address';
import type { AddressFinder, DeliveryAreaReader } from './deliveryAddressPorts';

interface Dependencies {
  addressFinder: AddressFinder;
  deliveryAreaReader: DeliveryAreaReader;
}

export function createSelectDeliveryAddress({
  addressFinder,
  deliveryAreaReader,
}: Dependencies) {
  return async function selectDeliveryAddress(): Promise<DeliverableAddress | null> {
    const address = await addressFinder.find();

    if (!address) {
      return null;
    }

    const deliveryArea = await deliveryAreaReader.findByPostalCode(
      address.postalCode,
    );

    if (!deliveryArea.available) {
      throw new Error('배송할 수 없는 지역입니다.');
    }

    return {
      ...address,
      extraDeliveryFee: deliveryArea.extraFee,
    };
  };
}
```

이제 이 함수는 주소가 어느 SDK에서 왔는지, 배송 가능 지역을 `fetch`로 조회하는지 알지 않은 채 배송지 선택 규칙만 수행합니다.

이 정도 규모에서는 클래스나 DI 컨테이너 없이도 충분합니다. 함수가 필요한 객체를 인자로 받고 애플리케이션의 시작 지점에서 구현을 한 번 연결하면, 함수형 코드에서도 의존성을 명시적으로 주입할 수 있습니다.

### 카카오와 파트너 SDK는 같은 계약을 따릅니다

앞에서 작성한 카카오 함수를 `AddressFinder` 객체로 감쌉니다. `satisfies`를 사용하면 객체의 구체적인 타입은 유지하면서 계약을 충족하는지 확인할 수 있습니다.

`kakaoAddressFinder.ts`

```ts
import type { AddressFinder } from './deliveryAddressPorts';
import { findAddressWithKakao } from './kakaoPostcode';

export const kakaoAddressFinder = {
  find: findAddressWithKakao,
} satisfies AddressFinder;
```

파트너 SDK가 `zipCode`와 `primaryAddress`를 반환한다면 어댑터에서 `Address`로 변환합니다.

`partnerAddressFinder.ts`

```ts
import type { AddressFinder } from './deliveryAddressPorts';

export const partnerAddressFinder = {
  async find() {
    const result = await window.partnerAddress.open();

    if (!result) {
      return null;
    }

    return {
      postalCode: result.zipCode,
      roadAddress: result.primaryAddress,
      lotAddress: result.secondaryAddress || undefined,
      buildingName: result.building || undefined,
    };
  },
} satisfies AddressFinder;
```

배송 가능 지역 API도 애플리케이션이 정의한 계약을 구현합니다.

`deliveryAreaApi.ts`

```ts
import type { DeliveryAreaReader } from './deliveryAddressPorts';

export const deliveryAreaApi = {
  async findByPostalCode(postalCode) {
    const response = await fetch(
      `/api/delivery/areas?postalCode=${encodeURIComponent(postalCode)}`,
    );

    if (!response.ok) {
      throw new Error('배송 가능 지역을 확인하지 못했습니다.');
    }

    const result: DeliveryAreaResponse = await response.json();

    return {
      available: result.isAvailable,
      extraFee: result.extraDeliveryFee,
    };
  },
} satisfies DeliveryAreaReader;
```

### 애플리케이션 경계에서 구현을 선택합니다

어떤 주소 검색 구현을 사용할지는 배송지 선택 함수가 아닌 애플리케이션의 **의존성 조립 지점**(Composition Root)에서 결정합니다. 의존성 조립 지점은 사용할 구체적인 구현을 선택하고 서로 연결하는 모듈입니다. 따라서 입점사 빌드에는 파트너 SDK를, 일반 서비스에는 카카오 구현을 주입할 수 있습니다.

`selectDeliveryAddress.ts`

```ts
import { createSelectDeliveryAddress } from './createSelectDeliveryAddress';
import { deliveryAreaApi } from './deliveryAreaApi';
import { kakaoAddressFinder } from './kakaoAddressFinder';
import { partnerAddressFinder } from './partnerAddressFinder';

const addressFinder =
  import.meta.env.PUBLIC_ADDRESS_PROVIDER === 'partner'
    ? partnerAddressFinder
    : kakaoAddressFinder;

export const selectDeliveryAddress = createSelectDeliveryAddress({
  addressFinder,
  deliveryAreaReader: deliveryAreaApi,
});
```

UI는 이전과 마찬가지로 `selectDeliveryAddress`만 가져옵니다. 구현을 선택하는 조건 자체는 남아 있지만, 배송 가능 여부를 판단하는 애플리케이션 규칙과는 분리됐습니다.

- 변경 전: `selectDeliveryAddress → findAddressWithKakao`
- 변경 후: `createSelectDeliveryAddress → AddressFinder ← kakaoAddressFinder`
- 추가 구현: `AddressFinder ← partnerAddressFinder`

실행 시점에는 여전히 선택된 SDK가 동작하지만, 소스 코드의 의존 방향은 달라졌습니다. 상위 수준의 배송지 선택 함수와 하위 수준의 SDK가 모두 `AddressFinder`라는 계약에 의존하도록 바뀐 것이 이 예제에서 적용한 의존성 역전입니다.

### 브라우저 SDK 없이 배송 규칙을 테스트합니다

의존성을 함수 인자로 받으면 테스트에서 `window.kakao`나 팝업을 준비할 필요가 없습니다.

`createSelectDeliveryAddress.test.ts`

```ts
const addressFinder: AddressFinder = {
  find: vi.fn().mockResolvedValue({
    postalCode: '13494',
    roadAddress: '경기 성남시 분당구 판교역로 235',
  }),
};

const deliveryAreaReader: DeliveryAreaReader = {
  findByPostalCode: vi.fn().mockResolvedValue({
    available: true,
    extraFee: 3_000,
  }),
};

const selectDeliveryAddress = createSelectDeliveryAddress({
  addressFinder,
  deliveryAreaReader,
});

await expect(selectDeliveryAddress()).resolves.toEqual({
  postalCode: '13494',
  roadAddress: '경기 성남시 분당구 판교역로 235',
  extraDeliveryFee: 3_000,
});
```

이 테스트에는 사용자가 선택한 주소와 배송 가능 지역 결과만 준비하면 됩니다. 카카오 응답 변환과 HTTP 응답 변환은 각각 `kakaoAddressFinder`와 `deliveryAreaApi`의 테스트에서 따로 검증할 수 있습니다.

---

## 클린 아키텍처 관점에서 다시 보기

최종 구조에서는 변경 이유에 따라 코드의 위치와 의존 방향이 나뉩니다.

![배송지 입력 기능의 최종 아키텍처 구조도](@assets/post/dependency-inversion-address/architecture.svg)

`DeliveryAddressField`는 애플리케이션 함수를 호출하고, 애플리케이션 함수는 `AddressFinder`와 `DeliveryAreaReader`에 의존합니다. 카카오·파트너·HTTP 어댑터는 이 포트를 구현하면서 외부 데이터 구조를 도메인 모델로 변환하며, 실제로 사용할 구현은 의존성 조립 지점인 `selectDeliveryAddress.ts`에서 결정합니다.

| 계층         | 구성 요소                                          | 역할                                     |
| ------------ | -------------------------------------------------- | ---------------------------------------- |
| UI           | `DeliveryAddressField`                             | 입력과 사용자 상호작용을 처리합니다.     |
| 애플리케이션 | `createSelectDeliveryAddress`                      | 주소 선택과 배송 가능 여부를 판단합니다. |
| 포트         | `AddressFinder`, `DeliveryAreaReader`              | 애플리케이션에 필요한 기능을 정의합니다. |
| 어댑터       | 카카오·파트너·HTTP 구현                            | 외부 데이터를 도메인 모델로 변환합니다.  |
| 도메인       | `Address`, `DeliverableAddress`, `DeliveryAddress` | 서비스에서 사용하는 주소를 표현합니다.   |
| 의존성 조립  | `selectDeliveryAddress.ts`                         | 사용할 구현을 선택하고 연결합니다.       |

클린 아키텍처에서 중요한 것은 폴더 이름보다 의존 방향입니다. React 컴포넌트와 외부 SDK는 바깥쪽에 있고, 배송지 선택 규칙과 도메인 모델은 안쪽에 있습니다. 안쪽 코드는 카카오 SDK나 `fetch`를 가져오지 않습니다.

## 마치며

처음에는 컴포넌트에서 카카오 팝업을 바로 여는 방식이 가장 단순해 보였습니다. 그러나 배송 가능 지역 확인과 새로운 주소 검색 구현이 추가되자, 컴포넌트와 애플리케이션 규칙이 외부 SDK의 변경에 함께 영향을 받기 시작했습니다.

이번 리팩터링에서는 다음 순서로 문제를 나눴습니다.

- UI, 배송지 선택 규칙, SDK, API 호출의 책임을 분리했습니다.
- 외부 응답과 도메인 주소를 별도 타입으로 정의했습니다.
- 애플리케이션이 `AddressFinder`와 `DeliveryAreaReader` 계약을 소유하게 했습니다.
- 카카오와 파트너 구현은 애플리케이션의 계약을 따르도록 변경했습니다.
- 팝업과 네트워크 없이 배송지 선택 규칙을 테스트했습니다.

이번 예제에서 의존성 역전은 외부 구현을 교체할 가능성만을 위한 장치가 아니라, 자주 유지해야 하는 애플리케이션 규칙을 SDK와 네트워크의 변화로부터 분리하는 경계로 사용했습니다.
