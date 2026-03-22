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
      actions: {
        Row: {
          company_id: string | null
          completion_date: string | null
          created_at: string
          decision_id: string | null
          description: string | null
          due_date: string | null
          id: string
          responsible_member_id: string | null
          solution_id: string | null
          status: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          completion_date?: string | null
          created_at?: string
          decision_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          responsible_member_id?: string | null
          solution_id?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          completion_date?: string | null
          created_at?: string
          decision_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          responsible_member_id?: string | null
          solution_id?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_responsible_member_id_fkey"
            columns: ["responsible_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_solution_id_fkey"
            columns: ["solution_id"]
            isOneToOne: false
            referencedRelation: "solutions"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_items: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          nature: Database["public"]["Enums"]["agenda_nature"]
          order_index: number
          presenter_member_id: string | null
          session_id: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          nature?: Database["public"]["Enums"]["agenda_nature"]
          order_index?: number
          presenter_member_id?: string | null
          session_id: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          nature?: Database["public"]["Enums"]["agenda_nature"]
          order_index?: number
          presenter_member_id?: string | null
          session_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_presenter_member_id_fkey"
            columns: ["presenter_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          requested_at: string
          requested_by: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          requested_at?: string
          requested_by: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          requested_at?: string
          requested_by?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          company_id: string | null
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          mentions: string[] | null
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          mentions?: string[] | null
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          mentions?: string[] | null
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          auto_renew: boolean | null
          billing_cycle: string | null
          couleur_principale: string | null
          created_at: string
          date_expiration: string | null
          id: string
          logo_url: string | null
          nom: string
          pays: string | null
          plan_abonnement: string | null
          plan_id: string | null
          secteur: string | null
          special_status: string | null
          statut: string | null
          subscription_end: string | null
          subscription_start: string | null
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean | null
          billing_cycle?: string | null
          couleur_principale?: string | null
          created_at?: string
          date_expiration?: string | null
          id?: string
          logo_url?: string | null
          nom: string
          pays?: string | null
          plan_abonnement?: string | null
          plan_id?: string | null
          secteur?: string | null
          special_status?: string | null
          statut?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean | null
          billing_cycle?: string | null
          couleur_principale?: string | null
          created_at?: string
          date_expiration?: string | null
          id?: string
          logo_url?: string | null
          nom?: string
          pays?: string | null
          plan_abonnement?: string | null
          plan_id?: string | null
          secteur?: string | null
          special_status?: string | null
          statut?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      conflict_of_interests: {
        Row: {
          company_id: string
          created_at: string
          declared_at: string
          description: string | null
          id: string
          member_id: string
          related_decisions: string[] | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          declared_at?: string
          description?: string | null
          id?: string
          member_id: string
          related_decisions?: string[] | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          declared_at?: string
          description?: string | null
          id?: string
          member_id?: string
          related_decisions?: string[] | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conflict_of_interests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflict_of_interests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          agenda_item_id: string | null
          company_id: string
          created_at: string
          date_effet: string | null
          id: string
          numero_decision: string | null
          responsable_execution: string | null
          session_id: string
          statut: string | null
          texte: string
          type_vote: string | null
          updated_at: string
          vote_abstention: number | null
          vote_contre: number | null
          vote_pour: number | null
        }
        Insert: {
          agenda_item_id?: string | null
          company_id?: string
          created_at?: string
          date_effet?: string | null
          id?: string
          numero_decision?: string | null
          responsable_execution?: string | null
          session_id: string
          statut?: string | null
          texte: string
          type_vote?: string | null
          updated_at?: string
          vote_abstention?: number | null
          vote_contre?: number | null
          vote_pour?: number | null
        }
        Update: {
          agenda_item_id?: string | null
          company_id?: string
          created_at?: string
          date_effet?: string | null
          id?: string
          numero_decision?: string | null
          responsable_execution?: string | null
          session_id?: string
          statut?: string | null
          texte?: string
          type_vote?: string | null
          updated_at?: string
          vote_abstention?: number | null
          vote_contre?: number | null
          vote_pour?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_responsable_execution_fkey"
            columns: ["responsable_execution"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agenda_item_id: string | null
          category: string
          company_id: string | null
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          session_id: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          agenda_item_id?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          session_id: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          agenda_item_id?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          session_id?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          billing_period_end: string | null
          billing_period_start: string | null
          company_id: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          metadata: Json | null
          paid_at: string | null
          pdf_url: string | null
          plan_id: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          company_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          metadata?: Json | null
          paid_at?: string | null
          pdf_url?: string | null
          plan_id?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          metadata?: Json | null
          paid_at?: string | null
          pdf_url?: string | null
          plan_id?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      meeting_ai_analysis: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          minute_id: string
          status: string
          suggested_actions: Json | null
          suggested_agenda: Json | null
          suggested_decisions: Json | null
          summary: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          minute_id: string
          status?: string
          suggested_actions?: Json | null
          suggested_agenda?: Json | null
          suggested_decisions?: Json | null
          summary?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          minute_id?: string
          status?: string
          suggested_actions?: Json | null
          suggested_agenda?: Json | null
          suggested_decisions?: Json | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_ai_analysis_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_ai_analysis_minute_id_fkey"
            columns: ["minute_id"]
            isOneToOne: true
            referencedRelation: "minutes"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_templates: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          extracted_content: string | null
          file_path: string
          id: string
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          extracted_content?: string | null
          file_path: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          extracted_content?: string | null
          file_path?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          audio_duration_seconds: number | null
          audio_file_path: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          generated_pv: string | null
          id: string
          meeting_date: string | null
          pv_status: string | null
          session_id: string | null
          title: string
          transcription: string | null
          updated_at: string | null
        }
        Insert: {
          audio_duration_seconds?: number | null
          audio_file_path?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          generated_pv?: string | null
          id?: string
          meeting_date?: string | null
          pv_status?: string | null
          session_id?: string | null
          title: string
          transcription?: string | null
          updated_at?: string | null
        }
        Update: {
          audio_duration_seconds?: number | null
          audio_file_path?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          generated_pv?: string | null
          id?: string
          meeting_date?: string | null
          pv_status?: string | null
          session_id?: string | null
          title?: string
          transcription?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          adresse: string | null
          bio: string | null
          company_id: string | null
          created_at: string
          date_naissance: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          linkedin_url: string | null
          mandate_end: string | null
          mandate_start: string | null
          nationalite: string | null
          organ_id: string
          organisation: string | null
          phone: string | null
          quality: Database["public"]["Enums"]["member_quality"]
          titre_poste: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adresse?: string | null
          bio?: string | null
          company_id?: string | null
          created_at?: string
          date_naissance?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          linkedin_url?: string | null
          mandate_end?: string | null
          mandate_start?: string | null
          nationalite?: string | null
          organ_id: string
          organisation?: string | null
          phone?: string | null
          quality?: Database["public"]["Enums"]["member_quality"]
          titre_poste?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adresse?: string | null
          bio?: string | null
          company_id?: string | null
          created_at?: string
          date_naissance?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          linkedin_url?: string | null
          mandate_end?: string | null
          mandate_start?: string | null
          nationalite?: string | null
          organ_id?: string
          organisation?: string | null
          phone?: string | null
          quality?: Database["public"]["Enums"]["member_quality"]
          titre_poste?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_organ_id_fkey"
            columns: ["organ_id"]
            isOneToOne: false
            referencedRelation: "organs"
            referencedColumns: ["id"]
          },
        ]
      }
      minute_versions: {
        Row: {
          company_id: string | null
          content: string | null
          created_at: string
          id: string
          minute_id: string
          modified_by: string | null
          summary: string | null
          version_number: number
        }
        Insert: {
          company_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          minute_id: string
          modified_by?: string | null
          summary?: string | null
          version_number?: number
        }
        Update: {
          company_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          minute_id?: string
          modified_by?: string | null
          summary?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "minute_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minute_versions_minute_id_fkey"
            columns: ["minute_id"]
            isOneToOne: false
            referencedRelation: "minutes"
            referencedColumns: ["id"]
          },
        ]
      }
      minutes: {
        Row: {
          company_id: string | null
          content: string | null
          created_at: string
          id: string
          pv_status: Database["public"]["Enums"]["pv_status"]
          session_id: string
          signed_at: string | null
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          company_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          pv_status?: Database["public"]["Enums"]["pv_status"]
          session_id: string
          signed_at?: string | null
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          company_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          pv_status?: Database["public"]["Enums"]["pv_status"]
          session_id?: string
          signed_at?: string | null
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "minutes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          email_sent: boolean
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_sent?: boolean
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_sent?: boolean
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_usage: {
        Row: {
          company_id: string
          created_at: string
          current_documents: number
          current_sessions: number
          current_storage_mb: number
          current_users: number
          id: string
          last_calculated_at: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_documents?: number
          current_sessions?: number
          current_storage_mb?: number
          current_users?: number
          id?: string
          last_calculated_at?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_documents?: number
          current_sessions?: number
          current_storage_mb?: number
          current_users?: number
          id?: string
          last_calculated_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      organs: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["organ_type"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["organ_type"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["organ_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          role_id: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role_id?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role_id?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
      session_attendees: {
        Row: {
          created_at: string
          id: string
          is_present: boolean | null
          member_id: string
          proxy_member_id: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_present?: boolean | null
          member_id: string
          proxy_member_id?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_present?: boolean | null
          member_id?: string
          proxy_member_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendees_proxy_member_id_fkey"
            columns: ["proxy_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendees_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_virtual: boolean
          location: string | null
          meeting_link: string | null
          numero_session: string | null
          organ_id: string
          session_date: string
          session_type: Database["public"]["Enums"]["session_type"]
          status: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_virtual?: boolean
          location?: string | null
          meeting_link?: string | null
          numero_session?: string | null
          organ_id: string
          session_date: string
          session_type?: Database["public"]["Enums"]["session_type"]
          status?: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_virtual?: boolean
          location?: string | null
          meeting_link?: string | null
          numero_session?: string | null
          organ_id?: string
          session_date?: string
          session_type?: Database["public"]["Enums"]["session_type"]
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_organ_id_fkey"
            columns: ["organ_id"]
            isOneToOne: false
            referencedRelation: "organs"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          company_id: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          signed_at: string
          signed_by: string
        }
        Insert: {
          company_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          signed_at?: string
          signed_by: string
        }
        Update: {
          company_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          signed_at?: string
          signed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      solutions: {
        Row: {
          agenda_item_id: string
          created_at: string
          description: string | null
          id: string
          status: Database["public"]["Enums"]["solution_status"]
          title: string
          vote_abstention: number | null
          vote_contre: number | null
          vote_pour: number | null
        }
        Insert: {
          agenda_item_id: string
          created_at?: string
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["solution_status"]
          title: string
          vote_abstention?: number | null
          vote_contre?: number | null
          vote_pour?: number | null
        }
        Update: {
          agenda_item_id?: string
          created_at?: string
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["solution_status"]
          title?: string
          vote_abstention?: number | null
          vote_contre?: number | null
          vote_pour?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "solutions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          max_documents: number
          max_sessions: number
          max_storage_mb: number
          max_users: number
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_documents?: number
          max_sessions?: number
          max_storage_mb?: number
          max_users?: number
          name: string
          price_monthly?: number
          price_yearly?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_documents?: number
          max_sessions?: number
          max_storage_mb?: number
          max_users?: number
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          responded_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          responded_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          responded_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          category: string
          company_id: string | null
          created_at: string
          details: Json | null
          id: string
          level: string
          message: string
          user_id: string | null
        }
        Insert: {
          category?: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          message: string
          user_id?: string | null
        }
        Update: {
          category?: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          message?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          permission_nom: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      my_company_id: { Args: never; Returns: string }
      user_has_permission: {
        Args: { _permission_nom: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      action_status: "en_cours" | "terminee" | "en_retard" | "annulee"
      agenda_nature: "information" | "decision"
      app_role: "admin" | "moderator" | "user" | "super_admin"
      member_quality:
        | "pca"
        | "administrateur"
        | "president_comite"
        | "secretariat_juridique"
        | "autre"
      organ_type: "ca" | "comite_audit"
      pv_status: "brouillon" | "valide" | "signe"
      session_status:
        | "brouillon"
        | "validee"
        | "tenue"
        | "cloturee"
        | "archivee"
      session_type: "ordinaire" | "extraordinaire" | "speciale"
      solution_status: "adoptee" | "rejetee" | "ajournee"
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
      action_status: ["en_cours", "terminee", "en_retard", "annulee"],
      agenda_nature: ["information", "decision"],
      app_role: ["admin", "moderator", "user", "super_admin"],
      member_quality: [
        "pca",
        "administrateur",
        "president_comite",
        "secretariat_juridique",
        "autre",
      ],
      organ_type: ["ca", "comite_audit"],
      pv_status: ["brouillon", "valide", "signe"],
      session_status: ["brouillon", "validee", "tenue", "cloturee", "archivee"],
      session_type: ["ordinaire", "extraordinaire", "speciale"],
      solution_status: ["adoptee", "rejetee", "ajournee"],
    },
  },
} as const
