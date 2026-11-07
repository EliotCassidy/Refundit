// BOOTSTRAP VERSION, hand-written to match supabase/migrations/20261107000000_init.sql
// so both devs get typed queries before the Supabase project is linked.
// Once linked, overwrite it with `npm run db:types` and never hand-edit it again.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ReceiptStatus = "uploaded" | "parsing" | "parsed" | "failed";
type IssueType = "damaged" | "missing_quantity" | "expired" | "quality" | "foreign_object" | "flat_drink" | "other";
type ClaimStatus =
  | "draft" | "submitting" | "submitted" | "waiting_input" | "accepted" | "refused"
  | "agent_failed" | "needs_manual" | "cancelled";
type BrandSource = "seed" | "linkup" | "manual";
type EmailClassification = "acknowledgement" | "accepted" | "refused" | "waiting_input" | "other";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; first_name: string; last_name: string; phone: string | null;
          address_line1: string; address_line2: string | null; postal_code: string; city: string;
          country: string; iban: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id: string; first_name: string; last_name: string; phone?: string | null;
          address_line1: string; address_line2?: string | null; postal_code: string; city: string;
          country?: string; iban?: string | null; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      brands: {
        Row: {
          id: string; name: string; manufacturer: string | null; aliases: string[];
          contact_url: string | null; agent_hints: string | null; requires_receipt_upload: boolean;
          captcha_observed: boolean; verified: boolean; source: BrandSource;
          last_checked_at: string | null; created_at: string;
        };
        Insert: {
          id?: string; name: string; manufacturer?: string | null; aliases?: string[];
          contact_url?: string | null; agent_hints?: string | null; requires_receipt_upload?: boolean;
          captcha_observed?: boolean; verified?: boolean; source: BrandSource;
          last_checked_at?: string | null; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["brands"]["Insert"]>;
        Relationships: [];
      };
      receipts: {
        Row: {
          id: string; user_id: string; image_path: string; status: ReceiptStatus;
          store_name: string | null; purchased_at: string | null; total_cents: number | null;
          currency: string; raw_parse: Json | null; error: string | null; created_at: string;
        };
        Insert: {
          id?: string; user_id: string; image_path: string; status?: ReceiptStatus;
          store_name?: string | null; purchased_at?: string | null; total_cents?: number | null;
          currency?: string; raw_parse?: Json | null; error?: string | null; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["receipts"]["Insert"]>;
        Relationships: [];
      };
      line_items: {
        Row: {
          id: string; receipt_id: string; user_id: string; position: number; raw_label: string;
          product_name: string; brand_id: string | null; brand_name_guess: string | null;
          ean: string | null; quantity: number; unit_price_cents: number | null;
          total_price_cents: number; created_at: string;
        };
        Insert: {
          id?: string; receipt_id: string; user_id: string; position: number; raw_label: string;
          product_name: string; brand_id?: string | null; brand_name_guess?: string | null;
          ean?: string | null; quantity?: number; unit_price_cents?: number | null;
          total_price_cents: number; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["line_items"]["Insert"]>;
        Relationships: [];
      };
      claims: {
        Row: {
          id: string; user_id: string; receipt_id: string; line_item_id: string; brand_id: string | null;
          issue_type: IssueType; issue_description: string | null; issue_photo_path: string | null;
          status: ClaimStatus; inbound_alias: string | null; complaint_text: string | null;
          h_session_id: string | null; h_agent_view_url: string | null; attempt: number;
          dry_run: boolean; confirmation_number: string | null; failure_reason: string | null;
          submitted_at: string | null; resolved_at: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id: string; receipt_id: string; line_item_id: string; brand_id?: string | null;
          issue_type: IssueType; issue_description?: string | null; issue_photo_path?: string | null;
          status?: ClaimStatus; inbound_alias?: string | null; complaint_text?: string | null;
          h_session_id?: string | null; h_agent_view_url?: string | null; attempt?: number;
          dry_run?: boolean; confirmation_number?: string | null; failure_reason?: string | null;
          submitted_at?: string | null; resolved_at?: string | null; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["claims"]["Insert"]>;
        Relationships: [];
      };
      claim_events: {
        Row: {
          id: string; claim_id: string; type: string; from_status: ClaimStatus | null;
          to_status: ClaimStatus | null; payload: Json | null; created_at: string;
        };
        Insert: {
          id?: string; claim_id: string; type: string; from_status?: ClaimStatus | null;
          to_status?: ClaimStatus | null; payload?: Json | null; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["claim_events"]["Insert"]>;
        Relationships: [];
      };
      claim_emails: {
        Row: {
          id: string; claim_id: string | null; provider_message_id: string; from_address: string;
          to_address: string; subject: string | null; body_text: string | null; received_at: string;
          classification: EmailClassification | null; classification_reason: string | null; created_at: string;
        };
        Insert: {
          id?: string; claim_id?: string | null; provider_message_id: string; from_address: string;
          to_address: string; subject?: string | null; body_text?: string | null; received_at: string;
          classification?: EmailClassification | null; classification_reason?: string | null; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["claim_emails"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      receipt_status: ReceiptStatus;
      issue_type: IssueType;
      claim_status: ClaimStatus;
      brand_source: BrandSource;
      email_classification: EmailClassification;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
