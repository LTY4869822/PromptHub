CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`detail` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_logs` (`id`);--> statement-breakpoint
CREATE INDEX `idx_audit_actor` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE TABLE `prompt_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer NOT NULL,
	`actor_key` text NOT NULL,
	`day_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_views_prompt_actor_day` ON `prompt_views` (`prompt_id`,`actor_key`,`day_key`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expires` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`user_agent` text
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`object_key` text NOT NULL,
	`multipart_id` text,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`parts` text DEFAULT '[]' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_uploads_owner_status` ON `upload_sessions` (`owner_key`,`status`);--> statement-breakpoint
CREATE INDEX `idx_uploads_expires_at` ON `upload_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`nickname` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role_status` ON `users` (`role`,`status`);--> statement-breakpoint
ALTER TABLE `creator_follows` ADD `creator_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_follows_creator_actor` ON `creator_follows` (`creator_name`,`actor_key`);--> statement-breakpoint
CREATE INDEX `idx_follows_actor` ON `creator_follows` (`actor_key`);--> statement-breakpoint
ALTER TABLE `creator_profiles` ADD `user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_user_id_unique` ON `creator_profiles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_promptory_id_unique` ON `creator_profiles` (`promptory_id`);--> statement-breakpoint
ALTER TABLE `prompt_comments` ADD `author_key` text;--> statement-breakpoint
ALTER TABLE `prompt_comments` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_comments_prompt_status_id` ON `prompt_comments` (`prompt_id`,`status`,`id`);--> statement-breakpoint
ALTER TABLE `prompt_reports` ADD `status` text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE `prompt_reports` ADD `assigned_to` text;--> statement-breakpoint
ALTER TABLE `prompt_reports` ADD `resolution` text;--> statement-breakpoint
ALTER TABLE `prompt_reports` ADD `resolved_at` text;--> statement-breakpoint
CREATE INDEX `idx_reports_status_id` ON `prompt_reports` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `idx_reports_prompt` ON `prompt_reports` (`prompt_id`);--> statement-breakpoint
ALTER TABLE `prompts` ADD `content_status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `prompts` ADD `moderation_note` text;--> statement-breakpoint
ALTER TABLE `prompts` ADD `moderated_by` text;--> statement-breakpoint
ALTER TABLE `prompts` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `prompts` ADD `hot_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_prompts_status_id` ON `prompts` (`content_status`,`id`);--> statement-breakpoint
CREATE INDEX `idx_prompts_owner_status_id` ON `prompts` (`owner_key`,`content_status`,`id`);--> statement-breakpoint
CREATE INDEX `idx_prompts_hot_status` ON `prompts` (`content_status`,`hot_score`);--> statement-breakpoint
CREATE INDEX `idx_prompts_author_status` ON `prompts` (`author_name`,`content_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reactions_prompt_type_actor` ON `prompt_reactions` (`prompt_id`,`reaction_type`,`actor_key`);--> statement-breakpoint
CREATE INDEX `idx_reactions_actor_type` ON `prompt_reactions` (`actor_key`,`reaction_type`);