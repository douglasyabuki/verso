import { afterEach, expect } from "vitest";
import { cleanup } from "vitest-browser-react";

import { CareerController } from "@/stores/career/controller";
import {
  type CareerHead,
  CareerStorage,
  openCareerStorage,
  type SaveRequest,
} from "@/stores/career/persistence";
import type { CareerDraft } from "@/types-and-constants/career";

const owners: CareerStorage[] = [];
const controllers: CareerController[] = [];
const initialUrl = window.location.href;
const initialHistoryState = window.history.state;

/** Register a controller created by a failure-injection test for normal teardown. */
export function trackController(controller: CareerController) {
  controllers.push(controller);
}

/** Initialize a tracked controller whose timers and connection are released after each case. */
async function controllerOwner() {
  const controller = new CareerController();
  controllers.push(controller);
  await controller.initialize();
  return controller;
}

/** Build an uncommitted summary recovery record against the supplied durable head. */
function summaryDraft(head: CareerHead, wording = "Recovered"): CareerDraft {
  return {
    draftId: crypto.randomUUID(),
    draftVersion: 1,
    workspaceId: head.workspaceId,
    generation: head.generation,
    baselineRevision: head.revision,
    scope: "summary",
    baseline: head.document.summary,
    values: { ...head.document.summary, wording: { "en-US": wording } },
  };
}

async function storage() {
  const value = await openCareerStorage();
  owners.push(value);
  return value;
}

function request(
  head: CareerHead,
  scope: string,
  baseline: unknown,
  values: unknown,
  extra: Partial<SaveRequest> = {},
): SaveRequest {
  const result = {
    id: crypto.randomUUID(),
    workspaceId: head.workspaceId,
    generation: head.generation,
    scope,
    baseline,
    values,
    fingerprint: "",
    ...extra,
  };
  result.fingerprint = JSON.stringify([
    result.workspaceId,
    result.generation,
    scope,
    baseline,
    values,
    result.draftId,
    result.draftVersion,
  ]);
  return result;
}

async function reset() {
  const deletion = indexedDB.deleteDatabase("verso-local");
  await new Promise<void>((resolve, reject) => {
    deletion.onsuccess = () => resolve();
    deletion.onerror = () => reject(deletion.error);
    deletion.onblocked = () => reject(new Error("Test database still owned."));
  });
}

export function setupCareerTests() {
  afterEach(async () => {
    await cleanup();
    for (const owner of controllers) {
      await expect.poll(() => owner.getSnapshot().saving).toBe(false);
      await owner.flushRecovery();
      owner.dispose();
    }
    controllers.length = 0;
    owners.forEach((owner) => owner.close());
    owners.length = 0;
    await reset();
    window.history.replaceState(initialHistoryState, "", initialUrl);
  });
}

export { controllerOwner, request, storage, summaryDraft };
