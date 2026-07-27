import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface ProfileSectionProps {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}

/** A titled block on the Profile page with an "Add" action in its header. */
export function ProfileSection({
  title,
  addLabel,
  onAdd,
  children,
}: Readonly<ProfileSectionProps>) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus />
          {addLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}
