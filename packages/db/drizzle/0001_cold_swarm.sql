CREATE TYPE "public"."support_case_status" AS ENUM('open', 'pending', 'closed');--> statement-breakpoint
CREATE TABLE "accounts_customer" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_customer_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "shop_product" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"priceUsd" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_case" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"customerName" text NOT NULL,
	"customerEmail" text NOT NULL,
	"orderRef" text NOT NULL,
	"status" "support_case_status" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "accounts_customer_name_idx" ON "accounts_customer" USING btree ("name");--> statement-breakpoint
CREATE INDEX "accounts_customer_email_idx" ON "accounts_customer" USING btree ("email");--> statement-breakpoint
CREATE INDEX "shop_product_name_idx" ON "shop_product" USING btree ("name");--> statement-breakpoint
CREATE INDEX "support_case_title_idx" ON "support_case" USING btree ("title");--> statement-breakpoint
CREATE INDEX "support_case_customer_email_idx" ON "support_case" USING btree ("customerEmail");--> statement-breakpoint
CREATE INDEX "support_case_order_ref_idx" ON "support_case" USING btree ("orderRef");