import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Users, UserSquare2, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b py-4 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Skolr</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/signup">
            <Button variant="outline" data-testid="button-signup-nav">Sign up</Button>
          </Link>
          <Link href="/login">
            <Button data-testid="button-login-nav">Log in</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900">
            The school in your pocket.
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            A unified school operations platform used daily by parents, teachers, students, and admins.
            Authoritative, approachable, and never noisy.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4 flex-wrap">
            <Link href="/signup">
              <Button size="lg" className="text-base px-8 py-5 gap-2" data-testid="button-get-started">
                Get started free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-base px-8 py-5" data-testid="button-login-cta">
                Sign in to your portal
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20 max-w-6xl w-full">
          <Link href="/signup">
            <Card className="border-t-4 border-t-purple-600 hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <Users className="h-8 w-8 text-purple-600 mb-2" />
                <CardTitle>Parent Portal</CardTitle>
                <CardDescription>Stay connected with your child's progress, schedule, and teachers.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Card className="border-t-4 border-t-emerald-600 hover:shadow-md transition-shadow">
            <CardHeader>
              <BookOpen className="h-8 w-8 text-emerald-600 mb-2" />
              <CardTitle>Teacher Portal</CardTitle>
              <CardDescription>Manage classes, assignments, and communicate with parents easily.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-t-4 border-t-orange-500 hover:shadow-md transition-shadow">
            <CardHeader>
              <UserSquare2 className="h-8 w-8 text-orange-500 mb-2" />
              <CardTitle>Student Portal</CardTitle>
              <CardDescription>Access your timetable, reports, and school announcements.</CardDescription>
            </CardHeader>
          </Card>

          <Link href="/signup">
            <Card className="border-t-4 border-t-blue-600 hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <ShieldCheck className="h-8 w-8 text-blue-600 mb-2" />
                <CardTitle>Admin Portal</CardTitle>
                <CardDescription>Oversee all school operations from a powerful centralized dashboard.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <div className="mt-16 max-w-2xl text-center space-y-3">
          <p className="text-slate-500 text-sm">
            <strong className="text-slate-700">School admins:</strong> sign up to create your school and invite staff.
          </p>
          <p className="text-slate-500 text-sm">
            <strong className="text-slate-700">Parents:</strong> sign up to link your account to your child's record.
          </p>
          <p className="text-slate-500 text-sm">
            <strong className="text-slate-700">Teachers & students</strong> are invited by the school administrator.
          </p>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm">
        <p>© {new Date().getFullYear()} Skolr. All rights reserved.</p>
      </footer>
    </div>
  );
}
