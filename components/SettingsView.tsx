import React, { useEffect, useState } from 'react';
import { Save, Key, MessageSquare, Database, Loader2 } from 'lucide-react';
import { AppSettings } from '../types';
import { useLabels } from '../labelOverrides';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => Promise<void> | void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdate }) => {
  const { getViewLabel } = useLabels();
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setIsSaved(false);
  };

  const inputClass = "w-full px-4 py-2.5 bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-gray-900 transition-all";
  const labelClass = "text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1.5";

  return (
    <div className="space-y-6 pb-10 max-w-5xl mx-auto">
	      <div className="flex justify-between items-center">
	        <div>
	          <h2 className="text-2xl font-bold text-indigo-600">{getViewLabel('settings', 'Application Settings')}</h2>
	          <p className="text-sm text-gray-500 mt-1">Configure global tokens and external API credentials</p>
	        </div>
        {isSaved && (
          <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium animate-in fade-in slide-in-from-right-4 duration-300">
            Settings saved successfully!
          </span>
        )}
      </div>

	      <form onSubmit={async (e) => {
          e.preventDefault();
          setIsSaving(true);
          setSaveError('');
          setIsSaved(false);

          try {
            await onUpdate(formData);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
          } catch (error: any) {
            setSaveError(error?.message || 'Failed to save settings.');
          } finally {
            setIsSaving(false);
          }
        }} className="space-y-8">
        {/* Core Integration Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
          <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <Key className="text-indigo-600" size={18} />
            <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide">Core Office & Bot Integration</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className={labelClass}>Office Token ID</label>
              <input name="officeTokenId" value={formData.officeTokenId} onChange={handleChange} className={inputClass} placeholder="Enter Token ID" />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Office Telegram Group ID</label>
              <input name="officeTelegramGroupId" value={formData.officeTelegramGroupId} onChange={handleChange} className={inputClass} placeholder="-100xxxxxxxx" />
            </div>
          </div>
        </div>

        {/* MAS Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
          <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <Database className="text-indigo-600" size={18} />
            <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide">MAS Credentials</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className={labelClass}>MAS ID</label>
              <input name="masId" value={formData.masId} onChange={handleChange} className={inputClass} placeholder="Enter MAS Identification" />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>MAS Password</label>
              <input name="masPassword" type="password" value={formData.masPassword} onChange={handleChange} className={inputClass} placeholder="••••••••" />
            </div>
          </div>
        </div>

	        {/* Meta (WhatsApp API) Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
          <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <MessageSquare className="text-indigo-600" size={18} />
            <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide">Meta / WhatsApp Business Settings</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-1">
              <label className={labelClass}>Permanent Meta Access Token</label>
              <input name="metaAccessToken" value={formData.metaAccessToken} onChange={handleChange} className={inputClass} placeholder="EAAxxxx..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className={labelClass}>Phone Number ID</label>
                <input name="metaPhoneNumberId" value={formData.metaPhoneNumberId} onChange={handleChange} className={inputClass} placeholder="1234567890" />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>WABA ID</label>
                <input name="metaWabaId" value={formData.metaWabaId} onChange={handleChange} className={inputClass} placeholder="1234567890" />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Webhook Verify Token</label>
                <input name="metaVerifyToken" value={formData.metaVerifyToken} onChange={handleChange} className={inputClass} placeholder="secure_verify_token" />
              </div>
            </div>
          </div>
	        </div>

	        <div className="flex justify-end pt-4">
          {saveError && (
            <span className="mr-3 px-3 py-2 bg-red-100 text-red-700 rounded text-sm font-medium">
              {saveError}
            </span>
          )}
          <button 
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md font-bold text-sm uppercase tracking-wide"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? 'Saving...' : 'Save All Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};
