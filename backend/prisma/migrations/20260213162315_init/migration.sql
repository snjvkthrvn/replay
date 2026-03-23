-- CreateEnum
CREATE TYPE "MusicService" AS ENUM ('SPOTIFY', 'APPLE_MUSIC');

-- CreateEnum
CREATE TYPE "Segment" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT');

-- CreateEnum
CREATE TYPE "ReplayStatus" AS ENUM ('PENDING', 'CONFIRMED', 'LATE', 'SILENT', 'MISSED');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ExportPlatform" AS ENUM ('SPOTIFY', 'APPLE_MUSIC');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "bio" TEXT,
    "profile_picture_url" TEXT,
    "password_hash" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "music_service" "MusicService" NOT NULL,
    "music_service_user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "notification_preferences" JSONB NOT NULL DEFAULT '{ "capture": true, "reveal": true, "reaction": true, "comment": true, "friendRequest": true }',
    "total_replays" INTEGER NOT NULL DEFAULT 0,
    "total_friends" INTEGER NOT NULL DEFAULT 0,
    "curator_badge" BOOLEAN NOT NULL DEFAULT false,
    "curator_streak" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_active_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replays" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "segment_date" DATE NOT NULL,
    "capture_time" TIMESTAMP(3) NOT NULL,
    "capture_scheduled_time" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "track_name" TEXT NOT NULL,
    "artist_name" TEXT NOT NULL,
    "album_name" TEXT,
    "album_art_url" TEXT,
    "track_uri" TEXT,
    "external_url" TEXT,
    "status" "ReplayStatus" NOT NULL DEFAULT 'PENDING',
    "is_silent" BOOLEAN NOT NULL DEFAULT false,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "re_rolls_used" INTEGER NOT NULL DEFAULT 0,
    "re_rolls_available" INTEGER NOT NULL DEFAULT 0,
    "reaction_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "addressee_id" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "interaction_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "replay_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "replay_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "segment_date" DATE NOT NULL,
    "scheduled_capture_time" TIMESTAMP(3) NOT NULL,
    "re_rolls_allocated" INTEGER NOT NULL DEFAULT 0,
    "capture_attempted" BOOLEAN NOT NULL DEFAULT false,
    "capture_succeeded" BOOLEAN NOT NULL DEFAULT false,
    "replay_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "time_range_start" DATE,
    "time_range_end" DATE,
    "segments_included" "Segment"[],
    "friend_ids_included" TEXT[],
    "exported_to" "ExportPlatform",
    "external_playlist_id" TEXT,
    "external_playlist_url" TEXT,
    "track_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fcm_token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_music_service_music_service_user_id_key" ON "users"("music_service", "music_service_user_id");

-- CreateIndex
CREATE INDEX "replays_user_id_segment_date_segment_idx" ON "replays"("user_id", "segment_date", "segment");

-- CreateIndex
CREATE INDEX "replays_segment_date_segment_status_idx" ON "replays"("segment_date", "segment", "status");

-- CreateIndex
CREATE INDEX "replays_capture_time_idx" ON "replays"("capture_time");

-- CreateIndex
CREATE UNIQUE INDEX "replays_user_id_segment_date_segment_key" ON "replays"("user_id", "segment_date", "segment");

-- CreateIndex
CREATE INDEX "friendships_requester_id_status_idx" ON "friendships"("requester_id", "status");

-- CreateIndex
CREATE INDEX "friendships_addressee_id_status_idx" ON "friendships"("addressee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_requester_id_addressee_id_key" ON "friendships"("requester_id", "addressee_id");

-- CreateIndex
CREATE INDEX "reactions_replay_id_idx" ON "reactions"("replay_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_replay_id_user_id_key" ON "reactions"("replay_id", "user_id");

-- CreateIndex
CREATE INDEX "comments_replay_id_created_at_idx" ON "comments"("replay_id", "created_at");

-- CreateIndex
CREATE INDEX "capture_schedules_scheduled_capture_time_idx" ON "capture_schedules"("scheduled_capture_time");

-- CreateIndex
CREATE INDEX "capture_schedules_user_id_segment_date_idx" ON "capture_schedules"("user_id", "segment_date");

-- CreateIndex
CREATE UNIQUE INDEX "capture_schedules_user_id_segment_date_segment_key" ON "capture_schedules"("user_id", "segment_date", "segment");

-- CreateIndex
CREATE INDEX "playlists_user_id_idx" ON "playlists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_user_id_fcm_token_key" ON "device_tokens"("user_id", "fcm_token");

-- AddForeignKey
ALTER TABLE "replays" ADD CONSTRAINT "replays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_replay_id_fkey" FOREIGN KEY ("replay_id") REFERENCES "replays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_replay_id_fkey" FOREIGN KEY ("replay_id") REFERENCES "replays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_schedules" ADD CONSTRAINT "capture_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_schedules" ADD CONSTRAINT "capture_schedules_replay_id_fkey" FOREIGN KEY ("replay_id") REFERENCES "replays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
