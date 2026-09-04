export type MemberRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "CASHIER"
  | "RECEPTIONIST"
  | "STAFF";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          whatsapp_phone: string | null;
          nav_permissions: Json;
          booking_slot_minutes: number;
          booking_days_ahead: number;
          booking_advance_amount: number;
          booking_advance_percent: number;
          booking_payment_instructions: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          whatsapp_phone?: string | null;
          nav_permissions?: Json;
          booking_slot_minutes?: number;
          booking_days_ahead?: number;
          booking_advance_amount?: number;
          booking_advance_percent?: number;
          booking_payment_instructions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          whatsapp_phone?: string | null;
          nav_permissions?: Json;
          booking_slot_minutes?: number;
          booking_days_ahead?: number;
          booking_advance_amount?: number;
          booking_advance_percent?: number;
          booking_payment_instructions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: MemberRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: MemberRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string | null;
          phone: string | null;
          email: string | null;
          notes: string | null;
          tags: string[];
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          first_name: string;
          last_name?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          tags?: string[];
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          first_name?: string;
          last_name?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          tags?: string[];
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      service_categories: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_categories_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          id: string;
          organization_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price: number;
          duration_minutes: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price?: number;
          duration_minutes?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          category_id?: string | null;
          name?: string;
          description?: string | null;
          price?: number;
          duration_minutes?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "services_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      packages: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          price: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "packages_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      package_items: {
        Row: {
          id: string;
          organization_id: string;
          package_id: string;
          service_id: string;
          quantity: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          package_id: string;
          service_id: string;
          quantity?: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          package_id?: string;
          service_id?: string;
          quantity?: number;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "package_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "package_items_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "package_items_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      product_categories: {
        Row: { id: string; organization_id: string; name: string; sort_order: number; created_at: string; updated_at: string };
        Insert: { id?: string; organization_id: string; name: string; sort_order?: number; created_at?: string; updated_at?: string };
        Update: { id?: string; organization_id?: string; name?: string; sort_order?: number; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      products: {
        Row: {
          id: string; organization_id: string; category_id: string | null; sku: string | null;
          name: string; description: string | null; cost_price: number; retail_price: number;
          stock_quantity: number; low_stock_threshold: number; is_active: boolean;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; organization_id: string; category_id?: string | null; sku?: string | null;
          name: string; description?: string | null; cost_price?: number; retail_price?: number;
          stock_quantity?: number; low_stock_threshold?: number; is_active?: boolean;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; organization_id?: string; category_id?: string | null; sku?: string | null;
          name?: string; description?: string | null; cost_price?: number; retail_price?: number;
          stock_quantity?: number; low_stock_threshold?: number; is_active?: boolean;
          created_at?: string; updated_at?: string;
        };
        Relationships: [];
      };
      inventory_transactions: {
        Row: {
          id: string; organization_id: string; product_id: string;
          type: "IN" | "OUT" | "ADJUSTMENT"; quantity: number;
          reference_type: string | null; reference_id: string | null; notes: string | null;
          created_by: string | null; created_at: string;
        };
        Insert: {
          id?: string; organization_id: string; product_id: string;
          type: "IN" | "OUT" | "ADJUSTMENT"; quantity: number;
          reference_type?: string | null; reference_id?: string | null; notes?: string | null;
          created_by?: string | null; created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      sales: {
        Row: {
          id: string; organization_id: string; customer_id: string | null;
          appointment_id: string | null;
          staff_id: string | null;
          status: "DRAFT" | "COMPLETED" | "AMENDED" | "VOID" | "REFUNDED";
          payment_status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
          subtotal: number; discount: number; tax: number; total: number;
          deposit_applied: number;
          amount_paid: number; amount_refunded: number; amount_due: number;
          payment_version: number;
          notes: string | null;
          current_version: number;
          void_reason: string | null;
          voided_by: string | null;
          last_amended_at: string | null;
          last_amended_by: string | null;
          created_by: string | null; completed_at: string | null; voided_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; organization_id: string; customer_id?: string | null;
          appointment_id?: string | null;
          staff_id?: string | null;
          status?: "DRAFT" | "COMPLETED" | "AMENDED" | "VOID" | "REFUNDED";
          payment_status?: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
          subtotal?: number; discount?: number; tax?: number; total?: number;
          deposit_applied?: number;
          amount_paid?: number; amount_refunded?: number; amount_due?: number;
          payment_version?: number;
          notes?: string | null;
          current_version?: number;
          void_reason?: string | null;
          voided_by?: string | null;
          last_amended_at?: string | null;
          last_amended_by?: string | null;
          created_by?: string | null; completed_at?: string | null; voided_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; organization_id?: string; customer_id?: string | null;
          appointment_id?: string | null;
          staff_id?: string | null;
          status?: "DRAFT" | "COMPLETED" | "AMENDED" | "VOID" | "REFUNDED";
          payment_status?: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
          subtotal?: number; discount?: number; tax?: number; total?: number;
          deposit_applied?: number;
          amount_paid?: number; amount_refunded?: number; amount_due?: number;
          payment_version?: number;
          notes?: string | null;
          current_version?: number;
          void_reason?: string | null;
          voided_by?: string | null;
          last_amended_at?: string | null;
          last_amended_by?: string | null;
          created_by?: string | null; completed_at?: string | null; voided_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Relationships: [];
      };
      sale_items: {
        Row: {
          id: string; organization_id: string; sale_id: string;
          item_type: "SERVICE" | "PRODUCT" | "PACKAGE"; item_id: string; name: string;
          quantity: number; unit_price: number; line_total: number; created_at: string;
        };
        Insert: {
          id?: string; organization_id: string; sale_id: string;
          item_type: "SERVICE" | "PRODUCT" | "PACKAGE"; item_id: string; name: string;
          quantity?: number; unit_price: number; line_total: number; created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      sale_versions: {
        Row: {
          id: string; organization_id: string; sale_id: string; version_number: number;
          customer_id: string | null; appointment_id: string | null;
          subtotal: number; discount: number; tax: number; deposit_applied: number;
          total: number; payment_total: number; status: string; notes: string | null;
          change_reason: string | null; changed_by: string | null; changed_at: string;
        };
        Insert: {
          id?: string; organization_id: string; sale_id: string; version_number: number;
          customer_id?: string | null; appointment_id?: string | null;
          subtotal?: number; discount?: number; tax?: number; deposit_applied?: number;
          total?: number; payment_total?: number; status: string; notes?: string | null;
          change_reason?: string | null; changed_by?: string | null; changed_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "sale_versions_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_version_items: {
        Row: {
          id: string; organization_id: string; sale_version_id: string;
          item_type: "SERVICE" | "PRODUCT" | "PACKAGE"; item_id: string; name: string;
          quantity: number; unit_price: number; line_total: number; created_at: string;
        };
        Insert: {
          id?: string; organization_id: string; sale_version_id: string;
          item_type: "SERVICE" | "PRODUCT" | "PACKAGE"; item_id: string; name: string;
          quantity?: number; unit_price: number; line_total: number; created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "sale_version_items_sale_version_id_fkey";
            columns: ["sale_version_id"];
            isOneToOne: false;
            referencedRelation: "sale_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_refunds: {
        Row: {
          id: string; organization_id: string; sale_id: string; amount: number;
          method: "CASH" | "CARD" | "OTHER"; reason: string; reference: string | null;
          created_by: string | null; created_at: string;
        };
        Insert: {
          id?: string; organization_id: string; sale_id: string; amount: number;
          method?: "CASH" | "CARD" | "OTHER"; reason: string; reference?: string | null;
          created_by?: string | null; created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      invoices: {
        Row: { id: string; organization_id: string; sale_id: string; invoice_number: string; issued_at: string; created_at: string };
        Insert: { id?: string; organization_id: string; sale_id: string; invoice_number: string; issued_at?: string; created_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string; organization_id: string; sale_id: string;
          amount: number; method: "CASH" | "CARD" | "OTHER"; reference: string | null;
          notes: string | null; created_by: string | null;
          tendered_amount: number | null; change_given: number | null;
          paid_at: string; created_at: string;
        };
        Insert: {
          id?: string; organization_id: string; sale_id: string;
          amount: number; method?: "CASH" | "CARD" | "OTHER"; reference?: string | null;
          notes?: string | null; created_by?: string | null;
          tendered_amount?: number | null; change_given?: number | null;
          paid_at?: string; created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      appointment_deposits: {
        Row: {
          id: string;
          organization_id: string;
          appointment_id: string;
          amount: number;
          method: "CASH" | "CARD" | "OTHER";
          notes: string | null;
          status: "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED";
          payment_reference: string | null;
          proof_path: string | null;
          approved_at: string | null;
          approved_by: string | null;
          applied_to_sale_id: string | null;
          paid_at: string;
          created_by: string | null;
          created_at: string;
          refund_reason: string | null;
          refund_method: "CASH" | "CARD" | "OTHER" | null;
          refund_reference: string | null;
          refunded_at: string | null;
          refunded_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          appointment_id: string;
          amount: number;
          method?: "CASH" | "CARD" | "OTHER";
          notes?: string | null;
          status?: "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED";
          payment_reference?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          applied_to_sale_id?: string | null;
          paid_at?: string;
          created_by?: string | null;
          created_at?: string;
          refund_reason?: string | null;
          refund_method?: "CASH" | "CARD" | "OTHER" | null;
          refund_reference?: string | null;
          refunded_at?: string | null;
          refunded_by?: string | null;
        };
        Update: {
          status?: "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED";
          payment_reference?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          applied_to_sale_id?: string | null;
          refund_reason?: string | null;
          refund_method?: "CASH" | "CARD" | "OTHER" | null;
          refund_reference?: string | null;
          refunded_at?: string | null;
          refunded_by?: string | null;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          organization_id: string;
          category:
            | "RENT"
            | "UTILITIES"
            | "SUPPLIES"
            | "PAYROLL"
            | "MARKETING"
            | "MAINTENANCE"
            | "OTHER";
          amount: number;
          description: string | null;
          expense_date: string;
          payment_method: "CASH" | "CARD" | "OTHER";
          created_by: string | null;
          staff_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          category?:
            | "RENT"
            | "UTILITIES"
            | "SUPPLIES"
            | "PAYROLL"
            | "MARKETING"
            | "MAINTENANCE"
            | "OTHER";
          amount: number;
          description?: string | null;
          expense_date?: string;
          payment_method?: "CASH" | "CARD" | "OTHER";
          created_by?: string | null;
          staff_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category?:
            | "RENT"
            | "UTILITIES"
            | "SUPPLIES"
            | "PAYROLL"
            | "MARKETING"
            | "MAINTENANCE"
            | "OTHER";
          amount?: number;
          description?: string | null;
          expense_date?: string;
          payment_method?: "CASH" | "CARD" | "OTHER";
          staff_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_payments: {
        Row: {
          id: string;
          organization_id: string;
          staff_id: string;
          amount: number;
          payment_type: "SALARY" | "PARTIAL" | "ADVANCE" | "BONUS";
          payment_method: "CASH" | "CARD" | "OTHER";
          payment_date: string;
          paid_at: string;
          period_start: string | null;
          period_end: string | null;
          amount_due: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          staff_id: string;
          amount: number;
          payment_type?: "SALARY" | "PARTIAL" | "ADVANCE" | "BONUS";
          payment_method?: "CASH" | "CARD" | "OTHER";
          payment_date?: string;
          paid_at?: string;
          period_start?: string | null;
          period_end?: string | null;
          amount_due?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Record<string, unknown>;
        Relationships: [];
      };
      whatsapp_messages: {
        Row: {
          id: string; organization_id: string; customer_id: string | null;
          direction: "INBOUND" | "OUTBOUND"; status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "RECEIVED";
          phone: string; body: string; external_id: string | null;
          metadata: Record<string, unknown>; created_at: string;
        };
        Insert: {
          id?: string; organization_id: string; customer_id?: string | null;
          direction: "INBOUND" | "OUTBOUND"; status?: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "RECEIVED";
          phone: string; body: string; external_id?: string | null;
          metadata?: Record<string, unknown>; created_at?: string;
        };
        Update: {
          customer_id?: string | null;
          direction?: "INBOUND" | "OUTBOUND";
          status?: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "RECEIVED";
          phone?: string;
          body?: string;
          external_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string; organization_id: string; user_id: string | null;
          action: string; entity_type: string; entity_id: string | null;
          metadata: Record<string, unknown>; created_at: string;
        };
        Insert: {
          id?: string; organization_id: string; user_id?: string | null;
          action: string; entity_type: string; entity_id?: string | null;
          metadata?: Record<string, unknown>; created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      staff: {
        Row: {
          id: string; organization_id: string; member_id: string | null;
          full_name: string; phone: string | null; email: string | null;
          job_title: string | null; pin_code: string | null;
          thumb_id: string | null; thumb_enrolled_at: string | null;
          is_active: boolean;
          online_booking_enabled: boolean;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; organization_id: string; member_id?: string | null;
          full_name: string; phone?: string | null; email?: string | null;
          job_title?: string | null; pin_code?: string | null;
          thumb_id?: string | null; thumb_enrolled_at?: string | null;
          is_active?: boolean;
          online_booking_enabled?: boolean;
          created_at?: string; updated_at?: string;
        };
        Update: Record<string, unknown>;
        Relationships: [];
      };
      staff_schedules: {
        Row: {
          id: string;
          organization_id: string;
          staff_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          staff_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at?: string;
        };
        Update: {
          start_time?: string;
          end_time?: string;
        };
        Relationships: [];
      };
      staff_attendance: {
        Row: {
          id: string; organization_id: string; staff_id: string; device_id: string | null;
          check_in_at: string; check_out_at: string | null;
          method: "MANUAL" | "DEVICE" | "APP" | "BIOMETRIC"; notes: string | null; created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string; organization_id: string; customer_id: string; staff_id: string | null;
          scheduled_at: string; duration_minutes: number;
          status: string; source: string; notes: string | null;
          booking_number: string | null;
          manual_payment_amount: number | null; manual_payment_method: string | null;
          manual_payment_notes: string | null; manual_payment_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      appointment_services: {
        Row: { id: string; organization_id: string; appointment_id: string; service_id: string; service_name: string; price: number; duration_minutes: number; created_at: string };
        Insert: Record<string, unknown>;
        Update: Record<string, never>;
        Relationships: [];
      };
      queue_tokens: {
        Row: {
          id: string; organization_id: string; token_number: number; token_date: string;
          customer_id: string | null; appointment_id: string | null; customer_name: string;
          staff_id: string | null; chair_id: string | null; chair: string | null; issued_at: string;
          status: string; device_id: string | null; called_at: string | null;
          completed_at: string | null; created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      chairs: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          id: string; organization_id: string; name: string; type: string;
          api_key: string; location: string | null; is_active: boolean;
          auto_registered: boolean; last_seen_at: string | null;
          config: Record<string, unknown>; created_at: string; updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      device_commands: {
        Row: {
          id: string; organization_id: string; device_id: string; command: string;
          payload: Record<string, unknown>; status: string; error_message: string | null;
          created_at: string; completed_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      next_queue_token_number: { Args: { org_id: string }; Returns: number };
      next_booking_number: { Args: { org_id: string }; Returns: string };
    };
    Enums: {
      member_role: MemberRole;
      inventory_transaction_type: "IN" | "OUT" | "ADJUSTMENT";
      sale_status: "DRAFT" | "COMPLETED" | "AMENDED" | "VOID" | "REFUNDED";
      sale_item_type: "SERVICE" | "PRODUCT" | "PACKAGE";
      payment_method: "CASH" | "CARD" | "OTHER";
      whatsapp_direction: "INBOUND" | "OUTBOUND";
      whatsapp_status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "RECEIVED";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrganizationMember =
  Database["public"]["Tables"]["organization_members"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type ServiceCategory =
  Database["public"]["Tables"]["service_categories"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type Package = Database["public"]["Tables"]["packages"]["Row"];
export type PackageItem = Database["public"]["Tables"]["package_items"]["Row"];
export type ProductCategory = Database["public"]["Tables"]["product_categories"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Sale = Database["public"]["Tables"]["sales"]["Row"];
export type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
