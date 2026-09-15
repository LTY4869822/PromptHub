CREATE TABLE `creator_profiles` (
	`actor_key` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`gender` text DEFAULT '保密' NOT NULL,
	`city` text DEFAULT '未填写' NOT NULL,
	`birthday` text DEFAULT '未填写' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`promptory_id` text NOT NULL,
	`avatar_key` text,
	`cover_key` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
