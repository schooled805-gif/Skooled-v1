import React from 'react';
import { Link } from 'wouter';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useListApprovals, useListAnnouncements } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Clock, CheckSquare, Megaphone, ArrowRight, AlertCircle } from 'lucide-react';

export default function ParentDashboard() {
  const { user, profile } = useAuth();
  const { data: approvals, isLoading: loadingApprovals } = useListApprovals({ parent_id: user?.id });
  const { data: announcements, isLoading: loadingAnnouncements } = useListAnnouncements({ audience_type: 'parent' });

  const pending = (approvals ?? []).filter(a => a.status === 'pending');
  const recent = (announcements ?? []).slice(0, 4);

  const priorityColor = (p: string | null) =>
    ({ high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700' })[p ?? ''] ?? 'bg-gray-100 text-gray-600';

  return (
    <PortalLayout role="parent">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your children today.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-l-4 border-l-amber-400">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{loadingApprovals ? '–' : pending.length}</p>
                <p className="text-sm text-gray-500">Pending approvals</p>
              </div>
              <Link href="/parent/approvals" className="ml-auto">
                <Button size="sm" variant="outline" className="text-xs border-amber-200 text-amber-700 hover:bg-amber-50">
                  View <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-400">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <Megaphone className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{loadingAnnouncements ? '–' : (announcements?.length ?? 0)}</p>
                <p className="text-sm text-gray-500">Announcements</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Approvals */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-purple-600" /> Pending Approvals
              </CardTitle>
              <Link href="/parent/approvals">
                <span className="text-xs text-purple-600 hover:underline cursor-pointer">View all</span>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingApprovals ? (
                <div className="flex justify-center py-6"><Loader2 className="animate-spin h-5 w-5 text-purple-400" /></div>
              ) : pending.length === 0 ? (
                <div className="text-center py-6">
                  <CheckSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">All caught up — no pending approvals</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pending.slice(0, 4).map(a => (
                    <div key={a.id} className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.event_title ?? 'Event'}</p>
                        <p className="text-xs text-gray-400">{a.student_name}</p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">Pending</Badge>
                    </div>
                  ))}
                  {pending.length > 4 && (
                    <p className="text-xs text-gray-400 text-center pt-1">+{pending.length - 4} more</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Announcements */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-purple-600" /> Recent Announcements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAnnouncements ? (
                <div className="flex justify-center py-6"><Loader2 className="animate-spin h-5 w-5 text-purple-400" /></div>
              ) : recent.length === 0 ? (
                <div className="text-center py-6">
                  <Megaphone className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No announcements yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recent.map(a => (
                    <div key={a.id} className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                          {a.priority && <Badge className={`${priorityColor(a.priority)} text-xs hover:opacity-90 shrink-0`}>{a.priority}</Badge>}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>
                        {a.author_name && <p className="text-xs text-gray-400 mt-1">— {a.author_name}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Schedule', href: '/parent/schedule', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200' },
            { label: 'Approvals', href: '/parent/approvals', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' },
            { label: 'Messages', href: '/parent/messages', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' },
            { label: 'Reports', href: '/parent/reports', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className={`p-4 rounded-xl border text-sm font-medium text-center cursor-pointer transition-colors ${item.color}`}>
                {item.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
