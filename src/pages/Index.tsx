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
    addAttempt
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

  const handleRequestHint = (level: number) => {
    if (currentProblem) {
      addHint(currentProblem.id);
      
      const hints = [
        "Think about the fundamental concepts involved in this problem. What mathematical principles apply here?",
        "Consider breaking this problem into smaller steps. What would be your first calculation?",
        "You're almost there! Check your setup and make sure your units are consistent."
      ];
      
      toast({
        title: `Hint ${level}`,
        description: hints[level - 1],
      });
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
        <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-6">
          <PDFUploader 
            onFileUpload={handleFileUpload}
            isUploading={isUploading}
          />
        </div>
      );

    case 'parsing':
      return currentPDF ? (
        <ProblemParsingPreview
          pdf={currentPDF}
          selectedProblem={selectedParsedProblem}
          onProblemSelect={handleProblemSelect}
          onEditProblem={(problem) => {
            toast({
              title: "Edit Problem",
              description: "Problem editing feature coming soon!",
            });
          }}
          onMergeProblems={(p1, p2) => {
            toast({
              title: "Merge Problems",
              description: "Problem merging feature coming soon!",
            });
          }}
          onSplitProblem={(problem) => {
            toast({
              title: "Split Problem",
              description: "Problem splitting feature coming soon!",
            });
          }}
          onAcceptAll={handleAcceptAllProblems}
        />
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
