import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ManageSetDialog } from '@/components/manage-set-dialog';

// Mock router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const mockSet = {
  id: 1,
  product_id: '75192',
  name: 'Millennium Falcon',
  theme: 'Star Wars',
  buy_price: 799.99,
  current_price: 850.0,
  target_price: 900.0,
  condition: 'MISB',
  notes: 'Box slightly dented',
  image_url: 'http://example.com/falcon.jpg',
  status: 'IN_STOCK'
};

describe('ManageSetDialog Component', () => {
  it('renders the trigger button', () => {
    render(<ManageSetDialog set={mockSet} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('opens the dialog with set details', async () => {
    render(<ManageSetDialog set={mockSet} />);
    
    // Open dialog
    await userEvent.click(screen.getByRole('button'));
    
    // Check dialog content
    expect(screen.getByText('Gestionar Set: Millennium Falcon')).toBeInTheDocument();
    
    // Verify inputs
    const sellPriceInput = screen.getByLabelText(/Precio Venta/i);
    expect(sellPriceInput).toBeInTheDocument();
  });
});
