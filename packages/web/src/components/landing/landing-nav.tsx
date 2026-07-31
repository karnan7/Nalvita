import logoFullDark from "@/assets/logo-full-dark-4x.png";
import logoFullLight from "@/assets/logo-full-light-4x.png";
import { ThemeToggle } from "@/components/ui-nalvita/theme-toggle";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
] as const;

/** Sticky top bar for the marketing page: brand lockup, in-page anchors, CTA. */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-default bg-surface/85 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <a href="#top" aria-label="Nalvita home" className="flex items-center">
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
        </a>
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-6 text-sm text-content-secondary md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-content"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm" className="rounded-full px-5">
              <a href="#waitlist">Join the waitlist</a>
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
}
