export type ITCStatus = "Y" | "N" | "T"
export type MismatchStatus =
  | "Matched"
  | "Sec 16(4) Expired"
  | "Value Mismatch"
  | "Tax Type Mismatch"
  | "Suggested Match"
  | "In 2B Only"
  | "In PR Only"
  | "Period Timing Mismatch"
  | "QRMP Delay"
  | "Duplicate"
  | "RCM Invoice"
  | "ITC Blocked"
  | "ITC Temporary"
  | "POS Mismatch"
  | "CESS Mismatch"
  | "Tax Rate Mismatch"
  | "Date Gap Match"
  | "Group Entity Match"
  | "GSTIN Mismatch Match"
  | "Amount-Led Match"
  | "Consolidated Invoice Match"
  | "Probable Month Match"
  | "Unclaimed ITC"
  | "ITC Eligibility Uncertain"
  | "Debit Note Misclassified"
  | "Partially Booked ITC"
  | "ITC Reduced by Supplier"
  | "Non-GST Entry"

export type ITCBlockReason = "permanent" | "conditional" | null

export type ITCRiskLevel = "Safe" | "Low" | "Medium" | "High" | "Critical" | "None"

/** Internal check codes mapped to {@link MismatchStatus} labels (UI / docs). */
export const RECONCILIATION_CHECK_CODES = {
  SEC16: "Sec 16(4) Expired",
  M3: "Date Gap Match",
  M4_PAN: "Group Entity Match",
  M4: "GSTIN Mismatch Match",
  M5: "Amount-Led Match",
  M6: "Consolidated Invoice Match",
  P2: "Probable Month Match",
  Q8: "Unclaimed ITC",
  Q9: "ITC Eligibility Uncertain",
  Q10: "Debit Note Misclassified",
  Q14: "Partially Booked ITC",
  I8: "ITC Reduced by Supplier",
  PT: "Period Timing Mismatch",
  X1: "Non-GST Entry",
} as const satisfies Record<string, MismatchStatus>
export type ActionUrgency =
  | "Immediate"
  | "Before Filing"
  | "Monitor"
  | "None"
export type SessionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"

/** Filter pill ids: status values plus synthetic filters */
export type ReconciliationFilterId =
  | MismatchStatus
  | "All"
  | "DeadlineWarning"
  | "PosIssues"

export interface AppConfig {
  itcMatchToleranceInr: number
  maxFileRows: number
  requestIdPrefix: string
  supportedInvoiceTypes: string
  appVersion: string
  maintenanceMode: boolean
  freeTierMaxRows: number
  freeTierMaxReconciliations: number
  showSampleDataButton: boolean
}

export interface GSTR2BRow {
  supplierGSTIN: string
  supplierName: string
  supplierFilingDate: string
  invoiceNumber: string
  rawInvoiceNumber?: string
  invoiceType: string
  /** Supplier return period from GSTR-2B (`MMYYYY`; months 01, 04, 07, 10 = QRMP quarter starts). */
  supprd?: string
  /** Same as `supprd` when the sheet column is labeled `supplierFilingPeriod` / filing period aliases. */
  supplierFilingPeriod?: string
  /** Portal invoice date (`dt`) when mapped separately from `invoiceDate`. */
  dt?: string
  invoiceDate: string
  invoiceValue: number
  placeOfSupply: string
  reverseCharge: "Y" | "N"
  itcAvailable: ITCStatus
  itcUnavailableReason?: string
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  taxRate: number
}

export interface PurchaseRegisterRow {
  supplierGSTIN: string
  supplierName: string
  invoiceNumber: string
  rawInvoiceNumber?: string
  invoiceDate: string
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  totalInvoiceValue: number
  placeOfSupply?: string
  hsnCode?: string
  /** Optional explicit rate %; inferred in reconcile when missing */
  taxRate?: number
  /** Booked ITC / ITC claimed in books from PR column (when present); used for Q-8 Unclaimed ITC. */
  itcAmount?: number | null
}

export interface ReconciliationRow {
  id?: string
  supplierGSTIN: string
  supplierName: string
  invoiceNumber: string
  invoiceDate: string
  placeOfSupply: string
  matchKey: string
  status: MismatchStatus
  itcRisk: ITCRiskLevel
  itcAvailable: ITCStatus | null
  reverseCharge: "Y" | "N" | null
  taxable2B: number | null
  igst2B: number | null
  cgst2B: number | null
  sgst2B: number | null
  taxablePR: number | null
  igstPR: number | null
  cgstPR: number | null
  sgstPR: number | null
  taxableDiff: number | null
  igstDiff: number | null
  cgstDiff: number | null
  sgstDiff: number | null
  totalITCAtRisk: number
  recommendedAction: string
  actionUrgency: ActionUrgency
  riskSortOrder: number

