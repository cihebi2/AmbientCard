import { isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  type AppSettings,
  normalizeSettings,
} from "../types";
import { getAppStore } from "./store";

export async function loadAppSettings() {
  const store = await getAppStore();
  const savedSettings = await store.get<Partial<AppSettings>>(SETTINGS_KEY);

  try {
    const autostartEnabled = await isAutostartEnabled();
    return normalizeSettings(savedSettings, autostartEnabled);
  } catch {
    return normalizeSettings(savedSettings, DEFAULT_SETTINGS.autostartEnabled);
  }
}

export async function saveAppSettings(settings: AppSettings) {
  const normalized = normalizeSettings(settings, settings.autostartEnabled);
  const store = await getAppStore();

  await store.set(SETTINGS_KEY, normalized);
  await store.save();

  return normalized;
}
