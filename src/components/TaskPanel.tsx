import React, { useLayoutEffect, useRef } from 'react';

interface TaskPanelProps {
  mobile: boolean;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  summary?: React.ReactNode;
}

// Native modal behavior supplies focus containment, Escape, and inert background
// content. The desktop keeps its existing companion column.
export const TaskPanel: React.FC<TaskPanelProps> = ({ mobile, open, onClose, children, summary }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!mobile || !open || !dialog) return;

    const returnFocus = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = { position: body.style.position, top: body.style.top, width: body.style.width };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('#task-title')?.focus({ preventScroll: true });
    // Keep actions above the on-screen keyboard on browsers that resize only
    // the visual viewport rather than the CSS layout viewport.
    const viewport = window.visualViewport;
    const fitViewport = () => {
      if (!viewport) return;
      dialog.style.setProperty('--task-panel-available-height', `${viewport.height}px`);
      dialog.style.setProperty('--task-panel-bottom', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
    };
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);

    return () => {
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      dialog.close();
      Object.assign(body.style, previous);
      const root = document.documentElement;
      const scrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, scrollY);
      root.style.scrollBehavior = scrollBehavior;
      const focusTarget = returnFocus?.isConnected ? returnFocus : document.querySelector<HTMLElement>('.mobile-task-toolbar button');
      focusTarget?.focus({ preventScroll: true });
    };
  }, [mobile, open]);

  if (!mobile) return <div className="task-detail-column">{children}{summary}</div>;

  return (
    <>
      {summary && <div className="task-detail-column">{summary}</div>}
      {open && <dialog
        ref={dialogRef}
        className="mobile-task-dialog"
        aria-labelledby="task-form-title"
        onCancel={event => {
          event.preventDefault();
          if (!dialogRef.current?.querySelector('[aria-busy="true"]')) onClose();
        }}
      >
        {children}
      </dialog>}
    </>
  );
};
