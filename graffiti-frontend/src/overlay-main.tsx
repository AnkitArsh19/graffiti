import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { OverlayCanvas } from "./components/OverlayCanvas";

try {
  const savedTheme = localStorage.getItem("graffiti:theme:v3") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
} catch {}

const root = document.getElementById("overlay-root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ShortcutsProvider>
        <OverlayCanvas />
      </ShortcutsProvider>
    </StrictMode>
  );
}

