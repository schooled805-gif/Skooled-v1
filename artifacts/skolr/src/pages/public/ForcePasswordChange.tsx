import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Loader2, KeyRound, LogOut } from 'lucide-react';

/**
 * Shown to a logged-in user whose profile has must_change_password = true
 * (e.g. a teacher logging in for the first time after an admin invite). Unlike
 * the invite SetPassword flow this keeps the user signed in: it updates the
 * password, clears the server flag, refreshes the profile, and lets the normal
 * routing take over.
 */
export default function ForcePasswordChange() {
  const { toast } = useToast();
  const { session, refreshProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

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

      const token = session?.access_token ?? '';
      const res = await fetch('/api/profiles/me/password-changed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('Could not update your account.');

      toast({ title: 'Password updated' });
      await refreshProfile();
    } catch (err: any) {
      toast({ title: 'Could not update password', description: err?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
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
              <KeyRound className="h-10 w-10 text-slate-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Set a new password</CardTitle>
            <CardDescription>
              For your security, please choose a new password before continuing to your portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Save & Continue
              </Button>
              <Button variant="ghost" className="w-full text-gray-500" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="h-4 w-4 mr-1" /> Log out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
