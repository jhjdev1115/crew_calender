CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_subscriptions_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`event_key` text NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `push_subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notification_deliveries_once` ON `notification_deliveries` (`subscription_id`,`event_key`);--> statement-breakpoint
CREATE INDEX `idx_notification_deliveries_sent` ON `notification_deliveries` (`sent_at`);
