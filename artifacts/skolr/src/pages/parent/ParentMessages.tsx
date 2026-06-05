import React, { useMemo, useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useListConversations,
  useListMessages,
  useSendMessage,
  useListParentStudentLinks,
  useListStudentTeachers,
  getListMessagesQueryKey,
  getListConversationsQueryKey,
  getListParentStudentLinksQueryKey,
  getListStudentTeachersQueryKey,
  type StudentTeacher,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Send, MessageSquare, UserPlus, ArrowLeft, GraduationCap, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PendingRecipient = {
  userId: string;
  name: string;
  studentId: string;
  subjectId: string | null;
  subjectName: string | null;
};

export default function ParentMessages() {
  const { user, schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRecipient | null>(null);

  const { data: conversations, isLoading: loadingConvs } = useListConversations();

  // Parent's linked children
  const { data: links } = useListParentStudentLinks(
    { parent_user_id: user?.id },
    { query: { enabled: !!user?.id, queryKey: getListParentStudentLinksQueryKey({ parent_user_id: user?.id }) } }
  );
  const children = links ?? [];
  const activeChild = selectedChild ?? children[0]?.student_id ?? null;

  // The active child's teachers (class + subject teachers)
  const { data: teachers, isLoading: loadingTeachers } = useListStudentTeachers(
    activeChild ?? '',
    { query: { enabled: !!activeChild && showPicker, queryKey: getListStudentTeachersQueryKey(activeChild ?? '') } }
  );

  const { data: messages, isLoading: loadingMsgs } = useListMessages(
    { conversation_with: activeConv ?? undefined },
    { query: { enabled: !!activeConv, queryKey: getListMessagesQueryKey({ conversation_with: activeConv ?? undefined }) } }
  );
  const send = useSendMessage();

  const handleSend = () => {
    if (!newMsg.trim() || !activeConv || !schoolId) return;
    const ctx = pending && pending.userId === activeConv ? pending : null;
    send.mutate(
      {
        data: {
          recipient_id: activeConv,
          body: newMsg.trim(),
          school_id: schoolId,
          student_id: ctx?.studentId,
          subject_id: ctx?.subjectId ?? undefined,
        },
      },
      {
        onSuccess: () => {
          setNewMsg('');
          qc.invalidateQueries({ queryKey: getListMessagesQueryKey({ conversation_with: activeConv }) });
          qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
        onError: () => toast({ title: 'Failed to send', variant: 'destructive' }),
      }
    );
  };

  const openConversation = (otherUserId: string) => {
    setActiveConv(otherUserId);
    setShowPicker(false);
    setPending(null);
  };

  const startWithTeacher = (t: StudentTeacher) => {
    const childName = children.find(c => c.student_id === activeChild)?.student_name ?? null;
    setPending({
      userId: t.teacher_user_id,
      name: t.name,
      studentId: activeChild!,
      subjectId: t.subject_id ?? null,
      subjectName: t.subject_name ?? null,
    });
    setActiveConv(t.teacher_user_id);
    setShowPicker(false);
    if (childName) {
      toast({ title: `Messaging ${t.name}`, description: `About ${childName}${t.subject_name ? ` · ${t.subject_name}` : ''}` });
    }
  };

  const activeConvData = conversations?.find(c => c.other_user_id === activeConv);
  const headerName = activeConvData?.other_user_name ?? (pending?.userId === activeConv ? pending?.name : undefined) ?? 'Chat';
  const headerSub = pending?.userId === activeConv
    ? [children.find(c => c.student_id === pending?.studentId)?.student_name, pending?.subjectName].filter(Boolean).join(' · ')
    : '';

  const classTeacher = teachers?.class_teacher ?? null;
  const subjectTeachers = teachers?.subject_teachers ?? [];

  const childLabel = useMemo(
    () => (id: string | null) => children.find(c => c.student_id === id)?.student_name ?? 'Child',
    [children]
  );

  return (
    <PortalLayout role="parent">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Messages</h1>
          <p className="text-gray-500 mt-1">Communicate with your child's teachers</p>
        </div>
        <div className="flex gap-4 h-[600px]">
          {/* Left column */}
          <Card className="w-80 shrink-0 flex flex-col">
            {!showPicker ? (
              <>
                <div className="p-3 border-b flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-600">Conversations</span>
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 h-7 px-2"
                    onClick={() => setShowPicker(true)}
                    data-testid="button-new-message"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />New
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loadingConvs ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-purple-500" /></div>
                  ) : !conversations?.length ? (
                    <div className="p-6 text-center text-sm text-gray-400">
                      <p>No conversations yet</p>
                      <p className="mt-1 text-xs">Tap “New” to message one of your child's teachers.</p>
                    </div>
                  ) : (
                    conversations.map(c => (
                      <button
                        key={c.other_user_id}
                        className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors ${activeConv === c.other_user_id ? 'bg-purple-50 border-l-2 border-l-purple-500' : ''}`}
                        onClick={() => openConversation(c.other_user_id)}
                        data-testid={`button-conv-${c.other_user_id}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm text-gray-900 truncate">{c.other_user_name}</span>
                          {c.unread_count > 0 && <Badge className="bg-purple-600 text-white text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">{c.unread_count}</Badge>}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{c.last_message}</p>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="p-3 border-b flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowPicker(false)} data-testid="button-picker-back">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium text-sm text-gray-600">Message a teacher</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {/* Child selector */}
                  {children.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">No children linked to your account yet.</div>
                  ) : (
                    <>
                      {children.length > 1 && (
                        <div className="p-3 border-b">
                          <p className="text-xs font-medium text-gray-500 mb-2">Child</p>
                          <div className="flex flex-wrap gap-2">
                            {children.map(c => (
                              <Button
                                key={c.student_id}
                                size="sm"
                                variant={activeChild === c.student_id ? 'default' : 'outline'}
                                className={activeChild === c.student_id ? 'bg-purple-600 hover:bg-purple-700 h-7' : 'h-7'}
                                onClick={() => setSelectedChild(c.student_id)}
                                data-testid={`button-child-${c.student_id}`}
                              >
                                {c.student_name ?? 'Child'}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Teacher list */}
                      {loadingTeachers ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-purple-500" /></div>
                      ) : (
                        <div className="p-3 space-y-4">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                              <GraduationCap className="h-3.5 w-3.5" />Class teacher
                            </p>
                            {classTeacher ? (
                              <button
                                className="w-full text-left px-3 py-2 rounded-lg border hover:bg-purple-50 hover:border-purple-200 transition-colors"
                                onClick={() => startWithTeacher(classTeacher)}
                                data-testid={`button-teacher-class-${classTeacher.teacher_user_id}`}
                              >
                                <span className="font-medium text-sm text-gray-900">{classTeacher.name}</span>
                                <span className="block text-xs text-gray-400">{teachers?.class_name ?? 'Class teacher'}</span>
                              </button>
                            ) : (
                              <p className="text-xs text-gray-400 px-1">No class teacher assigned.</p>
                            )}
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5" />Subject teachers
                            </p>
                            {subjectTeachers.length === 0 ? (
                              <p className="text-xs text-gray-400 px-1">No subject teachers found for {childLabel(activeChild)}'s class.</p>
                            ) : (
                              <div className="space-y-2">
                                {subjectTeachers.map(t => (
                                  <button
                                    key={`${t.teacher_profile_id}:${t.subject_id}`}
                                    className="w-full text-left px-3 py-2 rounded-lg border hover:bg-purple-50 hover:border-purple-200 transition-colors"
                                    onClick={() => startWithTeacher(t)}
                                    data-testid={`button-teacher-subject-${t.teacher_user_id}-${t.subject_id}`}
                                  >
                                    <span className="font-medium text-sm text-gray-900">{t.name}</span>
                                    {t.subject_name && <span className="block text-xs text-purple-600">{t.subject_name}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Chat panel */}
          <Card className="flex-1 flex flex-col">
            {!activeConv ? (
              <CardContent className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Select a conversation</p>
                </div>
              </CardContent>
            ) : (
              <>
                <div className="p-4 border-b">
                  <div className="font-medium text-gray-800">{headerName}</div>
                  {headerSub && <div className="text-xs text-gray-400 mt-0.5">{headerSub}</div>}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5" /></div>
                  ) : (messages ?? []).length === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-8">No messages yet — say hello 👋</div>
                  ) : (messages ?? []).map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${msg.sender_id === user?.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        {msg.body}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t flex gap-2">
                  <Input
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    data-testid="input-message"
                  />
                  <Button onClick={handleSend} disabled={send.isPending} className="bg-purple-600 hover:bg-purple-700" data-testid="button-send-message">
                    {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
