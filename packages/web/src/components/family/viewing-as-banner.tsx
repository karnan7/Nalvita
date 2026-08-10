import { useNavigate } from 'react-router-dom';

import { viewingName } from '@/components/active-profile-provider';
import { Button } from '@/components/ui/button';
import { CIRCLE_ROLE_LABELS, describeCategories, useActiveProfile } from '@nalvita/data';

/**
 * Always on screen while looking at someone else's records — the one thing
 * standing between a caregiver and logging their own blood pressure into their
 * father's account. Deliberately loud, and never dismissible: it disappears
 * only by switching back.
 */
export function ViewingAsBanner() {
  const { viewing, setViewing } = useActiveProfile();
  const navigate = useNavigate();

  if (!viewing) return null;

  function leave() {
    setViewing(null);
    void navigate('/family');
  }

  return (
    <div className="sticky top-20 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-status-high-fg/30 bg-status-high-bg px-4 py-3 sm:px-6">
      <p className="text-sm font-medium text-status-high-fg">
        You&apos;re in {viewingName(viewing)}&apos;s records ·{' '}
        <span className="font-normal">
          {CIRCLE_ROLE_LABELS[viewing.role]}, {describeCategories(viewing.shared_categories)}
        </span>
      </p>
      <Button variant="outline" size="sm" onClick={leave}>
        Back to my records
      </Button>
    </div>
  );
}
