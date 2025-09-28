import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  FileText,
  Lightbulb,
  Send,
  Clock,
  BookOpen,
  MessageSquare,
  ChevronLeft,
} from 'lucide-react';
import { Problem, useStore } from '@/lib/store';
import { PDFViewer } from "./PDFViewer";
import { Latex } from '@/components/ui/latex';
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
  const setCurrentProblem = useStore(s => s.setCurrentProblem);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const [forceScrollKey, setForceScrollKey] = useState(0);
  // Track per-problem 'create similar' usage in localStorage so it stays disabled after use
  const SIMILAR_KEY = 'guide-grok:generated-similar';
  const loadSimilarMap = () => {
    try { return JSON.parse(localStorage.getItem(SIMILAR_KEY) || '{}') as Record<string, boolean>; } catch { return {}; }
  };
  const saveSimilarUsed = (id: string) => {
    try {
      const m = loadSimilarMap();
      m[id] = true;
      localStorage.setItem(SIMILAR_KEY, JSON.stringify(m));
    } catch (e) { /* ignore */ }
  };
  const [similarUsed, setSimilarUsed] = useState<boolean>(() => {
    try { const m = loadSimilarMap(); return !!m[problem.id]; } catch { return false; }
  });
  
  // Always reflect latest problem (store may update after AI responses)
  const liveProblem = useStore(s => s.currentProblem?.id === problem.id ? s.currentProblem : problem);

  // keep similarUsed in sync when the live problem changes
  React.useEffect(() => {
    try { const m = loadSimilarMap(); setSimilarUsed(!!m[liveProblem.id]); } catch { setSimilarUsed(false); }
  }, [liveProblem.id]);

  // Handler for 'Create Similar' which streams an AI-generated similar problem into the chat
  const handleCreateSimilar = async () => {
    if (similarUsed) return;
    // mark as used immediately (persisted)
    saveSimilarUsed(liveProblem.id);
    setSimilarUsed(true);

    const userPrompt = `Please create a new problem that is similar in style and difficulty to the following problem. Keep it concise and self-contained.\n\nProblem:\n${liveProblem.text}`;

    // Add a user-like message into the conversation so it appears in the chat
    addAssistantMessage(liveProblem.id, 'user', 'Create a similar problem');

    // create placeholder assistant message
    const tempId = Date.now();
    const existing = liveProblem.assistantMessages || [];
    updateProblem(liveProblem.id, { assistantMessages: [...existing, { role: 'assistant', content: '', ts: tempId }] });

    try {
      let accumulated = '';
      await streamGuidance({
        problemText: liveProblem.text,
        attempts: liveProblem.attempts,
        assistantMessages: (liveProblem.assistantMessages || []).filter(m => m.ts !== tempId),
        hintLevel: liveProblem.hintsUsed,
        userInput: userPrompt,
      }, (chunk) => {
        accumulated += chunk;
        const msgs = (useStore.getState().currentProblem?.assistantMessages || []).map(m => {
          if (m.ts === tempId) return { ...m, content: accumulated };
          return m;
        });
        updateProblem(liveProblem.id, { assistantMessages: msgs });
      });
    } catch (e: any) {
      const msgs = (useStore.getState().currentProblem?.assistantMessages || []).map(m => {
        if (m.ts === tempId) return { ...m, content: `Error: ${e.message || e}` };
        return m;
      });
      updateProblem(liveProblem.id, { assistantMessages: msgs });
    }
  };

  // When the selected problem's page changes, bump the forceScrollKey to force PDFViewer to scroll
  React.useEffect(() => {
    setForceScrollKey(k => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveProblem.pageNumber]);

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
    <div className="flex h-screen flex-col bg-workspace">
      {/* Row 1: Back to Problems */}
      <div className="px-2 py-0">
        <Button
          variant="ghost"
          onClick={onBackToList}
          className="text-workspace-foreground"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Problems
        </Button>
      </div>

  {/* Rows 2 & 3: two-column layout where each column has a top (row2) and bottom (row3) */}
  <div className="flex flex-1 gap-3">
  {/* Left column (problem) */}
  <div className="flex-1 min-w-0 border-r border-border flex flex-col">
          {/* Row 2 left: problem header */}
          <div className="p-4 h-14 flex items-center">
            <div className="flex items-center justify-between w-full">
              <h1 className="text-lg font-bold text-workspace-foreground">
                {liveProblem.title || 'Problem'}
              </h1>
              <div className="flex items-center gap-3">
                <Badge variant="outline">Page {liveProblem.pageNumber}</Badge>
                {liveProblem.estimatedMinutes && (
                  <Badge variant="secondary" title="Estimated time to solve" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> ~{liveProblem.estimatedMinutes}m
                  </Badge>
                )}
                <label className="flex items-center gap-2 text-sm text-muted-foreground ml-2">
                  <input
                    type="checkbox"
                    checked={liveProblem.status === 'completed'}
                    onChange={(e) => onProblemUpdate({ status: e.target.checked ? 'completed' : 'not-started' })}
                    className="w-4 h-4 accent-green-600"
                    aria-label="Mark problem complete"
                  />
                  <span className="select-none">Mark complete</span>
                </label>
              </div>
            </div>
          </div>

          {/* Row 3 left: PDF viewer and editable text */}
          <div className="p-4 flex-1 overflow-auto space-y-6">
            {/* Tags (moved here so they don't expand the header) */}
            {liveProblem.tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {liveProblem.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    <BookOpen className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="h-[65vh] w-full">
              <PDFViewer
                fileUrl={useStore.getState().currentPDF?.fileUrl || ''}
                totalPages={useStore.getState().currentPDF?.totalPages || liveProblem.pageNumber}
                highlightPage={liveProblem.pageNumber}
                forceScrollKey={forceScrollKey}
                onChangePage={(page) => {
                  // If a detected problem exists on the newly visible page, update the global selection
                  const pdfState = useStore.getState().currentPDF;
                  const found = pdfState?.problems.find(p => p.pageNumber === page);
                  if (found) {
                    // update global currentProblem so other parts of the app can react
                    setCurrentProblem(found);
                  }
                }}
                className="h-full"
              />
            </div>

            <Card className="p-4">
              <div className="space-y-3">
                <h3 className="font-medium text-workspace-foreground">Problem Text</h3>
                <div className="space-y-3">
                  <Textarea
                    value={liveProblem.text}
                    onChange={(e) => onProblemUpdate({ text: e.target.value })}
                    className="min-h-[120px] resize-none bg-background"
                    placeholder="Problem text will appear here..."
                  />
                  <div className="bg-background p-4 rounded-md border">
                    <Latex content={liveProblem.text} block />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  You can edit this text if character recognition wasn't perfect
                </p>
              </div>
            </Card>
          </div>
        </div>

  {/* Right column (assistant) */}
  <div className="flex-1 min-w-0 flex gap-3 flex-col">
          {/* Row 2 right: assistant header + hint */}
          <div className="p-4 h-14 flex items-center">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-workspace-foreground">AI Assistant</h2>
              </div>
              {/* right-aligned actions: Create Similar then hint button */}
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className={similarUsed
                    ? 'flex items-center bg-muted/60 text-muted-foreground border border-border px-3 py-1 rounded'
                    : 'flex items-center bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1 rounded shadow-sm'
                  }
                  onClick={handleCreateSimilar}
                  disabled={similarUsed}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  <span className="text-sm">{similarUsed ? 'Created' : 'Create Similar'}</span>
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  className="flex items-center bg-gradient-primary text-primary-foreground hover:bg-primary-dark transform transition-transform duration-150 hover:scale-105 shadow-sm hover:shadow-lg"
                  onClick={() => handleHintRequest(Math.min(3, liveProblem.hintsUsed + 1))}
                  disabled={liveProblem.hintsUsed >= 3}
                >
                  <Lightbulb className="w-4 h-4" />
                  <span className="text-sm">
                    {liveProblem.hintsUsed >= 3
                      ? '(all hints used)'
                      : liveProblem.hintsUsed === 0
                        ? 'Hint: Concept Review (1/3)'
                        : liveProblem.hintsUsed === 1
                          ? 'Hint: Next Step (2/3)'
                          : 'Hint: Near Solution (3/3)'
                    }
                  </span>
                </Button>
              </div>
            </div>
          </div>

          {/* Row 3 right: chat area and input */}
          <div className="flex-1 flex flex-col min-h-0">
            <Card className="p-4 flex-1 flex flex-col max-h-[95vh] relative w-full">
              <h3 className="text-sm font-medium mb-3 text-workspace-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Chat
              </h3>
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 w-full" id="chat-scroll-region">
                {(!liveProblem.assistantMessages || liveProblem.assistantMessages.length === 0) && liveProblem.attempts.length === 0 && !isLoadingGuidance && (
                  <div className="text-center text-muted-foreground py-10 text-xs">
                    <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Start by describing your approach or asking a question. Use hints for more structured assistance.</p>
                  </div>
                )}
                {(liveProblem.assistantMessages || [])
                  .sort((a,b)=>a.ts - b.ts)
                  .map((m, i, arr) => {
                    const isAssistant = m.role === 'assistant';
                    const isLast = i === arr.length - 1;
                    return (
                      <div key={`msg-${m.ts}-${i}`} className={`group max-w-full flex ${isAssistant ? 'justify-start' : 'justify-end'} animate-in fade-in duration-150`}>
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

            {/* Input Area */}
            <div className="space-y-3 mt-3">
              <Card className="p-3">
                <div className="space-y-3">
                  <Textarea
                    value={currentAttempt}
                    onChange={(e) => setCurrentAttempt(e.target.value)}
                    placeholder="Describe your approach or ask for help... (Enter to send, Shift+Enter for newline)"
                    className="min-h-[80px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const isNewlineKey = e.metaKey || e.ctrlKey || e.shiftKey;
                        if (isNewlineKey) {
                          e.preventDefault();
                          const target = e.target as HTMLTextAreaElement;
                          const start = target.selectionStart || 0;
                          const end = target.selectionEnd || 0;
                          const before = currentAttempt.slice(0, start);
                          const after = currentAttempt.slice(end);
                          const updated = `${before}\n${after}`;
                          setCurrentAttempt(updated);
                          requestAnimationFrame(() => {
                            target.selectionStart = target.selectionEnd = start + 1;
                          });
                        } else {
                          e.preventDefault();
                          handleGuidanceSubmit();
                        }
                      }
                    }}
                  />
                  <Button
                    onClick={handleGuidanceSubmit}
                    disabled={isLoadingGuidance || !currentAttempt.trim()}
                    className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary-dark"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    {isLoadingGuidance ? 'Thinking…' : 'Ask AI'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">**Messages are treated as a conversation, NOT standalone**</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};