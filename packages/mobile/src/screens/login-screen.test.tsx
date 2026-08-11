import { NalvitaDataProvider } from '@nalvita/data';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { LoginScreen } from './login-screen';

const signInWithOtp = jest.fn(async () => ({ data: {}, error: null }));
const verifyOtp = jest.fn(async () => ({ data: {}, error: null }));

const client = { auth: { signInWithOtp, verifyOtp } } as unknown as SupabaseClient;

function renderLogin(ui: ReactElement) {
  return render(
    <NalvitaDataProvider client={client} appBaseUrl="https://nalvita.test" openUrl={jest.fn()}>
      {ui}
    </NalvitaDataProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginScreen', () => {
  it('will not send until the address looks like one', () => {
    renderLogin(<LoginScreen />);

    const send = screen.getByRole('button', { name: 'Email me a code' });
    expect(send).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText('Email address'), 'amma@example.com');
    expect(send).toBeEnabled();
  });

  it('moves to the code step once the email is on its way', async () => {
    renderLogin(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('Email address'), 'amma@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));

    await waitFor(() => expect(screen.getByLabelText('Six digit code')).toBeVisible());
    expect(signInWithOtp).toHaveBeenCalled();
    // The address is repeated back, so a typo is obvious before waiting for mail.
    expect(screen.getByText(/amma@example\.com/)).toBeVisible();
  });

  it('verifies the code the person types', async () => {
    renderLogin(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('Email address'), 'amma@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    await waitFor(() => expect(screen.getByLabelText('Six digit code')).toBeVisible());

    fireEvent.changeText(screen.getByLabelText('Six digit code'), '123456');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith({
        email: 'amma@example.com',
        token: '123456',
        type: 'email',
      }),
    );
  });

  it('shows a plain message when the code is refused, and keeps them on the step', async () => {
    verifyOtp.mockResolvedValueOnce({ data: {}, error: { status: 403 } } as never);
    renderLogin(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('Email address'), 'amma@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    await waitFor(() => expect(screen.getByLabelText('Six digit code')).toBeVisible());

    fireEvent.changeText(screen.getByLabelText('Six digit code'), '000000');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText(/not right, or it has expired/i)).toBeVisible());
    expect(screen.getByLabelText('Six digit code')).toBeVisible();
  });

  it('lets someone go back and correct the address', async () => {
    renderLogin(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('Email address'), 'amma@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    await waitFor(() => expect(screen.getByLabelText('Six digit code')).toBeVisible());

    fireEvent.press(screen.getByRole('button', { name: 'Use a different email' }));

    expect(screen.getByLabelText('Email address')).toBeVisible();
  });
});
