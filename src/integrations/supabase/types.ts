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
      agencies: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_invoices: {
        Row: {
          agency_id: string
          amount: number
          amount_paid: number | null
          booking_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          id: string
          invoice_url: string | null
          issue_date: string
          notes: string | null
          payment_proof_url: string | null
          payment_status: Database["public"]["Enums"]["invoice_payment_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          amount: number
          amount_paid?: number | null
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          invoice_url?: string | null
          issue_date: string
          notes?: string | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["invoice_payment_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          amount?: number
          amount_paid?: number | null
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          invoice_url?: string | null
          issue_date?: string
          notes?: string | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["invoice_payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_invoices_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          bank_account_bank_name: string | null
          bank_account_bic: string | null
          bank_account_holder: string | null
          bank_account_iban: string | null
          bank_transfer_instructions: string | null
          company_address: string | null
          company_email: string | null
          company_name: string
          company_phone: string | null
          created_at: string
          default_currency: string
          default_vat_rate: number
          id: string
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          bank_account_bank_name?: string | null
          bank_account_bic?: string | null
          bank_account_holder?: string | null
          bank_account_iban?: string | null
          bank_transfer_instructions?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          created_at?: string
          default_currency?: string
          default_vat_rate?: number
          id?: string
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          bank_account_bank_name?: string | null
          bank_account_bic?: string | null
          bank_account_holder?: string | null
          bank_account_iban?: string | null
          bank_transfer_instructions?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          created_at?: string
          default_currency?: string
          default_vat_rate?: number
          id?: string
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      booking_access_tokens: {
        Row: {
          access_count: number
          accessed_at: string | null
          booking_id: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          permission_level: string | null
          token: string
        }
        Insert: {
          access_count?: number
          accessed_at?: string | null
          booking_id: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          permission_level?: string | null
          token: string
        }
        Update: {
          access_count?: number
          accessed_at?: string | null
          booking_id?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          permission_level?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_access_tokens_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_access_tokens_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_adjustments: {
        Row: {
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          amount: number
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
        }
        Insert: {
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          amount: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          adjustment_type?: Database["public"]["Enums"]["adjustment_type"]
          amount?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_adjustments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_adjustments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_documents: {
        Row: {
          booking_id: string
          created_at: string
          deleted_at: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          extra_cost_amount: number | null
          extra_cost_notes: string | null
          extra_cost_paid_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_by: string | null
          uploaded_by_client_name: string | null
          uploaded_by_type: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          deleted_at?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          extra_cost_amount?: number | null
          extra_cost_notes?: string | null
          extra_cost_paid_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
          uploaded_by_client_name?: string | null
          uploaded_by_type?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          deleted_at?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          extra_cost_amount?: number | null
          extra_cost_notes?: string | null
          extra_cost_paid_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
          uploaded_by_client_name?: string | null
          uploaded_by_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          additional_services: Json | null
          agency_email: string | null
          agency_id: string | null
          agency_name: string | null
          agency_phone: string | null
          amount_paid: number
          amount_total: number
          available_payment_methods: Json | null
          balance_due_date: string | null
          balance_payment_link_id: string | null
          balance_payment_reminder_sent_at: string | null
          billing_address: string | null
          booking_confirmation_pdf_sent_at: string | null
          booking_date: string | null
          booking_form_last_accessed_at: string | null
          booking_form_sent_at: string | null
          booking_type: Database["public"]["Enums"]["booking_type"]
          car_model: string
          car_plate: string
          client_email: string | null
          client_name: string
          client_phone: string | null
          collection_contract_signed_at: string | null
          collection_datetime: string
          collection_info: string | null
          collection_inspection_completed_at: string | null
          collection_location: string
          company_name: string | null
          confirmation_pdf_url: string | null
          country: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          delivery_contract_signed_at: string | null
          delivery_datetime: string
          delivery_info: string | null
          delivery_inspection_completed_at: string | null
          delivery_location: string
          document_requirements: Json | null
          documents_required: boolean
          documents_required_note: string | null
          email_import_date: string | null
          extra_deduction: number | null
          extra_km_cost: number | null
          guest_billing_address: string | null
          guest_company_name: string | null
          guest_country: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          imported_from_email: boolean | null
          km_included: number | null
          last_email_update: string | null
          manual_instructions_balance: string | null
          manual_instructions_downpayment: string | null
          manual_instructions_security_deposit: string | null
          manual_payment_for_balance: boolean | null
          manual_payment_for_downpayment: boolean | null
          manual_payment_for_security_deposit: boolean | null
          manual_payment_instructions: string | null
          original_client_name: string | null
          other_costs_total: number
          payment_amount_option: string | null
          payment_amount_percent: number | null
          payment_method: string | null
          reference_code: string
          rental_completed_at: string | null
          rental_day_hour_tolerance: number | null
          rental_price_gross: number
          rental_started_at: string | null
          security_deposit_amount: number
          security_deposit_authorization_id: string | null
          security_deposit_authorized_at: string | null
          security_deposit_link_id: string | null
          security_deposit_reminder_sent_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          supplier_name: string | null
          supplier_price: number
          tc_accepted_at: string | null
          tc_accepted_ip: unknown
          tc_signature_data: string | null
          tc_version_id: string | null
          total_rental_amount: number | null
          updated_at: string
          vat_rate: number
        }
        Insert: {
          additional_services?: Json | null
          agency_email?: string | null
          agency_id?: string | null
          agency_name?: string | null
          agency_phone?: string | null
          amount_paid?: number
          amount_total: number
          available_payment_methods?: Json | null
          balance_due_date?: string | null
          balance_payment_link_id?: string | null
          balance_payment_reminder_sent_at?: string | null
          billing_address?: string | null
          booking_confirmation_pdf_sent_at?: string | null
          booking_date?: string | null
          booking_form_last_accessed_at?: string | null
          booking_form_sent_at?: string | null
          booking_type?: Database["public"]["Enums"]["booking_type"]
          car_model: string
          car_plate: string
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          collection_contract_signed_at?: string | null
          collection_datetime: string
          collection_info?: string | null
          collection_inspection_completed_at?: string | null
          collection_location: string
          company_name?: string | null
          confirmation_pdf_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          delivery_contract_signed_at?: string | null
          delivery_datetime: string
          delivery_info?: string | null
          delivery_inspection_completed_at?: string | null
          delivery_location: string
          document_requirements?: Json | null
          documents_required?: boolean
          documents_required_note?: string | null
          email_import_date?: string | null
          extra_deduction?: number | null
          extra_km_cost?: number | null
          guest_billing_address?: string | null
          guest_company_name?: string | null
          guest_country?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          imported_from_email?: boolean | null
          km_included?: number | null
          last_email_update?: string | null
          manual_instructions_balance?: string | null
          manual_instructions_downpayment?: string | null
          manual_instructions_security_deposit?: string | null
          manual_payment_for_balance?: boolean | null
          manual_payment_for_downpayment?: boolean | null
          manual_payment_for_security_deposit?: boolean | null
          manual_payment_instructions?: string | null
          original_client_name?: string | null
          other_costs_total?: number
          payment_amount_option?: string | null
          payment_amount_percent?: number | null
          payment_method?: string | null
          reference_code: string
          rental_completed_at?: string | null
          rental_day_hour_tolerance?: number | null
          rental_price_gross: number
          rental_started_at?: string | null
          security_deposit_amount?: number
          security_deposit_authorization_id?: string | null
          security_deposit_authorized_at?: string | null
          security_deposit_link_id?: string | null
          security_deposit_reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          supplier_name?: string | null
          supplier_price?: number
          tc_accepted_at?: string | null
          tc_accepted_ip?: unknown
          tc_signature_data?: string | null
          tc_version_id?: string | null
          total_rental_amount?: number | null
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          additional_services?: Json | null
          agency_email?: string | null
          agency_id?: string | null
          agency_name?: string | null
          agency_phone?: string | null
          amount_paid?: number
          amount_total?: number
          available_payment_methods?: Json | null
          balance_due_date?: string | null
          balance_payment_link_id?: string | null
          balance_payment_reminder_sent_at?: string | null
          billing_address?: string | null
          booking_confirmation_pdf_sent_at?: string | null
          booking_date?: string | null
          booking_form_last_accessed_at?: string | null
          booking_form_sent_at?: string | null
          booking_type?: Database["public"]["Enums"]["booking_type"]
          car_model?: string
          car_plate?: string
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          collection_contract_signed_at?: string | null
          collection_datetime?: string
          collection_info?: string | null
          collection_inspection_completed_at?: string | null
          collection_location?: string
          company_name?: string | null
          confirmation_pdf_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          delivery_contract_signed_at?: string | null
          delivery_datetime?: string
          delivery_info?: string | null
          delivery_inspection_completed_at?: string | null
          delivery_location?: string
          document_requirements?: Json | null
          documents_required?: boolean
          documents_required_note?: string | null
          email_import_date?: string | null
          extra_deduction?: number | null
          extra_km_cost?: number | null
          guest_billing_address?: string | null
          guest_company_name?: string | null
          guest_country?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          imported_from_email?: boolean | null
          km_included?: number | null
          last_email_update?: string | null
          manual_instructions_balance?: string | null
          manual_instructions_downpayment?: string | null
          manual_instructions_security_deposit?: string | null
          manual_payment_for_balance?: boolean | null
          manual_payment_for_downpayment?: boolean | null
          manual_payment_for_security_deposit?: boolean | null
          manual_payment_instructions?: string | null
          original_client_name?: string | null
          other_costs_total?: number
          payment_amount_option?: string | null
          payment_amount_percent?: number | null
          payment_method?: string | null
          reference_code?: string
          rental_completed_at?: string | null
          rental_day_hour_tolerance?: number | null
          rental_price_gross?: number
          rental_started_at?: string | null
          security_deposit_amount?: number
          security_deposit_authorization_id?: string | null
          security_deposit_authorized_at?: string | null
          security_deposit_link_id?: string | null
          security_deposit_reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          supplier_name?: string | null
          supplier_price?: number
          tc_accepted_at?: string | null
          tc_accepted_ip?: unknown
          tc_signature_data?: string | null
          tc_version_id?: string | null
          total_rental_amount?: number | null
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tc_version_id_fkey"
            columns: ["tc_version_id"]
            isOneToOne: false
            referencedRelation: "terms_and_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          deleted_at: string | null
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["message_entity_type"]
          id: string
          mentioned_users: string[] | null
          message: string
          parent_message_id: string | null
          source: string
          telegram_chat_id: string | null
          telegram_message_id: string | null
          telegram_user_id: string | null
          telegram_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type: Database["public"]["Enums"]["message_entity_type"]
          id?: string
          mentioned_users?: string[] | null
          message: string
          parent_message_id?: string | null
          source?: string
          telegram_chat_id?: string | null
          telegram_message_id?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["message_entity_type"]
          id?: string
          mentioned_users?: string[] | null
          message?: string
          parent_message_id?: string | null
          source?: string
          telegram_chat_id?: string | null
          telegram_message_id?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_notifications: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["message_entity_type"]
          id: string
          message_id: string
          notification_type: string
          read: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["message_entity_type"]
          id?: string
          message_id: string
          notification_type: string
          read?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["message_entity_type"]
          id?: string
          message_id?: string
          notification_type?: string
          read?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_unread_messages: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["message_entity_type"]
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["message_entity_type"]
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["message_entity_type"]
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_unread_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoices: {
        Row: {
          billing_address: string | null
          booking_id: string
          client_name: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          payment_status: string
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
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_number: string
          issue_date: string
          notes?: string | null
          payment_status?: string
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
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          payment_status?: string
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
      currency_conversion_rates: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          from_currency: string
          id: string
          rate: number
          source: string | null
          to_currency: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          from_currency: string
          id?: string
          rate: number
          source?: string | null
          to_currency: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          source?: string | null
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_conversion_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_process_steps: {
        Row: {
          created_at: string | null
          description: string
          icon_name: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          step_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          step_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          step_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_import_logs: {
        Row: {
          action: string
          booking_reference: string | null
          changes_detected: string[] | null
          email_id: string
          email_subject: string | null
          error_message: string | null
          id: string
          processed_at: string | null
          raw_email_snippet: string | null
        }
        Insert: {
          action: string
          booking_reference?: string | null
          changes_detected?: string[] | null
          email_id: string
          email_subject?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          raw_email_snippet?: string | null
        }
        Update: {
          action?: string
          booking_reference?: string | null
          changes_detected?: string[] | null
          email_id?: string
          email_subject?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          raw_email_snippet?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          html_content: string
          id: string
          is_active: boolean | null
          subject_line: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          subject_line: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          subject_line?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: []
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
      extra_cost_approvals: {
        Row: {
          approved_at: string
          approved_via_ip: unknown
          approved_via_token: string | null
          booking_document_id: string | null
          booking_id: string
          created_at: string | null
          id: string
          is_locked: boolean | null
        }
        Insert: {
          approved_at?: string
          approved_via_ip?: unknown
          approved_via_token?: string | null
          booking_document_id?: string | null
          booking_id: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
        }
        Update: {
          approved_at?: string
          approved_via_ip?: unknown
          approved_via_token?: string | null
          booking_document_id?: string | null
          booking_id?: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "extra_cost_approvals_booking_document_id_fkey"
            columns: ["booking_document_id"]
            isOneToOne: false
            referencedRelation: "booking_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_cost_approvals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_cost_approvals_booking_id_fkey"
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
          created_by: string | null
          currency: string
          deleted_at: string | null
          display_name: string | null
          document_url: string | null
          fine_number: string | null
          id: string
          issue_date: string
          notification_notes: string | null
          notified_at: string | null
          payment_proof_url: string | null
          payment_status: Database["public"]["Enums"]["fine_payment_status"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          booking_id?: string | null
          car_plate?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          display_name?: string | null
          document_url?: string | null
          fine_number?: string | null
          id?: string
          issue_date: string
          notification_notes?: string | null
          notified_at?: string | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["fine_payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          booking_id?: string | null
          car_plate?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          display_name?: string | null
          document_url?: string | null
          fine_number?: string | null
          id?: string
          issue_date?: string
          notification_notes?: string | null
          notified_at?: string | null
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
      issue_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          issue_id: string
          note: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          issue_id: string
          note: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          issue_id?: string
          note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_notes_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_reports: {
        Row: {
          actual_behavior: string
          additional_notes: string | null
          assigned_to: string | null
          attempted_action: string
          browser_info: Json | null
          category: Database["public"]["Enums"]["issue_category"]
          console_errors: Json | null
          created_at: string
          expected_behavior: string | null
          id: string
          page_route: string
          priority: Database["public"]["Enums"]["issue_priority"]
          reported_by: string
          resolved_at: string | null
          screen_size: string | null
          screenshot_url: string | null
          status: Database["public"]["Enums"]["issue_status"]
          steps_to_reproduce: string | null
          title: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          actual_behavior: string
          additional_notes?: string | null
          assigned_to?: string | null
          attempted_action: string
          browser_info?: Json | null
          category: Database["public"]["Enums"]["issue_category"]
          console_errors?: Json | null
          created_at?: string
          expected_behavior?: string | null
          id?: string
          page_route: string
          priority?: Database["public"]["Enums"]["issue_priority"]
          reported_by: string
          resolved_at?: string | null
          screen_size?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          steps_to_reproduce?: string | null
          title: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          actual_behavior?: string
          additional_notes?: string | null
          assigned_to?: string | null
          attempted_action?: string
          browser_info?: Json | null
          category?: Database["public"]["Enums"]["issue_category"]
          console_errors?: Json | null
          created_at?: string
          expected_behavior?: string | null
          id?: string
          page_route?: string
          priority?: Database["public"]["Enums"]["issue_priority"]
          reported_by?: string
          resolved_at?: string | null
          screen_size?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          steps_to_reproduce?: string | null
          title?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      issue_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          issue_id: string
          new_status: Database["public"]["Enums"]["issue_status"]
          old_status: Database["public"]["Enums"]["issue_status"] | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          issue_id: string
          new_status: Database["public"]["Enums"]["issue_status"]
          old_status?: Database["public"]["Enums"]["issue_status"] | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          issue_id?: string
          new_status?: Database["public"]["Enums"]["issue_status"]
          old_status?: Database["public"]["Enums"]["issue_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_status_history_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          admin_only: boolean
          created_at: string
          currency: string
          description: string | null
          display_name: string
          fee_percentage: number
          id: string
          is_enabled: boolean
          method_type: string
          requires_conversion: boolean
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          admin_only?: boolean
          created_at?: string
          currency: string
          description?: string | null
          display_name: string
          fee_percentage?: number
          id?: string
          is_enabled?: boolean
          method_type: string
          requires_conversion?: boolean
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          admin_only?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          display_name?: string
          fee_percentage?: number
          id?: string
          is_enabled?: boolean
          method_type?: string
          requires_conversion?: boolean
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_success_messages: {
        Row: {
          created_at: string | null
          created_by: string | null
          html_content: string
          id: string
          is_active: boolean | null
          message_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          message_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          message_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          confirmation_email_sent_at: string | null
          conversion_rate_used: number | null
          converted_amount: number | null
          counts_towards_revenue: boolean | null
          created_at: string
          currency: string
          fee_amount: number | null
          fee_percentage: number | null
          fine_id: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          original_amount: number | null
          original_currency: string | null
          paid_at: string | null
          payment_intent: string | null
          payment_link_expires_at: string | null
          payment_link_id: string | null
          payment_link_status:
            | Database["public"]["Enums"]["payment_link_status"]
            | null
          payment_link_url: string | null
          payment_method_type: string | null
          postfinance_session_id: string | null
          postfinance_transaction_id: string | null
          proof_url: string | null
          receipt_sent_at: string | null
          receipt_url: string | null
          total_amount: number | null
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          confirmation_email_sent_at?: string | null
          conversion_rate_used?: number | null
          converted_amount?: number | null
          counts_towards_revenue?: boolean | null
          created_at?: string
          currency?: string
          fee_amount?: number | null
          fee_percentage?: number | null
          fine_id?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          original_amount?: number | null
          original_currency?: string | null
          paid_at?: string | null
          payment_intent?: string | null
          payment_link_expires_at?: string | null
          payment_link_id?: string | null
          payment_link_status?:
            | Database["public"]["Enums"]["payment_link_status"]
            | null
          payment_link_url?: string | null
          payment_method_type?: string | null
          postfinance_session_id?: string | null
          postfinance_transaction_id?: string | null
          proof_url?: string | null
          receipt_sent_at?: string | null
          receipt_url?: string | null
          total_amount?: number | null
          type: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          confirmation_email_sent_at?: string | null
          conversion_rate_used?: number | null
          converted_amount?: number | null
          counts_towards_revenue?: boolean | null
          created_at?: string
          currency?: string
          fee_amount?: number | null
          fee_percentage?: number | null
          fine_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          original_amount?: number | null
          original_currency?: string | null
          paid_at?: string | null
          payment_intent?: string | null
          payment_link_expires_at?: string | null
          payment_link_id?: string | null
          payment_link_status?:
            | Database["public"]["Enums"]["payment_link_status"]
            | null
          payment_link_url?: string | null
          payment_method_type?: string | null
          postfinance_session_id?: string | null
          postfinance_transaction_id?: string | null
          proof_url?: string | null
          receipt_sent_at?: string | null
          receipt_url?: string | null
          total_amount?: number | null
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
          {
            foreignKeyName: "payments_fine_id_fkey"
            columns: ["fine_id"]
            isOneToOne: false
            referencedRelation: "fines"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          calendar_token: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          view_scope: string
        }
        Insert: {
          avatar_url?: string | null
          calendar_token?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
          view_scope?: string
        }
        Update: {
          avatar_url?: string | null
          calendar_token?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          view_scope?: string
        }
        Relationships: []
      }
      rental_policies: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          policy_type: string
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          policy_type: string
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          policy_type?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      security_deposit_authorizations: {
        Row: {
          amount: number
          authorization_id: string
          authorized_at: string | null
          booking_id: string
          capture_reason: string | null
          captured_amount: number | null
          captured_at: string | null
          created_at: string | null
          currency: string
          expires_at: string | null
          id: string
          released_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          authorization_id: string
          authorized_at?: string | null
          booking_id: string
          capture_reason?: string | null
          captured_amount?: number | null
          captured_at?: string | null
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          released_at?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          authorization_id?: string
          authorized_at?: string | null
          booking_id?: string
          capture_reason?: string | null
          captured_amount?: number | null
          captured_at?: string | null
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          released_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_deposit_authorizations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_deposit_authorizations_booking_id_fkey"
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
          amount_paid: number | null
          booking_id: string | null
          car_plate: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          id: string
          invoice_type: string | null
          invoice_url: string | null
          issue_date: string
          payment_proof_url: string | null
          payment_status: Database["public"]["Enums"]["invoice_payment_status"]
          supplier_name: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number | null
          booking_id?: string | null
          car_plate?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          invoice_type?: string | null
          invoice_url?: string | null
          issue_date: string
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["invoice_payment_status"]
          supplier_name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number | null
          booking_id?: string | null
          car_plate?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          invoice_type?: string | null
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
      tax_invoices: {
        Row: {
          billing_address: string | null
          booking_id: string | null
          client_email: string | null
          client_name: string
          collection_location: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          delivery_location: string | null
          id: string
          invoice_date: string
          invoice_number: string
          line_items: Json
          notes: string | null
          payment_id: string | null
          pdf_url: string | null
          rental_description: string | null
          rental_end_date: string | null
          rental_start_date: string | null
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          billing_address?: string | null
          booking_id?: string | null
          client_email?: string | null
          client_name: string
          collection_location?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          delivery_location?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          line_items?: Json
          notes?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          rental_description?: string | null
          rental_end_date?: string | null
          rental_start_date?: string | null
          status?: string
          subtotal: number
          total_amount: number
          updated_at?: string
          vat_amount: number
          vat_rate?: number
        }
        Update: {
          billing_address?: string | null
          booking_id?: string | null
          client_email?: string | null
          client_name?: string
          collection_location?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          delivery_location?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          line_items?: Json
          notes?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          rental_description?: string | null
          rental_end_date?: string | null
          rental_start_date?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_config: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["message_entity_type"]
          id: string
          is_enabled: boolean
          telegram_chat_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: Database["public"]["Enums"]["message_entity_type"]
          id?: string
          is_enabled?: boolean
          telegram_chat_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["message_entity_type"]
          id?: string
          is_enabled?: boolean
          telegram_chat_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      terms_and_conditions: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          is_active: boolean
          pdf_url: string | null
          updated_at: string
          version: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          is_active?: boolean
          pdf_url?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          is_active?: boolean
          pdf_url?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_and_conditions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      webhook_logs: {
        Row: {
          booking_id: string | null
          created_at: string
          entity_id: string
          error_message: string | null
          event_id: string | null
          event_type: string | null
          id: string
          ip_address: string | null
          payment_id: string | null
          processing_duration_ms: number | null
          request_payload: Json | null
          response_data: Json | null
          space_id: string | null
          state: string | null
          status: string
          user_agent: string | null
          webhook_listener_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          entity_id: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          payment_id?: string | null
          processing_duration_ms?: number | null
          request_payload?: Json | null
          response_data?: Json | null
          space_id?: string | null
          state?: string | null
          status: string
          user_agent?: string | null
          webhook_listener_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          entity_id?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          payment_id?: string | null
          processing_duration_ms?: number | null
          request_payload?: Json | null
          response_data?: Json | null
          space_id?: string | null
          state?: string | null
          status?: string
          user_agent?: string | null
          webhook_listener_id?: string | null
        }
        Relationships: []
      }
      whitelisted_emails: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          id: string
          notes: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          id?: string
          notes?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
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
      generate_booking_token: {
        Args: { p_booking_id: string; p_expires_in_days?: number }
        Returns: string
      }
      get_latest_conversion_rate: {
        Args: { p_from_currency: string; p_to_currency: string }
        Returns: number
      }
      get_next_booking_reference:
        | { Args: never; Returns: string }
        | { Args: { is_test?: boolean }; Returns: string }
      get_next_tax_invoice_number: { Args: never; Returns: string }
      get_user_view_scope: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      track_token_access: { Args: { p_token: string }; Returns: undefined }
    }
    Enums: {
      adjustment_type: "refund" | "voucher"
      app_role: "admin" | "staff" | "read_only" | "accountant"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "status_change"
        | "pay"
        | "upload"
        | "booking_form_sent"
        | "soft_delete"
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
      booking_type: "direct" | "agency"
      document_type:
        | "id_card"
        | "drivers_license"
        | "passport"
        | "other"
        | "rental_contract"
        | "car_condition_photo"
        | "car_condition_video"
        | "extra_km_invoice"
        | "fuel_balance_invoice"
        | "damage_invoice"
        | "fine_document"
        | "id_card_front"
        | "id_card_back"
        | "drivers_license_front"
        | "drivers_license_back"
        | "selfie_with_id"
        | "proof_of_address"
        | "driver2_license_front"
        | "driver2_license_back"
        | "driver3_license_front"
        | "driver3_license_back"
        | "rental_contract_delivery"
        | "rental_contract_collection"
        | "car_condition_delivery_photo"
        | "car_condition_delivery_video"
        | "car_condition_collection_photo"
        | "car_condition_collection_video"
        | "extra_cost_invoice"
        | "damage_quote"
      expense_category:
        | "transfer"
        | "fuel"
        | "cleaning"
        | "tyres"
        | "parking"
        | "other"
      financial_status: "loss" | "breakeven" | "profit"
      fine_payment_status: "unpaid" | "paid" | "notified"
      invoice_payment_status: "to_pay" | "paid"
      issue_category:
        | "bug"
        | "feature_request"
        | "performance"
        | "ui_ux"
        | "data_issue"
        | "authentication"
        | "integration"
        | "other"
      issue_priority: "low" | "medium" | "high" | "critical"
      issue_status:
        | "new"
        | "under_review"
        | "in_progress"
        | "resolved"
        | "wont_fix"
        | "need_more_info"
      message_entity_type:
        | "booking"
        | "fine"
        | "supplier_invoice"
        | "client_invoice"
        | "general"
        | "rental"
      payment_link_status:
        | "pending"
        | "active"
        | "expired"
        | "paid"
        | "cancelled"
      payment_method: "card" | "wire" | "pos" | "other"
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
      adjustment_type: ["refund", "voucher"],
      app_role: ["admin", "staff", "read_only", "accountant"],
      audit_action: [
        "create",
        "update",
        "delete",
        "status_change",
        "pay",
        "upload",
        "booking_form_sent",
        "soft_delete",
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
      booking_type: ["direct", "agency"],
      document_type: [
        "id_card",
        "drivers_license",
        "passport",
        "other",
        "rental_contract",
        "car_condition_photo",
        "car_condition_video",
        "extra_km_invoice",
        "fuel_balance_invoice",
        "damage_invoice",
        "fine_document",
        "id_card_front",
        "id_card_back",
        "drivers_license_front",
        "drivers_license_back",
        "selfie_with_id",
        "proof_of_address",
        "driver2_license_front",
        "driver2_license_back",
        "driver3_license_front",
        "driver3_license_back",
        "rental_contract_delivery",
        "rental_contract_collection",
        "car_condition_delivery_photo",
        "car_condition_delivery_video",
        "car_condition_collection_photo",
        "car_condition_collection_video",
        "extra_cost_invoice",
        "damage_quote",
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
      fine_payment_status: ["unpaid", "paid", "notified"],
      invoice_payment_status: ["to_pay", "paid"],
      issue_category: [
        "bug",
        "feature_request",
        "performance",
        "ui_ux",
        "data_issue",
        "authentication",
        "integration",
        "other",
      ],
      issue_priority: ["low", "medium", "high", "critical"],
      issue_status: [
        "new",
        "under_review",
        "in_progress",
        "resolved",
        "wont_fix",
        "need_more_info",
      ],
      message_entity_type: [
        "booking",
        "fine",
        "supplier_invoice",
        "client_invoice",
        "general",
        "rental",
      ],
      payment_link_status: [
        "pending",
        "active",
        "expired",
        "paid",
        "cancelled",
      ],
      payment_method: ["card", "wire", "pos", "other"],
      payment_status: ["unpaid", "partial", "paid"],
      payment_type: ["deposit", "balance", "full"],
    },
  },
} as const
