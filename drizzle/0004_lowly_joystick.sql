CREATE TABLE `user_blocks` (
	`blocker_user_id` text NOT NULL,
	`blocked_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`blocker_user_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blocked_user_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_blocks_pair` ON `user_blocks` (`blocker_user_id`,`blocked_user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_blocks_blocked` ON `user_blocks` (`blocked_user_id`);