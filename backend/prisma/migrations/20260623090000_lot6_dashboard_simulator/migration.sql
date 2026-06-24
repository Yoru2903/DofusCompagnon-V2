ALTER TABLE "trade_lines" ADD COLUMN "fee_rate" REAL NOT NULL DEFAULT 0.02;

CREATE TABLE "simulations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "simulation_type" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "result_json" JSONB NOT NULL,
  "economic_snapshot_id" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "simulations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "simulations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "simulations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "simulations_economic_snapshot_id_fkey" FOREIGN KEY ("economic_snapshot_id") REFERENCES "economic_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "simulations_simulation_type_created_at_idx" ON "simulations"("simulation_type", "created_at");
CREATE INDEX "simulations_user_id_group_id_idx" ON "simulations"("user_id", "group_id");
