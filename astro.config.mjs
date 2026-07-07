// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

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
  integrations: [mdx(), sitemap()],
  markdown: {
    rehypePlugins: [rehypeTableWrapper],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
