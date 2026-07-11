import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import api from "../api";
import { useGamification } from "../context/GamificationContext";

const FACE_CHECK_INTERVAL_MS = 2000;
const FACE_CONFIDENCE_THRESHOLD = 0.7;

const LANGUAGES = [
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "python", label: "Python", monaco: "python" },
  { id: "c", label: "C", monaco: "c" },
  { id: "cpp", label: "C++", monaco: "cpp" },
  { id: "java", label: "Java", monaco: "java" },
];

const MAX_TAB_VIOLATIONS = 3;

export default function TestTaking() {
  const { id: testId } = useParams();
  const navigate = useNavigate();
  const { notify } = useGamification();

  const [testMeta, setTestMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);

  const [test, setTest] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: { language, code } | { selected: number[] } }
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [queueStatus, setQueueStatus] = useState(null);
  const [submittedQuestions, setSubmittedQuestions] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [tabWarning, setTabWarning] = useState(null);
  const [showQuestionPanel, setShowQuestionPanel] = useState(true);
  const [showResultsPanel, setShowResultsPanel] = useState(true);
  const [questionPanelWidth, setQuestionPanelWidth] = useState(420);
  const [resultsPanelHeight, setResultsPanelHeight] = useState(220);
  const resizingRef = useRef(null); // "question" | "results" | null
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const timerRef = useRef(null);
  const deadlineRef = useRef(null); // absolute ms timestamp this candidate's answers lock at
  const attemptIdRef = useRef(null);
  const finalizedRef = useRef(false);

  const [mediaGranted, setMediaGranted] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [requestingMedia, setRequestingMedia] = useState(false);
  const mediaStreamRef = useRef(null);
  const preflightVideoRef = useRef(null);
  const liveVideoRef = useRef(null);

  const [faceMissing, setFaceMissing] = useState(false);
  const faceModelRef = useRef(null);
  const faceMissingRef = useRef(false); // mirrors faceMissing for use inside the polling interval closure

  const [noiseWarning, setNoiseWarning] = useState(false);
  const noiseWarningTimeoutRef = useRef(null);
  const lastNoiseWarningAtRef = useRef(0);

  // MCQ/TRUE_FALSE/MULTISELECT and CODING answers both auto-save in the background — no
  // per-question Submit, no lock. Coding just saves the draft (no judging); MCQ grades
  // instantly since exact-match grading is free. Both share the same debounce/indicator
  // machinery below, keyed by which pending-save ref is populated.
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const autoSaveTimeoutRef = useRef(null);
  const pendingAutoSaveRef = useRef(null); // MCQ: { questionId, selected }
  const codeAutoSaveTimeoutRef = useRef(null);
  const pendingCodeAutoSaveRef = useRef(null); // Coding: { questionId, language, code }
  const justSavedTimeoutRef = useRef(null);

  const [markedForReview, setMarkedForReview] = useState({});

  // Load basic test info up front so we can show a "Begin Test" screen
  // (fullscreen must be requested from a direct click, not on page load).
  useEffect(() => {
    api
      .get(`/tests/${testId}`)
      .then((res) => setTestMeta(res.data))
      .catch((err) => setMetaError(err.response?.data?.error || "Could not load this test"));
  }, [testId]);

  async function requestMedia() {
    setRequestingMedia(true);
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      setMediaGranted(true);
    } catch (err) {
      const reason =
        err.name === "NotAllowedError"
          ? "Camera and microphone access was denied. Please allow both to begin this test."
          : err.name === "NotFoundError"
          ? "No camera or microphone was found on this device. Both are required to begin this test."
          : "Could not access your camera/microphone. Please check your device and browser permissions.";
      setMediaError(reason);
      setMediaGranted(false);
    } finally {
      setRequestingMedia(false);
    }
  }

  // Attach the granted stream to the preflight preview. This must be an effect (not done
  // inline in requestMedia) because the <video> element only mounts once mediaGranted flips
  // true — assigning srcObject synchronously inside requestMedia hits a ref that's still null.
  useEffect(() => {
    if (mediaGranted && preflightVideoRef.current && mediaStreamRef.current) {
      preflightVideoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [mediaGranted]);

  // Keep the live self-view (shown during the test) in sync with the granted stream
  useEffect(() => {
    if (started && liveVideoRef.current && mediaStreamRef.current) {
      liveVideoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [started]);

  // Continuously monitor that the webcam/mic stay live — a device going 'ended' (unplugged,
  // permission revoked mid-session, etc.) or dropping out of the "live" state counts as a violation.
  useEffect(() => {
    if (!started) return;
    const stream = mediaStreamRef.current;
    if (!stream) return;

    const tracks = stream.getTracks();
    function handleEnded() {
      reportViolation("your camera or microphone was turned off or disconnected");
    }
    tracks.forEach((t) => t.addEventListener("ended", handleEnded));

    const pollInterval = setInterval(() => {
      const stillLive = stream.getTracks().every((t) => t.readyState === "live");
      if (!stillLive) reportViolation("your camera or microphone was turned off or disconnected");
    }, 5000);

    return () => {
      tracks.forEach((t) => t.removeEventListener("ended", handleEnded));
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // Load the face-detection model as soon as the page opens (independent of camera permission,
  // since it's just a network fetch) so it's ready by the time the candidate actually begins.
  // Face detection is best-effort: if the model fails to load (e.g. blocked network), it simply
  // never runs rather than blocking the candidate from taking the test at all.
  useEffect(() => {
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
  }, []);

  // Continuously check that a face is present in frame. Unlike other violations, "no face"
  // is a *state*, not a one-off event: the warning must stay up the whole time no face is
  // detected, and it should count as a single warning per disappearance — not once per poll.
  useEffect(() => {
    if (!started) return;
    const video = liveVideoRef.current;
    if (!video) return;

    const interval = setInterval(async () => {
      const model = faceModelRef.current;
      if (!model || document.hidden || video.readyState < 2 || finalizedRef.current) return;
      let predictions;
      try {
        predictions = await model.estimateFaces(video, false);
      } catch {
        return;
      }
      const faceFound = predictions.some((p) => (p.probability?.[0] ?? 1) >= FACE_CONFIDENCE_THRESHOLD);

      if (!faceFound && !faceMissingRef.current) {
        faceMissingRef.current = true;
        setFaceMissing(true);
        reportViolation("no face was detected in the camera frame — stay visible for the whole test");
      } else if (faceFound && faceMissingRef.current) {
        faceMissingRef.current = false;
        setFaceMissing(false);
      }
    }, FACE_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // Background-noise monitoring — purely informational, per spec: it never reports a
  // violation, never touches the 3-strike counter, and never blocks the candidate. Just a
  // courtesy nudge if the mic picks up sustained loud audio (conversation, TV, etc.).
  useEffect(() => {
    if (!started) return;
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

    const NOISE_RMS_THRESHOLD = 0.35; // conservative, tuned to avoid flagging normal typing/breathing
    const NOISE_WARNING_COOLDOWN_MS = 20000; // don't re-nag more than once per ~20s

    const interval = setInterval(() => {
      if (document.hidden || finalizedRef.current) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // Release camera/mic when the test ends or the component unmounts
  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      clearTimeout(tabWarningTimeoutRef.current);
      clearTimeout(autoSaveTimeoutRef.current);
      clearTimeout(codeAutoSaveTimeoutRef.current);
      clearTimeout(justSavedTimeoutRef.current);
    };
  }, []);

  // Drag-to-resize for the question-description panel (width) and the results panel
  // (height). A single window-level listener pair handles both, gated by resizingRef so it's
  // a no-op the rest of the time.
  useEffect(() => {
    function onMove(e) {
      if (resizingRef.current === "question") {
        setQuestionPanelWidth(Math.max(260, Math.min(760, e.clientX - 220)));
      } else if (resizingRef.current === "results") {
        setResultsPanelHeight(Math.max(100, Math.min(560, window.innerHeight - e.clientY)));
      }
    }
    function onUp() {
      resizingRef.current = null;
      document.body.style.cursor = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startResize(kind) {
    return (e) => {
      e.preventDefault();
      resizingRef.current = kind;
      document.body.style.cursor = kind === "question" ? "col-resize" : "row-resize";
    };
  }

  function toggleMaximizeEditor() {
    const maximized = !showQuestionPanel && !showResultsPanel;
    setShowQuestionPanel(maximized);
    setShowResultsPanel(maximized);
  }

  async function beginTest() {
    setStarting(true);
    // Request fullscreen synchronously in response to the click, before any awaits.
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen can be denied/unsupported — proceed with the test regardless.
    }
    try {
      const startRes = await api.post(`/tests/${testId}/start`);
      setAttemptId(startRes.data.id);
      attemptIdRef.current = startRes.data.id;
      const testRes = await api.get(`/tests/${testId}`);
      setTest(testRes.data);

      // The candidate's deadline is their own start time + the configured duration, capped by
      // the test's scheduled window close — not "time until the window closes" (which was the
      // actual bug: a test open all day with a 3-minute duration was handing out ~24 hours).
      // Anchored to the server-recorded startedAt (fixed at first start, never changes on
      // refresh) so a reload can't reset or extend the clock.
      const startedAtMs = new Date(startRes.data.startedAt).getTime();
      const windowCloseMs = new Date(testRes.data.endTime).getTime();
      const deadline = Math.min(startedAtMs + testRes.data.durationMin * 60 * 1000, windowCloseMs);
      deadlineRef.current = deadline;

      // Restore previously auto-saved answers — a page refresh mid-test shouldn't lose
      // anything already persisted server-side.
      const existingSubs = startRes.data.submissions || [];
      if (existingSubs.length > 0) {
        const restoredAnswers = {};
        const restoredSubmitted = {};
        existingSubs.forEach((s) => {
          restoredSubmitted[s.questionId] = true;
          if (["MCQ", "TRUE_FALSE", "MULTISELECT"].includes(s.language)) {
            try {
              restoredAnswers[s.questionId] = { selected: JSON.parse(s.code) };
            } catch {
              restoredAnswers[s.questionId] = { selected: [] };
            }
          } else {
            restoredAnswers[s.questionId] = { language: s.language, code: s.code };
          }
        });
        setAnswers((prev) => ({ ...restoredAnswers, ...prev }));
        setSubmittedQuestions((prev) => ({ ...restoredSubmitted, ...prev }));
      }
      try {
        setMarkedForReview(JSON.parse(localStorage.getItem(`markedForReview:${startRes.data.id}`) || "{}"));
      } catch {
        // ignore
      }

      setSecondsLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
      setStarted(true);
    } catch (err) {
      setLoadError(err.response?.data?.error || "Could not start this test");
    } finally {
      setStarting(false);
    }
  }

  const questions = test?.questions || [];
  const current = questions[activeIdx]?.question;
  const isQuiz = current && current.questionType !== "CODING";
  const isMulti = current?.questionType === "MULTISELECT";

  // Overall test timer — recomputes remaining time from the fixed deadline every tick rather
  // than decrementing a counter, so it self-corrects instead of drifting if the tab was
  // throttled/backgrounded, and stays accurate across a page refresh.
  useEffect(() => {
    if (secondsLeft === null) return;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        finalizeAndExit(true, "time");
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft !== null]);

  // Initialize/restore the answer for the active question, and reset the run result panel
  useEffect(() => {
    if (!current) return;
    setAnswers((prev) => {
      if (prev[current.id]) return prev;
      if (current.questionType === "CODING") {
        return { ...prev, [current.id]: { language: "javascript", code: current.starterCode || defaultStarter("javascript") } };
      }
      return { ...prev, [current.id]: { selected: [] } };
    });
    setRunResult(null);
  }, [current]);

  // Flush any pending debounced save the moment the candidate navigates away from a question —
  // "auto-save on navigation" per spec, and avoids losing the last few keystrokes/clicks to an
  // in-flight debounce if they jump away right after editing.
  useEffect(() => {
    return () => {
      if (pendingAutoSaveRef.current) flushAutoSave();
      if (pendingCodeAutoSaveRef.current) flushCodeAutoSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  const lastViolationAtRef = useRef(0);
  const tabWarningTimeoutRef = useRef(null);
  function reportViolation(reason) {
    if (!attemptIdRef.current || finalizedRef.current) return;
    // Exiting fullscreen via Escape/Alt-Tab fires both `fullscreenchange` and `visibilitychange`
    // within the same instant — without this guard a single action was double-counted as 2
    // violations, which made the 3-strike limit feel broken/erratic.
    const now = Date.now();
    if (now - lastViolationAtRef.current < 1500) return;
    lastViolationAtRef.current = now;
    api
      .post(`/tests/attempts/${attemptIdRef.current}/violation`)
      .then(({ data }) => {
        if (data.autoSubmitted) {
          finalizedRef.current = true;
          setAutoSubmitted(true);
          if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
          // No alert() here — a dedicated full-screen message is shown once `autoSubmitted`
          // is true, and native alert()/confirm() dialogs force the browser to exit
          // fullscreen before they can render, which would fight the auto-submit cleanup.
        } else {
          // No alert() here either: showing a native dialog while in fullscreen forces the
          // browser to silently exit fullscreen first, which was actively working against
          // the "immediately return to fullscreen" requirement. An on-page banner instead.
          const message = `Warning ${data.tabSwitchCount}/${MAX_TAB_VIOLATIONS}: ${reason}. The test will auto-submit if this happens ${MAX_TAB_VIOLATIONS} times.`;
          setTabWarning(message);
          clearTimeout(tabWarningTimeoutRef.current);
          tabWarningTimeoutRef.current = setTimeout(() => setTabWarning(null), 6000);
        }
      })
      .catch(() => {});
  }

  // Tab-switch / focus-loss detection — also auto re-requests fullscreen the moment the
  // tab regains focus, so the candidate is dropped straight back into the locked-down view.
  useEffect(() => {
    if (!started) return;
    function handleVisibilityChange() {
      if (document.hidden) {
        reportViolation("switching tabs during a test is not allowed");
      } else if (!finalizedRef.current && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [started]);

  // Fullscreen-exit detection — immediately attempts to force back into fullscreen. Browsers
  // that block programmatic re-entry without a fresh user gesture will silently no-op the
  // request; the warning banner's "Resume fullscreen" button is the fallback for that case.
  useEffect(() => {
    if (!started) return;
    function handleFullscreenChange() {
      if (!document.fullscreenElement && !finalizedRef.current) {
        reportViolation("exiting fullscreen during a test is not allowed");
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else if (document.fullscreenElement) {
        clearTimeout(tabWarningTimeoutRef.current);
        setTabWarning(null);
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [started]);

  const answer = current ? answers[current.id] : null;

  // MM:SS for tests under an hour, HH:MM:SS once an hour or more is left.
  const timeLabel = useMemo(() => {
    if (secondsLeft === null) return "--:--";
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
  }, [secondsLeft]);

  function setLanguage(language) {
    if (!current) return;
    // Switching language always loads that language's own default template — keeping the
    // previous language's code around makes no sense and reads as "the compiler is broken".
    const code = defaultStarter(language);
    setAnswers((prev) => ({ ...prev, [current.id]: { language, code } }));
    setRunResult(null);
    scheduleCodeAutoSave(current.id, language, code);
  }

  function setCode(code) {
    if (!current) return;
    const language = answer?.language || "javascript";
    setAnswers((prev) => ({ ...prev, [current.id]: { ...prev[current.id], code } }));
    scheduleCodeAutoSave(current.id, language, code);
  }

  function goToQuestion(delta) {
    setActiveIdx((idx) => Math.max(0, Math.min(questions.length - 1, idx + delta)));
  }

  function toggleOption(idx) {
    if (!current) return;
    const prevSelected = answer?.selected || [];
    const nextSelected = isMulti
      ? (prevSelected.includes(idx) ? prevSelected.filter((i) => i !== idx) : [...prevSelected, idx])
      : [idx];
    setAnswers((prev) => ({ ...prev, [current.id]: { ...prev[current.id], selected: nextSelected } }));
    scheduleAutoSave(current.id, nextSelected);
  }

  // Debounced background save for MCQ/TRUE_FALSE/MULTISELECT — coalesces rapid successive
  // clicks (e.g. ticking several MULTISELECT checkboxes) into one request instead of firing
  // on every click, while still feeling instantaneous to the candidate.
  function scheduleAutoSave(questionId, selected) {
    pendingAutoSaveRef.current = { questionId, selected };
    clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(flushAutoSave, 600);
  }

  async function flushAutoSave() {
    clearTimeout(autoSaveTimeoutRef.current);
    const pending = pendingAutoSaveRef.current;
    if (!pending || !attemptId) return;
    pendingAutoSaveRef.current = null;
    setSavingAnswer(true);
    try {
      await api.post("/submissions/submit", { attemptId, questionId: pending.questionId, selectedOptions: pending.selected });
      setSubmittedQuestions((prev) => ({ ...prev, [pending.questionId]: true }));
      flashSaved();
    } catch {
      // Best-effort — the selection stays in local state and gets retried on the next change,
      // or flushed again right before the final Submit Test.
    } finally {
      setSavingAnswer(false);
    }
  }

  // Debounced background save for coding drafts — longer debounce than MCQ since typing is
  // far more frequent than clicking an option; no judge invocation here, just a DB write.
  function scheduleCodeAutoSave(questionId, language, code) {
    pendingCodeAutoSaveRef.current = { questionId, language, code };
    clearTimeout(codeAutoSaveTimeoutRef.current);
    codeAutoSaveTimeoutRef.current = setTimeout(flushCodeAutoSave, 1000);
  }

  async function flushCodeAutoSave() {
    clearTimeout(codeAutoSaveTimeoutRef.current);
    const pending = pendingCodeAutoSaveRef.current;
    if (!pending || !attemptId) return;
    pendingCodeAutoSaveRef.current = null;
    setSavingAnswer(true);
    try {
      await api.post("/submissions/autosave", { attemptId, questionId: pending.questionId, language: pending.language, code: pending.code });
      setSubmittedQuestions((prev) => ({ ...prev, [pending.questionId]: true }));
      flashSaved();
    } catch {
      // Best-effort — same retry story as MCQ auto-save above.
    } finally {
      setSavingAnswer(false);
    }
  }

  function flashSaved() {
    setJustSaved(true);
    clearTimeout(justSavedTimeoutRef.current);
    justSavedTimeoutRef.current = setTimeout(() => setJustSaved(false), 1500);
  }

  function toggleMarkForReview() {
    if (!current || !attemptId) return;
    setMarkedForReview((prev) => {
      const next = { ...prev, [current.id]: !prev[current.id] };
      try {
        localStorage.setItem(`markedForReview:${attemptId}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  // While Run is pending, poll how busy the judge is so a slow response under heavy
  // concurrent load (many students coding at once) reads as "N ahead of you" rather than a
  // spinner that looks frozen. Purely informational — has no effect on execution itself.
  useEffect(() => {
    if (!running) {
      setQueueStatus(null);
      return;
    }
    const poll = () => api.get("/submissions/queue-status").then(({ data }) => setQueueStatus(data)).catch(() => {});
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [running]);

  async function handleRun() {
    if (!answer || isQuiz) return;
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await api.post("/submissions/run", { questionId: current.id, language: answer.language, code: answer.code });
      setRunResult(data);
    } catch (err) {
      setRunResult({ error: err.response?.data?.error || "Run failed" });
    } finally {
      setRunning(false);
    }
  }

  async function finalizeAndExit(auto = false, reason = null) {
    if (!attemptId || finalizedRef.current) return;
    if (!auto && !confirm("Are you sure you want to submit your test? After submission, you will not be able to modify your answers.")) return;
    // Flush any answer still waiting on an auto-save debounce so the very last change isn't
    // lost to a race between submitting and the pending save timer.
    if (pendingAutoSaveRef.current) await flushAutoSave();
    if (pendingCodeAutoSaveRef.current) await flushCodeAutoSave();
    finalizedRef.current = true;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    setFinalizing(true);
    try {
      const { data } = await api.post(`/submissions/finalize/${attemptId}`);
      notify(data.gamification);
    } catch {
      // Best-effort — don't trap the candidate on the exam screen even if this call fails.
    } finally {
      setFinalizing(false);
    }
    if (reason === "time") {
      setTimeExpired(true);
      return;
    }
    navigate("/dashboard");
  }

  async function resumeFullscreen() {
    try {
      await document.documentElement.requestFullscreen?.();
      setTabWarning(null);
    } catch {
      // ignore
    }
  }

  if (metaError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div className="card" style={{ padding: 32, maxWidth: 440, textAlign: "center" }}>
          <p style={{ fontSize: 16 }}>{metaError}</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div className="card" style={{ padding: 32, maxWidth: 440, textAlign: "center" }}>
          <p style={{ fontSize: 16 }}>{loadError}</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (timeExpired) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div className="card" style={{ padding: 32, maxWidth: 440, textAlign: "center" }}>
          <p style={{ fontSize: 16, color: "var(--rust)" }}>Time is up. Your test has been submitted automatically.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (autoSubmitted) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div className="card" style={{ padding: 32, maxWidth: 440, textAlign: "center" }}>
          <p style={{ fontSize: 16, color: "var(--rust)" }}>
            Your test was automatically submitted after repeated integrity violations (leaving the test window,
            exiting fullscreen, your camera/microphone being turned off, or no face being detected in frame).
          </p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (finalizing) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div className="card" style={{ padding: 32, maxWidth: 440, textAlign: "center" }}>
          <p className="mono" style={{ fontSize: 15 }}>⏳ Grading your test — this can take a few seconds for coding questions. Please don't close this tab.</p>
        </div>
      </div>
    );
  }

  if (!started) {
    if (!testMeta) return <div style={{ padding: 48 }} className="mono">Loading test…</div>;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div className="card" style={{ padding: 32, maxWidth: 480, textAlign: "center" }}>
          <h2>{testMeta.title}</h2>
          {testMeta.description && <p style={{ color: "var(--ink-dim)", marginTop: 8 }}>{testMeta.description}</p>}
          <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 16 }}>
            {testMeta.questions?.length || 0} questions · {testMeta.durationMin} minutes
          </p>
          <p style={{ fontSize: 13, marginTop: 20 }}>
            This test runs in fullscreen with your camera and microphone on for the full duration, and your face
            must stay visible in frame. Switching tabs, exiting fullscreen, disabling your camera/mic, or moving out
            of camera view is tracked and will auto-submit your test after {MAX_TAB_VIOLATIONS} violations. You get
            one continuous {testMeta.durationMin}-minute timer for the whole test — answer any question in any
            order, and change your answers freely until you submit or time runs out.
          </p>

          <div style={{ marginTop: 20, padding: 16, border: "1px solid var(--line)", borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Camera &amp; microphone check</div>
            {mediaGranted ? (
              <>
                <video
                  ref={preflightVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: 160, height: 120, borderRadius: 8, marginTop: 10, background: "#000", objectFit: "cover" }}
                />
                <p style={{ fontSize: 12, color: "var(--mint)", marginTop: 8, fontWeight: 600 }}>✓ Camera and microphone are ready</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 6 }}>
                  Both are required before you can begin — they stay on for the whole test.
                </p>
                <button className="btn btn-dark" style={{ marginTop: 10 }} onClick={requestMedia} disabled={requestingMedia}>
                  {requestingMedia ? "Requesting access…" : "Grant camera & microphone access"}
                </button>
                {mediaError && <p style={{ fontSize: 12, color: "var(--rust)", marginTop: 8 }}>{mediaError}</p>}
              </>
            )}
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: 20, padding: "12px 24px", opacity: mediaGranted ? 1 : 0.4 }}
            onClick={beginTest}
            disabled={starting || !mediaGranted}
          >
            {starting ? "Starting…" : "Begin Test (Fullscreen)"}
          </button>
        </div>
      </div>
    );
  }

  if (!test) return <div style={{ padding: 48 }} className="mono">Loading test…</div>;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: "var(--slate-900)", color: "var(--chalk)", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>{test.title}</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setShowQuestionPanel((v) => !v)}>
            {showQuestionPanel ? "Hide questions" : "Show questions"}
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setShowResultsPanel((v) => !v)}>
            {showResultsPanel ? "Hide results" : "Show results"}
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={toggleMaximizeEditor}>
            {!showQuestionPanel && !showResultsPanel ? "⛶ Restore layout" : "⛶ Maximize editor"}
          </button>
          <div className="mono" style={{ fontSize: 20, color: secondsLeft < 300 ? "var(--rust)" : "var(--amber)" }}>
            {timeLabel} <span style={{ opacity: 0.6 }}>▊</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => finalizeAndExit(false)}>Submit Test</button>
      </div>

      <video
        ref={liveVideoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: "fixed", bottom: 16, right: 16, width: 140, height: 105, borderRadius: 8,
          objectFit: "cover", background: "#000", zIndex: 50,
          border: faceMissing ? "3px solid var(--rust)" : "2px solid var(--amber)",
        }}
      />

      {noiseWarning && (
        <div
          style={{
            background: "var(--amber)", color: "#3a2c00", padding: "10px 24px", fontSize: 13, fontWeight: 600,
            textAlign: "center",
          }}
          className="mono"
        >
          🔊 Please maintain a quiet environment during the examination.
        </div>
      )}

      {faceMissing && (
        <div
          style={{
            background: "var(--rust)", color: "#fff", padding: "14px 24px", fontSize: 14, fontWeight: 700,
            textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}
          className="mono"
        >
          ⚠ No face detected — please stay visible in the camera frame. This warning stays up until your face is
          detected again.
        </div>
      )}

      {tabWarning && (
        <div
          style={{
            background: "var(--rust)", color: "#fff", padding: "14px 24px", fontSize: 14, fontWeight: 700,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}
          className="mono"
        >
          <span>⚠ {tabWarning}</span>
          {!document.fullscreenElement && (
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px", background: "#fff" }} onClick={resumeFullscreen}>
              Resume fullscreen
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Question navigator */}
        <div style={{ width: 220, borderRight: "1px solid var(--line)", padding: 16, overflowY: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)", marginBottom: 10 }}>QUESTIONS</div>
          {questions.map((tq, idx) => {
            const q = tq.question;
            const a = answers[q.id];
            const answered = q.questionType === "CODING" ? !!submittedQuestions[q.id] : (a?.selected || []).length > 0;
            const marked = !!markedForReview[q.id];
            let statusLabel = "Unanswered";
            let statusColor = "var(--ink-dim)";
            if (marked) {
              statusLabel = answered ? "⚑ Marked (answered)" : "⚑ Marked for review";
              statusColor = "#8b5cf6";
            } else if (answered) {
              statusLabel = "✓ Answered";
              statusColor = "var(--mint)";
            }
            return (
              <button
                key={tq.id}
                onClick={() => setActiveIdx(idx)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  marginBottom: 6,
                  borderRadius: 8,
                  border: idx === activeIdx ? "1px solid var(--amber)" : "1px solid var(--line)",
                  background: idx === activeIdx ? "#FCEFD9" : "#fff",
                  fontSize: 13,
                }}
              >
                Q{idx + 1}. {tq.question.title || "(untitled)"}
                <span style={{ display: "block", fontSize: 11, marginTop: 2, color: statusColor }} className="mono">
                  {statusLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Question description */}
        {showQuestionPanel && (
        <>
        <div style={{ width: questionPanelWidth, padding: 24, overflowY: "auto", flexShrink: 0 }}>
          {current && (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <h2 style={{ fontSize: 20 }}>{current.title || "(untitled)"}</h2>
                <span className={`badge badge-${current.difficulty.toLowerCase()}`}>{current.difficulty}</span>
              </div>
              <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{current.points} points</p>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14, marginTop: 16 }}>{current.description}</p>

              {!isQuiz && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>SAMPLE TEST CASES</div>
                  {current.testCases.map((tc, i) => (
                    <div key={tc.id} className="card" style={{ padding: 12, marginTop: 8, fontSize: 13 }}>
                      <div className="mono"><strong>Input:</strong> {tc.input}</div>
                      <div className="mono"><strong>Expected:</strong> {tc.expected}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div
          onMouseDown={startResize("question")}
          style={{ width: 6, cursor: "col-resize", background: "var(--line)", flexShrink: 0 }}
          title="Drag to resize"
        />
        </>
        )}

        {/* Answer panel: code editor for Coding, options for quiz types */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {isQuiz ? (
            <>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => goToQuestion(-1)} disabled={activeIdx === 0}>
                    ◀ Previous
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => goToQuestion(1)} disabled={activeIdx === questions.length - 1}>
                    Next ▶
                  </button>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                    {isMulti ? "Select all that apply" : "Select one answer"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 12, color: savingAnswer ? "var(--amber-dark)" : "var(--mint)", minWidth: 90, textAlign: "right" }}>
                    {savingAnswer ? "Saving…" : justSaved ? "✓ Saved" : ""}
                  </span>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: "5px 10px", color: markedForReview[current.id] ? "#8b5cf6" : undefined }}
                    onClick={toggleMarkForReview}
                  >
                    {markedForReview[current.id] ? "⚑ Marked" : "⚑ Mark for review"}
                  </button>
                </div>
              </div>
              <p className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", padding: "6px 16px 0" }}>
                Your selection is saved automatically — change it any time before you submit the whole test.
              </p>
              <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
                {(current.options || []).map((opt, idx) => (
                  <label
                    key={idx}
                    className="card"
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, marginBottom: 10, cursor: "pointer" }}
                  >
                    <input
                      type={isMulti ? "checkbox" : "radio"}
                      name="quiz-option"
                      checked={(answer?.selected || []).includes(idx)}
                      onChange={() => toggleOption(idx)}
                    />
                    <span style={{ fontSize: 14 }}>{opt}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => goToQuestion(-1)} disabled={activeIdx === 0}>
                    ◀ Previous
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => goToQuestion(1)} disabled={activeIdx === questions.length - 1}>
                    Next ▶
                  </button>
                  <select value={answer?.language || "javascript"} onChange={(e) => setLanguage(e.target.value)} className="mono" style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)" }}>
                    {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 12, color: savingAnswer ? "var(--amber-dark)" : "var(--mint)", minWidth: 90, textAlign: "right" }}>
                    {savingAnswer ? "Saving…" : justSaved ? "✓ Saved" : ""}
                  </span>
                  <button
                    className="btn btn-ghost"
                    style={{ color: markedForReview[current.id] ? "#8b5cf6" : undefined }}
                    onClick={toggleMarkForReview}
                  >
                    {markedForReview[current.id] ? "⚑ Marked" : "⚑ Mark for review"}
                  </button>
                  <button className="btn btn-ghost" onClick={handleRun} disabled={running}>{running ? "Running…" : "▶ Run sample"}</button>
                </div>
              </div>
              <p className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", padding: "6px 16px 0" }}>
                Your code is saved automatically — edit it freely until you submit the whole test. "Run sample"
                checks against sample cases only; the final saved version is graded when the test is submitted.
              </p>

              <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                  height="100%"
                  language={LANGUAGES.find((l) => l.id === answer?.language)?.monaco}
                  value={answer?.code || ""}
                  onChange={(v) => setCode(v || "")}
                  theme="vs-dark"
                  options={{ fontSize: 14, minimap: { enabled: false }, fontFamily: "JetBrains Mono, monospace" }}
                />
              </div>
            </>
          )}

          {showResultsPanel && (
          <>
          <div onMouseDown={startResize("results")} style={{ height: 6, cursor: "row-resize", background: "var(--line)", flexShrink: 0 }} title="Drag to resize" />
          <div style={{ height: resultsPanelHeight, overflowY: "auto", padding: 16, background: "#FBF9F4", flexShrink: 0 }}>
            {running && (
              <p className="mono" style={{ fontSize: 12, color: "var(--amber-dark)", fontWeight: 600 }}>
                ⏳ Compiling and running your {answer?.language || ""} code
                {["c", "cpp", "java"].includes(answer?.language) ? " — compiled languages take a bit longer" : ""}…
                {queueStatus?.waiting > 0 && ` (${queueStatus.waiting} student${queueStatus.waiting > 1 ? "s" : ""} ahead of you)`}
              </p>
            )}
            {!running && runResult && (
              <ResultBlock title="Sample run result" result={runResult} />
            )}
            {!isQuiz && !running && !runResult && (
              <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                Run against sample cases any time. Your saved code is judged against all (including hidden) test
                cases once when you submit the whole test — results are published after the test.
              </p>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultBlock({ title, result }) {
  if (result.error) {
    return <p style={{ color: "var(--rust)" }} className="mono">{title}: {result.error}</p>;
  }
  if (result.errorSummary) {
    return (
      <div>
        <div className="mono" style={{ fontWeight: 700, color: "var(--rust)" }}>
          {title}: {result.errorSummary.type}{result.errorSummary.line ? ` (line ${result.errorSummary.line})` : ""}
        </div>
        {result.errorSummary.message && (
          <div className="mono" style={{ fontSize: 12, marginTop: 6, whiteSpace: "pre-wrap" }}>{result.errorSummary.message}</div>
        )}
      </div>
    );
  }
  const color = result.verdict === "ACCEPTED" ? "var(--mint)" : result.verdict === "PARTIAL" ? "var(--amber-dark)" : "var(--rust)";
  return (
    <div>
      <div className="mono" style={{ fontWeight: 700, color }}>
        {title}: {result.verdict === "ACCEPTED" ? "Correct" : result.verdict === "PARTIAL" ? "Partially correct" : "Incorrect"}
        {` — ${result.passedCases}/${result.totalCases} test cases passed`}
      </div>
      {result.details?.map((d, i) => (
        <div key={i} style={{ fontSize: 12, marginTop: 6 }} className="mono">
          <span style={{ color: d.verdict === "PASSED" ? "var(--mint)" : "var(--rust)" }}>[{d.verdict}]</span>{" "}
          input: {d.input} | expected: {d.expected} | got: {d.actual ?? d.error}
        </div>
      ))}
    </div>
  );
}

function defaultStarter(language) {
  switch (language) {
    case "python":
      return "# Read input via input(), print your answer\n";
    case "c":
      return '#include <stdio.h>\n\nint main() {\n    // read input with scanf, print your answer with printf\n    return 0;\n}\n';
    case "cpp":
      return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // read input with cin, print your answer with cout\n    return 0;\n}\n';
    case "java":
      return 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // read input via sc, print your answer with System.out\n    }\n}\n';
    default:
      return "// Read input via require('fs').readFileSync(0, 'utf8'), console.log your answer\n";
  }
}
