import { useEffect, useRef } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const LOAD_TIMEOUT_MS = 10000;

function waitForGoogleApi(resolve, reject) {
  const started = Date.now();
  const timer = setInterval(() => {
    if (window.google?.accounts?.id) {
      clearInterval(timer);
      resolve();
    } else if (Date.now() - started > LOAD_TIMEOUT_MS) {
      clearInterval(timer);
      reject(new Error("Google Identity Services did not load"));
    }
  }, 100);
}

function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();

  // The script may still be loading from a previous mount, or it may have
  // finished loading before we could attach listeners. Poll for the API
  // instead of resolving just because the <script> tag exists.
  const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise(waitForGoogleApi);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => waitForGoogleApi(resolve, reject);
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

function GoogleButton({ onCredential }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let initialized = false;
    let lastWidth = 0;
    let observer = null;

    function renderButton() {
      if (cancelled || !initialized || !window.google?.accounts?.id) return;
      const width = Math.round(container.getBoundingClientRect().width);
      if (!width || width === lastWidth) return;
      lastWidth = width;
      container.innerHTML = "";
      window.google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        width: Math.min(Math.max(width, 200), 400),
        text: "continue_with",
      });
    }

    loadGoogle()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => onCredential(response.credential),
        });
        initialized = true;
        renderButton();
        // Re-render only when the available width actually changes; this
        // observer also fires when the button iframe is inserted, so the
        // width check prevents a render loop.
        observer = new ResizeObserver(renderButton);
        observer.observe(container);
      })
      .catch(() => {
        // The Google script can be blocked by an extension or network policy.
        // The email/password form remains fully usable in that case.
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [onCredential]);

  if (!CLIENT_ID) return null;

  return <div ref={containerRef} className="google-btn"></div>;
}

export default GoogleButton;
