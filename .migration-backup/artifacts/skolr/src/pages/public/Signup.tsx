import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen,
  Loader2,
  Users,
  Shield,
  Search,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Building2,
  GraduationCap,
} from 'lucide-react';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z"/>
      <path fill="#00a4ef" d="M13 1h10v10H13z"/>
      <path fill="#7fba00" d="M1 13h10v10H1z"/>
      <path fill="#ffb900" d="M13 13h10v10H13z"/>
    </svg>
  );
}

type Role = 'admin' | 'parent';

interface School { id: string; name: string; address?: string | null; }
interface StudentResult { id: string; full_name: string; grade: string; student_number?: string | null; class_id?: string | null; }

const STEPS_ADMIN  = ['Choose role', 'Your details', 'Your school'];
const STEPS_PARENT = ['Choose role', 'Your details', 'Find school', 'Link children'];

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [oauthLoading, setOauthLoading] = useState<'google' | 'azure' | null>(null);

  const handleOAuth = async (provider: 'google' | 'azure') => {
    setOauthLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
          scopes: provider === 'azure' ? 'email profile openid' : undefined,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: 'Sign-up failed', description: err.message, variant: 'destructive' });
      setOauthLoading(null);
    }
  };

  // Step tracking
  const [step, setStep] = useState(0); // 0 = role, 1 = details, 2 = school, 3 = children (parent)
  const [role, setRole] = useState<Role | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // School state
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [schoolMode, setSchoolMode] = useState<'join' | 'create'>('join');
  const [loadingSchools, setLoadingSchools] = useState(false);

  // Children state
  const [studentSearch, setStudentSearch] = useState('');
  const [allStudents, setAllStudents] = useState<StudentResult[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedChildren, setSelectedChildren] = useState<StudentResult[]>([]);

  // Submission
  const [submitting, setSubmitting] = useState(false);

  const steps = role === 'admin' ? STEPS_ADMIN : STEPS_PARENT;

  // Load schools when reaching school step
  useEffect(() => {
    if (step === 2 && role === 'parent') {
      setLoadingSchools(true);
      fetch('/api/schools')
        .then(r => r.json())
        .then(data => setSchools(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setLoadingSchools(false));
    }
  }, [step, role]);

  // Load students when parent selects a school and reaches step 3
  useEffect(() => {
    if (step === 3 && selectedSchool) {
      setLoadingStudents(true);
      fetch(`/api/students?school_id=${selectedSchool.id}`)
        .then(r => r.json())
        .then(data => setAllStudents(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setLoadingStudents(false));
    }
  }, [step, selectedSchool]);

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  const filteredStudents = allStudents.filter(s =>
    s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.student_number?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const toggleChild = (student: StudentResult) => {
    setSelectedChildren(prev =>
      prev.some(c => c.id === student.id)
        ? prev.filter(c => c.id !== student.id)
        : [...prev, student]
    );
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const canProceedStep1 = fullName.trim() && email.trim() && password.length >= 6;

  const canProceedStep2 = role === 'admin'
    ? (schoolMode === 'create' ? newSchoolName.trim().length > 0 : !!selectedSchool)
    : !!selectedSchool; // parent and teacher both just need school selected

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // ── Step 1: Create Supabase auth account ──────────────────────────────
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        const msg = authError.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('email already')) {
          throw new Error('An account with this email address already exists. Please sign in instead.');
        }
        if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('email rate')) {
          throw new Error('Too many sign-up attempts. Please wait a few minutes and try again.');
        }
        throw new Error(`Account creation failed: ${authError.message}`);
      }

      // Supabase returns identities=[] (no error) when email is already registered
      // but unconfirmed — treat this as "already exists"
      if (!authData.user?.id) {
        throw new Error('Account creation failed. Please try again.');
      }
      if ((authData.user.identities ?? []).length === 0) {
        throw new Error('An account with this email address already exists. Please check your inbox for a confirmation link, or sign in.');
      }

      const userId = authData.user.id;

      // ── Step 2: Create or resolve school ──────────────────────────────────
      let schoolId: string | null = selectedSchool?.id ?? null;

      if (role === 'admin' && schoolMode === 'create') {
        const schoolRes = await fetch('/api/schools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({
            name: newSchoolName.trim(),
            address: newSchoolAddress.trim() || undefined,
          }),
        });
        if (!schoolRes.ok) {
          const errBody = await schoolRes.json().catch(() => ({}));
          throw new Error(`Could not create school: ${errBody.error ?? schoolRes.status}`);
        }
        const school = await schoolRes.json();
        schoolId = school.id as string;
        if (!schoolId) throw new Error('School was created but returned no ID — please contact support.');
      }

      if (!schoolId) {
        throw new Error('No school selected. Please choose or create a school before continuing.');
      }

      // ── Step 3: Create profile ─────────────────────────────────────────────
      const profileRes = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          user_id: userId,
          role,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          school_id: schoolId,
        }),
      });

      if (!profileRes.ok) {
        const errBody = await profileRes.json().catch(() => ({}));
        const msg = errBody.error ?? `Profile setup failed (${profileRes.status})`;
        // If the profile already exists, the auth account was still created —
        // direct the user to log in instead of treating it as a full failure.
        if (profileRes.status === 409) {
          toast({
            title: 'Account already set up',
            description: 'Your login was created — please sign in with your email and password.',
          });
          setLocation('/login');
          return;
        }
        throw new Error(msg);
      }

      // ── Step 4: Link children (parent only) ───────────────────────────────
      if (role === 'parent' && selectedChildren.length > 0) {
        await Promise.all(selectedChildren.map(child =>
          fetch('/api/parent-student-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
            body: JSON.stringify({
              parent_user_id: userId,
              student_id: child.id,
              school_id: schoolId,
            }),
          })
        ));
      }

      toast({
        title: 'Account created!',
        description: 'Check your inbox for a confirmation email, then sign in.',
      });
      setLocation('/login');
    } catch (err: any) {
      toast({ title: 'Sign up failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-sm text-gray-500 mt-0.5">Join Skooled today</p>
          </div>
        </div>

        {/* Progress bar */}
        {role && (
          <div className="flex items-center gap-1">
            {steps.map((label, i) => (
              <React.Fragment key={label}>
                <div className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
              </React.Fragment>
            ))}
          </div>
        )}

        {/* OAuth quick-sign section (only on step 0) */}
        {step === 0 && (
          <Card>
            <CardContent className="pt-5 space-y-3">
              <p className="text-center text-sm text-gray-500 font-medium">Sign up instantly with</p>
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline" className="gap-2" onClick={() => handleOAuth('google')} disabled={!!oauthLoading} data-testid="button-google-signup">
                  {oauthLoading === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Google
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={() => handleOAuth('azure')} disabled={!!oauthLoading} data-testid="button-microsoft-signup">
                  {oauthLoading === 'azure' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MicrosoftIcon />} Microsoft
                </Button>
              </div>
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400">or sign up with email</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          {/* ── STEP 0: Choose role ─────────────────────────────── */}
          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle>Who are you signing up as?</CardTitle>
                <CardDescription>Choose the role that describes you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <button
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${role === 'parent' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                  onClick={() => setRole('parent')}
                  data-testid="role-parent"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">Parent / Guardian</p>
                    <p className="text-sm text-gray-500">Track your child's progress, approvals, and messages</p>
                  </div>
                  {role === 'parent' && <Check className="h-5 w-5 text-purple-600 ml-auto shrink-0" />}
                </button>

                <div className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 opacity-75 cursor-not-allowed">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-500">Teacher</p>
                    <p className="text-sm text-gray-400">Teachers are added by school administrators — check your email for an invitation</p>
                  </div>
                </div>

                <button
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${role === 'admin' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                  onClick={() => setRole('admin')}
                  data-testid="role-admin"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">School Administrator</p>
                    <p className="text-sm text-gray-500">Set up and manage your school on Skooled</p>
                  </div>
                  {role === 'admin' && <Check className="h-5 w-5 text-blue-600 ml-auto shrink-0" />}
                </button>

                <Button className="w-full mt-2" disabled={!role} onClick={nextStep} data-testid="button-next-role">
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </>
          )}

          {/* ── STEP 1: Personal details ────────────────────────── */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Your details</CardTitle>
                <CardDescription>Fill in your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" data-testid="input-full-name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" data-testid="input-email" />
                </div>
                <div className="space-y-1.5">
                  <Label>Password <span className="text-gray-400 text-xs">(min. 6 characters)</span></Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} data-testid="input-password" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone <span className="text-gray-400 text-xs">(optional)</span></Label>
                  <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" data-testid="input-phone" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={prevStep} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button onClick={nextStep} disabled={!canProceedStep1} className="flex-1" data-testid="button-next-details">
                    Continue <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* ── STEP 2: School (Admin) ──────────────────────────── */}
          {step === 2 && role === 'admin' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600" /> Your School</CardTitle>
                <CardDescription>Create a new school or join an existing one</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <button
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${schoolMode === 'create' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                    onClick={() => setSchoolMode('create')}
                    data-testid="tab-create-school"
                  >
                    Create new school
                  </button>
                  <button
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${schoolMode === 'join' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                    onClick={() => { setSchoolMode('join'); setLoadingSchools(true); fetch('/api/schools').then(r => r.json()).then(d => { setSchools(Array.isArray(d) ? d : []); setLoadingSchools(false); }).catch(() => setLoadingSchools(false)); }}
                    data-testid="tab-join-school"
                  >
                    Join existing
                  </button>
                </div>

                {schoolMode === 'create' ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>School Name</Label>
                      <Input value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} placeholder="e.g. Springfield Academy" data-testid="input-school-name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Address <span className="text-gray-400 text-xs">(optional)</span></Label>
                      <Input value={newSchoolAddress} onChange={e => setNewSchoolAddress(e.target.value)} placeholder="123 Main St, City" data-testid="input-school-address" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input className="pl-9" placeholder="Search schools…" value={schoolSearch} onChange={e => setSchoolSearch(e.target.value)} />
                    </div>
                    {loadingSchools ? (
                      <div className="flex justify-center py-4"><Loader2 className="animate-spin h-5 w-5 text-blue-500" /></div>
                    ) : filteredSchools.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-3">No schools found</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {filteredSchools.map(school => (
                          <button
                            key={school.id}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${selectedSchool?.id === school.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                            onClick={() => setSelectedSchool(school)}
                            data-testid={`school-option-${school.id}`}
                          >
                            <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">{school.name}</p>
                              {school.address && <p className="text-xs text-gray-400 truncate">{school.address}</p>}
                            </div>
                            {selectedSchool?.id === school.id && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={prevStep} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button onClick={handleSubmit} disabled={!canProceedStep2 || submitting} className="flex-1 bg-blue-600 hover:bg-blue-700" data-testid="button-create-account">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Create Account
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* ── STEP 2: School (Parent) ─────────────────────────── */}
          {step === 2 && role === 'parent' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-purple-600" /> Find Your School</CardTitle>
                <CardDescription>Select the school your child attends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input className="pl-9" placeholder="Search schools…" value={schoolSearch} onChange={e => setSchoolSearch(e.target.value)} />
                </div>
                {loadingSchools ? (
                  <div className="flex justify-center py-6"><Loader2 className="animate-spin h-5 w-5 text-purple-500" /></div>
                ) : filteredSchools.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No schools found. Contact your school administrator.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {filteredSchools.map(school => (
                      <button
                        key={school.id}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${selectedSchool?.id === school.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                        onClick={() => setSelectedSchool(school)}
                        data-testid={`school-option-${school.id}`}
                      >
                        <Building2 className="h-4 w-4 text-purple-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{school.name}</p>
                          {school.address && <p className="text-xs text-gray-400 truncate">{school.address}</p>}
                        </div>
                        {selectedSchool?.id === school.id && <Check className="h-4 w-4 text-purple-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={prevStep} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button onClick={nextStep} disabled={!selectedSchool} className="flex-1" data-testid="button-next-school">
                    Continue <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* ── STEP 3: Link children (Parent) ─────────────────── */}
          {step === 3 && role === 'parent' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-purple-600" /> Select Your Children
                </CardTitle>
                <CardDescription>
                  Search for your child's name as registered at <strong>{selectedSchool?.name}</strong>
                </CardDescription>
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
                  <Input
                    className="pl-9"
                    placeholder="Search by name or student number…"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    data-testid="input-student-search"
                  />
                </div>

                {loadingStudents ? (
                  <div className="flex justify-center py-6"><Loader2 className="animate-spin h-5 w-5 text-purple-500" /></div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-4">
                    <GraduationCap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">
                      {studentSearch ? 'No students match your search' : 'No students found at this school yet'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {filteredStudents.map(student => {
                      const selected = selectedChildren.some(c => c.id === student.id);
                      return (
                        <button
                          key={student.id}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${selected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                          onClick={() => toggleChild(student)}
                          data-testid={`student-option-${student.id}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-sm font-bold text-purple-600">
                            {student.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900">{student.full_name}</p>
                            <p className="text-xs text-gray-400">{student.grade}{student.student_number ? ` • #${student.student_number}` : ''}</p>
                          </div>
                          {selected && <Check className="h-4 w-4 text-purple-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={prevStep} className="flex-1"><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    data-testid="button-create-account"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    {selectedChildren.length > 0 ? `Create Account & Link ${selectedChildren.length} Child${selectedChildren.length !== 1 ? 'ren' : ''}` : 'Create Account'}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
