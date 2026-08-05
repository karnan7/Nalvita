import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useRecordPermissions } from '@/lib/circle';

interface ProfileSectionProps {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}

/**
 * A titled block on the Profile page with an "Add" action in its header. The
 * action disappears entirely when the profile on screen belongs to someone
 * whose records this role may only read.
 */
export function ProfileSection({
  title,
  addLabel,
  onAdd,
  children,
}: Readonly<ProfileSectionProps>) {
  const { canWrite, guardWrite } = useRecordPermissions();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => guardWrite(onAdd)}>
            <Plus />
            {addLabel}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}
