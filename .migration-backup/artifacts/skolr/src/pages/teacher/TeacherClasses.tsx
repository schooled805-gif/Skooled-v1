import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useListClasses, useListStudents } from '@workspace/api-client-react';
import { Loader2, Users } from 'lucide-react';

export default function TeacherClasses() {
  const { data: classes, isLoading } = useListClasses();
  const { data: students } = useListStudents();

  return (
    <PortalLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Classes</h1>
          <p className="text-gray-500 mt-1">Classes assigned to you</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-emerald-600" /></div>
        ) : !classes?.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">No classes assigned</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {classes.map(cls => {
              const count = (students ?? []).filter(s => s.class_id === cls.id).length;
              return (
                <Card key={cls.id} className="hover:shadow-md transition-shadow" data-testid={`card-class-${cls.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{cls.name}</CardTitle>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{cls.grade_level}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Users className="h-4 w-4" />
                      <span>{count} student{count !== 1 ? 's' : ''}</span>
                    </div>
                    {cls.academic_year && <p className="text-xs text-gray-400 mt-1">{cls.academic_year}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
