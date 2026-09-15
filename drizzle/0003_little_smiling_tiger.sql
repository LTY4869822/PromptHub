ALTER TABLE `prompts` ADD `original_work_url` text;--> statement-breakpoint
ALTER TABLE `prompts` ADD `prompt_type` text DEFAULT '待确认类型' NOT NULL;--> statement-breakpoint
ALTER TABLE `prompts` ADD `media_role` text DEFAULT '生成效果' NOT NULL;
