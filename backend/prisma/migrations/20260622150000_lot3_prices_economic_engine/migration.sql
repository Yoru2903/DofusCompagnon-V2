CREATE TABLE "price_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "unit_price" REAL NOT NULL,
    "lot_size" INTEGER NOT NULL,
    "total_price" REAL NOT NULL,
    "price_type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "user_id" TEXT,
    "group_id" TEXT,
    "source_id" TEXT,
    "observed_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "price_snapshots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "price_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "price_snapshots_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "price_snapshots_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "economic_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "group_id" TEXT,
    "snapshot_type" TEXT NOT NULL,
    "data_json" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "economic_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "economic_snapshots_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "price_snapshots_item_id_observed_at_idx" ON "price_snapshots"("item_id", "observed_at");
CREATE INDEX "price_snapshots_price_type_scope_idx" ON "price_snapshots"("price_type", "scope");
CREATE INDEX "economic_snapshots_snapshot_type_created_at_idx" ON "economic_snapshots"("snapshot_type", "created_at");
