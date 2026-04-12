// Cliente HTTP centralizado hacia la API FastAPI — todas las llamadas pasan por aquí
import { getToken, removeToken } from "./auth";
import type {
  TokenOut,
  LoginRequest,
  Product,
  ProductCreate,
  ProductQuickCreate,
  ProductUpdate,
  ProductListOut,
  ProductFilters,
  MarketPrice,
  PriceAlert,
  PriceAlertCreate,
  DashboardSummary,
  TopMarginProduct,
  PriceTrendPoint,
  PriceDetailTrendPoint,
  PriceInsightProduct,
  RealProfitSummary,
  ProductPriceHistory,
  ImportResult,
  FullDataImportResult,
  FullDataResetResult,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Wrapper fetch con gestión de auth y errores */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      "No se pudo conectar con la API. Verifica que el backend esté levantado en " + BASE_URL
    );
  }

  if (res.status === 401) {
    removeToken();
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Error ${res.status}`);
  }

  // Respuestas 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (data: LoginRequest) =>
    request<TokenOut>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Productos ─────────────────────────────────────────────────────────────────

export const productsApi = {
  list: (filters: ProductFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        params.set(k, String(v));
      }
    });
    return request<ProductListOut>(`/products?${params.toString()}`);
  },

  get: (id: string) => request<Product>(`/products/${id}`),

  create: (data: ProductCreate) =>
    request<Product>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  quickAdd: (data: ProductQuickCreate) =>
    request<Product>("/products/quick-add", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: ProductUpdate) =>
    request<Product>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/products/${id}`, { method: "DELETE" }),

  exportCsv: async (): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/products/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.blob();
  },

  exportAllData: async (): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/products/export-all`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.blob();
  },

  bulkImport: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<ImportResult>("/products/bulk-import", {
      method: "POST",
      body: form,
    });
  },

  importAllData: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<FullDataImportResult>("/products/import-all", {
      method: "POST",
      body: form,
    });
  },

  resetAllData: () =>
    request<FullDataResetResult>("/products/reset-all", {
      method: "POST",
    }),

  uploadSaleReceipts: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return request<Product>(`/products/${id}/sale-receipts`, {
      method: "POST",
      body: form,
    });
  },

  deleteSaleReceipt: (id: string, receiptId: string) =>
    request<void>(`/products/${id}/sale-receipts/${receiptId}`, {
      method: "DELETE",
    }),

  getSaleReceiptDownloadUrl: (id: string, receiptId: string) =>
    request<{ url: string }>(
      `/products/${id}/sale-receipts/${receiptId}/download`
    ),
};

// ── Precios de mercado ────────────────────────────────────────────────────────

export const pricesApi = {
  history: (productId: string) =>
    request<MarketPrice[]>(`/market-prices/${productId}`),

  trend: (productId: string, months = 6, guideType = "sold") =>
    request<ProductPriceHistory>(
      `/market-prices/${productId}/trend?months=${months}&guide_type=${encodeURIComponent(guideType)}`
    ),

  scrape: (productId: string) =>
    request<{ message: string }>(`/market-prices/scrape/${productId}`, {
      method: "POST",
    }),
};

// ── Alertas de precio ─────────────────────────────────────────────────────────

export const alertsApi = {
  list: () => request<PriceAlert[]>("/price-alerts"),

  create: (data: PriceAlertCreate) =>
    request<PriceAlert>("/price-alerts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/price-alerts/${id}`, { method: "DELETE" }),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  summary: () => request<DashboardSummary>("/dashboard/summary"),

  topMargin: () => request<TopMarginProduct[]>("/dashboard/top-margin"),

  priceTrends: () => request<PriceTrendPoint[]>("/dashboard/price-trends"),

  priceDetailTrends: () =>
    request<PriceDetailTrendPoint[]>("/dashboard/price-detail-trends"),

  priceInsights: () => request<PriceInsightProduct[]>("/dashboard/price-insights"),

  realProfits: () => request<RealProfitSummary>("/dashboard/real-profits"),

  triggerScraper: () =>
    request<{ message: string }>("/scraper/trigger", { method: "POST" }),

  refreshAllPrices: () =>
    request<{
      message: string;
      total_products: number;
      missing_after_first: number;
      missing_after_second: number;
      spain_today: string;
    }>("/scraper/refresh-all", { method: "POST" }),

  refreshAllPricesCompat: async () => {
    try {
      const result = await dashboardApi.refreshAllPrices();
      return { mode: "sync" as const, result };
    } catch (error) {
      // Compatibilidad con backend antiguo que aún no expone /scraper/refresh-all.
      const message = error instanceof Error ? error.message : "";
      if (/Not Found|Error 404/i.test(message)) {
        await dashboardApi.triggerScraper();
        return { mode: "background" as const, result: null };
      }
      throw error;
    }
  },
};
