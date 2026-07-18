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
  // sitemap은 src/pages/sitemap.xml.ts에서 단일 평면 파일로 직접 생성한다.
  integrations: [mdx()],
  markdown: {
    rehypePlugins: [rehypeTableWrapper],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
