import { getCollection, render } from 'astro:content';

export async function getResume() {
  const sourceProjects = await getCollection('career');

  // 최신 종료월이 위로 오게 정렬하고, 같은 달이면 order로 순서를 고정한다.
  const sorted = sourceProjects.sort(
    (a, b) =>
      b.data.endDate.localeCompare(a.data.endDate) ||
      a.data.order - b.data.order,
  );

  const featuredSource = sorted.filter(({ data }) => data.tier === 'featured');
  const otherSource = sorted.filter(({ data }) => data.tier === 'other');

  // 인쇄물의 '프로젝트 01~12' 번호가 화면에 보이는 순서와 어긋나지 않도록,
  // 대표 → 그 외 순으로 합친 뒤에 인덱스를 매긴다.
  const projects = await Promise.all(
    [...featuredSource, ...otherSource].map(async (project, projectIndex) => ({
      ...project,
      projectIndex,
      Content: (await render(project)).Content,
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

  const featuredGroups = featuredProjects
    .reduce<Array<{ year: string; projects: typeof projects }>>(
      (groups, project) => {
        const year = project.data.endDate.slice(0, 4);
        const group = groups.find((item) => item.year === year);

        if (group) {
          group.projects.push(project);
        } else {
          groups.push({ year, projects: [project] });
        }

        return groups;
      },
      [],
    )
    .sort((a, b) => b.year.localeCompare(a.year));

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

export type ResumeViewModel = Awaited<ReturnType<typeof getResume>>;
export type ResumeProject = ResumeViewModel['otherProjects'][number];
export type ResumeProjectGroup = ResumeViewModel['featuredGroups'][number];
