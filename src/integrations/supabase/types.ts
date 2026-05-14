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
      ads: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          html: string | null
          id: string
          image_url: string | null
          link_url: string | null
          name: string
          placement: string
          starts_at: string | null
          vertical_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          html?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          name: string
          placement: string
          starts_at?: string | null
          vertical_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          html?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          name?: string
          placement?: string
          starts_at?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      article_tags: {
        Row: {
          article_id: string
          tag_id: string
        }
        Insert: {
          article_id: string
          tag_id: string
        }
        Update: {
          article_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_tags_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      article_versions: {
        Row: {
          article_id: string
          created_at: string
          edited_by: string | null
          id: string
          snapshot: Json
        }
        Insert: {
          article_id: string
          created_at?: string
          edited_by?: string | null
          id?: string
          snapshot: Json
        }
        Update: {
          article_id?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          author_id: string | null
          content: Json
          content_html: string | null
          cover_image_alt: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          external_source_name: string | null
          external_url: string | null
          gallery: Json
          id: string
          is_breaking: boolean
          is_featured: boolean
          is_sponsored: boolean
          is_week_main: boolean
          published_at: string | null
          reading_time: number | null
          scheduled_at: string | null
          section_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          source_type: Database["public"]["Enums"]["source_type"]
          status: Database["public"]["Enums"]["article_status"]
          subtitle: string | null
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
          vertical_id: string
          video_url: string | null
          views_count: number
        }
        Insert: {
          author_id?: string | null
          content?: Json
          content_html?: string | null
          cover_image_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          external_source_name?: string | null
          external_url?: string | null
          gallery?: Json
          id?: string
          is_breaking?: boolean
          is_featured?: boolean
          is_sponsored?: boolean
          is_week_main?: boolean
          published_at?: string | null
          reading_time?: number | null
          scheduled_at?: string | null
          section_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          source_type?: Database["public"]["Enums"]["source_type"]
          status?: Database["public"]["Enums"]["article_status"]
          subtitle?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          vertical_id: string
          video_url?: string | null
          views_count?: number
        }
        Update: {
          author_id?: string | null
          content?: Json
          content_html?: string | null
          cover_image_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          external_source_name?: string | null
          external_url?: string | null
          gallery?: Json
          id?: string
          is_breaking?: boolean
          is_featured?: boolean
          is_sponsored?: boolean
          is_week_main?: boolean
          published_at?: string | null
          reading_time?: number | null
          scheduled_at?: string | null
          section_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          source_type?: Database["public"]["Enums"]["source_type"]
          status?: Database["public"]["Enums"]["article_status"]
          subtitle?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          vertical_id?: string
          video_url?: string | null
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      authors: {
        Row: {
          active: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          slug: string
          twitter: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          slug: string
          twitter?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          slug?: string
          twitter?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      external_imports: {
        Row: {
          created_at: string
          description: string | null
          external_url: string
          id: string
          image_url: string | null
          promoted_article_id: string | null
          published_at: string | null
          source_id: string | null
          status: string
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_url: string
          id?: string
          image_url?: string | null
          promoted_article_id?: string | null
          published_at?: string | null
          source_id?: string | null
          status?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          external_url?: string
          id?: string
          image_url?: string | null
          promoted_article_id?: string | null
          published_at?: string | null
          source_id?: string | null
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_imports_promoted_article_id_fkey"
            columns: ["promoted_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_imports_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "external_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      external_sources: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          id: string
          kind: string
          name: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          kind: string
          name: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      live_streams: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          embed_url: string | null
          ends_at: string | null
          id: string
          platform: Database["public"]["Enums"]["live_platform"]
          starts_at: string | null
          status: Database["public"]["Enums"]["live_status"]
          stream_url: string
          title: string
          updated_at: string
          updated_by: string | null
          vertical_id: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          embed_url?: string | null
          ends_at?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["live_platform"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["live_status"]
          stream_url: string
          title: string
          updated_at?: string
          updated_by?: string | null
          vertical_id?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          embed_url?: string | null
          ends_at?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["live_platform"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["live_status"]
          stream_url?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string
          height: number | null
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string | null
          url: string
          vertical_id: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          url: string
          vertical_id?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          url?: string
          vertical_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          show_in_home: boolean
          show_in_menu: boolean
          slug: string
          sort_order: number
          updated_at: string
          vertical_id: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          show_in_home?: boolean
          show_in_menu?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
          vertical_id: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          show_in_home?: boolean
          show_in_menu?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
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
      verticals: {
        Row: {
          accent_color: string
          active: boolean
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          mission: string | null
          name: string
          primary_color: string
          seo_description: string | null
          seo_title: string | null
          slug: Database["public"]["Enums"]["vertical_slug"]
          sort_order: number
          tagline: string | null
          updated_at: string
          vision: string | null
        }
        Insert: {
          accent_color?: string
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          mission?: string | null
          name: string
          primary_color?: string
          seo_description?: string | null
          seo_title?: string | null
          slug: Database["public"]["Enums"]["vertical_slug"]
          sort_order?: number
          tagline?: string | null
          updated_at?: string
          vision?: string | null
        }
        Update: {
          accent_color?: string
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          mission?: string | null
          name?: string
          primary_color?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: Database["public"]["Enums"]["vertical_slug"]
          sort_order?: number
          tagline?: string | null
          updated_at?: string
          vision?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_vertical: {
        Args: {
          _user_id: string
          _vertical: Database["public"]["Enums"]["vertical_slug"]
        }
        Returns: boolean
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "director_editorial"
        | "editor_media"
        | "editor_tech"
        | "redactor"
        | "revisor"
        | "multimedia"
        | "analista"
        | "readonly"
      article_status:
        | "draft"
        | "review"
        | "scheduled"
        | "published"
        | "archived"
      live_platform: "youtube" | "facebook" | "instagram" | "other"
      live_status: "scheduled" | "active" | "paused" | "finished"
      source_type: "original" | "external" | "sponsored"
      vertical_slug: "news" | "media" | "tech"
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
      app_role: [
        "super_admin",
        "director_editorial",
        "editor_media",
        "editor_tech",
        "redactor",
        "revisor",
        "multimedia",
        "analista",
        "readonly",
      ],
      article_status: ["draft", "review", "scheduled", "published", "archived"],
      live_platform: ["youtube", "facebook", "instagram", "other"],
      live_status: ["scheduled", "active", "paused", "finished"],
      source_type: ["original", "external", "sponsored"],
      vertical_slug: ["news", "media", "tech"],
    },
  },
} as const
