import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  // Type-check frontmatter using a schema
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      // Transform string to Date object
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image().optional(),
      category: z.enum(['book', 'tech']),
      tags: z.array(z.string()).default([]),
      // 초안 표시. true면 프로덕션 빌드(색인/sitemap/RSS)에서 제외된다.
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog };
