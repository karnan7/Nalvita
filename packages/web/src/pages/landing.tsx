import {
  Activity,
  ArrowRight,
  BadgeCheck,
  FileText,
  Lock,
  MapPin,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Navigate } from "react-router-dom";

import logoFullDark from "@/assets/logo-full-dark-4x.png";
import logoFullLight from "@/assets/logo-full-light-4x.png";
import { Faq } from "@/components/landing/faq";
import { LandingNav } from "@/components/landing/landing-nav";
import { RecordPreview } from "@/components/landing/record-preview";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { Button } from "@/components/ui/button";
import { useAuth } from "@nalvita/data";

interface FeatureCard {
  icon: LucideIcon;
  kicker: string;
  title: string;
  body: string;
}

const SUPPORTING_FEATURES: readonly FeatureCard[] = [
  {
    icon: FileText,
    kicker: "Document vault",
    title: "Every report in one searchable place",
    body: "Prescriptions, scans and lab reports, sorted by person and date and searchable in a tap.",
  },
  {
    icon: Activity,
    kicker: "Medicines & vitals",
    title: "Schedules and trends in plain language",
    body: "Daily doses, refill reminders and blood-sugar trends read back as normal, high, or worth a call.",
  },
];

const HEALTH_CIRCLE_POINTS: readonly string[] = [
  "They approve the meds — no silent access",
  "An activity log both of you can read",
  "One tap to turn sharing off",
];

interface PrivacyPoint {
  icon: LucideIcon;
  title: string;
  body: string;
}

const PRIVACY_POINTS: readonly PrivacyPoint[] = [
  {
    icon: MapPin,
    title: "Your data stays in India",
    body: "Stored on servers in India, and never moved abroad.",
  },
  {
    icon: Lock,
    title: "Encrypted at rest and in transit",
    body: "Files and readings are encrypted on the way in and while stored.",
  },
  {
    icon: Trash2,
    title: "Delete everything, anytime",
    body: "One request removes your account and every file in it.",
  },
  {
    icon: BadgeCheck,
    title: "No ads, ever",
    body: "We don't sell or share your records with anyone.",
  },
];

function Hero() {
  return (
    <section
      id="top"
      className="mx-auto grid w-full max-w-6xl scroll-mt-24 items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-2"
    >
      <div className="min-w-0">
        <span className="inline-flex items-center rounded-full bg-status-normal-bg px-3 py-1 text-xs font-semibold text-status-normal-fg">
          Early access opening soon
        </span>
        <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] text-content sm:text-5xl lg:text-6xl">
          Your family's entire health history. One place. Always ready.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-content-secondary sm:text-lg">
          Keep lab reports, medicines and vitals for yourself and your parents
          in one record you can open in seconds — private by design, and never
          shared without your say.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Button asChild size="lg" className="group rounded-full px-7">
            <a href="#waitlist">
              Join the waitlist
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </Button>
          <p className="text-sm text-content-muted">
            Free while in early access. No card, no ads.
          </p>
        </div>
      </div>
      <RecordPreview />
    </section>
  );
}

function Problem() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5">
      <div className="grid gap-6 border-y border-border-default py-12 md:grid-cols-[0.8fr_1.2fr] md:gap-12">
        <h2 className="font-display text-2xl font-bold leading-snug text-content">
          The records already exist. Finding them is the problem.
        </h2>
        <p className="text-base leading-relaxed text-content-secondary">
          A blood test sits in a hospital folder. The scan came as a WhatsApp
          PDF. The dosage change from last month lives in somebody's memory.
          When a doctor asks what medicines your father is on, you shouldn't
          have to guess — or call three people to be sure.
        </p>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section
      id="features"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-16 sm:py-20"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-interactive">
        What you get
      </p>
      <h2 className="mt-2 max-w-xl font-display text-3xl font-bold leading-tight text-content sm:text-4xl">
        Four small things that remove a lot of worry.
      </h2>
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <article className="flex flex-col rounded-3xl bg-interactive p-7 text-content-inverse">
          <span className="grid size-11 place-items-center rounded-full bg-content-inverse/10 text-content-inverse">
            <Users className="size-5" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-content-inverse/70">
            Health circle
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold">
            Care for your parents' health, with their consent
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-content-inverse/80">
            Invite a parent and you can add their reports, track medicines and
            see their vitals. They see everything you do — and can revoke access
            at any time.
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-sm">
            {HEALTH_CIRCLE_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <BadgeCheck className="size-4 shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </article>
        <div className="grid gap-5">
          {SUPPORTING_FEATURES.map(({ icon: Icon, kicker, title, body }) => (
            <article
              key={kicker}
              className="flex flex-col rounded-3xl border border-border-default bg-surface p-7"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-status-normal-bg text-status-normal-fg">
                <Icon className="size-5" />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-content-muted">
                {kicker}
              </p>
              <h3 className="mt-1 font-display text-xl font-bold text-content">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                {body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section
      id="privacy"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 pb-8"
    >
      <div className="rounded-3xl bg-status-normal-bg p-8 sm:p-10">
        <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-12">
          <div>
            <span className="grid size-10 place-items-center rounded-xl bg-surface text-interactive">
              <ShieldCheck className="size-5" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold text-content sm:text-3xl">
              Built private-first
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-content-secondary">
              Health records are the most personal thing you own. We treat them
              that way.
            </p>
          </div>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {PRIVACY_POINTS.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <div className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-interactive" />
                  <h3 className="text-sm font-semibold text-content">
                    {title}
                  </h3>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-content-secondary">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Waitlist() {
  return (
    <section
      id="waitlist"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-16 sm:py-20"
    >
      <div className="rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground shadow-lg sm:px-12">
        <h2 className="mx-auto font-display text-3xl font-bold leading-tight sm:text-4xl">
          Be there when early access opens
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
          Leave your email and we'll write once, when it's your turn. Nothing
          else is collected.
        </p>
        <WaitlistForm />
      </div>
    </section>
  );
}

interface FooterLink {
  label: string;
  href: string;
}

const PRODUCT_LINKS: readonly FooterLink[] = [
  { label: "Features", href: "#features" },
  { label: "Privacy", href: "#privacy" },
  { label: "FAQ", href: "#faq" },
  { label: "Join waitlist", href: "#waitlist" },
];

const LEGAL_LINKS: readonly FooterLink[] = [
  { label: "Privacy policy", href: "#privacy" },
  { label: "Terms of service", href: "#faq" },
];

const CONTACT_LINKS: readonly FooterLink[] = [
  { label: "hello@nalvita.com", href: "mailto:hello@nalvita.com" },
];

function FooterColumn({
  title,
  links,
}: Readonly<{ title: string; links: readonly FooterLink[] }>) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-content">{title}</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-content-muted transition-colors hover:text-content"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border-default">
      <div className="mx-auto w-full max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:gap-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <img
                src={logoFullLight}
                alt="Nalvita"
                className="h-9 w-auto dark:hidden"
              />
              <img
                src={logoFullDark}
                alt="Nalvita"
                className="hidden h-9 w-auto dark:block"
              />
              <span aria-hidden="true" className="h-5 w-px bg-border-strong" />
              <span className="text-sm font-medium tracking-wide text-content-muted">
                A well life
              </span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-content-secondary">
              Your family’s health, organized and protected from reports to
              daily care.
            </p>
            <p className="mt-4 max-w-xs text-sm italic leading-relaxed text-content-muted">
              Nalvita comes from{" "}
              <span className="font-semibold not-italic text-content-secondary">
                nalam
              </span>
              , Malayalam for well-being, and{" "}
              <span className="font-semibold not-italic text-content-secondary">
                vita
              </span>
              , Latin for life.
            </p>
          </div>
          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
          <FooterColumn title="Contact" links={CONTACT_LINKS} />
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border-default pt-6 text-sm text-content-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Nalvita. All rights reserved.</p>
          <p>Made with care, for your family.</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Public marketing landing page — the app's front door for signed-out visitors.
 * Anyone already signed in is sent straight to their dashboard.
 */
export default function LandingPage() {
  const { session, loading } = useAuth();

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-app text-content">
      <LandingNav />
      <main>
        <Hero />
        <Problem />
        <Features />
        <Privacy />
        <Waitlist />
        <Faq />
      </main>
      <LandingFooter />
    </div>
  );
}
