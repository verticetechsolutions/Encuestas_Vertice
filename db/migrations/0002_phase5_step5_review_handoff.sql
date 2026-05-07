CREATE TABLE "cajas_declinadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sesion_id" uuid NOT NULL,
	"caja_codigo" text NOT NULL,
	"razon" text NOT NULL,
	"review_id_origen" uuid NOT NULL,
	"detalle" text,
	"declinada_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews_seccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sesion_id" uuid NOT NULL,
	"grupo_ui_codigo" text NOT NULL,
	"turno_disparador" integer NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"hipotesis_sonnet" text NOT NULL,
	"extracciones_snapshot" jsonb NOT NULL,
	"cajas_no_clausuradas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decision_opus" text,
	"guidance_opus" text,
	"cajas_a_reabordar" jsonb,
	"caso_sintetico_id" uuid,
	"siguiente_grupo_ui" text,
	"decidio_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sesiones" ADD COLUMN "secciones_cerradas" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cajas_declinadas" ADD CONSTRAINT "cajas_declinadas_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cajas_declinadas" ADD CONSTRAINT "cajas_declinadas_review_id_origen_reviews_seccion_id_fk" FOREIGN KEY ("review_id_origen") REFERENCES "public"."reviews_seccion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews_seccion" ADD CONSTRAINT "reviews_seccion_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews_seccion" ADD CONSTRAINT "reviews_seccion_caso_sintetico_id_casos_generados_id_fk" FOREIGN KEY ("caso_sintetico_id") REFERENCES "public"."casos_generados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cajas_declinadas_sesion_caja_unique" ON "cajas_declinadas" USING btree ("sesion_id","caja_codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_seccion_sesion_grupo_round_unique" ON "reviews_seccion" USING btree ("sesion_id","grupo_ui_codigo","round");