ALTER TABLE `app_users` ADD `access_type` text DEFAULT 'workspace' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `hosting_status` text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `hosting_error` text;--> statement-breakpoint
ALTER TABLE `app_users` ADD `hosting_updated_at` text;