import { PortalLayout } from '@/components/layout/PortalLayout';
import { TermCalendar } from '@/components/TermCalendar';
import { useAuth } from '@/contexts/AuthContext';

export default function TeacherCalendar() {
  const { school } = useAuth();
  const accent = /^#[0-9A-Fa-f]{6}$/.test(school?.primaryColor ?? '')
    ? (school!.primaryColor as string)
    : '#059669';

  return (
    <PortalLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Term Calendar</h1>
          <p className="text-gray-500 mt-1">School terms, public holidays and key dates</p>
        </div>
        <TermCalendar accentColor={accent} />
      </div>
    </PortalLayout>
  );
}
