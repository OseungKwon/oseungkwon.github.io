import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image().optional(),
      category: z.enum(['book', 'tech']),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    }),
});

const careerSchema = z.object({
  title: z.string(),
  category: z.string(),
  order: z.number().int().nonnegative(),
  /** featured: 상단 대표 프로젝트, other: 하단 '그 외 프로젝트' */
  tier: z.enum(['featured', 'other']).default('featured'),
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

export const collections = { blog, career };
