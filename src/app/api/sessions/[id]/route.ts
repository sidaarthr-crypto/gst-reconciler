import { NextRequest, NextResponse } from "next/server"

import type { Database } from "@/lib/database.types"
import type {
  DocumentType,
  GSTR2BRow,
  PurchaseRegisterRow,
  ReconciliationRow,
  ReconciliationSummary,
} from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

import { buildReconciliationSummary } from "@/lib/reconcile"
import { createServerSupabase } from "@/lib/supabase-server"
import { makeMatchKey, normaliseGSTIN, normaliseInvoiceNo } from "@/lib/utils"

type G2BInsert = Database["public"]["Tables"]["gstr2b_invoices"]["Insert"]
type PRInsert = Database["public"]["Tables"]["purchase_register_invoices"]["Insert"]
type ResultInsert = Database["public"]["Tables"]["reconciliation_results"]["Insert"]

function num(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  return String(v)
}

function sanitiseTaxRate(val: unknown): string | null {
  const n = typeof val === "number" ? val : Number.parseFloat(String(val ?? ""))
  if (!Number.isFinite(n) || n < 0 || n > 999) return null
  const rounded = Math.round(n * 100) / 100
  return String(rounded)
}

function mapGstr2bRow(
  sessionId: string,
  requestId: string,
  rowIndex: number,
  row: GSTR2BRow,
): G2BInsert {
  const ng = normaliseGSTIN(row.supplierGSTIN)
  const ni = normaliseInvoiceNo(row.invoiceNumber)
  return {
    session_id: sessionId,
    request_id: requestId,
    row_index: rowIndex,
    supplier_gstin: row.supplierGSTIN,
    supplier_name: row.supplierName || null,
    supplier_filing_date: row.supplierFilingDate || null,
    supplier_period:
      row.supplierFilingPeriod?.trim() || row.supprd?.trim() || null,
    invoice_number: row.invoiceNumber,
    invoice_type: row.invoiceType || null,
    invoice_date: row.invoiceDate || null,
    invoice_value: num(row.invoiceValue),
    place_of_supply: row.placeOfSupply || null,
    reverse_charge: row.reverseCharge,
    itc_available: row.itcAvailable,
    itc_unavail_reason: row.itcUnavailableReason ?? null,
    taxable_value: num(row.taxableValue),
    igst: num(row.igst),
    cgst: num(row.cgst),
    sgst: num(row.sgst),
    cess: num(row.cess),
    tax_rate: sanitiseTaxRate(row.taxRate),
    normalised_gstin: ng,
    normalised_inv_no: ni,
    match_key: makeMatchKey(row.supplierGSTIN, row.invoiceNumber),
  }
}

function mapPrRow(
  sessionId: string,
  requestId: string,
  rowIndex: number,
  row: PurchaseRegisterRow,
): PRInsert {
  const ng = normaliseGSTIN(row.supplierGSTIN)
  const ni = normaliseInvoiceNo(row.invoiceNumber)
  return {
    session_id: sessionId,
    request_id: requestId,
    row_index: rowIndex,
    supplier_gstin: row.supplierGSTIN,
    supplier_name: row.supplierName || null,
    invoice_number: row.invoiceNumber,
    invoice_date: row.invoiceDate || null,
    taxable_value: num(row.taxableValue),
    igst: num(row.igst),
    cgst: num(row.cgst),
    sgst: num(row.sgst),
    cess: num(row.cess),
    total_invoice_value: num(row.totalInvoiceValue),
    place_of_supply: row.placeOfSupply ?? null,
    hsn_code: row.hsnCode ?? null,
    normalised_gstin: ng,
    normalised_inv_no: ni,
    match_key: makeMatchKey(row.supplierGSTIN, row.invoiceNumber),
  }
}

