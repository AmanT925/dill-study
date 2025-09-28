import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Clock, 
  Target, 
  CheckCircle, 
  AlertCircle,
  BookOpen,
  Plus,
  Filter
} from 'lucide-react';
import { ParsedPDF, Problem } from '@/lib/store';

interface DashboardProps {
  pdf: ParsedPDF;
  onProblemSelect: (problem: Problem) => void;
  onNewUpload: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  pdf,
  onProblemSelect,
  onNewUpload
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in-progress': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'not-started': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
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

  const filteredProblems = pdf.problems.filter(problem => {
    const matchesSearch = problem.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         problem.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         problem.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filterStatus === 'all' || problem.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const statusCounts = {
    total: pdf.problems.length,
    completed: pdf.problems.filter(p => p.status === 'completed').length,
    attempted: pdf.problems.filter(p => p.status === 'attempted').length,
    inProgress: pdf.problems.filter(p => p.status === 'in-progress').length,
    notStarted: pdf.problems.filter(p => p.status === 'not-started').length,
  };

  return (
    <div className="min-h-screen bg-gradient-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Problem Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              {pdf.fileName} • {pdf.problems.length} problems
            </p>
          </div>
          <Button onClick={onNewUpload} className="bg-gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            New PDF
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Problems</p>
                <p className="text-2xl font-bold">{statusCounts.total}</p>
              </div>
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-progress">{statusCounts.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-primary">{statusCounts.inProgress}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Not Started</p>
                <p className="text-2xl font-bold text-muted-foreground">{statusCounts.notStarted}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search problems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setFilterStatus('all')}
              size="sm"
              className={filterStatus === 'all' ? 'bg-muted ring-1 ring-muted/40 shadow-sm' : ''}
            >
              <span className="text-black">All</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setFilterStatus('not-started')}
              size="sm"
              className={filterStatus === 'not-started' ? 'bg-red-50 ring-1 ring-red-100 shadow-sm' : ''}
            >
              <span className="w-2 h-2 rounded-full mr-2 bg-red-600" aria-hidden="true" />
              <span className="text-black">Not Started</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setFilterStatus('in-progress')}
              size="sm"
              className={filterStatus === 'in-progress' ? 'bg-yellow-50 ring-1 ring-yellow-100 shadow-sm' : ''}
            >
              <span className="w-2 h-2 rounded-full mr-2 bg-yellow-500" aria-hidden="true" />
              <span className="text-black">In Progress</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setFilterStatus('completed')}
              size="sm"
              className={filterStatus === 'completed' ? 'bg-green-50 ring-1 ring-green-100 shadow-sm' : ''}
            >
              <span className="w-2 h-2 rounded-full mr-2 bg-green-600" aria-hidden="true" />
              <span className="text-black">Completed</span>
            </Button>
          </div>
        </div>

        {/* Problems Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProblems.map((problem, index) => (
            <Card
              key={problem.id}
              className="p-4 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
              onClick={() => onProblemSelect(problem)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">
                        {problem.title || `Problem ${index + 1}`}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Page {problem.pageNumber}
                      </p>
                    </div>
                  </div>
                  {getStatusIcon(problem.status)}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-3">
                  {problem.text.slice(0, 120)}...
                </p>

                {problem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                    {problem.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="muted" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {problem.tags.length > 2 && (
                      <Badge variant="muted" className="text-xs">
                        +{problem.tags.length - 2} more
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1" title={problem.timeSpent > 0 ? `${Math.floor(problem.timeSpent/60)} min spent` : 'Estimated time'}>
                      <Clock className="w-3 h-3" />
                      {problem.timeSpent > 0
                        ? `${Math.floor(problem.timeSpent / 60)}/${problem.estimatedMinutes ?? '?'}`
                        : `${problem.estimatedMinutes ?? '?'} min`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {problem.hintsUsed}/3 hints
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredProblems.length === 0 && (
          <Card className="p-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No problems found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search query or filter settings
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};