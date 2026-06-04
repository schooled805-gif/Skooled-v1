import React from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PendingApproval() {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Skooled</h1>
        </div>

        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="h-7 w-7 text-amber-600" />
            </div>
            <CardTitle className="text-xl">Awaiting Approval</CardTitle>
            <CardDescription className="text-sm mt-1">
              Your account has been created and is waiting for the school administrator to approve your access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-1">
              <p className="font-medium">What happens next?</p>
              <ul className="list-disc list-inside space-y-1 text-amber-700">
                <li>The school admin will review your request</li>
                <li>You'll be able to sign in once approved</li>
                <li>Contact your school if you need faster access</li>
              </ul>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
