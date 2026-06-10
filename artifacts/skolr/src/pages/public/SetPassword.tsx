import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Loader2, KeyRound, CheckCircle2 } from 'lucide-react';

const loginHref = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/login`;

export default function SetPassword() {
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // The invite / recovery link establishes a temporary session from the URL hash.
  // We use it only to set the password, then sign the user out (no auto-login).
  useEffect(() => {
    let active = true;
    const resolve = async () => {
      // Give supabase-js a moment to consume the hash tokens.
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!active) return;
          setHasSession(true);
          setEmail(data.session.user?.email ?? null);
          setChecking(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (active) setChecking(false);
    };
    resolve();
    return () => { active = false; };
  }, []);

  const handleSubmit = async () => {
    if (password.length < 8) {
      toast({ title: 'Password too short', description: 'Use at least 8 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Critical: do NOT keep the user logged in. They must sign in fresh.
      await supabase.auth.signOut();
      setDone(true);
      toast({ title: 'Password set', description: 'Please log in with your new password.' });
      setTimeout(() => { window.location.href = loginHref; }, 1800);
    } catch (err: any) {
      toast({ title: 'Could not set password', description: err?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {done ? <CheckCircle2 className="h-10 w-10 text-emerald-500" /> : <KeyRound className="h-10 w-10 text-slate-400" />}
            </div>
            <CardTitle className="text-2xl font-bold">{done ? 'All set!' : 'Set your password'}</CardTitle>
            <CardDescription>
              {done
                ? 'Your password has been saved. Redirecting you to the login page…'
                : email
                  ? `Create a password for ${email} to finish setting up your account.`
                  : 'Create a password to finish setting up your account.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checking ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-blue-600" /></div>
            ) : done ? (
              <div className="flex justify-center py-2">
                <Button onClick={() => { window.location.href = loginHref; }} variant="outline">Go to login</Button>
              </div>
            ) : !hasSession ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-slate-500">
                  This link is invalid or has expired. Please ask your school administrator to send a new invitation.
                </p>
                <Button onClick={() => { window.location.href = loginHref; }} variant="outline" data-testid="button-back-to-login">
                  Back to Login
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    data-testid="input-new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    data-testid="input-confirm-password"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                  />
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleSubmit}
                  disabled={saving || !password || !confirm}
                  data-testid="button-set-password"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Set Password &amp; Continue
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
