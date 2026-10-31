"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

import { useWorkspaceWorkflow } from "@/contexts/workspace-workflow";
import { useResumeCompiler } from "@/hooks/output/use-resume-compiler";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { useWorkspaceExports } from "@/hooks/workspace/use-workspace-exports";
import { validateOutput } from "@/lib/review/validation";

/** Own one compiler and derive output validation for the selected resume and locales.
 * @returns Provider value for the current mounted workspace.
 * @example const output = useOutputState();
 */
function useOutputState() {
  const {
    state: { document },
  } = useWorkspace();
  const {
    navigation: { variant, locale },
    view: { editorLocale },
  } = useWorkspaceWorkflow();
  const [autoSync, setAutoSync] = useState(true);
  const validations = useMemo(
    () => ({
      "en-US": validateOutput(document, variant, "en-US"),
      "pt-BR": validateOutput(document, variant, "pt-BR"),
    }),
    [document, variant],
  );
  const validation = validations[locale];
  const compiler = useResumeCompiler({
    document,
    variantId: variant.id,
    locale,
    autoSync,
    ...document.compiler,
  });
  const exports = useWorkspaceExports({ document, variant, locale, compiler });

  return {
    compiler,
    exports,
    validation,
    validations,
    editorValidation: validations[editorLocale],
    sync: { autoSync, setAutoSync },
    busy: exports.exporting || compiler.isPending,
  };
}

const WorkspaceOutputContext = createContext<ReturnType<
  typeof useOutputState
> | null>(null);

/** Keep one compiler and export coordinator mounted across workspace views.
 * @param props Children inside WorkspaceWorkflowProvider.
 * @returns Output provider without preview or other presentation.
 * @example <WorkspaceOutputProvider><WorkspaceView /></WorkspaceOutputProvider>
 */
export function WorkspaceOutputProvider({ children }: { children: ReactNode }) {
  const output = useOutputState();
  return (
    <WorkspaceOutputContext.Provider value={output}>
      {children}
    </WorkspaceOutputContext.Provider>
  );
}

/** Access compilation, validation and export coordination.
 * @returns Output groups; throws outside WorkspaceOutputProvider.
 * @example const { compiler, sync } = useWorkspaceOutput();
 */
export function useWorkspaceOutput() {
  const output = useContext(WorkspaceOutputContext);
  if (!output) throw new Error("WorkspaceOutputProvider is required");
  return output;
}
