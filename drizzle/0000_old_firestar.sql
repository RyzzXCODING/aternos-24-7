CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `activity_logs_at_idx` ON `activity_logs` (`at`);--> statement-breakpoint
CREATE INDEX `activity_logs_type_idx` ON `activity_logs` (`type`);--> statement-breakpoint
CREATE TABLE `app_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`host` text DEFAULT '' NOT NULL,
	`port` integer DEFAULT 25565 NOT NULL,
	`version` text DEFAULT '1.21.11' NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`auth_mode` text DEFAULT 'offline' NOT NULL,
	`reconnect_enabled` integer DEFAULT true NOT NULL,
	`reconnect_delay_ms` integer DEFAULT 5000 NOT NULL,
	`reconnect_max_attempts` integer DEFAULT 5 NOT NULL,
	`chat_monitoring` integer DEFAULT true NOT NULL,
	`player_list_monitoring` integer DEFAULT true NOT NULL,
	`worker_endpoint` text DEFAULT 'http://127.0.0.1:8787' NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `bot_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'OFFLINE' NOT NULL,
	`address` text,
	`version` text,
	`username` text,
	`connected_at` integer,
	`last_attempt_at` integer,
	`last_disconnect_reason` text,
	`reconnect_attempt` integer DEFAULT 0 NOT NULL,
	`players` text DEFAULT '[]' NOT NULL,
	`max_players` integer,
	`motd` text,
	`ping_ms` integer,
	`detail` text,
	`updated_at` integer NOT NULL,
	`last_worker_push_at` integer
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'industrial' NOT NULL,
	`compact` integer DEFAULT false NOT NULL,
	`refresh_ms` integer DEFAULT 5000 NOT NULL,
	`notify_on_error` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);