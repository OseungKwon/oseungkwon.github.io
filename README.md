# My Blog

A modern blog built with Astro, featuring content collections and a clean design.

## 🚀 Project Structure

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/
│   │   └── blog/          # Blog images
│   ├── components/
│   │   ├── Header.astro
│   │   ├── PostCard.astro
│   │   └── PostListItem.astro
│   ├── content/
│   │   ├── blog/          # Blog posts (Markdown)
│   │   └── config.ts      # Content collections config
│   ├── layouts/
│   │   └── Layout.astro
│   ├── pages/
│   │   ├── blog/
│   │   │   └── [...slug].astro
│   │   └── index.astro
│   └── styles/
│       └── global.css
└── package.json
```

## 🧞 Commands

All commands are run from the root of the project:

| Command        | Action                                       |
| :------------- | :------------------------------------------- |
| `pnpm install` | Installs dependencies                        |
| `pnpm dev`     | Starts local dev server at `localhost:4321`  |
| `pnpm build`   | Build your production site to `./dist/`      |
| `pnpm preview` | Preview your build locally, before deploying |

## 📝 Writing Blog Posts

Blog posts are written in Markdown and stored in `src/content/blog/`. Each post should have frontmatter with:

- `title`: Post title
- `description`: Post description
- `pubDate`: Publication date
- `heroImage`: Path to hero image (use `@assets/blog/image.png` format)

## 🎨 Path Aliases

- `@assets/*` → `src/assets/*`

## 📌 큐레이션 추가하기

`/curation/`의 항목은 `src/content/curation/`의 md 파일 하나씩이다. 직접 쓰지 않고 아래 두 경로 중 하나로 만든다. 어느 쪽이든 URL만 넣으면 제목·출처·요약은 페이지의 og 메타에서, 없으면 도메인으로 채운다.

### 브라우저에서 (북마클릿)

북마크바에 새 북마크를 만들고 URL 칸에 아래 한 줄을 붙여 넣는다. 읽던 글에서 누르면 그 주소가 채워진 큐레이션 이슈 폼이 새 탭으로 열린다.

```text
javascript:(()=>{const u=new URL('https://github.com/OseungKwon/oseungkwon.github.io/issues/new');u.searchParams.set('template','curation.yml');u.searchParams.set('title','[큐레이션] '+document.title);u.searchParams.set('article_url',location.href);window.open(u,'_blank')})();
```

폼에서 종류(아티클/블로그)와 코멘트를 고르고 제출하면 `.github/workflows/curation.yml`이 항목 파일을 만들고, 빌드로 검증한 뒤 Pull Request를 연다. 어떤 값이 어디서 왔는지와 PR 링크는 이슈 댓글로 남는다. PR을 머지하면 이슈가 닫히고 배포된다.

- 이슈는 어느 계정으로든 열 수 있다. master 반영은 PR 머지로만 되므로, 쓰기 권한이 있는 저장소 주인만 할 수 있다.
- 라벨(`curation`)은 폼이 자동으로 붙인다. 이 라벨이 있는 열린 이슈만 처리한다.
- 이슈 본문을 고치거나 닫았다 다시 열면 같은 PR을 새 내용으로 갱신한다. 값을 조금 고치는 정도는 PR에서 파일을 직접 고쳐도 된다.
- 이미 있는 URL이면 PR을 만들지 않고 이슈를 닫는다.
- 머지는 master에 커밋을 남기므로, 로컬에서 작업하기 전에 `git pull`을 먼저 한다.
- GitHub처럼 보안 정책(CSP)으로 북마클릿을 막는 사이트에서는 이슈 폼을 직접 열어 URL을 붙여 넣는다.

### 터미널에서

```bash
pnpm curate <URL> [--kind blog] [--title ..] [--source ..] [--summary ..] [--comment ..] [--tags "React, 성능"]
```

파일만 만들고 커밋은 하지 않는다. 종류의 기본값은 아티클이고, 블로그(`--kind blog`)는 사이트 이름을 제목으로, 도메인을 출처로 쓴다.
