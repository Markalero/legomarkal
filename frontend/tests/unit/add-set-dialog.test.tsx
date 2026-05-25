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

  it('fetches autocomplete data and shows readonly fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'Star Wars Millennium Falcon',
        theme: 'Star Wars',
        image_url: 'http://example.com/falcon.jpg',
        year_eol: '2017',
        retail_price: '799.99'
      })
    });
    global.alert = vi.fn();

    render(<AddSetDialog />);
    await userEvent.click(screen.getByText('Añadir Set'));
    
    const idInput = screen.getByLabelText(/ID del Set/i);
    await userEvent.type(idInput, '75192');
    
    const autocompleteBtn = screen.getByTestId('autocomplete-btn');
    await userEvent.click(autocompleteBtn);
    
    // Check that the fields appeared and have the correct extracted values
    const nameInput = await screen.findByLabelText(/Nombre Oficial \(Extraído\)/i);
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveValue('Star Wars Millennium Falcon');
    expect(nameInput).toHaveAttribute('readonly');
    
    const themeInput = await screen.findByLabelText(/Tema \(Extraído\)/i);
    expect(themeInput).toBeInTheDocument();
    expect(themeInput).toHaveValue('Star Wars');
    expect(themeInput).toHaveAttribute('readonly');

    const yearInput = await screen.findByLabelText(/Año \/ EOL \(Extraído\)/i);
    expect(yearInput).toBeInTheDocument();
    expect(yearInput).toHaveValue('2017');
    expect(yearInput).toHaveAttribute('readonly');

    const msrpInput = await screen.findByLabelText(/PVP/i);
    expect(msrpInput).toBeInTheDocument();
    expect(msrpInput).toHaveValue(799.99);

    const img = screen.getByAltText('Star Wars Millennium Falcon');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'http://example.com/falcon.jpg');
  });
});
