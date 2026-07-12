import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timeoutsRef.current[id]);
    delete timeoutsRef.current[id];
  }, []);

  const show = useCallback((message, type = "info", duration = 3500) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message, type }]);
    timeoutsRef.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg, d) => show(msg, "success", d),
    error: (msg, d) => show(msg, "error", d),
    info: (msg, d) => show(msg, "info", d),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="ca-toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`ca-toast ${t.type}`} onClick={() => dismiss(t.id)} role="status">
            <span>{t.type === "success" ? "✓" : t.type === "error" ? "⚠" : "ℹ"}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
