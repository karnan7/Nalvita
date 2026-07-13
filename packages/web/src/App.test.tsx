import { BLOOD_GROUPS } from '@nalvita/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the product name and tagline', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Nalvita' })).toBeInTheDocument();
    expect(screen.getByText(/personal health records vault/i)).toBeInTheDocument();
  });

  it('renders a chip for every blood group from core', () => {
    render(<App />);
    for (const group of BLOOD_GROUPS) {
      expect(screen.getByText(group)).toBeInTheDocument();
    }
  });
});
