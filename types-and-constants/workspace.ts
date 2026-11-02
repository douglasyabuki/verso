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
  documentFingerprint?: string;
  error: string | null;
};

export type CommitResult =
  | { status: "success"; review: StorageReview }
  | { status: "committed-unverified"; review: StorageReview }
  | { status: "committed-conflict"; review: StorageReview }
  | { status: "conflict"; review: StorageReview }
  | { status: "failure"; error: string }
  | { status: "cancelled" };

export type EditGroup = {
  key: string;
  kind: "typing" | "composition" | "isolated";
};

export type WorkspaceEdit = (update: DocumentUpdate, group?: EditGroup) => void;

export type OperationKind =
  | "import"
  | "example"
  | "recovery"
  | "clear"
  | "resume-saving"
  | "overwrite"
  | "load-saved"
  | "session";

export type WorkspaceNotice = {
  id: number;
  generation: number;
  workspaceEpoch: number;
  title: string;
  description?: string;
  action?: "undo";
  document: ResumeDocument;
};

type Replacement = {
  kind: OperationKind;
  backupOrigin?: "export" | "matching-import";
  writeTarget: "tab" | "browser" | "both" | "none";
  snapshot: WorkspaceSnapshot;
  review: StorageReview | null;
  sessionOnly: boolean;
};

export type WorkspaceState = WorkspaceSnapshot & {
  /** Transient invalidation of field-local history after workspace history/replacement. */
  textHistoryEpoch: number;
  /** Transient list-history invalidation after explicit workspace replacement. */
  workspaceEpoch: number;
  ready: boolean;
  sessionOnly: boolean;
  saving: boolean;
  replacing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  error: string | null;
  backupFailure: {
    origin: "export" | "matching-import";
    document: ResumeDocument;
    generation: number;
  } | null;
  notice: WorkspaceNotice | null;
  conflict: StorageReview | null;
  pending: Replacement | null;
  recovery: WorkspaceSnapshot | null;
  currentFingerprint: string | null;
  savedIdentity: string | null;
};
