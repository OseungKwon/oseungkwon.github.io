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
  startDate: z.string().regex(/^\d{4}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}$/),
  summary: z.string(),
  roles: z.array(z.string()).min(1),
  technologies: z.array(z.string()).min(1),
  change: z.object({
    before: z.string(),
    after: z.string(),
    impact: z.string(),
  }),
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

const resume = defineCollection({
  loader: glob({ base: './src/content/resume', pattern: '**/*.{md,mdx}' }),
  schema: careerSchema,
});

export const collections = { blog, career, resume };