function mapResultRow(
  sessionId: string,
  requestId: string,
  row: ReconciliationRow,
): ResultInsert {
  return {
    session_id: sessionId,
    request_id: requestId,
    supplier_gstin: row.supplierGSTIN,
    supplier_name: row.supplierName || null,
    invoice_number: row.invoiceNumber,
    invoice_date: row.invoiceDate || null,
    place_of_supply: row.placeOfSupply || null,
    match_key: row.matchKey,
    status: row.status,
    itc_risk: row.itcRisk,
    itc_available: row.itcAvailable,
    reverse_charge: row.reverseCharge,
    taxable_2b: num(row.taxable2B),
    igst_2b: num(row.igst2B),
    cgst_2b: num(row.cgst2B),
    sgst_2b: num(row.sgst2B),
    taxable_pr: num(row.taxablePR),
    igst_pr: num(row.igstPR),
    cgst_pr: num(row.cgstPR),
    sgst_pr: num(row.sgstPR),
    taxable_diff: num(row.taxableDiff),
    igst_diff: num(row.igstDiff),
    cgst_diff: num(row.cgstDiff),
    sgst_diff: num(row.sgstDiff),
    total_itc_at_risk: num(row.totalITCAtRisk),
    recommended_action: row.recommendedAction,
    action_urgency: row.actionUrgency,
    risk_sort_order: row.riskSortOrder,
    document_type: row.documentType ?? "B2B",
  } as ResultInsert
}

async function insertChunks<T extends Record<string, unknown>>(
  sb: SupabaseClient<Database>,
  table: "gstr2b_invoices" | "purchase_register_invoices" | "reconciliation_results",
  rows: T[],
  chunkSize: number,
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await sb.from(table).insert(chunk as never)
    if (error) {
      throw new Error(error.message)
    }
  }
}

function parseNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mapDbResult(row: {
  id: string
  supplier_gstin: string
  supplier_name: string | null
  invoice_number: string
  invoice_date: string | null
  place_of_supply: string | null
  match_key: string
  status: ReconciliationRow["status"]
  itc_risk: ReconciliationRow["itcRisk"]
  itc_available: string | null
  reverse_charge: string | null
  taxable_2b: string | null
  igst_2b: string | null
  cgst_2b: string | null
  sgst_2b: string | null
  taxable_pr: string | null
  igst_pr: string | null
  cgst_pr: string | null
  sgst_pr: string | null
  taxable_diff: string | null
  igst_diff: string | null
  cgst_diff: string | null
  sgst_diff: string | null
  total_itc_at_risk: string | null
  recommended_action: string
  action_urgency: ReconciliationRow["actionUrgency"]
  risk_sort_order: number
  document_type?: string | null
}): ReconciliationRow {
  return {
    id: row.id,
    documentType: ((row.document_type as DocumentType) ?? "B2B") as DocumentType,
    supplierGSTIN: row.supplier_gstin,
    supplierName: row.supplier_name ?? "",
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date ?? "",
    placeOfSupply: row.place_of_supply ?? "",
    matchKey: row.match_key,
    status: row.status,
    itcRisk: row.itc_risk,
    itcAvailable: (row.itc_available as ReconciliationRow["itcAvailable"]) ?? null,
    reverseCharge: (row.reverse_charge as ReconciliationRow["reverseCharge"]) ?? null,
    taxable2B: parseNum(row.taxable_2b),
    igst2B: parseNum(row.igst_2b),
    cgst2B: parseNum(row.cgst_2b),
    sgst2B: parseNum(row.sgst_2b),
    taxablePR: parseNum(row.taxable_pr),
    igstPR: parseNum(row.igst_pr),
    cgstPR: parseNum(row.cgst_pr),
    sgstPR: parseNum(row.sgst_pr),
    taxableDiff: parseNum(row.taxable_diff),
    igstDiff: parseNum(row.igst_diff),
    cgstDiff: parseNum(row.cgst_diff),
    sgstDiff: parseNum(row.sgst_diff),
    totalITCAtRisk: parseNum(row.total_itc_at_risk) ?? 0,
    recommendedAction: row.recommended_action,
    actionUrgency: row.action_urgency,
    riskSortOrder: row.risk_sort_order,
    isTaxTypeMismatch: row.status === "Tax Type Mismatch",
    isSuggestedMatch: row.status === "Suggested Match",
    isDuplicate: row.status === "Duplicate",
    isRCM: row.status === "RCM Invoice",
    isQRMP: row.status === "QRMP Delay",
    qrmpNote:
      row.status === "QRMP Delay"
        ? "QRMP suppliers file quarterly. April invoices appear in June GSTR-2B, July invoices in September, etc."
        : null,
  }
}

