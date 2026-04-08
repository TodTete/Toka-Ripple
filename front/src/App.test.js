import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Toka Ripple shell', () => {
  render(<App />);
  expect(screen.getByText(/Toka Ripple/i)).toBeInTheDocument();
});
