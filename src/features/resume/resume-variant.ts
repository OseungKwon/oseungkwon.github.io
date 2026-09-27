import { getCollection, getEntry, render } from 'astro:content';
import type { ProjectOverride, ResumeSelection } from './resume';

export async function getResumeVariantIds() {
  return (await getCollection('resumeVariant')).map(({ id }) => id);
}

/** 회사별 소개 문구와, getResume에 넘길 프로젝트 선택·덮어쓰기를 함께 만든다. */
export async function getResumeVariant(variantId: string) {
  const variant = await getEntry('resumeVariant', variantId);
  if (!variant) throw new Error(`회사별 이력서가 없습니다: ${variantId}`);

  const projectEntries = await getCollection('resumeVariantProject', ({ id }) =>
    id.startsWith(`${variantId}/projects/`),
  );
  const overrides = new Map<string, ProjectOverride>(
    await Promise.all(
      projectEntries.map(
        async (entry) =>
          [
            entry.id.split('/').at(-1)!,
            {
              data: entry.data,
              // 프론트매터만 적은 파일은 문구만 바꾸고 본문은 원본을 쓴다.
              Content: entry.body?.trim()
                ? (await render(entry)).Content
                : undefined,
            },
          ] as const,
      ),
    ),
  );

  const { lead, overview, featured, other } = variant.data;
  const selection: ResumeSelection = { featured, other, overrides };

  return {
    selection,
    intro: { lead, overview, Intro: (await render(variant)).Content },
  };
}
