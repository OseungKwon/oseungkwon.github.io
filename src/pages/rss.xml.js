import rss from '@astrojs/rss';
import { getAlgorithms } from '../utils/algorithms';
import { getPublishedPosts } from '../utils/posts';

const SITE_TITLE = '오승의 기술블로그';
const SITE_DESCRIPTION =
  '프론트엔드 개발 경험과 라이브러리 코드 분석을 기록하는 오승의 기술블로그.';

export async function GET(context) {
  const posts = (await getPublishedPosts()).map((post) => ({
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.pubDate,
    categories: post.data.tags,
    link: `/post/${post.id}/`,
  }));

  // 알고리즘 항목도 같은 피드에 싣는다. 구독자가 글과 구분할 수 있게 '알고리즘'과 분류를 카테고리로 단다.
  const algorithms = (await getAlgorithms()).map((entry) => ({
    title: entry.data.title,
    description: entry.data.summary,
    pubDate: entry.data.pubDate,
    categories: ['알고리즘', entry.data.family],
    link: `/algorithm/${entry.id}/`,
  }));

  const items = [...posts, ...algorithms].sort(
    (a, b) => b.pubDate.valueOf() - a.pubDate.valueOf(),
  );

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    trailingSlash: true,
    items,
    customData: `<language>ko</language>`,
  });
}
