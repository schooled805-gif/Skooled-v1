import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useListReports } from '@workspace/api-client-react';
import { Loader2, Download, FileText } from 'lucide-react';

export default function StudentReports() {
  const { data: reports, isLoading } = useListReports();
  const visible = (reports ?? []).filter(r => r.visible_to_student);

  return (
    <PortalLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Reports</h1>
          <p className="text-gray-500 mt-1">Your academic reports</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-orange-500" /></div>
        ) : !visible.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No reports available</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {visible.map(r => (
              <Card key={r.id} data-testid={`card-report-${r.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <FileText className="h-8 w-8 text-orange-400 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{r.title}</p>
                    <p className="text-sm text-gray-500">Term {r.term}, {r.year}</p>
                  </div>
                  <a href={r.file_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50" data-testid={`button-download-${r.id}`}>
                      <Download className="h-4 w-4 mr-1" /> View
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
