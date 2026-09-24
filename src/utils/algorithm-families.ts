// content.config.ts가 읽는 값이라 astro:content를 import하지 않는 파일에 둔다.

/**
 * 알고리즘 분류. 목록 페이지는 이 순서대로 묶어 보여준다.
 * 자유 문자열로 두면 '완전탐색'과 '완전 탐색'처럼 표기만 다른 묶음이 생기므로
 * 스키마에서 이 목록으로 고정한다.
 */
export const ALGORITHM_FAMILIES = [
  '완전 탐색',
  '그래프',
  '동적 계획법',
  '그리디',
  '투 포인터·슬라이딩 윈도우',
  '이분 탐색',
  '누적 합',
  '정렬',
  '자료구조',
  '문자열',
  '수학',
] as const;

export type AlgorithmFamily = (typeof ALGORITHM_FAMILIES)[number];
