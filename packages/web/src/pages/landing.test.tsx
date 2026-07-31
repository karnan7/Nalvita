import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import LandingPage from './landing';
import { renderWithProviders } from '@/test/render';

describe('LandingPage', () => {
  it('renders the hero, sample record and calls to action', async () => {
    renderWithProviders(<LandingPage />);

    expect(
      await screen.findByRole('heading', { name: /your family's entire health history/i }),
    ).toBeInTheDocument();
    // Sample record preview and its status pills.
    expect(screen.getByText('Amma · 68')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    // Both the nav and the hero point at the waitlist section.
    expect(screen.getAllByRole('link', { name: 'Join the waitlist' }).length).toBeGreaterThan(0);
  });

  it('confirms the address after joining the waitlist', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);

    await user.type(await screen.findByLabelText('Email address'), 'parent@example.com');
    await user.click(screen.getByRole('button', { name: 'Notify me' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/you're on the list/i);
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
  });

  it('expands one FAQ answer at a time', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);

    const first = await screen.findByRole('button', { name: 'Is it free?' });
    const second = screen.getByRole('button', { name: 'Who can see my records?' });
    expect(first).toHaveAttribute('aria-expanded', 'false');

    await user.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');

    // Opening another question collapses the first.
    await user.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });
});
