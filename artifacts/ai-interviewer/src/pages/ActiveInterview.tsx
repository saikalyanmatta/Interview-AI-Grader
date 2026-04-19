import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { blobToBase64, playBase64Audio } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Volume2, Loader2, ArrowRight, CheckCircle, Camera, CameraOff, ShieldAlert, Code, Maximize } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Phase = "init" | "loading_question" | "fetching_audio" | "speaking" | "countdown" | "recording" | "processing" | "answered" | "completing" | "coding";
type InterviewQuestion = { id: number; questionText: string; category: string; skill: string | null; questionIndex: number };
type AnswerResult = { transcript: string; stutterScore: number; stutterNotes: string; confidenceScore: number | null };
type CodingQuestion = { title: string; description: string; examples: string };

async function fetchNextQuestion(ivId: number) {
  const r = await fetch(`${BASE}/api/interviews/${ivId}/next-question`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
  if (!r.ok) throw new Error("Failed to fetch question");
  return r.json();
}
async function fetchQuestionAudio(ivId: number, qId: number) {
  const r = await fetch(`${BASE}/api/interviews/${ivId}/questions/${qId}/audio`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch audio");
  return r.json();
}
async function submitAnswer(ivId: number, qId: number, audioB64: string, frames: string[]): Promise<AnswerResult> {
  const r = await fetch(`${BASE}/api/interviews/${ivId}/answers`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId: qId, audio: audioB64, facialFrames: frames }),
  });
  if (!r.ok) throw new Error("Failed to submit answer");
  return r.json();
}
async function fetchCodingQuestions(ivId: number): Promise<{ questions: CodingQuestion[]; language: string }> {
  const r = await fetch(`${BASE}/api/interviews/${ivId}/coding-questions`, { credentials: "include" });
  if (!r.ok) return { questions: [], language: "Python" };
  return r.json();
}
async function submitCodingAnswers(ivId: number, answers: { questionText: string; code: string }[]) {
  const r = await fetch(`${BASE}/api/interviews/${ivId}/coding-submit`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!r.ok) throw new Error("Failed to submit coding");
  return r.json();
}
async function completeInterview(ivId: number) {
  const r = await fetch(`${BASE}/api/interviews/${ivId}/complete`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
  if (!r.ok) throw new Error("Failed to complete interview");
  return r.json();
}
function captureVideoFrame(video: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 320, 240);
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1] || null;
  } catch { return null; }
}

