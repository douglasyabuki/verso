import { createEmptyDocument } from "@/lib/resume/factories";
import { localized } from "@/lib/resume/localization";
import type { Entry, ResumeDocument } from "@/types-and-constants/resume";
import { defaultSectionIcons } from "@/types-and-constants/sections";

/**
 * Build an explicitly fictional bilingual example with populated resume sections.
 * @returns {ResumeDocument} Editable content with stable entry, achievement, and variant references.
 * @example const document = createExampleDocument()
 */
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
    make(
      "example-role-product",
      "Cedar Labs · Fictional company",
      "Software Engineer",
      "Engenheiro de Software",
      "2022-01",
      "2023-02",
      ["TypeScript", "Node.js", "PostgreSQL"],
      [
        [
          "Built reporting workflows that helped support teams resolve customer requests faster.",
          "Desenvolvi fluxos de relatórios que ajudaram equipes de suporte a resolver solicitações de clientes mais rapidamente.",
        ],
        [
          "Worked with designers to simplify onboarding and document reusable interface patterns.",
          "Colaborei com designers para simplificar a integração de usuários e documentar padrões reutilizáveis de interface.",
        ],
      ],
    ),
    make(
      "example-role-intern",
      "Harbor Digital · Fictional company",
      "Web Development Intern",
      "Estagiário em Desenvolvimento Web",
      "2020-08",
      "2021-12",
      ["JavaScript", "HTML", "CSS", "Git"],
      [
        [
          "Created responsive pages and improved keyboard navigation across the company website.",
          "Criei páginas responsivas e melhorei a navegação por teclado no site da empresa.",
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
  doc.sections[1].entries.push(
    project,
    make(
      "example-project-transit",
      "Personal project · Fictional",
      "Transit Companion",
      "Companheiro de Transporte",
      "2023-07",
      "2023-11",
      ["React", "TypeScript", "CSS"],
      [
        [
          "Designed a responsive journey planner with saved routes and accessible service alerts.",
          "Desenvolvi um planejador responsivo de viagens com rotas salvas e alertas de serviço acessíveis.",
        ],
      ],
    ),
    make(
      "example-project-community",
      "Community project · Fictional",
      "Community Pantry",
      "Despensa Comunitária",
      "2025-02",
      "",
      ["Next.js", "PostgreSQL", "Node.js"],
      [
        [
          "Built an inventory dashboard to help volunteers coordinate donations and collection schedules.",
          "Desenvolvi um painel de estoque para ajudar voluntários a coordenar doações e horários de coleta.",
        ],
      ],
    ),
  );
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
    make(
      "example-education-specialization",
      "Example Institute of Technology",
      "Specialization · Human-Computer Interaction",
      "Especialização · Interação Humano-Computador",
      "2023",
      "2024",
      [],
      [
        [
          "Studied usability research, inclusive design, and interface evaluation.",
          "Estudei pesquisa de usabilidade, design inclusivo e avaliação de interfaces.",
        ],
      ],
    ),
    make(
      "example-education-course",
      "Example Open Learning",
      "Extension Course · Data Visualization",
      "Curso de Extensão · Visualização de Dados",
      "2022-03",
      "2022-07",
      ["Python", "SQL"],
      [
        [
          "Created interactive reports using public datasets and clear visual storytelling.",
          "Criei relatórios interativos com dados públicos e narrativas visuais claras.",
        ],
      ],
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
    make(
      "example-skills-backend",
      "",
      "Backend & data",
      "Backend e dados",
      "",
      "",
      ["Node.js", "Python", "SQL", "REST", "Docker"],
      [
        [
          "Data modeling and API integration",
          "Modelagem de dados e integração de APIs",
        ],
      ],
    ),
    make(
      "example-skills-collaboration",
      "",
      "Design & collaboration",
      "Design e colaboração",
      "",
      "",
      ["Figma", "Storybook"],
      [
        [
          "Usability research and prototyping",
          "Pesquisa de usabilidade e prototipação",
        ],
        ["Technical writing and mentoring", "Escrita técnica e mentoria"],
      ],
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
  const accessibilityCertification = make(
    "example-certification-accessibility",
    "Example Accessibility Institute",
    "Web Accessibility Foundations",
    "Fundamentos de Acessibilidade Web",
    "",
    "",
    [],
    [
      [
        "Completed practical exercises in semantic markup, keyboard access, and assistive technology.",
        "Concluí exercícios práticos de marcação semântica, acesso por teclado e tecnologia assistiva.",
      ],
    ],
  );
  accessibilityCertification.certification = {
    credentialId: "DEMO-A11Y-2025-002",
    dates: { issued: "2025-03", expiration: { kind: "never" } },
  };
  const dataCertification = make(
    "example-certification-data",
    "Example Data Academy",
    "SQL & Data Analysis Certificate",
    "Certificado em SQL e Análise de Dados",
    "",
    "",
    [],
    [
      [
        "Completed a capstone project covering relational queries and reporting.",
        "Concluí um projeto final de consultas relacionais e geração de relatórios.",
      ],
    ],
  );
  dataCertification.certification = {
    credentialId: "DEMO-DATA-2023-003",
    dates: { issued: "2023-09", expiration: { kind: "date", date: "2026-09" } },
  };
  doc.sections[4].entries.push(
    certification,
    accessibilityCertification,
    dataCertification,
  );
  doc.sections.push({
    id: "example-custom",
    kind: "custom",
    icon: defaultSectionIcons.custom,
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
