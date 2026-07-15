import { createContext, useCallback, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

// Platform-wide dark/light mode, including the Interview Prep section (previously drove its own
// separate localStorage-backed toggle, independent of this one — migrated onto this single
// source of truth so the whole app stays in sync). Sets data-theme on <html>, which theme.css's
// :root[data-theme="dark"] block reads — every element using var(--paper)/var(--ink)/var(--line)
// etc. (inline styles included) picks up the new values automatically, no per-page changes needed.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("caTheme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("caTheme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
