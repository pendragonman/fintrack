import { useEffect, useRef } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadScript() {
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function GoogleButton({ onCredential }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    function renderButton() {
      if (cancelled || !window.google || !containerRef.current) return;

      const measuredWidth = Math.round(
        containerRef.current.getBoundingClientRect().width
      );
      if (!measuredWidth) return;

      containerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        width: Math.min(Math.max(measuredWidth, 200), 400),
        text: "continue_with",
      });
    }

    loadScript().then(() => {
      if (cancelled || !window.google || !containerRef.current) return;

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });

      renderButton();
    });

    const resizeObserver = new ResizeObserver(() => renderButton());
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, [onCredential]);

  if (!CLIENT_ID) return null;

  return <div ref={containerRef} className="google-btn"></div>;
}

export default GoogleButton;
