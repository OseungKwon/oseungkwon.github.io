import { getCollection, type CollectionEntry } from 'astro:content';
import { ALGORITHM_FAMILIES } from './algorithm-families';

export { ALGORITHM_FAMILIES, type AlgorithmFamily } from './algorithm-families';

export const PLATFORM_LABELS = {
  leetcode: 'LeetCode',
  boj: '백준',
  programmers: '프로그래머스',
} as const;

// 글과 같은 노출 기준을 쓴다. 프로덕션에서는 draft를 빼고, dev에서는 미리보기를 위해 포함한다.
export async function getPublishedAlgorithms() {
  return getCollection('algorithm', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
}

// 페이지를 만들 항목 전체. draft도 링크로 직접 열 수 있게 포함한다(noindex가 붙는다).
export async function getAllAlgorithms() {
  return getCollection('algorithm');
}

/** 분류 순서대로 묶고, 묶음 안에서는 제목 가나다순으로 정렬한다. */
export function groupByFamily(entries: CollectionEntry<'algorithm'>[]) {
  return ALGORITHM_FAMILIES.map((family) => ({
    family,
    entries: entries
      .filter((entry) => entry.data.family === family)
      .sort((a, b) => a.data.title.localeCompare(b.data.title, 'ko')),
  })).filter((group) => group.entries.length > 0);
}
