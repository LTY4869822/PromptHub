ALTER TABLE `users` ADD COLUMN `email_verified` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `email_verified_at` text;--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_auth_tokens_user_purpose` ON `auth_tokens` (`user_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `idx_auth_tokens_expires` ON `auth_tokens` (`expires_at`);--> statement-breakpoint
UPDATE `users` SET `email_verified` = 1;
