ALTER TABLE `prompts` ADD `review_status` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `prompts` ADD `review_mode` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `prompts` ADD `review_confidence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `prompts` ADD `review_reason` text DEFAULT '历史内容，待下次编辑时复审' NOT NULL;--> statement-breakpoint
ALTER TABLE `prompts` ADD `safety_labels` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `prompts` ADD `review_model` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `prompts` ADD `reviewed_at` text;