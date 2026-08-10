import { Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useRecordPermissions } from '@nalvita/data';

interface RecordActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  /** Names the record, so screen readers hear which one is being removed. */
  deleteLabel: string;
}

/**
 * The Edit/Delete pair on a profile record card. Shared by allergies,
 * conditions and doctors so the role rules are written once: editing needs
 * caregiver, deleting needs manager, and the first change to someone else's
 * records is confirmed.
 */
export function RecordActions({ onEdit, onDelete, deleteLabel }: Readonly<RecordActionsProps>) {
  const { canWrite, canDelete, guardWrite } = useRecordPermissions();

  return (
    <div className="flex shrink-0 gap-2">
      {canWrite && (
        <Button variant="outline" size="sm" onClick={() => guardWrite(onEdit)}>
          <Pencil />
          Edit
        </Button>
      )}
      {canDelete && (
        <Button variant="ghost" size="sm" aria-label={deleteLabel} onClick={onDelete}>
          <Trash2 className="text-destructive" />
        </Button>
      )}
    </div>
  );
}
