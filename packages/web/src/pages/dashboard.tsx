import { Activity, FileText, Pill } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/lib/profile';

export default function DashboardPage() {
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">
        {profile?.full_name ? `Hello, ${profile.full_name}` : 'Hello'}
      </h1>
      <p className="max-w-md text-muted-foreground">
        Your personal health records vault is ready. Store your reports, prescriptions, and scans,
        track the medicines you take, and log your vitals to see how they trend over time.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild className="self-start">
          <Link to="/documents">
            <FileText />
            My documents
          </Link>
        </Button>
        <Button asChild variant="outline" className="self-start">
          <Link to="/medicines">
            <Pill />
            My medicines
          </Link>
        </Button>
        <Button asChild variant="outline" className="self-start">
          <Link to="/vitals">
            <Activity />
            My vitals
          </Link>
        </Button>
      </div>
    </div>
  );
}
