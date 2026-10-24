CREATE TABLE "positions" (
	"user_id" integer NOT NULL,
	"pair" text NOT NULL,
	"quantity" numeric(30, 10) NOT NULL,
	"cost_cents" bigint NOT NULL,
	CONSTRAINT "positions_user_id_pair_pk" PRIMARY KEY("user_id","pair")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limits_bucket_window_start_pk" PRIMARY KEY("bucket","window_start")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pair" text NOT NULL,
	"side" text NOT NULL,
	"quantity" numeric(30, 10) NOT NULL,
	"price" numeric(30, 10) NOT NULL,
	"total_cents" bigint NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"cash_cents" bigint NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trades_user_idempotency_key" ON "trades" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "trades_user_created_at" ON "trades" USING btree ("user_id","created_at");