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

describe('moving the selection to another list', () => {
  const work = { id: 'work', name: 'Work', color: '#00a676', createdAt: '2026-10-20T00:00:00.000Z' };

  it('offers the other lists and moves the selection to the one picked', () => {
    const onMoveToList = jest.fn();
    render(
      <BulkActionBar count={2} total={5} onMove={jest.fn()} onDelete={jest.fn()} onSelectAll={jest.fn()} onDone={jest.fn()}
        otherLists={[work]} onMoveToList={onMoveToList} />
    );
    const picker = screen.getByRole('combobox', { name: 'Move selected tasks to another list' });
    expect(picker).toBeEnabled();
    fireEvent.change(picker, { target: { value: 'work' } });
    expect(onMoveToList).toHaveBeenCalledWith('work');
  });

  it('isn’t shown with only one list', () => {
    render(
      <BulkActionBar count={2} total={5} onMove={jest.fn()} onDelete={jest.fn()} onSelectAll={jest.fn()} onDone={jest.fn()}
        otherLists={[]} onMoveToList={jest.fn()} />
    );
    expect(screen.queryByRole('combobox', { name: 'Move selected tasks to another list' })).not.toBeInTheDocument();
  });
});
