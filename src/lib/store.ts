import { Store } from "@tauri-apps/plugin-store";
import { SETTINGS_STORE_PATH } from "../types";

let storePromise: Promise<Store> | null = null;

export async function getAppStore() {
  if (!storePromise) {
    storePromise = Store.load(SETTINGS_STORE_PATH);
  }

  return storePromise;
}
