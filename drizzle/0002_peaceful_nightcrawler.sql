CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`profile_id` text,
	`invited_by` text,
	`created_at` text NOT NULL,
	`last_seen_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_users_email` ON `app_users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_users_identity` ON `app_users` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_users_profile` ON `app_users` (`profile_id`);--> statement-breakpoint
CREATE TABLE `user_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO settings (id,data) VALUES ('user_access','{"ownerEmail":"karl@thinkengine.co"}');
