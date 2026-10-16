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
      availability: {
        Row: {
          match_id: string
          note: string | null
          player_id: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at: string
        }
        Insert: {
          match_id: string
          note?: string | null
          player_id: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
        }
        Update: {
          match_id?: string
          note?: string | null
          player_id?: string
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_availability_summary"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "availability_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          label: string
          match_id: string
          sort: number
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          label: string
          match_id: string
          sort?: number
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          match_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_availability_summary"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "checklist_items_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_public: boolean
          location: string | null
          season_id: string | null
          starts_at: string
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          season_id?: string | null
          starts_at: string
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          season_id?: string | null
          starts_at?: string
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      line_results: {
        Row: {
          line_number: number
          line_type: Database["public"]["Enums"]["line_type"]
          match_id: string
          score: string | null
          won: boolean
        }
        Insert: {
          line_number: number
          line_type: Database["public"]["Enums"]["line_type"]
          match_id: string
          score?: string | null
          won: boolean
        }
        Update: {
          line_number?: number
          line_type?: Database["public"]["Enums"]["line_type"]
          match_id?: string
          score?: string | null
          won?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "line_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_availability_summary"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "line_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_slots: {
        Row: {
          court_label: string | null
          created_at: string
          id: string
          line_number: number
          line_type: Database["public"]["Enums"]["line_type"]
          match_id: string
          player_id: string
          rsvp: Database["public"]["Enums"]["rsvp_status"]
          seat: number
          updated_at: string
        }
        Insert: {
          court_label?: string | null
          created_at?: string
          id?: string
          line_number: number
          line_type: Database["public"]["Enums"]["line_type"]
          match_id: string
          player_id: string
          rsvp?: Database["public"]["Enums"]["rsvp_status"]
          seat?: number
          updated_at?: string
        }
        Update: {
          court_label?: string | null
          created_at?: string
          id?: string
          line_number?: number
          line_type?: Database["public"]["Enums"]["line_type"]
          match_id?: string
          player_id?: string
          rsvp?: Database["public"]["Enums"]["rsvp_status"]
          seat?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_slots_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_availability_summary"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "lineup_slots_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_slots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          captain_notes: string | null
          created_at: string
          home_away: Database["public"]["Enums"]["home_away"]
          id: string
          location_address: string | null
          location_name: string | null
          opponent: string
          opponent_points: number | null
          season_id: string
          starts_at: string
          status: Database["public"]["Enums"]["match_status"]
          team_points: number | null
          updated_at: string
        }
        Insert: {
          captain_notes?: string | null
          created_at?: string
          home_away: Database["public"]["Enums"]["home_away"]
          id?: string
          location_address?: string | null
          location_name?: string | null
          opponent: string
          opponent_points?: number | null
          season_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["match_status"]
          team_points?: number | null
          updated_at?: string
        }
        Update: {
          captain_notes?: string | null
          created_at?: string
          home_away?: Database["public"]["Enums"]["home_away"]
          id?: string
          location_address?: string | null
          location_name?: string | null
          opponent?: string
          opponent_points?: number | null
          season_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["match_status"]
          team_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      message_recipients: {
        Row: {
          email: string
          message_id: string
          player_id: string | null
        }
        Insert: {
          email: string
          message_id: string
          player_id?: string | null
        }
        Update: {
          email?: string
          message_id?: string
          player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audience: Database["public"]["Enums"]["message_audience"]
          body: string
          error: string | null
          id: string
          match_id: string | null
          provider: string | null
          recipient_count: number
          sent_at: string
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          audience: Database["public"]["Enums"]["message_audience"]
          body: string
          error?: string | null
          id?: string
          match_id?: string | null
          provider?: string | null
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["message_audience"]
          body?: string
          error?: string | null
          id?: string
          match_id?: string | null
          provider?: string | null
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_availability_summary"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string
          id: string
          is_public: boolean
          published_at: string
          title: string
          type: Database["public"]["Enums"]["news_type"]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          published_at?: string
          title: string
          type: Database["public"]["Enums"]["news_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          published_at?: string
          title?: string
          type?: Database["public"]["Enums"]["news_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          joined_on: string | null
          ntrp_rating: number | null
          phone: string | null
          position_pref: Database["public"]["Enums"]["position_pref"]
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          user_id: string | null
          usta_number: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          joined_on?: string | null
          ntrp_rating?: number | null
          phone?: string | null
          position_pref?: Database["public"]["Enums"]["position_pref"]
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string | null
          usta_number?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          joined_on?: string | null
          ntrp_rating?: number | null
          phone?: string | null
          position_pref?: Database["public"]["Enums"]["position_pref"]
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string | null
          usta_number?: string | null
        }
        Relationships: []
      }
      registrations: {
        Row: {
          availability_slots: string[]
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          ntrp_rating: number | null
          phone: string | null
          player_id: string | null
          position_pref: Database["public"]["Enums"]["position_pref"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          usta_number: string | null
        }
        Insert: {
          availability_slots?: string[]
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          ntrp_rating?: number | null
          phone?: string | null
          player_id?: string | null
          position_pref?: Database["public"]["Enums"]["position_pref"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          usta_number?: string | null
        }
        Update: {
          availability_slots?: string[]
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          ntrp_rating?: number | null
          phone?: string | null
          player_id?: string | null
          position_pref?: Database["public"]["Enums"]["position_pref"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          usta_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvp_tokens: {
        Row: {
          expires_at: string
          match_id: string
          player_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          expires_at?: string
          match_id: string
          player_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          expires_at?: string
          match_id?: string
          player_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rsvp_tokens_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_availability_summary"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "rsvp_tokens_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvp_tokens_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          age_group: string | null
          created_at: string
          division: string | null
          doubles_lines: number
          ends_on: string | null
          id: string
          is_current: boolean
          league: string | null
          max_roster: number
          min_ntrp: number | null
          name: string
          ntrp_level: number
          playoff_min_matches: number
          singles_lines: number
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          division?: string | null
          doubles_lines?: number
          ends_on?: string | null
          id?: string
          is_current?: boolean
          league?: string | null
          max_roster?: number
          min_ntrp?: number | null
          name: string
          ntrp_level: number
          playoff_min_matches?: number
          singles_lines?: number
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          division?: string | null
          doubles_lines?: number
          ends_on?: string | null
          id?: string
          is_current?: boolean
          league?: string | null
          max_roster?: number
          min_ntrp?: number | null
          name?: string
          ntrp_level?: number
          playoff_min_matches?: number
          singles_lines?: number
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      match_availability_summary: {
        Row: {
          available: number | null
          match_id: string | null
          maybe: number | null
          no_response: number | null
          players_needed: number | null
          starts_at: string | null
          unavailable: number | null
        }
        Relationships: []
      }
      player_records: {
        Row: {
          losses: number | null
          player_id: string | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lineup_slots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_player_id: { Args: never; Returns: string }
      eligible_players: {
        Args: { p_match_id: string }
        Returns: {
          availability: Database["public"]["Enums"]["availability_status"]
          full_name: string
          matches_played: number
          ntrp_rating: number
          player_id: string
          playoff_eligible: boolean
          rating_ok: boolean
        }[]
      }
      import_players: {
        Args: { p_rows: Json }
        Returns: {
          email: string
          outcome: string
        }[]
      }
      is_captain: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
      public_schedule: {
        Args: { p_from?: string }
        Returns: {
          home_away: Database["public"]["Enums"]["home_away"]
          kind: string
          location_name: string
          starts_at: string
          status: Database["public"]["Enums"]["match_status"]
          title: string
        }[]
      }
      public_team_summary: { Args: never; Returns: Json }
      set_my_availability: {
        Args: {
          p_match_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["availability_status"]
        }
        Returns: undefined
      }
      set_my_rsvp: {
        Args: {
          p_match_id: string
          p_rsvp: Database["public"]["Enums"]["rsvp_status"]
        }
        Returns: undefined
      }
      update_my_profile: {
        Args: {
          p_phone: string
          p_position_pref: Database["public"]["Enums"]["position_pref"]
        }
        Returns: undefined
      }
    }
    Enums: {
      availability_status: "available" | "maybe" | "unavailable"
      event_type:
        | "practice"
        | "social"
        | "usta_deadline"
        | "registration"
        | "other"
      home_away: "home" | "away"
      line_type: "singles" | "doubles"
      match_status: "scheduled" | "completed" | "cancelled"
      member_role: "captain" | "co_captain" | "player"
      message_audience: "team" | "match" | "custom"
      news_type: "announcement" | "result" | "event"
      position_pref: "singles" | "doubles" | "both"
      registration_status: "pending" | "invited" | "declined" | "withdrawn"
      rsvp_status: "pending" | "confirmed" | "declined"
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
      availability_status: ["available", "maybe", "unavailable"],
      event_type: [
        "practice",
        "social",
        "usta_deadline",
        "registration",
        "other",
      ],
      home_away: ["home", "away"],
      line_type: ["singles", "doubles"],
      match_status: ["scheduled", "completed", "cancelled"],
      member_role: ["captain", "co_captain", "player"],
      message_audience: ["team", "match", "custom"],
      news_type: ["announcement", "result", "event"],
      position_pref: ["singles", "doubles", "both"],
      registration_status: ["pending", "invited", "declined", "withdrawn"],
      rsvp_status: ["pending", "confirmed", "declined"],
    },
  },
} as const
