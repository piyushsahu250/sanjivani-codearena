import { useEffect, useState } from "react";
import api from "../api";

// Cached module-level so every page mounting this hook shares one network call instead of each
// page firing its own /ai/status request.
let cachedPromise = null;
function fetchAiStatus() {
  if (!cachedPromise) {
    cachedPromise = api.get("/ai/status").then((res) => !!res.data.configured).catch(() => false);
  }
  return cachedPromise;
}

// Returns null while loading (callers should hide/disable AI buttons during this brief window
// rather than flash them enabled), then true/false once the server has answered.
export default function useAiStatus() {
  const [configured, setConfigured] = useState(null);
  useEffect(() => {
    let mounted = true;
    fetchAiStatus().then((val) => {
      if (mounted) setConfigured(val);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return configured;
}
