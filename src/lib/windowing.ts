import { defaultWindowIcon } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import {
  PhysicalPosition,
  currentMonitor,
  getCurrentWindow,
  primaryMonitor,
} from "@tauri-apps/api/window";
import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  LIBRARY_UPDATED_EVENT,
  REVIEW_UPDATED_EVENT,
  SETTINGS_UPDATED_EVENT,
  type AppSettings,
  type OverlayPosition,
} from "../types";

const MAIN_WINDOW_LABEL = "main";
const SETTINGS_WINDOW_LABEL = "settings";
const TRAY_ID = "deskvocab-tray";

let trayReady: Promise<void> | null = null;

async function getMainWindow() {
  const existing = await WebviewWindow.getByLabel(MAIN_WINDOW_LABEL);

  if (existing) {
    return existing;
  }

  return getCurrentWebviewWindow().label === MAIN_WINDOW_LABEL ? getCurrentWebviewWindow() : null;
}

export async function showOverlayWindow() {
  const mainWindow = await getMainWindow();

  if (!mainWindow) {
    return;
  }

  await mainWindow.show();
  await mainWindow.setAlwaysOnTop(true);
}

export async function hideOverlayWindow() {
  const mainWindow = await getMainWindow();

  if (!mainWindow) {
    return;
  }

  await mainWindow.hide();
}

export async function toggleMainWindowVisibility() {
  const mainWindow = await getMainWindow();

  if (!mainWindow) {
    return;
  }

  const visible = await mainWindow.isVisible();

  if (visible) {
    await mainWindow.hide();
    return;
  }

  await showOverlayWindow();
}

export async function openSettingsWindow() {
  await invoke("open_settings_window");
}

export async function closeApplication() {
  await TrayIcon.removeById(TRAY_ID);
  await invoke("quit_application");
}

export async function ensureSystemTray() {
  if (getCurrentWebviewWindow().label !== MAIN_WINDOW_LABEL) {
    return;
  }

  if (trayReady) {
    return trayReady;
  }

  trayReady = (async () => {
    const existing = await TrayIcon.getById(TRAY_ID);

    if (existing) {
      return;
    }

    const menu = await Menu.new({
      items: [
        {
          id: "toggle-overlay",
          text: "显示 / 隐藏单词卡",
          action: () => {
            void toggleMainWindowVisibility();
          },
        },
        {
          id: "open-settings",
          text: "打开设置",
          action: () => {
            void openSettingsWindow();
          },
        },
        {
          id: "quit",
            text: "退出 AmbientCard",
          action: () => {
            void closeApplication();
          },
        },
      ],
    });

    let icon = null;
    try {
      icon = await defaultWindowIcon();
    } catch (error) {
      console.warn("AmbientCard tray icon load failed:", error);
    }

    await TrayIcon.new({
      id: TRAY_ID,
      menu,
      icon: icon ?? undefined,
        tooltip: "AmbientCard",
      showMenuOnLeftClick: false,
      action: (event) => {
        if (event.type === "Click" && event.button === "Left" && event.buttonState === "Up") {
          void toggleMainWindowVisibility();
        }
      },
    });
  })().catch((error) => {
    trayReady = null;
    console.error("AmbientCard tray bootstrap failed:", error);
    throw error;
  });

  return trayReady;
}

export async function applyOverlayPosition(settings: Pick<AppSettings, "position" | "manualPosition">) {
  const currentWindow = getCurrentWindow();
  const monitor = (await currentMonitor()) ?? (await primaryMonitor());

  if (!monitor) {
    return;
  }

  const windowSize = await currentWindow.outerSize();
  const { workArea } = monitor;
  const x = workArea.position.x + workArea.size.width - windowSize.width - 44;
  const yByPosition: Record<Exclude<OverlayPosition, "manual">, number> = {
    "top-right": workArea.position.y + 40,
    "center-right": workArea.position.y + Math.round((workArea.size.height - windowSize.height) / 2),
    "bottom-right": workArea.position.y + workArea.size.height - windowSize.height - 52,
  };

  if (settings.position === "manual" && settings.manualPosition) {
    const minX = workArea.position.x;
    const maxX = workArea.position.x + workArea.size.width - windowSize.width;
    const minY = workArea.position.y;
    const maxY = workArea.position.y + workArea.size.height - windowSize.height;
    const clampedX = Math.min(maxX, Math.max(minX, settings.manualPosition.x));
    const clampedY = Math.min(maxY, Math.max(minY, settings.manualPosition.y));

    await currentWindow.setPosition(new PhysicalPosition(clampedX, clampedY));
    return;
  }

  const fallbackPosition = settings.position === "manual" ? "center-right" : settings.position;
  await currentWindow.setPosition(new PhysicalPosition(x, yByPosition[fallbackPosition]));
}

async function emitToKnownWindows<T>(event: string, payload?: T) {
  await Promise.allSettled([
    emitTo(MAIN_WINDOW_LABEL, event, payload),
    emitTo(SETTINGS_WINDOW_LABEL, event, payload),
  ]);
}

export async function broadcastSettings(settings: AppSettings) {
  await emitToKnownWindows(SETTINGS_UPDATED_EVENT, settings);
}

export async function broadcastLibraryUpdate() {
  await emitToKnownWindows(LIBRARY_UPDATED_EVENT);
}

export async function broadcastReviewUpdate() {
  await emitToKnownWindows(REVIEW_UPDATED_EVENT);
}
