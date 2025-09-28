import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Check, 
  Edit3, 
  ChevronRight,
  Clock,
  Hash,
  Trash
} from 'lucide-react';
import { ParsedPDF, Problem, useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useEffect, useState } from 'react';
import { PDFViewer } from '@/components/PDFViewer';

interface ProblemParsingPreviewProps {
  pdf: ParsedPDF;
  selectedProblem: Problem | null;
  onProblemSelect: (problem: Problem) => void;
  onEditProblem: (problem: Problem) => void;
  onAcceptAll: () => void;
}

export const ProblemParsingPreview: React.FC<ProblemParsingPreviewProps> = ({
  pdf,
  selectedProblem,
  onProblemSelect,
  onEditProblem,
  onAcceptAll
}) => {
  const updateProblem = useStore((s) => s.updateProblem);
  const setPDF = useStore((s) => s.setPDF);
  const currentPDF = useStore((s) => s.currentPDF);
  const currentProblem = useStore((s) => s.currentProblem);
  const setCurrentProblem = useStore((s) => s.setCurrentProblem);
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const startEditing = (p: Problem) => {
    setEditingId(p.id);
    setEditingValue(p.text);
  };

  const saveEditing = (id: string) => {
    updateProblem(id, { text: editingValue });
    setEditingId(null);
    toast({ title: 'Saved', description: 'Problem text updated.' });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleDeleteProblem = (id: string) => {
    if (!currentPDF) return;
    const index = currentPDF.problems.findIndex(p => p.id === id);
    if (index === -1) return;
    const deleted = currentPDF.problems[index];
    const remaining = currentPDF.problems.filter(p => p.id !== id);

    setPDF({ ...currentPDF, problems: remaining });
    if (currentProblem?.id === id) setCurrentProblem(null);

    const t = toast({
      title: 'Deleted',
      description: 'Problem removed.',
      action: (
        <Button
          size="sm"
          onClick={() => {
            // restore problem at original index
            const restored = [...(useStore.getState().currentPDF?.problems || [])];
            restored.splice(index, 0, deleted);
            const pdfState = useStore.getState().currentPDF;
            if (!pdfState) return;
            useStore.getState().setPDF({ ...pdfState, problems: restored });
            // restore currentProblem if needed
            useStore.getState().setCurrentProblem(deleted);
            // dismiss the toast immediately
            t.dismiss();
          }}
        >
          Undo
        </Button>
      ),
    });

    // auto-dismiss after 3 seconds
    setTimeout(() => {
      t.dismiss();
    }, 3000);
  };
  return (
    <div className="flex h-screen bg-workspace">
      {/* Left side - PDF Preview */}
      <div className="w-1/2 border-r border-border p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between pr-1">
          <div>
            <h2 className="text-lg font-semibold text-workspace-foreground">PDF Preview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{pdf.totalPages} pages • {pdf.fileName}</p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <PDFViewer 
            fileUrl={pdf.fileUrl}
            totalPages={pdf.totalPages}
            highlightPage={selectedProblem?.pageNumber}
            className="h-full"
          />
        </div>

        {/* selected problem preview removed */}
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

                  {editingId === problem.id ? (
                    <textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="w-full h-20 rounded border p-2 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {problem.text.slice(0, 150)}...
                    </p>
                  )}

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
                      {editingId === problem.id ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); cancelEditing(); }}>Cancel</Button>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEditing(problem.id); }} className="bg-primary text-primary-foreground">Save</Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(problem);
                            }}
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleDeleteProblem(problem.id); }}
                            className="text-destructive"
                            aria-label="Delete problem"
                          >
                            <Trash className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      {/* Split and Merge controls intentionally removed */}
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

// Small inline editor for a problem's text
const ProblemTextEditor: React.FC<{ problem: Problem }> = ({ problem }) => {
  const updateProblem = useStore((s) => s.updateProblem);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(problem.text);

  useEffect(() => {
    setValue(problem.text);
  }, [problem.id]);

  const save = () => {
    updateProblem(problem.id, { text: value });
    setEditing(false);
    toast({ title: 'Saved', description: 'Problem text updated.' });
  };

  const cancel = () => {
    setValue(problem.text);
    setEditing(false);
  };

  return (
    <div className="mt-2">
      {!editing ? (
        <div>
          <p className="text-xs text-primary/80 mt-1 line-clamp-2">{problem.text}</p>
          <div className="mt-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full h-28 rounded border p-2 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} className="bg-primary text-primary-foreground">Save</Button>
            <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};