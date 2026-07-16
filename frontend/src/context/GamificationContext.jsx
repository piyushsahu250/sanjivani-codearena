import { createContext, useCallback, useContext, useState } from "react";

const GamificationContext = createContext(null);

// Renders a stack of celebratory toasts (XP earned / level up / badge unlocked) driven directly
// by API responses — most gamification-triggering endpoints (practice run, lesson progress,
// module test submit, exam finalize) now return a `gamification` field, so this needs no
// separate round trip or polling. Silently no-ops on a null/empty payload.
export function GamificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((gamification) => {
    if (!gamification) return;
    const items = [];
    if (gamification.xpAwarded > 0) items.push({ type: "xp", text: `+${gamification.xpAwarded} XP` });
    if (gamification.leveledUp) items.push({ type: "level", text: `Level up! You're now Level ${gamification.level.level} — ${gamification.level.name}` });
    for (const b of gamification.newBadges || []) items.push({ type: "badge", text: `${b.icon ? `${b.icon} ` : ""}Badge unlocked: ${b.name}` });
    if (items.length === 0) return;

    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, items }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <GamificationContext.Provider value={{ notify }}>
      {children}
      <div style={{ position: "fixed", bottom: 20, right: 20, display: "grid", gap: 10, zIndex: 9999, maxWidth: 320 }}>
        {toasts.map((t) => (
          <div key={t.id} className="card gami-toast" style={{ padding: 14 }}>
            {t.items.map((it, i) => (
              <div
                key={i}
                className="mono"
                style={{
                  fontSize: 13, fontWeight: it.type === "level" ? 700 : 600,
                  color: it.type === "xp" ? "var(--mint)" : it.type === "level" ? "var(--amber-dark)" : "var(--ink)",
                  marginTop: i > 0 ? 4 : 0,
                }}
              >
                {it.text}
              </div>
            ))}
          </div>
        ))}
      </div>
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const ctx = useContext(GamificationContext);
  if (!ctx) throw new Error("useGamification must be used within GamificationProvider");
  return ctx;
}
