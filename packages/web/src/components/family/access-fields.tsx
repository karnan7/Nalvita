import { CIRCLE_ROLES, type CircleRole } from '@nalvita/core';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  CIRCLE_ROLE_DESCRIPTIONS,
  CIRCLE_ROLE_LABELS,
  SHAREABLE_CATEGORIES,
  SHARE_CATEGORY_LABELS,
  toggleAllCategories,
  toggleCategory,
  type AccessSelection,
} from '@/lib/circle';

interface AccessFieldsProps {
  idPrefix: string;
  value: AccessSelection;
  onChange: (next: AccessSelection) => void;
}

/**
 * The "what they can do / what to share" pair, shared by the invite form and
 * the manage-access dialog so an invite and a later change offer exactly the
 * same choices in the same words.
 */
export function AccessFields({ idPrefix, value, onChange }: Readonly<AccessFieldsProps>) {
  const shareAll = value.categories.includes('all');
  const roleId = `${idPrefix}-role`;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={roleId}>What they can do</Label>
        <Select
          id={roleId}
          value={value.role}
          onChange={(event) => onChange({ ...value, role: event.target.value as CircleRole })}
        >
          {CIRCLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {CIRCLE_ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
        <p className="text-sm text-content-muted">{CIRCLE_ROLE_DESCRIPTIONS[value.role]}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-content">What to share</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={shareAll}
            onChange={() => onChange(toggleAllCategories(value))}
          />
          {SHARE_CATEGORY_LABELS.all}
        </label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {SHAREABLE_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                disabled={shareAll}
                checked={shareAll || value.categories.includes(category)}
                onChange={() => onChange(toggleCategory(value, category))}
              />
              {SHARE_CATEGORY_LABELS[category]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
