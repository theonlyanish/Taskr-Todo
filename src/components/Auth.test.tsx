import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Auth } from './Auth';
import { AuthService } from '../services/authService';

jest.mock('../services/supabaseClient', () => ({ supabase: {}, supabaseConfig: { url: '', key: '' } }));

const renderDialog = () => render(<Auth onAuthStateChange={jest.fn()} onClose={jest.fn()} />);

describe('signing in with Google', () => {
  it('offers Google once it’s switched on for the project', async () => {
    jest.spyOn(AuthService, 'googleSignInEnabled').mockResolvedValue(true);
    renderDialog();
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('leaves it out until then', async () => {
    jest.spyOn(AuthService, 'googleSignInEnabled').mockResolvedValue(false);
    renderDialog();
    // Let the settings check finish
    await screen.findByRole('button', { name: 'Create account' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
  });

  it('heads to Google when clicked, and says so if that fails', async () => {
    jest.spyOn(AuthService, 'googleSignInEnabled').mockResolvedValue(true);
    const signIn = jest.spyOn(AuthService, 'signInWithGoogle').mockRejectedValue(new Error('Unsupported provider'));
    renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(signIn).toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // The button is back for another try
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  });
});
