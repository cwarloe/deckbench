import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SETTINGS, type ConvertSettings } from "@/lib/convert/types";

type SettingsState = {
  settings: ConvertSettings;
  setSettings: (partial: Partial<ConvertSettings>) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      setSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),
    }),
    { name: "deckbench-settings" },
  ),
);
