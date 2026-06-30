import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, ExternalLink, Pencil, Trash2, Link2 } from 'lucide-react';

interface SchoolLink {
  id: string; label: string; url: string; category: string | null; sort_order: number | null;
}

async function apiFetch(url: string, token: string, options?: Omit<RequestInit, 'body'> & { body?: unknown }) {
  const { body, ...rest } = options ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(rest.headers ?? {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any)?.error ?? 'Request failed'); }
  if (res.status === 204) return null;
  return res.json();
}

const emptyForm = { label: '', url: '', category: 'uniform' };

export default function AdminSchoolLinks() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: links = [], isLoading } = useQuery<SchoolLink[]>({
    queryKey: ['school-links'],
    queryFn: () => apiFetch('/api/school-links', token),
    enabled: !!token,
  });

  const startCreate = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (l: SchoolLink) => {
    setEditId(l.id);
    setForm({ label: l.label, url: l.url, category: l.category ?? 'uniform' });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.url.trim()) { toast({ title: 'Title and URL are required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editId) await apiFetch(`/api/school-links/${editId}`, token, { method: 'PATCH', body: form });
      else await apiFetch('/api/school-links', token, { method: 'POST', body: form });
      toast({ title: editId ? 'Link updated' : 'Link added' });
      qc.invalidateQueries({ queryKey: ['school-links'] });
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Could not save', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch(`/api/school-links/${id}`, token, { method: 'DELETE' });
      qc.invalidateQueries({ queryKey: ['school-links'] });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">School Links</h1>
            <p className="text-gray-500 mt-1">Uniform shop and other external links for parents</p>
          </div>
          <Button onClick={startCreate} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-link">
            <Plus className="h-4 w-4 mr-2" /> Add Link
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>
        ) : !links.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">
            <Link2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No links yet</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {links.map((l) => (
              <Card key={l.id} data-testid={`card-link-${l.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-medium text-gray-900">{l.label}</p>
                    {l.category && <Badge variant="outline" className="text-xs shrink-0">{l.category}</Badge>}
                  </div>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline break-all">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {l.url}
                  </a>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => startEdit(l)} data-testid={`button-edit-${l.id}`}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => remove(l.id)} data-testid={`button-delete-${l.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edit Link' : 'Add Link'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Title</Label><Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} data-testid="input-title" /></div>
            <div className="space-y-1"><Label>URL</Label><Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…" data-testid="input-url" /></div>
            <div className="space-y-1">
              <Label>Category</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} data-testid="select-category">
                <option value="uniform">Uniform shop</option>
                <option value="books">Books</option>
                <option value="payments">Payments</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-link">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
