import { getCollection } from 'astro:content';

// 발행된 글 목록을 반환한다.
// 프로덕션 빌드에서는 draft 글을 제외하고, dev에서는 미리보기를 위해 포함한다.
// 색인·sitemap·RSS·목록이 모두 이 함수를 거치게 해 노출 기준을 한곳에서 관리한다.
export async function getPublishedPosts() {
  return getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
}

// 페이지를 만들 글 전체를 반환한다. draft 글도 포함한다.
// draft는 목록·sitemap·RSS·태그·관련 글 어디에도 걸리지 않고 noindex가 붙으므로,
// 검색엔진에는 드러나지 않되 링크를 아는 사람은 직접 열어 볼 수 있다.
export async function getAllPosts() {
  return getCollection('blog');
}
