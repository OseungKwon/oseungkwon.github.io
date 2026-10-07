import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const CURATION_DIR = path.resolve(
  import.meta.dirname,
  '../../src/content/curation',
);

/** 입력이 비어 메타·도메인으로 대체한 값. 리포트에서 다시 확인할 항목으로 표시한다. */
const FALLBACK = '⚠️ 도메인 대체';
const MISSING = '⚠️ 메타 없음';

/**
 * 같은 글이 추적 파라미터나 앵커만 달리 들어오면 중복 검사를 빠져나가므로,
 * 저장과 비교 모두 정리한 주소로 한다. http(s)가 아니면 null.
 */
export function normalizeUrl(input) {
  let url;
  try {
    url = new URL(String(input ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || key === 'fbclid' || key === 'gclid')
      url.searchParams.delete(key);
  }
  return url.href;
}

/** 이미 같은 URL을 가진 항목이 있으면 그 파일 이름을 돌려준다. */
async function findDuplicate(url) {
  let files;
  try {
    files = await readdir(CURATION_DIR);
  } catch {
    return null;
  }
  for (const file of files.filter((name) => name.endsWith('.md'))) {
    const text = await readFile(path.join(CURATION_DIR, file), 'utf8');
    const raw = text.match(/^url:\s*(.+?)\s*$/m)?.[1];
    if (!raw) continue;
    const value = raw.startsWith('"')
      ? JSON.parse(raw)
      : raw.replace(/^'|'$/g, '');
    if (normalizeUrl(value) === url) return file;
  }
  return null;
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text) {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
      if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? match;
      const point =
        code[1].toLowerCase() === 'x'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      try {
        return String.fromCodePoint(point);
      } catch {
        return match;
      }
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** `<meta>`의 property/name을 키로 content를 모은다. 같은 키는 먼저 나온 값을 쓴다. */
function parseMeta(html) {
  const meta = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = {};
    for (const m of tag.matchAll(
      /([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
    )) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4];
    }
    const key = (attrs.property ?? attrs.name)?.toLowerCase();
    const content = attrs.content && decodeEntities(attrs.content);
    if (key && content && !(key in meta)) meta[key] = content;
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title && decodeEntities(title)) meta.title = decodeEntities(title);
  return meta;
}

/**
 * 페이지를 받아 메타 태그를 읽는다. 막히거나 HTML이 아니어도 예외를 던지지 않고
 * error에 사유만 담는다. 나머지 값은 도메인 대체로 이어지면 되기 때문이다.
 */
async function fetchPageMeta(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; oseungkwon-curation/1.0; +https://oseungkwon.github.io/curation/)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko,en;q=0.8',
      },
    });
    if (!res.ok) return { meta: {}, error: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') ?? '';
    if (type && !/html/i.test(type))
      return { meta: {}, error: `HTML이 아님 (${type.split(';')[0]})` };

    // 국내 사이트 중에는 아직 EUC-KR 페이지가 있어, 헤더나 <meta charset>을 보고 디코딩한다.
    const buffer = await res.arrayBuffer();
    const sniff = new TextDecoder('latin1').decode(buffer.slice(0, 4096));
    const charset =
      type.match(/charset=([^;]+)/i)?.[1]?.trim() ??
      sniff.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
    let decoder;
    try {
      decoder = new TextDecoder(charset ?? 'utf-8');
    } catch {
      decoder = new TextDecoder('utf-8');
    }
    return { meta: parseMeta(decoder.decode(buffer)) };
  } catch (error) {
    return {
      meta: {},
      error: error.name === 'TimeoutError' ? '시간 초과' : error.message,
    };
  }
}

/** 후보를 순서대로 보고 처음 채워진 값을 [값, 출처]로 고른다. */
const pick = (candidates) =>
  candidates.find(([value]) => value) ?? [undefined, MISSING];

/**
 * 페이지 제목 끝에 붙은 사이트 이름(" | kciter.so", " — overreacted")을 뗀다.
 * 꼬리가 사이트 이름이나 도메인과 같을 때만 떼므로, 제목 안의 일반 구분자는 건드리지 않는다.
 */
function stripSiteSuffix(title, siteNames) {
  if (!title) return title;
  const known = siteNames.filter(Boolean).map((name) => name.toLowerCase());
  let result = title;
  for (;;) {
    const match = result.match(/^(.*\S)\s+[|·•–—-]\s+([^|·•–—]+)$/);
    if (!match || !known.includes(match[2].trim().toLowerCase())) return result;
    result = match[1];
  }
}

