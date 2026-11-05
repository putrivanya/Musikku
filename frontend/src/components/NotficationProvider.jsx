
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import "./NotificationProvider.css";

const NotificationContext = createContext(null);

export function useNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotification harus digunakan di dalam NotificationProvider."
    );
  }

  return context;
}

export default function NotificationProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const notify = useCallback(({
    type = "info",
    title = "Informasi",
    message = "",
    duration = 4000,
  }) => {
    const id = Date.now() + Math.random();

    setToast({ id, type, title, message, duration });
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast]);

  const confirm = useCallback(({
    title = "Konfirmasi Tindakan",
    message = "Apakah kamu yakin ingin melanjutkan?",
    confirmText = "Ya, Lanjutkan",
    cancelText = "Batal",
    danger = false,
  } = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve;

      setDialog({
        title,
        message,
        confirmText,
        cancelText,
        danger,
      });
    });
  }, []);

  const tutupDialog = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  };

  useEffect(() => {
    return () => {
      resolver.current?.(false);
      resolver.current = null;
    };
  }, []);

  const icon = {
    success: "✓",
    error: "✕",
    warning: "!",
    info: "i",
  };

  return (
    <NotificationContext.Provider value={{ notify, confirm }}>
      {children}

      {toast && (
        <div
          key={toast.id}
          className={`mk-toast mk-toast-${toast.type}`}
          role="status"
          aria-live="polite"
        >
          <div className="mk-toast-icon">
            {icon[toast.type] || icon.info}
          </div>

          <div className="mk-toast-content">
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>

          <button
            type="button"
            className="mk-toast-close"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
          >
            ×
          </button>

          <div
            className="mk-toast-progress"
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}

      {dialog && (
        <div
          className="mk-dialog-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              tutupDialog(false);
            }
          }}
        >
          <section
            className="mk-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mk-dialog-title"
            aria-describedby="mk-dialog-description"
          >
            <div className={`mk-dialog-icon ${dialog.danger ? "danger" : ""}`}>
              {dialog.danger ? "!" : "?"}
            </div>

            <span className="mk-dialog-kicker">MUSIKKU SECURITY</span>

            <h3 id="mk-dialog-title">{dialog.title}</h3>

            <p id="mk-dialog-description">{dialog.message}</p>

            <div className="mk-dialog-actions">
              <button
                type="button"
                className="mk-dialog-cancel"
                onClick={() => tutupDialog(false)}
              >
                {dialog.cancelText}
              </button>

              <button
                type="button"
                className={`mk-dialog-confirm ${
                  dialog.danger ? "danger" : ""
                }`}
                onClick={() => tutupDialog(true)}
              >
                {dialog.confirmText}
              </button>
            </div>
          </section>
        </div>
      )}
    </NotificationContext.Provider>
  );
}
