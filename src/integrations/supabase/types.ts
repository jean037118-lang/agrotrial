export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda_tasks: {
        Row: {
          client_id: string | null
          created_at: string
          done: boolean
          due_date: string
          id: string
          notes: string | null
          title: string
          type: string
          vendor_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          done?: boolean
          due_date: string
          id?: string
          notes?: string | null
          title: string
          type?: string
          vendor_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string
          id?: string
          notes?: string | null
          title?: string
          type?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          city: string | null
          created_at: string
          culture: string | null
          email: string | null
          farm: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          potential: string
          state: string | null
          updated_at: string
          vendor_id: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          culture?: string | null
          email?: string | null
          farm?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          potential?: string
          state?: string | null
          updated_at?: string
          vendor_id: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          culture?: string | null
          email?: string | null
          farm?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          potential?: string
          state?: string | null
          updated_at?: string
          vendor_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      future_sales: {
        Row: {
          client_id: string
          created_at: string
          expected_month: string
          expected_tons: number
          id: string
          notes: string | null
          vendor_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expected_month: string
          expected_tons: number
          id?: string
          notes?: string | null
          vendor_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expected_month?: string
          expected_tons?: number
          id?: string
          notes?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "future_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          // ── Campos originais ──────────────────────────────────────────
          commission_per_ton: number
          created_at: string
          full_name: string | null
          id: string
          monthly_goal_tons: number
          recall_days: number
          updated_at: string
          // ── Campos novos (RBAC) ───────────────────────────────────────
          /** Papel do usuário no sistema: 'admin' | 'vendedor' */
          role: "admin" | "vendedor"
          /** Indica se o usuário está ativo. Admin pode inativar vendedores. */
          active: boolean
          /** E-mail espelhado de auth.users para exibição no painel admin. */
          email: string | null
        }
        Insert: {
          commission_per_ton?: number
          created_at?: string
          full_name?: string | null
          id: string
          monthly_goal_tons?: number
          recall_days?: number
          updated_at?: string
          role?: "admin" | "vendedor"
          active?: boolean
          email?: string | null
        }
        Update: {
          commission_per_ton?: number
          created_at?: string
          full_name?: string | null
          id?: string
          monthly_goal_tons?: number
          recall_days?: number
          updated_at?: string
          role?: "admin" | "vendedor"
          active?: boolean
          email?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          client_id: string
          commission_per_ton: number
          created_at: string
          delivery_date: string | null
          id: string
          notes: string | null
          price_per_ton: number | null
          product: string
          sale_date: string
          stage: string
          tons: number
          total_commission: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          client_id: string
          commission_per_ton: number
          created_at?: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          price_per_ton?: number | null
          product?: string
          sale_date?: string
          stage?: string
          tons: number
          total_commission?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          client_id?: string
          commission_per_ton?: number
          created_at?: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          price_per_ton?: number | null
          product?: string
          sale_date?: string
          stage?: string
          tons?: number
          total_commission?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_sales_summary: {
        Row: {
          vendor_id: string
          vendor_name: string | null
          vendor_email: string | null
          commission_per_ton: number
          monthly_goal_tons: number
          active: boolean
          total_sales: number
          total_tons: number
          total_commission: number
          month_tons: number
          month_commission: number
          year_tons: number
          total_clients: number
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      admin_create_user: {
        Args: {
          p_email: string
          p_password: string
          p_full_name: string
          p_role?: string
          p_commission?: number
          p_monthly_goal?: number
          p_recall_days?: number
        }
        Returns: Json
      }
      admin_update_user: {
        Args: {
          p_user_id: string
          p_full_name?: string
          p_role?: string
          p_commission?: number
          p_monthly_goal?: number
          p_recall_days?: number
          p_active?: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    ? DefaultSchema["CompositeTypes\"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
