import fs from 'fs';
import csv from 'csv-parser';

const ventes = new Map<string, any>();

// =========================
// STATS DE QUALITÉ DATASET
// =========================
let total = 0;
let sansType = 0;
let sansSurface = 0;
let sansPrix = 0;
let conserve = 0;

// =========================
// NORMALISATION CP
// objectif :
// "1700" -> "01700"
// =========================
function normalizePostalCode(cp?: string): string | null {
  if (!cp) return null;

  return String(cp).trim().padStart(5, '0');
}

// =========================
// NORMALISATION VILLE GLOBALE
// supprime accents + casse + parasites
// =========================
function normalizeCity(city?: string): string {
  if (!city) return '';

  return city
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // enlève accents
    .replace(/[^A-Z\s-]/g, '') // enlève chiffres / symbols
    .replace(/\s+/g, ' ') // espace propre
    .trim();
}

// =========================
// CAS SPÉCIAUX FRANCE
// - Paris
// - Lyon
// - Marseille
//
// Objectif :
// éviter "PARIS 04", "PARIS 4E", "75004"
// tout devient "PARIS"
// =========================
function normalizeMajorCities(city: string, postalCode?: string) {
  const cp = normalizePostalCode(postalCode);

  if (!cp) return normalizeCity(city);

  if (cp.startsWith('75')) return 'PARIS';
  if (cp.startsWith('69')) return 'LYON';
  if (cp.startsWith('13')) return 'MARSEILLE';

  return normalizeCity(city);
}

// =========================
// PARSING DATASET DVF
// =========================
fs.createReadStream('./data/dvf-raw.txt')
  .pipe(
    csv({
      separator: '|',
    }),
  )
  .on('data', (row) => {
    total++;

    const typeLocal = row['Type local'];

    // -------------------------
    // FILTRE : uniquement biens valides
    // -------------------------
    if (typeLocal !== 'Maison' && typeLocal !== 'Appartement') {
      sansType++;
      return;
    }

    const surface = Number(row['Surface reelle bati']);

    if (!surface || surface <= 0) {
      sansSurface++;
      return;
    }

    const prix = Number(
      row['Valeur fonciere']?.replace(/\s/g, '').replace(',', '.'),
    );

    if (!prix) {
      sansPrix++;
      return;
    }

    conserve++;

    // =========================
    // CLÉ UNIQUE DE MUTATION
    // =========================
    const mutationId = [
      row['Date mutation'],
      row['Commune'],
      row['Code postal'],
      row['No disposition'],
    ].join('_');

    // =========================
    // INIT VENTE SI PREMIÈRE OCCURRENCE
    // =========================
    if (!ventes.has(mutationId)) {
      const city = normalizeMajorCities(row['Commune'], row['Code postal']);

      const dateMutation = parseFrenchDate(row['Date mutation']);
      const year =
        dateMutation && !isNaN(new Date(dateMutation).getTime())
          ? new Date(dateMutation).getFullYear()
          : null;

      ventes.set(mutationId, {
        mutationId,

        // date normalisée YYYY-MM-DD
        dateMutation,

        // 🔥 AJOUT IMPORTANT : année DVF pour analyse temporelle
        year,

        // ville clean (clé principale de matching)
        commune: city,

        // code postal TOUJOURS sur 5 digits
        codePostal: normalizePostalCode(row['Code postal']),

        typeLocal,

        surface: 0,
        pieces: 0,

        valeurFonciere: prix,
      });
    }

    // =========================
    // AGGREGATION DES DONNÉES
    // =========================
    const vente = ventes.get(mutationId);

    vente.surface += surface;
    vente.pieces += Number(row['Nombre pieces principales']) || 0;
  })

  // =========================
  // EXPORT FINAL DATASET CLEAN
  // =========================
  .on('end', () => {
    const results = Array.from(ventes.values()).map((vente) => ({
      ...vente,

      // prix au m² calculé proprement
      prixM2:
        vente.surface > 0
          ? Math.round(vente.valeurFonciere / vente.surface)
          : 0,
    }));

    fs.writeFileSync('./data/dvf-clean.json', JSON.stringify(results, null, 2));

    // =========================
    // LOG QUALITÉ DATASET
    // =========================
    console.log('==============================');
    console.log(`📄 Lignes DVF lues : ${total}`);
    console.log(`🏠 Ventes conservées : ${conserve}`);
    console.log(`📦 Ventes finales : ${results.length}`);
    console.log(`❌ Sans type : ${sansType}`);
    console.log(`❌ Sans surface : ${sansSurface}`);
    console.log(`❌ Sans prix : ${sansPrix}`);
    console.log('==============================');
  });

// =========================
// PARSING DATE FR FR -> ISO
// =========================
function parseFrenchDate(date: string): string | null {
  if (!date) return null;

  const [day, month, year] = date.split('/');

  if (!day || !month || !year) return null;

  return `${year}-${month}-${day}`;
}
