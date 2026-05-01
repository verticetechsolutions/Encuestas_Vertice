CREATE TYPE "public"."caso_estado" AS ENUM('generado', 'validacion_fallida', 'mostrado', 'respondido', 'fallback_usado');--> statement-breakpoint
CREATE TYPE "public"."fuente_turno" AS ENUM('sonnet_genera', 'usuario_tipea', 'usuario_voz', 'opus_caso_sintetico');--> statement-breakpoint
CREATE TYPE "public"."rol_turno" AS ENUM('agente', 'usuario');--> statement-breakpoint
CREATE TYPE "public"."sesion_status" AS ENUM('abierta', 'pausada', 'sintetizando', 'completa', 'abandonada');--> statement-breakpoint
CREATE TYPE "public"."tipo_institucion" AS ENUM('banco', 'sofom_er', 'sofom_enr', 'sofipo', 'socap', 'arrendadora', 'factoraje', 'ifc', 'otro');--> statement-breakpoint
CREATE TABLE "casos_generados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sesion_id" uuid NOT NULL,
	"numero_caso" integer NOT NULL,
	"estado" "caso_estado" NOT NULL,
	"contenido" jsonb NOT NULL,
	"cajas_objetivo" text[] NOT NULL,
	"validacion_resultado" jsonb,
	"intento_numero" integer DEFAULT 1 NOT NULL,
	"generado_por" text,
	"fallback_origen" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos_correccion_manual" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sesion_id" uuid NOT NULL,
	"caja_codigo" text NOT NULL,
	"valor_anterior" jsonb,
	"valor_nuevo" jsonb NOT NULL,
	"motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sesion_id" uuid NOT NULL,
	"turno_id" uuid NOT NULL,
	"caja_codigo" text NOT NULL,
	"valor" jsonb NOT NULL,
	"confianza" real NOT NULL,
	"fuente" text NOT NULL,
	"evidencia_textual" text,
	"superseded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instituciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razon_social" text NOT NULL,
	"nombre_comercial" text,
	"tipo" "tipo_institucion" NOT NULL,
	"email_contacto" text NOT NULL,
	"magic_link_token" text,
	"magic_link_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instituciones_email_contacto_unique" UNIQUE("email_contacto"),
	CONSTRAINT "instituciones_magic_link_token_unique" UNIQUE("magic_link_token")
);
--> statement-breakpoint
CREATE TABLE "mapa_incertidumbre_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sesion_id" uuid NOT NULL,
	"numero_turno" integer NOT NULL,
	"cajas_estado" jsonb NOT NULL,
	"confianza_global" real,
	"cajas_criticas_pct" real,
	"cajas_blandas_pct" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perfil_decision_final" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institucion_id" uuid NOT NULL,
	"sesion_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"perfil_json" jsonb NOT NULL,
	"schema_version" text NOT NULL,
	"completitud" real NOT NULL,
	"confianza_global" real NOT NULL,
	"embedding" vector(1536),
	"generado_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institucion_id" uuid NOT NULL,
	"status" "sesion_status" DEFAULT 'abierta' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"ultimo_turno_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duracion_total_segundos" integer,
	"cajas_llenas_count" integer DEFAULT 0 NOT NULL,
	"cajas_aplicables" integer NOT NULL,
	"fatiga_detectada" boolean DEFAULT false NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "turnos_conversacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sesion_id" uuid NOT NULL,
	"numero_turno" integer NOT NULL,
	"rol" "rol_turno" NOT NULL,
	"contenido_texto" text NOT NULL,
	"fuente" "fuente_turno" NOT NULL,
	"modelo_llm" text,
	"tokens_input" integer,
	"tokens_output" integer,
	"latencia_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "casos_generados" ADD CONSTRAINT "casos_generados_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_correccion_manual" ADD CONSTRAINT "eventos_correccion_manual_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracciones" ADD CONSTRAINT "extracciones_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracciones" ADD CONSTRAINT "extracciones_turno_id_turnos_conversacion_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos_conversacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracciones" ADD CONSTRAINT "extracciones_superseded_by_extracciones_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "public"."extracciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapa_incertidumbre_snapshots" ADD CONSTRAINT "mapa_incertidumbre_snapshots_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perfil_decision_final" ADD CONSTRAINT "perfil_decision_final_institucion_id_instituciones_id_fk" FOREIGN KEY ("institucion_id") REFERENCES "public"."instituciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perfil_decision_final" ADD CONSTRAINT "perfil_decision_final_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_institucion_id_instituciones_id_fk" FOREIGN KEY ("institucion_id") REFERENCES "public"."instituciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos_conversacion" ADD CONSTRAINT "turnos_conversacion_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE no action ON UPDATE no action;