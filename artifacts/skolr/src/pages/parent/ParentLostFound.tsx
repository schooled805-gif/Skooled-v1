import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useListParentStudentLinks } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { openProtectedFile } from '@/lib/viewFile';
import { Loader2, PackageSearch, Paperclip, Hand } from 'lucide-react';

interface LostFoundItem {
  id: string; title: string; description: string | null; category: string | null;
  photo_url: string | null; status: string; location_found: string | null; created_at: string | null;
}
interface EnrichedLink { id: string; student_id: string; student_name: string | null; }

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

export default function ParentLostFound() {
  const { user, session } = useAuth();
  const token = session?.access_token ?? '';
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: rawLinks } = useListParentStudentLinks({ parent_user_id: user?.id });
  const children = (rawLinks as unknown as EnrichedLink[]) ?? [];

  const [claimItem, setClaimItem] = useState<LostFoundItem | null>(null);
  const [studentId, setStudentId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: items = [], isLoading } = useQuery<LostFoundItem[]>({
    queryKey: ['lost-found'],
    queryFn: () => apiFetch('/api/lost-found', token),
    enabled: !!token,
  });

  const openClaim = (item: LostFoundItem) => {
    setClaimItem(item);
    setStudentId(children[0]?.student_id ?? '');
    setNote('');
  };

  const handleClaim = async () => {
    if (!claimItem) return;
    setSaving(true);
    try {
      await apiFetch(`/api/lost-found/${claimItem.id}/claim`, token, {
        method: 'POST',
        body: { claimed_student_id: studentId || undefined, claim_note: note || undefined },
      });
      toast({ title: 'Claim submitted', description: 'The school has been notified.' });
      qc.invalidateQueries({ queryKey: ['lost-found'] });
      setClaimItem(null);
    } catch (err: any) {
      toast({ title: 'Could not claim', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout role="parent">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Lost &amp; Found</h1>
          <p className="text-gray-500 mt-1">Browse found items and claim your child's belongings</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-purple-500" /></div>
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
                  {it.status === 'open' && (
                    <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700 mt-1" onClick={() => openClaim(it)} data-testid={`button-claim-${it.id}`}>
                      <Hand className="h-3.5 w-3.5 mr-1" /> This is ours
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!claimItem} onOpenChange={(o) => !o && setClaimItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Claim "{claimItem?.title}"</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Which child?</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={studentId} onChange={(e) => setStudentId(e.target.value)} data-testid="select-child">
                <option value="">Not sure / general</option>
                {children.map((c) => <option key={c.student_id} value={c.student_id}>{c.student_name ?? 'My child'}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Note <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Anything that helps the school identify this is yours…" data-testid="input-claim-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimItem(null)}>Cancel</Button>
            <Button onClick={handleClaim} disabled={saving} className="bg-purple-600 hover:bg-purple-700" data-testid="button-submit-claim">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
