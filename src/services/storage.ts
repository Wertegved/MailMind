import { initialState, STATE_VERSION, type AppState } from '../state/mailmind-reducer';

export const STATE_STORAGE_KEY = `mailmind:v${STATE_VERSION}`;

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== STATE_VERSION || !Array.isArray(parsed.conversations)) return initialState;
    return {
      ...parsed,
      // An analysis that was in flight when the page closed will never finish: make it retryable.
      conversations: parsed.conversations.map((c) => (c.analysisStatus === 'pending'
        ? { ...c, analysisStatus: 'idle', analysisRequestId: undefined }
        : c)),
    };
  } catch {
    return initialState; // corrupted or unavailable storage must never crash the app
  }
}

export function saveState(state: AppState): void {
  try {
    const serialized = JSON.stringify(state);
    if (localStorage.getItem(STATE_STORAGE_KEY) === serialized) return;
    localStorage.setItem(STATE_STORAGE_KEY, serialized);
  } catch {
    /* storage full or blocked: the app keeps working in memory */
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STATE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
