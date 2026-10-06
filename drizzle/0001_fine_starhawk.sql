CREATE TABLE `datasets` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`section_id` text NOT NULL,
	`name_key` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_datasets_report_section_name` ON `datasets` (`report_id`,`section_id`,`name_key`);