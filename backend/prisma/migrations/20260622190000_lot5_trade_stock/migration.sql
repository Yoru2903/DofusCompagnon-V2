CREATE TABLE "trade_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "session_date" DATETIME NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "trade_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trade_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "trade_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trade_session_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_buy_price" REAL NOT NULL,
    "total_buy_price" REAL NOT NULL,
    "expected_unit_sell_price" REAL NOT NULL,
    "expected_total_sell_price" REAL NOT NULL,
    "actual_unit_sell_price" REAL,
    "actual_total_sell_price" REAL,
    "fees" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "economic_snapshot_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "trade_lines_trade_session_id_fkey" FOREIGN KEY ("trade_session_id") REFERENCES "trade_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trade_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trade_lines_economic_snapshot_id_fkey" FOREIGN KEY ("economic_snapshot_id") REFERENCES "economic_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "stock_locations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "user_id" TEXT,
    "group_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "stock_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_locations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stock_location_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "movement_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_value" REAL NOT NULL,
    "total_value" REAL NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "trade_sessions_session_date_idx" ON "trade_sessions"("session_date");
CREATE INDEX "trade_sessions_user_id_group_id_idx" ON "trade_sessions"("user_id", "group_id");
CREATE INDEX "trade_lines_trade_session_id_idx" ON "trade_lines"("trade_session_id");
CREATE INDEX "trade_lines_item_id_idx" ON "trade_lines"("item_id");
CREATE INDEX "trade_lines_status_idx" ON "trade_lines"("status");
CREATE INDEX "stock_locations_scope_idx" ON "stock_locations"("scope");
CREATE INDEX "stock_movements_stock_location_id_idx" ON "stock_movements"("stock_location_id");
CREATE INDEX "stock_movements_item_id_idx" ON "stock_movements"("item_id");
CREATE INDEX "stock_movements_related_entity_type_related_entity_id_idx" ON "stock_movements"("related_entity_type", "related_entity_id");
