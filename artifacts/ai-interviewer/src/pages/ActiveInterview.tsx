import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useCompleteInterview } from "@workspace/api-client-react";
import { blobToBase64, playBase64Audio, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Volume2, Loader2, ArrowRight, CheckCircle, Camera, CameraOff, ShieldAlert, Code, Maximize, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type InterviewQuestion = { id: number; questionText: string; category: string; skill: string | null; questionIndex: number };
type Phase = "init" | "loading_question" | "fetching_audio" | "speaking" | "countdown" | "recording" | "processing" | "answered" | "completing" | "coding" | "coding_submit";

interface AnswerResult { transcript: string; stutterScore: number; stutterNotes: string; confidenceScore: number | null }
interface CodingQuestion { title: string; description: string; examples: string }

async function fetchNextQuestion(interviewId: number): Promise<{ isComplete: boolean; question: InterviewQuestion | null }> {
  const resp = await fetch(`${BASE}/api/interviews/${interviewId}/next-question`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
  });
  if (!resp.ok) throw new Error("Failed to fetch next question");
  return resp.json();
}

async function fetchQuestionAudio(interviewId: number, questionId: number): Promise<{ audio: string; format: string }> {
  const resp = await fetch(`${BASE}/api/interviews/${interviewId}/questions/${questionId}/audio`, { credentials: "include" });
  if (!resp.ok) throw new Error("Failed to fetch audio");
  return resp.json();
}

async function submitAnswer(interviewId: number, questionId: number, audioB64: string, facialFrames: string[]): Promise<AnswerResult> {
  const resp = await fetch(`${BASE}/api/interviews/${interviewId}/answers`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, audio: audioB64, facialFrames }),
  });
  if (!resp.ok) throw new Error("Failed to submit answer");
  return resp.json();
}

async function fetchCodingQuestions(interviewId: number): Promise<{ questions: CodingQuestion[]; language: string }> {
  const resp = await fetch(`${BASE}/api/interviews/${interviewId}/coding-questions`, { credentials: "include" });
  if (!resp.ok) return { questions: [], language: "Python" };
  return resp.json();
}

async function submitCodingAnswers(interviewId: number, answers: { questionText: string; code: string }[]) {
  const resp = await fetch(`${BASE}/api/interviews/${interviewId}/coding-submit`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!resp.ok) throw new Error("Failed to submit coding answers");
  return resp.json();
}

function captureVideoFrame(videoEl: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoEl, 0, 0, 320, 240);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    return dataUrl.split(",")[1] || null;
  } catch { return null; }
}

