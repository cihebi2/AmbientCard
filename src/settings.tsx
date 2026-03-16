import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/700.css";
import { SettingsView } from "./components/SettingsView";
import "./styles.css";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("DeskVocab settings root is missing.");
}

const root = rootElement;

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: unknown;
}

class SettingsErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown) {
    renderFatal(error);
  }

  render() {
    if (this.state.error) {
      return null;
    }

    return this.props.children;
  }
}

function renderFatal(error: unknown) {
  const message = escapeHtml(getErrorMessage(error));

  root.innerHTML = `
    <section style="min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top, rgba(125, 40, 40, 0.18), transparent 36%), linear-gradient(180deg, #fff8f4 0%, #f3e3d7 100%);color:#482311;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:560px;border:1px solid rgba(72, 35, 17, 0.14);border-radius:24px;padding:28px 30px;background:rgba(255,255,255,0.76);box-shadow:0 18px 56px rgba(72, 35, 17, 0.12);backdrop-filter:blur(18px);">
        <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;opacity:0.68;">DeskVocab / startup error</div>
        <h1 style="margin:12px 0 10px;font:700 38px/1.05 Georgia,serif;">设置页启动失败</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.7;opacity:0.82;">这次不是纯白页了。下面是初始化时抛出的错误，便于继续定位。</p>
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;padding:14px 16px;border-radius:16px;background:rgba(72,35,17,0.08);font:13px/1.6 Consolas,'Courier New',monospace;">${message}</pre>
      </div>
    </section>
  `;
}

window.addEventListener("error", (event) => {
  renderFatal(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  renderFatal(event.reason);
});

document.body.dataset.view = "settings";
document.documentElement.dataset.view = "settings";

try {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SettingsErrorBoundary>
        <SettingsView />
      </SettingsErrorBoundary>
    </React.StrictMode>,
  );
} catch (error) {
  renderFatal(error);
}
