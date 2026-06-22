import { prisma } from './prisma.js';
import { DofusDataRepository } from '../modules/dofus-data/dofus-data.repository.js';
import { DofusDataService } from '../modules/dofus-data/dofus-data.service.js';

const defaultUrl =
  'https://touch.dofusbook.net/api/items/touch/search/equipment?context=item&page=1&sort=desc';
const url = process.argv[2] ?? defaultUrl;
const service = new DofusDataService(new DofusDataRepository(prisma), prisma);

try {
  const summary = await service.importEquipmentPagesFromUrl(url);
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  const knownError = error as { code?: unknown; message?: unknown; details?: unknown };
  const output =
    error && typeof error === 'object' && 'code' in error && 'message' in error
      ? {
          status: 'failed',
          code: knownError.code,
          message: knownError.message,
          details: knownError.details,
        }
      : {
          status: 'failed',
          code: 'IMPORT_FAILED',
          message: 'Import DofusBook impossible.',
        };
  console.error(JSON.stringify(output, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
