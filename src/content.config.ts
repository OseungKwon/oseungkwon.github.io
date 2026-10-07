import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { ALGORITHM_FAMILIES } from './utils/algorithm-families';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image().optional(),
      category: z.enum(['book', 'tech']),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    }),
});

const algorithm = defineCollection({
  loader: glob({ base: './src/content/algorithm', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    /** 알고리즘 이름 (예: '백트래킹') */
    title: z.string(),
    /** 한두 문장 설명. 상세 페이지 부제와 목록·meta description에 함께 쓴다 */
    summary: z.string(),
    family: z.enum(ALGORITHM_FAMILIES),
    complexity: z
      .object({
        time: z.string(),
        space: z.string().optional(),
      })
      .optional(),
    /** 대표 문제. 첫 항목이 가장 대표적인 문제다 */
    problems: z
      .array(
        z.object({
          platform: z.enum(['leetcode', 'boj', 'programmers']),
          id: z.string(),
          title: z.string(),
          url: z.string().url(),
          difficulty: z.string().optional(),
        }),
      )
      .min(1),
    /** 같은 알고리즘을 깊게 다룬 블로그 글의 slug */
    relatedPost: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
  }),
});

/**
 * 읽고 좋았던 외부 글. 항목은 GitHub 이슈 폼이나 `pnpm curate`가 만든다(scripts/curation/).
 * 제목·출처는 입력이 없으면 페이지 메타나 도메인으로 반드시 채워지고, 요약은 메타가 없으면 빠진다.
 */
const curation = defineCollection({
  loader: glob({ base: './src/content/curation', pattern: '**/*.md' }),
  schema: z.object({
    /** blog: 블로그 자체를 추천, article: 글 한 편을 추천 */
    kind: z.enum(['article', 'blog']).default('article'),
    title: z.string(),
    url: z.string().url(),
    source: z.string(),
    summary: z.string().optional(),
    /** 왜 골랐는지. 요약은 원문에서 오지만 이 값은 내 관점이다 */
    comment: z.string().optional(),
    tags: z.array(z.string()).default([]),
    savedAt: z.coerce.date(),
  }),
});

const careerSchema = z.object({
  title: z.string(),
  category: z.string(),
  order: z.number().int().nonnegative(),
  /** featured: 상단 대표 프로젝트, other: 하단 '그 외 프로젝트' */
  tier: z.enum(['featured', 'other']).default('featured'),
  /** 기간이 길어 시간순 정렬이 어색한 나열 카드를 맨 뒤로 고정한다 */
  pinLast: z.boolean().default(false),
  startDate: z.string().regex(/^\d{4}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}$/),
  summary: z.string(),
  technologies: z.array(z.string()).min(1),
  /** 나열 성격의 카드는 생략할 수 있다 */
  change: z
    .object({
      before: z.string(),
      after: z.string(),
      impact: z.string(),
    })
    .optional(),
  links: z
    .array(
      z.object({
        type: z.string(),
        label: z.string(),
        href: z.string(),
        external: z.boolean().default(false),
      }),
    )
    .default([]),
});

const career = defineCollection({
  loader: glob({ base: './src/content/career', pattern: '**/*.{md,mdx}' }),
  schema: careerSchema,
});

const RESUME_VARIANT_BASE = './src/content/resume-variants';

/** 회사별 소개문·요약과 프로젝트 선택·순서. resume-variants/<회사>/index.mdx */
const resumeVariant = defineCollection({
  loader: glob({
    base: RESUME_VARIANT_BASE,
    pattern: '*/index.mdx',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    company: z.string(),
    position: z.string(),
    posting: z.string().url().optional(),
    /** 소개 제목 아래 한 줄 요약. 본문은 mdx 본문이 대신한다 */
    lead: z.string(),
    overview: z.object({
      /** 비워 두면 경력 칸을 뺀다 */
      career: z.string().optional(),
      stack: z.string(),
      focus: z.string(),
    }),
    /** 대표 프로젝트. 날짜와 무관하게 적은 순서대로 보여준다 */
    featured: z.array(z.string()).min(1),
    /** 그 외 프로젝트. featured·other 어디에도 없는 프로젝트는 이 버전에서 뺀다 */
    other: z.array(z.string()).default([]),
  }),
});

/**
 * 회사별로 프로젝트 문구만 덮어쓴다. resume-variants/<회사>/projects/<career id>.mdx
 * 적은 필드만 바뀌고, 본문을 쓰면 원본 본문을 대신한다. 사실은 career 원본에만 둔다.
 */
const resumeVariantProject = defineCollection({
  loader: glob({
    base: RESUME_VARIANT_BASE,
    pattern: '*/projects/*.mdx',
    generateId: ({ entry }) => entry.replace(/\.mdx$/, ''),
  }),
  schema: careerSchema
    .pick({ title: true, summary: true, technologies: true })
    .partial()
    .extend({
      change: careerSchema.shape.change.unwrap().partial().optional(),
    }),
});

export const collections = {
  blog,
  algorithm,
  curation,
  career,
  resumeVariant,
  resumeVariantProject,
};
