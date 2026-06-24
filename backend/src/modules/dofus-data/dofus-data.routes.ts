import type { FastifyInstance } from 'fastify';
import type { DofusDataService } from './dofus-data.service.js';
import { equipmentImportBodySchema } from './dofus-data.validator.js';

export async function registerDofusDataRoutes(app: FastifyInstance, service: DofusDataService) {
  app.get('/api/sources', async () => service.listSources());
  app.post('/api/sources', async (request) => service.createSource(request.body as never));
  app.put('/api/sources/:id', async (request) =>
    service.updateSource((request.params as { id: string }).id, request.body as never),
  );
  app.delete('/api/sources/:id', async (request) =>
    service.deleteSource((request.params as { id: string }).id),
  );

  app.get('/api/item-types', async () => service.listItemTypes());
  app.post('/api/item-types', async (request) => service.createItemType(request.body as never));
  app.put('/api/item-types/:id', async (request) =>
    service.updateItemType((request.params as { id: string }).id, request.body as never),
  );
  app.delete('/api/item-types/:id', async (request) =>
    service.deleteItemType((request.params as { id: string }).id),
  );

  app.get('/api/jobs', async () => service.listJobs());
  app.post('/api/jobs', async (request) => service.createJob(request.body as never));
  app.put('/api/jobs/:id', async (request) =>
    service.updateJob((request.params as { id: string }).id, request.body as never),
  );
  app.delete('/api/jobs/:id', async (request) => service.deleteJob((request.params as { id: string }).id));

  app.get('/api/items/autocomplete', async (request) => {
    const query = (request.query as { q?: string; limit?: string }).q ?? '';
    const limit = Number((request.query as { limit?: string }).limit ?? 20);
    return service.autocompleteItems(query, Number.isFinite(limit) ? limit : 20);
  });

  app.get('/api/items', async (request) => {
    const query = (request.query as { q?: string }).q;
    return query ? service.searchItems(query) : service.listItems();
  });
  app.post('/api/items', async (request) => service.createItem(request.body as never));
  app.put('/api/items/:id', async (request) =>
    service.updateItem((request.params as { id: string }).id, request.body as never),
  );
  app.delete('/api/items/:id', async (request) =>
    service.deleteItem((request.params as { id: string }).id),
  );

  app.get('/api/recipes', async () => service.listRecipes());
  app.post('/api/recipes', async (request) => service.createRecipe(request.body as never));
  app.put('/api/recipes/:id', async (request) =>
    service.updateRecipe((request.params as { id: string }).id, request.body as never),
  );
  app.delete('/api/recipes/:id', async (request) =>
    service.deleteRecipe((request.params as { id: string }).id),
  );

  app.post('/api/import/runes', async (request) => {
    const body = request.body as { filePath?: string };
    const filePath =
      body.filePath ?? 'src/database/seeds/runes-dofus-touch-regenerated.json';
    return service.importRunesFromFile(filePath);
  });

  app.post('/api/import/equipments', async (request) => {
    const body = equipmentImportBodySchema.parse(request.body);
    return service.importEquipments(body.equipments);
  });

  app.post('/api/import/dofusbook-url', async (request) =>
    service.importEquipmentFromUrl(request.body),
  );

  app.get('/api/dofus-data/stats', async () => service.stats());
}
