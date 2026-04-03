ALTER TABLE `assignments` ADD `sync_status` text;--> statement-breakpoint
CREATE UNIQUE INDEX `canvas_id_unique` ON `assignments` (`canvas_id`);