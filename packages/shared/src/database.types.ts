export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_config: {
        Row: {
          description: string;
          key: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          description?: string;
          key: string;
          value: NonNullable<Json>;
        };
        Update: {
          description?: string;
          key?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      appeals: {
        Row: {
          action_id: number;
          author_id: string;
          created_at: string;
          decided_at: string | null;
          decision_note: string;
          id: string;
          reason: string;
          reviewer_id: string | null;
          status: Database['public']['Enums']['appeal_status'];
        };
        ComputedFields: never;
        Insert: {
          action_id: number;
          author_id: string;
          created_at?: string;
          decided_at?: string | null;
          decision_note?: string;
          id?: string;
          reason: string;
          reviewer_id?: string | null;
          status?: Database['public']['Enums']['appeal_status'];
        };
        Update: {
          action_id?: number;
          author_id?: string;
          created_at?: string;
          decided_at?: string | null;
          decision_note?: string;
          id?: string;
          reason?: string;
          reviewer_id?: string | null;
          status?: Database['public']['Enums']['appeal_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'appeals_action_id_fkey';
            columns: ['action_id'];
            isOneToOne: true;
            referencedRelation: 'moderation_actions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appeals_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appeals_reviewer_id_fkey';
            columns: ['reviewer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          video_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          video_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: false;
            referencedRelation: 'videos';
            referencedColumns: ['id'];
          },
        ];
      };
      media_jobs: {
        Row: {
          attempts: number;
          created_at: string;
          id: number;
          kind: Database['public']['Enums']['job_kind'];
          last_error: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          payload: NonNullable<Json>;
          phase: string;
          progress: number;
          run_after: string;
          status: Database['public']['Enums']['job_status'];
          updated_at: string;
          video_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: never;
          kind: Database['public']['Enums']['job_kind'];
          last_error?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          payload?: NonNullable<Json>;
          phase?: string;
          progress?: number;
          run_after?: string;
          status?: Database['public']['Enums']['job_status'];
          updated_at?: string;
          video_id?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: never;
          kind?: Database['public']['Enums']['job_kind'];
          last_error?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          payload?: NonNullable<Json>;
          phase?: string;
          progress?: number;
          run_after?: string;
          status?: Database['public']['Enums']['job_status'];
          updated_at?: string;
          video_id?: string | null;
        };
        Relationships: [];
      };
      merchant_profiles: {
        Row: {
          business_name: string;
          created_at: string;
          daily_quota: number | null;
          description: string;
          reviewed_by: string | null;
          status: Database['public']['Enums']['merchant_status'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          business_name: string;
          created_at?: string;
          daily_quota?: number | null;
          description?: string;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['merchant_status'];
          user_id: string;
        };
        Update: {
          business_name?: string;
          created_at?: string;
          daily_quota?: number | null;
          description?: string;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['merchant_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'merchant_profiles_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'merchant_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      moderation_actions: {
        Row: {
          actor_id: string | null;
          created_at: string;
          h3_cell: string | null;
          id: number;
          kind: Database['public']['Enums']['moderation_kind'];
          note: string;
          reverts_action_id: number | null;
          target_user_id: string | null;
          video_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          h3_cell?: string | null;
          id?: never;
          kind: Database['public']['Enums']['moderation_kind'];
          note?: string;
          reverts_action_id?: number | null;
          target_user_id?: string | null;
          video_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          h3_cell?: string | null;
          id?: never;
          kind?: Database['public']['Enums']['moderation_kind'];
          note?: string;
          reverts_action_id?: number | null;
          target_user_id?: string | null;
          video_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_actions_reverts_action_id_fkey';
            columns: ['reverts_action_id'];
            isOneToOne: false;
            referencedRelation: 'moderation_actions';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          id: number;
          kind: string;
          payload: NonNullable<Json>;
          processed_at: string | null;
          user_id: string | null;
          video_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: never;
          kind: string;
          payload?: NonNullable<Json>;
          processed_at?: string | null;
          user_id?: string | null;
          video_id?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: never;
          kind?: string;
          payload?: NonNullable<Json>;
          processed_at?: string | null;
          user_id?: string | null;
          video_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_outbox_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_color: string;
          avatar_path: string | null;
          banned_at: string | null;
          bio: string;
          created_at: string;
          cover_path: string | null;
          id: string;
          reputation: number;
          role: Database['public']['Enums']['user_role'];
          username: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_color?: string;
          avatar_path?: string | null;
          banned_at?: string | null;
          bio?: string;
          created_at?: string;
          cover_path?: string | null;
          id: string;
          reputation?: number;
          role?: Database['public']['Enums']['user_role'];
          username?: string | null;
        };
        Update: {
          avatar_color?: string;
          avatar_path?: string | null;
          banned_at?: string | null;
          bio?: string;
          created_at?: string;
          cover_path?: string | null;
          id?: string;
          reputation?: number;
          role?: Database['public']['Enums']['user_role'];
          username?: string | null;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          last_notified_at: string | null;
          p256dh: string;
          radius_m: number;
          user_id: string;
          zone_cell: string;
          zone_center: unknown;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_notified_at?: string | null;
          p256dh: string;
          radius_m: number;
          user_id: string;
          zone_cell: string;
          zone_center: unknown;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_notified_at?: string | null;
          p256dh?: string;
          radius_m?: number;
          user_id?: string;
          zone_cell?: string;
          zone_center?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      reactions: {
        Row: {
          created_at: string;
          user_id: string;
          video_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
          video_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reactions_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: false;
            referencedRelation: 'videos';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string;
          id: string;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
          resolved_at: string | null;
          video_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string;
          id?: string;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
          resolved_at?: string | null;
          video_id: string;
        };
        Update: {
          created_at?: string;
          details?: string;
          id?: string;
          reason?: Database['public']['Enums']['report_reason'];
          reporter_id?: string;
          resolved_at?: string | null;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_video_id_fkey';
            columns: ['video_id'];
            isOneToOne: false;
            referencedRelation: 'videos';
            referencedColumns: ['id'];
          },
        ];
      };
      user_settings: {
        Row: {
          default_radius: number;
          locale: string;
          notify_alerts: boolean;
          onboarded_at: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          default_radius?: number;
          locale?: string;
          notify_alerts?: boolean;
          onboarded_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          default_radius?: number;
          locale?: string;
          notify_alerts?: boolean;
          onboarded_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      videos: {
        Row: {
          accuracy_m: number;
          author_id: string;
          caption: string;
          category: Database['public']['Enums']['video_category'];
          comment_count: number;
          created_at: string;
          duration_ms: number;
          expires_at: string;
          h3_cell: string;
          hidden_reason: string | null;
          id: string;
          is_merchant: boolean;
          location: unknown;
          mime_type: string;
          poster_path: string | null;
          public_location: unknown;
          published_at: string | null;
          raw_path: string | null;
          realtime_cell: string;
          report_count: number;
          status: Database['public']['Enums']['video_status'];
          useful_count: number;
          video_path: string | null;
        };
        ComputedFields: never;
        Insert: {
          accuracy_m: number;
          author_id: string;
          caption?: string;
          category: Database['public']['Enums']['video_category'];
          comment_count?: number;
          created_at?: string;
          duration_ms: number;
          expires_at: string;
          h3_cell: string;
          hidden_reason?: string | null;
          id?: string;
          is_merchant?: boolean;
          location: unknown;
          mime_type: string;
          poster_path?: string | null;
          public_location: unknown;
          published_at?: string | null;
          raw_path?: string | null;
          realtime_cell: string;
          report_count?: number;
          status?: Database['public']['Enums']['video_status'];
          useful_count?: number;
          video_path?: string | null;
        };
        Update: {
          accuracy_m?: number;
          author_id?: string;
          caption?: string;
          category?: Database['public']['Enums']['video_category'];
          comment_count?: number;
          created_at?: string;
          duration_ms?: number;
          expires_at?: string;
          h3_cell?: string;
          hidden_reason?: string | null;
          id?: string;
          is_merchant?: boolean;
          location?: unknown;
          mime_type?: string;
          poster_path?: string | null;
          public_location?: unknown;
          published_at?: string | null;
          raw_path?: string | null;
          realtime_cell?: string;
          report_count?: number;
          status?: Database['public']['Enums']['video_status'];
          useful_count?: number;
          video_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'videos_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      zone_moderators: {
        Row: {
          created_at: string;
          h3_cell: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          h3_cell: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          h3_cell?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'zone_moderators_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_set_media_settings: {
        Args: { p_admin: string; p_settings: Json };
        Returns: undefined;
      };
      admin_revert_action: {
        Args: { p_action: number; p_admin: string; p_note: string };
        Returns: number;
      };
      admin_review_merchant: {
        Args: { p_admin: string; p_approve: boolean; p_user: string };
        Returns: undefined;
      };
      admin_set_ban: {
        Args: { p_admin: string; p_banned: boolean; p_note: string; p_user: string };
        Returns: undefined;
      };
      admin_stats: { Args: { p_admin: string }; Returns: Json };
      appeals_queue: {
        Args: { p_reviewer: string };
        Returns: {
          action_kind: Database['public']['Enums']['moderation_kind'];
          action_note: string;
          appeal_id: string;
          caption: string;
          created_at: string;
          h3_cell: string;
          poster_path: string;
          reason: string;
          video_id: string;
          video_path: string;
        }[];
      };
      apply_report_threshold: { Args: { p_video: string }; Returns: boolean };
      become_zone_moderator: { Args: { p_cell: string; p_user: string }; Returns: undefined };
      bucket_distance: { Args: { p_meters: number }; Returns: number };
      can_upload_raw: { Args: { p_name: string }; Returns: boolean };
      check_rate_limit: { Args: { p_key: string; p_rule: string }; Returns: undefined };
      claim_alert_recipients: {
        Args: { p_videos: string[] };
        Returns: {
          auth: string;
          captions: string[];
          endpoint: string;
          p256dh: string;
          subscription_id: string;
          user_id: string;
          video_ids: string[];
        }[];
      };
      claim_media_job: {
        Args: { p_worker: string };
        Returns: {
          attempts: number;
          created_at: string;
          id: number;
          kind: Database['public']['Enums']['job_kind'];
          last_error: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          payload: NonNullable<Json>;
          run_after: string;
          status: Database['public']['Enums']['job_status'];
          updated_at: string;
          video_id: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'media_jobs';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_outbox: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          created_at: string;
          id: number;
          kind: string;
          payload: NonNullable<Json>;
          processed_at: string | null;
          user_id: string | null;
          video_id: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'notification_outbox';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      complete_job: { Args: { p_job: number }; Returns: undefined };
      complete_process_job: {
        Args: { p_job: number; p_poster_path: string; p_video_path: string };
        Returns: undefined;
      };
      config_int: { Args: { p_key: string }; Returns: number };
      create_video: {
        Args: {
          p_accuracy: number;
          p_author: string;
          p_caption: string;
          p_category: Database['public']['Enums']['video_category'];
          p_duration_ms: number;
          p_expires_at: string;
          p_h3_cell: string;
          p_lat: number;
          p_lng: number;
          p_mime: string;
          p_realtime_cell: string;
        };
        Returns: string;
      };
      enqueue_processing: {
        Args: { p_author: string; p_raw_path: string; p_video: string };
        Returns: number;
      };
      expire_videos: { Args: Record<PropertyKey, never>; Returns: number };
      export_my_data: { Args: { p_user: string }; Returns: Json };
      fail_media_job: {
        Args: { p_error: string; p_job: number };
        Returns: Database['public']['Enums']['job_status'];
      };
      get_public_video: {
        Args: { p_id: string };
        Returns: {
          author_color: string;
          author_id: string;
          author_username: string;
          caption: string;
          category: Database['public']['Enums']['video_category'];
          comment_count: number;
          expires_at: string;
          id: string;
          is_merchant: boolean;
          public_lat: number;
          public_lng: number;
          published_at: string;
          useful_count: number;
        }[];
      };
      is_admin: { Args: { p_uid?: string }; Returns: boolean };
      is_banned: { Args: { p_uid?: string }; Returns: boolean };
      is_zone_moderator: { Args: { p_cell: string; p_uid: string }; Returns: boolean };
      map_videos: {
        Args: {
          p_category?: Database['public']['Enums']['video_category'];
          p_lat: number;
          p_lng: number;
          p_radius_m: number;
        };
        Returns: {
          caption: string;
          category: Database['public']['Enums']['video_category'];
          id: string;
          public_lat: number;
          public_lng: number;
        }[];
      };
      moderate_video: {
        Args: {
          p_actor: string;
          p_kind: Database['public']['Enums']['moderation_kind'];
          p_note?: string;
          p_video: string;
        };
        Returns: number;
      };
      moderation_penalty: {
        Args: { p_kind: Database['public']['Enums']['moderation_kind'] };
        Returns: number;
      };
      moderation_queue: {
        Args: { p_actor: string; p_cell: string };
        Returns: {
          author_username: string;
          caption: string;
          category: Database['public']['Enums']['video_category'];
          created_at: string;
          hidden_reason: string;
          poster_path: string;
          reasons: Database['public']['Enums']['report_reason'][];
          report_count: number;
          status: Database['public']['Enums']['video_status'];
          video_id: string;
          video_path: string;
        }[];
      };
      moderator_eligible: { Args: { p_user: string }; Returns: boolean };
      nearby_videos: {
        Args: {
          p_category?: Database['public']['Enums']['video_category'];
          p_cursor_id?: string;
          p_cursor_score?: number;
          p_lat: number;
          p_limit?: number;
          p_lng: number;
          p_radius_m: number;
          p_ref_time?: string;
        };
        Returns: {
          author_color: string;
          author_id: string;
          author_is_merchant: boolean;
          author_username: string;
          caption: string;
          category: Database['public']['Enums']['video_category'];
          comment_count: number;
          distance_m: number;
          expires_at: string;
          id: string;
          is_merchant: boolean;
          public_lat: number;
          public_lng: number;
          published_at: string;
          score: number;
          useful_count: number;
        }[];
      };
      prepare_account_deletion: { Args: { p_user: string }; Returns: string[] };
      public_point: { Args: { p_id: string; p_loc: unknown }; Returns: unknown };
      resolve_appeal: {
        Args: { p_appeal: string; p_note?: string; p_reviewer: string; p_uphold: boolean };
        Returns: undefined;
      };
      user_push_targets: {
        Args: { p_user: string };
        Returns: {
          auth: string;
          endpoint: string;
          p256dh: string;
          subscription_id: string;
        }[];
      };
      withdraw_video: { Args: { p_user: string; p_video: string }; Returns: string[] };
    };
    Enums: {
      appeal_status: 'pending' | 'upheld' | 'rejected';
      job_kind: 'process' | 'purge';
      job_status: 'queued' | 'running' | 'done' | 'failed';
      merchant_status: 'pending' | 'approved' | 'rejected';
      moderation_kind:
        | 'validate'
        | 'hide'
        | 'remove'
        | 'warn'
        | 'auto_hide'
        | 'revert'
        | 'ban'
        | 'unban'
        | 'appeal_upheld'
        | 'appeal_rejected';
      report_reason:
        | 'recognizable_person'
        | 'address_or_plate'
        | 'dangerous'
        | 'harassment'
        | 'spam'
        | 'false_info'
        | 'other';
      user_role: 'user' | 'merchant' | 'admin';
      video_category: 'alert' | 'deal' | 'event' | 'help' | 'shop' | 'lost';
      video_status: 'processing' | 'active' | 'hidden' | 'removed' | 'expired' | 'rejected';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appeal_status: ['pending', 'upheld', 'rejected'],
      job_kind: ['process', 'purge'],
      job_status: ['queued', 'running', 'done', 'failed'],
      merchant_status: ['pending', 'approved', 'rejected'],
      moderation_kind: [
        'validate',
        'hide',
        'remove',
        'warn',
        'auto_hide',
        'revert',
        'ban',
        'unban',
        'appeal_upheld',
        'appeal_rejected',
      ],
      report_reason: [
        'recognizable_person',
        'address_or_plate',
        'dangerous',
        'harassment',
        'spam',
        'false_info',
        'other',
      ],
      user_role: ['user', 'merchant', 'admin'],
      video_category: ['alert', 'deal', 'event', 'help', 'shop', 'lost'],
      video_status: ['processing', 'active', 'hidden', 'removed', 'expired', 'rejected'],
    },
  },
} as const;