  isTaxTypeMismatch?: boolean
  totalTax2B?: number | null
  totalTaxPR?: number | null

  isSuggestedMatch?: boolean
  matchConfidence?: number | null
  suggestedMatchReason?: string | null
  rawInvoiceNumber2B?: string | null
  rawInvoiceNumberPR?: string | null
  normalisedInvoiceNumber2B?: string | null
  normalisedInvoiceNumberPR?: string | null

  isDuplicate?: boolean
  duplicateOf?: string | null

  isRCM?: boolean

  itcBlockReason?: ITCBlockReason

  itcClaimDeadline?: string | null
  daysToDeadline?: number | null
  isDeadlineWarning?: boolean
  isDeadlineExpired?: boolean

  isPOSMismatch?: boolean
  posWarning?: string | null

  taxRate2B?: number | null
  taxRatePR?: number | null
  isTaxRateMismatch?: boolean

  cessDiff?: number | null
  isCessMismatch?: boolean

  isTimingMismatch?: boolean
  timingNote?: string | null

  /** True when row was classified as quarterly-filer timing (QRMP), not a supplier default. */
  isQRMP?: boolean
  qrmpNote?: string | null
}

/** Period label + optional CA display name for vendor follow-up copy helpers. */
export type VendorMessageContext = {
  period: string
  caName?: string
}

export interface ReconciliationSummary {
  totalInvoices: number
  /** Rows that are matched and safe to claim (status Matched + ITC risk Safe). */
  matchedCount: number
  valueMismatchCount: number
  in2BOnlyCount: number
  inPROnlyCount: number
  /** Invoices classified as QRMP quarterly filing delay (monitor only). */
  qrmpCount: number
  /** Count of rows with ITC risk other than Safe, excluding QRMP deferrals. */
  issuesFoundCount: number
  totalITCAtRisk: number
  totalITCSafe: number
  taxTypeMismatchCount: number
  suggestedMatchCount: number
  duplicateCount: number
  rcmInvoiceCount: number
  deadlineExpiredCount: number
  deadlineWarningCount: number
  posMismatchCount: number
  totalCESSAtRisk: number
}

export interface ReconciliationSession {
  id: string
  requestId: string
  status: SessionStatus
  month: number
  year: number
  gstr2bFilename: string
  gstr2bRowCount: number
  prFilename: string
  prRowCount: number
  summary: ReconciliationSummary
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

export type FileValidationConfidence = "high" | "medium" | "low"

export interface FileValidationResult {
  isValid: boolean
  confidence: FileValidationConfidence
  warnings: string[]
  errors: string[]
  /** Non-blocking notices (e.g. rows excluded from processing). */
  info: string[]
  /** Original workbook sheet tab names (GSTR-2B .xlsx only; empty for CSV / PR). */
  foundSheets: string[]
  /** False when an .xlsx GSTR-2B file has no B2B tab (CSV exports treated as OK). */
  hasB2BSheet: boolean
  /** Data rows on the B2B sheet after invoice-type (typ) filter, before GSTIN/invoice row drops. */
  b2bRowCount: number
  /** Rows excluded by typ filter (SEZ / deemed export / non-R). */
  skippedRowCount: number
  /** All data rows read from the B2B sheet before typ filtering. */
  totalRowsParsed: number
}

export interface ParseResult<T> {
  rows: T[]
  filename: string
  rowCount: number
  errors: string[]
  /** Rows read from B2B sheet before typ filter (GSTR-2B only). */
  totalParsed?: number
  /** Rows dropped by typ filter (GSTR-2B only). */
  skipped?: number
  /** Deep file checks (GSTN shape, GSTINs, etc.). When missing, treat as verified. */
  validation?: FileValidationResult
  /** Recipient (taxpayer) from GSTR-2B header row 2 — GSTR-2B parse only. */
  recipientGSTIN?: string | null
  recipientName?: string | null
  returnPeriod?: string | null
  /** Parsed from header `Return Period` (e.g. April 2024, 042024) — GSTR-2B parse only. */
  detectedMonth?: number | null
  detectedYear?: number | null
}
