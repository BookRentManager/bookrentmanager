export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          entity: Database["public"]["Enums"]["audit_entity"]
          entity_id: string
          id: string
          payload_snapshot: Json | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          entity: Database["public"]["Enums"]["audit_entity"]
          entity_id: string
          id?: string
          payload_snapshot?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          entity?: Database["public"]["Enums"]["audit_entity"]
          entity_id?: string
          id?: string
          payload_snapshot?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount_paid: number
          amount_total: number
          billing_address: string | null
          car_model: string
          car_plate: string
          client_email: string | null
          client_name: string
          client_phone: string | null
          collection_datetime: string
          collection_info: string | null
          collection_location: string
          country: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          delivery_datetime: string
          delivery_info: string | null
          delivery_location: string
          extra_km_cost: number | null
          id: string
          km_included: number | null
          other_costs_total: number
          reference_code: string
          rental_price_gross: number
          security_deposit_amount: number
          status: Database["public"]["Enums"]["booking_status"]
          supplier_name: string | null
          supplier_price: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          amount_paid?: number
          amount_total: number
          billing_address?: string | null
          car_model: string
          car_plate: string
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          collection_datetime: string
          collection_info?: string | null
          collection_location: string
          country?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          delivery_datetime: string
          delivery_info?: string | null
          delivery_location: string
          extra_km_cost?: number | null
          id?: string
          km_included?: number | null
          other_costs_total?: number
          reference_code: string
          rental_price_gross: number
          security_deposit_amount?: number
          status?: Database["public"]["Enums"]["booking_status"]
          supplier_name?: string | null
          supplier_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          amount_paid?: number
          amount_total?: number
          billing_address?: string | null
          car_model?: string
          car_plate?: string
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          collection_datetime?: string
          collection_info?: string | null
          collection_location?: string
          country?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          delivery_datetime?: string
          delivery_info?: string | null
          delivery_location?: string
          extra_km_cost?: number | null
          id?: string
          km_included?: number | null
          other_costs_total?: number
          reference_code?: string
          rental_price_gross?: number
          security_deposit_amount?: number
          status?: Database["public"]["Enums"]["booking_status"]
          supplier_name?: string | null
          supplier_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      client_invoices: {
        Row: {
          billing_address: string | null
          booking_id: string
          client_name: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          billing_address?: string | null
          booking_id: string
          client_name: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_number: string
          issue_date: string
          notes?: string | null
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          billing_address?: string | null
          booking_id?: string
          client_name?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          booking_id: string
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: string
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      fines: {
        Row: {
          amount: number | null
          booking_id: string | null
          car_plate: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          display_name: string | null
          document_url: string | null
          fine_number: string | null
          id: string
          issue_date: string
          payment_proof_url: string | null
          payment_status: Database["public"]["Enums"]["fine_payment_status"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          booking_id?: string | null
          car_plate?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          display_name?: string | null
          document_url?: string | null
          fine_number?: string | null
          id?: string
          issue_date: string
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["fine_payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          booking_id?: string | null
          car_plate?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          display_name?: string | null
          document_url?: string | null
          fine_number?: string | null
          id?: string
          issue_date?: string
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["fine_payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fines_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          proof_url: string | null
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          proof_url?: string | null
          type: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          proof_url?: string | null
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          amount: number
          booking_id: string | null
          car_plate: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          invoice_url: string | null
          issue_date: string
          payment_proof_url: string | null
          payment_status: Database["public"]["Enums"]["invoice_payment_status"]
          supplier_name: string
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          car_plate?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          invoice_url?: string | null
          issue_date: string
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["invoice_payment_status"]
          supplier_name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          car_plate?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          invoice_url?: string | null
          issue_date?: string
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["invoice_payment_status"]
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      booking_financials: {
        Row: {
          amount_paid: number | null
          amount_total: number | null
          commission_net: number | null
          expenses_total: number | null
          financial_status:
            | Database["public"]["Enums"]["financial_status"]
            | null
          id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          reference_code: string | null
          rental_price_gross: number | null
          rental_price_net: number | null
          supplier_price: number | null
          vat_rate: number | null
        }
        Insert: {
          amount_paid?: number | null
          amount_total?: number | null
          commission_net?: never
          expenses_total?: never
          financial_status?: never
          id?: string | null
          payment_status?: never
          reference_code?: string | null
          rental_price_gross?: number | null
          rental_price_net?: never
          supplier_price?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount_paid?: number | null
          amount_total?: number | null
          commission_net?: never
          expenses_total?: never
          financial_status?: never
          id?: string | null
          payment_status?: never
          reference_code?: string | null
          rental_price_gross?: number | null
          rental_price_net?: never
          supplier_price?: number | null
          vat_rate?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "read_only"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "status_change"
        | "pay"
        | "upload"
      audit_entity:
        | "booking"
        | "fine"
        | "supplier_invoice"
        | "payment"
        | "expense"
      booking_status:
        | "draft"
        | "confirmed"
        | "ongoing"
        | "completed"
        | "cancelled"
      expense_category:
        | "transfer"
        | "fuel"
        | "cleaning"
        | "tyres"
        | "parking"
        | "other"
      financial_status: "loss" | "breakeven" | "profit"
      fine_payment_status: "unpaid" | "paid"
      invoice_payment_status: "to_pay" | "paid"
      payment_method: "stripe" | "wire" | "pos" | "other"
      payment_status: "unpaid" | "partial" | "paid"
      payment_type: "deposit" | "balance" | "full"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "read_only"],
      audit_action: [
        "create",
        "update",
        "delete",
        "status_change",
        "pay",
        "upload",
      ],
      audit_entity: [
        "booking",
        "fine",
        "supplier_invoice",
        "payment",
        "expense",
      ],
      booking_status: [
        "draft",
        "confirmed",
        "ongoing",
        "completed",
        "cancelled",
      ],
      expense_category: [
        "transfer",
        "fuel",
        "cleaning",
        "tyres",
        "parking",
        "other",
      ],
      financial_status: ["loss", "breakeven", "profit"],
      fine_payment_status: ["unpaid", "paid"],
      invoice_payment_status: ["to_pay", "paid"],
      payment_method: ["stripe", "wire", "pos", "other"],
      payment_status: ["unpaid", "partial", "paid"],
      payment_type: ["deposit", "balance", "full"],
    },
  },
} as const
