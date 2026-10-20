import type { Entry, ResumeDocument } from "@/lib/resume/model";
import { createEmptyDocument, localized } from "@/lib/resume/model";

/** Build an explicitly fictional bilingual example. @returns Editable content with stable references. @example createExampleDocument() */
export function createExampleDocument(): ResumeDocument {
  const doc = createEmptyDocument();
  doc.profile = {
    name: "Alex Morgan",
    email: "alex@example.com",
    phone: "",
    city: "Curitiba",
    country: "BR",
    links: [
      {
        id: "example-site",
        label: "alexmorgan.dev",
        url: "https://example.com",
      },
    ],
    summary: localized(
      "Software engineer building thoughtful, accessible experiences for the web. I turn complex problems into clear, dependable products.",
      "Engenheiro de software criando experiências acessíveis para a web. Transformo problemas complexos em produtos claros e confiáveis.",
    ),
  };
  const make = (
    id: string,
    organization: string,
    en: string,
    pt: string,
    start: string,
    end: string,
    technologies: string[],
    bullets: [string, string][],
  ): Entry => ({
    id,
    organization,
    title: localized(en, pt),
    city: "Curitiba",
    country: "BR",
    start,
    end,
    ongoing: !end && !!start,
    technologies,
    archived: false,
    links: [],
    bullets: bullets.map(([en, pt], index) => ({
      id: `${id}-bullet-${index}`,
      body: localized(en, pt),
    })),
  });
  doc.sections[0].entries.push(
    make(
      "example-role",
      "Northstar Studio · Fictional company",
      "Frontend Engineer",
      "Engenheiro Frontend",
      "2023-03",
      "",
      ["React", "TypeScript", "Design systems"],
      [
        [
          "Led an accessible component library used across three product teams.",
          "Liderei uma biblioteca de componentes acessíveis utilizada por três equipes de produto.",
        ],
        [
          "Reduced dashboard loading time by 35% through focused rendering improvements.",
          "Reduzi o tempo de carregamento do painel em 35% com melhorias de renderização.",
        ],
      ],
    ),
  );
  const project = make(
    "example-project",
    "",
    "Field Notes",
    "Notas de Campo",
    "2024-01",
    "2024-06",
    ["Next.js", "TypeScript"],
    [
      [
        "A small writing tool that makes organizing ideas feel effortless.",
        "Uma ferramenta de escrita que facilita a organização de ideias.",
      ],
    ],
  );
  project.links.push({
    id: "example-project-link",
    label: "example.com/project",
    url: "https://example.com/project",
  });
  doc.sections[1].entries.push(project);
  doc.sections[2].entries.push(
    make(
      "example-education",
      "Example University",
      "BSc · Software Engineering",
      "Bacharelado · Engenharia de Software",
      "2018",
      "2022",
      [],
      [],
    ),
  );
  doc.sections[3].entries.push(
    make(
      "example-skills",
      "",
      "Tools & technologies",
      "Ferramentas e tecnologias",
      "",
      "",
      ["React", "Next.js", "TypeScript", "CSS", "Git", "PostgreSQL"],
      [],
    ),
  );
  doc.variants[0].sections = doc.sections.map((section) => ({
    sectionId: section.id,
    visible: true,
    entries: section.entries.map((entry) => ({
      entryId: entry.id,
      bulletIds: entry.bullets.map((bullet) => bullet.id),
    })),
  }));
  doc.revision = 1;
  return doc;
}
