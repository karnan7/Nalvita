import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';

import logoFullDark from '@/assets/logo-full-dark-4x.png';
import logoFullLight from '@/assets/logo-full-light-4x.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The shell for the pages someone reaches from a link we sent them — joining a
 * Health Circle, or claiming a profile that has been kept for them.
 *
 * These are the only screens shown to people who may not have an account yet,
 * so they stand alone: full-page, logo first, one card, and no app chrome to
 * suggest they are already inside something.
 */
export function LinkPage({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="flex items-center">
        <span className="sr-only">Nalvita</span>
        <img src={logoFullLight} alt="" className="h-16 w-auto dark:hidden" />
        <img src={logoFullDark} alt="" className="hidden h-16 w-auto dark:block" />
      </h1>
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}

interface LinkOutcomeProps {
  title: string;
  children: ReactNode;
  /** Where the person goes next. */
  to: string;
  label: string;
  /** Outlined rather than filled, for outcomes that are not what we hoped for. */
  muted?: boolean;
}

/**
 * How every one of these pages ends: what happened, in a sentence, and one way
 * onwards. Never leaves someone on a dead screen wondering what to do.
 */
export function LinkOutcome({ title, children, to, label, muted }: Readonly<LinkOutcomeProps>) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <h2 className="font-heading text-xl font-bold text-content">{title}</h2>
      <p className="text-sm text-content-secondary">{children}</p>
      <Button asChild variant={muted ? 'outline' : 'default'}>
        <Link to={to}>{label}</Link>
      </Button>
    </div>
  );
}

interface CodeEntryProps {
  label: string;
  onSubmit: (code: string) => void;
}

/** Manual code entry, for someone read the digits over the phone. */
export function CodeEntry({ label, onSubmit }: Readonly<CodeEntryProps>) {
  const [code, setCode] = useState('');

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="link-code">{label}</Label>
        <Input
          id="link-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={!code.trim()}>
        Continue
      </Button>
    </form>
  );
}
