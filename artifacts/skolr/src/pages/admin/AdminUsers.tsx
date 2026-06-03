import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useListProfiles, useCreateProfile, getListProfilesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Search, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-blue-100 text-blue-700',
  teacher: 'bg-emerald-100 text-emerald-700',
  parent: 'bg-purple-100 text-purple-700',
  student: 'bg-orange-100 text-orange-700',
};

export default function AdminUsers() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profiles, isLoading } = useListProfiles(schoolId ? { school_id: schoolId } : undefined);
  const create = useCreateProfile();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', role: 'teacher', user_id: '', phone: '' });

  const filtered = (profiles ?? []).filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!schoolId) return;
    create.mutate({ data: { ...form, school_id: schoolId } }, {
      onSuccess: () => {
        toast({ title: 'User profile created' });
        qc.invalidateQueries({ queryKey: getListProfilesQueryKey() });
        setOpen(false);
        setForm({ full_name: '', email: '', role: 'teacher', user_id: '', phone: '' });
      },
      onError: (err: any) => {
        const msg: string =
          err?.response?.data?.error ??
          err?.message ??
          'Failed to create user';
        toast({ title: 'Could not create user', description: msg, variant: 'destructive' });
      },
    });
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Users</h1>
            <p className="text-gray-500 mt-1">Manage all user profiles and roles</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-user">
            <Plus className="h-4 w-4 mr-2" /> Add User
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" /> All Users
                <Badge variant="outline" className="ml-1">{filtered.length}</Badge>
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-9 w-60"
                  placeholder="Search name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-search-users"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-blue-600" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{search ? 'No results found' : 'No users yet'}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(profile => (
                    <TableRow key={profile.id} data-testid={`row-user-${profile.id}`}>
                      <TableCell className="pl-6 font-medium">{profile.full_name}</TableCell>
                      <TableCell className="text-gray-500">{profile.email}</TableCell>
                      <TableCell>
                        <Badge className={`${ROLE_COLORS[profile.role] ?? 'bg-gray-100 text-gray-600'} hover:opacity-90`}>{profile.role}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">{profile.phone ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add User Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Jane Smith" data-testid="input-full-name" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@school.ac" data-testid="input-email" />
            </div>
            <div className="space-y-1">
              <Label>Supabase User ID</Label>
              <Input value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} placeholder="UUID from Supabase Auth" data-testid="input-user-id" />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                data-testid="select-role"
              >
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
                <option value="student">Student</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Phone (optional)</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" data-testid="input-phone" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending} className="bg-blue-600 hover:bg-blue-700" data-testid="button-create-user">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
