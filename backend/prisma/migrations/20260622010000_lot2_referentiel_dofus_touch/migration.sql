-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "source_type" TEXT NOT NULL,
    "reliability_level" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "imported_by" TEXT,
    "status" TEXT NOT NULL,
    "raw_file_name" TEXT,
    "notes" TEXT,
    "report_data" JSONB,
    "imported_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "import_batches_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "import_batches_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "import_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "import_batch_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "external_ref" TEXT,
    "raw_data_json" JSONB NOT NULL,
    "proposed_data_json" JSONB,
    "status" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "import_records_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "item_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "level" INTEGER,
    "item_type_id" TEXT,
    "job_id" TEXT,
    "is_craftable" BOOLEAN NOT NULL DEFAULT false,
    "is_rune" BOOLEAN NOT NULL DEFAULT false,
    "is_resource" BOOLEAN NOT NULL DEFAULT false,
    "rune_tier" TEXT,
    "panoply_name" TEXT,
    "verification_status" TEXT NOT NULL,
    "confidence_level" TEXT NOT NULL,
    "source_id" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "validated_by" TEXT,
    "validated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "items_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "item_types" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "items_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "items_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "result_item_id" TEXT NOT NULL,
    "job_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "verification_status" TEXT NOT NULL,
    "confidence_level" TEXT NOT NULL,
    "source_id" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "validated_by" TEXT,
    "validated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "recipes_result_item_id_fkey" FOREIGN KEY ("result_item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recipes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "recipes_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipe_id" TEXT NOT NULL,
    "ingredient_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recipe_ingredients_ingredient_item_id_fkey" FOREIGN KEY ("ingredient_item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "characteristics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "item_effects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "characteristic_id" TEXT NOT NULL,
    "min_value" INTEGER,
    "max_value" INTEGER,
    "fixed_value" INTEGER,
    "verification_status" TEXT NOT NULL,
    "source_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "item_effects_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "item_effects_characteristic_id_fkey" FOREIGN KEY ("characteristic_id") REFERENCES "characteristics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "item_effects_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rune_characteristics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rune_item_id" TEXT NOT NULL,
    "characteristic_id" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "bonus_value" REAL NOT NULL,
    "is_special" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "rune_characteristics_rune_item_id_fkey" FOREIGN KEY ("rune_item_id") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rune_characteristics_characteristic_id_fkey" FOREIGN KEY ("characteristic_id") REFERENCES "characteristics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_name_key" ON "data_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "item_types_name_category_key" ON "item_types"("name", "category");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_name_key" ON "jobs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "items_external_id_key" ON "items"("external_id");

-- CreateIndex
CREATE INDEX "items_normalized_name_idx" ON "items"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_result_item_id_version_key" ON "recipes"("result_item_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_recipe_id_ingredient_item_id_key" ON "recipe_ingredients"("recipe_id", "ingredient_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "characteristics_code_key" ON "characteristics"("code");

-- CreateIndex
CREATE UNIQUE INDEX "characteristics_short_name_key" ON "characteristics"("short_name");

-- CreateIndex
CREATE UNIQUE INDEX "rune_characteristics_rune_item_id_characteristic_id_key" ON "rune_characteristics"("rune_item_id", "characteristic_id");
