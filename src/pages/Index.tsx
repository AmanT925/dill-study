import React, { useState } from 'react';
import { PDFUploader } from '@/components/PDFUploader';
import { ProblemParsingPreview } from '@/components/ProblemParsingPreview';
import { ProblemWorkspace } from '@/components/ProblemWorkspace';
import { Dashboard } from '@/pages/Dashboard';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { ParsedPDF, Problem } from '@/lib/store';
import { extractTextFromPDF } from '@/lib/pdfExtractor';
import { savePDFRecord } from '@/lib/localPDFStore';
import { parseProblems } from '@/lib/problemParser';
import { splitProblemsWithGemini } from '@/lib/aiProblemSplitter';
import { getGuidance } from '@/lib/aiGuidance';

type AppScreen = 'upload' | 'parsing' | 'dashboard' | 'workspace';

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('upload');
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

  // Render current screen
  switch (currentScreen) {
    case 'upload':
      return (
        <div className="h-[calc(100vh-4rem)] bg-gradient-bg flex items-center justify-center px-6">
          <PDFUploader 
            onFileUpload={handleFileUpload}
            isUploading={isUploading}
          />
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
