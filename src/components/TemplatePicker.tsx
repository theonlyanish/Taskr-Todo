import React, { useEffect, useRef, useState } from 'react';
import { BUILT_IN_TEMPLATES, TaskTemplate } from '../utils/templates';

interface TemplatePickerProps {
  saved: TaskTemplate[];
  onUse: (template: TaskTemplate) => void;
  onDelete: (templateId: string) => void;
  onClose: () => void;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

// The first few subtask titles, e.g. "Clear inbox · Update the task list · +3 more"
const preview = (template: TaskTemplate) => {
  const titles = template.subtasks.map(subtask => subtask.title);
  const shown = titles.slice(0, 3).join(' · ');
  return titles.length > 3 ? `${shown} · +${titles.length - 3} more` : shown;
};

// Choose a template to add as a new task, with its subtasks
export const TemplatePicker: React.FC<TemplatePickerProps> = ({ saved, onUse, onDelete, onClose }) => {
  const firstRef = useRef<HTMLButtonElement>(null);
  // The saved template waiting for "Delete" to be confirmed
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (confirmingDelete) setConfirmingDelete(null);
      else onClose();
    }
  };

  const row = (template: TaskTemplate, index: number) => (
    <li key={template.id} className="template-row">
      {confirmingDelete === template.id ? (
        <div className="template-confirm" role="group" aria-label={`Delete the “${template.title}” template?`}>
          <span>Delete “{template.title}”?</span>
          <button type="button" className="template-confirm-delete" onClick={() => {
            setConfirmingDelete(null);
            onDelete(template.id);
          }}>
            Delete
          </button>
          <button type="button" className="template-confirm-cancel" onClick={() => setConfirmingDelete(null)} autoFocus>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <button
            ref={index === 0 ? firstRef : undefined}
            type="button"
            className="template-use"
            onClick={() => onUse(template)}
          >
            <span className="template-title">{template.title}</span>
            <span className="template-count">{plural(template.subtasks.length, 'subtask')}</span>
            {template.subtasks.length > 0 && <span className="template-preview">{preview(template)}</span>}
          </button>
          {!template.builtIn && (
            <button
              type="button"
              className="template-delete"
              onClick={() => setConfirmingDelete(template.id)}
              aria-label={`Delete the “${template.title}” template`}
              title="Delete template"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
            </button>
          )}
        </>
      )}
    </li>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content template-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-picker-title"
        onClick={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 id="template-picker-title">Start from a template</h3>
        <p className="template-intro">Adds the task and its subtasks to To Do.</p>

        <h4 className="template-group">Built in</h4>
        <ul className="template-list">{BUILT_IN_TEMPLATES.map(row)}</ul>

        <h4 className="template-group">Yours</h4>
        {saved.length > 0 ? (
          <ul className="template-list">{saved.map((template, index) => row(template, BUILT_IN_TEMPLATES.length + index))}</ul>
        ) : (
          <p className="template-empty">
            Open any task and choose <strong>Save as template</strong> to reuse it here.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
