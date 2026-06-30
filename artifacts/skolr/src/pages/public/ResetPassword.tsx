import React, { useState } from 'react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Mail, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      // The recovery link returns to the app with a "#type=recovery" hash, which
      // App.tsx routes to the SetPassword flow so the user can choose a new one.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      toast({ title: 'Could not send reset email', description: err?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setSending(false);
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
              {sent ? <CheckCircle2 className="h-10 w-10 text-emerald-500" /> : <Mail className="h-10 w-10 text-slate-400" />}
            </div>
            <CardTitle className="text-2xl font-bold">{sent ? 'Check your email' : 'Reset Password'}</CardTitle>
            <CardDescription>
              {sent
                ? `If an account exists for ${email}, we've sent a link to reset your password.`
                : 'Enter your email and we’ll send you a link to reset your password.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex justify-center">
                <Link href="/login">
                  <Button variant="outline" data-testid="button-back-to-login">Back to Login</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    data-testid="input-reset-email"
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={sending || !email} data-testid="button-send-reset">
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send reset link
                </Button>
                <div className="text-center">
                  <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
