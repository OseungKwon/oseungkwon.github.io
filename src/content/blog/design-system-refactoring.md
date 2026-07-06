---
title: '유연하고 확장 가능하게 디자인 시스템 개선하기'
description: 'props 지옥에서 벗어나기 위해, HTML 표준 속성 상속, 합성 컴포넌트 패턴, Co-location까지 적용해 디자인 시스템을 재설계한 기록'
pubDate: '2025.12.07'
heroImage: '@assets/post/figma-and-storybook.png'
category: 'tech'
tags:
  [
    'Design System',
    'React',
    '컴포넌트 아키텍처',
    '프론트엔드',
    'Compound Components',
    'Figma',
  ]
---

기존에도 디자인 시스템은 있었지만 여러 한계를 안고 있었습니다.

조금만 새로운 요구사항이 들어와도 매번 다른 컴포넌트를 새로 만들거나, 공통 컴포넌트에 props를 하나씩 덕지덕지 붙여야 했습니다.

또한 디자인 시스템으로 구현된 요소 자체가 많지 않다 보니, 동일한 컴포넌트를 화면마다 반복해서 구현하는 일이 잦았습니다. 이를 견디지 못한 몇몇 개발자들은 `pre-components`라는 이름으로 임시 디자인 시스템을 만들어 쓰기도 했습니다.

그 결과, `components`, `pre-components`, `deprecated-components`와 같은 폴더와 그 안의 파일들이 우후죽순 생겨났고, 어떤 컴포넌트가 어디에 있는지 한눈에 파악하기 어려운 상태가 되었습니다.

마침 디자인 시스템을 전면 개편할 기회가 있었고, 이 과정에서 어떤 문제를 어떻게 바라봤는지, 그리고 팀에서 어떤 논의들이 오갔는지를 간단히 정리해 보려고 합니다.

# 문제점 파악

## 문제점 1 – props 규칙

예전 웹 파트에는 다소 독특한 규칙이 하나 있었습니다.

> 컴포넌트의 props는 명확해야 하며, 어떤 props가 전달되는지 개발자가 한 번에 알아볼 수 있도록 모든 props를 명시해야 한다.

이 규칙 때문에 공통 `Button` 컴포넌트는 `React.ComponentProps<"button">`와 같은 기본 태그들의 속성을 상속받아 사용할 수 없었습니다.

개발자가 `html` 태그 속성들을 모두 `interface`에 정의하기도 현실적으로 어려웠기 때문에, 개발 시점에 필요한 props만 조금씩 추가해 나가는 방식이 반복되었습니다.

### 최초 Button 컴포넌트

```tsx
interface ButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  data: string;
  disabled: boolean;
}

export function Button({ onClick, data, disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {data}
    </button>
  );
}
```

### 이후의 Button 컴포넌트

```tsx
interface ButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled: boolean;
  className?: string;
  style?: CSSProperties;
  variant?: Variant;
  size?: SizeType;
  type?: ButtonType;
  status?: Status;
  children?: ReactNode;
}

export function Button({
  onClick,
  disabled,
  className,
  style,
  variant,
  size,
  type,
  status,
  children,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
      variant={variant}
      size={size}
      type={type}
      status={status}
    >
      {children}
    </button>
  );
}
```

이미 button이 기본적으로 제공하는 속성들까지 모두 interface로 다시 정의하다 보니 여러 문제가 드러났습니다.

개발자마다 네이밍 기준이 달라 **동일한 기능인데 이름만 다른 props**가 여러 개 생기게 되거나, 원래 button 속성에서 제공하던 기능을 **전혀 다른 이름으로 다시 포장해서 사용하는** 일이 생기는 등의 문제가 발생했습니다.

---

## 문제점 2 – 한 컴포넌트에 너무 많은 기능

문제는 한 컴포넌트에 너무 많은 기능이 있어 발생하기도 했습니다. 테이블 컴포넌트의 경우가 대표적입니다.

테이블 컴포넌트는 아래와 같은 다양한 기능이 내포되어 있었습니다.

- 페이지네이션
- 무한 스크롤 지원
- 수정 모드
- 드래그 앤 드롭 기능

![](@assets/post/large-function-table.png)

