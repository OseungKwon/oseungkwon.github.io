// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';

// 마크다운 표를 가로 스크롤 컨테이너로 감싼다.
// 표가 화면 폭을 넘기면 페이지가 아니라 표 자체가 스크롤되도록 한다.
function rehypeTableWrapper() {
  const wrap = (node) => {
    if (!node.children) return;
    node.children = node.children.map((child) => {
      wrap(child);
      if (child.type === 'element' && child.tagName === 'table') {
        return {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-wrapper'] },
          children: [child],
        };
      }
      return child;
    });
  };
  return (tree) => wrap(tree);
}

// 본문 링크는 새 탭으로 연다. 참고 문서를 확인하고 돌아올 때 읽던 위치를 잃지 않게 한다.
// 같은 글 안의 앵커(#...)는 제자리 이동이므로 제외한다.
function rehypeLinkNewTab() {
  const visit = (node) => {
    if (node.type === 'element' && node.tagName === 'a') {
      const href = String(node.properties?.href ?? '');
      if (href && !href.startsWith('#')) {
        node.properties.target = '_blank';
        node.properties.rel = ['noopener', 'noreferrer'];
      }
    }
    node.children?.forEach(visit);
  };
  return (tree) => visit(tree);
}

// https://astro.build/config
export default defineConfig({
  // GitHub Pages 배포를 위한 설정
  // 리포지토리 이름에 맞게 수정해주세요
  // 예: 리포지토리가 username.github.io면 site: 'https://username.github.io', base: '/'
  // 예: 리포지토리가 blog면 site: 'https://username.github.io', base: '/blog/'
  site: 'https://oseungkwon.github.io',
  base: '/',
  // 모든 페이지 URL을 끝 슬래시(/post/slug/)로 통일한다.
  // canonical·sitemap·RSS 링크가 일치해야 중복 색인을 피할 수 있다.
  trailingSlash: 'always',

  // 모바일에는 hover가 없어 hover 전략은 데스크톱에서만 동작한다.
  // viewport 전략은 링크가 화면에 300ms 머물면 미리 받으므로, 손가락이
  // 링크에 닿기 전에 문서가 캐시에 들어와 있다.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  build: {
    // CSS를 페이지마다 인라인하면 이동할 때마다 같은 66KB를 다시 받는다.
    // 외부 파일로 빼면 첫 페이지에서 받은 것이 다음 글에서 캐시로 재사용된다.
    inlineStylesheets: 'auto',
  },
  integrations: [mdx()],
  markdown: {
    rehypePlugins: [rehypeTableWrapper, rehypeLinkNewTab],
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // 모든 페이지가 공유하는 큰 CSS는 외부 파일로 남겨 캐시에 태우고,
      // 특정 글에서만 쓰는 몇 KB짜리 컴포넌트 CSS는 문서 안에 넣는다.
      // 1KB짜리라도 따로 받으면 렌더를 막는 왕복이 한 번 더 생긴다.
      assetsInlineLimit: (filePath, content) =>
        filePath.endsWith('.css') ? content.length < 12 * 1024 : undefined,
    },
  },
});
