// Interfaces TypeScript del dominio LegoMarkal — espejo de los schemas Pydantic del backend

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
}

// ── Productos ─────────────────────────────────────────────────────────────────

export type Condition = "SEALED" | "OPEN_COMPLETE" | "OPEN_INCOMPLETE";
export type Availability = "available" | "sold";

export interface SaleReceipt {
  id: string;
  filename: string;
  storage_path: string;
  uploaded_at: string;
}

export interface Product {
  id: string;
  set_number: string | null;
  name: string;
  theme: string | null;
  year_released: number | null;
  condition: Condition | null;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  quantity: number;
  images: string[];
  notes: string | null;
  availability: Availability;
  sold_date: string | null;
  sold_price: number | null;
  sale_receipts: SaleReceipt[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  latest_market_price?: MarketPrice | null;
}

export interface ProductCreate {
  set_number?: string;
  name: string;
  theme?: string;
  year_released?: number;
  condition?: Condition;
  purchase_price?: number;
  purchase_date?: string | null;
  purchase_source?: string | null;
  quantity?: number;
  images?: string[];
  notes?: string | null;
  availability?: Availability;
}

export interface ProductQuickCreate {
  set_number: string;
  condition: Condition;
  purchase_price: number;
  purchase_date?: string | null;
  purchase_source?: string | null;
  quantity?: number;
  notes?: string | null;
}

export interface ProductUpdate extends Partial<ProductCreate> {
  sold_date?: string | null;
  sold_price?: number | null;
}

export interface ProductListOut {
  items: Product[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ProductFilters {
  search?: string;
  theme?: string;
  condition?: Condition;
  availability?: Availability;
  page?: number;
  size?: number;
}

// ── Precios de mercado ────────────────────────────────────────────────────────

export type PriceSource = "bricklink" | "brickeconomy" | "ebay";

export interface MarketPrice {
  id: string;
  product_id: string;
  source: PriceSource;
  price_new: number | null;
  min_price_new: number | null;
  max_price_new: number | null;
  price_used: number | null;
  min_price_used: number | null;
  max_price_used: number | null;
  currency: string;
  fetched_at: string;
}

// ── Alertas de precio ─────────────────────────────────────────────────────────

export type AlertType = "PRICE_ABOVE" | "PRICE_BELOW" | "PRICE_CHANGE_PCT";

export interface PriceAlert {
  id: string;
  product_id: string;
  alert_type: AlertType;
  threshold_value: number;
  is_active: boolean;
  last_triggered: string | null;
  created_at: string;
  product?: Product;
}

export interface PriceAlertCreate {
  product_id: string;
  alert_type: AlertType;
  threshold_value: number;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_items: number;
  total_purchase_value: number;
  total_market_value: number;
  potential_margin: number;
  avg_margin_pct: number;
}

export interface TopMarginProduct {
  id: string;
  name: string;
  set_number: string | null;
  purchase_price: number | null;
  market_value: number | null;
  margin_pct: number | null;
}

export interface PriceTrendPoint {
  date: string;
  invested_value: number;
  market_value: number;
  profit_value: number;
}

export interface PriceDetailTrendPoint {
  date: string;
  min_price: number;
  avg_price: number;
  max_price: number;
}

export interface PriceInsightProduct {
  id: string;
  name: string;
  set_number: string | null;
  condition: Condition | null;
  purchase_price: number | null;
  current_market_price: number | null;
  min_market_price: number | null;
  max_market_price: number | null;
  avg_market_price: number | null;
  profit_eur: number | null;
}

export interface RealProfitSummary {
  total_sold_items: number;
  total_sold_revenue: number;
  total_real_profit: number;
  avg_profit_per_item: number;
}

export interface ProductPriceHistoryPoint {
  date: string;
  price_new: number | null;
  price_used: number | null;
  min_price_new?: number | null;
  max_price_new?: number | null;
  min_price_used?: number | null;
  max_price_used?: number | null;
}

export interface ProductPriceHistory {
  product_id: string;
  condition: Condition | null;
  guide_type: string;
  points: ProductPriceHistoryPoint[];
}

// ── Importación masiva ────────────────────────────────────────────────────────

export interface ImportResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
}

export interface FullDataImportResult {
  message: string;
  removed: Record<string, number>;
  inserted: Record<string, number>;
}

export interface FullDataResetResult {
  message: string;
  deleted: Record<string, number>;
}
