-- CreateTable
CREATE TABLE "usage_hourly_stats" (
    "id" SERIAL NOT NULL,
    "bucket_start" TIMESTAMP(3) NOT NULL,
    "api_requests" INTEGER NOT NULL DEFAULT 0,
    "page_views" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "client_error_count" INTEGER NOT NULL DEFAULT 0,
    "total_duration_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "guest_requests" INTEGER NOT NULL DEFAULT 0,
    "participant_requests" INTEGER NOT NULL DEFAULT 0,
    "staff_requests" INTEGER NOT NULL DEFAULT 0,
    "webmanager_requests" INTEGER NOT NULL DEFAULT 0,
    "mobile_requests" INTEGER NOT NULL DEFAULT 0,
    "desktop_requests" INTEGER NOT NULL DEFAULT 0,
    "chrome_requests" INTEGER NOT NULL DEFAULT 0,
    "safari_requests" INTEGER NOT NULL DEFAULT 0,
    "line_requests" INTEGER NOT NULL DEFAULT 0,
    "other_browser_requests" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_hourly_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_endpoint_daily_stats" (
    "id" SERIAL NOT NULL,
    "day" DATE NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "total_duration_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "client_error_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_endpoint_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_daily_active_users" (
    "id" SERIAL NOT NULL,
    "day" DATE NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "usage_daily_active_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_db_snapshots" (
    "id" SERIAL NOT NULL,
    "day" DATE NOT NULL,
    "generation_no" INTEGER,
    "database_bytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_rows" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "session_count" INTEGER NOT NULL DEFAULT 0,
    "storage_file_count" INTEGER NOT NULL DEFAULT 0,
    "storage_bytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "table_sizes" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_db_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usage_hourly_stats_bucket_start_key" ON "usage_hourly_stats"("bucket_start");

-- CreateIndex
CREATE UNIQUE INDEX "usage_endpoint_daily_stats_day_method_route_key" ON "usage_endpoint_daily_stats"("day", "method", "route");

-- CreateIndex
CREATE INDEX "usage_daily_active_users_day_idx" ON "usage_daily_active_users"("day");

-- CreateIndex
CREATE UNIQUE INDEX "usage_daily_active_users_day_user_id_key" ON "usage_daily_active_users"("day", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_db_snapshots_day_key" ON "usage_db_snapshots"("day");
