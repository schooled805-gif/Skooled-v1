import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useListApprovals } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, CheckCircle, XCircle, Clock, Users, ShieldCheck,
  UserCheck, UserX, BookOpen, Shield,
} from 'lucide-react';

const statusColor = (s: string) =>
  ({ pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', declined: 'bg-red-100 text-red-700', expired: 'bg-gray-100 text-gray-500' })[s] ?? 'bg-gray-100 text-gray-600';

const statusIcon = (s: string) => {
  if (s === 'approved') return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  if (s === 'declined') return <XCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-amber-500" />;
};

const roleIcon = (role: string) => {
  if (role === 'teacher') return <BookOpen className="h-4 w-4 text-emerald-600" />;
  if (role === 'admin') return <Shield className="h-4 w-4 text-blue-600" />;
  return <Users className="h-4 w-4 text-purple-600" />;
};

interface PendingProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string | null;
}

export default function AdminApprovals() {
  const { data: approvals, isLoading: approvalsLoading } = useListApprovals();
  const { session, schoolId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'members' | 'events'>('members');

  const token = session?.access_token ?? '';

  const { data: pending = [], isLoading: pendingLoading } = useQuery<PendingProfile[]>({
    queryKey: ['pending-members', schoolId],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/pending?school_id=${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    enabled: !!schoolId && !!token,
  });

  const approveMember = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const res = await fetch(`/api/profiles/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['pending-members', schoolId] });
      toast({
        title: status === 'approved' ? 'Member approved' : 'Request rejected',
        description: status === 'approved'
          ? 'They can now sign in to their portal.'
          : 'The request has been declined.',
      });
    },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  });

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Approvals</h1>
          <p className="text-gray-500 mt-1">Member requests and event consent forms</p>
        </div>

        <div className="flex gap-2 border-b border-gray-200">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'members' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('members')}
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Member Requests
              {pending.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
                  {pending.length}
                </span>
              )}
            </span>
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'events' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('events')}
          >
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Event Consents
            </span>
          </button>
        </div>

        {tab === 'members' && (
          <div className="space-y-3">
            {pendingLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
            ) : pending.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <UserCheck className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No pending requests</p>
                  <p className="text-sm text-gray-400 mt-1">New teachers and parents will appear here when they sign up</p>
                </CardContent>
              </Card>
            ) : (
              pending.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 font-bold text-gray-600">
                      {p.full_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{p.full_name}</p>
                        <span className="flex items-center gap-1 text-xs text-gray-500 capitalize">
                          {roleIcon(p.role)}{p.role}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{p.email}</p>
                      {p.created_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Requested {new Date(p.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                        disabled={approveMember.isPending}
                        onClick={() => approveMember.mutate({ id: p.id, status: 'rejected' })}
                      >
                        <UserX className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                        disabled={approveMember.isPending}
                        onClick={() => approveMember.mutate({ id: p.id, status: 'approved' })}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'events' && (
          <div className="space-y-3">
            {approvalsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
            ) : !approvals?.length ? (
              <Card><CardContent className="py-12 text-center text-gray-400">No consent forms yet</CardContent></Card>
            ) : (
              approvals.map(a => (
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
              ))
            )}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
