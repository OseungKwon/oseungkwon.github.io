import { getCollection, render } from 'astro:content';

interface ResumeOptions {
  profile?: string;
}

export async function getResume(options: ResumeOptions = {}) {
  const sourceProjects = options.profile
    ? await getCollection('resume', ({ id }) =>
        id.startsWith(`${options.profile}/`),
      )
    : await getCollection('career');

  const projects = await Promise.all(
    sourceProjects
      .sort(
        (a, b) =>
          b.data.endDate.localeCompare(a.data.endDate) ||
          a.data.order - b.data.order,
      )
      .map(async (project, projectIndex) => ({
        ...project,
        id: options.profile
          ? project.id.slice(`${options.profile}/`.length)
          : project.id,
        projectIndex,
        Content: (await render(project)).Content,
      })),
  );

  const projectYears = [
    ...new Set(
      projects.flatMap(({ data }) => [
        data.startDate.slice(0, 4),
        data.endDate.slice(0, 4),
      ]),
    ),
  ].sort();

  const projectGroups = projects
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
    projectGroups,
    projectCount: projects.length,
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
export type ResumeProject =
  ResumeViewModel['projectGroups'][number]['projects'][number];
export type ResumeProjectGroup = ResumeViewModel['projectGroups'][number];
