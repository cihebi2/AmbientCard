import { startTransition, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadAppSettings, saveAppSettings } from "../lib/settings";
import {
  applyReviewResult,
  computeStudySnapshot,
  loadStudyData,
  saveReviewStates,
} from "../lib/study";
import {
  applyOverlayPosition,
  broadcastReviewUpdate,
  broadcastSettings,
  ensureSystemTray,
  openSettingsWindow,
  showOverlayWindow,
} from "../lib/windowing";
import {
  DEFAULT_SETTINGS,
  LIBRARY_UPDATED_EVENT,
  REVIEW_RESULT_OPTIONS,
  REVIEW_UPDATED_EVENT,
  SETTINGS_UPDATED_EVENT,
  normalizeSettings,
  type AppSettings,
  type DisplayMode,
  type ReviewResult,
  type StudyData,
  type ReviewState,
} from "../types";

function serializeSettings(settings: AppSettings) {
  return JSON.stringify(settings);
}

function getDueTimestamp(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("button, input, select, textarea, a, label"));
}

// 判断是否应该显示释义
function shouldRevealMeaning(
  displayMode: DisplayMode,
  reviewState: ReviewState | null,
  revealProgress: number,
  revealTiming: number,
): boolean {
  if (displayMode === "always") return true;
  if (displayMode === "test") return revealProgress >= revealTiming;
  // recall 模式：新词（seenCount === 0）始终显示，已记忆的词需要等待
  if (displayMode === "recall") {
    const isNewWord = !reviewState || reviewState.seenCount === 0;
    if (isNewWord) return true;
    return revealProgress >= revealTiming;
  }
  return true;
}

function getOrderedWordPool(studyData: StudyData) {
  const now = Date.now();

  return [...studyData.activeWords].sort((left, right) => {
    const leftDueAt = getDueTimestamp(studyData.reviewStates[left.id]?.dueAt);
    const rightDueAt = getDueTimestamp(studyData.reviewStates[right.id]?.dueAt);
    const leftDue = !Number.isFinite(leftDueAt) || leftDueAt <= now;
    const rightDue = !Number.isFinite(rightDueAt) || rightDueAt <= now;

    if (leftDue !== rightDue) {
      return leftDue ? -1 : 1;
    }

    if (leftDueAt !== rightDueAt) {
      return leftDueAt - rightDueAt;
    }

    return left.word.localeCompare(right.word);
  });
}

function pickOverlayWord(studyData: StudyData, currentWordId?: string | null) {
  const pool = getOrderedWordPool(studyData);

  if (pool.length === 0) {
    return null;
  }

  if (!currentWordId) {
    return pool[0] ?? null;
  }

  if (pool.length === 1) {
    return pool[0] ?? null;
  }

  const currentIndex = pool.findIndex((word) => word.id === currentWordId);

  if (currentIndex < 0) {
    return pool[0] ?? null;
  }

  return pool[(currentIndex + 1) % pool.length] ?? pool[0] ?? null;
}

