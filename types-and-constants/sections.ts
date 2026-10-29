import type { Section } from "@/types-and-constants/resume";

export const sectionKinds = [
  "experience",
  "projects",
  "education",
  "skills",
  "certifications",
  "custom",
] as const;

export const sectionIconIds = [
  "user-round",
  "file-text",
  "briefcase-business",
  "folder-kanban",
  "graduation-cap",
  "code-2",
  "award",
  "heart-handshake",
  "languages",
  "mic-vocal",
  "presentation",
  "flask-conical",
  "landmark",
  "trophy",
  "newspaper",
  "palette",
  "wrench",
  "users-round",
  "handshake",
  "globe",
  "lightbulb",
  "rocket",
  "target",
  "badge-check",
  "book-open",
] as const;

export const sectionIconLabels: Record<
  (typeof sectionIconIds)[number],
  string
> = {
  "user-round": "Profile",
  "file-text": "Summary / general",
  "briefcase-business": "Experience",
  "folder-kanban": "Projects",
  "graduation-cap": "Education",
  "code-2": "Skills",
  award: "Certifications / distinctions",
  "heart-handshake": "Volunteering / service",
  languages: "Languages",
  "mic-vocal": "Speaking / podcasts",
  presentation: "Presentations / teaching",
  "flask-conical": "Research",
  landmark: "Professional memberships",
  trophy: "Awards / competitions",
  newspaper: "Publications / articles",
  palette: "Creative work",
  wrench: "Tools / practical skills",
  "users-round": "Leadership / communities",
  handshake: "Partnerships",
  globe: "International experience",
  lightbulb: "Ideas / innovation",
  rocket: "Ventures / initiatives",
  target: "Goals / achievements",
  "badge-check": "Credentials / licenses",
  "book-open": "Courses / continuing learning",
};

export const defaultSectionIcons = {
  profile: "user-round",
  summary: "file-text",
  experience: "briefcase-business",
  projects: "folder-kanban",
  education: "graduation-cap",
  skills: "code-2",
  certifications: "award",
  custom: "file-text",
} as const satisfies Record<
  (typeof sectionKinds)[number] | "profile" | "summary",
  (typeof sectionIconIds)[number]
>;

export const entryTerminology = {
  experience: {
    singular: "experience",
    title: "Role",
    organization: "Company",
    item: "Achievement",
    items: "Achievements",
    ongoing: "Currently working here",
    description: "Describe your employment, responsibilities, and impact.",
    example: "Frontend Engineer",
    empty: "Add your first role and describe the impact of your work.",
  },
  education: {
    singular: "education",
    title: "Degree / program",
    organization: "Institution",
    item: "Highlight",
    items: "Education highlights",
    ongoing: "Currently studying here",
    description:
      "Record your studies, qualifications, and academic highlights.",
    example: "BSc · Software Engineering",
    empty: "Add a degree, program, or course of study.",
  },
  projects: {
    singular: "project",
    title: "Project name",
    organization: "Organization (optional)",
    item: "Highlight",
    items: "Project highlights",
    ongoing: "Ongoing project",
    description: "Show what you built, the tools you used, and the results.",
    example: "Field Notes",
    empty: "Add a project to share what you built.",
  },
  skills: {
    singular: "skill category",
    title: "Category",
    organization: "Organization (optional)",
    item: "Skill",
    items: "Localized skills",
    ongoing: "Ongoing",
    description:
      "Group shared tool names and individually selectable bilingual skills.",
    example: "Tools & technologies",
    empty: "Add a category, then shared tools or localized skills.",
  },
  certifications: {
    singular: "certification",
    title: "Certification name",
    organization: "Issuer",
    item: "Detail",
    items: "Certification details",
    ongoing: "Ongoing (retained range)",
    description:
      "Record your credential, issuer, verification links, and optional certification dates.",
    example: "Cloud Developer Certification",
    empty: "Add a certification and its issuer or verification link.",
  },
  custom: {
    singular: "entry",
    title: "Title",
    organization: "Organization (optional)",
    item: "Detail",
    items: "Details",
    ongoing: "Ongoing",
    description: "Create a flexible bilingual entry for this custom section.",
    example: "Volunteer mentor",
    empty: "Add an entry for volunteering, awards, or another topic.",
  },
} as const;

export const careerSectionLabels: Record<Section["kind"], string> = {
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  custom: "Custom section",
};
