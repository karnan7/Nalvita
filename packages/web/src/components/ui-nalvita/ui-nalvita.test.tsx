import { Pill } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { AlertBanner } from '@/components/ui-nalvita/alert-banner';
import { EmptyState } from '@/components/ui-nalvita/empty-state';
import { PageShell } from '@/components/ui-nalvita/page-shell';
import { SectionCard } from '@/components/ui-nalvita/section-card';
import { StatCard } from '@/components/ui-nalvita/stat-card';
import { StatusBadge } from '@/components/ui-nalvita/status-badge';
import { renderWithProviders } from '@/test/render';

describe('StatusBadge', () => {
  it('renders its label with the variant colour classes', () => {
    const { getByText } = renderWithProviders(<StatusBadge variant="critical">Severe</StatusBadge>);
    expect(getByText('Severe')).toHaveClass('bg-status-critical-bg', 'text-status-critical-fg');
  });
});

describe('EmptyState', () => {
  it('renders a plain muted line when only children are given', () => {
    const { getByText } = renderWithProviders(<EmptyState>Nothing yet</EmptyState>);
    expect(getByText('Nothing yet')).toBeInTheDocument();
  });

  it('renders an icon, title, description and action when provided', () => {
    const { getByText } = renderWithProviders(
      <EmptyState
        icon={Pill}
        title="No medicines"
        description="Add one to start tracking"
        action={<button type="button">Add</button>}
      />,
    );
    expect(getByText('No medicines')).toBeInTheDocument();
    expect(getByText('Add one to start tracking')).toBeInTheDocument();
    expect(getByText('Add')).toBeInTheDocument();
  });
});

describe('AlertBanner', () => {
  it('is a link when `to` is set', () => {
    const { getByRole } = renderWithProviders(
      <AlertBanner title="Allergies" to="/profile">
        Penicillin
      </AlertBanner>,
    );
    expect(getByRole('link')).toHaveAttribute('href', '/profile');
  });

  it('renders a plain banner without a link when `to` is omitted', () => {
    const { getByText, queryByRole } = renderWithProviders(
      <AlertBanner title="Heads up">Something to know</AlertBanner>,
    );
    expect(getByText('Something to know')).toBeInTheDocument();
    expect(queryByRole('link')).toBeNull();
  });
});

describe('SectionCard', () => {
  it('has no See all link when no destination is given', () => {
    const { queryByRole } = renderWithProviders(<SectionCard title="Vitals">body</SectionCard>);
    expect(queryByRole('link')).toBeNull();
  });

  it('shows a See all link to the destination when given', () => {
    const { getByRole } = renderWithProviders(
      <SectionCard title="Vitals" seeAllTo="/vitals">
        body
      </SectionCard>,
    );
    expect(getByRole('link', { name: /see all/i })).toHaveAttribute('href', '/vitals');
  });
});

describe('StatCard', () => {
  it('renders the value and hint, links to the destination', () => {
    const { getByText, getByRole } = renderWithProviders(
      <StatCard icon={Pill} label="Medicines" value="3" hint="1 refill due" to="/medicines" />,
    );
    expect(getByText('3')).toBeInTheDocument();
    expect(getByText('1 refill due')).toBeInTheDocument();
    expect(getByRole('link')).toHaveAttribute('href', '/medicines');
  });

  it('hides the value while loading', () => {
    const { queryByText } = renderWithProviders(
      <StatCard icon={Pill} label="Medicines" value="3" to="/medicines" isLoading />,
    );
    expect(queryByText('3')).toBeNull();
  });
});

describe('PageShell', () => {
  it('renders the sidebar nav and the page body', () => {
    const { getByText, getAllByRole } = renderWithProviders(
      <PageShell>
        <p>Page content</p>
      </PageShell>,
    );
    expect(getByText('Page content')).toBeInTheDocument();
    // Nav appears in both the desktop sidebar and the mobile row.
    const documentsLinks = getAllByRole('link', { name: 'Documents' });
    expect(documentsLinks.length).toBeGreaterThan(0);
    expect(documentsLinks[0]).toHaveAttribute('href', '/documents');
    expect(getAllByRole('link', { name: 'Settings' })[0]).toHaveAttribute('href', '/settings');
  });
});
