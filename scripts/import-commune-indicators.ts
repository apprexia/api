import fs from 'fs';
import csv from 'csv-parser';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 1000;

function normalizeInsee(code?: string): string | null {
    if (!code) return null;

    return code.trim().padStart(5, '0');
}

/**
 * Normalisation commune
 *
 * Exemples :
 * MARSEILLE 1ER ARRONDISSEMENT -> MARSEILLE
 * MARSEILLE 15E ARRONDISSEMENT -> MARSEILLE
 * AIX EN PROVENCE -> AIX-EN-PROVENCE
 * SAINT RAPHAEL -> SAINT-RAPHAEL
 */
function normalizeText(value?: string): string {
    if (!value) return '';

    let commune = value
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');

    // Suppression des arrondissements municipaux
    commune = commune.replace(/\s+\d+\s*(ER|ERE|E|EME)\s+ARRONDISSEMENT/g, '').replace(/\s+ARRONDISSEMENT/g, '');

    // Nettoyage caractères
    commune = commune
        .replace(/['’]/g, '-')
        .replace(/[^A-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return commune;
}

function toFloat(value?: string): number | null {
    if (!value?.trim()) return null;

    const n = Number(value);

    return Number.isNaN(n) ? null : n;
}

function toInt(value?: string): number | null {
    if (!value?.trim()) return null;

    const n = Number(value);

    return Number.isNaN(n) ? null : Math.round(n);
}

async function main() {
    const batch: Prisma.CommuneIndicatorCreateManyInput[] = [];

    let imported = 0;

    const stream = fs.createReadStream('./scripts/data/communes-indicateurs.csv').pipe(csv());

    for await (const row of stream) {
        const codeInsee = normalizeInsee(row.code_insee);

        if (!codeInsee) continue;

        batch.push({
            codeInsee,

            // Commune normalisée
            commune: normalizeText(row.nom_commune),

            codeDepartement: row.code_departement?.trim() || null,

            region: row.nom_region?.trim() || null,

            population: toInt(row.population),

            evolutionPopulation5Years: toFloat(row.evolution_population_5ans_pct),

            medianPriceM2: toFloat(row.prix_m2_median_eur),

            medianHousePriceM2: toFloat(row.prix_m2_median_maison_eur),

            medianApartmentPriceM2: toFloat(row.prix_m2_median_appartement_eur),

            dvfTransactions: toInt(row.nb_transactions_dvf),

            priceEvolution5Years: toFloat(row.evolution_prix_5ans_pct),

            dpeAB: toFloat(row.pct_dpe_a_b),

            passoiresDpe: toFloat(row.pct_passoires_dpe),

            schoolIndex: toFloat(row.ips_ecoles_moyen),

            fiberCoverage: toFloat(row.couverture_fibre_pct),

            doctorAccess: toFloat(row.apl_medecin_consult_an_hab),

            icpeSurface: toFloat(row.pct_surface_icpe),

            sevesoSurface: toFloat(row.pct_surface_seveso),

            floodRisk: toFloat(row.ppr_inondation_pct),

            propertyTaxRate: toFloat(row.taxe_fonciere_taux_pct),

            propertyTaxM2: toFloat(row.taxe_fonciere_eur_m2_an),
        });

        if (batch.length >= BATCH_SIZE) {
            await prisma.communeIndicator.createMany({
                data: batch,
                skipDuplicates: true,
            });

            imported += batch.length;

            console.log(`✅ ${imported} communes importées`);

            batch.length = 0;
        }
    }

    // Dernier lot
    if (batch.length > 0) {
        await prisma.communeIndicator.createMany({
            data: batch,
            skipDuplicates: true,
        });

        imported += batch.length;
    }

    console.log('======================');
    console.log(`🏙️ Total importé : ${imported}`);
    console.log('======================');

    await prisma.$disconnect();
}

main().catch(async (error) => {
    console.error(error);

    await prisma.$disconnect();

    process.exit(1);
});
