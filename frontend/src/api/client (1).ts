// src/api/client.ts
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── API helpers ──────────────────────────────────────────────────────────────

export const authApi = {
  login: (code: string, password: string) => api.post('/api/auth/login', { code, password }),
  me: () => api.get('/api/auth/me'),
};

export const farmersApi = {
  list:        (params?: any)              => api.get('/api/farmers', { params }),
  get:         (id: number)                => api.get(`/api/farmers/${id}`),
  create:      (data: any)                 => api.post('/api/farmers', data),
  update:      (id: number, data: any)     => api.put(`/api/farmers/${id}`, data),
  deactivate:  (id: number)                => api.delete(`/api/farmers/${id}`),
  importExcel: (file: File)                => { const fd = new FormData(); fd.append('file', file); return api.post('/api/farmers/import', fd); },
  exportExcel: ()                          => api.get('/api/farmers/export', { responseType: 'blob' }),
};

export const routesApi = {
  list: () => api.get('/api/routes'),
  create: (data: any) => api.post('/api/routes', data),
  update: (id: number, data: any) => api.put(`/api/routes/${id}`, data),
};

export const collectionsApi = {
  list:            (params?: any)   => api.get('/api/collections', { params }),
  dailyTotals:     (date?: string)  => api.get('/api/collections/daily-totals', { params: { date } }),
  create:          (data: any)      => api.post('/api/collections', data),
  batchSync:       (records: any[]) => api.post('/api/collections/batch', { records }),
  journal:         (params: any)    => api.get('/api/collections/journal', { params }),
  debts:           (params: any)    => api.get('/api/collections/debts', { params }),
  recordDeduction: (data: any)      => api.post('/api/collections/deduction', data),
  deleteDeduction: (id: number)     => api.delete(`/api/collections/deduction/${id}`),
  searchFarmers:   (q: string)      => api.get('/api/farmers', { params: { search: q, limit: 10 } }),
};

export const factoryApi = {
  receipts: (params?: any) => api.get('/api/factory/receipts', { params }),
  createReceipt: (data: any) => api.post('/api/factory/receipts', data),
  batches: () => api.get('/api/factory/batches'),
  createBatch: (data: any) => api.post('/api/factory/batches', data),
};

export const shopsApi = {
  list:           (params?: any) => api.get('/api/shops', { params }),
  monthlyGrid:    (params: any)  => api.get('/api/shops/monthly-grid', { params }),
  dailySummary:   (date?: string)=> api.get('/api/shops/daily-summary', { params: { date } }),
  sales:          (params?: any) => api.get('/api/shop-sales', { params }),
  createSale:     (data: any)    => api.post('/api/shop-sales', data),
  bulkSales:      (data: any)    => api.post('/api/shop-sales/bulk', data),
};

export const paymentsApi = {
  list:                (params: any) => api.get('/api/payments', { params }),
  routes:              () => api.get('/api/payments/routes'),
  recordAdvance:       (data: any) => api.post('/api/payments/advance', data),
  deleteAdvance:       (id: number) => api.delete(`/api/payments/advance/${id}`),
  approve:             (data: any) => api.post('/api/payments/approve', data),
  previewDisbursement: (params: any) => api.get('/api/disbursements/preview', { params }),
  disburseMpesa:       (data: any) => api.post('/api/disbursements/mpesa', data),
  syncStatus:          (params: any) => api.get('/api/disbursements/status', { params }),
};

export const payrollApi = {
  getPayroll:         (params: any)           => api.get('/api/payroll', { params }),
  runPayroll:         (data: any)             => api.post('/api/payroll/run', data),
  approvePayroll:     (data: any)             => api.post('/api/payroll/approve', data),
  addDeduction:       (data: any)             => api.post('/api/payroll/deduction', data),
  setSalary:          (data: any)             => api.post('/api/payroll/set-salary', data),
  removeFromPayroll:  (id: number)            => api.delete(`/api/payroll/${id}`),
  getRemittance:      (params: any)           => api.get('/api/payroll/remittance', { params, responseType: 'blob' }),
  getEmployees:       (params?: any)          => api.get('/api/payroll/employees', { params }),
  createEmployee:     (data: any)             => api.post('/api/payroll/employees', data),
  updateEmployee:     (id: number, data: any) => api.put(`/api/payroll/employees/${id}`, data),
  deactivateEmployee: (id: number)            => api.delete(`/api/payroll/employees/${id}`),
};

export const reportsApi = {
  collectionGrid:        (params: any)              => api.get('/api/reports/collection-grid', { params }),
  collectionGridExcel:   (params: any)              => api.get('/api/reports/collection-grid/excel', { params, responseType: 'blob' }),
  farmerStatement:       (farmerId: number, p: any) => api.get(`/api/reports/farmer-statement/${farmerId}`, { params: p }),
  routePerformance:      (params: any)              => api.get('/api/reports/route-performance', { params }),
  routePerformanceExcel: (params: any)              => api.get('/api/reports/route-performance/excel', { params, responseType: 'blob' }),
  paymentSummary:        (params: any)              => api.get('/api/reports/payment-summary', { params }),
  paymentSummaryExcel:   (params: any)              => api.get('/api/reports/payment-summary/excel', { params, responseType: 'blob' }),
  factoryEfficiency:     (params: any)              => api.get('/api/reports/factory-efficiency', { params }),
};
