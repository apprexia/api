import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ListingMetadata } from '../meta-data-scrapper/meta-data-scrapper.service';

@Injectable()
export class OpenaiService {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async analyze(metadata: ListingMetadata) {
    const response = await this.client.responses.create({
      model: 'gpt-4.1-mini',

      input: `
Analyse cette annonce immobilière.

Informations de l'annonce :

Titre :
${metadata.title}

Description :
${metadata.description}

Prix affiché :
${metadata.price}

Adresse :
${metadata.address}

Images disponibles :
${metadata.images?.join(', ') ?? ''}


Réponds UNIQUEMENT avec un JSON valide.
Ne mets jamais de balises markdown.
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


Règles :

- score est un entier entre 0 et 100.
- riskLevel est un entier entre 0 et 100.
- negotiationPotential est un entier entre 0 et 100.
- verdict doit être exactement une valeur parmi :
  INVESTIR
  NEGOCIER
  EVITER

- estimatedValue correspond à la valeur estimée du bien.
- askingPrice correspond au prix affiché dans l'annonce.
- recommendedPrice correspond au prix conseillé après analyse du marché.
- negotiationAmount correspond au montant potentiel de négociation.

- grossYield correspond au rendement locatif brut estimé en pourcentage.
- yieldLevel doit indiquer le niveau de rentabilité :
  FAIBLE
  MOYEN
  BON
  EXCELLENT

- strengths doit contenir uniquement des points positifs.
- risks doit contenir uniquement des risques.

Retourne uniquement le JSON.
`,
    });

    return response.output_text;
  }
}
