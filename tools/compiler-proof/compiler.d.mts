export class CompilerError extends Error {
  log: string;
  timedOut: boolean;
}
export type CompileResult = {
  bytes: Uint8Array;
  log: string;
  snapshotId: string;
  locale: string;
  templateId: string;
  templateVersion: string;
  initializationMs: number;
  compilationMs: number;
};
export class BrowserCompiler {
  constructor(options?: {
    assetBase?: string;
    initializationTimeoutMs?: number;
    compilationTimeoutMs?: number;
    onState?: (state: string) => void;
  });
  compile(request: {
    source: string;
    snapshotId: string;
    locale: string;
  }): Promise<CompileResult>;
  close(): void;
}
export function adaptReferenceSource(
  source: string,
  locale: "en-US" | "pt-BR",
): string;
