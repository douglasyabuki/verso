"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ThemePreference = "system" | "light" | "dark";

const storageKey = "verso-theme";
const changeEvent = "verso-theme-change";

/** Read the preference initialized before paint. Returns system when unset. @example getPreference() */
function getPreference(): ThemePreference {
  const value = document.documentElement.dataset.themePreference;
  return value === "light" || value === "dark" ? value : "system";
}

/** Apply a preference, resolving system against the current OS theme. @param preference User choice. @example applyTheme("system") */
function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.classList.toggle(
    "dark",
    preference === "dark" ||
      (preference === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
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
  const preference = useSyncExternalStore(
    subscribe,
    getPreference,
    getServerPreference,
  );

  return (
    <ToggleGroup
      aria-label="Color theme"
      value={[preference]}
      variant="outline"
      size="sm"
      spacing={0}
      onValueChange={(values) => {
        const value = values[0];
        if (value !== "system" && value !== "light" && value !== "dark") return;
        applyTheme(value);
        try {
          localStorage.setItem(storageKey, value);
        } catch {
          // Keep the selection active for this page if storage is unavailable.
        }
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
      <ToggleGroupItem value="dark" aria-label="Dark theme" title="Dark theme">
        <Moon />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
