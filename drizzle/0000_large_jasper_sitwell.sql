CREATE TABLE `creator_follows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creator_name` text NOT NULL,
	`actor_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompt_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer NOT NULL,
	`author_name` text NOT NULL,
	`author_initials` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompt_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer NOT NULL,
	`reaction_type` text NOT NULL,
	`actor_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompt_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer NOT NULL,
	`reason` text NOT NULL,
	`detail` text,
	`actor_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`summary` text,
	`negative_prompt` text,
	`aspect_ratio` text,
	`model_version` text,
	`parameters` text,
	`use_cases` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT '原创' NOT NULL,
	`source_url` text,
	`tool` text DEFAULT '通用 AI' NOT NULL,
	`media_type` text DEFAULT 'image' NOT NULL,
	`media_key` text,
	`poster_key` text,
	`duration` text,
	`media_name` text,
	`media_mime` text,
	`media_size` integer DEFAULT 0 NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`rights_type` text DEFAULT '原创分享' NOT NULL,
	`author_name` text DEFAULT '匿名创作者' NOT NULL,
	`author_initials` text DEFAULT '匿' NOT NULL,
	`author_bio` text DEFAULT '' NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`saves` integer DEFAULT 0 NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`comments_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
