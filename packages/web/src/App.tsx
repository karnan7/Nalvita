import { BLOOD_GROUPS } from '@nalvita/core';
import { HeartPulse } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <HeartPulse className="size-10 text-destructive" />
        <h1 className="text-4xl font-bold tracking-tight">Nalvita</h1>
      </div>
      <p className="max-w-md text-center text-muted-foreground">
        Your personal health records vault. Documents, medicines, vitals, and history — all in one
        place.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {BLOOD_GROUPS.map((group) => (
          <span
            key={group}
            className="rounded-full border px-3 py-1 text-sm font-medium text-muted-foreground"
          >
            {group}
          </span>
        ))}
      </div>
      <Button size="lg">Get started</Button>
    </main>
  );
}
