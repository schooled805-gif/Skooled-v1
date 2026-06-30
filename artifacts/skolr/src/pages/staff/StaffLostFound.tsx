import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/lib/uploadFile';
import { openProtectedFile } from '@/lib/viewFile';
import { Loader2, Plus, PackageSearch, Paperclip, X, Check, Trash2 } from 'lucide-react';

interface LostFoundItem {
  id: string; title: string; description: string | null; category: string | null;
  photo_url: string | null; status: string; location_found: string | null;
  posted_by_name: string | null; claimed_by_name: string | null; claim_note: string | null;
  created_at: string | null;
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

const statusColor = (s: string) => ({ open: 'bg-blue-100 text-blue-700', claimed: 'bg-amber-100 text-amber-700', resolved: 'bg-emerald-100 text-emerald-700' } as Record<string, string>)[s] ?? 'bg-gray-100 text-gray-600';

export default function StaffLostFound({ role }: { role: 'admin' | 'teacher' }) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'clothing', location_found: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: items = [], isLoading } = useQuery<LostFoundItem[]>({
    queryKey: ['lost-found'],
    queryFn: () => apiFetch('/api/lost-found', token),
    enabled: !!token,
  });

  const handleCreate = async () => {
    if (!form.title.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      let photo_url: string | undefined;
      if (photo) photo_url = (await uploadFile(photo)).url;
      await apiFetch('/api/lost-found', token, { method: 'POST', body: { ...form, photo_url } });
      toast({ title: 'Item posted' });
      qc.invalidateQueries({ queryKey: ['lost-found'] });
      setOpen(false);
      setForm({ title: '', description: '', category: 'clothing', location_found: '' });
      setPhoto(null);
    } catch (err: any) {
      toast({ title: 'Could not post item', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/lost-found/${id}`, token, { method: 'PATCH', body: { status } });
      qc.invalidateQueries({ queryKey: ['lost-found'] });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.message, variant: 'destructive' });
    }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch(`/api/lost-found/${id}`, token, { method: 'DELETE' });
      qc.invalidateQueries({ queryKey: ['lost-found'] });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err?.message, variant: 'destructive' });
    }
  };

  const accent = role === 'admin' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700';

  return (
    <PortalLayout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Lost &amp; Found</h1>
            <p className="text-gray-500 mt-1">Post found items so parents can claim them</p>
          </div>
          <Button onClick={() => setOpen(true)} className={accent} data-testid="button-new-item">
            <Plus className="h-4 w-4 mr-2" /> Post Item
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-gray-400" /></div>
        ) : !items.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">
            <PackageSearch className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No items posted yet</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <Card key={it.id} data-testid={`card-item-${it.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-medium text-gray-900">{it.title}</p>
                    <Badge className={`${statusColor(it.status)} text-xs shrink-0`}>{it.status}</Badge>
                  </div>
                  {it.category && <Badge variant="outline" className="text-xs">{it.category}</Badge>}
                  {it.description && <p className="text-sm text-gray-600">{it.description}</p>}
                  {it.location_found && <p className="text-xs text-gray-400">Found: {it.location_found}</p>}
                  {it.photo_url && (
                    <button type="button" onClick={() => openProtectedFile(it.photo_url!)} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                      <Paperclip className="h-3.5 w-3.5" /> View photo
                    </button>
                  )}
                  {it.status === 'claimed' && it.claimed_by_name && (
                    <p className="text-xs text-amber-700">Claimed by {it.claimed_by_name}{it.claim_note ? ` — "${it.claim_note}"` : ''}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    {it.status !== 'resolved' && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(it.id, 'resolved')} data-testid={`button-resolve-${it.id}`}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Resolve
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => remove(it.id)} data-testid={`button-delete-${it.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Post Found Item</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} data-testid="input-title" /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} data-testid="input-description" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} data-testid="select-category">
                  <option value="clothing">Clothing</option>
                  <option value="electronics">Electronics</option>
                  <option value="stationery">Stationery</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1"><Label>Location found</Label><Input value={form.location_found} onChange={(e) => setForm((f) => ({ ...f, location_found: e.target.value }))} data-testid="input-location" /></div>
            </div>
            <div className="space-y-1">
              <Label>Photo <span className="text-gray-400 font-normal">(optional)</span></Label>
              {photo ? (
                <div className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 bg-gray-50">
                  <Paperclip className="h-4 w-4 text-gray-500 shrink-0" />
                  <span className="truncate flex-1">{photo.name}</span>
                  <button type="button" onClick={() => setPhoto(null)} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <Input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} data-testid="input-photo" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className={accent} data-testid="button-post-item">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
