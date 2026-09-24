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

export const collections = { blog, algorithm, career };
