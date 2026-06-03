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

export default function TeacherAnnouncements() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: announcements, isLoading } = useListAnnouncements();
  const create = useCreateAnnouncement();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', audience_type: 'class' });

  const handleCreate = () => {
    if (!schoolId) return;
    create.mutate({ data: { ...form, school_id: schoolId } }, {
      onSuccess: () => {
        toast({ title: 'Announcement posted' });
        qc.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
        setOpen(false);
        setForm({ title: '', body: '', audience_type: 'class' });
      },
      onError: () => toast({ title: 'Error', variant: 'destructive' }),
    });
  };

  return (
    <PortalLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Announcements</h1>
            <p className="text-gray-500 mt-1">Post updates to your class</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-new-announcement">
            <Plus className="h-4 w-4 mr-2" /> New Announcement
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-emerald-600" /></div>
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
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">{a.audience_type}</Badge>
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
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title" data-testid="input-title" />
            </div>
            <div className="space-y-1">
              <Label>Body</Label>
              <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your announcement..." data-testid="input-body" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-post-announcement">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
