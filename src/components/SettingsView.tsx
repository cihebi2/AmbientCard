import { disable, enable } from "@tauri-apps/plugin-autostart";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { BUILTIN_WORDS } from "../data/builtinWords";
import { importEcdictMiniDictionary } from "../lib/ecdict";
import { loadAppSettings, saveAppSettings } from "../lib/settings";
import {
  clearCustomWordLibrary,
  formatDueLabel,
  importWordsFromCsvText,
  loadStudyData,
} from "../lib/study";
import {
  broadcastLibraryUpdate,
  broadcastReviewUpdate,
  broadcastSettings,
  hideOverlayWindow,
  showOverlayWindow,
} from "../lib/windowing";
import {
  DEFAULT_SETTINGS,
  DISPLAY_MODE_OPTIONS,
  LIBRARY_UPDATED_EVENT,
  INTERVAL_OPTIONS,
  POSITION_OPTIONS,
  REVIEW_UPDATED_EVENT,
  SETTINGS_UPDATED_EVENT,
  formatInterval,
  normalizeSettings,
  type AppSettings,
  type DisplayMode,
  type OverlayPosition,
  type StudyData,
} from "../types";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function serializeSettings(settings: AppSettings) {
  return JSON.stringify(settings);
}

function scrollToSettingsSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export function SettingsView() {
  const [draft, setDraft] = useState(DEFAULT_SETTINGS);
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [settingsMaximized, setSettingsMaximized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState("配置、词库和复习状态都会写入本地 store。");
  const [overlayVisible, setOverlayVisible] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastAppliedRef = useRef(serializeSettings(DEFAULT_SETTINGS));
  const appliedSettingsRef = useRef(DEFAULT_SETTINGS);
  const readyRef = useRef(false);

  const previewWord = useMemo(() => {
    return studyData?.activeWords[0] ?? BUILTIN_WORDS[7];
  }, [studyData]);

  const previewStyle = {
    "--card-opacity": String(draft.opacity),
    "--cycle-duration": `${draft.intervalMs}ms`,
    "--accent-hue": "36",
  } as CSSProperties;

  useEffect(() => {
    let mounted = true;
    const unlistenFns: Array<() => void> = [];

    async function refreshStudyState() {
      const nextStudyData = await loadStudyData();

      if (!mounted) {
        return;
      }

      startTransition(() => {
        setStudyData(nextStudyData);
      });
    }

    async function bootstrap() {
      try {
        const settingsWindow = getCurrentWebviewWindow();
        const [loadedSettings, nextStudyData, mainWindow] = await Promise.all([
          loadAppSettings(),
          loadStudyData(),
          WebviewWindow.getByLabel("main"),
        ]);
        const maximized = await getCurrentWindow().isMaximized();
        const visible = mainWindow ? await mainWindow.isVisible() : true;

        if (!mounted) {
          return;
        }

        startTransition(() => {
          setDraft(loadedSettings);
          setStudyData(nextStudyData);
          setSettingsMaximized(maximized);
          setOverlayVisible(visible);
          setFatalError(null);
          setLoading(false);
        });
        lastAppliedRef.current = serializeSettings(loadedSettings);
        appliedSettingsRef.current = loadedSettings;
        readyRef.current = true;

        unlistenFns.push(
          await settingsWindow.listen(LIBRARY_UPDATED_EVENT, () => {
            void refreshStudyState();
          }),
        );
        unlistenFns.push(
          await settingsWindow.listen(REVIEW_UPDATED_EVENT, () => {
            void refreshStudyState();
          }),
        );
        unlistenFns.push(
          await settingsWindow.listen<AppSettings>(SETTINGS_UPDATED_EVENT, ({ payload }) => {
            const nextSettings = normalizeSettings(payload);
            lastAppliedRef.current = serializeSettings(nextSettings);
            appliedSettingsRef.current = nextSettings;

            startTransition(() => {
              setDraft(nextSettings);
            });
          }),
        );
        unlistenFns.push(
          await getCurrentWindow().onResized(async () => {
            const maximizedState = await getCurrentWindow().isMaximized();

            if (!mounted) {
              return;
            }

            startTransition(() => {
              setSettingsMaximized(maximizedState);
            });
          }),
        );
      } catch (error) {
        if (!mounted) {
          return;
        }

        startTransition(() => {
          setFatalError(getErrorMessage(error));
          setLoading(false);
        });
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
      unlistenFns.forEach((unlisten) => {
        void unlisten();
      });
    };
  }, []);

  async function applySettings(nextSettings: AppSettings) {
    setSaving(true);
    setStatus("正在实时应用设置...");

    try {
      let autostartWarning: string | null = null;
      let settingsToPersist = nextSettings;
      const previousSettings = appliedSettingsRef.current;

      if (nextSettings.autostartEnabled !== previousSettings.autostartEnabled) {
        try {
          if (nextSettings.autostartEnabled) {
            await enable();
          } else {
            await disable();
          }
        } catch (error) {
          autostartWarning = `开机自启未更新：${getErrorMessage(error)}`;
          settingsToPersist = normalizeSettings({
            ...nextSettings,
            autostartEnabled: previousSettings.autostartEnabled,
          });
        }
      }

      const persisted = await saveAppSettings(settingsToPersist);
      await broadcastSettings(persisted);
      lastAppliedRef.current = serializeSettings(persisted);
      appliedSettingsRef.current = persisted;

      startTransition(() => {
        setDraft(persisted);
      });

      setStatus(
        autostartWarning
          ? `其他设置已保存。${autostartWarning}`
          : "设置已实时生效。桌面卡片会立即同步。",
      );
    } catch (error) {
      setStatus(`保存失败：${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!readyRef.current || loading || fatalError) {
      return;
    }

    const nextSettings = normalizeSettings(draft);
    const serialized = serializeSettings(nextSettings);

    if (serialized === lastAppliedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void applySettings(nextSettings);
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, fatalError, loading]);

  function updateDraft<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setDraft((current) => normalizeSettings({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("这些设置已经是实时生效的。");
  }

  async function handleReset() {
    const defaults = normalizeSettings(DEFAULT_SETTINGS);
    startTransition(() => {
      setDraft(defaults);
    });
    await applySettings(defaults);
  }

  async function handleToggleOverlay() {
    if (overlayVisible) {
      await hideOverlayWindow();
      setOverlayVisible(false);
      setStatus("桌面卡片已隐藏，仍可从托盘再次唤出。");
      return;
    }

    await showOverlayWindow();
    setOverlayVisible(true);
    setStatus("桌面卡片已显示。");
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    setImporting(true);
    setStatus(`正在导入 ${file.name} ...`);

    try {
      const summary = await importWordsFromCsvText(await file.text());
      const nextStudyData = await loadStudyData();

      startTransition(() => {
        setStudyData(nextStudyData);
      });

      await broadcastLibraryUpdate();
      await broadcastReviewUpdate();
      setStatus(
        `导入完成：新增 ${summary.addedCount}，更新 ${summary.updatedCount}，忽略 ${summary.ignoredCount}。当前自定义词库 ${summary.totalCustomCount} 张。`,
      );
    } catch (error) {
      setStatus(`导入失败：${getErrorMessage(error)}`);
    } finally {
      setImporting(false);
      event.currentTarget.value = "";
    }
  }

  async function handleImportEcdictMini() {
    setImporting(true);
    setStatus("正在下载并导入开源词典 ECDICT 精选词库...");

    try {
      const summary = await importEcdictMiniDictionary();
      const nextStudyData = await loadStudyData();

      startTransition(() => {
        setStudyData(nextStudyData);
      });

      await broadcastLibraryUpdate();
      await broadcastReviewUpdate();
      setStatus(
        `ECDICT 精选词库 导入完成：新增 ${summary.addedCount}，更新 ${summary.updatedCount}，忽略 ${summary.ignoredCount}。当前自定义词库 ${summary.totalCustomCount} 张，来源 ${summary.sourceLabel}。`,
      );
    } catch (error) {
      setStatus(`ECDICT 精选词库 导入失败：${getErrorMessage(error)}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleClearLibrary() {
    setImporting(true);
    setStatus("正在清空自定义词库...");

    try {
      await clearCustomWordLibrary();
      const nextStudyData = await loadStudyData();

      startTransition(() => {
        setStudyData(nextStudyData);
      });

      await broadcastLibraryUpdate();
      await broadcastReviewUpdate();
      setStatus("已清空自定义词库，桌面卡片已回退到内置 starter library。");
    } catch (error) {
      setStatus(`清空失败：${getErrorMessage(error)}`);
    } finally {
      setImporting(false);
    }
  }

  async function closeSettingsWindow() {
    const currentWindow = getCurrentWebviewWindow();
    await currentWindow.close();
  }

  async function minimizeSettingsWindow() {
    await getCurrentWindow().minimize();
  }

  async function toggleSettingsMaximize() {
    const currentWindow = getCurrentWindow();
    await currentWindow.toggleMaximize();
    const maximized = await currentWindow.isMaximized();
    setSettingsMaximized(maximized);
  }

  if (fatalError) {
    return (
      <main className="settings-shell" style={{ background: "#0d0d0f" }}>
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}>
          <section
            style={{
              maxWidth: "720px",
              width: "100%",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "16px",
              padding: "28px 30px",
              background: "rgba(20, 20, 24, 0.8)",
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            <div style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#ef4444",
              fontWeight: 600,
            }}>
              AmbientCard / settings bootstrap failed
            </div>
            <h1 style={{
              margin: "16px 0 12px",
              fontSize: "28px",
              fontWeight: 600,
              color: "#ffffff",
            }}>设置页启动失败</h1>
            <p style={{
              margin: "0 0 16px",
              fontSize: "14px",
              lineHeight: 1.7,
              color: "rgba(255, 255, 255, 0.5)",
            }}>
              这说明设置页已经被加载到了，只是在初始化时发生了异常。
            </p>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                padding: "16px",
                borderRadius: "10px",
                background: "rgba(0, 0, 0, 0.4)",
                font: "13px/1.6 Consolas, 'Courier New', monospace",
                color: "#fca5a5",
                border: "1px solid rgba(239, 68, 68, 0.1)",
              }}
            >
              {fatalError}
            </pre>
          </section>
        </div>
      </main>
    );
  }

  if (loading || !studyData) {
    return (
      <main className="settings-shell" style={{ background: "#0d0d0f" }}>
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255, 255, 255, 0.6)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: "40px",
              height: "40px",
              border: "2px solid rgba(255, 255, 255, 0.1)",
              borderTopColor: "#6366f1",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 20px",
            }} />
            <div style={{ fontSize: "14px", fontWeight: 500 }}>设置页加载中...</div>
            <div style={{ fontSize: "12px", opacity: 0.5, marginTop: "8px" }}>正在读取本地设置、词库和复习状态</div>
          </div>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="settings-shell">
      <header className="settings-window-chrome">
        <div className="settings-titlebar">
          <div className="settings-titlegroup" data-tauri-drag-region>
            <div className="settings-titleicon" aria-hidden="true">D</div>
            <div className="settings-titletext" data-tauri-drag-region>
              <strong>AmbientCard</strong>
              <span>设置</span>
            </div>
          </div>

          <div className="settings-titlemeta" data-tauri-drag-region>
            <span>{studyData.usingCustomLibrary ? "自定义词库" : "内置词库"}</span>
            <span>{studyData.snapshot.totalCount} 词</span>
            <span>{overlayVisible ? "桌面卡片已显示" : "桌面卡片已隐藏"}</span>
          </div>

          <div className="settings-window-controls">
            <button
              aria-label="最小化"
              className="settings-window-button"
              onClick={() => void minimizeSettingsWindow()}
              type="button"
            >
              <span className="window-icon-min" />
            </button>
            <button
              aria-label={settingsMaximized ? "还原" : "最大化"}
              className="settings-window-button"
              onClick={() => void toggleSettingsMaximize()}
              type="button"
            >
              <span className={settingsMaximized ? "window-icon-restore" : "window-icon-max"} />
            </button>
            <button
              aria-label="关闭"
              className="settings-window-button settings-window-button-close"
              onClick={() => void closeSettingsWindow()}
              type="button"
            >
              <span className="window-icon-close" />
            </button>
          </div>
        </div>

        <nav className="settings-menubar" aria-label="设置分组">
          <button className="settings-menuitem" onClick={() => scrollToSettingsSection("settings-overview")} type="button">
            概览
          </button>
          <button className="settings-menuitem" onClick={() => scrollToSettingsSection("settings-library")} type="button">
            词库
          </button>
          <button className="settings-menuitem" onClick={() => scrollToSettingsSection("settings-display")} type="button">
            启动
          </button>
          <button className="settings-menuitem" onClick={() => scrollToSettingsSection("settings-card-display")} type="button">
            卡片
          </button>
          <button className="settings-menuitem" onClick={() => scrollToSettingsSection("settings-rhythm")} type="button">
            节奏
          </button>
          <button className="settings-menuitem" onClick={() => void handleReset()} type="button">
            重置
          </button>
        </nav>
      </header>

      <div className="settings-app">
        <aside className="settings-sidebar">
          <section className="settings-sidebar-card settings-brand-card">
            <div className="settings-app-kicker">AmbientCard</div>
            <h1 className="settings-app-title">设置</h1>
            <p className="settings-app-copy">管理桌面卡片、词库导入和本地记忆节奏。</p>
          </section>

          <section className="settings-sidebar-card">
            <div className="settings-side-label">当前状态</div>
            <div className="settings-side-list">
              <div className="settings-side-row">
                <span>桌面卡片</span>
                <strong>{overlayVisible ? "已显示" : "已隐藏"}</strong>
              </div>
              <div className="settings-side-row">
                <span>词库来源</span>
                <strong>{studyData.usingCustomLibrary ? "自定义" : "内置"}</strong>
              </div>
              <div className="settings-side-row">
                <span>单词总数</span>
                <strong>{studyData.snapshot.totalCount}</strong>
              </div>
              <div className="settings-side-row">
                <span>当前节奏</span>
                <strong>{formatInterval(draft.intervalMs)}</strong>
              </div>
            </div>
          </section>

          <section className="settings-sidebar-card">
            <div className="settings-side-label">卡片预览</div>
            <div className="preview-card settings-preview-card" style={previewStyle}>
              <div className="overlay-backdrop" />
              <div className="overlay-rim" />
              <div className="preview-tag">{draft.displayMode}</div>
              <div className="overlay-content">
                <div className="overlay-word preview-word">{previewWord.word}</div>
                <div className="overlay-phonetic">{previewWord.phonetic}</div>
                <div className="overlay-meaning is-visible">{previewWord.meaningZh}</div>
              </div>
              <div className="overlay-statusline is-visible">
                <span>{draft.hoverShowButtons ? "悬停显示" : "始终显示"}</span>
              </div>
              <div className="overlay-actions is-visible">
                <button className="overlay-action overlay-action-again" type="button">忘了</button>
                <button className="overlay-action overlay-action-hard" type="button">模糊</button>
                <button className="overlay-action overlay-action-good" type="button">认识</button>
              </div>
            </div>
          </section>

          <div className="settings-side-actions">
            <button className="ghost-button" type="button" onClick={() => void handleToggleOverlay()}>
              {overlayVisible ? "隐藏桌面卡片" : "显示桌面卡片"}
            </button>
            <button className="ghost-button" onClick={() => void closeSettingsWindow()} type="button">
              关闭窗口
            </button>
          </div>
        </aside>

        <section className="settings-main">
          <header className="settings-main-header">
            <div>
              <div className="settings-main-kicker">Software Settings</div>
              <h2 className="settings-main-title">桌面背单词控制面板</h2>
              <p className="settings-main-subtitle">这里是软件设置页，不是展示页。改动会立即同步到桌面卡片。</p>
            </div>
          </header>

          <div className="settings-status">{status}</div>

          <section className="settings-section" id="settings-overview">
            <div className="settings-section-header">
              <div>
                <h3>词库与复习概览</h3>
                <p>查看当前词库状态、待复习数量和下一次到期时间。</p>
              </div>
            </div>
            <div className="settings-overview-grid">
              <article className="settings-overview-card">
                <span>当前词库</span>
                <strong>{studyData.snapshot.totalCount}</strong>
                <small>{studyData.usingCustomLibrary ? "正在使用自定义 CSV 词库" : "当前使用内置 starter library"}</small>
              </article>
              <article className="settings-overview-card">
                <span>待复习</span>
                <strong>{studyData.snapshot.dueCount}</strong>
                <small>{studyData.snapshot.newCount} 张新词等待第一次确认</small>
              </article>
              <article className="settings-overview-card">
                <span>进行中</span>
                <strong>{studyData.snapshot.learningCount}</strong>
                <small>{studyData.snapshot.masteredCount} 张已经进入较长间隔</small>
              </article>
              <article className="settings-overview-card">
                <span>下一次到期</span>
                <strong>{formatDueLabel(studyData.snapshot.nextDueAt)}</strong>
                <small>用来判断当前记忆节奏是否过密或过疏</small>
              </article>
            </div>
          </section>

          <section className="settings-section" id="settings-library">
            <div className="settings-section-header">
              <div>
                <h3>词库导入</h3>
                <p>导入 CSV 或清空当前自定义词库。</p>
              </div>
            </div>
            <p className="settings-copy">
              支持 `word, phonetic, meaning, note` 四列。首行可有表头，也可无表头；Excel 导出的 CSV 与 TSV 都能识别。
            </p>
            <p className="settings-copy">
              ECDICT 精选词库 会从 GitHub 开源词典直接下载后导入当前自定义词库；重复项只会更新，不会重复累积。
            </p>
            <div className="library-toolbar">
              <button
                className="primary-button"
                disabled={importing}
                onClick={() => void handleImportEcdictMini()}
                type="button"
              >
                {importing ? "正在导入..." : "一键导入 ECDICT 精选词库"}
              </button>
              <button
                className="ghost-button"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {importing ? "正在导入..." : "导入 CSV 词库"}
              </button>
              <button
                className="ghost-button"
                disabled={importing || !studyData.usingCustomLibrary}
                onClick={() => void handleClearLibrary()}
                type="button"
              >
                清空自定义词库
              </button>
              <span className="library-hint">示例列顺序：`word, phonetic, meaning, note`</span>
            </div>
            <input
              accept=".csv,.txt,.tsv"
              className="hidden-file-input"
              onChange={handleImportFile}
              ref={fileInputRef}
              type="file"
            />
          </section>

          <form className="settings-form" onSubmit={(event) => void handleSubmit(event)}>
            <section className="settings-section" id="settings-display">
              <div className="settings-section-header">
                <div>
                  <h3>启动与显示</h3>
                  <p>控制软件如何常驻、何时显示以及桌面上的出现位置。</p>
                </div>
              </div>
              <div className="field-grid">
                <label className="toggle-row">
                  <span>
                    <strong>开机自启</strong>
                    <small>登录 Windows 后自动启动托盘与桌面卡片。</small>
                  </span>
                  <input
                    checked={draft.autostartEnabled}
                    onChange={(event) => updateDraft("autostartEnabled", event.currentTarget.checked)}
                    type="checkbox"
                  />
                </label>

                <label className="toggle-row">
                  <span>
                    <strong>启动后立即显示</strong>
                    <small>关闭后仍驻留托盘，但首屏不自动浮现。</small>
                  </span>
                  <input
                    checked={draft.showOnLaunch}
                    onChange={(event) => updateDraft("showOnLaunch", event.currentTarget.checked)}
                    type="checkbox"
                  />
                </label>

                <label className="field-row">
                  <span className="field-copy">
                    <strong>桌面位置</strong>
                    <small>
                      {draft.position === "manual"
                        ? "当前为手动位置。回到桌面卡片上直接左键拖动即可重新摆放。"
                        : "支持右上、右中、右下三档，也支持直接在卡片上左键拖动。"}
                    </small>
                  </span>
                  <select
                    className="field-select"
                    onChange={(event) => updateDraft("position", event.currentTarget.value as OverlayPosition)}
                    value={draft.position}
                  >
                    {POSITION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} · {option.caption}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="settings-section" id="settings-card-display">
              <div className="settings-section-header">
                <div>
                  <h3>卡片显示</h3>
                  <p>控制单词和释义的显示方式以及操作按钮的可见性。</p>
                </div>
              </div>
              <div className="field-grid">
                <label className="field-row">
                  <span className="field-copy">
                    <strong>显示模式</strong>
                    <small>选择单词和释义的显示方式。</small>
                  </span>
                  <select
                    className="field-select"
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      updateDraft("displayMode", event.currentTarget.value as DisplayMode)}
                    value={draft.displayMode}
                  >
                    {DISPLAY_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} · {option.caption}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="toggle-row">
                  <span>
                    <strong>悬停显示按钮</strong>
                    <small>鼠标悬停时才显示"忘了/模糊/认识"按钮，平时隐藏界面更简洁。</small>
                  </span>
                  <input
                    checked={draft.hoverShowButtons}
                    onChange={(event) => updateDraft("hoverShowButtons", event.currentTarget.checked)}
                    type="checkbox"
                  />
                </label>

                <label className="field-row">
                  <span className="field-copy">
                    <strong>释义显示时机</strong>
                    <small>记忆/测验模式下，释义在卡片停留时间的 {Math.round(draft.revealTiming * 100)}% 后显示。</small>
                  </span>
                  <input
                    className="field-range"
                    max="1"
                    min="0.1"
                    onChange={(event) => updateDraft("revealTiming", Number(event.currentTarget.value))}
                    step="0.05"
                    type="range"
                    value={draft.revealTiming}
                  />
                </label>
              </div>
            </section>

            <section className="settings-section" id="settings-rhythm">
              <div className="settings-section-header">
                <div>
                  <h3>出现节奏</h3>
                  <p>控制桌面轮播频率和卡片透明度，不改复习算法本身。</p>
                </div>
              </div>
              <div className="field-grid">
                <label className="field-row">
                  <span className="field-copy">
                    <strong>切换间隔</strong>
                    <small>这是桌面换卡节奏，不是单词复习间隔。复习间隔由评分决定。</small>
                  </span>
                  <select
                    className="field-select"
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      updateDraft("intervalMs", Number(event.currentTarget.value))
                    }
                    value={draft.intervalMs}
                  >
                    {INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} · {option.caption}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-row">
                  <span className="field-copy">
                    <strong>卡片透明度</strong>
                    <small>当前 {Math.round(draft.opacity * 100)}%，现在最低可降到 25%，变化会更明显。</small>
                  </span>
                  <input
                    className="field-range"
                    max="1"
                    min="0.25"
                    onChange={(event) => updateDraft("opacity", Number(event.currentTarget.value))}
                    step="0.01"
                    type="range"
                    value={draft.opacity}
                  />
                </label>
              </div>
            </section>

            <section className="settings-section compact-card">
              <div className="settings-section-header">
                <div>
                  <h3>记忆节奏说明</h3>
                  <p>桌面卡片上的评分会直接影响每个单词的下次到期时间。</p>
                </div>
              </div>
              <p className="settings-copy">
                `忘了` 会很快回来，`模糊` 会缩短间隔，`认识` 会进入更长间隔。这是一个轻量但真正可用的本地复习节奏。
              </p>
            </section>

            <div className="settings-actions">
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? "正在同步..." : "设置实时生效"}
              </button>
              <button className="ghost-button" onClick={() => void handleReset()} type="button">
                恢复默认
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
