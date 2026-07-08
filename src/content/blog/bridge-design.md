---
title: '웹뷰 브릿지 설계 및 개선기'
description: 'iOS/Android WebView 브릿지 차이부터 이벤트 기반 통신, 실행 시점 문제까지. 네이티브–웹 브릿지를 견고하게 만드는 방법'
pubDate: '2025.12.06'
heroImage: '@assets/post/bridge.png'
category: 'tech'
tags: ['WebView', '브릿지', 'iOS', 'Android', 'React', '아키텍처']
---

앱 내에 웹뷰(WebView)를 붙이다 보면 필연적으로 마주치는 장벽이 있습니다. 바로 네이티브 앱(Swift, Kotlin)과 **웹(JavaScript)** 사이의 통신입니다. 보통 이를 위해 **브릿지(Bridge)** 기술을 사용합니다.

**브릿지란?**

> 네이티브 앱 환경과 앱 내 웹뷰 환경 사이에서 데이터 교환과 기능 호출이 가능하도록 연결해 주는 상호 통신 메커니즘을 의미합니다.

겉으로 보기엔 “그냥 함수 한 번 호출하면 되는 것 아닌가?” 싶지만, 실제로 웹에서 브릿지를 구현해 보려고 하면 생각보다 많은 부분을 고려해야 합니다. 특히 **OS별 인터페이스의 차이**와 **실행 시점의 불일치**는 조금만 방심해도 데이터가 유실되는 주된 원인이 됩니다.

이 글에서는 이런 문제들을 어떻게 점진적으로 대응해 나가면서, 보다 견고한 브릿지 코드를 만들었는지 정리해 보려고 합니다.

---

## OS별 인터페이스 차이 다루기

가장 먼저 부딪히는 문제는, iOS와 Android가 브릿지 통신을 처리하는 네이티브 API와 방식이 근본적으로 다르다는 점입니다.

> **Android:** `WebView` 클래스의 **`addJavascriptInterface`** 메서드를 사용해 네이티브 객체(Java/Kotlin)를 자바스크립트 환경에 직접 주입하는 방식을 공식적으로 제공합니다.[[developer.android.com]](https://developer.android.com/develop/ui/views/layout/webapps/webview?hl=ko)

> **iOS:** `WebKit` 프레임워크의 **`WKScriptMessageHandler`** 프로토콜을 사용해 메시지를 주고받는 방식을 공식적으로 권장합니다.[[developer.apple.com]](https://developer.apple.com/documentation/webkit/wkscriptmessagehandler)

### Android: 객체 직접 주입 (Direct Object Injection)

Android는 `WebView`의 `addJavascriptInterface` 메서드를 통해 네이티브 객체(Java/Kotlin)를 자바스크립트 실행 환경(V8 등)에 직접 바인딩합니다.

- **동작 원리:** 네이티브 객체의 메서드를 자바스크립트에서 직접 호출할 수 있도록 바인딩합니다.
- **특징:** 자바스크립트에서 바운드된 Java 메서드를 호출하면, 네이티브 실행이 완료되어 값을 반환할 때까지 JS 스레드가 블로킹됩니다. 기술적으로 브릿지 통신이 **동기적**으로 처리되는 셈입니다.

### iOS: 메시지 핸들러 (Message Handler)

반면 iOS는 과거 UIWebView의 문제점(안정성, 성능)을 해결하기 위해 현재 `WKWebView`를 사용합니다. 이때 웹 콘텐츠는 앱 프로세스와 분리된 별도 프로세스에서 렌더링됩니다.

- **동작 원리:** 두 프로세스 간 통신은 **IPC (Inter-Process Communication)** 방식을 따르며, `WKScriptMessageHandler` 프로토콜을 통해 메시지를 주고받습니다.
- **특징:** 프로세스가 분리되어 있고 메시지 기반으로 동작하기 때문에, 통신은 필연적으로 **비동기적**입니다.

### 호출 인터페이스의 파편화

이런 구조적 차이 때문에, 웹 프론트엔드에서 네이티브를 호출하는 코드도 플랫폼마다 달라집니다.

**1) iOS 브릿지 호출 (WKWebView)**

웹은 `postMessage`를 사용해 사전에 등록된 핸들러 채널로 JSON 메시지를 보냅니다.

```tsx
// window.webkit.messageHandlers: iOS WKWebView에서 제공하는 메시지 라우팅 객체
// [this.handlerName]: 네이티브 코드에서 add(self, name: "...")로 등록한 채널 이름
// postMessage: iOS 시스템이 제공하는 고정된 함수 이름
window.webkit.messageHandlers[this.handlerName].postMessage(message);
```

**2) Android 브릿지 호출 (WebView)**

