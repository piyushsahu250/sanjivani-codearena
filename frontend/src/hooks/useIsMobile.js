import { useEffect, useState } from "react";

// Below this, the exam/module-coding-test layouts switch from a fixed-width 3-column
// desktop layout to a stacked, single-column mobile layout — see TestTaking.jsx and
// ModuleCodingAssessment.jsx.
const BREAKPOINT = "(max-width: 860px)";

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.matchMedia(BREAKPOINT).matches : false));

  useEffect(() => {
    const mql = window.matchMedia(BREAKPOINT);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
