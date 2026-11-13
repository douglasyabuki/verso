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

export type SectionIconId = (typeof sectionIconIds)[number];

export const sectionIconLabels: Record<SectionIconId, string> = {
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
  | "experience"
  | "projects"
  | "education"
  | "skills"
  | "certifications"
  | "custom"
  | "profile"
  | "summary",
  (typeof sectionIconIds)[number]
>;
