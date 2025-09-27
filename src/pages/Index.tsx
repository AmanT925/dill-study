import React, { useState } from 'react';
import { PDFUploader } from '@/components/PDFUploader';
import { ProblemParsingPreview } from '@/components/ProblemParsingPreview';
import { ProblemWorkspace } from '@/components/ProblemWorkspace';
import { Dashboard } from '@/pages/Dashboard';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { ParsedPDF, Problem } from '@/lib/store';

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
      // Simulate PDF processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock parsed PDF data
      const mockPDF: ParsedPDF = {
        id: Date.now().toString(),
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
        totalPages: 5,
        extractedText: "Sample extracted text from PDF...",
        problems: [
          {
            id: '1',
            title: 'Calculus Integration Problem',
            text: 'Find the integral of 2x² + 3x - 1 from x = 0 to x = 4. Show all steps and explain your reasoning.',
            pageNumber: 1,
            status: 'not-started',
            hintsUsed: 0,
            attempts: [],
            timeSpent: 0,
            tags: ['calculus', 'integration', 'polynomials'],
          },
          {
            id: '2',
            title: 'Linear Algebra Matrix Problem',
            text: 'Given matrices A = [[1,2],[3,4]] and B = [[5,6],[7,8]], compute A×B and find the determinant of the result.',
            pageNumber: 2,
            status: 'not-started',
            hintsUsed: 0,
            attempts: [],
            timeSpent: 0,
            tags: ['linear-algebra', 'matrices', 'determinants'],
          },
          {
            id: '3',
            title: 'Physics Motion Problem',
            text: 'A ball is thrown upward with an initial velocity of 20 m/s. Calculate the maximum height reached and the time taken to reach that height.',
            pageNumber: 3,
            status: 'not-started',
            hintsUsed: 0,
            attempts: [],
            timeSpent: 0,
            tags: ['physics', 'kinematics', 'projectile-motion'],
          }
        ]
      };

      setPDF(mockPDF);
      setCurrentScreen('parsing');
      
      toast({
        title: "PDF uploaded successfully!",
        description: `Found ${mockPDF.problems.length} problems to work through.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error processing your PDF. Please try again.",
        variant: "destructive",
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
          onRerunOCR={() => {
            toast({
              title: "Re-running OCR",
              description: "OCR feature coming soon!",
            });
          }}
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
