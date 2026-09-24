import type { APIContext } from 'astro';
import { getPublishedPosts } from '../utils/posts';
import { getArchivedTags } from '../utils/tags';
import { getPublishedAlgorithms } from '../utils/algorithms';

type ChangeFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: ChangeFrequency;
  priority?: number;
  image?: string;
}

// 정적 페이지는 실제로 색인할 공개 경로만 명시한다.
// trailingSlash: 'always' 설정에 맞춰 모든 경로 끝에 슬래시를 붙인다.
const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: 1 },
  { path: '/about/', changefreq: 'monthly', priority: 0.8 },
  { path: '/tags/', changefreq: 'weekly', priority: 0.6 },
  { path: '/algorithm/', changefreq: 'weekly', priority: 0.7 },
  { path: '/contact/', changefreq: 'yearly', priority: 0.5 },
] satisfies Array<{
  path: string;
  changefreq: ChangeFrequency;
  priority: number;
}>;

const escapeXml = (value: string) =>
  value.replace(
    /[<>&'\"]/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[character]!,
  );

const renderEntry = ({
  loc,
  lastmod,
  changefreq,
  priority,
  image,
}: SitemapEntry) => `  <url>
    <loc>${escapeXml(loc)}</loc>${
      lastmod
        ? `
    <lastmod>${lastmod}</lastmod>`
        : ''
    }${
      changefreq
        ? `
    <changefreq>${changefreq}</changefreq>`
        : ''
    }${
      priority !== undefined
        ? `
    <priority>${priority.toFixed(1)}</priority>`
        : ''
    }${
      image
        ? `
    <image:image>
      <image:loc>${escapeXml(image)}</image:loc>
    </image:image>`
        : ''
    }
  </url>`;

export async function GET(context: APIContext) {
  const site = context.site!; // astro.config.mjs의 site로 항상 존재한다.
  const posts = (await getPublishedPosts()).sort(
    (a, b) =>
      (b.data.updatedDate ?? b.data.pubDate).valueOf() -
      (a.data.updatedDate ?? a.data.pubDate).valueOf(),
  );
  const latestPostDate = posts[0]?.data.updatedDate ?? posts[0]?.data.pubDate;

  const staticEntries: SitemapEntry[] = STATIC_PAGES.map(
    ({ path, ...metadata }) => ({
      loc: new URL(path, site).href,
      ...metadata,
      // 홈은 글 목록이므로 가장 최근 글의 변경 시점을 페이지 변경 시점으로 사용한다.
      ...(path === '/' && latestPostDate
        ? { lastmod: latestPostDate.toISOString() }
        : {}),
    }),
  );

  const postEntries: SitemapEntry[] = posts.map((post) => ({
    loc: new URL(`/post/${post.id}/`, site).href,
    lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString(),
    changefreq: 'monthly',
    priority: 0.8,
    // 대표 이미지가 있는 글은 이미지 검색에서도 발견할 수 있도록 함께 제공한다.
    ...(post.data.heroImage
      ? { image: new URL(post.data.heroImage.src, site).href }
      : {}),
  }));

  // 태그 아카이브는 글이 새로 붙을 때 목록이 바뀌므로, 그 태그에서 가장 최근
  // 글의 시점을 페이지 변경 시점으로 삼는다.
  const tagEntries: SitemapEntry[] = (await getArchivedTags()).map((group) => ({
    loc: new URL(`/tags/${group.slug}/`, site).href,
    lastmod: (
      group.posts[0].data.updatedDate ?? group.posts[0].data.pubDate
    ).toISOString(),
    changefreq: 'weekly',
    priority: 0.6,
  }));

  const algorithmEntries: SitemapEntry[] = (await getPublishedAlgorithms()).map(
    (entry) => ({
      loc: new URL(`/algorithm/${entry.id}/`, site).href,
      lastmod: (entry.data.updatedDate ?? entry.data.pubDate).toISOString(),
      changefreq: 'monthly',
      priority: 0.7,
    }),
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...staticEntries, ...tagEntries, ...postEntries, ...algorithmEntries].map(renderEntry).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
