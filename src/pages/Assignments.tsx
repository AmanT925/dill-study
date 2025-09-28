import React from 'react';
import AssignmentsDashboard from '@/components/AssignmentsDashboard';

export default function AssignmentsPage() {
  return (
    <div className="max-w-5xl mx-auto py-6">
      <h2 className="text-2xl font-bold mb-4">Assignments</h2>
      <AssignmentsDashboard />
    </div>
  );
}
