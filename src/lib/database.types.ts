export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SessionStatusDb =
  | "pending"
  | "processing"
  | "completed"
  | "failed"

export type ReconciliationResultStatusDb =
  | "Matched"
  | "Value Mismatch"
  | "Tax Type Mismatch"
  | "Suggested Match"
  | "In 2B Only"
  | "In PR Only"
  | "QRMP Delay"
  | "Duplicate"
  | "RCM Invoice"

export type ItcRiskDb = "Safe" | "Low" | "Medium" | "High" | "Critical"

export type ActionUrgencyDb =
  | "Immediate"
  | "Before Filing"
  | "Monitor"
  | "None"

export interface Database {
  public: {
    Tables: {
      reconciliation_sessions: {
        Row: {
          id: string
          request_id: string
          status: SessionStatusDb
          reconciliation_period_month: number
          reconciliation_period_year: number
          client_gstin: string | null
          client_name: string | null
          gstr2b_filename: string | null
          gstr2b_row_count: number | null
          pr_filename: string | null
          pr_row_count: number | null
          total_invoices: number | null
          matched_count: number | null
          mismatch_count: number | null
          in_2b_only_count: number | null
          in_pr_only_count: number | null
          total_itc_at_risk: string | null
          total_itc_safe: string | null
          error_message: string | null
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
          is_guest: boolean | null
          created_at: string
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          request_id: string
          status?: SessionStatusDb
          reconciliation_period_month: number
          reconciliation_period_year: number
          client_gstin?: string | null
          client_name?: string | null
          gstr2b_filename?: string | null
          gstr2b_row_count?: number | null
          pr_filename?: string | null
          pr_row_count?: number | null
          total_invoices?: number | null
          matched_count?: number | null
          mismatch_count?: number | null
          in_2b_only_count?: number | null
          in_pr_only_count?: number | null
          total_itc_at_risk?: string | null
          total_itc_safe?: string | null
          error_message?: string | null
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
          is_guest?: boolean | null
          created_at?: string
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          status?: SessionStatusDb
          reconciliation_period_month?: number
          reconciliation_period_year?: number
          client_gstin?: string | null
          client_name?: string | null
          gstr2b_filename?: string | null
          gstr2b_row_count?: number | null
          pr_filename?: string | null
          pr_row_count?: number | null
          total_invoices?: number | null
          matched_count?: number | null
          mismatch_count?: number | null
          in_2b_only_count?: number | null
          in_pr_only_count?: number | null
          total_itc_at_risk?: string | null
          total_itc_safe?: string | null
          error_message?: string | null
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
          is_guest?: boolean | null
          created_at?: string
          completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gstr2b_invoices: {
        Row: {
          id: string
          session_id: string
          request_id: string
          row_index: number
          supplier_gstin: string
          supplier_name: string | null
          supplier_filing_date: string | null
          supplier_period: string | null
          invoice_number: string
          invoice_type: string | null
          invoice_date: string | null
          invoice_value: string | null
          place_of_supply: string | null
          reverse_charge: string | null
          itc_available: string | null
          itc_unavail_reason: string | null
          taxable_value: string | null
          igst: string | null
          cgst: string | null
          sgst: string | null
          cess: string | null
          tax_rate: string | null
          normalised_gstin: string
          normalised_inv_no: string
          match_key: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          request_id: string
          row_index: number
          supplier_gstin: string
          supplier_name?: string | null
          supplier_filing_date?: string | null
          supplier_period?: string | null
          invoice_number: string
          invoice_type?: string | null
          invoice_date?: string | null
          invoice_value?: string | null
          place_of_supply?: string | null
          reverse_charge?: string | null
          itc_available?: string | null
          itc_unavail_reason?: string | null
          taxable_value?: string | null
          igst?: string | null
          cgst?: string | null
          sgst?: string | null
          cess?: string | null
          tax_rate?: string | null
          normalised_gstin: string
          normalised_inv_no: string
          match_key: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          request_id?: string
          row_index?: number
          supplier_gstin?: string
          supplier_name?: string | null
          supplier_filing_date?: string | null
          supplier_period?: string | null
          invoice_number?: string
          invoice_type?: string | null
          invoice_date?: string | null
          invoice_value?: string | null
          place_of_supply?: string | null
          reverse_charge?: string | null
          itc_available?: string | null
          itc_unavail_reason?: string | null
          taxable_value?: string | null
          igst?: string | null
          cgst?: string | null
          sgst?: string | null
          cess?: string | null
          tax_rate?: string | null
          normalised_gstin?: string
          normalised_inv_no?: string
          match_key?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gstr2b_invoices_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_register_invoices: {
        Row: {
          id: string
          session_id: string
          request_id: string
          row_index: number
          supplier_gstin: string
          supplier_name: string | null
          invoice_number: string
          invoice_date: string | null
          taxable_value: string | null
          igst: string | null
          cgst: string | null
          sgst: string | null
          cess: string | null
          total_invoice_value: string | null
          place_of_supply: string | null
          hsn_code: string | null
          normalised_gstin: string
          normalised_inv_no: string
          match_key: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          request_id: string
          row_index: number
          supplier_gstin: string
          supplier_name?: string | null
          invoice_number: string
          invoice_date?: string | null
          taxable_value?: string | null
          igst?: string | null
          cgst?: string | null
          sgst?: string | null
          cess?: string | null
          total_invoice_value?: string | null
          place_of_supply?: string | null
          hsn_code?: string | null
          normalised_gstin: string
          normalised_inv_no: string
          match_key: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          request_id?: string
          row_index?: number
          supplier_gstin?: string
          supplier_name?: string | null
          invoice_number?: string
          invoice_date?: string | null
          taxable_value?: string | null
          igst?: string | null
          cgst?: string | null
          sgst?: string | null
          cess?: string | null
          total_invoice_value?: string | null
          place_of_supply?: string | null
          hsn_code?: string | null
          normalised_gstin?: string
          normalised_inv_no?: string
          match_key?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_register_invoices_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_results: {
        Row: {
          id: string
          session_id: string
          request_id: string
          supplier_gstin: string
          supplier_name: string | null
          invoice_number: string
          invoice_date: string | null
          place_of_supply: string | null
          match_key: string
          status: ReconciliationResultStatusDb
          itc_risk: ItcRiskDb
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
          action_urgency: ActionUrgencyDb
          risk_sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          request_id: string
          supplier_gstin: string
          supplier_name?: string | null
          invoice_number: string
          invoice_date?: string | null
          place_of_supply?: string | null
          match_key: string
          status: ReconciliationResultStatusDb
          itc_risk: ItcRiskDb
          itc_available?: string | null
          reverse_charge?: string | null
          taxable_2b?: string | null
          igst_2b?: string | null
          cgst_2b?: string | null
          sgst_2b?: string | null
          taxable_pr?: string | null
          igst_pr?: string | null
          cgst_pr?: string | null
          sgst_pr?: string | null
          taxable_diff?: string | null
          igst_diff?: string | null
          cgst_diff?: string | null
          sgst_diff?: string | null
          total_itc_at_risk?: string | null
          recommended_action: string
          action_urgency: ActionUrgencyDb
          risk_sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          request_id?: string
          supplier_gstin?: string
          supplier_name?: string | null
          invoice_number?: string
          invoice_date?: string | null
          place_of_supply?: string | null
          match_key?: string
          status?: ReconciliationResultStatusDb
          itc_risk?: ItcRiskDb
          itc_available?: string | null
          reverse_charge?: string | null
          taxable_2b?: string | null
          igst_2b?: string | null
          cgst_2b?: string | null
          sgst_2b?: string | null
          taxable_pr?: string | null
          igst_pr?: string | null
          cgst_pr?: string | null
          sgst_pr?: string | null
          taxable_diff?: string | null
          igst_diff?: string | null
          cgst_diff?: string | null
          sgst_diff?: string | null
          total_itc_at_risk?: string | null
          recommended_action?: string
          action_urgency?: ActionUrgencyDb
          risk_sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          value: string
          description: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          description?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
