import { createContext, useCallback, useContext, useState } from "react";

const SidebarContext = createContext(null);

// Coordinates the mobile sidebar drawer between the Topbar's hamburger button (in Navbar.jsx,
// rendered per-page) and the Sidebar drawer itself (rendered once by Protected in App.jsx) —
// they're siblings, not parent/child, so this small shared bit of state is simpler than prop
// threading through every route.
export function SidebarUIProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = useCallback(() => setMobileOpen((o) => !o), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  return <SidebarContext.Provider value={{ mobileOpen, toggleMobile, closeMobile }}>{children}</SidebarContext.Provider>;
}

export function useSidebarUI() {
  return useContext(SidebarContext);
}
