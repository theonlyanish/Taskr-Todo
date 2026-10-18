import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { BulkActionBar } from './BulkActionBar';

const renderBar = (count: number, total = 5) => {
  const handlers = { onMove: jest.fn(), onDelete: jest.fn(), onSelectAll: jest.fn(), onDone: jest.fn() };
  render(<BulkActionBar count={count} total={total} {...handlers} />);
  return handlers;
};

describe('the bulk action bar', () => {
  it('asks you to pick tasks, with actions off, when nothing is selected yet', () => {
    renderBar(0);
    expect(screen.getByRole('status')).toHaveTextContent('Click tasks to select them');
    expect(screen.getByRole('button', { name: 'Complete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Move selected tasks to' })).toBeDisabled();
  });

  it('moves, completes and deletes the selection', () => {
    const { onMove, onDelete } = renderBar(3);
    expect(screen.getByRole('status')).toHaveTextContent('3 selected');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'In Progress' } });
    expect(onMove).toHaveBeenCalledWith('In Progress');
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(onMove).toHaveBeenLastCalledWith('Completed');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('offers Select all until everything is selected', () => {
    renderBar(5, 5);
    expect(screen.queryByRole('button', { name: 'Select all' })).not.toBeInTheDocument();
  });

  it('stops selecting from the × button', () => {
    const { onDone } = renderBar(2);
    fireEvent.click(screen.getByRole('button', { name: 'Stop selecting' }));
    expect(onDone).toHaveBeenCalled();
  });
});
