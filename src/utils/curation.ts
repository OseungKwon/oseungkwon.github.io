import { getCollection, type CollectionEntry } from 'astro:content';

type CurationData = CollectionEntry<'curation'>['data'];
export type CurationKind = CurationData['kind'];

export interface CurationItem {
  id: string;
  /** 종류와 상관없이 모은 순서대로 매긴 번호. 가장 먼저 모은 항목이 1번이다 */
  no: number;
  data: CurationData;
}

/** 필터 칩 순서와 화면에 보일 이름 */
export const CURATION_KINDS: Array<{ kind: CurationKind; label: string }> = [
  { kind: 'blog', label: '블로그' },
  { kind: 'article', label: '아티클' },
];

export const kindLabel = (kind: CurationKind) =>
  CURATION_KINDS.find((item) => item.kind === kind)!.label;

// 큐레이션 항목은 draft 없이 파일이 추가되면 바로 공개된다. 최근에 저장한 항목이 앞에 온다.
export async function getCuration(): Promise<CurationItem[]> {
  const entries = await getCollection('curation');
  const newestFirst = entries.sort(
    (a, b) =>
      b.data.savedAt.valueOf() - a.data.savedAt.valueOf() ||
      b.id.localeCompare(a.id),
  );
  return newestFirst.map((entry, index) => ({
    id: entry.id,
    no: newestFirst.length - index,
    data: entry.data,
  }));
}

/** 저장 시각은 UTC라 한국 시간으로 날짜를 끊는다. 예: 2026.10.04 */
export const formatSavedDate = (date: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' })
    .format(date)
    .replaceAll('-', '.');

export const formatNo = (no: number) => `No. ${String(no).padStart(3, '0')}`;
