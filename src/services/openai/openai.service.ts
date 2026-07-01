import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ListingMetadata } from '../meta-data-scrapper/meta-data-scrapper.service';

@Injectable()
export class OpenaiService {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async analyze(
    metadata: ListingMetadata,
    marketData?: {
      count: number;
      averagePriceM2: number;
      estimatedValue: number;
    } | null,
  ) {
    const marketInfo = marketData
      ? `
DONNÉES DVF (ventes immobilières réelles) :

Nombre de transactions comparables :
${marketData.count}

Prix moyen constaté au m² :
${marketData.averagePriceM2} €

Valeur estimée selon les ventes DVF :
${marketData.estimatedValue} €

IMPORTANT :

Les données DVF proviennent de ventes immobilières réellement enregistrées.

Elles doivent être considérées comme une référence prioritaire pour estimer la valeur du bien.

Analyse obligatoirement :

- l'écart entre le prix demandé et la valeur DVF
- le prix au m² de l'annonce par rapport au marché
- le potentiel de négociation
- si le bien semble :
  - sous-évalué
  - au prix du marché
  - surévalué

Justifie ton verdict avec ces données.
`
      : `
DONNÉES DVF :

Aucune donnée de vente comparable disponible.

Fais l'analyse uniquement avec les informations de l'annonce.
`;

    const response = await this.client.responses.create({
      model: 'gpt-4.1-mini',

      input: `

Tu es un expert immobilier spécialisé dans l'analyse d'investissement.

Analyse cette annonce immobilière.


========================
ANNONCE
========================

Titre :
${metadata.title ?? ''}


Description :
${metadata.description ?? ''}


Prix affiché :
${metadata.price ?? 0} €


Surface :
${metadata.surface ?? 0} m²


Nombre de pièces :
${metadata.rooms ?? 0}


Adresse :
${metadata.address ?? ''}


Ville :
${metadata.commune ?? ''}


Type de bien :
${metadata.typeLocal ?? ''}


Images disponibles :
${metadata.images?.join(', ') ?? ''}



========================
MARCHÉ IMMOBILIER
========================

${marketInfo}



========================
RÈGLES DE SORTIE
========================

Réponds UNIQUEMENT avec un JSON valide.

Ne mets jamais de markdown.
Ne mets jamais :
\`\`\`json

Le JSON doit respecter exactement cette structure :

{
"title": "",
"city": "",

"rooms": 0,
"surface": 0,

"score": 0,
"scoreExplanation": "",

"verdict": "INVESTIR",
"verdictExplanation": "",

"estimatedValue": 0,
"askingPrice": 0,

"recommendedPrice": 0,

"negotiationAmount": 0,
"negotiationPotential": 0,
"negotiationAnalysis": "",

"description": "",

"imageUrl": "",

"marketPosition": "",

"riskLevel": 0,

"grossYield": 0,
"yieldLevel": "",
"yieldAnalysis": "",

"strengths": [],

"risks": []
}

========================
CONSIGNES
========================

- score est un entier entre 0 et 100.

- riskLevel est un entier entre 0 et 100.

- negotiationPotential est un entier entre 0 et 100.


- verdict doit être exactement :
INVESTIR
NEGOCIER
EVITER

- estimatedValue ne doit JAMAIS être égal automatiquement au prix affiché.

- Si des données DVF existent :
  estimatedValue doit être calculé principalement à partir du prix moyen DVF au m².

- Si aucune donnée DVF n'est disponible :
  estimatedValue doit être estimé à partir :
    - du prix au m² habituel du secteur,
    - de la ville,
    - du type de bien,
    - de la surface,
    - des caractéristiques du logement.

- estimatedValue représente la valeur probable du marché, pas le prix demandé.

- Si aucune donnée DVF n'est disponible, indique clairement dans scoreExplanation que l'estimation est moins fiable.

- Ne copie jamais simplement askingPrice dans estimatedValue.

- recommendedPrice doit correspondre au prix conseillé après analyse.

- negotiationAmount représente l'écart entre prix affiché et prix recommandé.

- grossYield correspond au rendement locatif brut estimé en pourcentage.

- yieldLevel doit être :
FAIBLE
MOYEN
BON
EXCELLENT

- strengths contient uniquement des points positifs.

- risks contient uniquement des risques.

Retourne uniquement le JSON.
`,
    });

    return response.output_text;
  }
}
