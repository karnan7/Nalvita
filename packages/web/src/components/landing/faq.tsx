import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { cn } from '@/lib/utils';

interface FaqEntry {
  question: string;
  answer: string;
}

const FAQS: readonly FaqEntry[] = [
  {
    question: 'Is it free?',
    answer:
      'Yes — Nalvita is free while it is in early access, with no card required and no ads, ever.',
  },
  {
    question: 'Who can see my records?',
    answer:
      'Only you, and the family members you explicitly invite to your Health Circle. You decide what each person can see, and you can turn off sharing at any time.',
  },
  {
    question: 'Where is my data stored?',
    answer:
      'On managed infrastructure in India, encrypted at rest and in transit. Your records never leave without your say.',
  },
  {
    question: 'When does it launch?',
    answer:
      "Early access is opening soon. Join the waitlist and we'll email you once, when it's your turn.",
  },
];

interface FaqRowProps {
  entry: FaqEntry;
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * A single expandable question. The answer animates open/closed with the
 * `grid-template-rows: 0fr → 1fr` technique — the panel stays in the DOM so its
 * height can transition, unlike a native <details> which snaps open.
 */
function FaqRow({ entry, isOpen, onToggle }: Readonly<FaqRowProps>) {
  const panelId = useId();
  return (
    <div className="border-t border-border-default">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-base font-semibold text-content"
      >
        {entry.question}
        <ChevronDown
          className={cn(
            'size-5 shrink-0 text-content-muted transition-transform duration-300 motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      <div
        id={panelId}
        role="region"
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="pb-4 text-sm leading-relaxed text-content-secondary">{entry.answer}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Accessible FAQ accordion. Only one answer is open at a time, and the open/close
 * is animated rather than a jump.
 */
export function Faq() {
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  return (
    <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-24 px-5 py-16 sm:py-20">
      <h2 className="font-display text-2xl font-bold text-content sm:text-3xl">Questions</h2>
      <div className="mt-8 border-b border-border-default">
        {FAQS.map((faq) => (
          <FaqRow
            key={faq.question}
            entry={faq}
            isOpen={openQuestion === faq.question}
            onToggle={() =>
              setOpenQuestion((current) => (current === faq.question ? null : faq.question))
            }
          />
        ))}
      </div>
    </section>
  );
}
