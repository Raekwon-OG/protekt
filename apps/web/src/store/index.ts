import { configureStore } from '@reduxjs/toolkit';
import orgReducer from './orgSlice';

export const store = configureStore({
  reducer: { org: orgReducer },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Persist org slice to localStorage whenever it changes
store.subscribe(() => {
  try {
    const s = store.getState();
    const payload = { currentOrgId: s.org.currentOrgId, role: s.org.role, memberships: s.org.memberships };
    localStorage.setItem('protekt_org', JSON.stringify(payload));
  } catch (e) {
    // ignore
  }
});
