import fs from 'fs';
import iconv from 'iconv-lite';
import csv from 'csv-parser';
import {
  PrismaClient,
  PropertyType,
  RoomCategory,
  PredictionType,
} from '@prisma/client';

const prisma = new PrismaClient();

interface RentalRow {
  zoneId: number;
  year: number;
  inseeCode: string;
  city: string;
  departmentCode: string;
  regionCode: string;
  propertyType: PropertyType;
  roomCategory: RoomCategory;
  rentMedianM2: number;
  rentLowM2: number;
  rentHighM2: number;
  predictionType: PredictionType;
  observations: number;
  observationsArea: number;
  adjustedR2: number;
}

// ============================
// UTILITAIRES
// ============================

function parseNumber(value?: string): number {
  if (!value) return 0;

  return Number(value.replace(',', '.').trim());
}

function normalizeCity(city?: string): string {
  if (!city) return '';

  return city
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents
    .replace(/�/g, '') // supprime les caractères invalides
    .replace(/[^A-Z0-9\s-]/g, '') // garde lettres chiffres espaces tirets
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================
// IMPORT CSV
// ============================

async function importRentalFile(
  file: string,
  propertyType: PropertyType,
  roomCategory: RoomCategory,
) {
  const rows: RentalRow[] = [];

  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(file)
      .pipe(iconv.decodeStream('ISO-8859-1'))
      .pipe(
        csv({
          separator: ';',
        }),
      )

      .on('data', (row) => {
        rows.push({
          zoneId: Number(row['id_zone']),

          year: 2024,

          inseeCode: row['INSEE_C'],

          city: normalizeCity(row['LIBGEO']),

          departmentCode: row['DEP'],

          regionCode: row['REG'],

          propertyType,

          roomCategory,

          rentMedianM2: parseNumber(row['loypredm2']),

          rentLowM2: parseNumber(row['lwr.IPm2']),

          rentHighM2: parseNumber(row['upr.IPm2']),

          predictionType:
            row['TYPPRED'] === 'commune'
              ? PredictionType.COMMUNE
              : PredictionType.MAILLE,

          observations: Number(row['nbobs_com']) || 0,

          observationsArea: Number(row['nbobs_mail']) || 0,

          adjustedR2: parseNumber(row['R2_adj']),
        });
      })

      .on('end', async () => {
        console.log(`📥 ${file} : ${rows.length} lignes`);

        await prisma.rentalMarket.createMany({
          data: rows,
          skipDuplicates: true,
        });

        console.log(`✅ Import terminé`);

        resolve();
      })

      .on('error', reject);
  });
}

// ============================
// EXECUTION
// ============================

async function main() {
  await importRentalFile(
    './scripts/data/loyers-appartement.csv',
    PropertyType.APARTMENT,
    RoomCategory.ALL,
  );

  await importRentalFile(
    './scripts/data/loyers-appartement-1-2.csv',
    PropertyType.APARTMENT,
    RoomCategory.ONE_TWO,
  );

  await importRentalFile(
    './scripts/data/loyers-appartement-3-plus.csv',
    PropertyType.APARTMENT,
    RoomCategory.THREE_PLUS,
  );

  await importRentalFile(
    './scripts/data/loyers-maison.csv',
    PropertyType.HOUSE,
    RoomCategory.ALL,
  );
}

main()
  .then(() => {
    console.log('🎉 Tous les imports terminés');
  })
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
