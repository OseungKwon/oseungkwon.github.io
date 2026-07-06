---
title: 'FileSystemWritableFileStream: 파일 스트리밍 다운로드'
description: 'File System API 소개 및 FileSystemWritableFileStream 자세히 알아보기'
pubDate: '2026.01.21'
heroImage: '@assets/post/file-system-api/1.png'
category: 'tech'
tags: ['Web APIs', 'File System API', 'FileSystemWritableFileStream', '스트리밍 다운로드', '대용량 파일 다운로드']
---

웹 애플리케이션에서 로컬 파일 시스템에 접근하는 방식은, 과거의 제한적인 샌드박스 형태에서 벗어나 네이티브 앱 수준의 제어가 가능한 **File System API**로 진화했습니다. 

오늘은 이 API의 내부 구조와 핵심 메서드, 그리고 `FileSystemWritableFileStream`에 대해 자세히 알아보겠습니다.

## 1. File System API란 무엇인가?

`File System API`는 사용자의 로컬 디바이스 또는 네트워크 파일 시스템에 있는 파일과 디렉토리를 웹이 직접 읽고, 쓰고, 관리할 수 있게 해주는 인터페이스입니다.

File System API의 핵심을 먼저 설명드리겠습니다.
* **보안 컨텍스트:** 이 API는 강력한 권한을 가지므로 HTTPS 환경(또는 localhost)에서만 작동합니다.
* **워커 지원:** 메인 스레드뿐만 아니라 웹 워커(Web Worker)에서도 사용 가능하여, I/O 작업으로 인한 UI 블로킹을 방지할 수 있습니다.
* **핸들(Handle) 기반 설계:** 파일이나 디렉토리에 직접 접근하는 경로(Path) 문자열 대신, `FileSystemHandle`이라는 추상화된 객체를 통해 상호작용합니다.

### 두 가지 파일 시스템 영역

파일 시스템 접근은 크게 2가지 방식으로 할 수 있습니다.

1. **일반 파일 시스템:** 사용자가 `showOpenFilePicker` 등을 통해 직접 선택한 파일/폴더에 접근합니다. 사용자의 명시적인 권한 허용이 필요합니다. 

2. **OPFS (Origin Private File System):** 브라우저가 해당 오리진(Origin) 전용으로 격리해 둔 공간입니다. 사용자에게는 보이지 않지만, 권한 요청 없이 즉시 사용 가능하며 고성능 처리에 최적화되어 있습니다.

> OPFS는 브라우저 전용으로 실제 디스크를 할당받아 저장하지만, 사용자가 직접 파일 탐색기 등을 통해 접근이 불가능합니다. 
그렇기 때문에 사용자의 권한 요청을 받지 않고도 내부 디스크에 저장시킬 수 있으며, 최대 저장 가능 공간은 `await navigator.storage.estimate()`를 통해 확인할 수 있습니다.

## 2. 핵심 인터페이스 및 상세 메서드

API의 모든 진입점은 `FileSystemHandle`이며, 이를 상속받은 파일 및 디렉토리 핸들로 나뉩니다.

### ① FileSystemHandle (최상위 부모)

모든 파일 및 디렉토리 핸들의 기본이 되는 객체입니다.

* **kind**: 해당 항목이 `file`인지 `directory`인지 반환합니다.
* **name**: 항목의 이름을 반환합니다.
* **isSameEntry(other)**: 두 핸들이 동일한 파일 시스템 항목을 가리키는지 비교합니다.
* **queryPermission()` / `requestPermission()**: 핸들에 대한 읽기/쓰기 권한 상태를 확인하거나 사용자에게 권한을 요청합니다.
* **remove()**: 해당 항목을 파일 시스템에서 삭제 요청합니다.

### ② FileSystemDirectoryHandle (디렉토리 제어)

폴더 구조를 탐색하고 관리하는 기능을 제공합니다.

* **getDirectoryHandle(name, options)** / **getFileHandle(name, options)**: 이름으로 하위 디렉토리나 파일의 핸들을 가져옵니다. 
  `{ create: true }` 옵션을 전달하면 존재하지 않을 경우 새로 생성합니다.

* **removeEntry(name, options)**: 지정된 이름의 하위 항목을 삭제합니다.
  폴더를 재귀적으로 삭제하려면 `{ recursive: true }` 옵션을 사용합니다.
* **resolve(possibleDescendant)**: 특정 하위 항목이 현재 디렉토리로부터 어떤 경로에 있는지 이름 배열(Array of names)로 반환합니다.
* **entries()`, `keys()`, `values()**: 디렉토리 내 항목들을 비동기 반복자(Async Iterator)로 탐색합니다.



### ③ FileSystemFileHandle (파일 제어)

개별 파일에 접근하고 데이터를 다루기 위한 핸들러 입니다.

