DROP INDEX `idx_follows_creator_actor`;--> statement-breakpoint
DELETE FROM `creator_follows` WHERE `creator_key` IS NOT NULL AND `id` NOT IN (SELECT MIN(`id`) FROM `creator_follows` WHERE `creator_key` IS NOT NULL GROUP BY `creator_key`,`actor_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_follows_creator_key_actor` ON `creator_follows` (`creator_key`,`actor_key`);
