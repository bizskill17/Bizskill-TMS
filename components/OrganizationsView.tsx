import React, { useMemo, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Organization } from '../types';

interface OrganizationsViewProps {
  organizations: Organization[];
  onAddOrganization: (organization: Omit<Organization, 'id' | 'hasConnection'> & { dbPassword?: string }) => Promise<void> | void;
  onUpdateOrganization: (organization: Organization & { dbPassword?: string; previousOrgId?: string }) => Promise<void> | void;
  sidebarCollapsed?: boolean;
}

const defaultForm = {
  orgId: '',
  orgName: '',
  dbMode: 'shared' as const,
  status: 'active' as const,
  domain: '',
  dbHost: '',
  dbName: '',
  dbUser: '',
  dbPassword: '',
};

export const OrganizationsView: React.FC<OrganizationsViewProps> = ({
  organizations,
  onAddOrganization,
  onUpdateOrganization,
  sidebarCollapsed = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [form, setForm] = useState(defaultForm);

  const sortedOrganizations = useMemo(
    () => [...organizations].sort((a, b) => a.orgName.localeCompare(b.orgName)),
    [organizations]
  );

  const openAdd = () => {
    setEditing(null);
    setForm(defaultForm);
    setIsModalOpen(true);
  };

  const openEdit = (organization: Organization) => {
    setEditing(organization);
    setForm({
      orgId: organization.orgId,
      orgName: organization.orgName,
      dbMode: organization.dbMode,
      status: organization.status,
      domain: organization.domain || '',
      dbHost: organization.dbHost || '',
      dbName: organization.dbName || '',
      dbUser: organization.dbUser || '',
      dbPassword: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.orgId.trim() || !form.orgName.trim()) return;

    if (editing) {
      await onUpdateOrganization({
        id: editing.id,
        orgId: form.orgId.trim().toLowerCase(),
        orgName: form.orgName.trim(),
        dbMode: form.dbMode,
        status: form.status,
        domain: form.domain.trim(),
        dbHost: form.dbHost.trim(),
        dbName: form.dbName.trim(),
        dbUser: form.dbUser.trim(),
        hasConnection: editing.hasConnection,
        previousOrgId: editing.orgId,
        dbPassword: form.dbPassword,
      });
    } else {
      await onAddOrganization({
        orgId: form.orgId.trim().toLowerCase(),
        orgName: form.orgName.trim(),
        dbMode: form.dbMode,
        status: form.status,
        domain: form.domain.trim(),
        dbHost: form.dbHost.trim(),
        dbName: form.dbName.trim(),
        dbUser: form.dbUser.trim(),
        dbPassword: form.dbPassword,
      });
    }

    setIsModalOpen(false);
    setEditing(null);
    setForm(defaultForm);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className={sidebarCollapsed ? 'pl-14 md:pl-16' : ''}>
        <h2 className="text-2xl font-bold text-indigo-600">Organizations</h2>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-200 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500">Create and manage organizations for shared or dedicated database mode.</p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm"
          >
            <Plus size={16} />
            <span>Add Organization</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-indigo-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left font-bold">Org Id</th>
                <th className="px-4 py-3 text-left font-bold">Organization</th>
                <th className="px-4 py-3 text-left font-bold">DB Mode</th>
                <th className="px-4 py-3 text-left font-bold">Status</th>
                <th className="px-4 py-3 text-left font-bold">Domain</th>
                <th className="px-4 py-3 text-left font-bold">Connection</th>
                <th className="px-4 py-3 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrganizations.map((organization) => (
                <tr key={organization.id} className="border-t border-indigo-100">
                  <td className="px-4 py-3 font-semibold text-indigo-700">{organization.orgId}</td>
                  <td className="px-4 py-3">{organization.orgName}</td>
                  <td className="px-4 py-3 uppercase">{organization.dbMode}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${organization.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {organization.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{organization.domain || '-'}</td>
                  <td className="px-4 py-3">{organization.dbMode === 'dedicated' ? (organization.hasConnection ? 'Configured' : 'Missing') : 'Existing DB'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(organization)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100"
                    >
                      <Pencil size={14} />
                      <span>Edit</span>
                    </button>
                  </td>
                </tr>
              ))}
              {sortedOrganizations.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={7}>No organizations found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-indigo-600">{editing ? 'Edit Organization' : 'Add Organization'}</h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">Close</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-900">Org Id</label>
                  <input value={form.orgId} onChange={(e) => setForm(prev => ({ ...prev, orgId: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-900">Organization Name</label>
                  <input value={form.orgName} onChange={(e) => setForm(prev => ({ ...prev, orgName: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-900">Storage</label>
                  <select value={form.dbMode} onChange={(e) => setForm(prev => ({ ...prev, dbMode: e.target.value as 'shared' | 'dedicated' }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg">
                    <option value="shared">Use Existing DB</option>
                    <option value="dedicated">Enter New DB</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-900">Status</label>
                  <select value={form.status} onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-900">Domain</label>
                  <input value={form.domain} onChange={(e) => setForm(prev => ({ ...prev, domain: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" />
                </div>
              </div>

              {form.dbMode === 'dedicated' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-900">DB Host</label>
                    <input value={form.dbHost} onChange={(e) => setForm(prev => ({ ...prev, dbHost: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900">DB Name</label>
                    <input value={form.dbName} onChange={(e) => setForm(prev => ({ ...prev, dbName: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900">DB User</label>
                    <input value={form.dbUser} onChange={(e) => setForm(prev => ({ ...prev, dbUser: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900">DB Password</label>
                    <input type="password" value={form.dbPassword} onChange={(e) => setForm(prev => ({ ...prev, dbPassword: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                  {editing ? 'Update Organization' : 'Add Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
