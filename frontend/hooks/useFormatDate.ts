import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useFormatDate() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (!token) return null;
      try {
        const res = await api.get('/organization/settings');
        return res.data;
      } catch (e) {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  return (dateInput: string | Date | number | null | undefined, fallback = 'Not scheduled') => {
    if (!dateInput) return fallback;
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return fallback;

    const format = settings?.dateFormat || 'YYYY-MM-DD';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    switch (format) {
      case 'MM/DD/YYYY':
        return `${mm}/${dd}/${yyyy}`;
      case 'DD-MM-YYYY':
        return `${dd}-${mm}-${yyyy}`;
      case 'YYYY-MM-DD':
      default:
        return `${yyyy}-${mm}-${dd}`;
    }
  };
}
