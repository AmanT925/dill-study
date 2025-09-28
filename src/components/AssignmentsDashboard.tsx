import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import firebaseService from '@/lib/firebaseService';

export const AssignmentsDashboard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // load initial incomplete assignments (client-side) — for demo we call fetchIncompleteAssignmentsAll
    (async () => {
      setLoading(true);
      try {
        const list = await firebaseService.fetchIncompleteAssignmentsAll();
        setAssignments(list as any[]);
      } catch (e) {
        console.error('Failed loading assignments', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreate = async () => {
    if (!email || !title || !dueAt) return alert('Email, title and due date are required');
    setLoading(true);
    try {
      const userId = await firebaseService.addOrGetUserByEmail(email);
      const res = await firebaseService.createAssignment({ title, dueAt: new Date(dueAt), studentId: userId, completed: false });
      setAssignments((s) => [{ id: res.id, title, dueAt, studentId: userId, completed: false }, ...s]);
      setTitle('');
      setEmail('');
      setDueAt('');
    } catch (e) {
      console.error('Create failed', e);
      alert('Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold">Create Assignment</h3>
        <div className="flex gap-2 mt-2">
          <Input placeholder="Student email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          <Button onClick={handleCreate} disabled={loading}>Create</Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold">Incomplete assignments</h3>
        <div className="mt-2 space-y-2">
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{a.title}</div>
                <div className="text-xs text-muted-foreground">Due: {a.dueAt ? (typeof a.dueAt === 'string' ? format(new Date(a.dueAt), 'Pp') : format(new Date(a.dueAt), 'Pp')) : 'unknown'}</div>
              </div>
              <div className="text-xs text-muted-foreground">{a.studentId}</div>
            </div>
          ))}
          {assignments.length === 0 && <div className="text-sm text-muted-foreground">No assignments</div>}
        </div>
      </Card>
    </div>
  );
};

export default AssignmentsDashboard;