export function OverlayView() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [currentWordId, setCurrentWordId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<ReviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [revealProgress, setRevealProgress] = useState(0); // 0-1 进度
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const currentWordIdRef = useRef<string | null>(null);
  const dragCaptureRef = useRef(false);
  const dragPersistTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const revealStartTimeRef = useRef<number>(0);
  const errorClearTimerRef = useRef<number | null>(null);

  const currentWord = useMemo(() => {
    if (!studyData?.activeWords.length) {
      return null;
    }

    return studyData.activeWords.find((word) => word.id === currentWordId) ?? studyData.activeWords[0];
  }, [currentWordId, studyData]);

  const currentReviewState = currentWord && studyData
    ? studyData.reviewStates[currentWord.id]
    : null;

  function showSoftError(scope: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`AmbientCard ${scope} failed:`, error);

    if (errorClearTimerRef.current !== null) {
      window.clearTimeout(errorClearTimerRef.current);
    }

    startTransition(() => {
      setErrorMessage(`${scope}: ${message}`);
    });

    errorClearTimerRef.current = window.setTimeout(() => {
      startTransition(() => {
        setErrorMessage((current) => (current === `${scope}: ${message}` ? null : current));
      });
    }, 3600);
  }

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    currentWordIdRef.current = currentWordId;
  }, [currentWordId]);

  useEffect(() => {
    let mounted = true;
    const unlistenFns: Array<() => void> = [];
    let isMainWindow = false;

    function reportSoftError(scope: string, error: unknown) {
      if (!mounted) {
        return;
      }

      showSoftError(scope, error);
    }

    async function refreshStudy(preferredWordId?: string | null) {
      try {
        const nextStudyData = await loadStudyData();
        const nextWord = pickOverlayWord(nextStudyData, preferredWordId);

        if (!mounted) {
          return;
        }

        startTransition(() => {
          setStudyData(nextStudyData);
          setCurrentWordId(nextWord?.id ?? null);
        });
      } catch (error) {
        reportSoftError("study reload", error);
      }
    }

    async function persistManualPosition(x: number, y: number) {
      try {
        const nextSettings = {
          ...settingsRef.current,
          position: "manual" as const,
          manualPosition: {
            x: Math.round(x),
            y: Math.round(y),
          },
        };

        settingsRef.current = nextSettings;
        await saveAppSettings(nextSettings);
        await broadcastSettings(nextSettings);

        if (!mounted) {
          return;
        }

        startTransition(() => {
          setSettings(nextSettings);
          setDragging(false);
        });
      } catch (error) {
        reportSoftError("manual drag save", error);
      }
    }

    async function bootstrap() {
      try {
        const overlayWindow = getCurrentWebviewWindow();
        isMainWindow = overlayWindow.label === "main";
        const [loadedSettings, loadedStudyData] = await Promise.all([
          loadAppSettings(),
          loadStudyData(),
        ]);
        const nextWord = pickOverlayWord(loadedStudyData);

        if (!mounted) {
          return;
        }

        startTransition(() => {
          setSettings(loadedSettings);
          setStudyData(loadedStudyData);
          setCurrentWordId(nextWord?.id ?? null);
          setErrorMessage(null);
        });
        settingsRef.current = loadedSettings;

        if (isMainWindow) {
          const currentWindow = getCurrentWindow();
          void ensureSystemTray().catch((error) => {
            reportSoftError("tray bootstrap", error);
          });
          void overlayWindow.setAlwaysOnTop(true).catch((error) => {
            reportSoftError("window pin", error);
          });
          void applyOverlayPosition(loadedSettings).catch((error) => {
            reportSoftError("window position", error);
          });
          unlistenFns.push(
            await currentWindow.onMoved(({ payload }) => {
              if (!dragCaptureRef.current) {
                return;
              }

              if (dragPersistTimerRef.current !== null) {
                window.clearTimeout(dragPersistTimerRef.current);
              }

              dragPersistTimerRef.current = window.setTimeout(() => {
                dragCaptureRef.current = false;
                void persistManualPosition(payload.x, payload.y);
              }, 180);
            }),
          );
        }

        if (loadedSettings.showOnLaunch) {
          void showOverlayWindow().catch((error) => {
            reportSoftError("window show", error);
          });
        }

        unlistenFns.push(
          await overlayWindow.listen<AppSettings>(SETTINGS_UPDATED_EVENT, ({ payload }) => {
            const nextSettings = normalizeSettings(payload);
            settingsRef.current = nextSettings;

            startTransition(() => {
              setSettings(nextSettings);
            });

            void applyOverlayPosition(nextSettings).catch((error) => {
              reportSoftError("window position sync", error);
            });
          }),
        );

        unlistenFns.push(
          await overlayWindow.listen(LIBRARY_UPDATED_EVENT, () => {
            void refreshStudy(currentWordIdRef.current);
          }),
        );

        unlistenFns.push(
          await overlayWindow.listen(REVIEW_UPDATED_EVENT, () => {
            void refreshStudy(currentWordIdRef.current);
          }),
        );
      } catch (error) {
        reportSoftError("overlay bootstrap", error);
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
      if (dragPersistTimerRef.current !== null) {
        window.clearTimeout(dragPersistTimerRef.current);
      }
      if (revealTimerRef.current !== null) {
        window.clearInterval(revealTimerRef.current);
      }
      if (errorClearTimerRef.current !== null) {
        window.clearTimeout(errorClearTimerRef.current);
      }
      unlistenFns.forEach((unlisten) => {
        void unlisten();
      });
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function syncSettingsFromStore() {
      try {
        const nextSettings = await loadAppSettings();
        const nextSerialized = serializeSettings(nextSettings);

        if (nextSerialized === serializeSettings(settingsRef.current)) {
          return;
        }

        settingsRef.current = nextSettings;
        await applyOverlayPosition(nextSettings);

        if (!mounted) {
          return;
        }

        startTransition(() => {
          setSettings(nextSettings);
        });
      } catch (error) {
        console.error("AmbientCard settings sync failed:", error);
      }
    }

    const timer = window.setInterval(() => {
      void syncSettingsFromStore();
    }, 450);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  // 卡片切换定时器
  useEffect(() => {
    if (!studyData?.activeWords.length) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentWordId((current) => pickOverlayWord(studyData, current)?.id ?? current);
    }, settings.intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [settings.intervalMs, studyData]);

  // 释义显示进度动画
  useEffect(() => {
    // 切换单词时重置进度
    setRevealProgress(0);
    revealStartTimeRef.current = Date.now();

    if (revealTimerRef.current !== null) {
      window.clearInterval(revealTimerRef.current);
    }

    const updateInterval = 50; // 50ms 更新一次
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - revealStartTimeRef.current;
      const progress = Math.min(1, elapsed / settings.intervalMs);
      setRevealProgress(progress);

      if (progress >= 1) {
        window.clearInterval(timer);
      }
    }, updateInterval);

    revealTimerRef.current = timer;

    return () => {
      if (revealTimerRef.current !== null) {
        window.clearInterval(revealTimerRef.current);
      }
    };
  }, [currentWordId, settings.intervalMs]);

  async function handleReview(result: ReviewResult) {
    if (!studyData || !currentWord || !currentReviewState) {
      return;
    }

    setReviewing(result);

    const nextReviewState = applyReviewResult(currentReviewState, result);
    const nextReviewStates = {
      ...studyData.reviewStates,
      [currentWord.id]: nextReviewState,
    };
    const nextSnapshot = computeStudySnapshot(studyData.activeWords, nextReviewStates);
    const nextStudyData: StudyData = {
      ...studyData,
      reviewStates: nextReviewStates,
      snapshot: nextSnapshot,
    };
    const nextWord = pickOverlayWord(nextStudyData, currentWord.id);

    startTransition(() => {
      setStudyData(nextStudyData);
      setCurrentWordId(nextWord?.id ?? currentWord.id);
      setErrorMessage(null);
    });

    try {
      await saveReviewStates(nextReviewStates);
      await broadcastReviewUpdate();
    } catch (error) {
      showSoftError("review save", error);
    } finally {
      setReviewing(null);
    }
  }

  async function handleStartDragging() {
    try {
      setDragging(true);
      dragCaptureRef.current = true;
      const currentWindow = getCurrentWindow();
      await currentWindow.startDragging();
      window.setTimeout(() => {
        if (dragCaptureRef.current) {
          dragCaptureRef.current = false;
          setDragging(false);
        }
      }, 280);
    } catch (error) {
      dragCaptureRef.current = false;
      setDragging(false);
      showSoftError("window drag", error);
    }
  }

  async function handleCardMouseDown(event: MouseEvent<HTMLElement>) {
    if (event.button !== 0 || isInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();
    await handleStartDragging();
  }

  async function handleCardContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    await openSettingsWindow();
  }

  const accentHue = currentWord ? 26 + ((currentWord.word.length * 37) % 160) : 36;
  const overlayStyle = {
    "--card-opacity": String(settings.opacity),
    "--cycle-duration": `${settings.intervalMs}ms`,
    "--accent-hue": String(accentHue),
  } as CSSProperties;

  if (!studyData || !currentWord || !currentReviewState) {
    return (
      <main className="overlay-stage">
        <section
          className={`overlay-card overlay-empty overlay-card-draggable${dragging ? " overlay-card-dragging" : ""}`}
          onContextMenu={(event) => void handleCardContextMenu(event)}
          onMouseDown={(event) => void handleCardMouseDown(event)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={overlayStyle}
          title="左键拖动，右键打开设置"
        >
          <div className="overlay-backdrop" />
          <div className="overlay-rim" />
          <div className="overlay-content">
            <div className="overlay-word">Import Words</div>
            <div className="overlay-meaning is-visible">还没有可用词库</div>
          </div>
          <div className="overlay-actions overlay-actions-single">
            <button className="overlay-action overlay-action-settings" onClick={() => void openSettingsWindow()} type="button">
              打开设置
            </button>
          </div>
          {errorMessage ? <p className="overlay-diagnostic">{errorMessage}</p> : null}
        </section>
      </main>
    );
  }

  const shouldShowMeaning = shouldRevealMeaning(
    settings.displayMode,
    currentReviewState,
    revealProgress,
    settings.revealTiming,
  );

  return (
    <main className="overlay-stage">
      <section
        key={`${currentWord.id}-${currentReviewState.lastReviewedAt ?? "initial"}`}
        aria-live="polite"
        className={`overlay-card overlay-card-draggable${dragging ? " overlay-card-dragging" : ""}${isHovered ? " is-hovered" : ""}`}
        onContextMenu={(event) => void handleCardContextMenu(event)}
        onMouseDown={(event) => void handleCardMouseDown(event)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={overlayStyle}
        title="左键拖动，右键打开设置"
      >
        <div className="overlay-backdrop" />
        <div className="overlay-rim" />

        <div className="overlay-content">
          <div className="overlay-word">{currentWord.word}</div>
          <div className="overlay-progress" style={{ transform: `scaleX(${revealProgress})` }} />
          <div className={`overlay-meaning${shouldShowMeaning ? " is-visible" : ""}`}>
            {currentWord.meaningZh}
          </div>
        </div>

        <div className={`overlay-actions${settings.hoverShowButtons ? "" : " is-visible"}`}>
          {REVIEW_RESULT_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`overlay-action overlay-action-${option.value}`}
              disabled={reviewing !== null}
              onClick={() => void handleReview(option.value)}
              title={option.caption.trim()}
              type="button"
            >
              {reviewing === option.value ? "..." : option.label}
            </button>
          ))}
        </div>
        {errorMessage ? <p className="overlay-diagnostic">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
