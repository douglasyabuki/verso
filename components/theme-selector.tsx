"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ThemePreference = "system" | "light" | "dark";

const storageKey = "verso-theme";
const changeEvent = "verso-theme-change";

let transitionFrame: number | null = null;

/** Read the preference initialized before paint. Returns system when unset. @example getPreference() */
function getPreference(): ThemePreference {
  const value = document.documentElement.dataset.themePreference;
  return value === "light" || value === "dark" ? value : "system";
}

/** Apply a preference, resolving system against the current OS theme. @param preference User choice. @example applyTheme("system") */
function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (root.classList.contains("dark") !== dark) {
    if (transitionFrame !== null) cancelAnimationFrame(transitionFrame);
    root.dataset.themeSwitching = "";
    // Keep transitions disabled through the next paint. A single frame callback
    // could restore them before the browser has painted the new theme.
    transitionFrame = requestAnimationFrame(() => {
      transitionFrame = requestAnimationFrame(() => {
        delete root.dataset.themeSwitching;
        transitionFrame = null;
      });
    });
  }
  root.dataset.themePreference = preference;
  root.classList.toggle("dark", dark);
}

/** Subscribe to local choices, other tabs, and OS theme changes. @param notify React store callback. @returns Listener cleanup. @example subscribe(() => render()) */
function subscribe(notify: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const refresh = () => {
    applyTheme(getPreference());
    notify();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return;
    try {
      if (event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }
    const value = event.newValue;
    applyTheme(value === "light" || value === "dark" ? value : "system");
    notify();
  };
  window.addEventListener(changeEvent, refresh);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", refresh);
  refresh();
  return () => {
    window.removeEventListener(changeEvent, refresh);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", refresh);
  };
}

/** Supply the stable server default for hydration. @returns System preference. @example getServerPreference() */
function getServerPreference(): ThemePreference {
  return "system";
}

export function ThemeSelector() {
  const [storageFailed, setStorageFailed] = useState(false);
  const persist = (value: ThemePreference) => {
    try {
      localStorage.setItem(storageKey, value);
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  };
  const preference = useSyncExternalStore(
    subscribe,
    getPreference,
    getServerPreference,
  );

  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        aria-label="Color theme"
        value={[preference]}
        variant="outline"
        size="sm"
        spacing={0}
        onValueChange={(values) => {
          const value = values[0];
          if (value !== "system" && value !== "light" && value !== "dark")
            return;
          applyTheme(value);
          persist(value);
          window.dispatchEvent(new Event(changeEvent));
        }}
      >
        <ToggleGroupItem
          value="system"
          aria-label="System theme"
          title="System theme"
        >
          <Monitor />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="light"
          aria-label="Light theme"
          title="Light theme"
        >
          <Sun />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dark"
          aria-label="Dark theme"
          title="Dark theme"
        >
          <Moon />
        </ToggleGroupItem>
      </ToggleGroup>
      {storageFailed && (
        <div role="status" className="text-xs text-muted-foreground">
          <p>
            Theme applies in this tab only. Browser preferences could not be
            saved.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => persist(preference)}
          >
            Retry saving theme
          </Button>
        </div>
      )}
    </div>
  );
}
