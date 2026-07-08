// @ts-check
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// 글 slug -> 최종 수정일(수정일 없으면 발행일) 맵을 만든다.
// sitemap의 <lastmod>에 넣어 크롤러가 변경된 글을 우선 재수집하도록 한다.
// content collection은 이 시점에 로드되지 않으므로 frontmatter를 직접 읽는다.
function readPostDates() {
  const dates = new Map();
  const dir = new URL('./src/content/blog/', import.meta.url);
  for (const file of readdirSync(dir)) {
    if (!/\.mdx?$/.test(file)) continue;
    const fm = readFileSync(new URL(file, dir), 'utf-8').split(/^---$/m)[1] ?? '';
    // 날짜 구분자는 . - / 를 모두 허용하고, new Date가 이해하도록 -로 정규화한다.
    const updated = fm.match(/^\s*updatedDate:\s*['"]?([\d./-]+)/m)?.[1];
    const pub = fm.match(/^\s*pubDate:\s*['"]?([\d./-]+)/m)?.[1];
    const raw = updated ?? pub;
    if (raw) dates.set(file.replace(/\.mdx?$/, ''), new Date(raw.replace(/\./g, '-')));
  }
  return dates;
}

const postDates = readPostDates();

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
  integrations: [
    mdx(),
    sitemap({
      // rss.xml 등 HTML이 아닌 엔드포인트는 sitemap에서 제외한다.
      filter: (page) => !page.includes('/rss.xml'),
      // 글 페이지에 lastmod를 채운다. draft 글은 빌드되지 않아 애초에 포함되지 않는다.
      serialize(item) {
        const slug = item.url.match(/\/post\/([^/]+)\/?$/)?.[1];
        const date = slug && postDates.get(slug);
        if (date) item.lastmod = date.toISOString();
        return item;
      },
    }),
  ],
  markdown: {
    rehypePlugins: [rehypeTableWrapper],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
