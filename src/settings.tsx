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
  throw new Error("AmbientCard settings root is missing.");
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
    <section style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:560px;border:1px solid rgba(239,68,68,0.2);border-radius:16px;padding:28px 30px;background:rgba(20,20,24,0.8);">
        <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#ef4444;font-weight:600;">AmbientCard / startup error</div>
        <h1 style="margin:16px 0 12px;font-size:28px;font-weight:600;color:#ffffff;">设置页启动失败</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.5);">这次不是纯白页了。下面是初始化时抛出的错误，便于继续定位。</p>
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;padding:16px;border-radius:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(239,68,68,0.1);color:#fca5a5;font:13px/1.6 Consolas,'Courier New',monospace;">${message}</pre>
      </div>
    </section>
  `;
}

// Debug: Show if script is running
console.log("[Settings] Script starting...");

document.body.dataset.view = "settings";
document.documentElement.dataset.view = "settings";

// Clear the initial loading HTML to ensure clean render
root.innerHTML = "";

window.addEventListener("error", (event) => {
  console.error("[Settings] Global error:", event.error);
  renderFatal(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Settings] Unhandled rejection:", event.reason);
  renderFatal(event.reason);
});

// Add timeout to detect if React doesn't render
const renderTimeout = setTimeout(() => {
  console.error("[Settings] Render timeout - React didn't mount within 3 seconds");
  renderFatal(new Error("React render timeout - check console for details"));
}, 3000);

try {
  console.log("[Settings] Creating React root...");
  const reactRoot = ReactDOM.createRoot(root);
  console.log("[Settings] Rendering SettingsView...");
  reactRoot.render(
    <React.StrictMode>
      <SettingsErrorBoundary>
        <SettingsView />
      </SettingsErrorBoundary>
    </React.StrictMode>,
  );
  // Clear timeout if render succeeds
  clearTimeout(renderTimeout);
  console.log("[Settings] Render called successfully");
} catch (error) {
  clearTimeout(renderTimeout);
  console.error("[Settings] Render error:", error);
  renderFatal(error);
}
