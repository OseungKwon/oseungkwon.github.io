import { getCollection } from 'astro:content';

// 발행된 글 목록을 반환한다.
// 프로덕션 빌드에서는 draft 글을 제외하고, dev에서는 미리보기를 위해 포함한다.
// 색인·sitemap·RSS·목록이 모두 이 함수를 거치게 해 노출 기준을 한곳에서 관리한다.
export async function getPublishedPosts() {
  return getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
}