Android는 주입된 객체의 메서드를 직접 호출합니다.

```tsx
// window[this.handlerName]: addJavascriptInterface(..., "BridgeName")로 주입한 객체명
// postMessage: 개발자가 임의로 정한 메서드 이름
window[this.handlerName].postMessage(message);
```

> Android의 `postMessage`는 iOS와 달리 시스템에서 고정해 둔 이름이 아닙니다. 네이티브 개발자가 `@JavascriptInterface`를 붙여 `nativeHandler`, `callNative` 등 원하는 이름으로 정의할 수 있습니다.

> 따라서 네이밍과 시그니처에 대해서는 개발자 간 명확한 **사전 합의**가 필요합니다.

### 인터페이스를 통합한 최종 코드 예시

두 플랫폼의 차이를 감싸는 헬퍼 함수를 만들면, 실제 사용 코드는 단순해집니다.

```tsx
// 구현 부분
const sendMessageToNative = (
  handlerName: string,
  data: { [key: string]: unknown },
) => {
  try {
    if (userMobileOS === MobileOS.ANDROID) {
      window[handlerName]?.postMessage(JSON.stringify(data));
    } else if (userMobileOS === MobileOS.IOS) {
      window.webkit?.messageHandlers[handlerName]?.postMessage(data);
    }
  } catch (e) {
    // 에러 로깅 등
  }
};

// 사용 부분
sendMessageToNative('closeHandler', {
  /* ... */
});
```

---

## 통신 방식을 비동기로 통일하기

여기까지 보면 Android는 동기, iOS는 비동기 통신 구조를 가지고 있습니다. Android에서는 호출 시 JS 스레드가 블로킹된다는 뜻이기도 합니다.

플랫폼별 차이를 흡수하고 이슈를 줄이기 위해, 브릿지 통신 방법을 **비동기**로 통일하기로 했습니다.
비동기 처리 방식도 여러 가지가 있습니다.

대표적으로:

- Promise 기반 요청–응답 패턴
- 이벤트 기반 통신 패턴

이번 구현에서는 복잡도를 낮추고 네이티브 환경을 고려해, **이벤트 통신 패턴(단방향 통신)** 을 채택했습니다.

### 이벤트 통신 패턴(단방향)의 장점

- 타임아웃, 요청–응답 ID 매핑 등 복잡한 상태 관리를 하지 않아도 됩니다.
- 네이티브에서 예기치 못한 오류가 나서 응답을 보내지 못해도, 웹이 Promise를 영원히 기다리는 상황을 피할 수 있습니다.
- 웹뷰를 여는 시점에 네이티브에서 바로 전달하는 데이터도 자연스럽게 처리할 수 있습니다.

이벤트 기반으로 통신하면 처리 흐름은 다음과 같이 바뀝니다.

1. **Web → Native (요청):** 웹이 `fetchUser`라는 브릿지를 호출하고 함수는 바로 종료됩니다. 응답을 기다리지 않습니다.
2. **Native (처리):** 네이티브 앱이 요청을 받아 내부 로직을 수행합니다.
3. **Native → Web (응답):** 처리가 끝나면 네이티브는 `receiveUser`라는 브릿지를 통해 웹으로 데이터를 전달합니다.
4. **Web (수신):** 웹은 미리 등록해 둔 `receiveUser` 리스너에서 해당 데이터를 받아 처리합니다.

### 브릿지 이벤트 시스템 구현

아래는 브릿지 통신 로직의 일부입니다.

```tsx
if (typeof window === 'undefined') return;

const bridge = {
  // 이벤트 리스너를 저장할 객체 (이벤트명: [콜백함수1, 콜백함수2...])
  _listeners: {},

  /**
   * [Native -> Web] 이벤트 발생
   * 네이티브가 이 함수를 호출하여 데이터를 전달합니다.
   */
  emit(event: string, data: unknown) {
    const callbacks = this._listeners[event];

    if (callbacks && callbacks.length > 0) {
      // 등록된 리스너가 있다면 모두 실행
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          // 에러 로깅
        }
      });
    } else {
      // 리스너가 없는 경우 처리 (디버깅 로그 등)
    }
  },

  /**
   * [Web React] 이벤트 구독
   * 컴포넌트에서 이벤트를 듣기 위해 등록합니다.
   */
  on(event: string, callback: (data: unknown) => void) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);

    // 구독 해제 함수 반환
    return () => this.off(event, callback);
  },

  /**
   * [Web React] 이벤트 구독 해제
   */
  off(event: string, callback: (data: unknown) => void) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(
      (cb) => cb !== callback,
    );
  },
};

// 전역 객체에 등록
window.__nativeBridge = bridge;

// 예: 뒤로가기 버튼 클릭 이벤트
window.onNativeBackButtonClick = function () {
  bridge.emit('backPress', null);
};
```

