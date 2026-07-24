import { FileText } from 'lucide-react';
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
        Your personal health records vault is ready. Store your reports, prescriptions, and scans in
        one place — tracking medicines and logging vitals are coming next.
      </p>
      <Button asChild className="self-start">
        <Link to="/documents">
          <FileText />
          Go to my documents
        </Link>
      </Button>
    </div>
  );
}
