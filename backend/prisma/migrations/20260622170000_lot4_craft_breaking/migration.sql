CREATE TABLE "craft_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "session_date" DATETIME NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "craft_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "craft_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "craft_session_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "craft_session_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" REAL NOT NULL,
    "total_cost" REAL NOT NULL,
    "cost_source" TEXT NOT NULL,
    "economic_snapshot_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "craft_session_lines_craft_session_id_fkey" FOREIGN KEY ("craft_session_id") REFERENCES "craft_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "craft_session_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "craft_session_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "craft_session_lines_economic_snapshot_id_fkey" FOREIGN KEY ("economic_snapshot_id") REFERENCES "economic_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "craft_session_ingredients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "craft_session_line_id" TEXT NOT NULL,
    "ingredient_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" REAL NOT NULL,
    "total_price" REAL NOT NULL,
    "price_snapshot_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "craft_session_ingredients_craft_session_line_id_fkey" FOREIGN KEY ("craft_session_line_id") REFERENCES "craft_session_lines" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "craft_session_ingredients_ingredient_item_id_fkey" FOREIGN KEY ("ingredient_item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "craft_session_ingredients_price_snapshot_id_fkey" FOREIGN KEY ("price_snapshot_id") REFERENCES "price_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "breaking_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "session_date" DATETIME NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "breaking_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "breaking_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "breaking_session_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "breaking_session_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" REAL NOT NULL,
    "total_cost" REAL NOT NULL,
    "source_craft_line_id" TEXT,
    "economic_snapshot_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "breaking_session_lines_breaking_session_id_fkey" FOREIGN KEY ("breaking_session_id") REFERENCES "breaking_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "breaking_session_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "breaking_session_lines_source_craft_line_id_fkey" FOREIGN KEY ("source_craft_line_id") REFERENCES "craft_session_lines" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "breaking_session_lines_economic_snapshot_id_fkey" FOREIGN KEY ("economic_snapshot_id") REFERENCES "economic_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "breaking_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "breaking_session_line_id" TEXT NOT NULL,
    "rune_item_id" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit_price" REAL NOT NULL,
    "total_value" REAL NOT NULL,
    "price_snapshot_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "breaking_results_breaking_session_line_id_fkey" FOREIGN KEY ("breaking_session_line_id") REFERENCES "breaking_session_lines" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "breaking_results_rune_item_id_fkey" FOREIGN KEY ("rune_item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "breaking_results_price_snapshot_id_fkey" FOREIGN KEY ("price_snapshot_id") REFERENCES "price_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "craft_sessions_session_date_idx" ON "craft_sessions"("session_date");
CREATE INDEX "craft_sessions_user_id_group_id_idx" ON "craft_sessions"("user_id", "group_id");
CREATE INDEX "craft_session_lines_craft_session_id_idx" ON "craft_session_lines"("craft_session_id");
CREATE INDEX "craft_session_lines_item_id_idx" ON "craft_session_lines"("item_id");
CREATE INDEX "craft_session_ingredients_craft_session_line_id_idx" ON "craft_session_ingredients"("craft_session_line_id");
CREATE INDEX "breaking_sessions_session_date_idx" ON "breaking_sessions"("session_date");
CREATE INDEX "breaking_sessions_user_id_group_id_idx" ON "breaking_sessions"("user_id", "group_id");
CREATE INDEX "breaking_session_lines_breaking_session_id_idx" ON "breaking_session_lines"("breaking_session_id");
CREATE INDEX "breaking_session_lines_item_id_idx" ON "breaking_session_lines"("item_id");
CREATE INDEX "breaking_results_breaking_session_line_id_idx" ON "breaking_results"("breaking_session_line_id");
