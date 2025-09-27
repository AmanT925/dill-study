import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Lightbulb, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Send,
  Clock,
  Target,
  BookOpen,
  MessageSquare,
  ChevronLeft,
  Settings
} from 'lucide-react';
import { Problem, useStore } from '@/lib/store';
import { getGuidance, streamGuidance } from '@/lib/aiGuidance';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface ProblemWorkspaceProps {
  problem: Problem;
  onProblemUpdate: (updates: Partial<Problem>) => void;
  onRequestHint: (level: number) => void;
  onSubmitAttempt: (attempt: string) => void;
  onBackToList: () => void;
  isVoiceModeActive: boolean;
  onToggleVoiceMode: () => void;
}

export const ProblemWorkspace: React.FC<ProblemWorkspaceProps> = ({
  problem,
  onProblemUpdate,
  onRequestHint,
  onSubmitAttempt,
  onBackToList,
  isVoiceModeActive,
  onToggleVoiceMode
}) => {
  const [currentAttempt, setCurrentAttempt] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoadingGuidance, setIsLoadingGuidance] = useState(false);
  const addAssistantMessage = useStore(s => s.addAssistantMessage);
  const updateProblem = useStore(s => s.updateProblem);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  // Always reflect latest problem (store may update after AI responses)
  const liveProblem = useStore(s => s.currentProblem?.id === problem.id ? s.currentProblem : problem);

  async function handleGuidanceSubmit() {
    if (!currentAttempt.trim()) return;
    const userText = currentAttempt.trim();
    setCurrentAttempt('');
    // record user message
    addAssistantMessage(problem.id, 'user', userText);
    setIsLoadingGuidance(true);
    const controller = new AbortController();
    setAbortCtrl(controller);
    // create a placeholder assistant message for streaming
    const tempId = Date.now();
    const existing = liveProblem.assistantMessages || [];
    updateProblem(problem.id, { assistantMessages: [...existing, { role: 'assistant', content: '', ts: tempId }] });
    try {
      let accumulated = '';
      await streamGuidance({
        problemText: liveProblem.text,
        attempts: liveProblem.attempts,
        assistantMessages: (liveProblem.assistantMessages || []).filter(m => m.ts !== tempId),
        hintLevel: liveProblem.hintsUsed,
        userInput: userText,
      }, (chunk) => {
        accumulated += chunk;
        // update the temporary message content
        const msgs = (useStore.getState().currentProblem?.assistantMessages || []).map(m => {
          if (m.ts === tempId) return { ...m, content: accumulated };
          return m;
        });
        updateProblem(problem.id, { assistantMessages: msgs });
      }, { signal: controller.signal });
    } catch (e: any) {
      const msgs = (useStore.getState().currentProblem?.assistantMessages || []).map(m => {
        if (m.ts === tempId) return { ...m, content: `Error: ${e.message || e}` };
        return m;
      });
      updateProblem(problem.id, { assistantMessages: msgs });
    } finally {
      setIsLoadingGuidance(false);
      setAbortCtrl(null);
    }
  }
  // Auto-scroll chat
  const chatEndRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [liveProblem.assistantMessages?.length, isLoadingGuidance]);

  const handleHintRequest = (level: number) => {
    onRequestHint(level);
  };

  // Removed explicit attempt submission per user preference.

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-gradient-secondary';
      case 'attempted': return 'bg-gradient-accent';
      case 'in-progress': return 'bg-gradient-primary';
      default: return 'bg-muted';
    }
  };

  const markdownComponents: Components = {
    code({node, className, children, ...props}) {
      const cn = `px-1.5 py-0.5 rounded bg-background/40 border border-border text-[11px] ${className || ''}`;
      return <code className={cn} {...props}>{children}</code>;
    },
    li({node, children, ...props}) {
      return <li className="ml-4 list-disc leading-snug" {...props}>{children}</li>;
    }
  };

  return (
    <div className="flex h-screen bg-workspace">
      {/* Left side - PDF Viewer & Problem Text */}
      <div className="w-3/5 border-r border-border p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onBackToList}
            className="text-workspace-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Problems
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Problem Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-workspace-foreground">
                {liveProblem.title || 'Problem'}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">Page {liveProblem.pageNumber}</Badge>
                <Badge className={getStatusColor(liveProblem.status)}>
                  {liveProblem.status.replace('-', ' ')}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{Math.floor(liveProblem.timeSpent / 60)}min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
      {liveProblem.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
        {liveProblem.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <BookOpen className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* PDF Viewer */}
        <Card className="flex-1 bg-card flex items-center justify-center">
          <div className="text-center space-y-2">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">PDF Viewer</p>
            <p className="text-xs text-muted-foreground">
              Problem highlighted on page {liveProblem.pageNumber}
            </p>
          </div>
        </Card>

        {/* Editable Problem Text */}
        <Card className="p-4">
          <div className="space-y-3">
            <h3 className="font-medium text-workspace-foreground">Problem Text</h3>
            <Textarea
              value={liveProblem.text}
              onChange={(e) => onProblemUpdate({ text: e.target.value })}
              className="min-h-[120px] resize-none bg-background"
              placeholder="Problem text will appear here..."
            />
            <p className="text-xs text-muted-foreground">
              You can edit this text if the OCR wasn't perfect
            </p>
          </div>
        </Card>
      </div>

      {/* Right side - Assistant Panel */}
      <div className="w-2/5 p-6 flex flex-col">
        {/* Assistant Header */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-workspace-foreground">
              AI Assistant
            </h2>
            <Button
              variant={isVoiceModeActive ? "default" : "outline"}
              size="sm"
              onClick={onToggleVoiceMode}
              className={isVoiceModeActive ? "bg-gradient-accent" : ""}
            >
              {isVoiceModeActive ? (
                <>
                  <Volume2 className="w-4 h-4 mr-2" />
                  Voice On
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 mr-2" />
                  Voice Off
                </>
              )}
            </Button>
          </div>

          {/* Hint Progress */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Hints Used</span>
              <span className="text-sm text-muted-foreground">
                {liveProblem.hintsUsed}/3
              </span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`
                    flex-1 h-2 rounded-full
                    ${level <= liveProblem.hintsUsed 
                      ? 'bg-gradient-accent' 
                      : 'bg-muted'
                    }
                  `}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Hint Buttons */}
        <div className="space-y-3 mb-6">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleHintRequest(1)}
            disabled={liveProblem.hintsUsed >= 1}
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Hint 1: Concept Review
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleHintRequest(2)}
            disabled={liveProblem.hintsUsed >= 2}
          >
            <Target className="w-4 h-4 mr-2" />
            Hint 2: Next Step
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleHintRequest(3)}
            disabled={liveProblem.hintsUsed >= 3}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Hint 3: Near Solution
          </Button>
        </div>

        {/* Unified Chat Area */}
        <div className="flex-1 flex flex-col mb-4 min-h-0">
          <Card className="p-4 flex-1 flex flex-col min-h-0 relative">
            <h3 className="text-sm font-medium mb-3 text-workspace-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Chat
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4" id="chat-scroll-region">
              {(!liveProblem.assistantMessages || liveProblem.assistantMessages.length === 0) && liveProblem.attempts.length === 0 && !isLoadingGuidance && (
                <div className="text-center text-muted-foreground py-10 text-xs">
                  <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Start by describing your approach or asking a question.</p>
                </div>
              )}
              {(liveProblem.assistantMessages || [])
                .sort((a,b)=>a.ts - b.ts)
                .map((m, i, arr) => {
                  const isAssistant = m.role === 'assistant';
                  const isLast = i === arr.length - 1;
                  return (
                    <div key={`msg-${m.ts}-${i}`}
                      className={`group max-w-full flex ${isAssistant ? 'justify-start' : 'justify-end'} animate-in fade-in duration-150`}
                    >
                      <div className={`relative rounded-lg px-3 py-2 text-[13px] leading-relaxed shadow-sm border whitespace-pre-wrap w-fit max-w-[85%] ${isAssistant ? 'bg-muted/40 border-border/60' : 'bg-gradient-primary text-background border-transparent'} ${isAssistant && isLast && isLoadingGuidance ? 'ring-1 ring-gradient-accent/60' : ''}`}>
                        <div className="flex items-center gap-2 mb-1 opacity-70 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded tracking-wide font-semibold ${isAssistant ? 'bg-gradient-accent text-background' : 'bg-background/30'}`}>{isAssistant ? 'AI' : 'You'}</span>
                          <span>{new Date(m.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                        {isAssistant ? (
                          <ReactMarkdown className="prose prose-xs max-w-none prose-invert [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_code]:text-xs" components={markdownComponents}>{m.content || (isLast && isLoadingGuidance ? '...' : '')}</ReactMarkdown>
                        ) : (
                          <div>{m.content}</div>
                        )}
                        {isAssistant && isLast && isLoadingGuidance && (
                          <div className="absolute -bottom-3 left-3 flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-gradient-primary animate-bounce" /> streaming
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              {isLoadingGuidance && !liveProblem.assistantMessages?.length && (
                <div className="text-xs inline-flex items-center gap-2 text-muted-foreground animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-gradient-primary animate-bounce" /> AI is thinking...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {abortCtrl && isLoadingGuidance && (
              <div className="absolute top-3 right-3">
                <Button size="sm" variant="destructive" onClick={() => abortCtrl.abort()}>Cancel</Button>
              </div>
            )}
          </Card>
        </div>

        {/* Input Area */}
        <div className="space-y-3">
          {isVoiceModeActive && (
            <div className="flex items-center justify-center">
              <Button
                variant={isListening ? "destructive" : "default"}
                size="lg"
                onClick={() => setIsListening(!isListening)}
                className={isListening ? "" : "bg-gradient-primary"}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-5 h-5 mr-2" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 mr-2" />
                    Push to Talk
                  </>
                )}
              </Button>
            </div>
          )}

          <Card className="p-3">
            <div className="space-y-3">
              <Textarea
                value={currentAttempt}
                onChange={(e) => setCurrentAttempt(e.target.value)}
                placeholder="Describe your approach or ask for help... (Cmd/Ctrl+Enter to Ask AI)"
                className="min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGuidanceSubmit();
                  }
                }}
              />
              <Button
                onClick={handleGuidanceSubmit}
                disabled={isLoadingGuidance || !currentAttempt.trim()}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-gradient-primary to-gradient-accent hover:opacity-90"
              >
                <Send className="w-5 h-5 mr-2" />
                {isLoadingGuidance ? 'Thinking…' : 'Ask AI'}
              </Button>
              <p className="text-[10px] text-muted-foreground text-right">Cmd/Ctrl+Enter to send. Your message is not stored as a separate attempt.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};