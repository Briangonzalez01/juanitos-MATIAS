CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_name` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`area` text NOT NULL,
	`user_id` integer,
	`user_name` text NOT NULL,
	`operation` text NOT NULL,
	`result` text NOT NULL,
	`previous_quantity` real NOT NULL,
	`informed_quantity` real NOT NULL,
	`difference` real NOT NULL,
	`new_quantity` real NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_movements_created_at` ON `movements` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_movements_product_id` ON `movements` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`area` text NOT NULL,
	`category_id` integer NOT NULL,
	`unit` text NOT NULL,
	`current_quantity` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_products_area_active_name` ON `products` (`area`,`active`,`name`);--> statement-breakpoint
CREATE INDEX `idx_products_category_id` ON `products` (`category_id`);--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`quantity` real NOT NULL,
	`area` text NOT NULL,
	`added_by_user_id` integer,
	`added_by_name` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_purchase_items_request_id` ON `purchase_items` (`request_id`);--> statement-breakpoint
CREATE TABLE `purchase_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text,
	`closed_by_user_id` integer,
	`closed_by_name` text,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `idx_purchase_requests_status` ON `purchase_requests` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`area` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_users_role_active` ON `users` (`role`,`active`);