import { resolve } from 'node:path';
import { prisma } from './prisma.js';
import { DofusDataRepository } from '../modules/dofus-data/dofus-data.repository.js';
import { DofusDataService } from '../modules/dofus-data/dofus-data.service.js';

const filePath = resolve('src/database/seeds/runes-dofus-touch-regenerated.json');
const service = new DofusDataService(new DofusDataRepository(prisma), prisma);

try {
  const summary = await service.importRunesFromFile(filePath);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
}
