CREATE TABLE `native_push_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`platform` text DEFAULT 'android' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`user_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_native_push_token` ON `native_push_tokens` (`token`);
--> statement-breakpoint
CREATE INDEX `idx_native_push_user` ON `native_push_tokens` (`user_id`);
--> statement-breakpoint
CREATE TABLE `native_notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text NOT NULL,
	`event_key` text NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `native_push_tokens`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_native_delivery_once` ON `native_notification_deliveries` (`token_id`,`event_key`);
