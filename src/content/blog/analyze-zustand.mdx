---
title: 'zustand 라이브러리 코드 분석하기'
description: 'zustand 라이브러리를 코드 레벨에서 직접 분석'
pubDate: '2025.12.20'
heroImage: '@assets/post/zustand.png'
category: 'tech'
tags: ['Zustand', '상태 관리 라이브러리', 'React', 'useSyncExternalStore']
---

`Zustand`는 작고 빠르며 확장 가능한 React 프로젝트에서 사용하는 상태 관리 라이브러리입니다.

이전에 `redux`, `recoil` 등등의 상태 관리 라이브러리를 써왔지만, `redux`의 경우 보일러 플레이트가 많고 복잡하다는 단점이 있고, `recoil`은 더 이상 라이브러리의 업데이트가 이뤄지지 않는다는 단점이 있었습니다.

이러한 상황 속에서 zustand 라이브러리는 간결하고 경령화된 라이브러리로 점차 인기를 얻고 있습니다.

zustand가 인기가 많아지고 있는 비결에는 다음과 같은 특징들이 있습니다.

- **간결한 api**: 복잡성 없이 간단하게 사용 가능
- **경량화**: 가벼운 라이브러리 크기
- **유연성**: middleware를 통한 확장 가능
- **성능**: 최소한의 상태 변경과 렌더링으로 동작

내부적으로 어떻게 동작하는지 알면, 코드적으로도 좋은 인사이트가 될 것 같고, 라이브러리에 대한 이해도를 더 잘 가져갈 수 있을 것 같아 이번 기회에 **zustand 라이브러리 코드 분석하기**라는 주제로 글을 쓰게 되었습니다.

## zustand로 상태 관리하기

우선 zustand 공식 문서를 보면 다음과 같은 예제 코드를 볼 수 있습니다.

```tsx
import { create } from 'zustand';

const useStore = create((set) => ({
  count: 1,
  inc: () => set((state) => ({ count: state.count + 1 })),
}));

function Counter() {
  const { count, inc } = useStore();
  return (
    <div>
      <span>{count}</span>
      <button onClick={inc}>one up</button>
    </div>
  );
}
```

zustand는 상태를 저장하기 위해 스토어를 활용합니다.

create 함수를 사용해, 저장할 상태와 그 상태를 핸들링하는 액션을 정의합니다.
이후 useStore를 리턴해 정의한 상태와 액션들을 가져와 사용하면 되는 단순한 구조로 이루어져 있습니다.

## zustand 핵심 개념 코드 분석

zustand는 '구독'이라는 개념을 통해 상태를 추가적으로 관리합니다.
상태 변경을 구독하고, 변경 사항을 알림으로 전달합니다.

우선 코드를 상세하게 뜯어보기 전에, 전체적으로 어떤 함수들이 사용되는지 확인해 보겠습니다.

- `createStore`: 스토어 생성
  상태와 상태 관리 API를 정의합니다.
- `getState`: 상태 읽기
  현재 상태를 읽습니다.
- `setState`: 상태 변경
  상태를 변경하며, 구독자에게 알립니다.
- `subscribe`: 구독 및 알림
  상태 변경에 반응하며, 필요 시 구독을 해제합니다.
- `destroy`: 스토어 종료
  모든 구독자를 제거하고 스토어를 초기화합니다.

여기서 가장 중요한 함수는 `createStore`와 `subscribe`입니다.
`createStore`는 `createStoreImpl`를 통해 실제 로직을 구현하고 있습니다.

### 핵심 코드

```tsx
const createStoreImpl: CreateStoreImpl = (createState) => {
  type TState = ReturnType<typeof createState>;
  type Listener = (state: TState, prevState: TState) => void;
  let state: TState;
  const listeners: Set<Listener> = new Set();

  const setState: StoreApi<TState>['setState'] = (partial, replace) => {
    const nextState =
      typeof partial === 'function'
        ? (partial as (state: TState) => TState)(state)
        : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state =
        (replace ?? (typeof nextState !== 'object' || nextState === null))
          ? (nextState as TState)
          : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };

  const getState: StoreApi<TState>['getState'] = () => state;

  const getInitialState: StoreApi<TState>['getInitialState'] = () =>
    initialState;

  const subscribe: StoreApi<TState>['subscribe'] = (listener) => {
    listeners.add(listener);
    // Unsubscribe
    return () => listeners.delete(listener);
  };

  const api = { setState, getState, getInitialState, subscribe };
  const initialState = (state = createState(setState, getState, api));
  return api as any;
};
```

차근차근 위에서부터 하나씩 살펴보겠습니다.

### 상태 저장

상태의 저장과 구독 관리를 위해 `state`와 `listeners`를 정의해줍니다.

```tsx
let state: TState;
const listeners: Set<Listener> = new Set();
```

### 상태 업데이트

```tsx
const setState: StoreApi<TState>['setState'] = (partial, replace) => {
const nextState =
typeof partial === 'function'
? (partial as (state: TState) => TState)(state)
: partial;
```

`setState` 함수는 인자로 `partial`과 `replace` 값을 받습니다.

- **partial**: 상태 또는 액션(함수)
- **replace**: 상태를 특정 상태(nextState)로 대체할 것인지의 여부