---

## 실행 시점 차이까지 고려하기

앞서 이벤트 통신의 장점을 설명하면서도 잠깐 언급했지만, 네이티브 앱이 웹뷰를 띄우자마자 데이터를 전달하는 케이스가 있다면 **실행 시점**에 대한 추가적인 고려가 필요합니다.

이유는 간단합니다.

- 네이티브는 “웹뷰를 열자마자” 데이터를 보낼 수 있습니다.
- 반면 React 쪽 로직은 마운트 이후, `useEffect` 등 특정 단계에서야 이벤트 리스너를 등록합니다.

즉, **React가 준비되기 전에 네이티브 데이터가 먼저 도착**할 수 있습니다.

이를 안전하게 처리하기 위해, React가 로드되기 전에 가장 먼저 실행되는 **초기화 스크립트**를 `index.html`에 추가했습니다.

이 스크립트는 네이티브가 보낸 데이터를 **큐에 쌓아 두었다가**, React에서 “준비 완료” 신호를 보내면(`useEffect`에서 mount 호출) 그때 한꺼번에 리스너들에게 전달합니다.

### 초기화 스크립트 구현

```tsx
(function () {
  if (typeof window === 'undefined') return;

  const bridge = {
    _queue: [],
    _listeners: {},
    _ready: false,

    /**
     * [핵심] 이벤트 수신 및 큐 적재
     * 네이티브가 데이터를 보내면 이 함수가 실행됩니다.
     */
    emit(event: string, data: unknown) {
      const eventData = { event, data, timestamp: Date.now() };

      // 1. 데이터 중복 방지 (최신 상태 유지를 위해 이전 동일 이벤트 제거)
      this._queue = this._queue.filter((item) => item.event !== event);

      // 2. [Live] React가 이미 준비된 상태라면 즉시 리스너 실행
      if (this._ready && this._listeners[event]) {
        this._listeners[event].forEach((cb) => cb(data));
      }

      // 3. [Buffer] 준비 여부와 상관없이 큐에 백업 (데이터 유실 방지)
      // iOS의 비동기 지연이나 Android의 이른 동기 호출 모두 여기서 커버
      this._queue.push(eventData);
    },

    /**
     * React 마운트 완료 시 호출 (Flush)
     * 쌓여 있던 데이터를 일괄 처리하는 시점
     */
    mount() {
      this._ready = true;

      // 큐에 대기 중이던 이벤트들을 순회하며 처리 (Replay)
      this._queue.forEach((item) => {
        if (this._listeners[item.event]) {
          this._listeners[item.event].forEach((cb) => cb(item.data));
        }
      });
    },

    // on(구독), off(해제) 메서드 역시 동일한 패턴으로 구현
  };

  window.__nativeBridge = bridge;
})();
```

### 동작 흐름 요약

1. **Buffer (적재):** 네이티브가 데이터를 보내면 `bridge.emit`이 호출됩니다.

   React가 아직 로딩 중(`_ready: false`)이면 데이터는 `_queue`에 안전하게 저장됩니다.

2. **Mount (동기화):** React 앱이 로딩을 마치고 `useEffect`에서 `bridge.mount()`를 호출하는 순간, 큐에 쌓여 있던 데이터들이 한 번에 리스너들에게 전달됩니다.

### 사용 예시

```tsx
import { NativeBridgeProvider } from './NativeBridgeContext';
import UserProfile from './UserProfile';

function App() {
  return (
    // NativeBridgeProvider에서 내부적으로 bridge.mount(), unmount 처리
    <NativeBridgeProvider>
      <UserProfile />
    </NativeBridgeProvider>
  );
}
```

```tsx
const UserProfile = () => {
  const [user, setUser] = useState<{ name: string; email: string } | null>(
    null,
  );

  // 유저 데이터 수신
  useBridgeListener('userData', (data) => {
    console.log('Received User Data:', data);
    setUser(data);
  });

  if (!user) return <div>Loading user info...</div>;

  return (
    <div>
      <h2>Hello, {user.name}</h2>
      <p>Email: {user.email}</p>
    </div>
  );
};

export default UserProfile;
```
