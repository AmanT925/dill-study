import { create } from 'zustand';

export interface Problem {
  id: string;
  title: string;
  text: string;
  pageNumber: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  status: 'not-started' | 'in-progress' | 'attempted' | 'completed';
  hintsUsed: number;
  attempts: string[];
  assistantMessages?: { role: 'user' | 'assistant'; content: string; ts: number }[];
  timeSpent: number;
  tags: string[];
}

export interface ParsedPDF {
  id: string;
  fileName: string;
  fileUrl: string;
  totalPages: number;
  problems: Problem[];
  extractedText: string;
}

interface AppState {
  currentPDF: ParsedPDF | null;
  currentProblem: Problem | null;
  isParsingPreviewOpen: boolean;
  isVoiceModeActive: boolean;
  hintLevel: number;
  
  // Actions
  setPDF: (pdf: ParsedPDF) => void;
  setCurrentProblem: (problem: Problem | null) => void;
  updateProblem: (problemId: string, updates: Partial<Problem>) => void;
  setParsingPreviewOpen: (open: boolean) => void;
  setVoiceModeActive: (active: boolean) => void;
  setHintLevel: (level: number) => void;
  addHint: (problemId: string) => void;
  addAttempt: (problemId: string, attempt: string) => void;
  addAssistantMessage: (problemId: string, role: 'user' | 'assistant', content: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentPDF: null,
  currentProblem: null,
  isParsingPreviewOpen: false,
  isVoiceModeActive: false,
  hintLevel: 0,

  setPDF: (pdf) => set({ currentPDF: pdf }),
  
  setCurrentProblem: (problem) => set({ currentProblem: problem }),
  
  updateProblem: (problemId, updates) => set((state) => {
    if (!state.currentPDF) return state;
    
    const updatedProblems = state.currentPDF.problems.map(p => 
      p.id === problemId ? { ...p, ...updates } : p
    );
    
    return {
      currentPDF: { ...state.currentPDF, problems: updatedProblems },
      currentProblem: state.currentProblem?.id === problemId 
        ? { ...state.currentProblem, ...updates }
        : state.currentProblem
    };
  }),
  
  setParsingPreviewOpen: (open) => set({ isParsingPreviewOpen: open }),
  
  setVoiceModeActive: (active) => set({ isVoiceModeActive: active }),
  
  setHintLevel: (level) => set({ hintLevel: level }),
  
  addHint: (problemId) => set((state) => {
    const problem = state.currentPDF?.problems.find(p => p.id === problemId);
    if (problem) {
      get().updateProblem(problemId, { hintsUsed: problem.hintsUsed + 1 });
    }
    return state;
  }),
  
  addAttempt: (problemId, attempt) => set((state) => {
    const problem = state.currentPDF?.problems.find(p => p.id === problemId);
    if (problem) {
      get().updateProblem(problemId, { 
        attempts: [...problem.attempts, attempt],
        status: 'attempted'
      });
    }
    return state;
  }),
  
  addAssistantMessage: (problemId, role, content) => set((state) => {
    const problem = state.currentPDF?.problems.find(p => p.id === problemId);
    if (problem) {
      const messages = problem.assistantMessages || [];
      get().updateProblem(problemId, {
        assistantMessages: [...messages, { role, content, ts: Date.now() }]
      });
    }
    return state;
  }),
}));