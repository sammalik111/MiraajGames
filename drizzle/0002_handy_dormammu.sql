CREATE TABLE "best_scores_for_game" (
	"game_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"score" integer NOT NULL,
	"metadata" jsonb,
	"game_version" integer DEFAULT 1 NOT NULL,
	"season_id" text,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "best_scores_for_game_game_id_user_id_pk" PRIMARY KEY("game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "game_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"game_id" integer NOT NULL,
	"game_version" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "game_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"game_id" integer NOT NULL,
	"score" integer NOT NULL,
	"metadata" jsonb,
	"game_version" integer DEFAULT 1 NOT NULL,
	"season_id" text,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"run_id" text,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "best_scores_for_game" ADD CONSTRAINT "best_scores_for_game_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_runs" ADD CONSTRAINT "game_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "best_scores_leaderboard_idx" ON "best_scores_for_game" USING btree ("game_id","score" DESC,"achieved_at");--> statement-breakpoint
CREATE INDEX "best_scores_user_idx" ON "best_scores_for_game" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_runs_user_game_idx" ON "game_runs" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "game_scores_game_recent_idx" ON "game_scores" USING btree ("game_id","achieved_at" DESC);