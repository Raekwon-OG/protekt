import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Membership = { org: { id: string; name: string; slug?: string }; role: string };

type OrgState = {
  currentOrgId: string | null;
  role: string | null; // role in current org or 'USER' for standalone
  memberships: Membership[];
};

const loadFromStorage = (): OrgState => {
  try {
    const raw = localStorage.getItem('protekt_org');
    if (!raw) return { currentOrgId: null, role: null, memberships: [] };
    const parsed = JSON.parse(raw) as OrgState;
    return { currentOrgId: parsed.currentOrgId ?? null, role: parsed.role ?? null, memberships: parsed.memberships ?? [] };
  } catch (e) {
    return { currentOrgId: null, role: null, memberships: [] };
  }
};

const initialState: OrgState = loadFromStorage();

const slice = createSlice({
  name: 'org',
  initialState,
  reducers: {
    setMemberships(state, action: PayloadAction<Membership[]>) {
      state.memberships = action.payload;
    },
    setCurrentOrg(state, action: PayloadAction<{ orgId: string | null; role: string | null }>) {
      state.currentOrgId = action.payload.orgId;
      state.role = action.payload.role;
    },
  },
});

export const { setMemberships, setCurrentOrg } = slice.actions;
export default slice.reducer;
