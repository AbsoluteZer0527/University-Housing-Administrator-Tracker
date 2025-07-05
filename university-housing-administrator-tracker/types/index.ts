export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type AdminStatus =
  | "todo"
  | "not_contacted"
  | "sent"
  | "declined"
  | "follow_up"
  | "complete";

export interface Database {
  public: {
    Tables: {
      administrators: {
        Row: {
          id: string;
          name: string;
          role: string;
          email: string;
          phone: string | null;
          source_url: string | null;
          status: AdminStatus;
          university_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          role: string;
          email: string;
          phone?: string | null;
          source_url?: string | null;
          status?: AdminStatus;
          university_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          role?: string;
          email?: string;
          phone?: string | null;
          source_url?: string | null;
          status?: AdminStatus;
          university_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "administrators_university_id_fkey";
            columns: ["university_id"];
            referencedRelation: "universities";
            referencedColumns: ["id"];
          }
        ];
      };

      universities: {
        Row: {
          id: string;
          name: string;
          website: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          website?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          website?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      admin_status: AdminStatus;
    };
  };
}
