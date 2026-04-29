import { supabase } from "@/lib/supabase"
import type { AppConfig } from "@/lib/types"

const DEFAULT_CONFIG: AppConfig = {
  itcMatchToleranceInr: 1,
  maxFileRows: 10000,
  requestIdPrefix: "RECON",
  supportedInvoiceTypes: "B2B",
  appVersion: "1.0.0",
  maintenanceMode: false,
  freeTierMaxRows: 200,
  freeTierMaxReconciliations: 15,
  showSampleDataButton: true,
}

let cachedConfig: AppConfig | null = null
let cacheFetchedAt = 0
const CACHE_MS = 60_000

function parseBoolean(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined) return fallback
  const v = val.trim().toLowerCase()
  if (["true", "1", "yes", "y"].includes(v)) return true
  if (["false", "0", "no", "n"].includes(v)) return false
  return fallback
}

function parseNumber(val: string | undefined, fallback: number): number {
  if (val === undefined) return fallback
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

export function mapAppConfigRows(
  rows: { key: string; value: string }[],
): AppConfig {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<
    string,
    string | undefined
  >

  return {
    itcMatchToleranceInr: parseNumber(map.itc_match_tolerance_inr, DEFAULT_CONFIG.itcMatchToleranceInr),
    maxFileRows: parseNumber(map.max_file_rows, DEFAULT_CONFIG.maxFileRows),
    requestIdPrefix: map.request_id_prefix?.trim() || DEFAULT_CONFIG.requestIdPrefix,
    supportedInvoiceTypes:
      map.supported_invoice_types?.trim() || DEFAULT_CONFIG.supportedInvoiceTypes,
    appVersion: map.app_version?.trim() || DEFAULT_CONFIG.appVersion,
    maintenanceMode: parseBoolean(map.maintenance_mode, DEFAULT_CONFIG.maintenanceMode),
    freeTierMaxRows: parseNumber(map.free_tier_max_rows, DEFAULT_CONFIG.freeTierMaxRows),
    freeTierMaxReconciliations: parseNumber(
      map.free_tier_max_reconciliations,
      DEFAULT_CONFIG.freeTierMaxReconciliations,
    ),
    showSampleDataButton: parseBoolean(
      map.show_sample_data_button,
      DEFAULT_CONFIG.showSampleDataButton,
    ),
  }
}

export async function getAppConfig(): Promise<AppConfig> {
  const now = Date.now()
  if (cachedConfig && now - cacheFetchedAt < CACHE_MS) {
    return cachedConfig
  }

  try {
    const { data, error } = await supabase.from("app_config").select("key, value")
    if (error || !data?.length) {
      cachedConfig = DEFAULT_CONFIG
      cacheFetchedAt = now
      return DEFAULT_CONFIG
    }
    cachedConfig = mapAppConfigRows(data)
    cacheFetchedAt = now
    return cachedConfig
  } catch {
    cachedConfig = DEFAULT_CONFIG
    cacheFetchedAt = now
    return DEFAULT_CONFIG
  }
}

export async function getConfigValue(key: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", key)
      .maybeSingle()
    if (error || !data?.value) {
      return ""
    }
    return data.value
  } catch {
    return ""
  }
}

export function getDefaultAppConfig(): AppConfig {
  return { ...DEFAULT_CONFIG }
}
