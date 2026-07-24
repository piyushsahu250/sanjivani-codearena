import { useEffect, useRef, useState } from "react";

// Counts a number up from 0 once its element scrolls into view, then disconnects — used by the
// landing page's stat cards so they animate on first reveal instead of firing immediately on
// mount (which would happen off-screen, below the fold, and be missed entirely).
export default function useCountUp(target, { duration = 1400 } = {}) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let done = false;
    function animate() {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(fallback);
      const start = performance.now();
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) animate();
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    // Safety net: browsers throttle/suspend IntersectionObserver callbacks for backgrounded or
    // non-composited tabs (confirmed by hand during testing — see landing page review notes), so
    // a stat card opened that way would otherwise stay stuck at "0" indefinitely instead of ever
    // showing its real number. If the observer hasn't fired within a few seconds, animate anyway.
    const fallback = setTimeout(animate, 3000);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [target, duration]);

  return [ref, value];
}
