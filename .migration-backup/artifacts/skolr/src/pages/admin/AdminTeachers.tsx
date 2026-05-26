import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useListProfiles, getListProfilesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Plus, UserRound, Mail, Phone, Trash2, Copy, Check, BookOpen
} from 'lucide-react';

export default function AdminTeachers() {
  const { schoolId, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: teachers, isLoading } = useListProfiles(
    schoolId ? { role: 'teacher', school_id: schoolId } : { role: 'teacher' }
  );

  // Add teacher dialog (direct creation)
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const signupUrl = `${window.location.origin}/signup`;

  const handleCopy = () => {
    navigator.clipboard.writeText(signupUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdd = async () => {
    if (!form.full_name || !form.email) {
      toast({ title: 'Name and email are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id ?? '',
        },
        body: JSON.stringify({
          user_id: crypto.randomUUID(),
          role: 'teacher',
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || undefined,
          school_id: schoolId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create teacher');
      toast({ title: 'Teacher added', description: `${form.full_name} has been added. Share the signup link so they can activate their account.` });
      qc.invalidateQueries({ queryKey: getListProfilesQueryKey() });
      setAddOpen(false);
      setForm({ full_name: '', email: '', phone: '' });
    } catch {
      toast({ title: 'Failed to add teacher', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the school?`)) return;
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id ?? '' },
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Teacher removed' });
      qc.invalidateQueries({ queryKey: getListProfilesQueryKey() });
    } catch {
      toast({ title: 'Failed to remove teacher', variant: 'destructive' });
    }
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Teachers</h1>
            <p className="text-gray-500 mt-1">Manage teaching staff at your school</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(true)}>
              <Mail className="h-4 w-4 mr-2" /> Share Signup Link
            </Button>
            <Button onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-teacher">
              <Plus className="h-4 w-4 mr-2" /> Add Teacher
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : !teachers?.length ? (
          <Card>
            <CardContent className="py-16 text-center">
              <UserRound className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No teachers yet</p>
              <p className="text-gray-400 text-sm mt-1">Add teachers manually or share the signup link with your staff</p>
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add First Teacher
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map(teacher => (
              <Card key={teacher.id} className="hover:shadow-md transition-shadow" data-testid={`card-teacher-${teacher.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <span className="text-emerald-700 font-bold text-sm">
                          {teacher.full_name?.[0]?.toUpperCase() ?? 'T'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{teacher.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{teacher.email}</p>
                        {teacher.phone && <p className="text-xs text-gray-400">{teacher.phone}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">Teacher</Badge>
                      <button
                        onClick={() => handleDelete(teacher.id, teacher.full_name ?? 'teacher')}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        data-testid={`btn-delete-teacher-${teacher.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>No classes assigned yet</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Teacher Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Teacher</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              Add the teacher's details below. Share the signup link so they can activate their account and set their password.
            </div>
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Jane Smith"
                data-testid="input-teacher-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@school.edu"
                data-testid="input-teacher-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone <span className="text-gray-400 text-xs">(optional)</span></Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 000 0000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAdd}
              disabled={saving || !form.full_name || !form.email}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-save-teacher"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Add Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Teachers</DialogTitle></DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm text-gray-600">
              Share this link with your teachers. They can sign up, choose "Teacher" as their role, and join your school.
            </p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
              <code className="text-sm text-gray-700 flex-1 truncate">{signupUrl}</code>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              Teachers will appear in this list once they've signed up and selected your school.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setInviteOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