즉, “테이블 자체”라기보다는 “테이블을 사용하는 특정 화면”에 초점이 맞춰진 기능들이 모조리 들어가 있었습니다. 이렇게 기능이 계속 붙다 보니, 테이블 컴포넌트는 점점 **무거워지고 재사용성은 떨어졌**습니다.

---

## 기존 코드의 문제점 3 – 부족한 확장성

확장성 측면에서도 아쉬운 부분이 많았습니다.

예를 들어 `Input` 컴포넌트는 “입력 필드” 역할만 딱 수행하는, 어떻게 보면 이상적인 컴포넌트였습니다.

하지만 실제 사용처를 보면 대부분 `label`이 필수로 함께 묶여 사용되고 있었고, 그럼에도 불구하고 label은 매번 직접 구현해야 했습니다.

```tsx
<div>
  <label className="...">아이디</label>
  <Input onChange={onChange} value={value} />
</div>
```

결과적으로 `Input`은 너무 “순수”해서, 실제 화면 요구사항을 충족시키기에는 항상 한 발짝씩 부족한 상태였습니다.

---

## 문제점 4 – 낮은 논리적 응집도, 높은 물리적 결합도

`toast` 같은 공통 컴포넌트는 단순한 UI만으로는 쓸 수 없습니다.
보통 `useToast()`와 같은 훅이나 컨텍스트 로직이 함께 따라와야 합니다.

하지만 실제 구조는 다음과 같았습니다.

- `Toast.tsx` 컴포넌트: `common/components` 폴더
- `useToast()` 훅: `common/utils` 폴더

즉, 서로 강하게 결합되어 있는 코드임에도 물리적으로는 파편화되어 존재했습니다.

이로 인해 코드를 이해하려면 여러 폴더를 전부 뒤져야 했습니다.

---

# 디자인 시스템 개선하기

> 유연하고 확장 가능한 디자인 시스템

## 1. 표준 HTML 속성 상속과 OCP 준수

> **OCP(Open-Closed Principle, 개방 폐쇄 원칙)**: 소프트웨어 개체(클래스, 모듈, 함수 등)는 확장에 대해서는 개방적이어야 하고, 수정에 대해서는 폐쇄적이어야 한다는 객체 지향 설계 원칙입니다.

가장 먼저 손봐야 할 것은 이른바 **과다한 props** 였습니다.

팀에서 합의한 첫 번째 원칙은 단순했습니다.

> “기본 HTML 요소가 가진 속성은 우리가 다시 정의하지 말고, 그대로 열어 두자.”

하지만 React의 `ComponentProps`를 활용하면 네이티브 태그의 속성을 그대로 상속받을 수 있기 때문에, 이를 통해 개발자는 문서를 일일이 찾아보지 않고도 `onClick`, `onMouseEnter`, `aria-label` 같은 표준 속성을 자연스럽게 사용할 수 있습니다.

### 개선된 Button 컴포넌트

```tsx
import { ComponentProps } from 'react';

// HTMLButtonElement의 모든 속성을 상속받으면서, 커스텀 props를 추가
interface ButtonProps extends ComponentProps<'button'> {
  size?: boolean;
  isLoading?: boolean;
}

export function Button({ className, size, children, ...props }: ButtonProps) {
  return (
    <button
      className={className}
      disabled={isLoading || props.disabled}
      {...props} // 나머지 props는 그대로 주입
    >
      {isLoading ? <Spinner /> : children}
    </button>
  );
}
```

이 개선을 통해 기존보다 더욱 확장성 있는 코드를 작성할 수 있게 되었습니다.

- `className`으로 스타일을 오버라이드 할 수 있어짐.
- `data-testid` 같은 속성을 자유롭게 추가 가능해짐.
- 표준 DOM 속성을 거의 그대로 활용해 추가적인 속성 정의를 하지 않아도 됨.

동시에, 디자인 시스템의 의도에 맞는 “Button 고유의 역할”에만 집중해서 커스텀 props를 정의할 수 있게 되었습니다.

---

## 2. 합성 컴포넌트 패턴 도입

> **Compound Component Pattern, 합성 컴포넌트 패턴**: 부모가 상태와 로직을 관리하고 사용자가 JSX 구조를 직접 구성함으로써 높은 유연성과 명시적인 제어권을 확보할 수 있게 하는 설계 방식입니다.

