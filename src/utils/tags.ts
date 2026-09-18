import type { CollectionEntry } from 'astro:content';
import { getPublishedPosts } from './posts';

/**
 * 같은 주제를 가리키는데 표기만 다른 태그를 하나로 모은다.
 * 글마다 영문·한글 표기가 섞이면 같은 주제의 글이 서로 다른 태그로 흩어져
 * 아카이브가 잘게 쪼개지고, 검색엔진 입장에서도 주제 묶음이 흐려진다.
 */
const TAG_ALIASES: Record<string, string> = {
  'Design System': '디자인 시스템',
  'Frontend Architecture': '아키텍처',
  'Compound Components': '컴파운드 컴포넌트 패턴',
};

/**
 * 아카이브 URL에 쓸 영문 슬러그.
 * 한글 태그는 인코딩되면 주소가 읽기 어려워지므로 주요 태그만 직접 지정한다.
 */
const TAG_SLUGS: Record<string, string> = {
  React: 'react',
  TypeScript: 'typescript',
  JavaScript: 'javascript',
  'Next.js': 'nextjs',
  AI: 'ai',
  프론트엔드: 'frontend',
  아키텍처: 'architecture',
  '디자인 시스템': 'design-system',
  '컴파운드 컴포넌트 패턴': 'compound-components',
  '함수형 프로그래밍': 'functional-programming',
  '도메인 모델링': 'domain-modeling',
  리팩터링: 'refactoring',
  '성능 최적화': 'performance',
};

/**
 * 글이 한 편뿐인 태그까지 페이지로 만들면 본문이 거의 없는 목록 페이지가
 * 수십 개 생긴다. 이런 페이지는 색인되더라도 사이트 전체의 품질 평가를
 * 끌어내리므로, 글이 이 수 이상 쌓인 태그만 아카이브를 연다.
 */
export const MIN_POSTS_PER_TAG = 2;

type Post = CollectionEntry<'blog'>;

export interface TagGroup {
  /** 정규화된 표시용 태그 이름 */
  name: string;
  /** /tags/<slug>/ 에 쓰이는 값 */
  slug: string;
  /** 최신 글이 앞에 오도록 정렬된 목록 */
  posts: Post[];
}

export const normalizeTag = (tag: string) => TAG_ALIASES[tag] ?? tag;

export const tagSlug = (tag: string) => {
  const name = normalizeTag(tag);
  return (
    TAG_SLUGS[name] ??
    name.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')
  );
};

const byNewest = (a: Post, b: Post) =>
  b.data.pubDate.valueOf() - a.data.pubDate.valueOf();

/** 발행된 글 전체를 정규화된 태그 기준으로 묶는다. 글이 많은 태그가 앞에 온다. */
export async function getTagGroups(): Promise<TagGroup[]> {
  const posts = await getPublishedPosts();
  const groups = new Map<string, Post[]>();

  for (const post of posts) {
    // 한 글에 'Design System'과 '디자인 시스템'이 함께 있어도 한 번만 센다.
    const names = new Set(post.data.tags.map(normalizeTag));
    for (const name of names) {
      const bucket = groups.get(name) ?? [];
      bucket.push(post);
      groups.set(name, bucket);
    }
  }

  return [...groups.entries()]
    .map(([name, tagged]) => ({
      name,
      slug: tagSlug(name),
      posts: [...tagged].sort(byNewest),
    }))
    .sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
}

/** 아카이브 페이지를 여는 태그만 추린다. sitemap과 목록 페이지가 이 기준을 공유한다. */
export async function getArchivedTags(): Promise<TagGroup[]> {
  const groups = await getTagGroups();
  return groups.filter((group) => group.posts.length >= MIN_POSTS_PER_TAG);
}

/**
 * 한 글의 태그를 화면에 뿌릴 때 쓸 정보.
 * 아카이브가 있는 태그만 링크로 만들고, 나머지는 라벨로 남긴다.
 */
export async function getTagLinks(post: Post) {
  const archived = new Map(
    (await getArchivedTags()).map((group) => [group.name, group.slug]),
  );
  const seen = new Set<string>();

  return post.data.tags.flatMap((raw) => {
    const name = normalizeTag(raw);
    if (seen.has(name)) return [];
    seen.add(name);
    return [{ name, href: archived.has(name) ? `/tags/${archived.get(name)}/` : null }];
  });
}

/**
 * 같은 태그를 많이 공유하는 글을 관련 글로 고른다.
 * 겹치는 태그 수가 같으면 최근 글을 앞에 둔다.
 *
 * 겹치는 글이 모자라면 최신 글로 채운다. 태그가 홀로 떨어진 글도 다른 글로
 * 이어져야, 어느 글에 들어오든 나머지 글까지 읽고 크롤링될 길이 생긴다.
 */
export async function getRelatedPosts(post: Post, limit = 3): Promise<Post[]> {
  const posts = await getPublishedPosts();
  const own = new Set(post.data.tags.map(normalizeTag));
  const others = posts.filter((candidate) => candidate.id !== post.id);

  const byOverlap = others
    .map((candidate) => ({
      post: candidate,
      overlap: candidate.data.tags.filter((tag) => own.has(normalizeTag(tag)))
        .length,
    }))
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || byNewest(a.post, b.post))
    .map(({ post: related }) => related);

  const picked = byOverlap.slice(0, limit);
  if (picked.length === limit) return picked;

  const chosen = new Set(picked.map((related) => related.id));
  const filler = [...others]
    .sort(byNewest)
    .filter((candidate) => !chosen.has(candidate.id));

  return [...picked, ...filler].slice(0, limit);
}
