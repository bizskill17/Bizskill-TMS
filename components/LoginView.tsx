
import React, { useState } from 'react';
import { Building2, Mail, Lock, Loader2, AlertCircle, ChevronRight, Eye, EyeOff } from 'lucide-react';

interface LoginViewProps {
  onLogin: (orgId: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isAuthenticating: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, isAuthenticating }) => {
  const [orgId, setOrgId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!orgId || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    const result = await onLogin(orgId, email, password);
    if (!result.success) {
      setError(result.error || 'Invalid credentials.');
    }
  };

  return (
    <div className="flex-1 h-full w-full bg-[#f8faff] flex items-center justify-center p-4 font-inter">
      <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-xl shadow-indigo-100 mb-4 border border-indigo-50">
            <img 
              src="https://i.ibb.co/YBSjM7Gg/Chat-GPT-Image-Dec-18-2025-10-23-18-AM.png" 
              className="h-16 w-16 object-contain" 
              alt="TaskPro Logo" 
            />
          </div>
          <h1 className="text-3xl font-extrabold text-[#1a1a1a] tracking-tight">TaskPro</h1> 
          <p className="text-gray-400 mt-1 text-xs uppercase tracking-[0.2em] font-bold">by BizSkill</p> 
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
          <div className="p-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest ml-1">Org Id</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                    <Building2 size={20} />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-12 pr-4 py-4 bg-[#fcfdfe] border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-gray-900 transition-all font-medium"
                    placeholder="your-org-id"
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                    <Mail size={20} />
                  </div>
                  <input 
                    type="email"
                    className="block w-full pl-12 pr-4 py-4 bg-[#fcfdfe] border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-gray-900 transition-all font-medium"
                    placeholder="bizskill17@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest ml-1">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                    <Lock size={20} />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="block w-full pl-12 pr-12 py-4 bg-[#fcfdfe] border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-gray-900 transition-all font-medium"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-[#fff5f5] border-2 border-dashed border-[#ffc9c9] rounded-2xl flex items-center gap-3 text-[#e03131] animate-in shake duration-300">
                  <div className="bg-[#ffc9c9] p-2 rounded-full">
                    <AlertCircle size={20} className="shrink-0" />
                  </div>
                  <p className="text-[13px] font-semibold leading-tight">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-3 py-5 bg-[#3b5bdb] text-white rounded-2xl font-bold hover:bg-[#364fc7] focus:ring-4 focus:ring-[#3b5bdb40] transition-all shadow-[0_10px_20px_rgba(59,91,219,0.3)] disabled:opacity-70 group"
              >
                {isAuthenticating ? (
                  <Loader2 className="animate-spin" size={22} />
                ) : (
                  <>
                    <span className="text-base">Login</span>
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
