import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth.store';
import { showSuccess, showError } from '../components/Toast';
import { User, Lock, Phone, Save } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/api/employees/me'),
  });
  const profile = data?.data || {};

  const [form, setForm] = useState({ name: '', phone: '' });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });

  useState(() => {
    if (profile.name) setForm({ name: profile.name, phone: profile.phone || '' });
  });

  const updateMut = useMutation({
    mutationFn: () => api.put('/api/employees/me', form),
    onSuccess: () => { showSuccess('Profile updated'); qc.invalidateQueries({ queryKey: ['my-profile'] }); },
    onError: (e: any) => showError('Update failed', e?.response?.data?.error),
  });

  const pwMut = useMutation({
    mutationFn: () => api.put('/api/employees/me/password', { current: pwForm.current, newPassword: pwForm.newPw }),
    onSuccess: () => { showSuccess('Password changed'); setPwForm({ current: '', newPw: '', confirm: '' }); },
    onError: (e: any) => showError('Failed', e?.response?.data?.error),
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">My Profile</h1>

      {/* Profile card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-5 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <User size={28} className="text-green-700 dark:text-green-400" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{profile.name || user?.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{profile.code} · {user?.role}</div>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Full Name', key: 'name', icon: User, placeholder: 'Your name' },
            { label: 'Phone Number', key: 'phone', icon: Phone, placeholder: '0712345678' },
        
          ].map(({ label, key, icon: Icon, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{label}</label>
              <div className="relative">
                <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}
          className="mt-4 w-full py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
          <Save size={16} />
          {updateMut.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Change password */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={18} className="text-gray-600 dark:text-gray-400" />
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">Change Password</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Current Password', key: 'current' },
            { label: 'New Password', key: 'newPw' },
            { label: 'Confirm New Password', key: 'confirm' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{label}</label>
              <input type="password"
                value={(pwForm as any)[key]}
                onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            if (pwForm.newPw !== pwForm.confirm) { showError('Passwords do not match'); return; }
            if (pwForm.newPw.length < 6) { showError('Password too short', 'Minimum 6 characters'); return; }
            pwMut.mutate();
          }}
          disabled={!pwForm.current || !pwForm.newPw || pwMut.isPending}
          className="mt-4 w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
          {pwMut.isPending ? 'Changing...' : 'Change Password'}
        </button>
      </div>
    </div>
  );
}
