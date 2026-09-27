import { getCollection, render, type CollectionEntry } from 'astro:content';

type CareerProject = CollectionEntry<'career'>;
export type ProjectContent = Awaited<ReturnType<typeof render>>['Content'];

export interface ProjectOverride {
  data: CollectionEntry<'resumeVariantProject'>['data'];
  /** 본문을 새로 쓴 경우에만 있다. 없으면 원본 본문을 그대로 쓴다 */
  Content?: ProjectContent;
}

/** 회사별 이력서에서 보여줄 프로젝트와 순서, 덮어쓸 문구 */
export interface ResumeSelection {
  featured: string[];
  other: string[];
  overrides: Map<string, ProjectOverride>;
}

// 최신 종료월이 위로 오게 정렬하고, 같은 달이면 order로 순서를 고정한다.
function splitByTier(sourceProjects: CareerProject[]) {
  const sorted = sourceProjects.sort(
    (a, b) =>
      b.data.endDate.localeCompare(a.data.endDate) ||
      a.data.order - b.data.order,
  );

  return {
    featuredSource: sorted.filter(({ data }) => data.tier === 'featured'),
    // pinLast 카드는 시간순에서 빼고 '그 외 프로젝트'의 맨 뒤에 붙인다.
    otherSource: [
      ...sorted.filter(({ data }) => data.tier === 'other' && !data.pinLast),
      ...sorted.filter(({ data }) => data.tier === 'other' && data.pinLast),
    ],
  };
}

// 회사별 버전은 날짜 대신 적어 둔 순서를 따른다.
// 없는 id를 적으면 조용히 빠지지 않도록 바로 실패시킨다.
function pickSelected(
  sourceProjects: CareerProject[],
  { featured, other, overrides }: ResumeSelection,
) {
  const byId = new Map(sourceProjects.map((project) => [project.id, project]));
  const pick = (id: string) => {
    const project = byId.get(id);
    if (!project) throw new Error(`career에 없는 프로젝트입니다: ${id}`);
    return project;
  };

  for (const id of overrides.keys()) pick(id);

  return {
    featuredSource: featured.map(pick),
    otherSource: other.map(pick),
  };
}

async function applyOverride(
  project: CareerProject,
  override: ProjectOverride | undefined,
) {
  const Content = override?.Content ?? (await render(project)).Content;
  if (!override) return { ...project, Content };

  const { change, ...fields } = override.data;
  return {
    ...project,
    data: {
      ...project.data,
      ...fields,
      change:
        project.data.change && change
          ? { ...project.data.change, ...change }
          : project.data.change,
    },
    Content,
  };
}

export async function getResume(selection?: ResumeSelection) {
  const sourceProjects = await getCollection('career');
  const { featuredSource, otherSource } = selection
    ? pickSelected(sourceProjects, selection)
    : splitByTier(sourceProjects);

  // 인쇄물의 '프로젝트 01~12' 번호가 화면에 보이는 순서와 어긋나지 않도록,
  // 대표 → 그 외 순으로 합친 뒤에 인덱스를 매긴다.
  const projects = await Promise.all(
    [...featuredSource, ...otherSource].map(async (project, projectIndex) => ({
      ...(await applyOverride(project, selection?.overrides.get(project.id))),
      projectIndex,
    })),
  );

  const featuredProjects = projects.slice(0, featuredSource.length);
  const otherProjects = projects.slice(featuredSource.length);

  const projectYears = [
    ...new Set(
      projects.flatMap(({ data }) => [
        data.startDate.slice(0, 4),
        data.endDate.slice(0, 4),
      ]),
    ),
  ].sort();

  // 회사별 버전은 적은 순서를 지키도록 연도로 나누지 않고 한 묶음으로 둔다.
  const featuredGroups: Array<{
    id: string;
    heading: string;
    projects: typeof projects;
  }> = selection
    ? [{ id: 'featured', heading: '대표 프로젝트', projects: featuredProjects }]
    : groupByYear(featuredProjects);

  return {
    featuredGroups,
    otherProjects,
    projectCount: projects.length,
    otherCount: otherProjects.length,
    projectYearsLabel:
      projectYears.length > 1
        ? `${projectYears[0]}—${projectYears.at(-1)}`
        : (projectYears[0] ?? ''),
    lastUpdated: projects.reduce(
      (latest, { data }) => (data.endDate > latest ? data.endDate : latest),
      '',
    ),
  };
}

function groupByYear<T extends { data: { endDate: string } }>(projects: T[]) {
  return projects
    .reduce<Array<{ id: string; heading: string; projects: T[] }>>(
      (groups, project) => {
        const year = project.data.endDate.slice(0, 4);
        const group = groups.find((item) => item.id === year);

        if (group) {
          group.projects.push(project);
        } else {
          groups.push({ id: year, heading: year, projects: [project] });
        }

        return groups;
      },
      [],
    )
    .sort((a, b) => b.id.localeCompare(a.id));
}

export type ResumeViewModel = Awaited<ReturnType<typeof getResume>>;
export type ResumeProject = ResumeViewModel['otherProjects'][number];
export type ResumeProjectGroup = ResumeViewModel['featuredGroups'][number];
