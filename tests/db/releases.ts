import { randomUUID } from "node:crypto";

import { createCareerDocument, validateDocument } from "@/lib/career/model";
import { renderCareerOutput } from "@/lib/career/output";
import { previewPdf } from "@/tests/fixtures/pdf";
import type { CareerDocument } from "@/types-and-constants/career";
import type { ReleaseRequestMetadata } from "@/types-and-constants/releases";

import type { TestDatabase } from "./database";

/** Build a validated workspace whose resume is ready for output.
 * @param fullName Full-name wording rendered in the PDF.
 * @returns {CareerDocument} Document with resume `resume` in en-US.
 * @example const document = readyDocument("Ana Souza")
 */
export function readyDocument(fullName = "Ana Souza"): CareerDocument {
  const document = createCareerDocument();
  const name = document.profile.fields.find(
    (field) => field.key === "fullName",
  )!;
  name.wording["en-US"] = fullName;
  document.resumes.push({
    id: "resume",
    name: "Application",
    language: "en-US",
    template: "yabuki-reference@1.0.3",
    selection: [],
    overrides: {},
    layout: { ...document.defaults },
  });
  return validateDocument(document);
}

/** Seed one committed account workspace directly.
 * @param database Isolated test database.
 * @param userId Owner.
 * @param document Committed document.
 * @param revision Committed revision.
 * @returns Workspace identity.
 * @example const head = await seedWorkspace(database, user, readyDocument())
 */
export async function seedWorkspace(
  database: TestDatabase,
  userId: string,
  document: CareerDocument = readyDocument(),
  revision = 1,
) {
  const workspaceId = randomUUID();
  await database.prisma.accountWorkspace.upsert({
    where: { userId },
    create: { userId, workspaceId, revision, generation: 0, document },
    update: { workspaceId, revision, generation: 0, document },
  });
  return { workspaceId, revision, generation: 0, document };
}

/** Build release metadata matching a committed head's rendered output.
 * @param head Seeded workspace.
 * @param overrides Field replacements.
 * @returns {ReleaseRequestMetadata} Metadata with a fresh operation ID.
 * @example await createRelease(user, releaseMetadata(head), pdf())
 */
export function releaseMetadata(
  head: {
    workspaceId: string;
    revision: number;
    generation: number;
    document: CareerDocument;
  },
  overrides: Partial<ReleaseRequestMetadata> = {},
): ReleaseRequestMetadata {
  return {
    operationId: randomUUID(),
    resumeId: "resume",
    workspaceId: head.workspaceId,
    revision: head.revision,
    generation: head.generation,
    fingerprint: renderCareerOutput(head.document, "resume", head.revision)
      .fingerprint,
    templateId: "yabuki-reference@1.0.3",
    advance: true,
    automatic: false,
    ...overrides,
  };
}

/** Distinct small PDF bytes for one release.
 * @param title Embedded title making bytes distinct.
 * @returns {Uint8Array} Valid PDF bytes.
 * @example pdf("first")
 */
export const pdf = (title = "Release fixture") => previewPdf(title);
