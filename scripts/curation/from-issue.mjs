// GitHub Action(.github/workflows/curation.yml)에서 이슈 폼 본문으로 큐레이션 항목을 만든다.
// 결과는 GITHUB_OUTPUT(status, file, title)과 COMMENT_FILE(이슈에 남길 댓글)로 넘긴다.
import { appendFile, writeFile } from 'node:fs/promises';
import { createEntry, originTable } from './core.mjs';

/**
 * 이슈 폼 본문은 칸마다 `### <label>` 아래 값이 오는 마크다운이다.
 * 비운 칸에는 `_No response_`가 들어가므로 빈 값으로 바꾼다.
 */
function parseIssueForm(body) {
  const fields = {};
  for (const part of body.replace(/\r\n/g, '\n').split(/^### /m).slice(1)) {
    const newline = part.indexOf('\n');
    const label = (newline === -1 ? part : part.slice(0, newline)).trim();
    const value = newline === -1 ? '' : part.slice(newline + 1).trim();
    fields[label] = value === '_No response_' ? '' : value;
  }
  return fields;
}

const {
  ISSUE_BODY = '',
  ISSUE_NUMBER,
  ISSUE_CREATED_AT,
  COMMENT_FILE,
  GITHUB_OUTPUT,
} = process.env;
const {
  GITHUB_SERVER_URL = 'https://github.com',
  GITHUB_REPOSITORY = '',
  GITHUB_REF_NAME = 'master',
} = process.env;

const form = parseIssueForm(ISSUE_BODY);
const result = await createEntry(
  {
    url: form['URL'],
    kind: form['종류'] === '블로그' ? 'blog' : 'article',
    title: form['제목'],
    source: form['출처'],
    summary: form['요약'],
    comment: form['코멘트'],
    tags: form['태그'],
  },
  { savedAt: ISSUE_CREATED_AT, id: ISSUE_NUMBER },
);

const fileLink = (file) =>
  `[\`${file}\`](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/blob/${GITHUB_REF_NAME}/${file})`;

function describe(result) {
  switch (result.status) {
    case 'invalid':
      return `❌ 추가하지 못했어요. ${result.reason}\n\n이슈 본문의 URL을 고치면 다시 실행돼요.`;
    case 'duplicate':
      return `이미 추가한 글이에요: ${fileLink(result.file)}`;
    case 'created':
      return `✅ 추가했어요: ${fileLink(result.file)}\n\n${originTable(result)}\n\n배포가 끝나면 https://oseungkwon.github.io/curation/ 에 보여요.`;
  }
}

const comment = describe(result);

await writeFile(COMMENT_FILE, comment);

// 제목은 커밋 메시지에 들어가므로 한 줄로 만든다.
const outputs = {
  status: result.status,
  file: result.file ?? '',
  title: (result.data?.title ?? '').replace(/\s+/g, ' '),
};
await appendFile(
  GITHUB_OUTPUT,
  Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}\n`)
    .join(''),
);
console.log(comment);
