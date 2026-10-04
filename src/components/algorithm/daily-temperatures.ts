/**
 * 단조 스택 — LeetCode 739 「Daily Temperatures」의 계산 모음. 단계 진행(MonotonicStackWalk),
 * 본문 정적 그림(MonotonicStackSnapshot), 도형(MonotonicStackDiagram)이 같은 계산을 쓴다.
 */

/** LeetCode 739 예제 1 */
export const TEMPERATURES = [73, 74, 75, 71, 69, 72, 76, 73];
/** 예제 1 출력 */
export const EXPECTED = [1, 1, 4, 2, 1, 1, 0, 0];

/** 본문의 대표 풀이와 같은 로직 */
export function dailyTemperatures(temperatures: number[]): number[] {
  const answer = new Array(temperatures.length).fill(0);
  const stack: number[] = [];
  for (let i = 0; i < temperatures.length; i++) {
    while (stack.length > 0 && temperatures[stack[stack.length - 1]] < temperatures[i]) {
      const waitingDay = stack.pop()!;
      answer[waitingDay] = i - waitingDay;
    }
    stack.push(i);
  }
  return answer;
}

/** 날마다 오른쪽을 끝까지 훑는 O(n²) 풀이. 검증용 */
export function bruteForce(temperatures: number[]): number[] {
  return temperatures.map((t, i) => {
    for (let j = i + 1; j < temperatures.length; j++) if (temperatures[j] > t) return j - i;
    return 0;
  });
}

/**
 * 앞의 days일만 처리했을 때의 스택(날짜 번호)과 정해진 답(아직이면 null).
 * days가 전체 길이면 반복이 끝난 것이므로 스택에 남은 날의 답을 0으로 정한다.
 */
export function runDays(temperatures: number[], days: number) {
  const answers: (number | null)[] = new Array(temperatures.length).fill(null);
  const stack: number[] = [];
  for (let i = 0; i < days; i++) {
    while (stack.length > 0 && temperatures[stack[stack.length - 1]] < temperatures[i]) {
      const waitingDay = stack.pop()!;
      answers[waitingDay] = i - waitingDay;
    }
    stack.push(i);
  }
  if (days === temperatures.length) stack.forEach((day) => (answers[day] = 0));
  return { stack, answers };
}
