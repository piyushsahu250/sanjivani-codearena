import { useCallback, useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";

const FACE_CHECK_INTERVAL_MS = 2000;
const FACE_CONFIDENCE_THRESHOLD = 0.7;
const VIOLATION_DEDUPE_MS = 1200; // collapses e.g. fullscreenchange+visibilitychange firing together into one event

// Shared proctoring primitives for a locked-down assessment — extracted so both the exam
// (TestTaking.jsx, unchanged, still has its own inline copy) and the new module coding
// assessment can use a consistent violation set. Covers: fullscreen enforcement, tab-switch,
// copy/paste/cut blocking, right-click blocking, F12/devtools-shortcut blocking (+ a best-effort
// docked-devtools size heuristic), a refresh/navigate-away warning, a best-effort multi-monitor
// check, and (if requireWebcam) face presence detection via the same blazeface model the exam
// side already uses — extended here to also flag MULTIPLE faces, not just a missing one. No
// image is ever captured or stored (this platform has no object storage) — face checks only
// ever produce a logged violation event.
export function useProctoring({ active, requireFullscreen = true, requireWebcam = false, requireMicrophone = false, onViolation }) {
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const lastViolationAtRef = useRef({});
  const report = useCallback(
    (type) => {
      if (!active) return;
      const now = Date.now();
      const last = lastViolationAtRef.current[type] || 0;
      if (now - last < VIOLATION_DEDUPE_MS) return;
      lastViolationAtRef.current[type] = now;
      onViolationRef.current?.(type);
    },
    [active]
  );

  const requestFullscreen = useCallback(() => {
    return document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  // Fullscreen-exit detection — immediately attempts to re-enter; browsers that block
  // programmatic re-entry without a fresh gesture will silently no-op it.
  useEffect(() => {
    if (!active || !requireFullscreen) return;
    function handleChange() {
      if (!document.fullscreenElement) {
        report("FULLSCREEN_EXIT");
        requestFullscreen();
      }
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, [active, requireFullscreen, report, requestFullscreen]);

  // Tab switch / window blur.
  useEffect(() => {
    if (!active) return;
    function handleVisibility() {
      if (document.hidden) {
        report("TAB_SWITCH");
      } else if (requireFullscreen && !document.fullscreenElement) {
        requestFullscreen();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [active, requireFullscreen, report, requestFullscreen]);

  // Copy / paste / cut — blocked outright, not just logged.
  useEffect(() => {
    if (!active) return;
    function block(type) {
      return (e) => {
        e.preventDefault();
        report(type);
      };
    }
    const onCopy = block("COPY");
    const onPaste = block("PASTE");
    const onCut = block("CUT");
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("cut", onCut);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("cut", onCut);
    };
  }, [active, report]);

  // Right-click.
  useEffect(() => {
    if (!active) return;
    function onContextMenu(e) {
      e.preventDefault();
      report("RIGHT_CLICK");
    }
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [active, report]);

  // F12 / devtools shortcuts / view-source — blocked where preventDefault actually works.
  // PrintScreen can be logged but never blocked (the OS captures it before JS sees the event) —
  // a real browser limitation, not a gap in this implementation.
  useEffect(() => {
    if (!active) return;
    function onKeyDown(e) {
      const key = e.key;
      if (key === "PrintScreen") {
        report("PRINT_SCREEN_ATTEMPT");
        return;
      }
      const blocked =
        key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C", "i", "j", "c"].includes(key)) ||
        (e.ctrlKey && ["u", "U"].includes(key));
      if (blocked) {
        e.preventDefault();
        report("DEVTOOLS");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, report]);

  // Docked-devtools heuristic: a large outer/inner window size gap usually means devtools is
  // open docked to a side. Best-effort only — an undocked devtools window defeats it entirely;
  // documented as a known limitation, not hidden.
  useEffect(() => {
    if (!active) return;
    const THRESHOLD = 160;
    const interval = setInterval(() => {
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      if (widthGap > THRESHOLD || heightGap > THRESHOLD) report("DEVTOOLS");
    }, 3000);
    return () => clearInterval(interval);
  }, [active, report]);

  // Refresh / navigate-away attempt — the browser's own native confirm dialog is the actual
  // deterrent; this just logs that the attempt happened.
  useEffect(() => {
    if (!active) return;
    function onBeforeUnload(e) {
      report("REFRESH_ATTEMPT");
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active, report]);

  // Best-effort multi-monitor check — Chrome's experimental, permission-free screen.isExtended
  // boolean. Most browsers simply don't expose it, in which case this never fires — the full
  // Window Management API (getScreenDetails()) would need an intrusive extra permission prompt,
  // deliberately not requested here.
  useEffect(() => {
    if (!active) return;
    if (typeof window.screen?.isExtended === "boolean" && window.screen.isExtended) {
      report("MULTI_MONITOR");
    }
  }, [active, report]);

  // ---- Webcam: face presence (missing / multiple) ----
  const [mediaGranted, setMediaGranted] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [requestingMedia, setRequestingMedia] = useState(false);
  const mediaStreamRef = useRef(null);
  const videoRef = useRef(null);
  const [faceStatus, setFaceStatus] = useState("OK"); // OK | MISSING | MULTIPLE
  const faceStatusRef = useRef("OK");
  const faceModelRef = useRef(null);

  const requestMedia = useCallback(async () => {
    setRequestingMedia(true);
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: requireWebcam, audio: requireMicrophone });
      mediaStreamRef.current = stream;
      setMediaGranted(true);
    } catch (err) {
      setMediaError(
        err.name === "NotAllowedError"
          ? `${requireWebcam && requireMicrophone ? "Camera and microphone" : requireMicrophone ? "Microphone" : "Camera"} access was denied. Please allow it to begin.`
          : err.name === "NotFoundError"
          ? `No ${requireWebcam && requireMicrophone ? "camera or microphone" : requireMicrophone ? "microphone" : "camera"} was found on this device.`
          : "Could not access your camera/microphone. Please check your device and browser permissions."
      );
      setMediaGranted(false);
    } finally {
      setRequestingMedia(false);
    }
  }, [requireWebcam, requireMicrophone]);

  const stopMedia = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  useEffect(() => {
    if (mediaGranted && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [mediaGranted]);

  useEffect(() => {
    if (!requireWebcam) return;
    let cancelled = false;
    tf.ready()
      .then(() => blazeface.load())
      .then((model) => {
        if (!cancelled) faceModelRef.current = model;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [requireWebcam]);

  useEffect(() => {
    if (!active || !requireWebcam) return;
    const video = videoRef.current;
    if (!video) return;
    const interval = setInterval(async () => {
      const model = faceModelRef.current;
      if (!model || document.hidden || video.readyState < 2) return;
      let predictions;
      try {
        predictions = await model.estimateFaces(video, false);
      } catch {
        return;
      }
      const faces = predictions.filter((p) => (p.probability?.[0] ?? 1) >= FACE_CONFIDENCE_THRESHOLD);
      const nextStatus = faces.length === 0 ? "MISSING" : faces.length > 1 ? "MULTIPLE" : "OK";
      if (nextStatus !== faceStatusRef.current) {
        faceStatusRef.current = nextStatus;
        setFaceStatus(nextStatus);
        if (nextStatus === "MISSING") report("FACE_MISSING");
        else if (nextStatus === "MULTIPLE") report("MULTIPLE_FACES");
      }
    }, FACE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, requireWebcam, report]);

  useEffect(() => {
    if (!active || (!requireWebcam && !requireMicrophone)) return;
    const stream = mediaStreamRef.current;
    if (!stream) return;
    function handleEnded(kind) {
      return () => report(kind === "video" ? "CAMERA_DROPPED" : "MIC_DROPPED");
    }
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    const onVideoEnded = handleEnded("video");
    const onAudioEnded = handleEnded("audio");
    videoTracks.forEach((t) => t.addEventListener("ended", onVideoEnded));
    audioTracks.forEach((t) => t.addEventListener("ended", onAudioEnded));
    const poll = setInterval(() => {
      if (videoTracks.length && !videoTracks.every((t) => t.readyState === "live")) report("CAMERA_DROPPED");
      if (audioTracks.length && !audioTracks.every((t) => t.readyState === "live")) report("MIC_DROPPED");
    }, 5000);
    return () => {
      videoTracks.forEach((t) => t.removeEventListener("ended", onVideoEnded));
      audioTracks.forEach((t) => t.removeEventListener("ended", onAudioEnded));
      clearInterval(poll);
    };
  }, [active, requireWebcam, requireMicrophone, report]);

  // Background-noise / silent-environment reminder — purely informational, exactly like the
  // exam proctoring's noise check: never calls report(), never counts toward violations. Spec
  // is explicit that this "should not count as a cheating warning."
  const [noiseWarning, setNoiseWarning] = useState(false);
  const noiseWarningTimeoutRef = useRef(null);
  const lastNoiseWarningAtRef = useRef(0);

  useEffect(() => {
    if (!active || !requireMicrophone) return;
    const stream = mediaStreamRef.current;
    if (!stream || stream.getAudioTracks().length === 0) return;

    let audioContext;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const NOISE_RMS_THRESHOLD = 0.35;
    const NOISE_WARNING_COOLDOWN_MS = 20000;

    const interval = setInterval(() => {
      if (document.hidden) return;
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      if (rms > NOISE_RMS_THRESHOLD) {
        const now = Date.now();
        if (now - lastNoiseWarningAtRef.current > NOISE_WARNING_COOLDOWN_MS) {
          lastNoiseWarningAtRef.current = now;
          setNoiseWarning(true);
          clearTimeout(noiseWarningTimeoutRef.current);
          noiseWarningTimeoutRef.current = setTimeout(() => setNoiseWarning(false), 5000);
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(noiseWarningTimeoutRef.current);
      source.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [active, requireMicrophone]);

  useEffect(() => {
    return () => stopMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    requestFullscreen,
    mediaGranted, mediaError, requestingMedia, requestMedia, stopMedia, videoRef, faceStatus,
    noiseWarning,
  };
}
