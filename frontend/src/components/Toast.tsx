import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// Global toast state
let addToastFn: ((t: Omit<Toast, 'id'>) => void) | null = null;

export function toast(t: Omit<Toast, 'id'>) {
  addToastFn?.(t);
}
export const showSuccess = (title: string, message?: string) => toast({ type: 'success', title, message });
export const showError   = (title: string, message?: string) => toast({ type: 'error',   title, message });
export const showWarning = (title: string, message?: string) => toast({ type: 'warning', title, message });
export const showInfo    = (title: string, message?: string) => toast({ type: 'info',    title, message });

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p, { ...t, id }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), t.duration || 4000);
  }, []);

  useEffect(() => { addToastFn = addToast; return () => { addToastFn = null; }; }, [addToast]);

  const remove = (id: string) => setToasts(p => p.filter(x => x.id !== id));

  const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };
  const colors = {
    success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200',
    error:   'bg-red-50   dark:bg-red-900/30   border-red-200   dark:border-red-700   text-red-800   dark:text-red-200',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200',
    info:    'bg-blue-50  dark:bg-blue-900/30  border-blue-200  dark:border-blue-700  text-blue-800  dark:text-blue-200',
  };
  const iconColors = { success: 'text-green-500', error: 'text-red-500', warning: 'text-yellow-500', info: 'text-blue-500' };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => {
        const Icon = icons[t.type];
        return (
          <div key={t.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm pointer-events-auto transition-all animate-in slide-in-from-right-5 ${colors[t.type]}`}>
            <Icon size={18} className={`flex-shrink-0 mt-0.5 ${iconColors[t.type]}`} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{t.title}</div>
              {t.message && <div className="text-xs opacity-80 mt-0.5">{t.message}</div>}
            </div>
            <button onClick={() => remove(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
