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
import { Problem } from '@/lib/store';

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

  const handleHintRequest = (level: number) => {
    onRequestHint(level);
  };

  const handleSubmitAttempt = () => {
    if (currentAttempt.trim()) {
      onSubmitAttempt(currentAttempt);
      setCurrentAttempt('');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-gradient-secondary';
      case 'attempted': return 'bg-gradient-accent';
      case 'in-progress': return 'bg-gradient-primary';
      default: return 'bg-muted';
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
                {problem.title || 'Problem'}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">Page {problem.pageNumber}</Badge>
                <Badge className={getStatusColor(problem.status)}>
                  {problem.status.replace('-', ' ')}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{Math.floor(problem.timeSpent / 60)}min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {problem.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {problem.tags.map((tag) => (
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
            <FileText className="w-12 h-12 mx-auto" />
            <p className="text-sm text-muted-foreground">PDF Viewer</p>
            <p className="text-xs text-muted-foreground">
              Problem highlighted on page {problem.pageNumber}
            </p>
          </div>
        </Card>

        {/* Editable Problem Text */}
        <Card className="p-4">
          <div className="space-y-3">
            <h3 className="font-medium text-workspace-foreground">Problem Text</h3>
            <Textarea
              value={problem.text}
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
                {problem.hintsUsed}/3
              </span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`
                    flex-1 h-2 rounded-full
                    ${level <= problem.hintsUsed 
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
            disabled={problem.hintsUsed >= 1}
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Hint 1: Concept Review
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleHintRequest(2)}
            disabled={problem.hintsUsed >= 2}
          >
            <Target className="w-4 h-4 mr-2" />
            Hint 2: Next Step
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleHintRequest(3)}
            disabled={problem.hintsUsed >= 3}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Hint 3: Near Solution
          </Button>
        </div>

        {/* Chat/Message Area */}
        <Card className="flex-1 p-4 mb-4">
          <div className="space-y-4 h-full overflow-y-auto">
            {problem.attempts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Click a hint button to get started, or describe your approach below</p>
              </div>
            ) : (
              <div className="space-y-3">
                {problem.attempts.map((attempt, index) => (
                  <div key={index} className="bg-muted/30 rounded-lg p-3">
                    <p className="text-sm">{attempt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

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
                placeholder="Describe your approach or ask for help..."
                className="min-h-[80px] resize-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSubmitAttempt}
                  disabled={!currentAttempt.trim()}
                  className="flex-1 bg-gradient-primary"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Step
                </Button>
                <Button variant="outline">
                  Save & Continue
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};