export default function ActiveInterview() {
  const [, params] = useRoute("/interview/:id");
  const [, setLocation] = useLocation();
  const id = parseInt(params?.id || "0");
  const { toast } = useToast();
  const completeMutation = useCompleteInterview();

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

  // Coding questions state
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

  // Fullscreen enforcement
  const requestFullscreen = useCallback(async () => {
    try {
      const el = containerRef.current || document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
      setIsFullscreen(true);
      setFullscreenWarning(false);
    } catch {
      setFullscreenWarning(true);
    }
  }, []);

  useEffect(() => {
    const onFSChange = () => {
      const isFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFS);
      if (!isFS && phase !== "completing" && phase !== "coding_submit") {
        setFullscreenWarning(true);
        setMalpracticeAlerts(prev => [...prev, "Exited fullscreen"]);
      }
    };
    document.addEventListener("fullscreenchange", onFSChange);
    document.addEventListener("webkitfullscreenchange", onFSChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFSChange);
      document.removeEventListener("webkitfullscreenchange", onFSChange);
    };
  }, [phase]);

  // Tab switch detection
  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden && phase !== "completing" && phase !== "coding_submit") {
        setTabSwitchCount(prev => {
          const next = prev + 1;
          setMalpracticeAlerts(a => [...a, `Tab switch detected (#${next})`]);
          toast({ title: `⚠️ Tab switch detected (#${next})`, description: "Switching tabs is not allowed during the interview.", variant: "destructive" });
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, [phase]);

  // Prevent right-click and keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "t" || e.key === "w" || e.key === "n")) e.preventDefault();
    };
    const onCtxMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("keydown", onKey);
    document.addEventListener("contextmenu", onCtxMenu);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("contextmenu", onCtxMenu);
    };
  }, []);

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch {
      setCameraError(true);
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = audioOnly;
      } catch {
        toast({ title: "Microphone required", description: "Please allow microphone access.", variant: "destructive" });
      }
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

  const questionLoadedRef = useRef(false);

  useEffect(() => {
    if (phase === "init" && mediaStreamRef.current && !questionLoadedRef.current) {
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
        // Check for coding questions
        const codingData = await fetchCodingQuestions(id);
        if (codingData.questions.length > 0) {
          setCodingQuestions(codingData.questions);
          setCodingLanguage(codingData.language);
          setCodingAnswers(codingData.questions.map(() => ""));
          setPhase("coding");
        } else {
          setPhase("completing");
          await completeMutation.mutateAsync({ id });
          setLocation(`/interview/${id}/report`);
        }
        return;
      }
      const q = result.question;
      setQuestions(prev => [...prev, q]);
      setCurrentQuestion(q);
      setTranscript("");
      setStutterInfo(null);
      setPhase("fetching_audio");
      const audioData = await fetchQuestionAudio(id, q.id);
      setPhase("speaking");
      playAudio(audioData.audio, audioData.format);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setPhase("init");
    }
  };

  const playAudio = (base64: string, format: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    try {
      const audio = playBase64Audio(base64, format);
      audioRef.current = audio;
      audio.onended = () => startCountdown();
      audio.onerror = () => { setPhase("countdown"); startCountdown(); };
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
    if (!stream) { toast({ title: "No microphone", variant: "destructive" }); return; }
    const audioStream = new MediaStream(stream.getAudioTracks());
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"].find(m => MediaRecorder.isTypeSupported(m)) ?? "";
    const recorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);
    audioChunksRef.current = []; facialFramesRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
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
      const frames = [...facialFramesRef.current];
      const result = await submitAnswer(id, currentQuestion.id, audioB64, frames);
      setTranscript(result.transcript);
      setStutterInfo({ score: result.stutterScore, notes: result.stutterNotes });
      setAnswers(prev => [...prev, result]);
      if (result.confidenceScore !== null && result.confidenceScore < 40) {
        setMalpracticeAlerts(prev => [...prev, `Low confidence detected on Q${questions.length}`]);
      }
      setPhase("answered");
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
      setPhase("answered");
    }
  };

  const handleReplay = () => {
    if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); }
  };

  const handleNext = () => {
    if (phase !== "answered") return;
    setPhase("init");
    loadNextQuestion();
  };

  const handleSubmitCoding = async () => {
    setIsSubmittingCoding(true);
    try {
      const answersPayload = codingQuestions.map((q, i) => ({ questionText: q.title, code: codingAnswers[i] || "" }));
      await submitCodingAnswers(id, answersPayload);
      setPhase("completing");
      await completeMutation.mutateAsync({ id });
      setLocation(`/interview/${id}/report`);
    } catch (err: any) {
      toast({ title: "Failed to submit", description: err.message, variant: "destructive" });
      setIsSubmittingCoding(false);
    }
  };

  const questionNumber = questions.length;
  const isRecording = phase === "recording";
  const isProcessing = phase === "processing";
  const isLoadingNext = phase === "loading_question" || phase === "fetching_audio" || phase === "completing";
  const isSpeaking = phase === "speaking";
  const isCountdown = phase === "countdown";

  // Coding phase UI
  if (phase === "coding" || phase === "coding_submit") {
    return (
      <div ref={containerRef} className="max-w-5xl mx-auto space-y-6 min-h-screen">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Code className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold">Coding Questions</h2>
              <p className="text-xs text-muted-foreground">Language: {codingLanguage}</p>
            </div>
          </div>
          {malpracticeAlerts.length > 0 && (
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>{tabSwitchCount} tab switch(es) recorded</span>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {codingQuestions.map((q, i) => (
            <div key={i} className="glass-panel rounded-2xl border border-white/10 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">Q{i + 1}</span>
                <h3 className="font-display font-semibold text-lg">{q.title}</h3>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{q.description}</p>
              {q.examples && (
                <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-green-400 whitespace-pre-wrap">{q.examples}</div>
              )}
              <div>
                <label className="text-sm font-medium mb-2 block">Your Solution ({codingLanguage}):</label>
                <Textarea
                  value={codingAnswers[i] || ""}
                  onChange={(e) => setCodingAnswers(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                  placeholder={`Write your ${codingLanguage} solution here...`}
                  className="min-h-[200px] bg-black/30 border-white/10 font-mono text-sm resize-y"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pb-8">
          <Button
            variant="gradient"
            size="lg"
            onClick={handleSubmitCoding}
            disabled={isSubmittingCoding}
          >
            {isSubmittingCoding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : "Submit & Complete Interview →"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-w-5xl mx-auto flex flex-col min-h-[calc(100vh-8rem)] gap-6">
      {/* Fullscreen warning */}
      {fullscreenWarning && !isFullscreen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400"
        >
          <div className="flex items-center gap-2 text-sm">
            <Maximize className="h-4 w-4 shrink-0" />
            <span>Full-screen mode is required during the interview.</span>
          </div>
          <Button size="sm" className="bg-red-500 text-white hover:bg-red-600 shrink-0" onClick={requestFullscreen}>
            Enter Fullscreen
          </Button>
        </motion.div>
      )}

      {/* Malpractice alerts */}
      {(malpracticeAlerts.length > 0 || tabSwitchCount > 0) && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            {tabSwitchCount > 0 ? `${tabSwitchCount} tab switch(es) detected — ` : ""}
            {malpracticeAlerts[malpracticeAlerts.length - 1]}
          </span>
        </div>
      )}

      <div>
        <div className="flex justify-between text-sm font-medium text-muted-foreground mb-3">
          <span>Question {questionNumber} {isLoadingNext && !isRecording ? "— generating next..." : ""}</span>
          <span className="capitalize">{currentQuestion?.category ?? "—"}{currentQuestion?.skill ? ` • ${currentQuestion.skill}` : ""}</span>
        </div>
        <Progress value={Math.min(questionNumber * 8, 95)} className="h-1.5" />
        <p className="text-xs text-muted-foreground mt-1">Adaptive — interview length adjusts to your skills</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[300px] flex flex-col gap-4">
          <div className="glass-panel rounded-3xl border border-white/5 p-6 flex flex-col items-center relative overflow-hidden">
            <div className={cn("absolute inset-0 bg-primary/10 blur-[50px] transition-opacity duration-1000", isSpeaking ? "opacity-100" : "opacity-0")} />
            <div className="relative z-10 w-32 h-32 mb-4">
              <img
                src={`${import.meta.env.BASE_URL}images/ai-avatar.png`}
                alt="AI Interviewer"
                className={cn("w-full h-full object-cover rounded-full transition-all duration-500", isSpeaking && "scale-105 shadow-[0_0_40px_rgba(124,58,237,0.5)]")}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              {isSpeaking && <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />}
            </div>
            <div className="relative z-10 flex flex-col items-center gap-2 w-full">
              {isLoadingNext && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {phase === "loading_question" ? "Generating question..." : phase === "fetching_audio" ? "Loading audio..." : "Finalizing..."}
                </div>
              )}
              {isSpeaking && <div className="text-sm text-primary font-medium">AI is speaking...</div>}
              {isCountdown && (
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-1">{countdown}</div>
                  <div className="text-xs text-muted-foreground">Recording starts...</div>
                </div>
              )}
              {!isLoadingNext && !isCountdown && (
                <Button variant="outline" size="sm" onClick={handleReplay} disabled={isSpeaking || isRecording || isLoadingNext} className="bg-black/40 border-white/10 text-xs">
                  <Volume2 className="h-3 w-3 mr-1" /> Replay Question
                </Button>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden relative" style={{ height: 180 }}>
            {cameraOn ? (
              <>
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] text-white/80">Live</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black/30">
                {cameraError ? <CameraOff className="h-8 w-8 text-white/20" /> : <Camera className="h-8 w-8 text-white/20" />}
                <span className="text-xs text-muted-foreground">{cameraError ? "Camera not available" : "Initializing camera..."}</span>
              </div>
            )}
          </div>

          <Button
            size="lg"
            variant={isRecording ? "destructive" : "gradient"}
            className={cn("w-full h-14 text-base shadow-xl transition-all duration-300", isRecording && "animate-pulse")}
            onClick={isRecording ? handleStopRecording : phase === "answered" ? handleNext : undefined}
            disabled={isProcessing || isSpeaking || isCountdown || isLoadingNext}
          >
            {isProcessing ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />Processing...</>)
              : isRecording ? (<><Square className="mr-2 h-5 w-5 fill-current" />Stop Recording</>)
              : phase === "answered" ? (<><ArrowRight className="mr-2 h-5 w-5" />Next Question</>)
              : (<><Mic className="mr-2 h-5 w-5" />Record Answer</>)}
          </Button>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion?.id ?? "loading"}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-panel rounded-3xl p-8 border border-white/5 flex flex-col flex-1"
            >
              {currentQuestion ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-2 py-1 rounded-full bg-white/5 border border-white/10">
                      {currentQuestion.category}
                    </span>
                    {currentQuestion.skill && (
                      <span className="text-xs font-medium text-primary px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
                        {currentQuestion.skill}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-display font-semibold leading-relaxed mb-6">{currentQuestion.questionText}</h2>
                  <div className="mt-auto pt-6 border-t border-white/10 min-h-[140px]">
                    {isRecording && (
                      <div className="flex items-center gap-3 text-emerald-400 font-medium">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                        </span>
                        Listening... speak naturally, take your time.
                      </div>
                    )}
                    {isCountdown && <div className="text-muted-foreground text-sm">Get ready to answer — recording starts in {countdown}s...</div>}
                    {isProcessing && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Transcribing and analyzing...
                      </div>
                    )}
                    {phase === "answered" && transcript && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" /> Captured Answer:
                        </h4>
                        <p className="text-sm leading-relaxed text-foreground/90 italic">"{transcript}"</p>
                        {stutterInfo && (
                          <div className={cn("flex items-start gap-2 text-xs rounded-lg px-3 py-2 border", stutterInfo.score > 50 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400")}>
                            <span className="shrink-0 font-bold">{stutterInfo.score > 50 ? "⚠" : "✓"}</span>
                            <span>{stutterInfo.notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {!isRecording && !isCountdown && !isProcessing && phase !== "answered" && (
                      <div className="text-muted-foreground/40 italic text-sm">Your transcript will appear here after recording.</div>
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
            <div className="glass-panel rounded-2xl border border-white/5 p-4">
              <h4 className="text-xs font-medium text-muted-foreground mb-3">Progress — {answers.length} answer(s) submitted</h4>
              <div className="flex gap-2 flex-wrap">
                {questions.slice(0, answers.length).map((q, i) => {
                  const ans = answers[i];
                  const fluent = ans && (ans.stutterScore ?? 0) < 50;
                  return <div key={q.id} className={cn("h-2 w-8 rounded-full", fluent ? "bg-emerald-500" : "bg-amber-500")} title={`Q${i + 1}: ${q.skill ?? q.category}`} />;
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Green = fluent · Amber = fluency noted</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
