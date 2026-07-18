import type { APIContext } from 'astro';
import { getPublishedPosts } from '../utils/posts';

// 단일 평면(sitemap.xml) 사이트맵을 직접 생성한다.
// @astrojs/sitemap이 만드는 index(sitemap-index.xml) + child(sitemap-0.xml) 2단 구조 대신,
// 모든 URL을 한 파일에 담아 크롤러가 관례 경로(/sitemap.xml)에서 바로 읽게 한다.
// 노출 기준(draft 제외)은 RSS·목록과 동일한 getPublishedPosts()로 통일한다.

// 글이 아닌 정적 페이지. trailingSlash: 'always' 설정에 맞춰 끝 슬래시를 붙인다.
const STATIC_PATHS = ['/', '/contact/'];

export async function GET(context: APIContext) {
  const site = context.site!; // astro.config.mjs의 site로 항상 존재한다.
  const posts = await getPublishedPosts();

  const entries = [
    ...STATIC_PATHS.map((path) => ({ loc: new URL(path, site).href })),
    ...posts.map((post) => ({
      loc: new URL(`/post/${post.slug}/`, site).href,
      // 수정일이 없으면 발행일을 lastmod로 쓴다. 크롤러가 변경 글을 우선 재수집하게 한다.
      lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString(),
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url><loc>${e.loc}</loc>${'lastmod' in e ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
