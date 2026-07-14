import type { CaseStatus } from "../domain";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      suitcases: Table<{
        id: string; case_number: string; qr_public_id: string; name: string; description: string | null;
        status: CaseStatus; current_holder_name: string | null; current_holder_address: string | null;
        current_location_name: string; current_latitude: number | null; current_longitude: number | null;
        return_due_on: string | null; updated_at: string; archived_at: string | null;
      }>;
      case_items: Table<{
        id: string; suitcase_id: string; name: string; expected_quantity: number; current_quantity: number;
        note: string | null; sort_order: number;
      }>;
      case_events: Table<{
        id: string; suitcase_id: string; event_type: string; location_name: string | null; holder_name: string | null;
        note: string | null; occurred_at: string;
      }>;
      bookings: Table<{
        id: string; suitcase_id: string; customer_name: string; location_name: string | null; starts_on: string;
        ends_on: string; status: "requested" | "confirmed" | "cancelled" | "completed";
      }, {
        suitcase_id: string; customer_name: string; location_name?: string | null; starts_on: string; ends_on: string;
        status?: "requested" | "confirmed" | "cancelled" | "completed";
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      create_suitcase_with_items: {
        Args: { p_case_number: string; p_name: string; p_description: string | null; p_location: string; p_items: Json };
        Returns: string;
      };
      get_public_suitcase: { Args: { p_public_id: string }; Returns: Json };
      submit_public_checkout: {
        Args: { p_public_id: string; p_counts: Json; p_note?: string | null };
        Returns: string;
      };
      submit_public_takeover: {
        Args: {
          p_public_id: string; p_name: string; p_address: string; p_phone: string; p_location: string;
          p_counts: Json; p_note?: string | null;
        };
        Returns: string;
      };
      update_suitcase_with_items: {
        Args: { p_suitcase_id: string; p_name: string; p_description: string | null; p_status: CaseStatus; p_items: Json };
        Returns: string;
      };
      delete_suitcase_admin: { Args: { p_suitcase_id: string }; Returns: undefined };
      set_public_suitcase_coordinates: {
        Args: { p_public_id: string; p_latitude: number; p_longitude: number };
        Returns: undefined;
      };
    };
    Enums: { case_status: CaseStatus };
    CompositeTypes: Record<string, never>;
  };
};
