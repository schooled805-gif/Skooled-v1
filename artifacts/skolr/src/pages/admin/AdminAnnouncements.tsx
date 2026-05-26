import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useListAnnouncements, useCreateAnnouncement, getListAnnouncementsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Megaphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const priorityColor = (p: string | null) => ({ high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-600' })[p ?? ''] ?? 'bg-gray-100 text-gray-600';

export default function AdminAnnouncements() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: announcements, isLoading } = useListAnnouncements();
  const create = useCreateAnnouncement();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', audience_type: 'all', priority: 'medium' });

  const handleCreate = () => {
    if (!schoolId) return;
    create.mutate({ data: { ...form, school_id: schoolId } }, {
      onSuccess: () => {
        toast({ title: 'Announcement published' });
        qc.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
        setOpen(false);
        setForm({ title: '', body: '', audience_type: 'all', priority: 'medium' });
      },
      onError: () => toast({ title: 'Error', variant: 'destructive' }),
    });
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Announcements</h1>
            <p className="text-gray-500 mt-1">Publish school-wide announcements</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-announcement">
            <Plus className="h-4 w-4 mr-2" /> New Announcement
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : !announcements?.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">
            <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No announcements yet</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {announcements.map(a => (
              <Card key={a.id} data-testid={`card-announcement-${a.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <div className="flex gap-2 shrink-0">
                      {a.priority && <Badge className={`${priorityColor(a.priority)} hover:opacity-90 text-xs`}>{a.priority}</Badge>}
                      <Badge variant="outline" className="text-xs">{a.audience_type}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{a.body}</p>
                  {a.author_name && <p className="text-xs text-gray-400 mt-2">Posted by {a.author_name}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} data-testid="input-title" /></div>
            <div className="space-y-1"><Label>Body</Label><Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} data-testid="input-body" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Audience</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.audience_type} onChange={e => setForm(f => ({ ...f, audience_type: e.target.value }))} data-testid="select-audience">
                  <option value="all">All</option>
                  <option value="parent">Parents</option>
                  <option value="teacher">Teachers</option>
                  <option value="student">Students</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} data-testid="select-priority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending} className="bg-blue-600 hover:bg-blue-700" data-testid="button-publish-announcement">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
