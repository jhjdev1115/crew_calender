CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_low_id` text NOT NULL,
	`user_high_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`linked_at` text NOT NULL,
	`unlinked_at` text,
	FOREIGN KEY (`user_low_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_high_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_connections_pair` ON `connections` (`user_low_id`,`user_high_id`);--> statement-breakpoint
CREATE INDEX `idx_connections_low_status` ON `connections` (`user_low_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_connections_high_status` ON `connections` (`user_high_id`,`status`);--> statement-breakpoint
CREATE TABLE `duties` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`roster_month` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`start_at` text,
	`end_at` text,
	`event_tz` text,
	`flight_no` text,
	`dep_airport` text,
	`arr_airport` text,
	`aircraft` text,
	`layover_city` text,
	`hotel_name` text,
	`note` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_duties_user_roster` ON `duties` (`user_id`,`roster_month`);--> statement-breakpoint
CREATE INDEX `idx_duties_user_start_date` ON `duties` (`user_id`,`start_date`);--> statement-breakpoint
CREATE INDEX `idx_duties_user_start_at` ON `duties` (`user_id`,`start_at`);--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer_user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`code_hint` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`issuer_user_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invite_codes_hash` ON `invite_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `idx_invite_codes_issuer_active` ON `invite_codes` (`issuer_user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`all_enabled` integer DEFAULT true NOT NULL,
	`own_flight_pre` integer DEFAULT true NOT NULL,
	`partner_flight_pre` integer DEFAULT true NOT NULL,
	`partner_flight_post` integer DEFAULT true NOT NULL,
	`roster_changed` integer DEFAULT true NOT NULL,
	`shared_off_d1` integer DEFAULT true NOT NULL,
	`hide_details` integer DEFAULT true NOT NULL,
	`notification_tz` text DEFAULT 'auto' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text,
	`airline` text,
	`base_airport` text,
	`schedule_tz` text DEFAULT 'Asia/Seoul' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deletion_requested_at` text
);
