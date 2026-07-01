import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 1000;

async function importDvf() {
  const file = fs.readFileSync('./data/dvf-clean.json', 'utf8');

  const data = JSON.parse(file);
  let skipped = 0;

  console.log(`📦 ${data.length} lignes à importer`);
  let totalWithoutType = 0;
  let totalWithoutSurface = 0;
  let totalWithoutDate = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data
      .slice(i, i + BATCH_SIZE)
      .filter((item: any) => {
        if (!item.typeLocal) {
          totalWithoutType++;
        }

        if (!item.surface || item.surface <= 0) {
          totalWithoutSurface++;
        }

        if (isNaN(new Date(item.dateMutation).getTime())) {
          totalWithoutDate++;
        }

        const valid =
          item.commune &&
          item.typeLocal &&
          item.surface > 0 &&
          !isNaN(new Date(item.dateMutation).getTime());

        if (!valid) {
          skipped++;
        }

        return valid;
      })
      .map((item: any) => ({
        mutationId: item.mutationId,

        dateMutation: new Date(item.dateMutation),

        commune: item.commune,

        codePostal: item.codePostal,

        typeLocal: item.typeLocal,

        surface: Number(item.surface),

        pieces: item.pieces ? Number(item.pieces) : null,

        valeurFonciere: Number(item.valeurFonciere),

        prixM2: Number(item.prixM2),
      }));

    if (batch.length > 0) {
      await prisma.dvfTransaction.createMany({
        data: batch,
      });
    }

    console.log(`✅ ${Math.min(i + BATCH_SIZE, data.length)}/${data.length}`);
  }
  console.log({
    totalWithoutType,
    totalWithoutSurface,
    totalWithoutDate,
  });
  console.log(`⚠️ Lignes ignorées : ${skipped}`);

  console.log('🎉 Import DVF terminé');

  await prisma.$disconnect();
}

importDvf().catch((error) => {
  console.error(error);

  prisma.$disconnect();
});
