CREATE TABLE `review_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`result` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_review_receipts_user_expires` ON `review_receipts` (`user_id`,`expires_at`);