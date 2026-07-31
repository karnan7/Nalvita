import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Early-access waitlist capture. Phase 1 has no backend server, so the address
 * is kept client-side and the form simply confirms — nothing is transmitted.
 * When a Supabase `waitlist` table exists, wire the insert into `handleSubmit`.
 */
export function WaitlistForm() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setJoined(true);
    setEmail("");
  }

  if (joined) {
    return (
      <p
        role="status"
        className="mx-auto mt-8 max-w-md rounded-full bg-surface px-6 py-3 text-sm font-medium text-content"
      >
        You're on the list — we'll write once, when it's your turn.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row"
    >
      <label htmlFor={emailId} className="sr-only">
        Email address
      </label>
      <Input
        id={emailId}
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@email.com"
        className="h-12 flex-1 rounded-full border-transparent bg-surface px-5 text-content"
      />
      <Button
        type="submit"
        size="lg"
        variant="secondary"
        className="h-12 rounded-full px-7"
      >
        Notify me
      </Button>
    </form>
  );
}
