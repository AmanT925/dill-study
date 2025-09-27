import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Check, 
  Edit3, 
  Split, 
  Merge, 
  RefreshCw,
  ChevronRight,
  Clock,
  Hash
} from 'lucide-react';
import { ParsedPDF, Problem } from '@/lib/store';

interface ProblemParsingPreviewProps {
  pdf: ParsedPDF;
  selectedProblem: Problem | null;
  onProblemSelect: (problem: Problem) => void;
  onEditProblem: (problem: Problem) => void;
  onMergeProblems: (problem1: Problem, problem2: Problem) => void;
  onSplitProblem: (problem: Problem) => void;
  onAcceptAll: () => void;
  onRerunOCR: () => void;
}

export const ProblemParsingPreview: React.FC<ProblemParsingPreviewProps> = ({
  pdf,
  selectedProblem,
  onProblemSelect,
  onEditProblem,
  onMergeProblems,
  onSplitProblem,
  onAcceptAll,
  onRerunOCR
}) => {
  return (
    <div className="flex h-screen bg-workspace">
      {/* Left side - PDF Preview */}
      <div className="w-1/2 border-r border-border p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-workspace-foreground">PDF Preview</h2>
            <Button variant="outline" size="sm" onClick={onRerunOCR}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Re-run OCR
            </Button>
          </div>
          
          <Card className="aspect-[3/4] bg-card flex items-center justify-center">
              <div className="text-center space-y-2">
              <FileText className="w-12 h-12 mx-auto" />
              <p className="text-sm text-muted-foreground">PDF Viewer</p>
              <p className="text-xs text-muted-foreground">
                {pdf.totalPages} pages • {pdf.fileName}
              </p>
            </div>
          </Card>
          
          {selectedProblem && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-sm font-medium text-primary">Selected Problem</p>
              <p className="text-xs text-primary/80">
                Page {selectedProblem.pageNumber} • {selectedProblem.text.slice(0, 100)}...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Problems List */}
      <div className="w-1/2 p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-workspace-foreground">
                Detected Problems
              </h2>
              <p className="text-sm text-muted-foreground">
                {pdf.problems.length} problems found
              </p>
            </div>
            <Button onClick={onAcceptAll} className="bg-gradient-secondary">
              <Check className="w-4 h-4 mr-2" />
              Accept All
            </Button>
          </div>

          <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
            {pdf.problems.map((problem, index) => (
              <Card
                key={problem.id}
                className={`
                  p-4 cursor-pointer transition-all duration-200 hover:shadow-md
                  ${selectedProblem?.id === problem.id 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:border-primary/30'
                  }
                `}
                onClick={() => onProblemSelect(problem)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                        {index + 1}
                      </div>
                      <h3 className="font-medium text-sm">
                        {problem.title || `Problem ${index + 1}`}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        <Hash className="w-3 h-3 mr-1" />
                        Page {problem.pageNumber}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {problem.text.slice(0, 150)}...
                  </p>

                  {problem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {problem.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>Est. {Math.ceil(problem.text.length / 100)} min</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditProblem(problem);
                        }}
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSplitProblem(problem);
                        }}
                      >
                        <Split className="w-3 h-3" />
                      </Button>
                      {index < pdf.problems.length - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMergeProblems(problem, pdf.problems[index + 1]);
                          }}
                        >
                          <Merge className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="pt-4 border-t border-border">
            <Button 
              onClick={onAcceptAll} 
              className="w-full bg-gradient-primary"
              size="lg"
            >
              Continue with {pdf.problems.length} Problems
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};