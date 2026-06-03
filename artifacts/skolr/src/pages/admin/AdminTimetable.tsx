import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useListTimetableEntries, useCreateTimetableEntry, useDeleteTimetableEntry, getListTimetableEntriesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Trash2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function AdminTimetable() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: entries, isLoading } = useListTimetableEntries();
  const create = useCreateTimetableEntry();
  const del = useDeleteTimetableEntry();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ class_id: '', subject_id: '', teacher_id: '', day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', room: '', type: 'lesson' });

  const handleCreate = () => {
    if (!schoolId) return;
    create.mutate({ data: { ...form, school_id: schoolId } }, {
      onSuccess: () => {
        toast({ title: 'Timetable entry added' });
        qc.invalidateQueries({ queryKey: getListTimetableEntriesQueryKey() });
        setOpen(false);
      },
      onError: () => toast({ title: 'Error', variant: 'destructive' }),
    });
  };

  const handleDelete = (id: string) => {
    del.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Entry removed' });
        qc.invalidateQueries({ queryKey: getListTimetableEntriesQueryKey() });
      },
    });
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Timetable</h1>
            <p className="text-gray-500 mt-1">Manage the school timetable</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-entry">
            <Plus className="h-4 w-4 mr-2" /> Add Entry
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : (
          <div className="grid gap-4">
            {DAYS.map(day => {
              const dayEntries = (entries ?? []).filter(e => e.day_of_week?.toLowerCase() === day.toLowerCase());
              return (
                <Card key={day}>
                  <div className="px-4 py-2 border-b bg-blue-50">
                    <span className="font-semibold text-blue-700 text-sm">{day}</span>
                  </div>
                  <CardContent className="p-0">
                    {dayEntries.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">No entries</p>
                    ) : dayEntries.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(entry => (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50">
                        <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="text-sm text-gray-500 w-24 shrink-0">{entry.start_time}–{entry.end_time}</span>
                        <span className="font-medium text-sm text-gray-900 flex-1">{entry.subject_name ?? entry.subject_id}</span>
                        <span className="text-sm text-gray-500">{entry.class_name ?? entry.class_id}</span>
                        {entry.room && <Badge variant="outline" className="text-xs">Room {entry.room}</Badge>}
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">{entry.type}</Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => handleDelete(entry.id)} data-testid={`button-delete-${entry.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Timetable Entry</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Subject ID</Label><Input value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))} data-testid="input-subject-id" /></div>
              <div className="space-y-1"><Label>Class ID</Label><Input value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))} data-testid="input-class-id" /></div>
            </div>
            <div className="space-y-1"><Label>Teacher ID</Label><Input value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))} data-testid="input-teacher-id" /></div>
            <div className="space-y-1">
              <Label>Day</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))} data-testid="select-day">
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Start Time</Label><Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></div>
              <div className="space-y-1"><Label>End Time</Label><Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Room</Label><Input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label>Type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="lesson">Lesson</option>
                  <option value="sport">Sport</option>
                  <option value="exam">Exam</option>
                  <option value="event">Event</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-entry">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
