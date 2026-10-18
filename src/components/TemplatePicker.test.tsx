import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { templateFromTask } from '../utils/templates';
import { TemplatePicker } from './TemplatePicker';

const saved = [templateFromTask({ title: 'Client onboarding', subtasks: [{ title: 'Send welcome email' }] })];

const renderPicker = () => {
  const handlers = { onUse: jest.fn(), onDelete: jest.fn(), onClose: jest.fn() };
  render(<TemplatePicker saved={saved} {...handlers} />);
  return handlers;
};

describe('the template picker', () => {
  it('lists the built-in templates and yours, with subtask counts', () => {
    renderPicker();
    expect(screen.getByRole('button', { name: /Weekly review\s*5 subtasks/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Client onboarding\s*1 subtask/ })).toBeInTheDocument();
  });

  it('uses a template when it’s clicked', () => {
    const { onUse } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Packing list/ }));
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ title: 'Packing list' }));
  });

  it('only lets you delete your own templates, and asks first', () => {
    const { onDelete } = renderPicker();
    // Built-in ones have no delete button
    expect(screen.getAllByRole('button', { name: /Delete the/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Delete the “Client onboarding” template' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete “Client onboarding”?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(saved[0].id);
  });

  it('closes with Escape, after first backing out of a delete', () => {
    const { onClose } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Delete the “Client onboarding”/ }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete “Client onboarding”?')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
