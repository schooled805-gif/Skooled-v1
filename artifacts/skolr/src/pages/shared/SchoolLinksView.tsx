import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ExternalLink, ShoppingBag } from 'lucide-react';

interface SchoolLink {
  id: string; label: string; url: string; category: string | null; sort_order: number | null;
}

async function apiFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any)?.error ?? 'Request failed'); }
  return res.json();
}

export default function SchoolLinksView({ role }: { role: 'parent' | 'teacher' }) {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  const { data: links = [], isLoading } = useQuery<SchoolLink[]>({
    queryKey: ['school-links'],
    queryFn: () => apiFetch('/api/school-links', token),
    enabled: !!token,
  });

  const accent = role === 'parent' ? 'text-purple-600' : 'text-emerald-600';

  return (
    <PortalLayout role={role}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Shop &amp; Links</h1>
          <p className="text-gray-500 mt-1">Uniform shop and other useful links from the school</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-gray-400" /></div>
        ) : !links.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">
            <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No links available yet</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {links.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="block" data-testid={`link-${l.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <p className={`font-medium ${accent} inline-flex items-center gap-1.5`}>{l.label} <ExternalLink className="h-3.5 w-3.5" /></p>
                      {l.category && <Badge variant="outline" className="text-xs shrink-0">{l.category}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
