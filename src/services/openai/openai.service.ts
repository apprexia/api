import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ListingMetadata } from '../meta-data-scrapper/meta-data-scrapper.service';
import { ApprexiaMarketData } from '../../analyses/interfaces/apprexia-market-data.interface';
import { DvfMarketData } from '../../analyses/interfaces/dvf-market-data.interface';

@Injectable()
export class OpenaiService {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async analyze(
    metadata: ListingMetadata,
    marketData?: DvfMarketData | null,
    apprexiaMarketData?: ApprexiaMarketData | null,
  ) {
    const apprexiaInfo = apprexiaMarketData
      ? `

DONNÉES APPREXIA
(Analyses historiques de biens similaires)

Nombre d'analyses comparables :
${apprexiaMarketData.count}

Score moyen :
${apprexiaMarketData.averageScore}/100

Rendement brut moyen :
${apprexiaMarketData.averageYield.toFixed(1)} %

Prix affiché moyen :
${Math.round(apprexiaMarketData.averageAskingPrice)} €

Prix recommandé moyen :
${Math.round(apprexiaMarketData.averageRecommendedPrice)} €

Négociation moyenne observée :
${Math.round(apprexiaMarketData.averageNegotiation)} €

Réduction moyenne nécessaire :
${apprexiaMarketData.averageDiscountPercent.toFixed(1)} %

Niveau de confiance des comparables :
${apprexiaMarketData.confidence} %

Plus le niveau de confiance est élevé,
plus les analyses historiques sont représentatives.

Répartition :

INVESTIR :
${apprexiaMarketData.investir}

NEGOCIER :
${apprexiaMarketData.negocier}

EVITER :
${apprexiaMarketData.eviter}


UTILISATION DES DONNÉES APPREXIA :

Ces données représentent des analyses déjà réalisées
sur des biens similaires.

Elles servent à comparer :

- la cohérence du prix demandé
- le potentiel de négociation
- le rendement
- le score
- le verdict final

Apprexia complète la DVF mais ne la remplace pas.

`
      : `
DONNÉES APPREXIA :

Aucune analyse historique disponible.
`;

    const marketInfo = marketData
      ? `

DONNÉES DVF
(Ventes immobilières réellement enregistrées)


Nombre de transactions comparables :
${marketData.count}


Prix moyen constaté :
${marketData.averagePriceM2} €/m²


Prix médian :
${marketData.medianPriceM2} €/m²


Prix ajusté selon modèle :
${marketData.adjustedPriceM2} €/m²

Référence principale :

- utiliser prioritairement adjustedPriceM2
- vérifier avec medianPriceM2
- averagePriceM2 est uniquement indicatif.

Valeur estimée DVF :
${marketData.dvfReferenceValue} €


Fourchette basse :
${marketData.lowEstimate} €


Fourchette haute :
${marketData.highEstimate} €


Niveau de confiance :
${marketData.confidence}%

INTERPRÉTATION DVF :

La DVF constitue la meilleure référence
de prix disponible.

Cependant elle ne prend pas en compte :

- la vue
- la qualité de la résidence
- les prestations
- les rénovations
- la rareté du bien

Ces éléments doivent être intégrés
pour déterminer la valeur finale.

Un bien peut dépasser la DVF si :

- emplacement exceptionnel
- centre-ville recherché
- proximité immédiate plage ou port
- vue mer
- terrasse importante
- piscine
- résidence premium
- prestations rares

Lorsque DVF et Apprexia sont disponibles :

La DVF représente le marché réel.

Apprexia représente les comportements observés
sur des annonces comparables.

Le verdict final doit utiliser les deux.

Si elles conduisent à des conclusions différentes,
explique pourquoi.

Analyse obligatoirement :

1) L'écart entre prix demandé et valeur DVF.

2) Le prix au m² demandé par rapport au marché.

3) Si la différence est justifiée par les prestations.

4) Le potentiel réel de négociation.



Si DVF et prestations racontent deux histoires différentes,
explique pourquoi.



`
      : `

DONNÉES DVF :

Aucune donnée disponible.

L'estimation devra utiliser :

- localisation
- type de bien
- surface
- prestations
- marché local connu.

`;

    const response = await this.client.responses.create({
      model: 'gpt-4.1-mini',

      input: `

Tu es un agent immobilier expert spécialisé
dans l'évaluation de biens immobiliers.

Ton objectif est de produire une estimation
réaliste du marché, comme un professionnel.


ANNONCE IMMOBILIÈRE


Titre :
${metadata.title ?? ''}


Description :
${metadata.description ?? ''}


Prix affiché :
${metadata.price ?? 0} €


Surface :
${metadata.surface ?? 0} m²


Pièces :
${metadata.rooms ?? 0}


Adresse :
${metadata.address ?? ''}


Ville :
${metadata.city ?? ''}


Type :
${metadata.typeLocal ?? ''}


Photos :
${metadata.images?.join(', ') ?? ''}



${marketInfo}


${apprexiaInfo}


MÉTHODE D'ANALYSE OBLIGATOIRE

Tu es un expert immobilier.

Ton analyse doit suivre les étapes suivantes :

1. Estimer la valeur réelle du bien.
2. Comparer cette valeur au prix demandé.
3. Identifier les éléments qui justifient une éventuelle prime ou décote.
4. Évaluer les risques et les points forts.
5. Déterminer le potentiel de négociation.
6. Calculer le score global.
7. Donner un verdict final.

Le verdict doit être l'une des valeurs suivantes :

INVESTIR
NEGOCIER
EVITER

IMPORTANT SUR estimatedValue

La valeur du marché ne doit pas être représentée par un montant unique.

Retourne obligatoirement :

- estimatedValueLow
- estimatedValueHigh

Ces deux valeurs représentent la fourchette de valeur probable du bien après prise en compte :

- des données DVF ;
- des comparables Apprexia ;
- de la localisation ;
- des prestations ;
- de la rareté du bien.

La fourchette doit rester réaliste.

L'écart entre estimatedValueLow et estimatedValueHigh doit généralement être compris entre 5 % et 10 %, sauf si les données disponibles sont insuffisantes ou très hétérogènes.

IMPORTANT SUR dvfReferenceValue

dvfReferenceValue correspond à la valeur issue du modèle DVF avant toute correction liée aux prestations, à la localisation ou à la rareté du bien.

IMPORTANT SUR recommendedPrice

recommendedPrice représente le prix auquel l'acheteur devrait acquérir le bien aujourd'hui.

Il doit être cohérent avec estimatedValue.

Il peut être :

- inférieur au prix affiché si le bien est surévalué ;
- égal au prix affiché si le prix est cohérent ;
- supérieur au prix affiché uniquement si le bien est sous-évalué.

IMPORTANT SUR marketPosition

marketPosition doit obligatoirement prendre l'une des valeurs suivantes :

SOUS_EVALUE
PRIX_MARCHE
LEGEREMENT_SURCOTE
SURCOTE

Cette valeur est déterminée en comparant askingPrice à estimatedValue, et non uniquement à la valeur DVF.

IMPORTANT SUR marketAdjustment

marketAdjustment explique pourquoi estimatedValue est différente de dvfReferenceValue.

Exemples :

- Prime de 12 % justifiée par une résidence premium avec piscine et terrasse.
- Décote de 8 % liée à d'importants travaux de rénovation.

IMPORTANT SUR score

score est un entier compris entre 0 et 100.

Il représente l'intérêt global du bien.

Le score doit tenir compte simultanément :

- du prix ;
- de la localisation ;
- des prestations ;
- du potentiel locatif ;
- du potentiel de négociation ;
- des données DVF ;
- des comparables Apprexia.

Un bien très cher peut obtenir un excellent score si ses qualités justifient son prix.

IMPORTANT SUR riskLevel

riskLevel est un entier compris entre 0 et 100.

IMPORTANT SUR negotiationPotential

negotiationPotential est un entier compris entre 0 et 100.

IMPORTANT SUR verdict

Le verdict est une synthèse globale.

Il ne dépend jamais uniquement :

- du score ;
- du prix ;
- de l'écart avec la DVF.

Il doit prendre en compte :

- la qualité intrinsèque du bien ;
- la localisation ;
- les prestations ;
- le potentiel de négociation ;
- les données DVF ;
- les comparables Apprexia.

Deux biens ayant un score similaire peuvent avoir des verdicts différents selon leurs risques ou leur potentiel de négociation.

IMPORTANT SUR grossYield

grossYield représente le rendement locatif brut exprimé en pourcentage.

IMPORTANT SUR yieldLevel

yieldLevel doit être obligatoirement :

FAIBLE
MOYEN
BON
EXCELLENT

Réponds UNIQUEMENT avec un JSON valide.

Structure obligatoire :

{
  "title": "",
  "description": "",
  "imageUrl": "",
  "city": "",
  "rooms": 0,
  "surface": 0,
  "score": 0,
  "scoreExplanation": "",
  "verdict": "INVESTIR",
  "verdictExplanation": "",
  "estimatedValueLow": 0,
  "estimatedValueHigh": 0,
  "dvfReferenceValue": 0,
  "askingPrice": 0,
  "recommendedPrice": 0,
  "negotiationAmount": 0,
  "negotiationPotential": 0,
  "negotiationAnalysis": "",
  "marketPosition": "",
  "marketAdjustment": "",
  "riskLevel": 0,
  "description": "",
  "grossYield": 0,
  "yieldLevel": "",
  "yieldAnalysis": "",
  "strengths": [],
  "risks": []
}

Retourne uniquement le JSON.
`,
    });

    return response.output_text;
  }
}
