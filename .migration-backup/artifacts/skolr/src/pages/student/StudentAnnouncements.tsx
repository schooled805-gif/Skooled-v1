import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useListAnnouncements } from '@workspace/api-client-react';
import { Loader2, Megaphone } from 'lucide-react';

export default function StudentAnnouncements() {
  const { data: announcements, isLoading } = useListAnnouncements({ audience_type: 'student' });

  return (
    <PortalLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Announcements</h1>
          <p className="text-gray-500 mt-1">School and class announcements</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-orange-500" /></div>
        ) : !announcements?.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">
            <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No announcements</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {announcements.map(a => (
              <Card key={a.id} data-testid={`card-announcement-${a.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    {a.priority && <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">{a.priority}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{a.body}</p>
                  {a.author_name && <p className="text-xs text-gray-400 mt-2">— {a.author_name}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
