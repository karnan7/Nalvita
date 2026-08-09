import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * A read-only field with a copy button, for a secret the app shows once —
 * invite codes and handover links. The value is never persisted anywhere the
 * app can read it again, so copying is the only way it leaves the screen.
 */
export function CopyField({ label, value }: Readonly<{ label: string; value: string }>) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-content">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-sunken px-3 py-2 text-sm text-content">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void copy()}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}