`partial`이 만약 함수라면 현재 상태를 입력으로 받아, 새로운 상태(nextState)를 반환합니다.

`partial`이 함수가 아닌 값일 경우 그대로 새로운 상태(nextState)로 사용됩니다.

### 현재 상태와 새로운 상태 비교

```tsx
if (!Object.is(nextState, state)) {
const previousState = state;
```

`Object.is`를 통해 현재 상태와 새로운 상태가 같은 값인지 판단합니다.
먄약 다른 값이라면, 이전 상태에 현재 상태를 저장합니다.

### 현재 상태 업데이트

```tsx
state =
  (replace ?? (typeof nextState !== 'object' || nextState === null))
    ? (nextState as TState)
    : Object.assign({}, state, nextState);
```

만약 `replace` 값이 `true`라면 현재 상태를 새로운 상태로 대체시킵니다.
`false`라면 `Object.assign` 연산자를 통해 현재 상태와 새로운 상태를 합칩니다.

### 등록된 모든 구독자 호출

```tsx
listeners.forEach((listener) => listener(state, previousState));
}
```

이후 `listeners`를 순회하며, 모든 구독자에게 새로운 상태와 이전 상태를 전달합니다.

여기서의 구독자는 이후에 자세히 설명하겠지만, 리액트에서 상태 변경을 감지하는 콜백 함수를 등록합니다.

### 상태 반환

```tsx
const getState: StoreApi<TState>['getState'] = () => state;

const getInitialState: StoreApi<TState>['getInitialState'] = () => initialState;
```

`getState`는 현재 상태를 반환하는 역할을 하고, `getInitialState`는 초기값을 반환하는 역할을 합니다.

### 구독자 등록 및 해제

```tsx
const subscribe: StoreApi<TState>['subscribe'] = (listener) => {
  listeners.add(listener);
  // Unsubscribe
  return () => listeners.delete(listener);
};
```

`subscribe`함수는 호출되면 인자로 들어온 함수를 `listeners`에 추가합니다.

구독을 해제할 수 있는 함수를 반환해, 이를 호출하면 `listeners`에서 해당 함수를 제거시킵니다.

#### 클로저를 통한 상태 유지

```tsx
const api = { setState, getState, getInitialState, subscribe }
const initialState = (state = createState(setState, getState, api))
return api as any
}
```

클로저를 사용하면 함수가 호출될 때마다 이전 상태를 기억합니다.
이러한 클로저의 특성을 활용해, `createStore` 함수 내에서 사용된 변수(state, subscribe)들을 반환(return)해 스토어 내부 상태를 관리합니다.

> Closure(클로저): 어떤 함수가 다른 함수 내부에서 선언되었을 때, 그 함수가 외부 함수의 변수와 환경에 접근할 수 있는 기능
> 쉽게 말하자면 상태와 상태를 업데이트 하는 함수가 있고, 상태가 업데이트되면, 등록된 구독자들이 실행되는 과정을 담고 있습니다.

여기까지가 상태의 저장과 업데이트 부분이였고,
이제 이를 `React`에서 사용하기 위해 훅으로 만들어주는 추가적인 코드를 확인할 필요가 있습니다.

## zustand 리액트 훅 코드 분석

### 전체 코드

```tsx
export function useStore<TState, StateSlice>(
api: ReadonlyStoreApi<TState>,
selector: (state: TState) => StateSlice = identity as any,
) {
const slice = React.useSyncExternalStore(
api.subscribe,
() => selector(api.getState()),
() => selector(api.getInitialState()),
)
React.useDebugValue(slice)
return slice
}

const createImpl = <T>(createState: StateCreator<T, [], []>) => {
const api = createStore(createState)

const useBoundStore: any = (selector?: any) => useStore(api, selector)

Object.assign(useBoundStore, api)

return useBoundStore
}
```

### 상태 저장 훅

```tsx
export function useStore<TState, StateSlice>(
  api: ReadonlyStoreApi<TState>,
  selector: (state: TState) => StateSlice = identity as any,
) {
  const slice = React.useSyncExternalStore(
    api.subscribe,
    () => selector(api.getState()),
    () => selector(api.getInitialState()),
  );
  React.useDebugValue(slice);
  return slice;
}
```

**React18** 이전에는 이보다 더 긴 코드로 작성되었지만, **React18**에서 `useSyncExternalStore`를 지원하면서 코드가 간소화 되었습니다.

`useSyncExternalStore`는 인자로 `subscribe`, `getSnapshot`, `getServerSnapshot`을 받는데, `subscribe` 인자를 받아 내부적으로 구독과 구독 해제를 관리합니다.

> `React.useSyncExternalStore`: external state의 변경사항을 관찰하고 있다가, tearing이 발생하지 않도록 상태 변경이 관찰되면 다시 렌더링을 시작합니다.

```tsx
const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)
```

따라서 외부 스토어를 구독해 스토어에 있는 데이터의 스냅샷을 반환하며, React는 컴포넌트가 스토어를 구독한 상태로 유지하고 변경 사항이 있을 때 다시 렌더링합니다.

## 참고

https://github.com/pmndrs/zustand

https://zustand.docs.pmnd.rs/getting-started/introduction

https://ko.react.dev/reference/react/useSyncExternalStore
