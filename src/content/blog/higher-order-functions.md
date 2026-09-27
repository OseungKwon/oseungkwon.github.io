---
title: '고차 함수는 어디서 왔고, 왜 사용할까?'
description: '람다 계산법에서 시작해 함수를 값으로 다루는 방식을 짚고, JavaScript의 배열 메서드와 함수 생성·로깅 예제로 고차 함수의 쓰임을 설명합니다.'
pubDate: '2026.09.09'
category: 'tech'
tags: ['JavaScript', '고차 함수', '람다', '함수형 프로그래밍']
draft: false
---

> “There are a number of useful functions some of whose arguments are functions.”

“함수를 인자로 받는 유용한 함수들이 있습니다.”

John McCarthy는 1960년 Lisp 논문에서 이렇게 설명하며, 함수를 인자로 받는 `maplist`를 소개했습니다. 다른 함수에 함수를 전달하는 방식은 JavaScript가 만들어지기 전부터 사용되고 있었습니다. [McCarthy의 Lisp 논문, §g](https://www-formal.stanford.edu/jmc/recursive/node3.html)

JavaScript에서도 이러한 코드를 자주 작성합니다. `map`에는 원소를 변환할 함수를 전달하고, `then`에는 비동기 작업이 완료된 후 실행할 함수를 전달합니다. 직접 만든 함수에서 새로운 함수를 반환하기도 합니다.

함수는 보통 값을 받아 결과를 돌려주는 것으로 배웁니다. 그런데 값이 들어갈 자리에 다른 함수를 넣으면 무엇이 달라질까요? 람다의 의미부터 살펴보고, 함수를 주고받는 방식이 실제 코드에서 어떻게 쓰이는지 알아보겠습니다.

## 람다 함수란 무엇일까

JavaScript에서는 `map`에 다음과 같이 함수를 전달합니다.

```javascript
[1, 2, 3].map((x) => x + 1); // [2, 3, 4]
```

여기서 `(x) => x + 1`은 이름 없이 작성한 함수입니다. 프로그래밍에서 **람다 함수**라는 말은 보통 이러한 익명 함수를 가리킵니다. 새로운 종류의 계산을 하는 함수라기보다, 이름을 붙이지 않고 함수 자체를 표현하는 방식입니다.

‘람다’라는 이름은 수학에서 함수를 표현할 때 사용하는 기호 `λ`에서 왔습니다. 위 함수의 계산 규칙을 람다 표기법으로 쓰면 다음과 같습니다.

```text
λx. x + 1
```

익숙하지 않은 기호지만, JavaScript의 화살표 함수와 대응시켜 읽을 수 있습니다.

```text
λx.    x + 1
(x) => x + 1
```

`λ`는 함수 표현의 시작을 나타내고, `x`는 매개변수입니다. 점 뒤의 `x + 1`은 함수의 본문입니다. 전체를 “`x`를 받아 `x + 1`을 계산하는 함수”라고 읽으면 됩니다.

이름이 있는 함수라면 이름을 통해 참조하지만, 람다 표기법은 매개변수와 본문으로 함수 자체를 적습니다. JavaScript에서 익명 함수를 `map`의 인자로 바로 작성하는 모습과 연결해 볼 수 있습니다. 다만 이는 표기와 계산 규칙의 대응이며, JavaScript 화살표 함수의 모든 성질이 수학의 람다와 같다는 의미는 아닙니다.

## 람다 계산법 이해하기

람다로 표현한 함수에 `3`을 전달하면 어떻게 될까요? JavaScript의 함수 호출과 나란히 놓아 보겠습니다.

```javascript
((x) => x + 1)(3); // 4
```

```text
(λx. x + 1)(3)
→ 3 + 1
→ 4
```

함수 본문의 `x`를 전달받은 `3`으로 바꾸면 `3 + 1`이 됩니다. 람다 표기법으로 함수 자체를 적었다면, 이번에는 그 함수에 인자를 넣어 계산을 진행한 것입니다.

**람다 계산법**(lambda calculus)은 이렇게 함수를 표현하고, 인자를 넣었을 때 식을 어떻게 바꿔 나갈지 정한 수학적 규칙입니다. 프로그래밍 언어에서 함수 선언과 호출의 동작을 정하듯, 람다 계산법에서도 함수의 표현과 계산 방법을 정합니다.

이때 `λx. x + 1`처럼 매개변수와 본문으로 함수를 표현하는 것을 _함수 추상화_, 그 함수에 인자를 전달하는 것을 *함수 적용*이라고 부릅니다. 여기서는 각각 함수를 정의하는 일과 호출하는 일에 대응시켜 이해할 수 있습니다.

Alonzo Church는 어떤 계산을 정해진 절차에 따라 수행할 수 있는지 연구하면서 람다 계산법을 발전시켰습니다. 위에서는 이해를 돕기 위해 숫자와 `+`를 사용했습니다. 순수 람다 계산법에서는 이 숫자와 연산도 함수로 표현하지만, 고차 함수와의 연결을 이해하기 위해 그 표현까지 다룰 필요는 없습니다. [A Tutorial Introduction to the Lambda Calculus](https://arxiv.org/abs/1503.09060)

여기서 고차 함수로 이어지는 성질은 함수의 인자나 결과로 다른 함수를 사용할 수 있다는 점입니다. 이를 활용하면 구체적인 계산이 달라도 공통으로 사용할 처리 과정을 작성할 수 있습니다.

## 같은 함수를 두 번 실행하려면

값에 1을 더하는 함수와 값을 두 배로 만드는 함수가 있다고 가정해 보겠습니다.

```javascript
const increment = (x) => x + 1;
const double = (x) => x * 2;
```

각 계산을 두 번 수행하려면 다음처럼 작성할 수 있습니다.

```javascript
increment(increment(3)); // 5
double(double(3)); // 12
```

계산 내용은 다르지만, 같은 계산을 두 번 수행한다는 순서는 같습니다. 이 순서를 별도의 함수로 만들 수 있습니다.

```javascript
function twice(operation, value) {
  return operation(operation(value));
}

twice(increment, 3); // 5
twice(double, 3); // 12
```

`twice`는 첫 번째 인자로 실행할 함수를, 두 번째 인자로 그 함수에 전달할 값을 받습니다. 전달받은 함수를 한 번 실행하고, 그 결과를 같은 함수에 다시 전달합니다.

이렇게 하면 계산 종류가 늘어나도 두 번 실행하는 과정을 다시 작성하지 않아도 됩니다.

```javascript
const appendMark = (text) => `${text}!`;

twice(appendMark, '완료'); // "완료!!"
```

숫자를 매개변수로 받으면 여러 숫자에 같은 계산을 적용할 수 있습니다. 동작을 함수로 받으면 여러 계산에 같은 처리 과정을 적용할 수 있습니다.

함수를 결과로 돌려주는 것도 가능합니다. 두 번 수행할 동작을 먼저 정하고, 실제 값은 나중에 전달하도록 바꿔 보겠습니다.

```javascript
function twice(operation) {
  return function (value) {
    return operation(operation(value));
  };
}

const incrementTwice = twice(increment);

incrementTwice(3); // 5
incrementTwice(10); // 12
```

`twice(increment)`는 숫자를 계산하지 않습니다. `increment`를 두 번 수행하도록 정해진 새 함수를 만듭니다. 반환된 함수를 호출할 때 실제 값을 전달하면 됩니다.

이 구조는 람다 표기법으로 다음과 같이 표현할 수 있습니다.

```text
λf. λx. f(f(x))
```

바깥 함수는 `f`를 받고, `x`를 받아 `f`를 두 번 적용할 함수를 반환합니다. 람다 계산법에서 함수를 표현하고 적용하는 방식을 통해, 다른 함수를 사용하는 계산도 표현할 수 있습니다.

## 고차 함수에서 ‘고차’의 의미

> **고차 함수**(Higher-Order Function)는 함수를 인자로 받거나 함수를 반환하는 함수입니다.

‘고차’는 함수가 복잡하거나 성능이 좋다는 뜻이 아닙니다. 숫자나 문자열을 다루는 데서 한 단계 올라가, 함수 자체를 입력이나 결과로 다룬다는 의미입니다.

```javascript
// 숫자를 받아 숫자를 반환합니다.
const increment = (x) => x + 1;

// 함수를 받아 함수를 반환합니다.
const twice = (f) => (x) => f(f(x));
```

`increment`는 입력받은 값에 계산을 수행합니다. `twice`는 입력받은 함수를 두 번 적용하는 순서를 정합니다. 이렇게 함수 자체를 받아 사용하므로 `twice`를 고차 함수라고 부릅니다. [참고: 고차 함수를 통한 추상화](https://sicp.sourceacademy.org/chapters/1.3.html)

람다와 고차 함수는 같은 뜻은 아닙니다. 람다는 함수를 표현하는 방식이고, 고차 함수는 함수가 무엇을 받거나 반환하는지에 따른 분류입니다. 이름이 있는 `twice`도 고차 함수이며, 익명 함수인 `(x) => x + 1`은 그 자체로 고차 함수가 아닙니다.

JavaScript에서는 함수를 변수에 저장하고, 다른 함수에 전달하고, 반환값으로 사용할 수 있습니다. 이처럼 다른 값과 마찬가지로 다룰 수 있는 함수를 **일급 함수**(first-class function)라고 합니다.

JavaScript는 초기 설계부터 Lisp·Scheme의 영향을 받아 일급 함수를 지원했습니다. 함수를 객체의 프로퍼티에 저장해 메서드로 사용하거나, 이벤트가 발생했을 때 실행할 핸들러로 지정할 수 있었던 배경입니다. [JavaScript: The First 20 Years, p.9](https://www.wirfs-brock.com/allen/jshopl.pdf#page=9)

## JavaScript에서 고차 함수 활용하기

### 배열에서 필요한 값을 꺼낼 때

상품 목록에서 이름을 추출한다고 가정해 보겠습니다.

```javascript
const products = [
  { name: 'Keyboard', price: 120_000 },
  { name: 'Mouse', price: 50_000 },
];

const names = [];

for (const product of products) {
  names.push(product.name);
}
```

가격 목록이 필요하다면 같은 반복문에서 `product.price`를 가져오면 됩니다. 원소를 방문하고 결과를 모으는 과정은 같고, 각 상품에서 가져올 값만 다릅니다.

`map`은 이 달라지는 규칙을 함수로 받습니다.

```javascript
const names = products.map((product) => product.name);
const prices = products.map((product) => product.price);
```

`map`이 각 원소를 순회하며 전달받은 함수를 호출하고, 그 반환값으로 새 배열을 만듭니다. 호출자는 원소 하나를 어떻게 변환할지 작성하면 됩니다. [ECMAScript: Array.prototype.map](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array.prototype.map)

직접 구현해 보면 함수로 분리한 부분이 더 잘 보입니다. 다음 `map`은 배열의 각 원소를 콜백에 전달하고, 반환값을 새 배열에 모읍니다.

```javascript
function map(array, transform) {
  const result = [];

  for (let index = 0; index < array.length; index++) {
    const transformed = transform(array[index], index, array);
    result.push(transformed);
  }

  return result;
}

const names = map(products, (product) => product.name);
// ['Keyboard', 'Mouse']

const prices = map(products, (product) => product.price);
// [120000, 50000]
```

반복문에는 상품 이름이나 가격에 관한 코드가 없습니다. 각 원소를 어떻게 바꿀지는 `transform`에 맡기고, `map`은 그 결과를 모읍니다. 그래서 같은 `map`에 다른 함수를 전달해 이름 목록과 가격 목록을 만들 수 있습니다.

### 배열의 값을 하나의 결과로 모을 때

상품 가격의 합계를 구할 때는 원소마다 결과를 하나씩 만드는 대신, 이전까지 계산한 합계에 다음 가격을 더해야 합니다. `reduce`는 이처럼 앞선 계산 결과를 다음 계산에 전달합니다.

```javascript
const totalPrice = products.reduce(
  (total, product) => total + product.price,
  0,
);

console.log(totalPrice); // 170000
```

여기서 `0`은 계산을 시작할 초기값입니다. 첫 번째 상품을 처리하면 합계는 `120000`이 되고, 이 값이 다음 콜백의 `total`로 전달됩니다. 두 번째 상품의 가격을 더하면 최종 결과는 `170000`입니다.

이 과정을 직접 구현하면 누적값이 갱신되는 부분을 확인할 수 있습니다.

```javascript
function reduce(array, reducer, initialValue) {
  let accumulator = initialValue;

  for (let index = 0; index < array.length; index++) {
    accumulator = reducer(accumulator, array[index], index, array);
  }

  return accumulator;
}

const totalPrice = reduce(
  products,
  (total, product) => total + product.price,
  0,
);

console.log(totalPrice); // 170000
```

`accumulator`는 지금까지의 계산 결과를 보관합니다. 반복문이 한 번 돌 때마다 `reducer`가 반환한 값으로 갱신되고, 마지막 값이 `reduce`의 결과가 됩니다. 덧셈은 콜백에 있으므로, `reduce` 자체는 합계를 구한다는 사실을 알 필요가 없습니다. 누적값은 숫자뿐 아니라 객체나 배열도 될 수 있습니다.

위 두 구현은 고차 함수의 동작을 설명하기 위한 예시입니다. 빈 슬롯이 없는 배열을 사용하고, 순회 중 원본 배열을 변경하지 않으며, `reduce`에는 초기값을 반드시 전달한다고 가정했습니다. 내장 메서드는 빈 슬롯 처리와 초기 배열 길이 기록 등 추가 규칙을 따릅니다. 내장 `reduce`는 초기값을 생략하는 호출도 지원합니다. [ECMAScript: Array.prototype.reduce](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array.prototype.reduce)

다른 배열 메서드에서도 같은 방식으로 필요한 규칙을 전달합니다.

| 메서드   | 함수로 전달하는 규칙                           |
| -------- | ---------------------------------------------- |
| `map`    | 각 원소를 어떤 값으로 변환할지 정합니다.       |
| `filter` | 어떤 원소를 결과에 포함할지 정합니다.          |
| `reduce` | 현재 원소로 누적값을 어떻게 갱신할지 정합니다. |
| `sort`   | 두 원소를 어떤 순서로 배치할지 비교합니다.     |

고차 함수는 공통 처리 과정을 담당하고, 전달받은 함수는 그 과정에서 필요한 판단이나 계산을 담당합니다. [ECMAScript: Array 메서드](https://tc39.es/ecma262/multipage/indexed-collections.html)

이때 전달한 함수는 콜백이라고 부릅니다. `map`은 함수를 받으므로 고차 함수이지만, `(product) => product.name`은 객체를 받아 이름을 반환하므로 그 자체로 고차 함수는 아닙니다.

### 입력 항목마다 다른 검증이 필요할 때

함수를 반환하는 방식은 특정 용도로 사용할 함수를 만드는 데 활용할 수 있습니다.

입력값을 검증할 때는 검증 조건과 실패 메시지가 함께 필요한 경우가 있습니다. 다음 함수는 두 값을 받아 검증 함수를 만듭니다.

```javascript
function createValidator(predicate, message) {
  return function validate(value) {
    return predicate(value) ? null : message;
  };
}

const validateName = createValidator(
  (value) => value.trim().length > 0,
  '이름을 입력해 주세요.',
);

const validatePassword = createValidator(
  (value) => value.length >= 8,
  '비밀번호는 8자 이상이어야 합니다.',
);
```

규칙과 메시지를 한 번 정한 뒤에는 검증할 값만 전달합니다.

```javascript
validateName(''); // "이름을 입력해 주세요."
validateName('자몽'); // null

validatePassword('1234'); // "비밀번호는 8자 이상이어야 합니다."
```

`createValidator`는 함수를 받아 새 함수를 반환하는 고차 함수입니다. 반환된 `validate`는 자신이 만들어질 때의 `predicate`와 `message`에 계속 접근합니다. 이를 가능하게 하는 것이 클로저입니다.

고차 함수는 어떤 함수를 만들어 반환하는지 설명하고, 클로저는 반환된 함수가 필요한 변수에 접근하는 방식을 설명합니다.

### 함수에 로깅을 추가할 때

기존 함수를 다른 함수로 감싸면, 원래 코드를 수정하지 않고 실행 전후에 동작을 추가할 수 있습니다.

다음 `withLogging`은 함수를 실행하기 전에 인자를 기록하고, 실행한 뒤에는 반환값을 기록합니다.

```javascript
function withLogging(fn) {
  return function (...args) {
    console.log('호출 인자:', args);

    const result = fn.apply(this, args);

    console.log('반환값:', result);
    return result;
  };
}

const add = (a, b) => a + b;
const loggedAdd = withLogging(add);

loggedAdd(2, 3); // 로그를 남기고 5를 반환합니다.
```

`add`는 덧셈을 수행합니다. 반환된 함수는 전달받은 인자와 `this`로 `add`를 호출하고, 그 앞뒤에 로그를 추가합니다. 원래 함수의 반환값도 그대로 돌려줍니다.

이 예시는 동기 함수의 호출과 반환을 기록합니다. 비동기 함수의 완료 결과를 기록하려면 Promise가 완료되는 시점도 처리해야 합니다.

Redux 미들웨어에서도 함수를 감싸 실행 과정을 확장하는 방식을 볼 수 있습니다.

```javascript
const logger = (_store) => (next) => (action) => {
  console.log('전달된 액션:', action);
  return next(action);
};
```

이 미들웨어는 store API를 받고, 다음 처리 함수인 `next`를 받은 뒤, 액션을 처리하는 함수를 반환합니다. 액션이 들어오면 로그를 남기고 다음 처리 함수에 액션을 전달합니다.

Redux는 이런 미들웨어들을 연결해 액션 처리 과정을 확장합니다. `return next(action)`은 다음 처리 함수의 반환값을 호출자에게 전달하기 위해 필요합니다. [Redux: applyMiddleware](https://redux.js.org/api/applymiddleware), [Writing Custom Middleware](https://redux.js.org/usage/writing-custom-middleware)

### 비동기 작업이 끝난 뒤 결과를 처리할 때

비동기 처리에서는 작업이 완료된 뒤 수행할 동작을 함수로 전달합니다. `Promise.prototype.then`이 대표적인 예시입니다.

```javascript
fetch('/api/products')
  .then((response) => response.json())
  .then((products) => {
    console.log(products);
  });
```

첫 번째 콜백은 응답을 받아 JSON 본문을 읽습니다. 두 번째 콜백은 그 작업이 완료되면 변환된 데이터를 받습니다. 콜백의 실행 시점과 결과의 연결은 Promise가 관리합니다. [ECMAScript: Promise.prototype.then](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.prototype.then)

`map`에서는 각 원소에 수행할 동작을 전달했고, `then`에서는 완료 후 수행할 동작을 전달했습니다. 모두 함수를 받지만 콜백을 실행하는 시점은 다릅니다. 고차 함수라는 분류만으로 동기인지 비동기인지 정해지는 것은 아닙니다.

## 고차 함수를 사용할 때 주의할 점

앞서 살펴본 `map`은 콜백의 반환값을 모아 새 배열을 만듭니다. 다만 새 배열을 반환한다고 해서 원본 데이터도 그대로 유지된다고 생각해서는 안 됩니다. 배열 안의 객체까지 복제하는 것은 아니므로, 콜백에서 객체를 직접 수정하면 원본 배열에서도 변경된 값이 보입니다.

다음 코드는 `map`의 콜백에서 상품 가격을 직접 수정한 뒤 같은 객체를 반환합니다.

```javascript
const products = [{ price: 1000 }];

const discounted = products.map((product) => {
  product.price *= 0.9;
  return product;
});

console.log(products[0].price); // 900
console.log(products[0] === discounted[0]); // true
```

`map`이 새로 만든 것은 배열입니다. 두 배열의 첫 번째 원소는 같은 상품 객체를 가리킵니다. 같은 상품을 두 목록에 적어 놓은 것과 같아서, 상품 자체의 가격을 바꾸면 어느 목록에서 확인하더라도 바뀐 가격이 보입니다. [ECMAScript: Array.prototype.map](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array.prototype.map)

원본 상품을 유지하려면 변경된 가격을 가진 새 객체를 반환해야 합니다.

```javascript
const products = [{ price: 1000 }];

const discounted = products.map((product) => ({
  ...product,
  price: product.price * 0.9,
}));

console.log(products[0].price); // 1000
console.log(discounted[0].price); // 900
console.log(products[0] === discounted[0]); // false
```

이번에는 상품 객체도 새로 만들었으므로 원본 가격이 유지됩니다. 불변성을 판단하려면 사용한 배열 메서드와 함께 콜백 내부의 동작도 살펴봐야 합니다.

## 마무리: 함수를 전달해 동작을 재사용하기

람다 표기법으로 함수 자체를 표현하고, 함수에 다른 함수를 적용하면 구체적인 계산 방법도 입력으로 전달할 수 있습니다. JavaScript에서는 함수를 값으로 다루는 성질을 바탕으로 이러한 고차 함수를 작성합니다.

고차 함수를 통해 재사용할 수 있는 대상은 다음과 같습니다.

- **처리 과정:** 순회는 그대로 두고 변환이나 선택 규칙을 바꿉니다.
- **함수 생성 과정:** 검증 조건과 메시지처럼 필요한 설정을 받아 사용할 함수를 만듭니다.
- **실행 전후의 동작:** 기존 함수를 감싸 로그나 미들웨어 동작을 추가합니다.
- **후속 처리:** 비동기 작업이 완료된 뒤 실행할 동작을 전달합니다.

반복되는 코드에서 값만 달라진다면 값을 매개변수로 받을 수 있습니다. 수행할 동작이 달라진다면 그 동작을 함수로 받을 수 있습니다. 고차 함수는 계산할 값뿐 아니라 계산 방법까지 전달하고 재사용할 수 있게 합니다.
