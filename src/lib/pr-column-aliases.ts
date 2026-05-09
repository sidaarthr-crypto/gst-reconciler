/**
 * Shared Purchase Register header aliases — keep in sync with `parser.ts` PR mapping
 * and `file-validation.ts` checks.
 */

export const PR_SUPPLIER_GSTIN_ALIASES = [
  "supplier gstin",
  "party gstin",
  "vendor gstin",
  "gstin",
  "gstin no",
  "gst no",
  "gst number",
  "supplier gst",
  "party gst no",
  "gstin of supplier",
  "vendor gst number",
  "gstin number",
  "gst registration no",
  "supplier gst no",
  "gstin/uin",
  "gstin uin",
  "gstin or uin",
  "gst in",
  "uin",
  "gstinofsupplier",
  "ctin",
] as const

export const PR_SUPPLIER_NAME_ALIASES = [
  "supplier name",
  "party name",
  "vendor name",
  "creditor name",
  "supplier",
  "party",
  "vendor",
  "ledger name",
  "ledger",
  "account name",
  "name",
  "trade name",
  "legal name",
  "supplier trade name",
  "creditor",
] as const

export const PR_INVOICE_NUMBER_ALIASES = [
  "invoice no",
  "invoice number",
  "bill no",
  "bill number",
  "voucher no",
  "voucher number",
  "ref no",
  "reference no",
  "document no",
  "doc no",
  "purchase invoice no",
  "inv no",
  "invoice #",
  "bill #",
  "receipt no",
  "challan no",
  "debit note no",
  "purchase no",
  "inum",
  "supplier invoice no",
  "supplier invoice no.",
  "supplier invoice number",
  "supplier inv no",
  "supp invoice no",
  "party invoice no",
  "external document no",
  "ref invoice no",
] as const

export const PR_TAXABLE_VALUE_ALIASES = [
  "taxable value",
  "taxable amount",
  "taxable",
  "assessable value",
  "net amount",
  "basic amount",
  "taxable val",
  "base amount",
  "net value",
  "value",
  "purchase value",
  "taxable purchase",
  "net taxable value",
  "taxable purchase value",
  "gross value",
  "amount",
  "txval",
] as const

export const PR_INVOICE_DATE_ALIASES = [
  "invoice date",
  "bill date",
  "voucher date",
  "date",
  "document date",
  "doc date",
  "purchase date",
  "transaction date",
  "entry date",
  "inv date",
  "bill dt",
  "invoice dt",
] as const

export const PR_IGST_ALIASES = [
  "igst",
  "igst amount",
  "integrated tax",
  "integrated gst",
  "igst paid",
  "igst amt",
  "i gst",
] as const

export const PR_CGST_ALIASES = [
  "cgst",
  "cgst amount",
  "central tax",
  "central gst",
  "cgst paid",
  "cgst amt",
  "c gst",
] as const

export const PR_SGST_ALIASES = [
  "sgst",
  "sgst amount",
  "state tax",
  "state gst",
  "utgst",
  "sgst paid",
  "sgst amt",
  "s gst",
  "ut gst",
  "state ut tax",
  "utgst amount",
] as const

export const PR_CESS_ALIASES = [
  "cess",
  "cess amount",
  "compensation cess",
  "cess amt",
] as const

export const PR_TOTAL_INVOICE_VALUE_ALIASES = [
  "invoice value",
  "bill amount",
  "total amount",
  "gross amount",
  "total value",
  "invoice amount",
  "bill value",
  "total invoice value",
  "grand total",
  "total",
  "amount",
  "net payable",
] as const

export const PR_PLACE_OF_SUPPLY_ALIASES = [
  "place of supply",
  "pos",
  "state",
  "supply state",
  "destination state",
  "ship to state",
  "buyer state",
] as const

/** Optional columns on PR sheets exported in GSTR-2B-style layouts */
export const PR_ITC_AVAILABLE_ALIASES = [
  "itc availability",
  "itc availibility",
  "itc available",
  "itcavl",
  "itc avl",
  "input tax credit",
] as const

export const PR_REVERSE_CHARGE_ALIASES = [
  "supply attract reverse charge",
  "reverse charge",
  "rev",
  "rcm",
  "rch",
] as const
