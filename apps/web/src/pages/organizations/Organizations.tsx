import React, { useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setMemberships, setCurrentOrg } from '../../store/orgSlice';
const API_URL = import.meta.env.VITE_API_URL;

const Organizations: React.FC = () => {
  const dispatch = useDispatch();
  const memberships = useSelector((s: RootState) => s.org.memberships);
  const currentOrgId = useSelector((s: RootState) => s.org.currentOrgId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const token = localStorage.getItem('protekt_token');
      const res = await fetch(`${API_URL}/api/orgs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        dispatch(setMemberships(data));
        // Do not auto-switch context. Let the user explicitly switch via the topbar or the Switch button.
      }
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, [dispatch]);

  // Create org modal
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const token = localStorage.getItem('protekt_token');
      const res = await fetch(`${API_URL}/api/orgs`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name, description }) });
      if (!res.ok) throw new Error('Create failed');
      // refetch memberships
      const listRes = await fetch(`${API_URL}/api/orgs`, { headers: { Authorization: `Bearer ${token}` } });
      if (listRes.ok) {
        const data = await listRes.json();
        dispatch(setMemberships(data));
        // Do not auto-switch to the created org. Just refresh memberships and let the user switch explicitly.
      }
      setShowCreate(false);
      setName('');
      setDescription('');
    } catch (e) {
      // ignore for now
    } finally {
      setCreating(false);
    }
  };

  const handleSwitch = (orgId: string, role: string) => {
    dispatch(setCurrentOrg({ orgId, role }));
  };

  const show = useToast();

  // Allow owner to change their own role on the org (toggle OWNER <-> MEMBER for demo)
  const handleToggleMyRole = async (orgId: string, currentRole: string) => {
    // toggle between OWNER and MEMBER for demo purposes
    const newRole = currentRole === 'OWNER' ? 'MEMBER' : 'OWNER';
  const token = localStorage.getItem('protekt_token');
    try {
      const res = await fetch(`${API_URL}/api/orgs/${encodeURIComponent(orgId)}/members/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('update failed');
      // refresh memberships
      const listRes = await fetch(`${API_URL}/api/orgs`, { headers: { Authorization: `Bearer ${token}` } });
      if (listRes.ok) {
        const data = await listRes.json();
        dispatch(setMemberships(data));
        // if the user is currently scoped to this org, update the role in store
        if (currentOrgId === orgId) {
          const me = data.find((m: any) => m.org.id === orgId);
          if (me) dispatch(setCurrentOrg({ orgId, role: me.role }));
        }
      }
      show('Role updated', 'success');
    } catch (e) {
      show('Role update failed', 'error');
    }
  };

  return (
    <div className="panel">
      <h2>Organizations</h2>
      {loading && <div>Loading…</div>}
      {!loading && (
        <div>
          {memberships.length === 0 && <div>You don't belong to any organizations yet.</div>}
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setShowCreate(true)}>Create organization</button>
          </div>
          <ul>
            {memberships.map((m: any) => (
              <li key={m.org.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{m.org.name}</div>
                  <div className="muted small">Role: {m.role}</div>
                </div>
                <div>
                  <button className="btn btn-outline" onClick={() => handleSwitch(m.org.id, m.role)} aria-label={`Switch to ${m.org.name}`}>
                    {currentOrgId === m.org.id ? 'Active' : 'Switch'}
                  </button>
                  {m.role === 'OWNER' && (
                    <button className="btn" style={{ marginLeft: 8 }} onClick={() => handleToggleMyRole(m.org.id, m.role)}>
                      Toggle my role
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showCreate && (
        <div className="modal">
          <div className="modal-content">
            <h3>Create organization</h3>
            <label className="form-label">Name</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="form-label">Description</label>
            <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" onClick={handleCreate} disabled={creating || !name}>Create</button>
              <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Organizations;
