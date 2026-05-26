import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen, Loader2, Users, Shield, Search, Check, X,
  ChevronRight, ChevronLeft, Building2, GraduationCap,
} from 'lucide-react';

type Role = 'admin' | 'parent' | 'teacher';
interface School { id: string; name: string; address?: string | null; }
interface StudentResult { id: string; full_name: string; grade: string; student_number?: string | null; }

export default function ProfileSetup() {
  const [, setLocation] = useLocation();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // If profile already exists, redirect to portal
  useEffect(() => {
    if (profile?.role) setLocation(`/${profile.role}`);
  }, [profile]);

  const [step, setStep] = useState(0); // 0=role, 1=details, 2=school(/children)
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '');
  const [phone, setPhone] = useState('');

  // School
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolMode, setSchoolMode] = useState<'join' | 'create'>('join');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [loadingSchools, setLoadingSchools] = useState(false);

  // Children (parent)
  const [studentSearch, setStudentSearch] = useState('');
  const [allStudents, setAllStudents] = useState<StudentResult[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedChildren, setSelectedChildren] = useState<StudentResult[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (step === 2 && (role === 'parent' || role === 'teacher')) {
      setLoadingSchools(true);
      fetch('/api/schools').then(r => r.json()).then(d => setSchools(Array.isArray(d) ? d : []))
        .catch(() => {}).finally(() => setLoadingSchools(false));
    }
  }, [step, role]);

  useEffect(() => {
    if (step === 3 && selectedSchool) {
      setLoadingStudents(true);
      fetch(`/api/students?school_id=${selectedSchool.id}`).then(r => r.json())
        .then(d => setAllStudents(Array.isArray(d) ? d : []))
        .catch(() => {}).finally(() => setLoadingStudents(false));
    }
  }, [step, selectedSchool]);

  const filteredSchools = schools.filter(s => s.name.toLowerCase().includes(schoolSearch.toLowerCase()));
  const filteredStudents = allStudents.filter(s =>
    s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.student_number?.toLowerCase().includes(studentSearch.toLowerCase())
  );
  const toggleChild = (s: StudentResult) =>
    setSelectedChildren(prev => prev.some(c => c.id === s.id) ? prev.filter(c => c.id !== s.id) : [...prev, s]);

  const maxStep = role === 'parent' ? 3 : 2;
  const canProceedDetails = fullName.trim().length > 0;
  const canProceedSchool = role === 'admin'
    ? (schoolMode === 'create' ? newSchoolName.trim().length > 0 : !!selectedSchool)
    : !!selectedSchool;

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      let schoolId = selectedSchool?.id ?? null;

      if (role === 'admin' && schoolMode === 'create') {
        const r = await fetch('/api/schools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
          body: JSON.stringify({ name: newSchoolName, address: newSchoolAddress || undefined }),
        });
        if (!r.ok) throw new Error('Failed to create school');
        const school = await r.json();
        schoolId = school.id;
      }

      if (!schoolId) throw new Error('No school selected');

      const profileRes = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({
          user_id: user.id,
          role,
          full_name: fullName || user.email,
          email: user.email,
          phone: phone || undefined,
          school_id: schoolId,
        }),
      });
      if (!profileRes.ok) throw new Error('Failed to create profile');

      if (role === 'parent' && selectedChildren.length > 0) {
        await Promise.all(selectedChildren.map(child =>
          fetch('/api/parent-student-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
            body: JSON.stringify({ parent_user_id: user.id, student_id: child.id, school_id: schoolId }),
          })
        ));
      }

      toast({ title: 'Profile complete!', description: 'Taking you to your portal…' });
      // Reload so AuthContext picks up new profile
      window.location.href = `/${role}`;
    } catch (err: any) {
      toast({ title: 'Setup failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const loadSchoolsForAdmin = () => {
    setLoadingSchools(true);
    fetch('/api/schools').then(r => r.json()).then(d => { setSchools(Array.isArray(d) ? d : []); setLoadingSchools(false); }).catch(() => setLoadingSchools(false));
  };

  const steps = role === 'parent' ? 4 : 3;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Complete your profile</h1>
            <p className="text-sm text-gray-500 mt-0.5">Signed in as {user?.email}</p>
          </div>
        </div>

        {role && (
          <div className="flex gap-1">
            {Array.from({ length: steps }).map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>
        )}

        <Card>
          {/* STEP 0 – Role */}
          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle>Who are you?</CardTitle>
                <CardDescription>Choose your role at the school</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {([
                  { r: 'parent' as Role, label: 'Parent / Guardian', desc: "Track your child's progress and messages", Icon: Users, color: 'purple' },
                  { r: 'teacher' as Role, label: 'Teacher', desc: 'Manage classes and communicate with parents', Icon: BookOpen, color: 'emerald' },
                  { r: 'admin' as Role, label: 'School Administrator', desc: 'Set up and manage your school on Skolr', Icon: Shield, color: 'blue' },
                ] as const).map(({ r, label, desc, Icon, color }) => (
                  <button
                    key={r}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${role === r ? `border-${color}-500 bg-${color}-50` : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setRole(r)}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-${color}-100 flex items-center justify-center shrink-0`}>
                      <Icon className={`h-5 w-5 text-${color}-600`} />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{label}</p>
                      <p className="text-sm text-gray-500">{desc}</p>
                    </div>
                    {role === r && <Check className={`h-5 w-5 text-${color}-600 ml-auto shrink-0`} />}
                  </button>
                ))}
                <Button className="w-full mt-2" disabled={!role} onClick={() => setStep(1)}>
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </>
          )}

          {/* STEP 1 – Details */}
          {step === 1 && (
            <>
              <CardHeader><CardTitle>Your details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Full Name <span className="text-red-500">*</span></Label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone <span className="text-gray-400 text-xs">(optional)</span></Label>
                  <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(0)} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button onClick={() => setStep(2)} disabled={!canProceedDetails} className="flex-1">
                    Continue <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* STEP 2 – School (Admin) */}
          {step === 2 && role === 'admin' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600" />Your School</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {(['create', 'join'] as const).map(m => (
                    <button
                      key={m}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${schoolMode === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                      onClick={() => { setSchoolMode(m); if (m === 'join') loadSchoolsForAdmin(); }}
                    >
                      {m === 'create' ? 'Create new' : 'Join existing'}
                    </button>
                  ))}
                </div>
                {schoolMode === 'create' ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>School Name <span className="text-red-500">*</span></Label>
                      <Input value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} placeholder="Springfield Academy" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Address <span className="text-gray-400 text-xs">(optional)</span></Label>
                      <Input value={newSchoolAddress} onChange={e => setNewSchoolAddress(e.target.value)} placeholder="123 Main St" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input className="pl-9" placeholder="Search schools…" value={schoolSearch} onChange={e => setSchoolSearch(e.target.value)} />
                    </div>
                    {loadingSchools ? <div className="flex justify-center py-4"><Loader2 className="animate-spin h-5 w-5 text-blue-500" /></div> :
                      filteredSchools.length === 0 ? <p className="text-sm text-gray-400 text-center py-3">No schools found</p> :
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {filteredSchools.map(s => (
                          <button key={s.id} onClick={() => setSelectedSchool(s)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left ${selectedSchool?.id === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                            <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
                            <p className="font-medium text-sm text-gray-900 truncate flex-1">{s.name}</p>
                            {selectedSchool?.id === s.id && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                          </button>
                        ))}
                      </div>}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button onClick={handleSubmit} disabled={!canProceedSchool || submitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Create Account
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* STEP 2 – School (Teacher / Parent) */}
          {step === 2 && (role === 'teacher' || role === 'parent') && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className={`h-5 w-5 ${role === 'teacher' ? 'text-emerald-600' : 'text-purple-600'}`} />
                  {role === 'teacher' ? 'Your School' : 'Find Your School'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input className="pl-9" placeholder="Search schools…" value={schoolSearch} onChange={e => setSchoolSearch(e.target.value)} />
                </div>
                {loadingSchools ? <div className="flex justify-center py-6"><Loader2 className={`animate-spin h-5 w-5 ${role === 'teacher' ? 'text-emerald-500' : 'text-purple-500'}`} /></div> :
                  filteredSchools.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No schools found</p> :
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {filteredSchools.map(s => {
                      const active = selectedSchool?.id === s.id;
                      const ac = role === 'teacher' ? 'emerald' : 'purple';
                      return (
                        <button key={s.id} onClick={() => setSelectedSchool(s)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left ${active ? `border-${ac}-500 bg-${ac}-50` : 'border-gray-200 hover:border-gray-300'}`}>
                          <Building2 className={`h-4 w-4 text-${ac}-400 shrink-0`} />
                          <p className="font-medium text-sm text-gray-900 truncate flex-1">{s.name}</p>
                          {active && <Check className={`h-4 w-4 text-${ac}-600 shrink-0`} />}
                        </button>
                      );
                    })}
                  </div>}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                  {role === 'teacher' ? (
                    <Button onClick={handleSubmit} disabled={!selectedSchool || submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Finish
                    </Button>
                  ) : (
                    <Button onClick={() => setStep(3)} disabled={!selectedSchool} className="flex-1">
                      Continue <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* STEP 3 – Children (Parent only) */}
          {step === 3 && role === 'parent' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-purple-600" />Link Your Children</CardTitle>
                <CardDescription>Search for your child at {selectedSchool?.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedChildren.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedChildren.map(c => (
                      <Badge key={c.id} className="bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer gap-1" onClick={() => toggleChild(c)}>
                        {c.full_name} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input className="pl-9" placeholder="Search by name or student number…" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                </div>
                {loadingStudents ? <div className="flex justify-center py-6"><Loader2 className="animate-spin h-5 w-5 text-purple-500" /></div> :
                  filteredStudents.length === 0 ? (
                    <div className="text-center py-4">
                      <GraduationCap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">{studentSearch ? 'No students match' : 'No students at this school yet'}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {filteredStudents.map(s => {
                        const sel = selectedChildren.some(c => c.id === s.id);
                        return (
                          <button key={s.id} onClick={() => toggleChild(s)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left ${sel ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-sm font-bold text-purple-600">
                              {s.full_name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900">{s.full_name}</p>
                              <p className="text-xs text-gray-400">{s.grade}{s.student_number ? ` • #${s.student_number}` : ''}</p>
                            </div>
                            {sel && <Check className="h-4 w-4 text-purple-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-purple-600 hover:bg-purple-700">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    {selectedChildren.length > 0 ? `Finish & Link ${selectedChildren.length} Child${selectedChildren.length !== 1 ? 'ren' : ''}` : 'Finish'}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
