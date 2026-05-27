import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen, Loader2, Check, ChevronRight, ChevronLeft, GraduationCap, Users,
} from 'lucide-react';

interface SchoolClass { id: string; name: string; grade_level: string | null; teacher_id: string | null; }
interface Subject { id: string; name: string; code: string | null; }

export default function TeacherSetup() {
  const { user, profile } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(0); // 0 = classes, 1 = subjects, 2 = done
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.school_id) return;
    setLoadingClasses(true);
    fetch(`/api/classes?school_id=${profile.school_id}`)
      .then(r => r.json())
      .then(d => setClasses(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingClasses(false));

    setLoadingSubjects(true);
    fetch(`/api/subjects?school_id=${profile.school_id}`)
      .then(r => r.json())
      .then(d => setSubjects(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingSubjects(false));
  }, [profile?.school_id]);

  const toggleClass = (id: string) =>
    setSelectedClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleSubject = (id: string) =>
    setSelectedSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleComplete = async () => {
    if (!user || !profile) return;
    setSubmitting(true);
    try {
      // Assign teacher to selected classes
      await Promise.all(
        selectedClassIds.map(classId =>
          fetch(`/api/classes/${classId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
            body: JSON.stringify({ teacher_id: profile.id }),
          })
        )
      );

      // Mark setup complete in localStorage
      localStorage.setItem(`teacher_setup_${user.id}`, 'done');

      toast({
        title: 'Setup complete!',
        description: selectedClassIds.length > 0
          ? `You've been assigned to ${selectedClassIds.length} class${selectedClassIds.length !== 1 ? 'es' : ''}.`
          : 'Your profile is ready.',
      });
      setLocation('/teacher');
    } catch (err: any) {
      toast({ title: 'Setup failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (user) localStorage.setItem(`teacher_setup_${user.id}`, 'done');
    setLocation('/teacher');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Logo + header */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-emerald-700 rounded-lg flex items-center justify-center">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Welcome to Skooled!</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Hi {profile?.full_name?.split(' ')[0] ?? 'there'} — let's finish setting up your teacher account.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {[0, 1].map(i => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-emerald-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Step 0 — Classes */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" /> Your Classes
              </CardTitle>
              <CardDescription>
                Select the class(es) you'll be teaching at {profile?.school_id ? 'your school' : 'school'}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingClasses ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin h-5 w-5 text-emerald-500" />
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No classes set up yet.</p>
                  <p className="text-xs mt-1">The admin can add classes later — you can skip for now.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {classes.map(cls => {
                    const selected = selectedClassIds.includes(cls.id);
                    const alreadyAssigned = cls.teacher_id && cls.teacher_id !== profile?.id;
                    return (
                      <button
                        key={cls.id}
                        onClick={() => !alreadyAssigned && toggleClass(cls.id)}
                        disabled={!!alreadyAssigned}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50'
                            : alreadyAssigned
                            ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                            : 'border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{cls.name}</p>
                          {cls.grade_level && (
                            <p className="text-xs text-gray-400">{cls.grade_level}</p>
                          )}
                        </div>
                        {alreadyAssigned && (
                          <Badge variant="outline" className="text-xs text-gray-400 shrink-0">Assigned</Badge>
                        )}
                        {selected && !alreadyAssigned && (
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleSkip} className="flex-1 text-gray-500">
                  Skip for now
                </Button>
                <Button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1 — Subjects */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-emerald-600" /> Your Subjects
              </CardTitle>
              <CardDescription>
                Which subjects do you teach? This helps the admin build your timetable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingSubjects ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin h-5 w-5 text-emerald-500" />
                </div>
              ) : subjects.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No subjects set up yet.</p>
                  <p className="text-xs mt-1">The admin can add subjects later — you can skip for now.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {subjects.map(sub => {
                    const selected = selectedSubjectIds.includes(sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => toggleSubject(sub.id)}
                        className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                          selected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{sub.name}</p>
                          {sub.code && <p className="text-xs text-gray-400">{sub.code}</p>}
                        </div>
                        {selected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Finish Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
