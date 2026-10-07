// 로컬에서 큐레이션 항목을 만든다. 커밋은 하지 않는다.
//   pnpm curate <URL> [--kind blog] [--title ..] [--source ..] [--summary ..] [--comment ..] [--tags "a, b"] [--highlight]
import { parseArgs } from 'node:util';
import { createEntry, originTable } from './core.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    kind: { type: 'string' },
    title: { type: 'string' },
    source: { type: 'string' },
    summary: { type: 'string' },
    comment: { type: 'string' },
    tags: { type: 'string' },
    highlight: { type: 'boolean', default: false },
  },
});

const result = await createEntry({ url: positionals[0], ...values });

if (result.status === 'invalid') {
  console.error(result.reason);
  process.exit(1);
}
if (result.status === 'duplicate') {
  console.log(`이미 추가한 글이에요: ${result.file}`);
} else {
  console.log(`추가했어요: ${result.file}\n\n${originTable(result)}`);
}
