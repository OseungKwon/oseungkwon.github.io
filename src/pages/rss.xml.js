import rss from '@astrojs/rss';
import { getPublishedPosts } from '../utils/posts';

const SITE_TITLE = '자몽의 기술블로그';
const SITE_DESCRIPTION =
  '프론트엔드 개발 경험과 라이브러리 코드 분석을 기록하는 자몽의 기술블로그.';

export async function GET(context) {
  const posts = (await getPublishedPosts()).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      categories: post.data.tags,
      link: `/post/${post.slug}/`,
    })),
    customData: `<language>ko</language>`,
  });
}
