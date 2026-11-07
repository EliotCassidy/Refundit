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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      brands: {
        Row: {
          agent_hints: string | null
          aliases: string[]
          captcha_observed: boolean
          contact_email: string | null
          contact_url: string | null
          created_at: string
          id: string
          last_checked_at: string | null
          manufacturer: string | null
          name: string
          requires_receipt_upload: boolean
          source: Database["public"]["Enums"]["brand_source"]
          verified: boolean
        }
        Insert: {
          agent_hints?: string | null
          aliases?: string[]
          captcha_observed?: boolean
          contact_email?: string | null
          contact_url?: string | null
          created_at?: string
          id?: string
          last_checked_at?: string | null
          manufacturer?: string | null
          name: string
          requires_receipt_upload?: boolean
          source: Database["public"]["Enums"]["brand_source"]
          verified?: boolean
        }
        Update: {
          agent_hints?: string | null
          aliases?: string[]
          captcha_observed?: boolean
          contact_email?: string | null
          contact_url?: string | null
          created_at?: string
          id?: string
          last_checked_at?: string | null
          manufacturer?: string | null
          name?: string
          requires_receipt_upload?: boolean
          source?: Database["public"]["Enums"]["brand_source"]
          verified?: boolean
        }
        Relationships: []
      }
      claim_emails: {
        Row: {
          body_text: string | null
          claim_id: string | null
          classification:
            | Database["public"]["Enums"]["email_classification"]
            | null
          classification_reason: string | null
          created_at: string
          from_address: string
          id: string
          provider_message_id: string
          received_at: string
          subject: string | null
          to_address: string
        }
        Insert: {
          body_text?: string | null
          claim_id?: string | null
          classification?:
            | Database["public"]["Enums"]["email_classification"]
            | null
          classification_reason?: string | null
          created_at?: string
          from_address: string
          id?: string
          provider_message_id: string
          received_at: string
          subject?: string | null
          to_address: string
        }
        Update: {
          body_text?: string | null
          claim_id?: string | null
          classification?:
            | Database["public"]["Enums"]["email_classification"]
            | null
          classification_reason?: string | null
          created_at?: string
          from_address?: string
          id?: string
          provider_message_id?: string
          received_at?: string
          subject?: string | null
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_emails_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_events: {
        Row: {
          claim_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["claim_status"] | null
          id: string
          payload: Json | null
          to_status: Database["public"]["Enums"]["claim_status"] | null
          type: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["claim_status"] | null
          id?: string
          payload?: Json | null
          to_status?: Database["public"]["Enums"]["claim_status"] | null
          type: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["claim_status"] | null
          id?: string
          payload?: Json | null
          to_status?: Database["public"]["Enums"]["claim_status"] | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          attempt: number
          brand_id: string | null
          complaint_text: string | null
          confirmation_number: string | null
          created_at: string
          dry_run: boolean
          failure_reason: string | null
          h_agent_view_url: string | null
          h_session_id: string | null
          id: string
          inbound_alias: string | null
          issue_description: string | null
          issue_photo_path: string | null
          issue_type: Database["public"]["Enums"]["issue_type"]
          line_item_id: string
          receipt_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["claim_status"]
          submission_channel: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt?: number
          brand_id?: string | null
          complaint_text?: string | null
          confirmation_number?: string | null
          created_at?: string
          dry_run?: boolean
          failure_reason?: string | null
          h_agent_view_url?: string | null
          h_session_id?: string | null
          id?: string
          inbound_alias?: string | null
          issue_description?: string | null
          issue_photo_path?: string | null
          issue_type: Database["public"]["Enums"]["issue_type"]
          line_item_id: string
          receipt_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submission_channel?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt?: number
          brand_id?: string | null
          complaint_text?: string | null
          confirmation_number?: string | null
          created_at?: string
          dry_run?: boolean
          failure_reason?: string | null
          h_agent_view_url?: string | null
          h_session_id?: string | null
          id?: string
          inbound_alias?: string | null
          issue_description?: string | null
          issue_photo_path?: string | null
          issue_type?: Database["public"]["Enums"]["issue_type"]
          line_item_id?: string
          receipt_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submission_channel?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      line_items: {
        Row: {
          brand_id: string | null
          brand_name_guess: string | null
          confirmed_product: Json | null
          created_at: string
          ean: string | null
          id: string
          position: number
          product_candidates: Json | null
          product_name: string
          quantity: number
          raw_label: string
          receipt_id: string
          total_price_cents: number
          unit_price_cents: number | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          brand_name_guess?: string | null
          confirmed_product?: Json | null
          created_at?: string
          ean?: string | null
          id?: string
          position: number
          product_candidates?: Json | null
          product_name: string
          quantity?: number
          raw_label: string
          receipt_id: string
          total_price_cents: number
          unit_price_cents?: number | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          brand_name_guess?: string | null
          confirmed_product?: Json | null
          created_at?: string
          ean?: string | null
          id?: string
          position?: number
          product_candidates?: Json | null
          product_name?: string
          quantity?: number
          raw_label?: string
          receipt_id?: string
          total_price_cents?: number
          unit_price_cents?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_matches: {
        Row: {
          confirmations: number
          created_at: string
          ean: string
          id: string
          label_key: string
          last_confirmed_at: string
          product: Json
          raw_label: string
          store_chain: string
        }
        Insert: {
          confirmations?: number
          created_at?: string
          ean: string
          id?: string
          label_key: string
          last_confirmed_at?: string
          product: Json
          raw_label: string
          store_chain?: string
        }
        Update: {
          confirmations?: number
          created_at?: string
          ean?: string
          id?: string
          label_key?: string
          last_confirmed_at?: string
          product?: Json
          raw_label?: string
          store_chain?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string
          created_at: string
          first_name: string
          iban: string | null
          id: string
          last_name: string
          phone: string | null
          postal_code: string
          updated_at: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string
          created_at?: string
          first_name: string
          iban?: string | null
          id: string
          last_name: string
          phone?: string | null
          postal_code: string
          updated_at?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string
          created_at?: string
          first_name?: string
          iban?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          postal_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          currency: string
          error: string | null
          id: string
          image_path: string
          purchased_at: string | null
          raw_parse: Json | null
          status: Database["public"]["Enums"]["receipt_status"]
          store_name: string | null
          total_cents: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          error?: string | null
          id?: string
          image_path: string
          purchased_at?: string | null
          raw_parse?: Json | null
          status?: Database["public"]["Enums"]["receipt_status"]
          store_name?: string | null
          total_cents?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          error?: string | null
          id?: string
          image_path?: string
          purchased_at?: string | null
          raw_parse?: Json | null
          status?: Database["public"]["Enums"]["receipt_status"]
          store_name?: string | null
          total_cents?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      brand_source: "seed" | "linkup" | "manual"
      claim_status:
        | "draft"
        | "submitting"
        | "submitted"
        | "waiting_input"
        | "accepted"
        | "refused"
        | "agent_failed"
        | "needs_manual"
        | "cancelled"
      email_classification:
        | "acknowledgement"
        | "accepted"
        | "refused"
        | "waiting_input"
        | "other"
      issue_type:
        | "damaged"
        | "missing_quantity"
        | "expired"
        | "quality"
        | "foreign_object"
        | "flat_drink"
        | "other"
      receipt_status: "uploaded" | "parsing" | "parsed" | "failed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      brand_source: ["seed", "linkup", "manual"],
      claim_status: [
        "draft",
        "submitting",
        "submitted",
        "waiting_input",
        "accepted",
        "refused",
        "agent_failed",
        "needs_manual",
        "cancelled",
      ],
      email_classification: [
        "acknowledgement",
        "accepted",
        "refused",
        "waiting_input",
        "other",
      ],
      issue_type: [
        "damaged",
        "missing_quantity",
        "expired",
        "quality",
        "foreign_object",
        "flat_drink",
        "other",
      ],
      receipt_status: ["uploaded", "parsing", "parsed", "failed"],
    },
  },
} as const
