import React, { useState } from 'react';
import { PDFUploader } from '@/components/PDFUploader';
import { ProblemParsingPreview } from '@/components/ProblemParsingPreview';
import { ProblemWorkspace } from '@/components/ProblemWorkspace';
import { Dashboard } from '@/pages/Dashboard';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { ParsedPDF, Problem } from '@/lib/store';
import { extractTextFromPDF } from '@/lib/pdfExtractor';
import { savePDFRecord, loadAllPDFRecords } from '@/lib/localPDFStore';
import { parseProblems } from '@/lib/problemParser';
import { splitProblemsWithGemini } from '@/lib/aiProblemSplitter';
import { getGuidance } from '@/lib/aiGuidance';

type AppScreen = 'upload' | 'parsing' | 'dashboard' | 'workspace' | 'library';

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('upload');
  const [library, setLibrary] = useState<{ id: string; fileName: string; savedAt: string; totalPages: number }[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedParsedProblem, setSelectedParsedProblem] = useState<Problem | null>(null);
  
  const { 
    currentPDF, 
    currentProblem, 
    isVoiceModeActive,
    setPDF, 
    setCurrentProblem, 
    updateProblem,
    setVoiceModeActive,
    addHint,
    addAttempt,
    addAssistantMessage
  } = useStore();
  
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const id = Date.now().toString();
      // 1. Extract text from the uploaded PDF
  const { text: extractedText, pages, pageLines, totalPages } = await extractTextFromPDF(file);

      // 2. Create a minimal placeholder problem so existing UI still works
      let problems: Problem[] = [];
      const hasGemini = !!import.meta.env.VITE_GEMINI_API_KEY;
      if (hasGemini) {
        try {
          problems = await splitProblemsWithGemini({ fullText: extractedText, pageCount: totalPages });
        } catch (e) {
          console.warn('Gemini problem split failed, falling back to heuristic', e);
          problems = parseProblems({ pages, pageLines });
        }
      } else {
        problems = parseProblems({ pages, pageLines });
      }

      const parsed: ParsedPDF = {
        id,
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
        totalPages,
        extractedText,
        problems,
      };

      // 3. Persist locally (IndexedDB)
      await savePDFRecord({ id, file, extractedText, totalPages });

      // 4. Update state & navigate
      setPDF(parsed);
      setCurrentScreen('parsing');

    } catch (error: any) {
      console.error('PDF processing failed', error);
      toast({
        title: 'Upload failed',
        description: error?.message || 'There was an error processing your PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAcceptAllProblems = () => {
    setCurrentScreen('dashboard');
  };

  const handleProblemSelect = (problem: Problem) => {
    if (currentScreen === 'parsing') {
      setSelectedParsedProblem(problem);
    } else {
      setCurrentProblem(problem);
      updateProblem(problem.id, { status: 'in-progress' });
      setCurrentScreen('workspace');
    }
  };

  const handleBackToList = () => {
    setCurrentProblem(null);
    setCurrentScreen('dashboard');
  };

  const handleRequestHint = async (level: number) => {
    if (!currentProblem) return;

    // increment hint count in-store
    addHint(currentProblem.id);

    // Build a short userInput describing the hint request for the guidance model
    let userInput = '';
    if (level === 1) {
      userInput = 'Provide a concise high-level overview of the core concepts, formulas, or theorems that apply to this problem. Keep it short and name the specific techniques to consider. Do NOT give the full solution. If they have already made some progress in the problem, give them a small step towards more progress.';
    } else if (level === 2) {
      userInput = 'Give the first concrete calculation or setup step to get started on this problem. Explain what to compute and why, but do not provide the full worked solution. If they are already significantly through the problem, give them one more hint to move forward.';
    } else {
      userInput = 'Provide a few progressive next steps (about 30-40% of the way toward a solution) tailored to the current conversation and attempts. Use the assistant messages and prior attempts for context; be specific and procedural but avoid revealing the entire final answer.';
    }

    // Simulate the user typing the hint request into the chat
    let userChatText = '';
    if (level === 1) {
      userChatText = 'Can you give a concise high-level overview of the core concepts and techniques I should consider for this problem?';
    } else if (level === 2) {
      userChatText = "What's the first calculation or setup step I should do to make progress on this problem?";
    } else {
      userChatText = 'Please provide a few progressive next steps (about 30-40% of the way toward a solution), tailored to the current conversation and my prior attempts.';
    }

    // Post the simulated user message into the chat
    addAssistantMessage(currentProblem.id, 'user', userChatText);

    // Create a temporary assistant message so the UI shows a placeholder while we fetch guidance
    const tempId = Date.now();
    const existing = currentProblem.assistantMessages || [];
    updateProblem(currentProblem.id, { assistantMessages: [...existing, { role: 'assistant', content: '', ts: tempId }] });

    try {
      const res = await getGuidance({
        problemText: currentProblem.text,
        attempts: currentProblem.attempts || [],
        assistantMessages: currentProblem.assistantMessages || [],
        hintLevel: currentProblem.hintsUsed || 0,
        userInput,
      });

      // Replace the temporary assistant message content with the real answer
      const msgs = (useStore.getState().currentProblem?.assistantMessages || []).map(m => {
        if (m.ts === tempId) return { ...m, content: res.answer };
        return m;
      });
      updateProblem(currentProblem.id, { assistantMessages: msgs });
    } catch (e: any) {
      console.error('Hint generation failed', e);
      // fallback static hints
      const fallback = [
        "Think about the fundamental concepts involved in this problem. What mathematical principles apply here?",
        "Consider breaking this problem into smaller steps. What would be your first calculation?",
        "You're almost there! Check your setup and make sure your units are consistent."
      ];
      const msgs = (useStore.getState().currentProblem?.assistantMessages || []).map(m => {
        if (m.ts === tempId) return { ...m, content: fallback[level - 1] || 'Try simplifying the problem and checking units.' };
        return m;
      });
      updateProblem(currentProblem.id, { assistantMessages: msgs });
    }
  };

  const handleSubmitAttempt = (attempt: string) => {
    if (currentProblem) {
      addAttempt(currentProblem.id, attempt);
      toast({
        title: "Attempt recorded",
        description: "Your work has been saved. Keep going!",
      });
    }
  };

  const handleNewUpload = () => {
    setCurrentScreen('upload');
    setPDF(null);
    setCurrentProblem(null);
  };

  // Listen for nav bar screen change events
  React.useEffect(() => {
    function handler(e: any) {
      const screen = e?.detail?.screen as AppScreen | undefined;
      if (!screen) return;
      if (screen === 'upload') {
        handleNewUpload();
      } else if (screen === 'library') {
        setCurrentScreen('library');
      } else if (screen === 'dashboard') {
        if (currentPDF) setCurrentScreen('dashboard');
      }
    }
    window.addEventListener('app:navigate-screen', handler);
    return () => window.removeEventListener('app:navigate-screen', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPDF]);

  // Load library when visiting library screen
  React.useEffect(() => {
    if (currentScreen === 'library') {
      (async () => {
        setIsLibraryLoading(true);
        try {
          const recs = await loadAllPDFRecords();
          setLibrary(recs.map(r => ({ id: r.id, fileName: r.fileName, savedAt: r.savedAt, totalPages: r.totalPages })));
        } finally {
          setIsLibraryLoading(false);
        }
      })();
    }
  }, [currentScreen]);

  const openFromLibrary = async (id: string) => {
    // naive fetch: load record & rebuild minimal ParsedPDF (problems need re-parse)
    // For now we re-parse text to derive problems again (could be improved by persisting problems separately)
    setIsLibraryLoading(true);
    try {
      const recs = await loadAllPDFRecords();
      const rec = recs.find(r => r.id === id);
      if (!rec) return;
      // Reconstruct fileUrl from stored base64
      const fileBlob = await (await fetch(rec.fileBase64)).blob();
      const fileUrl = URL.createObjectURL(fileBlob);
      // Re-run heuristic parse (Gemini optional)
      let problems: Problem[] = [];
      const hasGemini = !!import.meta.env.VITE_GEMINI_API_KEY;
      try {
        if (hasGemini) {
          problems = await splitProblemsWithGemini({ fullText: rec.extractedText, pageCount: rec.totalPages });
        } else {
          problems = parseProblems({ pages: rec.extractedText.split(/===== Page \d+ =====/).slice(1) });
        }
      } catch {
        problems = parseProblems({ pages: rec.extractedText.split(/===== Page \d+ =====/).slice(1) });
      }
      setPDF({ id: rec.id, fileName: rec.fileName, fileUrl, totalPages: rec.totalPages, extractedText: rec.extractedText, problems });
      setCurrentScreen('dashboard');
    } finally {
      setIsLibraryLoading(false);
    }
  };

  // Render current screen
  switch (currentScreen) {
    case 'upload':
      return (
        <div className="h-[calc(100vh-4rem)] bg-gradient-bg flex flex-col items-center justify-center px-6 gap-6">
          <PDFUploader onFileUpload={handleFileUpload} isUploading={isUploading} />
          <button onClick={() => setCurrentScreen('library')} className="text-xs text-muted-foreground underline hover:text-foreground">View past uploads</button>
        </div>
      );
    case 'library':
      return (
        <div className="h-[calc(100vh-4rem)] overflow-auto p-8 bg-gradient-bg">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Your Uploaded PDFs</h1>
              <div className="flex gap-2">
                <button onClick={() => setCurrentScreen('upload')} className="text-sm px-3 py-1 rounded border border-border bg-background hover:bg-muted">Upload New</button>
                <button onClick={() => setCurrentScreen('upload')} className="text-sm px-3 py-1 rounded border border-border bg-background hover:bg-muted">Back</button>
              </div>
            </div>
            {isLibraryLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!isLibraryLoading && library.length === 0 && (
              <div className="text-sm text-muted-foreground">No prior uploads stored locally.</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {library.map(rec => (
                <div key={rec.id} className="border border-border rounded-lg p-4 bg-background/60 backdrop-blur-sm flex flex-col gap-2 hover:shadow-sm">
                  <div className="font-medium text-sm truncate" title={rec.fileName}>{rec.fileName}</div>
                  <div className="text-[11px] text-muted-foreground flex gap-3">
                    <span>{new Date(rec.savedAt).toLocaleDateString()}</span>
                    <span>{rec.totalPages} pages</span>
                  </div>
                  <button onClick={() => openFromLibrary(rec.id)} className="mt-2 text-xs self-start px-2 py-1 rounded bg-gradient-primary text-primary-foreground hover:opacity-90">Open</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'parsing':
      return currentPDF ? (
        <div className="h-[calc(100vh-4rem)]">
          <ProblemParsingPreview
          pdf={currentPDF}
          selectedProblem={selectedParsedProblem}
          onProblemSelect={handleProblemSelect}
          onEditProblem={(problem) => {
            setSelectedParsedProblem(problem);
            setCurrentScreen('parsing');
          }}
          onAcceptAll={handleAcceptAllProblems}
          />
        </div>
      ) : null;

    case 'dashboard':
      return currentPDF ? (
        <Dashboard
          pdf={currentPDF}
          onProblemSelect={handleProblemSelect}
          onNewUpload={handleNewUpload}
        />
      ) : null;

    case 'workspace':
      return currentProblem ? (
        <ProblemWorkspace
          problem={currentProblem}
          onProblemUpdate={(updates) => updateProblem(currentProblem.id, updates)}
          onRequestHint={handleRequestHint}
          onSubmitAttempt={handleSubmitAttempt}
          onBackToList={handleBackToList}
          isVoiceModeActive={isVoiceModeActive}
          onToggleVoiceMode={() => setVoiceModeActive(!isVoiceModeActive)}
        />
      ) : null;

    default:
      return <div>Loading...</div>;
  }
};

export default Index;
