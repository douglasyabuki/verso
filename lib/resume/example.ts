import { createEmptyDocument } from "@/lib/resume/factories";
import { localized } from "@/lib/resume/localization";
import type { Entry, ResumeDocument } from "@/types-and-constants/resume";

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
  doc.sections[2].entries[0].technologies = ["Python", "SQL"];
  doc.sections[3].entries[0].organization = "Fictional learning community";
  doc.sections[3].entries[0].bullets.push({
    id: "example-localized-skill",
    body: localized(
      "Accessible interface design",
      "Design de interfaces acessíveis",
    ),
  });
  const certification = make(
    "example-certification",
    "Example Cloud Academy",
    "Cloud Developer Certification",
    "Certificação em Desenvolvimento na Nuvem",
    "2020",
    "2021",
    ["Cloud platforms"],
    [
      [
        "Completed a practical architecture assessment.",
        "Concluí uma avaliação prática de arquitetura.",
      ],
    ],
  );
  certification.certification = {
    credentialId: "DEMO-2024-001",
    dates: { issued: "2024-12", expiration: { kind: "date", date: "2027" } },
  };
  certification.links.push({
    id: "example-credential-link",
    label: "Verify credential",
    url: "https://example.com/credential",
  });
  doc.sections[4].entries.push(certification);
  doc.sections.push({
    id: "example-custom",
    kind: "custom",
    heading: localized("Community", "Comunidade"),
    entries: [
      make(
        "example-mentoring",
        "Example Community",
        "Volunteer mentor",
        "Mentoria voluntária",
        "2022",
        "",
        [],
        [
          [
            "Mentor students on accessible web projects.",
            "Oriento estudantes em projetos web acessíveis.",
          ],
        ],
      ),
    ],
  });
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
