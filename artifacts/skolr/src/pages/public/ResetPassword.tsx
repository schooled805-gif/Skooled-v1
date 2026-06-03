import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Mail } from 'lucide-react';

export default function ResetPassword() {
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
              <Mail className="h-10 w-10 text-slate-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              Password reset is managed by your school administrator. Please contact them directly to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/login">
              <Button variant="outline" data-testid="button-back-to-login">Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
