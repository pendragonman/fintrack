import { useEffect, useId, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function visibleItems(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

function Modal({ title, onClose, closeOnBackdrop = false, children }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);

  // Focus the first control on open, restore focus when closed.
  useEffect(() => {
    restoreRef.current = document.activeElement;
    const node = dialogRef.current;
    if (node) {
      const items = visibleItems(node);
      (items[0] || node).focus();
    }
    return () => {
      const target = restoreRef.current;
      if (target && typeof target.focus === "function" && document.contains(target)) {
        target.focus();
      }
    };
  }, []);

  // Escape closes; Tab is trapped inside the dialog.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = visibleItems(dialogRef.current);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        ref={dialogRef}
        tabIndex={-1}
      >
        {title && (
          <div className="modal-header">
            <h2 className="modal-title" id={titleId}>
              {title}
            </h2>
            {onClose && (
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                onClick={onClose}
              >
                ✕
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export default Modal;