/** Prefer totals persisted at save-time so dashboard matches reconcile page (no client-only fields in DB rows). */
function mergeSessionSummaryTotals(
  session: {
    total_invoices: number | null
    matched_count: number | null
    mismatch_count: number | null
    total_itc_at_risk: string | null
    total_itc_safe: string | null
    b2ba_count?: number | null
    cdnr_count?: number | null
    cdn_debit_count?: number | null
  },
  computed: ReconciliationSummary,
): ReconciliationSummary {
  const parseMoney = (v: string | null | undefined): number | undefined => {
    if (v === null || v === undefined || v === "") return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  const itcRisk = parseMoney(session.total_itc_at_risk)
  const itcSafe = parseMoney(session.total_itc_safe)
  return {
    ...computed,
    ...(session.total_invoices != null ? { totalInvoices: session.total_invoices } : {}),
    ...(session.matched_count != null ? { matchedCount: session.matched_count } : {}),
    ...(session.mismatch_count != null ? { issuesFoundCount: session.mismatch_count } : {}),
    ...(itcRisk !== undefined ? { totalITCAtRisk: itcRisk } : {}),
    ...(itcSafe !== undefined ? { totalITCSafe: itcSafe } : {}),
    ...(session.b2ba_count != null ? { b2baCount: session.b2ba_count } : {}),
    ...(session.cdnr_count != null ? { cdnrCount: session.cdnr_count } : {}),
    ...(session.cdn_debit_count != null ? { cdnrDNCount: session.cdn_debit_count } : {}),
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const serverSb = await createServerSupabase()
    const {
      data: { user },
    } = await serverSb.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: sessionById } = await serverSb
      .from("reconciliation_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    let session = sessionById
    if (!session) {
      const { data: sessionByRequest } = await serverSb
        .from("reconciliation_sessions")
        .select("*")
        .eq("request_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
      session = sessionByRequest
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: results, error: rErr } = await serverSb
      .from("reconciliation_results")
      .select("*")
      .eq("session_id", session.id)
      .order("risk_sort_order", { ascending: true })
      .order("total_itc_at_risk", { ascending: false })

    if (rErr) {
      throw rErr
    }

    const mappedResults = (results ?? []).map(mapDbResult)
    const computedSummary = buildReconciliationSummary(mappedResults)
    const summary = mergeSessionSummaryTotals(session, computedSummary)

    const sessionPayload = {
      id: session.id,
      requestId: session.request_id,
      status: session.status,
      month: session.reconciliation_period_month,
      year: session.reconciliation_period_year,
      gstr2bFilename: session.gstr2b_filename ?? "",
      gstr2bRowCount: session.gstr2b_row_count ?? 0,
      prFilename: session.pr_filename ?? "",
      prRowCount: session.pr_row_count ?? 0,
      clientGstin: session.client_gstin ?? null,
      clientName: session.client_name ?? null,
      summary,
      errorMessage: session.error_message ?? undefined,
      createdAt: session.created_at,
      completedAt: session.completed_at ?? undefined,
    }

    return NextResponse.json({
      session: sessionPayload,
      results: mappedResults,
      summary,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await ctx.params
  const serverSb = await createServerSupabase()

  try {
    const body = (await req.json()) as {
      gstr2bRows: GSTR2BRow[]
      prRows: PurchaseRegisterRow[]
      results: ReconciliationRow[]
      summary: ReconciliationSummary
      requestId: string
    }

    const gstrInserts = body.gstr2bRows.map((r, i) =>
      mapGstr2bRow(sessionId, body.requestId, i, r),
    )
    const prInserts = body.prRows.map((r, i) =>
      mapPrRow(sessionId, body.requestId, i, r),
    )
    const resultInserts = body.results.map((r) =>
      mapResultRow(sessionId, body.requestId, r),
    )

    await insertChunks(serverSb, "gstr2b_invoices", gstrInserts, 100)
    await insertChunks(serverSb, "purchase_register_invoices", prInserts, 100)
    await insertChunks(serverSb, "reconciliation_results", resultInserts, 100)

    const { error: uErr } = await serverSb
      .from("reconciliation_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        total_invoices: body.summary.totalInvoices,
        matched_count: body.summary.matchedCount,
        mismatch_count: body.summary.issuesFoundCount,
        in_2b_only_count: body.summary.in2BOnlyCount,
        in_pr_only_count: body.summary.inPROnlyCount,
        total_itc_at_risk: String(body.summary.totalITCAtRisk),
        total_itc_safe: String(body.summary.totalITCSafe),
        b2ba_count: body.summary.b2baCount ?? 0,
        cdnr_count: body.summary.cdnrCount ?? 0,
        cdn_debit_count: body.summary.cdnrDNCount ?? 0,
      } as never)
      .eq("id", sessionId)

    if (uErr) {
      throw uErr
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    await serverSb
      .from("reconciliation_sessions")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", sessionId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
