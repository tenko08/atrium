CREATE TABLE `assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`canvas_id` text,
	`title` text NOT NULL,
	`course_id` text,
	`course_name` text,
	`description` text,
	`due_at` integer,
	`estimated_min` integer,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `time_estimates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assignment_id` integer NOT NULL,
	`estimated_min` integer NOT NULL,
	`source` text NOT NULL,
	`confidence` real,
	`reasoning` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `schedule_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assignment_id` integer NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`is_manual` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fixed_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurrence` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_start_hour` integer DEFAULT 9 NOT NULL,
	`work_end_hour` integer DEFAULT 22 NOT NULL,
	`canvas_base_url` text,
	`canvas_api_token` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `completion_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assignment_id` integer NOT NULL,
	`estimated_min` integer NOT NULL,
	`actual_min` integer NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
