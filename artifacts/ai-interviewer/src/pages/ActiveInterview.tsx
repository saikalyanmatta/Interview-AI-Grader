import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetInterview, useGetQuestionAudio, useSubmitAnswer, useCompleteInterview } from "@workspace/api-client-react";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import { blobToBase64, playBase64Audio, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Mic, Square, Volume2, Loader2, ArrowRight, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function ActiveInterview() {
  const [, params] = useRoute("/interview/:id");
  const [, setLocation] = useLocation();
  const id = parseInt(params?.id || "0");
  const { toast } = useToast();

  const { data: interview, isLoading: isLoadingInterview } = useGetInterview(id);
  const submitMutation = useSubmitAnswer();
  const completeMutation = useCompleteInterview();

  const { state: recordingState, startRecording, stopRecording } = useVoiceRecorder();
  
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [transcript, setTranscript] = useState("");

  const currentQuestion = interview?.questions?.[currentQIndex];
  
  // Fetch audio for current question
  const { data: audioData, isFetching: isFetchingAudio } = useGetQuestionAudio(id, currentQuestion?.id || 0, {
    query: { enabled: !!currentQuestion?.id }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play audio when available (auto-play attempt)
  useEffect(() => {
    if (audioData && currentQuestion) {
      playCurrentAudio();
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioData, currentQuestion?.id]);

  const playCurrentAudio = () => {
    if (!audioData) return;
    if (audioRef.current) audioRef.current.pause();
    
    try {
      setIsAiSpeaking(true);
      const audio = playBase64Audio(audioData.audio, audioData.format);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsAiSpeaking(false);
      };
      audio.onerror = () => {
        setIsAiSpeaking(false);
        toast({ title: "Audio playback failed", variant: "destructive" });
      };
    } catch (e) {
      setIsAiSpeaking(false);
    }
  };

  const handleToggleRecording = async () => {
    if (recordingState === "recording") {
      try {
        setIsProcessingAnswer(true);
        const blob = await stopRecording();
        if (blob.size === 0) throw new Error("Empty audio recording");
        
        const b64 = await blobToBase64(blob);
        
        if (!currentQuestion) return;

        const res = await submitMutation.mutateAsync({
          id,
          data: { questionId: currentQuestion.id, audio: b64 }
        });

        setTranscript(res.transcript);
        
      } catch (err: any) {
        toast({ title: "Submission failed", description: err.message, variant: "destructive" });
      } finally {
        setIsProcessingAnswer(false);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsAiSpeaking(false);
      }
      setTranscript("");
      await startRecording();
    }
  };

  const handleNext = async () => {
    if (!interview || !interview.questions) return;
    
    if (currentQIndex < interview.questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      setTranscript("");
    } else {
      // Complete interview
      try {
        await completeMutation.mutateAsync({ id });
        setLocation(`/interview/${id}/report`);
      } catch (err: any) {
        toast({ title: "Failed to complete", description: err.message, variant: "destructive" });
      }
    }
  };

  if (isLoadingInterview) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!interview || !currentQuestion) {
    return <div className="text-center py-20">Interview not found.</div>;
  }

  const progress = ((currentQIndex) / (interview.questions.length || 1)) * 100;
  const isLastQuestion = currentQIndex === (interview.questions.length - 1);
  const hasAnsweredCurrent = !!transcript || interview.answers?.some(a => a.questionId === currentQuestion.id);

  return (
    <div className="max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-8rem)]">
      
      <div className="mb-8">
        <div className="flex justify-between text-sm font-medium text-muted-foreground mb-3">
          <span>Question {currentQIndex + 1} of {interview.questions.length}</span>
          <span className="capitalize">{currentQuestion.category} {currentQuestion.skill && `• ${currentQuestion.skill}`}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8">
        {/* Left Col: Avatar & Controls */}
        <div className="w-full lg:w-1/3 flex flex-col items-center justify-center p-8 glass-panel rounded-3xl border border-white/5 relative overflow-hidden">
          {/* Animated background glow behind avatar */}
          <div className={cn(
            "absolute inset-0 bg-primary/10 blur-[50px] transition-opacity duration-1000",
            isAiSpeaking ? "opacity-100" : "opacity-0"
          )} />
          
          <div className="relative z-10 w-40 h-40 mb-8">
            <img 
              src={`${import.meta.env.BASE_URL}images/ai-avatar.png`} 
              alt="AI Interviewer" 
              className={cn(
                "w-full h-full object-cover rounded-full transition-transform duration-500",
                isAiSpeaking && "scale-105 shadow-[0_0_40px_rgba(124,58,237,0.5)]"
              )}
            />
            {isAiSpeaking && (
              <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />
            )}
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={playCurrentAudio} 
            disabled={isFetchingAudio || isAiSpeaking || recordingState === "recording"}
            className="mb-8 bg-black/40 border-white/10"
          >
            {isFetchingAudio ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Volume2 className="h-4 w-4 mr-2" />}
            {isAiSpeaking ? "Speaking..." : "Play Audio"}
          </Button>

          <div className="w-full mt-auto">
            <Button 
              size="lg" 
              variant={recordingState === "recording" ? "destructive" : "gradient"}
              className={cn(
                "w-full h-16 text-lg shadow-xl transition-all duration-300",
                recordingState === "recording" && "animate-pulse"
              )}
              onClick={handleToggleRecording}
              disabled={isProcessingAnswer || isAiSpeaking}
            >
              {isProcessingAnswer ? (
                <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Processing...</>
              ) : recordingState === "recording" ? (
                <><Square className="mr-2 h-6 w-6 fill-current" /> Stop Recording</>
              ) : (
                <><Mic className="mr-2 h-6 w-6" /> {hasAnsweredCurrent ? "Retry Answer" : "Record Answer"}</>
              )}
            </Button>
          </div>
        </div>

        {/* Right Col: Text Content */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 glass-panel rounded-3xl p-8 border border-white/5 flex flex-col"
            >
              <h2 className="text-2xl font-display font-semibold leading-relaxed mb-6">
                {currentQuestion.questionText}
              </h2>

              <div className="mt-auto pt-6 border-t border-white/10 min-h-[150px]">
                {recordingState === "recording" ? (
                  <div className="flex items-center gap-3 text-emerald-400 font-medium">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    Listening...
                  </div>
                ) : transcript ? (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" /> Captured Answer:
                    </h4>
                    <p className="text-sm leading-relaxed text-foreground/90 italic">"{transcript}"</p>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground/50 italic text-sm">
                    Your answer transcript will appear here.
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-end">
            <Button 
              size="lg" 
              onClick={handleNext} 
              disabled={!hasAnsweredCurrent || completeMutation.isPending}
              className="px-8"
              variant={isLastQuestion ? "gradient" : "secondary"}
            >
              {completeMutation.isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Finalizing...</>
              ) : isLastQuestion ? (
                <><CheckCircle className="mr-2 h-5 w-5" /> Complete Interview</>
              ) : (
                <>Next Question <ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
