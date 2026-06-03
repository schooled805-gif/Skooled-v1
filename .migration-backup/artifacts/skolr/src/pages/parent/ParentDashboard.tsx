import React, { useState } from 'react';
import { Link } from 'wouter';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useListApprovals, useListAnnouncements, useListParentStudentLinks } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckSquare, Megaphone, ArrowRight, AlertCircle, GraduationCap, BookOpen, FileText, MessageSquare, Calendar, X } from 'lucide-react';

interface EnrichedLink {
  id: string;
  student_id: string;
  student_name: string | null;
  student_grade: string | null;
  student_number: string | null;
}

export default function ParentDashboard() {
  const { user, profile } = useAuth();
  const { data: approvals, isLoading: loadingApprovals } = useListApprovals({ parent_id: user?.id });
  const { data: announcements, isLoading: loadingAnnouncements } = useListAnnouncements({ audience_type: 'parent' });
  const { data: rawLinks, isLoading: loadingLinks } = useListParentStudentLinks({ parent_user_id: user?.id });

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  const links = (rawLinks as unknown as EnrichedLink[]) ?? [];
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

        {/* My Children */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-purple-500" /> My Children
          </h2>
          {loadingLinks ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin h-5 w-5 text-purple-400" /></div>
          ) : links.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-400">
                <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No children linked yet.</p>
                <p className="text-xs mt-1">Contact the school admin to link your children to your account.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {links.map(link => (
                <Card key={link.id} className="border-l-4 border-l-purple-400 hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                        <span className="text-purple-700 font-bold">
                          {link.student_name?.[0]?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{link.student_name ?? 'Unknown'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {link.student_grade && <Badge variant="outline" className="text-xs">{link.student_grade}</Badge>}
                          {link.student_number && <span className="text-xs text-gray-400 font-mono">{link.student_number}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Link href="/parent/schedule">
                        <button className="w-full p-2.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium flex items-center gap-1.5 transition-colors">
                          <Calendar className="h-3.5 w-3.5" /> Schedule
                        </button>
                      </Link>
                      <Link href="/parent/reports">
                        <button className="w-full p-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium flex items-center gap-1.5 transition-colors">
                          <FileText className="h-3.5 w-3.5" /> Reports
                        </button>
                      </Link>
                      <Link href="/parent/messages">
                        <button className="w-full p-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium flex items-center gap-1.5 transition-colors">
                          <MessageSquare className="h-3.5 w-3.5" /> Message
                        </button>
                      </Link>
                      <Link href="/parent/approvals">
                        <button className="w-full p-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium flex items-center gap-1.5 transition-colors">
                          <CheckSquare className="h-3.5 w-3.5" /> Approvals
                        </button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          <Card className="border-l-4 border-l-blue-400">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{links.length}</p>
                <p className="text-sm text-gray-500">Children linked</p>
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
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{(a as any).event_title ?? 'Event'}</p>
                        <p className="text-xs text-gray-400">{(a as any).student_name}</p>
                      </div>
                      <Link href="/parent/approvals">
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs cursor-pointer">Respond</Badge>
                      </Link>
                    </div>
                  ))}
                  {pending.length > 4 && <p className="text-xs text-gray-400 text-center pt-1">+{pending.length - 4} more</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Announcements */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-purple-600" /> School Announcements
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
                    <button
                      key={a.id}
                      onClick={() => setSelectedAnnouncement(a)}
                      className="w-full text-left flex gap-3 pb-3 border-b last:border-b-0 last:pb-0 hover:bg-purple-50 rounded-lg px-2 -mx-2 transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                          {(a as any).priority && (
                            <Badge className={`${priorityColor((a as any).priority)} text-xs hover:opacity-90 shrink-0`}>
                              {(a as any).priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>
                        {(a as any).author_name && <p className="text-xs text-gray-400 mt-1">— {(a as any).author_name}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Schedule', href: '/parent/schedule', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200', icon: <Calendar className="h-4 w-4 mr-2" /> },
            { label: 'Approvals', href: '/parent/approvals', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200', icon: <CheckSquare className="h-4 w-4 mr-2" /> },
            { label: 'Messages', href: '/parent/messages', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200', icon: <MessageSquare className="h-4 w-4 mr-2" /> },
            { label: 'Reports', href: '/parent/reports', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200', icon: <FileText className="h-4 w-4 mr-2" /> },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className={`p-4 rounded-xl border text-sm font-medium text-center cursor-pointer transition-colors flex items-center justify-center ${item.color}`}>
                {item.icon}{item.label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Announcement detail dialog */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3 pr-6">
              <Megaphone className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
              <span>{selectedAnnouncement?.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {selectedAnnouncement?.priority && (
              <Badge className={`${priorityColor(selectedAnnouncement.priority)} text-xs`}>
                {selectedAnnouncement.priority} priority
              </Badge>
            )}
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedAnnouncement?.body}</p>
            {selectedAnnouncement?.author_name && (
              <p className="text-xs text-gray-400 pt-2 border-t">Posted by {selectedAnnouncement.author_name}</p>
            )}
            {selectedAnnouncement?.publish_at && (
              <p className="text-xs text-gray-400">
                {new Date(selectedAnnouncement.publish_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
