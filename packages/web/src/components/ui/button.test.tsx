import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies variant classes and merges custom ones', () => {
    render(
      <Button variant="destructive" className="custom-class">
        Delete
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.className).toContain('bg-destructive');
    expect(button.className).toContain('custom-class');
  });

  it('renders as the child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/records">Records</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Records' });
    expect(link).toHaveAttribute('href', '/records');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
