import { ShieldCheck } from 'lucide-react';

import { StatusBadge, type StatusVariant } from '@/components/ui-nalvita/status-badge';

function Avatar({ label }: Readonly<{ label: string }>) {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 place-items-center rounded-full border-2 border-surface bg-sunken text-xs font-bold text-content-secondary"
    >
      {label}
    </span>
  );
}

interface VitalTileProps {
  label: string;
  value: string;
  unit: string;
  status: StatusVariant;
  statusLabel: string;
}

function VitalTile({ label, value, unit, status, statusLabel }: Readonly<VitalTileProps>) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-sunken p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-content-muted">{label}</span>
        <StatusBadge variant={status}>{statusLabel}</StatusBadge>
      </div>
      <p className="text-lg font-bold text-content">
        {value} <span className="text-xs font-normal text-content-muted">{unit}</span>
      </p>
    </div>
  );
}

function MedicineRow({ name, dose, note }: Readonly<{ name: string; dose: string; note: string }>) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="font-medium text-content">
        {name} <span className="font-normal text-content-muted">{dose}</span>
      </span>
      <span className="text-content-muted">{note}</span>
    </li>
  );
}

/**
 * Static "hero" mock of a family member's record. Illustrative sample data only —
 * no real health records are rendered here.
 */
export function RecordPreview() {
  return (
    <div className="rounded-3xl border border-border-default bg-surface p-5 shadow-xl sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
            Records for
          </p>
          <p className="mt-0.5 text-lg font-bold text-content">Amma · 68</p>
        </div>
        <div className="flex -space-x-2">
          <Avatar label="AK" />
          <Avatar label="+2" />
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-status-critical-bg p-3">
        <p className="text-sm font-semibold text-status-critical-fg">Allergy · Penicillin</p>
        <p className="mt-0.5 text-xs text-status-critical-fg/80">
          Shown on every plan and at every hospital visit.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <VitalTile
          label="Blood pressure"
          value="138/85"
          unit="mmHg"
          status="high"
          statusLabel="High"
        />
        <VitalTile label="Resting pulse" value="74" unit="bpm" status="normal" statusLabel="Normal" />
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
          Today's medicines
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          <MedicineRow name="Telmisartan" dose="40 mg" note="8:00 AM" />
          <MedicineRow name="Metformin" dose="500 mg" note="With lunch" />
        </ul>
      </div>

      <p className="mt-4 flex items-center gap-2 border-t border-border-default pt-3 text-xs text-content-muted">
        <ShieldCheck className="size-4 shrink-0 text-interactive" />
        Entered once. Visible to everyone you choose.
      </p>
    </div>
  );
}
