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
        Your personal health records vault is ready. Uploading documents, tracking medicines, and
        logging vitals are coming next.
      </p>
    </div>
  );
}
