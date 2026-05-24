const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export async function getDashboardMetrics() {
  const res = await fetch(`${API_URL}/metrics/dashboard`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function getSets() {
  const res = await fetch(`${API_URL}/sets/`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch sets');
  return res.json();
}

export async function getSales() {
  const res = await fetch(`${API_URL}/sales/`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch sales');
  return res.json();
}
