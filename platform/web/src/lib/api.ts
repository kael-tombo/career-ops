import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export function useApi<T>(path: string | null) {
  const { getToken } = useAuth();

  const fetcher = async (url: string) => {
    const token = await getToken();
    const res = await fetch(API_URL + url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('API Error');
    }

    return res.json() as Promise<T>;
  };

  return useSWR<T>(path, fetcher);
}

export async function fetchApi(path: string, options: RequestInit, getToken: () => Promise<string | null>) {
  const token = await getToken();
  const res = await fetch(API_URL + path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error('API Error');
  }

  if (res.status !== 204) {
    return res.json();
  }
}
