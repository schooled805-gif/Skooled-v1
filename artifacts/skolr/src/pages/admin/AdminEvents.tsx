import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useListEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, getListEventsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Calendar, MapPin, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const typeColor = (t: string) => ({ sport: 'bg-emerald-100 text-emerald-700', exam: 'bg-red-100 text-red-700', event: 'bg-blue-100 text-blue-700' })[t] ?? 'bg-gray-100 text-gray-600';

const emptyForm = { title: '', description: '', event_type: 'event', start_datetime: '', end_datetime: '', location: '', audience: 'school', requires_approval: false };

// "2026-06-08T14:30:00.000Z" / ISO → value usable by <input type="datetime-local">
const toLocalInput = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function AdminEvents() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: events, isLoading } = useListEvents();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const del = useDeleteEvent();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListEventsQueryKey() });

  const openCreate = () => { setEditId(null); setForm(emptyForm); setOpen(true); };

  const openEdit = (e: NonNullable<typeof events>[number]) => {
    setEditId(e.id);
    setForm({
      title: e.title,
      description: e.description ?? '',
      event_type: e.event_type ?? 'event',
      start_datetime: toLocalInput(e.start_datetime),
      end_datetime: toLocalInput(e.end_datetime),
      location: e.location ?? '',
      audience: e.audience ?? 'school',
      requires_approval: e.requires_approval ?? false,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!schoolId) return;
    if (editId) {
      update.mutate({ id: editId, data: {
        title: form.title,
        description: form.description,
        event_type: form.event_type,
        start_datetime: form.start_datetime,
        end_datetime: form.end_datetime || undefined,
        location: form.location,
        audience: form.audience,
        requires_approval: form.requires_approval,
      } }, {
        onSuccess: () => { toast({ title: 'Event updated' }); invalidate(); setOpen(false); },
        onError: () => toast({ title: 'Error', variant: 'destructive' }),
      });
    } else {
      create.mutate({ data: { ...form, school_id: schoolId } }, {
        onSuccess: () => { toast({ title: 'Event created' }); invalidate(); setOpen(false); },
        onError: () => toast({ title: 'Error', variant: 'destructive' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    del.mutate({ id: deleteId }, {
      onSuccess: () => { toast({ title: 'Event deleted' }); invalidate(); setDeleteId(null); },
      onError: () => { toast({ title: 'Error', variant: 'destructive' }); setDeleteId(null); },
    });
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Events</h1>
            <p className="text-gray-500 mt-1">School events and sports fixtures</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-event">
            <Plus className="h-4 w-4 mr-2" /> New Event
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : !events?.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">No events yet</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {events.map(e => (
              <Card key={e.id} className="hover:shadow-sm transition-shadow" data-testid={`card-event-${e.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{e.title}</p>
                      <Badge className={`${typeColor(e.event_type)} text-xs hover:opacity-90`}>{e.event_type}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400 mt-0.5">
                      <span>{new Date(e.start_datetime).toLocaleString()}</span>
                      {e.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                    </div>
                  </div>
                  {e.requires_approval && <Badge variant="outline" className="text-xs">Requires approval</Badge>}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => openEdit(e)} data-testid={`button-edit-event-${e.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => setDeleteId(e.id)} data-testid={`button-delete-event-${e.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Event' : 'New Event'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} data-testid="input-event-title" /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="input-event-description" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Start</Label><Input type="datetime-local" value={form.start_datetime} onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))} data-testid="input-start-datetime" /></div>
              <div className="space-y-1"><Label>End</Label><Input type="datetime-local" value={form.end_datetime} onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))} data-testid="input-end-datetime" /></div>
            </div>
            <div className="space-y-1"><Label>Location</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} data-testid="input-location" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))} data-testid="select-event-type">
                  <option value="event">Event</option>
                  <option value="sport">Sport</option>
                  <option value="exam">Exam</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Audience</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} data-testid="select-audience">
                  <option value="school">School</option>
                  <option value="grade">Grade</option>
                  <option value="class">Class</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending || !form.title.trim() || !form.start_datetime} className="bg-blue-600 hover:bg-blue-700" data-testid="button-create-event">
              {(create.isPending || update.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : (editId ? 'Save changes' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the event for everyone at your school. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={del.isPending} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-delete-event">
              {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}