‘너무 많은 기능’을 가진 Table 컴포넌트와 ‘확장성이 부족한’ Input 컴포넌트의 문제는 공통적으로 **제어의 역전(Inversion of Control)** 부족에서 비롯된 문제였습니다.

거대한 단일 컴포넌트가 모든 로직과 상태를 품고 있던 구조에서 벗어나, 레고 블록처럼 필요에 따라 조립해서 사용할 수 있는 **합성 컴포넌트 패턴**을 도입했습니다.

### Table 컴포넌트의 변화

기존에는 다음과 같은 식으로 props를 통해 추가적인 기능을 사용하는 방식이었습니다.

```tsx
<Table data={...} usePagination useDrag ... />
```

이제는 필요한 서브 컴포넌트를 조합하는 형태로 사용합니다.

```tsx
// 변경 후: 필요한 기능만 조립해서 사용
<Table>
  <Table.Header>{...}</Table.Header>
  <Table.Body>{...}</Table.Body>
  {/* 페이지네이션이 기능 추가*/}
  <Table.Pagination />
</Table>
```

이 패턴은 **Input과 Label의 결합 문제**도 자연스럽게 해결해 주었습니다.

단순 `Input` 컴포넌트는 최대한 순수하게 유지하되, 이를 감싸는 `TextField` 컴포넌트를 통해 실제 폼에서 자주 등장하는 패턴을 캡슐화했습니다.

```tsx
// TextField는 Label, Input, ErrorMessage를 조합하는 역할을 합니다.
<TextField>
  <TextField.Label>아이디</TextField.Label>
  <TextField.Input value={value} onChange={onChange} />
  <TextField.ErrorMessage>{error}</TextField.ErrorMessage>
</TextField>
```

이제 목적에 따라 단순 입력만 필요하면 `Input`만 사용하고, 실제 폼에서는 `TextField`를 통해 label, 에러, helper 텍스트 등을 일관된 형태로 조합하는 두 가지 레벨의 추상화를 선택적으로 사용할 수 있습니다.

---

## 3. 폴더 구조 개편

마지막으로, **낮은 논리적 응집도** 문제를 해결하기 위해 **Co-location(동일한 관심사는 같은 곳에 위치시킨다)** 원칙을 적용했습니다.

이전 구조는 대략 이런 식이었습니다.

- `common/components/`
- `common/utils/`

새로운 디자인 시스템에서는 다음과 같이 재구성했습니다.

### 변경된 폴더 구조

```tsx
common-components/
  ├── Button/
  │    ├── Button.component.tsx
  │    ├── Button.stories.tsx
  │    └── Button.types.ts
  ├── Toast/
  │    ├── Toast.component.tsx
  │    ├── ToastProvider.tsx
  │    ├── useToast.ts  // 훅도 컴포넌트 옆으로 이동
  └── ...
```

이제 `Toast` 기능을 수정해야 한다면, `Toast` 폴더 하나만 열어 보면 되고 UI, 상태 관리, 스타일, 타입 정의가 한곳에 모여 있기 때문에 변경 영향 범위를 훨씬 직관적으로 파악할 수 있습니다.

물리적인 위치가 논리적인 연관성을 대변하게 되면서, 디자인 시스템의 **유지보수성**과 **가시성**이 눈에 띄게 좋아졌습니다.

## 4. 문서화와 협업의 중심, Storybook 도입

앞서 언급했듯, 기존 시스템에서 `pre-components`나 중복 코드가 우후죽순 생겨난 가장 큰 원인 중 하나는 **가시성 부족**이었습니다.
어떤 컴포넌트가 존재하는지, 어떻게 생겼는지 가식적으로 확인할 수 없던 문제를 개선하기 위해 Storybook을 도입했습니다.

이를 통해 개발자는 컴포넌트를 바로 시각화 해서 볼 수 있게 되었으며, 컴포넌트의 사용법 또한 스토리북 문서를 통해 바로 확인할 수 있게 되었습니다.

또한, 디자인 시스템을 개편하면서 변경/추가된 공통 컴포넌트가 다수 존재했는데, 스토리북을 통해 빠르게 피드백을 받을 수 있었으며, 소통 시간또한 감소시킬 수 있었습니다.
