-- CreateIndex
CREATE INDEX "replays_segment_segment_date_status_capture_time_idx" ON "replays"("segment", "segment_date", "status", "capture_time");
