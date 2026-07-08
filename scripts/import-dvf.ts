import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 1000;

// =========================
// VALIDATION DATE SAFE
// =========================
function isValidDate(date: any): boolean {
  return date && !isNaN(new Date(date).getTime());
}

async function importDvf() {
  const file = fs.readFileSync('./data/dvf-clean.json', 'utf8');
  const data = JSON.parse(file);

  console.log(`📦 ${data.length} lignes à importer`);

  let skipped = 0;
  let totalWithoutType = 0;
  let totalWithoutSurface = 0;
  let totalWithoutDate = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batchRaw = data.slice(i, i + BATCH_SIZE);

    // =========================
    // FILTER PROPRE + TRACE
    // =========================
    const batch = batchRaw
      .filter((item: any) => {
        const hasType = !!item.typeLocal;
        const hasSurface = item.surface > 0;
        const hasDate = isValidDate(item.dateMutation);

        if (!hasType) totalWithoutType++;
        if (!hasSurface) totalWithoutSurface++;
        if (!hasDate) totalWithoutDate++;

        const valid = hasType && hasSurface && hasDate;

        if (!valid) skipped++;

        return valid;
      })
      .map((item: any) => {
        const date = new Date(item.dateMutation);

        return {
          mutationId: item.mutationId,

          dateMutation: date,

          // ⭐ ajout important
          year: date.getFullYear(),

          city: item.commune,

          codePostal: item.codePostal,

          typeLocal: item.typeLocal,

          surface: Number(item.surface),

          pieces: item.pieces ? Number(item.pieces) : 0,

          valeurFonciere: Number(item.valeurFonciere),

          prixM2: Number(item.prixM2),
        };
      });

    // =========================
    // INSERT DB
    // =========================
    if (batch.length > 0) {
      await prisma.dvfTransaction.createMany({
        data: batch,
        skipDuplicates: true, // 🔥 IMPORTANT
      });
    }

    console.log(`✅ ${Math.min(i + BATCH_SIZE, data.length)}/${data.length}`);
  }

  console.log('====================');
  console.log({
    totalWithoutType,
    totalWithoutSurface,
    totalWithoutDate,
    skipped,
  });
  console.log('🎉 Import DVF terminé');

  await prisma.$disconnect();
}

importDvf().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
});
