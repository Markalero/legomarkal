import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AddSetDialog } from '@/components/add-set-dialog';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe('AddSetDialog Component', () => {
  it('renders the trigger button', () => {
    render(<AddSetDialog />);
    expect(screen.getByText('Añadir Set')).toBeInTheDocument();
  });

  it('opens the dialog and allows entering a Product ID', async () => {
    render(<AddSetDialog />);
    
    // Open dialog
    const button = screen.getByText('Añadir Set');
    await userEvent.click(button);
    
    // Check dialog title
    expect(screen.getByText('Añadir Nuevo Set')).toBeInTheDocument();
    
    // Type into product_id field
    const input = screen.getByLabelText(/ID del Set/i);
    await userEvent.type(input, '75192');
    expect(input).toHaveValue('75192');
  });
});
