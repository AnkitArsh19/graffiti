import React, { useState, useEffect, useCallback } from "react";
import { RotateCw, X, Smartphone, Sparkles, Check } from "lucide-react";

interface LandscapePromptProps {
  onDismiss?: () => void;
}

export const LandscapePrompt: React.FC<LandscapePromptProps> = ({ onDismiss }) => {
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("graffiti:dismiss_landscape_prompt") === "true";
    } catch {
      return false;
    }
  });
  const [attemptedLock, setAttemptedLock] = useState(false);

  const checkOrientation = useCallback(() => {
    if (typeof window === "undefined") return;
    const isMobileWidth = window.innerWidth <= 768;
    const isPortrait = window.innerHeight > window.innerWidth;
    setIsPortraitMobile(isMobileWidth && isPortrait);
  }, []);

  useEffect(() => {
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    const mql = window.matchMedia("(orientation: portrait)");
    const mqlHandler = () => checkOrientation();
    if (mql.addEventListener) {
      mql.addEventListener("change", mqlHandler);
    }

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
      if (mql.removeEventListener) {
        mql.removeEventListener("change", mqlHandler);
      }
    };
  }, [checkOrientation]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("graffiti:dismiss_landscape_prompt", "true");
    } catch {}
    onDismiss?.();
  };

  const handleRotateRequest = async () => {
    setAttemptedLock(true);
    try {
      // Screen Orientation API supported in fullscreen / mobile browsers
      const screenAny = window.screen as any;
      if (screenAny?.orientation?.lock) {
        await screenAny.orientation.lock("landscape");
      }
    } catch {
      // Ignored if browser requires user gesture or fullscreen
    }
    setTimeout(() => setAttemptedLock(false), 2500);
  };

  if (!isPortraitMobile) return null;

  if (isDismissed) {
    return (
      <button
        onClick={() => setIsDismissed(false)}
        className="landscape-mini-pill"
        title="Switch to landscape for wider canvas"
        aria-label="Rotate to Landscape"
      >
        <RotateCw size={12} className="rotate-icon-pulse" />
        <span>Landscape</span>
      </button>
    );
  }

  return (
    <div className="landscape-modal-overlay" role="dialog" aria-modal="true" aria-label="Rotate device to landscape">
      <div className="landscape-modal-card">
        <button
          onClick={handleDismiss}
          className="landscape-modal-close"
          aria-label="Close landscape prompt"
          title="Close"
        >
          <X size={16} />
        </button>

        <div className="landscape-modal-visual">
          <div className="phone-animation-container">
            <div className="phone-icon-portrait">
              <Smartphone size={38} strokeWidth={1.8} />
            </div>
            <div className="rotation-arrow-arc">
              <RotateCw size={22} className="spin-slow" />
            </div>
            <div className="phone-icon-landscape">
              <Smartphone size={38} strokeWidth={1.8} style={{ transform: "rotate(90deg)" }} />
            </div>
          </div>
        </div>

        <div className="landscape-modal-content">
          <div className="landscape-badge">
            <Sparkles size={12} />
            <span>Recommended Experience</span>
          </div>
          <h3 className="landscape-title">Turn to Landscape Mode</h3>
          <p className="landscape-desc">
            Graffiti is designed for wide screens. Turn your device horizontally for full toolbars, expansive drawing room, and optimal live collaboration.
          </p>
        </div>

        <div className="landscape-actions">
          <button onClick={handleRotateRequest} className="landscape-primary-btn">
            {attemptedLock ? <Check size={15} /> : <RotateCw size={15} />}
            <span>{attemptedLock ? "Rotate Device Now" : "Rotate to Landscape"}</span>
          </button>
          <button onClick={handleDismiss} className="landscape-secondary-btn">
            Continue in Portrait
          </button>
        </div>
      </div>
    </div>
  );
};
