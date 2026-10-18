import React, { useEffect, useRef, useState } from 'react';

interface AccountMenuProps {
  email: string;
  onImport: () => void;
  onExport: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onDevices: () => void;
  onRecentlyDeleted: () => void;
}

// Signed-in user's menu in the header: account details, import, export, sign out
// and deleting the account.
// Follows the WAI-ARIA menu button pattern for keyboard and screen reader users.
export const AccountMenu: React.FC<AccountMenuProps> = ({ email, onImport, onExport, onSignOut, onDeleteAccount, onDevices, onRecentlyDeleted }) => {
  const [open, setOpen] = useState(false);
  // Which item takes focus once the menu has rendered
  const [focusOnOpen, setFocusOnOpen] = useState<'first' | 'last' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);

  // Close when clicking anywhere outside the menu
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !focusOnOpen) return;
    const list = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (list?.length) (focusOnOpen === 'first' ? list[0] : list[list.length - 1]).focus();
    setFocusOnOpen(null);
  }, [open, focusOnOpen]);

  const openMenu = (focus: 'first' | 'last' = 'first') => {
    setOpen(true);
    setFocusOnOpen(focus);
  };

  const closeMenu = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) => list[(next + list.length) % list.length]?.focus();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAt(list.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === 'Tab') {
      closeMenu(false);
    }
  };

  // Close first so the action (e.g. opening the file picker) happens with the menu gone
  const choose = (action: () => void) => {
    closeMenu(true);
    action();
  };

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="account-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu-list"
        aria-label={`Account menu for ${email}`}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="account-menu-avatar" aria-hidden="true">
          {email.charAt(0).toUpperCase()}
        </span>
        <svg className="account-menu-caret" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id="account-menu-list"
          className="account-menu-list"
          role="menu"
          aria-label="Account"
          ref={menuRef}
          onKeyDown={handleMenuKeyDown}
        >
          <div className="account-menu-email" title={email}>
            Signed in as <strong>{email}</strong>
          </div>
          <div className="account-menu-separator" role="separator" />
          <button type="button" role="menuitem" tabIndex={-1} className="account-menu-item" onClick={() => choose(onImport)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
            Import tasks
            <span className="account-menu-item-hint">Todoist or CSV</span>
          </button>
          <button type="button" role="menuitem" tabIndex={-1} className="account-menu-item" onClick={() => choose(onExport)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5M5 20h14" /></svg>
            Export tasks
            <span className="account-menu-item-hint">Markdown</span>
          </button>
          <button type="button" role="menuitem" tabIndex={-1} className="account-menu-item" onClick={() => choose(onRecentlyDeleted)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3M9.5 14.5l2.5-2.5 2.5 2.5M12 12v5" /></svg>
            Recently deleted
            <span className="account-menu-item-hint">30 days</span>
          </button>
          <div className="account-menu-separator" role="separator" />
          <button type="button" role="menuitem" tabIndex={-1} className="account-menu-item" onClick={() => choose(onDevices)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="13" height="9" rx="1.5" /><path d="M6 18h6M9 14v4" /><rect x="16.5" y="8" width="5" height="11" rx="1.2" /></svg>
            Signed-in devices
          </button>
          <button type="button" role="menuitem" tabIndex={-1} className="account-menu-item" onClick={() => choose(onSignOut)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>
            Sign out
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="account-menu-item account-menu-item-danger"
            onClick={() => choose(onDeleteAccount)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
            Delete account…
          </button>
        </div>
      )}
    </div>
  );
};
