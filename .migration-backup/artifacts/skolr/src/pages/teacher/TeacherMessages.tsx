import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useListConversations, useListMessages, useSendMessage, getListMessagesQueryKey, getListConversationsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TeacherMessages() {
  const { user, schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState('');

  const { data: conversations, isLoading: loadingConvs } = useListConversations();
  const { data: messages, isLoading: loadingMsgs } = useListMessages(
    { conversation_with: activeConv ?? undefined },
    { query: { enabled: !!activeConv, queryKey: getListMessagesQueryKey({ conversation_with: activeConv ?? undefined }) } }
  );
  const send = useSendMessage();

  const handleSend = () => {
    if (!newMsg.trim() || !activeConv || !schoolId) return;
    send.mutate({ data: { recipient_id: activeConv, body: newMsg.trim(), school_id: schoolId } }, {
      onSuccess: () => {
        setNewMsg('');
        qc.invalidateQueries({ queryKey: getListMessagesQueryKey({ conversation_with: activeConv }) });
        qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      },
      onError: () => toast({ title: 'Failed to send', variant: 'destructive' }),
    });
  };

  const activeConvData = conversations?.find(c => c.other_user_id === activeConv);

  return (
    <PortalLayout role="teacher">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Messages</h1>
          <p className="text-gray-500 mt-1">Communicate with parents</p>
        </div>
        <div className="flex gap-4 h-[600px]">
          <Card className="w-72 shrink-0 flex flex-col">
            <div className="p-3 border-b font-medium text-sm text-gray-600">Conversations</div>
            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-emerald-500" /></div>
              ) : !conversations?.length ? (
                <div className="p-4 text-center text-sm text-gray-400">No conversations yet</div>
              ) : conversations.map(c => (
                <button
                  key={c.other_user_id}
                  className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors ${activeConv === c.other_user_id ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''}`}
                  onClick={() => setActiveConv(c.other_user_id)}
                  data-testid={`button-conv-${c.other_user_id}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm text-gray-900 truncate">{c.other_user_name}</span>
                    {c.unread_count > 0 && <Badge className="bg-emerald-600 text-white text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">{c.unread_count}</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{c.last_message}</p>
                </button>
              ))}
            </div>
          </Card>
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
                <div className="p-4 border-b font-medium text-gray-800">{activeConvData?.other_user_name ?? 'Chat'}</div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5" /></div>
                  ) : (messages ?? []).map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${msg.sender_id === user?.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        {msg.body}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t flex gap-2">
                  <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." onKeyDown={e => e.key === 'Enter' && handleSend()} data-testid="input-message" />
                  <Button onClick={handleSend} disabled={send.isPending} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-send-message">
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
