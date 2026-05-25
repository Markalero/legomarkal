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

export async function getSet(id: string | number) {
  const res = await fetch(`${API_URL}/sets/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch set ${id}`);
  return res.json();
}

export async function getSales() {
  const res = await fetch(`${API_URL}/sales/`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch sales');
  return res.json();
}

export async function getPortfolioHistory() {
  const res = await fetch(`${API_URL}/metrics/history`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch portfolio history');
  return res.json();
}

export async function getTopPerformers() {
  const res = await fetch(`${API_URL}/metrics/top-performers`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch top performers');
  return res.json();
}
