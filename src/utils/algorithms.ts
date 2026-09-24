import { getCollection, type CollectionEntry } from 'astro:content';
import { ALGORITHM_FAMILIES } from './algorithm-families';

export { ALGORITHM_FAMILIES, type AlgorithmFamily } from './algorithm-families';

export const PLATFORM_LABELS = {
  leetcode: 'LeetCode',
  boj: '백준',
  programmers: '프로그래머스',
} as const;

// 알고리즘 항목은 draft 없이 파일을 추가하면 바로 공개된다.
export async function getAlgorithms() {
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
