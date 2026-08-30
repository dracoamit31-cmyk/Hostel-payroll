import React, { useState, useEffect } from 'react';
import { User, Property, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { isProduction } from '../config/env';
import { formatInternalEmail } from '../supabaseClient';
import {
  Lock,
  Phone,
  KeyRound,
  LogIn,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  CheckCircle2,
  Terminal,
} from 'lucide-react';

export default function DevLogin() {
  const { loginWithPhonePin, isSupabaseConfigured, isProduction: isProd } = useAuth();

  const [phone, setPhone] = useState<string>('+91 98765 00001');
  const [pin, setPin] = useState<string>('123456');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Available users for quick selection during development
  const [users, setUsers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);

  useEffect(() => {
    async function loadMockProfiles() {
      try {
        setLoadingUsers(true);
        const [uList, pList] = await Promise.all([
          dataService.getUsers(),
          dataService.getProperties(),
        ]);
        setUsers(uList);
        setProperties(pList);
      } catch (err) {
        console.error('Failed to load user profiles:', err);
      } finally {
        setLoadingUsers(false);
      }
    }
    loadMockProfiles();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();

    if (!cleanPhone) {
      setErrorMessage('Please enter your phone number.');
      return;
    }

    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6) {
      setErrorMessage('PIN must be between 4 and 6 digits.');
      return;
    }

    try {
      setLoading(true);
      const result = await loginWithPhonePin(cleanPhone, cleanPin);

      if (!result.success) {
        setErrorMessage(result.error || 'Authentication failed. Please check your credentials.');
      } else {
        setSuccessMessage('Authentication successful! Routing to dashboard...');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during login.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelectUser = (user: User) => {
    setPhone(user.phone);
    setPin('123456');
    setErrorMessage(null);
  };

  const getPropertyName = (propertyId: string | null) => {
    if (!propertyId) return 'All Properties (HQ)';
    return properties.find((p) => p.id === propertyId)?.name || 'Property';
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
      case 'manager':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/60';
      case 'inventory_manager':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
      case 'staff':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
    }
  };

  const internalEmailPreview = phone ? formatInternalEmail(phone) : '—';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-xl shadow-indigo-600/30 text-white mb-1">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            HostelOps Login
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Sign in with your registered phone number and secure PIN.
          </p>

          {/* Environment Banner */}
          <div className="pt-1 flex justify-center">
            {isProd ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Production Mode (Supabase Auth & Database)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                <Terminal className="w-3 h-3 text-indigo-400" />
                Development Mode (Local / In-Memory)
              </span>
            )}
          </div>
        </div>

        {/* Missing Config Alert in Production */}
        {isProd && !isSupabaseConfigured && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Production Supabase Configuration Missing</span>
            </div>
            <p className="leading-relaxed text-rose-300/90">
              In production mode (<code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono">VITE_APP_ENV=production</code>), <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> must be set in Netlify environment variables.
            </p>
          </div>
        )}

        {/* Main Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Field 1: Phone Number */}
            <div className="space-y-1.5">
              <label htmlFor="input-phone" className="block text-xs font-semibold text-slate-300">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="input-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 00001"
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono transition"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span>Internal Supabase Auth ID:</span>
                <span className="font-mono text-slate-400 truncate max-w-[200px]">
                  {internalEmailPreview}
                </span>
              </div>
            </div>

            {/* Field 2: PIN */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="input-pin" className="block text-xs font-semibold text-slate-300">
                  Security PIN (4-6 digits)
                </label>
                <span className="text-[11px] text-slate-500">Default PIN: 123456</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="input-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 4-6 digit PIN"
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-submit-login"
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Log In
                </>
              )}
            </button>
          </form>

          {/* Architecture note */}
          <div className="pt-3 border-t border-slate-800 flex items-start gap-2 text-[11.5px] text-slate-400">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Phone number + PIN login is authenticated securely using internal credentials (<code className="text-slate-300 font-mono text-[11px]">{`{phone}@hostelops.internal`}</code>).
            </p>
          </div>
        </div>

        {/* Quick-Select Personas (Active in dev or demo) */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Quick Test Personas
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Click to autofill credentials
            </span>
          </div>

          {loadingUsers ? (
            <div className="py-4 text-center text-xs text-slate-500">
              Loading personas...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {users.slice(0, 8).map((u) => {
                const isSelected = phone === u.phone;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickSelectUser(u)}
                    className={`text-left p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500/80 ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-xs text-white truncate">
                        {u.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase ${getRoleBadge(
                          u.role
                        )}`}
                      >
                        {u.role.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{u.phone}</span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[90px]">
                        {getPropertyName(u.propertyId)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
