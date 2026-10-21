import type {
  DocumentUpdate,
  ResumeDocument,
} from "@/types-and-constants/resume";

export type WorkspaceSnapshot = {
  document: ResumeDocument;
  backupFingerprint: string | null;
};

export type StorageReview = {
  raw: string | null;
  snapshot: WorkspaceSnapshot | null;
  savedAt: string | null;
  error: string | null;
};

export type CommitResult =
  | { status: "success"; review: StorageReview }
  | { status: "conflict"; review: StorageReview }
  | { status: "failure"; error: string }
  | { status: "cancelled" };

export type EditGroup = {
  key: string;
  kind: "typing" | "composition" | "isolated";
};

export type WorkspaceEdit = (update: DocumentUpdate, group?: EditGroup) => void;

type Replacement = {
  title: string;
  snapshot: WorkspaceSnapshot;
  review: StorageReview | null;
  sessionOnly: boolean;
};

export type WorkspaceState = WorkspaceSnapshot & {
  ready: boolean;
  sessionOnly: boolean;
  saving: boolean;
  replacing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  error: string | null;
  conflict: StorageReview | null;
  pending: Replacement | null;
  recovery: WorkspaceSnapshot | null;
  currentFingerprint: string | null;
  savedIdentity: string | null;
};
