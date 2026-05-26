import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useListApprovals } from '@workspace/api-client-react';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

const statusColor = (s: string) => ({ pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', declined: 'bg-red-100 text-red-700', expired: 'bg-gray-100 text-gray-500' })[s] ?? 'bg-gray-100 text-gray-600';
const statusIcon = (s: string) => {
  if (s === 'approved') return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  if (s === 'declined') return <XCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-amber-500" />;
};

export default function AdminApprovals() {
  const { data: approvals, isLoading } = useListApprovals();

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Approvals</h1>
          <p className="text-gray-500 mt-1">All consent requests across the school</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : !approvals?.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">No approvals</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {approvals.map(a => (
              <Card key={a.id} data-testid={`card-approval-${a.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  {statusIcon(a.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{a.event_title ?? 'Event'}</p>
                    <p className="text-sm text-gray-500">{a.student_name} — Parent: {a.parent_user_id?.slice(0, 8)}…</p>
                    {a.response_comment && <p className="text-xs text-gray-400 italic mt-1">"{a.response_comment}"</p>}
                  </div>
                  <Badge className={`${statusColor(a.status)} hover:opacity-90 text-xs`}>{a.status}</Badge>
                  {a.responded_at && <span className="text-xs text-gray-400">{new Date(a.responded_at).toLocaleDateString()}</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