* **getFile()**: 디스크의 현재 파일 상태를 나타내는 `File` 객체(Blob의 일종)를 반환합니다.
* **createWritable()**: 파일에 데이터를 쓰기 위한 `FileSystemWritableFileStream`을 생성합니다.
* **createSyncAccessHandle()**: 성능 최적화된 동기 쓰기/읽기를 위한 `FileSystemSyncAccessHandle`을 생성합니다. (OPFS 및 웹 워커 전용)

## 3. 데이터 기록 인터페이스 상세 비교

데이터를 저장하는 방식은 **비동기 스트림** 방식과 **동기 고성능** 방식으로 나뉩니다. 이 둘의 차이를 이해하는 것이 중요합니다.

### A. FileSystemWritableFileStream (비동기 스트림)

일반적인 파일 저장 시 사용하며, `WritableStream`을 상속받습니다.

* **write(data)**: 현재 커서 위치에 데이터를 기록합니다. 데이터는 Blob, 문자열, Buffer 등이 가능합니다.
* **seek(position)**: 파일 내에서 기록을 시작할 커서의 위치(offset)를 이동시킵니다.
* **truncate(size)**: 파일의 크기를 지정된 바이트 수로 조절(Resize)합니다.
* **close()**: 스트림을 닫고 모든 변경 사항을 디스크에 확정(Commit)합니다.

### B. FileSystemSyncAccessHandle (고성능 동기 핸들)

OPFS 내에서, 그리고 **Dedicated Web Workers** 내부에서만 사용 가능합니다. 비동기 오버헤드 없이 SQLite와 같은 대규모 데이터 처리에 적합합니다.

* **write(buffer, options)**: 버퍼의 내용을 파일에 직접 기록하며, 기록된 바이트 수를 반환합니다.
* **read(buffer, options)**: 파일 내용을 버퍼로 읽어옵니다.
* **getSize()**: 파일의 현재 크기를 바이트 단위로 즉시 반환합니다.
* **flush()**: 버퍼에 있는 변경 사항이 실제 디스크에 반영되도록 강제합니다.
* **close()**: 핸들을 닫고 파일에 걸린 배타적 잠금(exclusive lock)을 해제합니다.

## 그래서, 어떻게 사용하면 되나요?

### Case 1: 비동기 스트리밍

```javascript
// 사용자가 선택한 위치에 직접 쓰기
async function saveToFile(content) {
  // 1. 저장할 파일 핸들 획득 (File Picker)
  const handle = await window.showSaveFilePicker();

  // 2. Writable Stream 생성
  const writable = await handle.createWritable();

  // 3. 데이터 기록 및 종료
  await writable.write(content);
  await writable.close();
}

```

### Case 2: 고성능 동기 방식

```javascript
// Web Worker 내부 로직
onmessage = async (e) => {
  const message = e.data;

  // 1. OPFS 루트 접근
  const root = await navigator.storage.getDirectory();

  // 2. 임시 파일 핸들 생성
  const draftHandle = await root.getFileHandle("temp.txt", { create: true });

  // 3. 동기 액세스 핸들 생성 (SyncAccessHandle)
  const accessHandle = await draftHandle.createSyncAccessHandle();

  // 4. 고속 쓰기 (Append 방식 예시)
  const fileSize = accessHandle.getSize();
  const encoder = new TextEncoder();
  const encodedMessage = encoder.encode(message);

  accessHandle.write(encodedMessage, { at: fileSize });
  
  // 5. 디스크 반영 및 잠금 해제
  accessHandle.flush();
  accessHandle.close();
};

```

## 응용하기 - 파일 다운로드
대용량 파일을 비동기 스트리밍 방식으로 다운로드 할 수 있고, `showOpenFilePicker`가 지원되지 않는 브라우저에서는 OPFS를 툥해 저장하고, 이를 다시 `<a/>`를 통해 저장하도록 했습니다. 
렌더링을 블로킹을 막기 위해 web worker를 사용했습니다.

1. 다운로드 화면
![다운로드 화면](@assets/post/file-system-api/2.png)

2. 디렉토리에서 저장 폴더 위치 명시적 선택
![저장 폴더 위치 명시적 선택](@assets/post/file-system-api/3.png)

3. 파일 스트리밍 다운로드
![파일 스트리밍 다운로드](@assets/post/file-system-api/4.png)

3. 라우팅이 이동되도 다운로드 오버레이 유지
![라우팅이 이동](@assets/post/file-system-api/5.png)

## 마무리

File System API의 비동기 스트리밍 방식을 통해 메모리를 크게 점유하지 않고 대용량 파일을 다운로드 할 수 있습니다.
오프라인을 우선하거나 브라우저 기반 동영상 편집 등의 기능을 구현할 때에는 OPFS를 활용해 빠른 속도로 사용자의 읽기/쓰기 동작을 가능하게 합니다.

하지만 대용량 데이터 처리를 위해 web worker를 사용해 최적화 하고, 브라우저 호환성을 맞추고, 보안 등 신경을 써야 하는 여러가지 부분들이 있습니다.
이런 부분을 잘 신경쓴다면, File System API 기반으로 더욱 네이티브 앱에 가까운 사용자 경험을 웹에서도 제공할 수 있습니다.