/** 입력값 > 메타 > 최후 기본값 순서로 각 필드를 채우고, 값마다 어디서 왔는지 남긴다. */
function resolveFields(input, meta, url, kind) {
  const { hostname, pathname } = new URL(url);
  const host = hostname.replace(/^www\./, '');
  let readablePath = pathname.replace(/\/$/, '');
  try {
    readablePath = decodeURIComponent(readablePath);
  } catch {}

  const siteName = meta['og:site_name'] ?? meta['application-name'];
  const pageTitle = (value) =>
    stripSiteSuffix(value, [siteName, host, host.split('.')[0]]);

  // 블로그를 추천할 때는 블로그 이름이 제목이다. 링크가 글 한 편을 가리켜도 그 글 제목 대신 사이트 이름을 먼저 쓰고,
  // 출처 자리에는 도메인을 둔다.
  const titleCandidates =
    kind === 'blog'
      ? [
          [input.title, '직접 입력'],
          [meta['og:site_name'], 'og:site_name'],
          [meta['application-name'], 'application-name'],
          [host, FALLBACK],
        ]
      : [
          [input.title, '직접 입력'],
          [pageTitle(meta['og:title']), 'og:title'],
          [pageTitle(meta['twitter:title']), 'twitter:title'],
          [pageTitle(meta.title), '<title>'],
          [host + readablePath, FALLBACK],
        ];
  const sourceCandidates =
    kind === 'blog'
      ? [
          [input.source, '직접 입력'],
          [host, '도메인'],
        ]
      : [
          [input.source, '직접 입력'],
          [meta['og:site_name'], 'og:site_name'],
          [meta['application-name'], 'application-name'],
          [host, FALLBACK],
        ];

  const [title, titleFrom] = pick(titleCandidates);
  const [source, sourceFrom] = pick(sourceCandidates);
  const [summary, summaryFrom] = pick([
    [input.summary, '직접 입력'],
    [meta['og:description'], 'og:description'],
    [meta.description, 'meta description'],
    [meta['twitter:description'], 'twitter:description'],
  ]);

  return {
    fields: { title, source, summary },
    origins: { 제목: titleFrom, 출처: sourceFrom, 요약: summaryFrom },
  };
}

/** 값은 JSON 문자열로 쓴다. JSON 문자열은 그대로 유효한 YAML이라 `:`나 따옴표가 섞여도 깨지지 않는다. */
function toMarkdown(data) {
  const lines = [
    // 기본값(article)이면 생략해, 대부분의 항목 파일을 짧게 둔다.
    data.kind === 'blog' && 'kind: "blog"',
    `title: ${JSON.stringify(data.title)}`,
    `url: ${JSON.stringify(data.url)}`,
    `source: ${JSON.stringify(data.source)}`,
    data.summary && `summary: ${JSON.stringify(data.summary)}`,
    data.comment && `comment: ${JSON.stringify(data.comment)}`,
    data.tags.length > 0 && `tags: ${JSON.stringify(data.tags)}`,
    data.highlight && 'highlight: true',
    `savedAt: ${JSON.stringify(data.savedAt)}`,
  ].filter(Boolean);
  return `---\n${lines.join('\n')}\n---\n`;
}

const seoulDate = (iso) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(
    new Date(iso),
  );

const clean = (value) => String(value ?? '').trim() || undefined;

/**
 * 입력 하나로 항목 파일을 만든다.
 * @param input { url, kind?: 'article' | 'blog', title?, source?, summary?, comment?, tags?: string, highlight?: boolean }
 * @param options { savedAt?: ISO 문자열, id?: 파일 이름 뒤에 붙일 값(이슈 번호 등) }
 * @returns status가 'invalid' | 'duplicate' | 'created'인 결과
 */
export async function createEntry(
  input,
  { savedAt = new Date().toISOString(), id } = {},
) {
  const url = normalizeUrl(input.url);
  if (!url)
    return {
      status: 'invalid',
      reason: `http(s) 주소가 아니에요: ${clean(input.url) ?? '(비어 있음)'}`,
    };
  const kind = clean(input.kind) ?? 'article';
  if (kind !== 'article' && kind !== 'blog')
    return {
      status: 'invalid',
      reason: `종류는 article 또는 blog여야 해요: ${kind}`,
    };

  const duplicate = await findDuplicate(url);
  if (duplicate)
    return {
      status: 'duplicate',
      url,
      file: path.join('src/content/curation', duplicate),
    };

  const given = {
    title: clean(input.title),
    source: clean(input.source),
    summary: clean(input.summary),
  };
  // 세 칸을 모두 직접 채웠다면 페이지에 접속할 이유가 없다.
  const needsMeta = !given.title || !given.source || !given.summary;
  const { meta, error } = needsMeta ? await fetchPageMeta(url) : { meta: {} };
  const { fields, origins } = resolveFields(given, meta, url, kind);

  const tags = [
    ...new Set(
      String(input.tags ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
  const data = {
    kind,
    ...fields,
    url,
    comment: clean(input.comment),
    tags,
    highlight: Boolean(input.highlight),
    savedAt,
  };

  const suffix = id ?? createHash('sha1').update(url).digest('hex').slice(0, 6);
  const fileName = `${seoulDate(savedAt)}-${suffix}.md`;
  await mkdir(CURATION_DIR, { recursive: true });
  await writeFile(path.join(CURATION_DIR, fileName), toMarkdown(data));

  return {
    status: 'created',
    file: path.join('src/content/curation', fileName),
    data,
    origins,
    fetchError: error,
  };
}

/** 결과를 이슈 댓글이나 터미널에 보여줄 표로 만든다. */
export function originTable(result) {
  const cell = (value) => {
    const text = String(value ?? '(없음)')
      .replace(/\s+/g, ' ')
      .replace(/\|/g, '\\|');
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  };
  const { data, origins } = result;
  const rows = [
    ['제목', data.title, origins.제목],
    ['출처', data.source, origins.출처],
    ['요약', data.summary, origins.요약],
  ];
  const lines = [
    '| 필드 | 값 | 출처 |',
    '|---|---|---|',
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
  if (rows.some(([, , from]) => from.startsWith('⚠️'))) {
    lines.push(
      '',
      '⚠️ 표시된 값은 페이지에서 찾지 못해 대체했거나 비워 둔 값이에요. 필요하면 파일에서 고쳐 주세요.',
    );
  }
  if (result.fetchError)
    lines.push('', `페이지를 가져오지 못했어요: ${result.fetchError}`);
  return lines.join('\n');
}
