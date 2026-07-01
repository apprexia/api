import fs from 'fs';
import csv from 'csv-parser';

const ventes = new Map<string, any>();

let total = 0;
let sansType = 0;
let sansSurface = 0;
let sansPrix = 0;
let conserve = 0;

fs.createReadStream('./data/dvf-raw.txt')
  .pipe(
    csv({
      separator: '|',
    }),
  )
  .on('data', (row) => {
    total++;

    const typeLocal = row['Type local'];

    // On garde uniquement maisons et appartements
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

    // Identifiant unique d'une vente
    const mutationId = [
      row['Date mutation'],
      row['Commune'],
      row['Code commune'],
      row['No disposition'],
    ].join('_');

    // Première ligne de cette vente
    if (!ventes.has(mutationId)) {
      ventes.set(mutationId, {
        mutationId,

        dateMutation: parseFrenchDate(row['Date mutation']),

        commune: row['Commune'],

        codePostal: row['Code postal'],

        typeLocal,

        surface: 0,

        pieces: 0,

        valeurFonciere: prix,
      });
    }

    // On récupère la vente existante
    const vente = ventes.get(mutationId);

    // On additionne les surfaces
    vente.surface += surface;

    // On additionne les pièces
    vente.pieces += Number(row['Nombre pieces principales']) || 0;
  })
  .on('end', () => {
    const results = Array.from(ventes.values()).map((vente) => ({
      ...vente,

      prixM2:
        vente.surface > 0
          ? Math.round(vente.valeurFonciere / vente.surface)
          : 0,
    }));

    fs.writeFileSync('./data/dvf-clean.json', JSON.stringify(results, null, 2));

    console.log('==============================');
    console.log(`📄 Lignes DVF lues : ${total}`);
    console.log(`🏠 Ventes conservées : ${conserve}`);
    console.log(`📦 Ventes finales après regroupement : ${results.length}`);
    console.log(`❌ Sans type : ${sansType}`);
    console.log(`❌ Sans surface : ${sansSurface}`);
    console.log(`❌ Sans prix : ${sansPrix}`);
    console.log('==============================');
  });

function parseFrenchDate(date: string): string | null {
  if (!date) {
    return null;
  }

  const [day, month, year] = date.split('/');

  if (!day || !month || !year) {
    return null;
  }

  return `${year}-${month}-${day}`;
}
