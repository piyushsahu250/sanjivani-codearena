import { createContext, useCallback, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

// Platform-wide dark/light mode — separate from the pre-existing per-page "interviewPrepDark"
// toggle used only inside the Interview Prep section (that one is scoped to its own pages via a
// local CSS class and is left as-is here, not migrated, to avoid touching a working feature).
// This one sets data-theme on <html>, which theme.css's :root[data-theme="dark"] block reads —
// every element using var(--paper)/var(--ink)/var(--line) etc. (inline styles included) picks up
// the new values automatically, no per-page changes needed.
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
