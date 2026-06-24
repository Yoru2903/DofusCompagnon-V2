UPDATE "item_effects"
SET "characteristic_id" = (SELECT "id" FROM "characteristics" WHERE "code" = 'ine' LIMIT 1)
WHERE "characteristic_id" IN (SELECT "id" FROM "characteristics" WHERE "code" = 'in')
  AND EXISTS (SELECT 1 FROM "characteristics" WHERE "code" = 'ine');
