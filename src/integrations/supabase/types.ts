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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cdi_cache: {
        Row: {
          fetched_at: string
          id: string
          rate: number
          reference_date: string
        }
        Insert: {
          fetched_at?: string
          id?: string
          rate: number
          reference_date: string
        }
        Update: {
          fetched_at?: string
          id?: string
          rate?: number
          reference_date?: string
        }
        Relationships: []
      }
      cdi_daily: {
        Row: {
          date: string
          factor: number
          fetched_at: string
          rate: number
        }
        Insert: {
          date: string
          factor: number
          fetched_at?: string
          rate: number
        }
        Update: {
          date?: string
          factor?: number
          fetched_at?: string
          rate?: number
        }
        Relationships: []
      }
      clientes_limites: {
        Row: {
          cnpj: string
          created_at: string
          grupo: string | null
          id: string
          socios: string | null
          status_operacoes: string | null
          total_com_carencia: number | null
          total_sem_carencia: number | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          grupo?: string | null
          id?: string
          socios?: string | null
          status_operacoes?: string | null
          total_com_carencia?: number | null
          total_sem_carencia?: number | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          grupo?: string | null
          id?: string
          socios?: string | null
          status_operacoes?: string | null
          total_com_carencia?: number | null
          total_sem_carencia?: number | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes_pre_aprovados: {
        Row: {
          cnpj: string
          created_at: string
          id: string
          limite: number
          produto: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string
          id?: string
          limite?: number
          produto?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string
          id?: string
          limite?: number
          produto?: string | null
        }
        Relationships: []
      }
      holidays: {
        Row: {
          date: string
          name: string
          source: string
        }
        Insert: {
          date: string
          name: string
          source?: string
        }
        Update: {
          date?: string
          name?: string
          source?: string
        }
        Relationships: []
      }
      import_history: {
        Row: {
          created_at: string
          id: string
          imported_by: string | null
          imported_by_email: string | null
          row_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          imported_by?: string | null
          imported_by_email?: string | null
          row_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          imported_by?: string | null
          imported_by_email?: string | null
          row_count?: number
        }
        Relationships: []
      }
      indicadores_manuais_mensais: {
        Row: {
          created_at: string
          id: string
          mes: string
          quantidade_operacoes_valora: number
          quantidade_operacoes_xvi: number
          quantidade_propostas: number
          updated_at: string
          updated_by: string | null
          valor_operacoes_valora: number
          valor_operacoes_xvi: number
        }
        Insert: {
          created_at?: string
          id?: string
          mes: string
          quantidade_operacoes_valora?: number
          quantidade_operacoes_xvi?: number
          quantidade_propostas?: number
          updated_at?: string
          updated_by?: string | null
          valor_operacoes_valora?: number
          valor_operacoes_xvi?: number
        }
        Update: {
          created_at?: string
          id?: string
          mes?: string
          quantidade_operacoes_valora?: number
          quantidade_operacoes_xvi?: number
          quantidade_propostas?: number
          updated_at?: string
          updated_by?: string | null
          valor_operacoes_valora?: number
          valor_operacoes_xvi?: number
        }
        Relationships: []
      }
      operacoes_ativas: {
        Row: {
          carencia_principal: number | null
          cnpj: string
          created_at: string
          data_aquisicao: string | null
          data_emissao: string | null
          data_vencimento_atual: string | null
          franquia: string | null
          id: string
          id_valora: string | null
          nosso_numero: string | null
          parcela_atual: number | null
          primeiro_vencimento: string | null
          refin_aditivo: string | null
          saldo_devedor: number | null
          seu_numero: string | null
          taxa_op: number | null
          taxa_op_raw: string | null
          tipo_op: string | null
          total_pago: number | null
          total_parcelas: number | null
          ultimo_vencimento: string | null
          updated_at: string
          valor_operacao: number | null
          valor_parcela: number | null
        }
        Insert: {
          carencia_principal?: number | null
          cnpj: string
          created_at?: string
          data_aquisicao?: string | null
          data_emissao?: string | null
          data_vencimento_atual?: string | null
          franquia?: string | null
          id?: string
          id_valora?: string | null
          nosso_numero?: string | null
          parcela_atual?: number | null
          primeiro_vencimento?: string | null
          refin_aditivo?: string | null
          saldo_devedor?: number | null
          seu_numero?: string | null
          taxa_op?: number | null
          taxa_op_raw?: string | null
          tipo_op?: string | null
          total_pago?: number | null
          total_parcelas?: number | null
          ultimo_vencimento?: string | null
          updated_at?: string
          valor_operacao?: number | null
          valor_parcela?: number | null
        }
        Update: {
          carencia_principal?: number | null
          cnpj?: string
          created_at?: string
          data_aquisicao?: string | null
          data_emissao?: string | null
          data_vencimento_atual?: string | null
          franquia?: string | null
          id?: string
          id_valora?: string | null
          nosso_numero?: string | null
          parcela_atual?: number | null
          primeiro_vencimento?: string | null
          refin_aditivo?: string | null
          saldo_devedor?: number | null
          seu_numero?: string | null
          taxa_op?: number | null
          taxa_op_raw?: string | null
          tipo_op?: string | null
          total_pago?: number | null
          total_parcelas?: number | null
          ultimo_vencimento?: string | null
          updated_at?: string
          valor_operacao?: number | null
          valor_parcela?: number | null
        }
        Relationships: []
      }
      operacoes_checklists: {
        Row: {
          checklist_type: string
          created_at: string
          created_by: string | null
          estabelecimento_cnpj: string
          id: string
          items_state: Json
          operacao_id: string | null
          updated_at: string
        }
        Insert: {
          checklist_type: string
          created_at?: string
          created_by?: string | null
          estabelecimento_cnpj: string
          id?: string
          items_state?: Json
          operacao_id?: string | null
          updated_at?: string
        }
        Update: {
          checklist_type?: string
          created_at?: string
          created_by?: string | null
          estabelecimento_cnpj?: string
          id?: string
          items_state?: Json
          operacao_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      operacoes_divergencias: {
        Row: {
          actual_payment: number
          cnpj: string
          detected_at: string
          diff: number
          diff_pct: number | null
          due_date: string | null
          id: string
          id_valora: string | null
          import_id_actual: string | null
          import_id_projected: string | null
          month: number
          projected_payment: number
          seu_numero: string | null
        }
        Insert: {
          actual_payment?: number
          cnpj: string
          detected_at?: string
          diff?: number
          diff_pct?: number | null
          due_date?: string | null
          id?: string
          id_valora?: string | null
          import_id_actual?: string | null
          import_id_projected?: string | null
          month: number
          projected_payment?: number
          seu_numero?: string | null
        }
        Update: {
          actual_payment?: number
          cnpj?: string
          detected_at?: string
          diff?: number
          diff_pct?: number | null
          due_date?: string | null
          id?: string
          id_valora?: string | null
          import_id_actual?: string | null
          import_id_projected?: string | null
          month?: number
          projected_payment?: number
          seu_numero?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operacoes_divergencias_import_id_actual_fkey"
            columns: ["import_id_actual"]
            isOneToOne: false
            referencedRelation: "operacoes_import_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operacoes_divergencias_import_id_projected_fkey"
            columns: ["import_id_projected"]
            isOneToOne: false
            referencedRelation: "operacoes_import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      operacoes_import_history: {
        Row: {
          created_at: string
          id: string
          imported_by: string | null
          imported_by_email: string | null
          row_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          imported_by?: string | null
          imported_by_email?: string | null
          row_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          imported_by?: string | null
          imported_by_email?: string | null
          row_count?: number
        }
        Relationships: []
      }
      operacoes_overrides: {
        Row: {
          carencia_meses: number
          carencia_tipo: string
          cnpj: string
          created_at: string
          id: string
          id_valora: string | null
          seu_numero: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          carencia_meses?: number
          carencia_tipo?: string
          cnpj: string
          created_at?: string
          id?: string
          id_valora?: string | null
          seu_numero?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          carencia_meses?: number
          carencia_tipo?: string
          cnpj?: string
          created_at?: string
          id?: string
          id_valora?: string | null
          seu_numero?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      operacoes_parcelas_manuais: {
        Row: {
          actual_payment: number
          cnpj: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          id_valora: string | null
          month: number
          note: string | null
          seu_numero: string | null
          updated_at: string
        }
        Insert: {
          actual_payment?: number
          cnpj: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          id_valora?: string | null
          month: number
          note?: string | null
          seu_numero?: string | null
          updated_at?: string
        }
        Update: {
          actual_payment?: number
          cnpj?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          id_valora?: string | null
          month?: number
          note?: string | null
          seu_numero?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      operacoes_projecoes: {
        Row: {
          cdi_aa: number | null
          cnpj: string
          created_at: string
          due_date: string | null
          id: string
          id_valora: string | null
          import_id: string
          month: number
          projected_amortization: number | null
          projected_balance: number | null
          projected_interest: number | null
          projected_payment: number
          seu_numero: string | null
          taxa_mensal: number | null
        }
        Insert: {
          cdi_aa?: number | null
          cnpj: string
          created_at?: string
          due_date?: string | null
          id?: string
          id_valora?: string | null
          import_id: string
          month: number
          projected_amortization?: number | null
          projected_balance?: number | null
          projected_interest?: number | null
          projected_payment?: number
          seu_numero?: string | null
          taxa_mensal?: number | null
        }
        Update: {
          cdi_aa?: number | null
          cnpj?: string
          created_at?: string
          due_date?: string | null
          id?: string
          id_valora?: string | null
          import_id?: string
          month?: number
          projected_amortization?: number | null
          projected_balance?: number | null
          projected_interest?: number | null
          projected_payment?: number
          seu_numero?: string | null
          taxa_mensal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operacoes_projecoes_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "operacoes_import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      operacoes_snapshots: {
        Row: {
          carencia_principal: number | null
          cnpj: string
          created_at: string
          data_aquisicao: string | null
          data_emissao: string | null
          data_vencimento_atual: string | null
          franquia: string | null
          id: string
          id_valora: string | null
          import_id: string
          nosso_numero: string | null
          parcela_atual: number | null
          primeiro_vencimento: string | null
          raw: Json | null
          refin_aditivo: string | null
          saldo_devedor: number | null
          seu_numero: string | null
          taxa_op: number | null
          taxa_op_raw: string | null
          tipo_op: string | null
          total_pago: number | null
          total_parcelas: number | null
          ultimo_vencimento: string | null
          valor_operacao: number | null
          valor_parcela: number | null
        }
        Insert: {
          carencia_principal?: number | null
          cnpj: string
          created_at?: string
          data_aquisicao?: string | null
          data_emissao?: string | null
          data_vencimento_atual?: string | null
          franquia?: string | null
          id?: string
          id_valora?: string | null
          import_id: string
          nosso_numero?: string | null
          parcela_atual?: number | null
          primeiro_vencimento?: string | null
          raw?: Json | null
          refin_aditivo?: string | null
          saldo_devedor?: number | null
          seu_numero?: string | null
          taxa_op?: number | null
          taxa_op_raw?: string | null
          tipo_op?: string | null
          total_pago?: number | null
          total_parcelas?: number | null
          ultimo_vencimento?: string | null
          valor_operacao?: number | null
          valor_parcela?: number | null
        }
        Update: {
          carencia_principal?: number | null
          cnpj?: string
          created_at?: string
          data_aquisicao?: string | null
          data_emissao?: string | null
          data_vencimento_atual?: string | null
          franquia?: string | null
          id?: string
          id_valora?: string | null
          import_id?: string
          nosso_numero?: string | null
          parcela_atual?: number | null
          primeiro_vencimento?: string | null
          raw?: Json | null
          refin_aditivo?: string | null
          saldo_devedor?: number | null
          seu_numero?: string | null
          taxa_op?: number | null
          taxa_op_raw?: string | null
          tipo_op?: string | null
          total_pago?: number | null
          total_parcelas?: number | null
          ultimo_vencimento?: string | null
          valor_operacao?: number | null
          valor_parcela?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operacoes_snapshots_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "operacoes_import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_parcelas: {
        Row: {
          actual_payment: number | null
          cnpj: string | null
          due_date: string | null
          id_valora: string | null
          month: number | null
          seu_numero: string | null
        }
        Insert: {
          actual_payment?: number | null
          cnpj?: string | null
          due_date?: string | null
          id_valora?: string | null
          month?: number | null
          seu_numero?: string | null
        }
        Update: {
          actual_payment?: number | null
          cnpj?: string | null
          due_date?: string | null
          id_valora?: string | null
          month?: number | null
          seu_numero?: string | null
        }
        Relationships: []
      }
      user_page_access: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          page_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          page_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          page_key?: string
          user_id?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
      [_ in never]: never
    }
    Functions: {
      bulk_insert_parcelas: { Args: { p_data: Json }; Returns: number }
      bulk_stage: { Args: { p_data: Json }; Returns: number }
      bulk_upsert_parcelas_manuais: {
        Args: { _rows: Json; _user: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
