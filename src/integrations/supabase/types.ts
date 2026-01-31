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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      advertiser_reviews: {
        Row: {
          advertiser_id: string
          created_at: string
          deal_id: string
          id: string
          rating: number
          reviewer_id: string
        }
        Insert: {
          advertiser_id: string
          created_at?: string
          deal_id: string
          id?: string
          rating: number
          reviewer_id: string
        }
        Update: {
          advertiser_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          rating?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertiser_reviews_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertiser_reviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertiser_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          button_text: string | null
          button_url: string | null
          campaign_type: string
          created_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          media_urls: Json | null
          name: string
          owner_id: string
          text: string
          updated_at: string | null
        }
        Insert: {
          button_text?: string | null
          button_url?: string | null
          campaign_type?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          media_urls?: Json | null
          name: string
          owner_id: string
          text: string
          updated_at?: string | null
        }
        Update: {
          button_text?: string | null
          button_url?: string | null
          campaign_type?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          media_urls?: Json | null
          name?: string
          owner_id?: string
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_admins: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          last_verified_at: string | null
          permissions: Json | null
          role: Database["public"]["Enums"]["channel_role"]
          telegram_member_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          last_verified_at?: string | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["channel_role"]
          telegram_member_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          last_verified_at?: string | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["channel_role"]
          telegram_member_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_admins_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          accepted_campaign_types: string | null
          auto_delete_posts: boolean | null
          avatar_url: string | null
          avg_views: number | null
          bot_is_admin: boolean | null
          category: string
          created_at: string | null
          description: string | null
          engagement: number | null
          growth_rate: number | null
          id: string
          is_active: boolean | null
          is_premium: boolean | null
          language_stats: Json | null
          min_hours_before_post: number | null
          notifications_enabled: number | null
          owner_id: string
          premium_percentage: number | null
          price_1_24: number | null
          price_2_48: number | null
          price_post: number | null
          rating: number | null
          recent_posts_stats: Json | null
          reviews_count: number | null
          shares_per_post: number | null
          stats_updated_at: string | null
          subscribers_count: number | null
          successful_ads: number | null
          telegram_chat_id: number | null
          title: string | null
          top_hours: Json | null
          updated_at: string | null
          username: string
          verified: boolean | null
          views_per_post: number | null
        }
        Insert: {
          accepted_campaign_types?: string | null
          auto_delete_posts?: boolean | null
          avatar_url?: string | null
          avg_views?: number | null
          bot_is_admin?: boolean | null
          category: string
          created_at?: string | null
          description?: string | null
          engagement?: number | null
          growth_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          language_stats?: Json | null
          min_hours_before_post?: number | null
          notifications_enabled?: number | null
          owner_id: string
          premium_percentage?: number | null
          price_1_24?: number | null
          price_2_48?: number | null
          price_post?: number | null
          rating?: number | null
          recent_posts_stats?: Json | null
          reviews_count?: number | null
          shares_per_post?: number | null
          stats_updated_at?: string | null
          subscribers_count?: number | null
          successful_ads?: number | null
          telegram_chat_id?: number | null
          title?: string | null
          top_hours?: Json | null
          updated_at?: string | null
          username: string
          verified?: boolean | null
          views_per_post?: number | null
        }
        Update: {
          accepted_campaign_types?: string | null
          auto_delete_posts?: boolean | null
          avatar_url?: string | null
          avg_views?: number | null
          bot_is_admin?: boolean | null
          category?: string
          created_at?: string | null
          description?: string | null
          engagement?: number | null
          growth_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          language_stats?: Json | null
          min_hours_before_post?: number | null
          notifications_enabled?: number | null
          owner_id?: string
          premium_percentage?: number | null
          price_1_24?: number | null
          price_2_48?: number | null
          price_post?: number | null
          rating?: number | null
          recent_posts_stats?: Json | null
          reviews_count?: number | null
          shares_per_post?: number | null
          stats_updated_at?: string | null
          subscribers_count?: number | null
          successful_ads?: number | null
          telegram_chat_id?: number | null
          title?: string | null
          top_hours?: Json | null
          updated_at?: string | null
          username?: string
          verified?: boolean | null
          views_per_post?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          advertiser_id: string
          author_draft: string | null
          author_draft_entities: Json | null
          author_draft_media: Json | null
          author_draft_media_urls: Json | null
          author_drafts: Json | null
          campaign_id: string | null
          cancellation_reason: string | null
          channel_id: string
          completed_at: string | null
          created_at: string | null
          duration_hours: number
          escrow_address: string | null
          escrow_balance: number | null
          escrow_mnemonic_encrypted: string | null
          expires_at: string | null
          id: string
          is_draft_approved: boolean | null
          last_integrity_check_at: string | null
          payment_verified_at: string | null
          posted_at: string | null
          posts_count: number
          price_per_post: number
          revision_count: number | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["deal_status"]
          telegram_message_id: number | null
          telegram_message_ids: Json | null
          total_price: number
          updated_at: string | null
        }
        Insert: {
          advertiser_id: string
          author_draft?: string | null
          author_draft_entities?: Json | null
          author_draft_media?: Json | null
          author_draft_media_urls?: Json | null
          author_drafts?: Json | null
          campaign_id?: string | null
          cancellation_reason?: string | null
          channel_id: string
          completed_at?: string | null
          created_at?: string | null
          duration_hours?: number
          escrow_address?: string | null
          escrow_balance?: number | null
          escrow_mnemonic_encrypted?: string | null
          expires_at?: string | null
          id?: string
          is_draft_approved?: boolean | null
          last_integrity_check_at?: string | null
          payment_verified_at?: string | null
          posted_at?: string | null
          posts_count?: number
          price_per_post: number
          revision_count?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          telegram_message_id?: number | null
          telegram_message_ids?: Json | null
          total_price: number
          updated_at?: string | null
        }
        Update: {
          advertiser_id?: string
          author_draft?: string | null
          author_draft_entities?: Json | null
          author_draft_media?: Json | null
          author_draft_media_urls?: Json | null
          author_drafts?: Json | null
          campaign_id?: string | null
          cancellation_reason?: string | null
          channel_id?: string
          completed_at?: string | null
          created_at?: string | null
          duration_hours?: number
          escrow_address?: string | null
          escrow_balance?: number | null
          escrow_mnemonic_encrypted?: string | null
          expires_at?: string | null
          id?: string
          is_draft_approved?: boolean | null
          last_integrity_check_at?: string | null
          payment_verified_at?: string | null
          posted_at?: string | null
          posts_count?: number
          price_per_post?: number
          revision_count?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          telegram_message_id?: number | null
          telegram_message_ids?: Json | null
          total_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_channel_verifications: {
        Row: {
          added_by_telegram_id: number
          bot_status: string
          chat_title: string | null
          chat_username: string | null
          detected_at: string
          id: string
          processed: boolean | null
          telegram_chat_id: number
        }
        Insert: {
          added_by_telegram_id: number
          bot_status?: string
          chat_title?: string | null
          chat_username?: string | null
          detected_at?: string
          id?: string
          processed?: boolean | null
          telegram_chat_id: number
        }
        Update: {
          added_by_telegram_id?: number
          bot_status?: string
          chat_title?: string | null
          chat_username?: string | null
          detected_at?: string
          id?: string
          processed?: boolean | null
          telegram_chat_id?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          channel_id: string
          comment: string | null
          created_at: string | null
          deal_id: string
          id: string
          rating: number
          reviewer_id: string
        }
        Insert: {
          channel_id: string
          comment?: string | null
          created_at?: string | null
          deal_id: string
          id?: string
          rating: number
          reviewer_id: string
        }
        Update: {
          channel_id?: string
          comment?: string | null
          created_at?: string | null
          deal_id?: string
          id?: string
          rating?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_user_states: {
        Row: {
          created_at: string | null
          deal_id: string | null
          draft_index: number | null
          expires_at: string | null
          id: string
          state_type: string
          telegram_user_id: number
        }
        Insert: {
          created_at?: string | null
          deal_id?: string | null
          draft_index?: number | null
          expires_at?: string | null
          id?: string
          state_type: string
          telegram_user_id: number
        }
        Update: {
          created_at?: string | null
          deal_id?: string | null
          draft_index?: number | null
          expires_at?: string | null
          id?: string
          state_type?: string
          telegram_user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_user_states_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          first_name: string
          id: string
          is_premium: boolean | null
          language_code: string | null
          last_name: string | null
          photo_url: string | null
          telegram_id: number | null
          updated_at: string | null
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          first_name: string
          id?: string
          is_premium?: boolean | null
          language_code?: string | null
          last_name?: string | null
          photo_url?: string | null
          telegram_id?: number | null
          updated_at?: string | null
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          first_name?: string
          id?: string
          is_premium?: boolean | null
          language_code?: string | null
          last_name?: string | null
          photo_url?: string | null
          telegram_id?: number | null
          updated_at?: string | null
          username?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      manage_cron_jobs: { Args: { action: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      channel_role: "owner" | "manager"
      deal_status:
        | "pending"
        | "escrow"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed"
        | "expired"
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
      app_role: ["admin", "moderator", "user"],
      channel_role: ["owner", "manager"],
      deal_status: [
        "pending",
        "escrow",
        "in_progress",
        "completed",
        "cancelled",
        "disputed",
        "expired",
      ],
    },
  },
} as const
