CREATE TABLE `download_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`share_link_id` text,
	`work_file_id` text NOT NULL,
	`at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`share_link_id`) REFERENCES `share_links`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_file_id`) REFERENCES `work_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `download_log_file_idx` ON `download_log` (`work_file_id`);--> statement-breakpoint
CREATE TABLE `parts` (
	`id` text PRIMARY KEY NOT NULL,
	`sort_order` integer NOT NULL,
	`name_no` text NOT NULL,
	`name_en` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`section` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_works` (
	`project_id` text NOT NULL,
	`work_id` text NOT NULL,
	`position` integer NOT NULL,
	`note` text,
	PRIMARY KEY(`project_id`, `work_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text,
	`name` text NOT NULL,
	`kind` text DEFAULT 'konsert' NOT NULL,
	`event_date` text,
	`venue` text,
	`description` text,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `projects_date_idx` ON `projects` (`event_date`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission` text NOT NULL,
	PRIMARY KEY(`role_id`, `permission`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_system` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`recipient_name` text NOT NULL,
	`part_ids` text DEFAULT '[]' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_hash_unique` ON `share_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `share_links_project_idx` ON `share_links` (`project_id`);--> statement-breakpoint
CREATE TABLE `user_parts` (
	`user_id` text NOT NULL,
	`part_id` text NOT NULL,
	`is_primary` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`user_id`, `part_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`google_id` text,
	`role_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `work_files` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`kind` text NOT NULL,
	`part_id` text,
	`label` text,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`page_count` integer,
	`uploaded_by` text,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `work_files_work_idx` ON `work_files` (`work_id`);--> statement-breakpoint
CREATE TABLE `work_links` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`label` text,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_links_work_idx` ON `work_links` (`work_id`);--> statement-breakpoint
CREATE TABLE `works` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`composer` text,
	`arranger` text,
	`publisher` text,
	`genre` text,
	`grade` integer,
	`duration_sec` integer,
	`physical_location` text,
	`acquired_year` integer,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `works_title_idx` ON `works` (`title`);