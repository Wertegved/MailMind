import { createContext, useContext, useEffect, useLayoutEffect, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { loadState, saveState, STATE_STORAGE_KEY } from '../services/storage';
import { reducer, type Action, type AppState } from './mailmind-reducer';

interface Ctx {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const MailMindContext = createContext<Ctx | null>(null);

function needsImmediatePersistence(previous: AppState, next: AppState): boolean {
  if (previous.role !== next.role ||
    previous.connection.status !== next.connection.status ||
    previous.connection.provider !== next.connection.provider ||
    previous.conversations.length !== next.conversations.length) return true;

  return next.conversations.some((conversation, index) => {
    const before = previous.conversations[index];
    return !before ||
      before.id !== conversation.id ||
      before.unread !== conversation.unread ||
      before.important !== conversation.important ||
      before.archived !== conversation.archived ||
      before.completed !== conversation.completed ||
      before.override !== conversation.override ||
      before.activity !== conversation.activity ||
      before.messages.length !== conversation.messages.length;
  });
}

export function MailMindProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const previousState = useRef(state);
  const immediatelySavedState = useRef<AppState | null>(null);

  useLayoutEffect(() => {
    if (needsImmediatePersistence(previousState.current, state)) {
      saveState(state);
      immediatelySavedState.current = state;
    }
    previousState.current = state;
  }, [state]);

  useEffect(() => {
    if (immediatelySavedState.current === state) return;

    // Debounce ordinary updates; flags and thread-changing actions are flushed synchronously above.
    const t = setTimeout(() => saveState(state), 250);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    function reloadWhenAnotherTabChangesState(event: StorageEvent) {
      if (event.key === STATE_STORAGE_KEY || event.key === null) window.location.reload();
    }

    window.addEventListener('storage', reloadWhenAnotherTabChangesState);
    return () => window.removeEventListener('storage', reloadWhenAnotherTabChangesState);
  }, []);

  return <MailMindContext.Provider value={{ state, dispatch }}>{children}</MailMindContext.Provider>;
}

export function useMailMind(): Ctx {
  const ctx = useContext(MailMindContext);
  if (!ctx) throw new Error('useMailMind must be used inside <MailMindProvider>');
  return ctx;
}
