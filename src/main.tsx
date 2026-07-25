import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Restore SPA path if redirected via public/404.html fallback
const redirectUrl = sessionStorage.getItem("spa_redirect");
if (redirectUrl) {
  sessionStorage.removeItem("spa_redirect");
  try {
    const url = new URL(redirectUrl);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch {
    // Ignore invalid URL
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
