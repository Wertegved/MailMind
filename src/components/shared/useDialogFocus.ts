import { useEffect, useRef, type RefObject } from 'react';

const openDialogs: HTMLElement[] = [];

export function useDialogFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  initialFocusRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    openDialogs.push(dialog);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0);

    (initialFocusRef.current ?? focusable()[0] ?? dialog).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (openDialogs[openDialogs.length - 1] !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const dialogIndex = openDialogs.lastIndexOf(dialog);
      if (dialogIndex >= 0) openDialogs.splice(dialogIndex, 1);
      document.body.style.overflow = previousBodyOverflow;
      opener?.focus();
    };
  }, [dialogRef, initialFocusRef, open]);
}