export default function ActiveInterview() {
  const [, params] = useRoute("/interview/:id");
  const [, setLocation] = useLocation();
  const id = parseInt(params?.id || "0");

  const [phase, setPhase] = useState<Phase>("init");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [transcript, setTranscript] = useState("");
  const [stutterInfo, setStutterInfo] = useState<{ score: number; notes: string } | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [malpracticeAlerts, setMalpracticeAlerts] = useState<string[]>([]);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [codingQuestions, setCodingQuestions] = useState<CodingQuestion[]>([]);
  const [codingLanguage, setCodingLanguage] = useState("Python");
  const [codingAnswers, setCodingAnswers] = useState<string[]>([]);
  const [isSubmittingCoding, setIsSubmittingCoding] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const facialFramesRef = useRef<string[]>([]);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionLoadedRef = useRef(false);

  const requestFullscreen = useCallback(async () => {
    try {
      const el = containerRef.current || document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
      setIsFullscreen(true); setFullscreenWarning(false);
    } catch { setFullscreenWarning(true); }
  }, []);

  useEffect(() => {
    const onFSChange = () => {
      const isFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFS);
      if (!isFS && phase !== "completing" && phase !== "coding") {
        setFullscreenWarning(true);
        setMalpracticeAlerts(prev => [...prev, "Exited fullscreen"]);
      }
    };
    document.addEventListener("fullscreenchange", onFSChange);
    document.addEventListener("webkitfullscreenchange", onFSChange);
    return () => { document.removeEventListener("fullscreenchange", onFSChange); document.removeEventListener("webkitfullscreenchange", onFSChange); };
  }, [phase]);

  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden && phase !== "completing" && phase !== "coding") {
        setTabSwitchCount(prev => {
          const next = prev + 1;
          setMalpracticeAlerts(a => [...a, `Tab switch #${next}`]);
          toast.warning(`Tab switch detected (#${next}) — this is recorded.`);
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && ["t", "w", "n"].includes(e.key)) e.preventDefault(); };
    const onCtx = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("keydown", onKey);
    document.addEventListener("contextmenu", onCtx);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("contextmenu", onCtx); };
  }, []);

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
      mediaStreamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setCameraOn(true);
    } catch {
      setCameraError(true);
      try { mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { toast.error("Microphone access required"); }
    }
  }, []);

  useEffect(() => {
    requestFullscreen();
    initCamera();
    return () => {
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (phase === "init" && (cameraOn || cameraError) && !questionLoadedRef.current) {
      questionLoadedRef.current = true;
      loadNextQuestion();
    }
  }, [phase, cameraOn, cameraError]);

  const loadNextQuestion = async () => {
    if (phase !== "init" && phase !== "answered") return;
    setPhase("loading_question");
    try {
      const result = await fetchNextQuestion(id);
      if (result.isComplete || !result.question) {
        const codingData = await fetchCodingQuestions(id);
        if (codingData.questions.length > 0) {
          setCodingQuestions(codingData.questions);
          setCodingLanguage(codingData.language);
          setCodingAnswers(codingData.questions.map(() => ""));
          setPhase("coding");
        } else {
          setPhase("completing");
          await completeInterview(id);
          setLocation(`/interview/${id}/report`);
        }
        return;
      }
      const q = result.question;
      setQuestions(prev => [...prev, q]);
      setCurrentQuestion(q);
      setTranscript(""); setStutterInfo(null);
      setPhase("fetching_audio");
      const audioData = await fetchQuestionAudio(id, q.id);
      setPhase("speaking");
      playAudio(audioData.audio, audioData.format);
    } catch (err: any) {
      toast.error(err.message); setPhase("init");
    }
  };

  const playAudio = (base64: string, format: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    try {
      const audio = playBase64Audio(base64, format);
      audioRef.current = audio;
      audio.onended = () => startCountdown();
      audio.onerror = () => startCountdown();
    } catch { startCountdown(); }
  };

  const startCountdown = () => {
    setPhase("countdown"); setCountdown(3);
    if (countdownRef.current) clearInterval(countdownRef.current);
    let c = 3;
    countdownRef.current = setInterval(() => {
      c--; setCountdown(c);
      if (c <= 0) { if (countdownRef.current) clearInterval(countdownRef.current); startRecording(); }
    }, 1000);
  };

  const startRecording = async () => {
    const stream = mediaStreamRef.current;
    if (!stream) { toast.error("No microphone available"); return; }
    const audioStream = new MediaStream(stream.getAudioTracks());
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"].find(m => MediaRecorder.isTypeSupported(m)) ?? "";
    const recorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);
    audioChunksRef.current = []; facialFramesRef.current = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setPhase("recording");
    if (cameraOn && videoRef.current) {
      frameIntervalRef.current = setInterval(() => {
        if (videoRef.current && facialFramesRef.current.length < 5) {
          const frame = captureVideoFrame(videoRef.current);
          if (frame) facialFramesRef.current.push(frame);
        }
      }, 3000);
    }
  };

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise(resolve => {
      if (frameIntervalRef.current) { clearInterval(frameIntervalRef.current); frameIntervalRef.current = null; }
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording") { resolve(new Blob()); return; }
      recorder.onstop = () => resolve(new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });
  }, []);

  const handleStopRecording = async () => {
    if (!currentQuestion) return;
    setPhase("processing");
    try {
      const blob = await stopRecording();
      if (blob.size === 0) throw new Error("No audio recorded — please try again.");
      const audioB64 = await blobToBase64(blob);
      const result = await submitAnswer(id, currentQuestion.id, audioB64, [...facialFramesRef.current]);
      setTranscript(result.transcript);
      setStutterInfo({ score: result.stutterScore, notes: result.stutterNotes });
      setAnswers(prev => [...prev, result]);
      setPhase("answered");
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
      setPhase("answered");
    }
  };

  const handleReplay = () => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } };
  const handleNext = () => { if (phase !== "answered") return; setPhase("init"); loadNextQuestion(); };

  const handleSubmitCoding = async () => {
    setIsSubmittingCoding(true);
    try {
      await submitCodingAnswers(id, codingQuestions.map((q, i) => ({ questionText: q.title, code: codingAnswers[i] || "" })));
      setPhase("completing");
      await completeInterview(id);
      setLocation(`/interview/${id}/report`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
      setIsSubmittingCoding(false);
    }
  };

  const isLoadingNext = phase === "loading_question" || phase === "fetching_audio" || phase === "completing";
  const isSpeaking = phase === "speaking";
  const isCountdown = phase === "countdown";
  const isRecording = phase === "recording";
  const isProcessing = phase === "processing";

  if (phase === "coding") {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Code className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">Coding Questions</h2>
              <p className="text-xs text-muted-foreground">Language: {codingLanguage}</p>
            </div>
          </div>
          {tabSwitchCount > 0 && (
            <div className="flex items-center gap-2 text-amber-500 text-sm bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
              <ShieldAlert className="h-4 w-4" />{tabSwitchCount} tab switch(es) recorded
            </div>
          )}
        </div>
        <div className="grid gap-6 mb-8">
          {codingQuestions.map((q, i) => (
            <div key={i} className="glass-panel rounded-2xl p-6 grid gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Q{i + 1}</span>
                <h3 className="font-display font-semibold">{q.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{q.description}</p>
              {q.examples && <div className="bg-black/60 rounded-xl p-4 font-mono text-xs text-emerald-400 whitespace-pre-wrap overflow-x-auto">{q.examples}</div>}
              <div>
                <label className="text-sm font-medium mb-2 block">Your Solution ({codingLanguage}):</label>
                <textarea
                  value={codingAnswers[i] || ""}
                  onChange={e => setCodingAnswers(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                  placeholder={`Write your ${codingLanguage} solution here...`}
                  rows={12}
                  className="w-full rounded-xl bg-black/40 border border-border px-4 py-3 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          ))}
        </div>
        <button onClick={handleSubmitCoding} disabled={isSubmittingCoding}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold btn-gradient text-base disabled:opacity-60"
        >
          {isSubmittingCoding ? <><Loader2 className="h-5 w-5 animate-spin" />Submitting...</> : <>Submit & Complete Interview <ArrowRight className="h-5 w-5" /></>}
        </button>
      </div>
    );
  }

  if (phase === "completing") {
    return (
      <div className="flex flex-col h-[70vh] items-center justify-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <h2 className="text-xl font-display font-semibold">Finalizing your interview...</h2>
        <p className="text-muted-foreground text-sm">Generating AI analysis, this may take a moment.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="container mx-auto px-4 py-6 max-w-5xl flex flex-col gap-5 min-h-[calc(100vh-8rem)]">
      {fullscreenWarning && !isFullscreen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400"
        >
          <div className="flex items-center gap-2 text-sm">
            <Maximize className="h-4 w-4" /><span>Fullscreen mode is required during the interview.</span>
          </div>
          <button onClick={requestFullscreen} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors">
            Enter Fullscreen
          </button>
        </motion.div>
      )}

      {tabSwitchCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-sm">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>{tabSwitchCount} tab switch(es) detected — {malpracticeAlerts[malpracticeAlerts.length - 1]}</span>
        </div>
      )}

      <div>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Question {questions.length}{isLoadingNext ? " — generating..." : ""}</span>
          <span className="capitalize">{currentQuestion?.category ?? "—"}{currentQuestion?.skill ? ` • ${currentQuestion.skill}` : ""}</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(questions.length * 8, 95)}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">Adaptive — length adjusts to your performance</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-5">
        <div className="w-full lg:w-72 flex flex-col gap-4">
          <div className="glass-panel rounded-2xl p-6 flex flex-col items-center relative overflow-hidden">
            <div className={`absolute inset-0 bg-primary/10 blur-3xl transition-opacity duration-700 ${isSpeaking ? "opacity-100" : "opacity-0"}`} />
            <div className="relative z-10 w-28 h-28 mb-4">
              <img src={`${import.meta.env.BASE_URL}images/ai-avatar.png`} alt="AI"
                className={`w-full h-full object-cover rounded-full transition-all duration-500 ${isSpeaking ? "scale-105 shadow-[0_0_40px_rgba(124,58,237,0.5)]" : ""}`}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              {isSpeaking && <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30" />}
            </div>
            <div className="relative z-10 flex flex-col items-center gap-2 w-full">
              {isLoadingNext && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />{phase === "loading_question" ? "Generating..." : phase === "fetching_audio" ? "Loading audio..." : "Finalizing..."}</div>}
              {isSpeaking && <p className="text-sm text-primary font-medium">AI is speaking...</p>}
              {isCountdown && <div className="text-center"><div className="font-display font-bold text-4xl text-primary">{countdown}</div><p className="text-xs text-muted-foreground">Recording starts...</p></div>}
              {!isLoadingNext && !isCountdown && (
                <button onClick={handleReplay} disabled={isSpeaking || isRecording || isLoadingNext}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border bg-secondary/50 hover:bg-secondary transition-colors disabled:opacity-40"
                >
                  <Volume2 className="h-3.5 w-3.5" />Replay
                </button>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden" style={{ height: 180 }}>
            {cameraOn ? (
              <div className="relative w-full h-full">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] text-white/80">Live</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                {cameraError ? <CameraOff className="h-8 w-8 text-muted-foreground/30" /> : <Camera className="h-8 w-8 text-muted-foreground/30 animate-pulse" />}
                <span className="text-xs text-muted-foreground">{cameraError ? "Camera unavailable" : "Initializing..."}</span>
              </div>
            )}
          </div>

          <button
            onClick={isRecording ? handleStopRecording : phase === "answered" ? handleNext : undefined}
            disabled={isProcessing || isSpeaking || isCountdown || isLoadingNext}
            className={`w-full h-14 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
              ${isRecording ? "bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-xl shadow-red-500/25" : "btn-gradient shadow-xl"}`}
          >
            {isProcessing ? <><Loader2 className="h-5 w-5 animate-spin" />Processing...</>
              : isRecording ? <><Square className="h-5 w-5 fill-current" />Stop Recording</>
              : phase === "answered" ? <><ArrowRight className="h-5 w-5" />Next Question</>
              : <><Mic className="h-5 w-5" />Record Answer</>}
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <AnimatePresence mode="wait">
            <motion.div key={currentQuestion?.id ?? "loading"} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="glass-panel rounded-2xl p-8 flex flex-col flex-1"
            >
              {currentQuestion ? (
                <>
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary border border-border text-muted-foreground capitalize">{currentQuestion.category}</span>
                    {currentQuestion.skill && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 border border-primary/20 text-primary">{currentQuestion.skill}</span>}
                  </div>
                  <h2 className="text-xl font-display font-semibold leading-relaxed mb-auto">{currentQuestion.questionText}</h2>
                  <div className="mt-6 pt-6 border-t border-border min-h-32">
                    {isRecording && (
                      <div className="flex items-center gap-3 text-emerald-500 font-medium">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                        </span>
                        Listening... speak naturally, take your time.
                      </div>
                    )}
                    {isCountdown && <p className="text-muted-foreground text-sm">Get ready — recording starts in {countdown}s...</p>}
                    {isProcessing && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Transcribing and analyzing...</div>}
                    {phase === "answered" && transcript && (
                      <div className="grid gap-3">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-primary" />Your answer:</p>
                        <p className="text-sm leading-relaxed italic text-foreground/90">"{transcript}"</p>
                        {stutterInfo && (
                          <div className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2.5 border ${stutterInfo.score > 50 ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"}`}>
                            <span className="font-bold flex-shrink-0">{stutterInfo.score > 50 ? "⚠" : "✓"}</span>
                            <span>{stutterInfo.notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {!isRecording && !isCountdown && !isProcessing && phase !== "answered" && (
                      <p className="text-muted-foreground/40 italic text-sm">Your transcript will appear here after recording.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {answers.length > 0 && (
            <div className="glass-panel rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-3">Progress — {answers.length} answer(s) submitted</p>
              <div className="flex gap-1.5 flex-wrap">
                {questions.slice(0, answers.length).map((q, i) => {
                  const fluent = (answers[i]?.stutterScore ?? 0) < 50;
                  return <div key={q.id} className={`h-2 w-8 rounded-full ${fluent ? "bg-emerald-500" : "bg-amber-500"}`} title={`Q${i + 1}: ${q.skill ?? q.category}`} />;
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Green = fluent · Amber = disfluency noted</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
