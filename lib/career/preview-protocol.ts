import type { PreviewResumeScope } from "@/lib/career/model";
import type { ResumeOutputIssue } from "@/types-and-constants/career";

export type PreviewRequest = {
  id: number;
  resumeId: string;
  revision: number;
  inspect: boolean;
  draft: { scope: PreviewResumeScope; id: string; version: number } | null;
  reuse: { saved?: string; draft?: string };
};

export type PreviewWorkerInput =
  | { kind: "begin"; id: number }
  | {
      kind: "pieces";
      id: number;
      pieces: [key: string, text: string | null, append?: boolean][];
    }
  | { kind: "run"; request: PreviewRequest }
  | { kind: "supersede"; id: number };

export type PreviewWorkerResult = {
  id: number;
  fingerprint: string;
  targetPages: number;
  template: string;
  bytes?: Uint8Array;
  reuse?: "saved" | "draft";
};

export type PreviewWorkerOutput =
  | { kind: "ack" | "obsolete" | "inspected"; id: number }
  | { kind: "ready"; result: PreviewWorkerResult }
  | { kind: "blocked"; id: number; issues: ResumeOutputIssue[] }
  | { kind: "failed"; id: number; message: string; log: string };
