import type { Medicine } from '@nalvita/core';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { MedicineCard } from '@/components/medicines/medicine-card';
import { MedicineDialog } from '@/components/medicines/medicine-dialog';
import { Button } from '@/components/ui/button';
import { isMedicinePast, useMedicines, useRecordPermissions } from '@nalvita/data';
import { cn } from '@/lib/utils';

type Tab = 'active' | 'past';

const EMPTY_COPY: Record<Tab, string> = {
  active: 'No active medicines. Add one to start tracking what you take.',
  past: 'No past medicines yet. Stopped and finished courses will appear here.',
};

function Tabs({
  selected,
  onSelect,
  counts,
}: Readonly<{ selected: Tab; onSelect: (tab: Tab) => void; counts: Record<Tab, number> }>) {
  const tabs: { value: Tab; label: string }[] = [
    { value: 'active', label: `Active (${counts.active})` },
    { value: 'past', label: `Past (${counts.past})` },
  ];
  return (
    <div className="flex gap-2 border-b">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onSelect(tab.value)}
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            selected === tab.value
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function MedicinesPage() {
  const { data: medicines, isPending, isError } = useMedicines();
  const { canWrite, guardWrite } = useRecordPermissions();
  const [tab, setTab] = useState<Tab>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);

  const { active, past } = useMemo(() => {
    const groups: { active: Medicine[]; past: Medicine[] } = { active: [], past: [] };
    for (const medicine of medicines ?? []) {
      if (isMedicinePast(medicine)) groups.past.push(medicine);
      else groups.active.push(medicine);
    }
    return groups;
  }, [medicines]);

  const shown = tab === 'active' ? active : past;

  function openAdd() {
    guardWrite(() => {
      setEditing(null);
      setDialogOpen(true);
    });
  }

  function openEdit(medicine: Medicine) {
    guardWrite(() => {
      setEditing(medicine);
      setDialogOpen(true);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Medicines</h1>
        {canWrite && (
          <Button onClick={openAdd}>
            <Plus />
            Add medicine
          </Button>
        )}
      </div>

      <Tabs selected={tab} onSelect={setTab} counts={{ active: active.length, past: past.length }} />

      {isPending && <p className="text-sm text-muted-foreground">Loading your medicines…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          We couldn't load your medicines. Please refresh the page.
        </p>
      )}

      {!isPending && !isError && shown.length === 0 && (
        <p className="text-muted-foreground">{EMPTY_COPY[tab]}</p>
      )}

      {shown.length > 0 && (
        <ul className="flex flex-col gap-3">
          {shown.map((medicine) => (
            <MedicineCard
              key={medicine.id}
              medicine={medicine}
              onEdit={canWrite ? openEdit : null}
            />
          ))}
        </ul>
      )}

      <MedicineDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        medicine={editing}
      />
    </div>
  );
}
