import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ApprexiaMarketData } from '../../analyses/interfaces/apprexia-market-data.interface';
import { DvfMarketData } from '../../analyses/interfaces/dvf-market-data.interface';
import { LocationAnalysis } from '../../apprexia-engine/interfaces/location-analysis.interface';
import { CommuneIndicator } from '@prisma/client';
import { PropertyFeatures } from '../../meta-data-scrapper/interfaces/property-features.interface';
import { ListingMetadata } from '../../meta-data-scrapper/interfaces/listing-metadata.interface';
import { AnalysisAiResult } from '../../analyses/interfaces/analysis-ai-result.interface';

@Injectable()
export class OpenaiService {
    private readonly logger = new Logger(OpenaiService.name);

    private openAI = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    async analyze(
        metadata: ListingMetadata,
        marketData?: DvfMarketData | null,
        apprexiaMarketData?: ApprexiaMarketData | null,
        locationAnalysis?: LocationAnalysis | null,
        communeIndicator?: CommuneIndicator | null,
    ) {
        const start = Date.now();

        // =====================================================
        // DONNÉES DVF
        // =====================================================

        const marketInfo = marketData
            ? `
────────────────────────────────
DONNÉES DVF
────────────────────────────────

Nombre de transactions comparables :
${marketData.count}

Prix moyen :
${marketData.averagePriceM2} €/m²

Prix médian :
${marketData.medianPriceM2} €/m²

Prix ajusté :
${marketData.adjustedPriceM2} €/m²

Valeur centrale DVF :
${marketData.dvfReferenceValue} €

Fourchette basse :
${marketData.lowEstimate} €

Fourchette haute :
${marketData.highEstimate} €

Confiance DVF :
${marketData.confidence} %

Résumé marché :
${marketData.marketSummary ?? 'N/A'}

RÈGLE ABSOLUE :

Ces données sont fournies par Apprexia.

Tu peux les LIRE et les RESTITUER.

Tu ne dois :

- jamais les recalculer ;
- jamais les modifier ;
- jamais créer une nouvelle valeur ;
- jamais créer une nouvelle fourchette ;
- jamais produire une valorisation personnelle ;
- jamais utiliser ces données pour décider d'un verdict ;
- jamais utiliser ces données pour calculer un score ;
- jamais calculer un prix recommandé ;
- jamais calculer une négociation.
`
            : `
────────────────────────────────
DONNÉES DVF
────────────────────────────────

Aucune donnée DVF fiable disponible.

Ne crée aucune donnée DVF.
Ne crée aucune estimation.
Ne crée aucune fourchette.
`;

        // =====================================================
        // APPREXIA MARKET DATA
        // =====================================================

        const apprexiaInfo = apprexiaMarketData
            ? `
────────────────────────────────
DONNÉES HISTORIQUES APPREXIA
────────────────────────────────

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

Négociation moyenne :
${Math.round(apprexiaMarketData.averageNegotiation)} €

Réduction moyenne :
${apprexiaMarketData.averageDiscountPercent.toFixed(1)} %

Confiance :
${apprexiaMarketData.confidence} %

Répartition historique :

INVESTIR :
${apprexiaMarketData.investir}

FAVORABLE :
${apprexiaMarketData.favorable}

NEGOCIER :
${apprexiaMarketData.negocier}

EVITER :
${apprexiaMarketData.eviter}

RÈGLE ABSOLUE :

Ces données sont uniquement contextuelles.

Elles décrivent des analyses historiques.

Elles ne concernent PAS nécessairement le bien actuellement analysé.

Tu ne dois JAMAIS utiliser ces données pour :

- déterminer une force ;
- déterminer un risque ;
- calculer un score ;
- déterminer un verdict ;
- calculer un prix ;
- calculer une valorisation ;
- calculer une négociation ;
- calculer un rendement ;
- déterminer la rentabilité du bien actuel.
`
            : `
────────────────────────────────
DONNÉES HISTORIQUES APPREXIA
────────────────────────────────

Aucune donnée historique comparable disponible.
`;

        // =====================================================
        // LOCATION ENGINE
        // =====================================================

        const locationInfo = locationAnalysis
            ? `
────────────────────────────────
LOCATION ENGINE
────────────────────────────────

Score localisation :
${locationAnalysis.score}/100

Forces :
${locationAnalysis.strengths?.join(', ') || 'Aucune'}

Faiblesses :
${locationAnalysis.weaknesses?.join(', ') || 'Aucune'}

RÈGLE ABSOLUE :

Le score fourni appartient au Location Engine.

Tu ne dois jamais le modifier.

Tu ne dois jamais recalculer ce score.

Tu peux uniquement restituer des informations explicitement fournies.

IMPORTANT :

Une faiblesse du Location Engine peut être mentionnée uniquement
si elle correspond à une information objective réellement fournie.

Tu ne dois pas transformer automatiquement une faiblesse
en risque du bien.

Tu ne dois jamais inventer une proximité, une accessibilité,
une qualité de quartier ou une caractéristique locale.
`
            : `
────────────────────────────────
LOCATION ENGINE
────────────────────────────────

Aucune analyse de localisation disponible.

Ne crée aucune information de localisation.
`;

        // =====================================================
        // COMMUNE
        // =====================================================

        const communeInfo = communeIndicator
            ? `
────────────────────────────────
DONNÉES COMMUNE
────────────────────────────────

Commune :
${communeIndicator.commune ?? 'N/A'}

Évolution prix immobilier 5 ans :
${communeIndicator.priceEvolution5Years !== null ? `${communeIndicator.priceEvolution5Years}%` : 'N/A'}

Prix appartement :
${communeIndicator.medianApartmentPriceM2 !== null ? `${communeIndicator.medianApartmentPriceM2} €/m²` : 'N/A'}

Prix immobilier médian :
${communeIndicator.medianPriceM2 !== null ? `${communeIndicator.medianPriceM2} €/m²` : 'N/A'}

Évolution population 5 ans :
${communeIndicator.evolutionPopulation5Years !== null ? `${communeIndicator.evolutionPopulation5Years}%` : 'N/A'}

Score écoles :
${communeIndicator.schoolIndex !== null ? `${communeIndicator.schoolIndex}/100` : 'N/A'}

Taxe foncière :
${communeIndicator.propertyTaxRate !== null ? `${communeIndicator.propertyTaxRate}%` : 'N/A'}

Couverture fibre :
${communeIndicator.fiberCoverage !== null ? `${communeIndicator.fiberCoverage}%` : 'N/A'}

Accès médecins :
${communeIndicator.doctorAccess !== null ? communeIndicator.doctorAccess : 'N/A'}

Risque inondation :
${communeIndicator.floodRisk !== null ? communeIndicator.floodRisk : 'N/A'}

RÈGLE ABSOLUE :

Ces données décrivent uniquement le contexte général de la commune.

Elles ne décrivent pas nécessairement le bien lui-même.

Tu peux mentionner une donnée communale uniquement comme
CONTEXTE OBJECTIF.

Tu ne dois jamais :

- transformer une donnée communale en caractéristique du logement ;
- inventer une proximité ;
- inventer une qualité de quartier ;
- inventer un risque spécifique au bien ;
- calculer une valeur du bien ;
- calculer un score ;
- prendre une décision.

Ne crée aucune information absente.
`
            : `
────────────────────────────────
DONNÉES COMMUNE
────────────────────────────────

Aucune donnée communale disponible.

Ne crée aucune information.
`;

        // =====================================================
        // PRESTATIONS
        // =====================================================

        const features = metadata.propertyFeatures
            ? `
────────────────────────────────
PRESTATIONS DÉTECTÉES
────────────────────────────────

Duplex :
${metadata.propertyFeatures.duplex ? 'Oui' : 'Non détecté'}

Triplex :
${metadata.propertyFeatures.triplex ? 'Oui' : 'Non détecté'}

Loft :
${metadata.propertyFeatures.loft ? 'Oui' : 'Non détecté'}

Terrasse :
${metadata.propertyFeatures.terrasse ? 'Oui' : 'Non détecté'}

Balcon :
${metadata.propertyFeatures.balcon ? 'Oui' : 'Non détecté'}

Loggia :
${metadata.propertyFeatures.loggia ? 'Oui' : 'Non détecté'}

Jardin :
${metadata.propertyFeatures.jardin ? 'Oui' : 'Non détecté'}

Patio :
${metadata.propertyFeatures.patio ? 'Oui' : 'Non détecté'}

Piscine :
${metadata.propertyFeatures.piscine ? 'Oui' : 'Non détecté'}

Jacuzzi :
${metadata.propertyFeatures.jacuzzi ? 'Oui' : 'Non détecté'}

Spa :
${metadata.propertyFeatures.spa ? 'Oui' : 'Non détecté'}

Sauna :
${metadata.propertyFeatures.sauna ? 'Oui' : 'Non détecté'}

Parking :
${metadata.propertyFeatures.parking ? 'Oui' : 'Non détecté'}

Garage :
${metadata.propertyFeatures.garage ? 'Oui' : 'Non détecté'}

Box :
${metadata.propertyFeatures.box ? 'Oui' : 'Non détecté'}

Cave :
${metadata.propertyFeatures.cave ? 'Oui' : 'Non détecté'}

Grenier :
${metadata.propertyFeatures.grenier ? 'Oui' : 'Non détecté'}

Ascenseur :
${metadata.propertyFeatures.ascenseur ? 'Oui' : 'Non détecté'}

Gardien :
${metadata.propertyFeatures.gardien ? 'Oui' : 'Non détecté'}

Interphone :
${metadata.propertyFeatures.interphone ? 'Oui' : 'Non détecté'}

Digicode :
${metadata.propertyFeatures.digicode ? 'Oui' : 'Non détecté'}

Visiophone :
${metadata.propertyFeatures.visiophone ? 'Oui' : 'Non détecté'}

Climatisation :
${metadata.propertyFeatures.climatisation ? 'Oui' : 'Non détecté'}

Cheminée :
${metadata.propertyFeatures.cheminee ? 'Oui' : 'Non détecté'}

Cuisine équipée :
${metadata.propertyFeatures.cuisineEquipee ? 'Oui' : 'Non détecté'}

Dressing :
${metadata.propertyFeatures.dressing ? 'Oui' : 'Non détecté'}

Buanderie :
${metadata.propertyFeatures.buanderie ? 'Oui' : 'Non détecté'}

Vue mer :
${metadata.propertyFeatures.vueMer ? 'Oui' : 'Non détecté'}

Vue montagne :
${metadata.propertyFeatures.vueMontagne ? 'Oui' : 'Non détecté'}

Vue panoramique :
${metadata.propertyFeatures.vuePanoramique ? 'Oui' : 'Non détecté'}

Vue dégagée :
${metadata.propertyFeatures.vueDegagee ? 'Oui' : 'Non détecté'}

Dernier étage :
${metadata.propertyFeatures.dernierEtage ? 'Oui' : 'Non détecté'}

Traversant :
${metadata.propertyFeatures.traversant ? 'Oui' : 'Non détecté'}

Lumineux :
${metadata.propertyFeatures.lumineux ? 'Oui' : 'Non détecté'}

Calme :
${metadata.propertyFeatures.calme ? 'Oui' : 'Non détecté'}

Rénové :
${metadata.propertyFeatures.renove ? 'Oui' : 'Non détecté'}

Standing :
${metadata.propertyFeatures.standing ? 'Oui' : 'Non détecté'}

Prestige :
${metadata.propertyFeatures.prestige ? 'Oui' : 'Non détecté'}

RÈGLE :

"Non détecté" signifie uniquement que l'information
n'a pas été détectée.

"Non détecté" ≠ absent.

Ne transforme jamais "Non détecté" en risque.

Une valeur false peut uniquement être utilisée comme
information négative si elle a été explicitement vérifiée
dans l'annonce.
`
            : `
────────────────────────────────
PRESTATIONS DÉTECTÉES
────────────────────────────────

Aucune prestation détectée.
`;

        // =====================================================
        // PROMPT
        // =====================================================

        const input = `
Tu es le module d'analyse descriptive d'Apprexia.

TON RÔLE EST STRICTEMENT DESCRIPTIF.

Tu n'es PAS le moteur de décision.

Tu ne dois PAS décider si le bien est une bonne ou une mauvaise affaire.

Les moteurs Apprexia calculent séparément :

- la valorisation ;
- le prix recommandé ;
- la négociation ;
- le score ;
- le risque ;
- la liquidité ;
- la rentabilité ;
- le verdict ;
- la position marché.

────────────────────────────────
INTERDICTIONS ABSOLUES
────────────────────────────────

Tu ne dois JAMAIS :

- calculer un score ;
- inventer un score ;
- calculer une valorisation ;
- inventer une valorisation ;
- calculer un prix recommandé ;
- inventer un prix recommandé ;
- calculer une négociation ;
- inventer une négociation ;
- calculer un rendement ;
- inventer un rendement ;
- calculer un loyer ;
- inventer un loyer ;
- déterminer un verdict ;
- déterminer INVESTIR ;
- déterminer OPPORTUNITE ;
- déterminer FAVORABLE ;
- déterminer NEGOCIER ;
- déterminer EVITER ;
- déterminer SURCOTE ;
- déterminer SOUS_EVALUE ;
- déterminer PRIX_MARCHE ;
- déterminer un niveau de risque ;
- déterminer la liquidité ;
- transformer une information inconnue en risque ;
- transformer une absence d'information en défaut ;
- inventer une proximité ;
- inventer une caractéristique du logement.

────────────────────────────────
ANNONCE
────────────────────────────────

Titre :
${metadata.title ?? ''}

Description :
${metadata.description ?? ''}

Prix affiché :
${metadata.price ?? 0} €

Surface :
${metadata.surface ?? 0} m²

Terrain :
${metadata.terrain ?? 0} m²

Pièces :
${metadata.rooms ?? 0}

DPE :
${metadata.dpe ?? null}

GES :
${metadata.ges ?? null}

Adresse :
${metadata.address ?? ''}

Ville :
${metadata.city ?? ''}

Type :
${metadata.typeLocal ?? ''}

État du bien :
${metadata.propertyCondition ?? 'INCONNU'}

Photos :
${metadata.images?.join(', ') ?? ''}

${features}

${marketInfo}

${apprexiaInfo}

${locationInfo}

${communeInfo}

────────────────────────────────
RÈGLES DE DESCRIPTION
────────────────────────────────

1. DESCRIPTION

La description doit résumer uniquement les informations
réellement présentes dans l'annonce.

Tu peux mentionner :

- type de bien ;
- surface ;
- terrain ;
- nombre de pièces ;
- prix ;
- DPE ;
- GES ;
- état du bien s'il est explicitement connu ;
- prestations explicitement détectées.

Tu ne dois jamais enrichir la description avec une information
qui n'est pas explicitement disponible.

Exemple interdit :

"L'annonce est proche des commerces."

si aucune information fiable ne le démontre.

────────────────────────────────
2. FORCES
────────────────────────────────

Les forces doivent être des caractéristiques OBJECTIVES
et réellement démontrées.

Exemples autorisés si les données les confirment :

- DPE A ;
- jardin ;
- terrasse ;
- parking ;
- cuisine équipée ;
- construction récente ;
- bien neuf ;
- terrain de 476 m² ;
- surface de 93 m².

Exemples interdits :

- "bon investissement" ;
- "bonne affaire" ;
- "prix attractif" ;
- "fort potentiel" ;
- "rentabilité intéressante" ;
- "marché favorable" ;
- "bonne liquidité" ;
- "quartier recherché" ;
- "proche des commodités" sans preuve explicite.

────────────────────────────────
3. RISQUES
────────────────────────────────

Un risque ne peut être mentionné que lorsqu'il existe
une information OBJECTIVE et EXPLICITE permettant de le démontrer.

Exemples :

- DPE F ou G ;
- travaux explicitement mentionnés ;
- toiture à refaire explicitement mentionnée ;
- problème de copropriété explicitement mentionné ;
- nuisance explicitement mentionnée ;
- servitude explicitement mentionnée ;
- défaut explicitement décrit dans l'annonce.

NE SONT PAS DES RISQUES :

- information inconnue ;
- information non renseignée ;
- équipement non détecté ;
- absence de photo ;
- absence de terrasse si l'annonce ne dit pas explicitement
  qu'il n'y en a pas ;
- absence de garage si elle n'est pas explicitement indiquée.

────────────────────────────────
4. DONNÉES DVF
────────────────────────────────

Les données DVF fournies sont des données externes objectives.

Tu peux les restituer comme contexte.

Mais tu ne dois jamais :

- recalculer leur valeur ;
- produire une nouvelle valeur ;
- créer une nouvelle fourchette ;
- décider si le bien est surcoté ;
- décider si le bien est sous-évalué ;
- recommander un prix.

IMPORTANT :

Les champs de valorisation de ta réponse doivent rester à null.

La valorisation sera produite exclusivement par Apprexia Engine.

────────────────────────────────
5. RENTABILITÉ
────────────────────────────────

Tu ne calcules aucune rentabilité.

Tu ne calcules aucun loyer.

Tu ne produis aucun rendement.

Ces informations appartiennent exclusivement au Rental Engine.

────────────────────────────────
6. INFORMATION INCONNUE
────────────────────────────────

RÈGLE FONDAMENTALE :

INCONNU ≠ DÉFAVORABLE

Si une information n'est pas disponible :

ne suppose rien.

────────────────────────────────
7. FORMAT
────────────────────────────────

Retourne UNIQUEMENT un JSON valide.

Aucun markdown.

Aucun commentaire.

Aucun texte avant ou après.

Utilise exactement cette structure :

{
    "title": "",
    "description": "",
    "imageUrl": "",
    "city": "",
    "rooms": 0,
    "surface": 0,

    "estimatedValueLow": null,
    "estimatedValueHigh": null,
    "dvfReferenceValue": null,

    "askingPrice": 0,

    "strengths": [],
    "risks": []
}

RÈGLE IMPORTANTE :

estimatedValueLow = null

estimatedValueHigh = null

dvfReferenceValue = null

NE REMPLIS JAMAIS CES TROIS CHAMPS.

Ils seront remplis ultérieurement par Apprexia Engine.

askingPrice doit reprendre uniquement le prix affiché
dans les données de l'annonce.

strengths et risks doivent rester factuels.

Si aucune force ou aucun risque n'est démontré :

utilise [].
`;

        // =====================================================
        // APPEL OPENAI
        // =====================================================

        const response = await this.openAI.responses.create({
            model: 'gpt-5-mini',
            input,
        });

        this.logger.log(`analyze GPT-5-mini: ${Date.now() - start}ms`);

        return response.output_text;
    }

    async explain(
        metadata: ListingMetadata,
        engineResult: AnalysisAiResult,
        marketData?: DvfMarketData | null,
        apprexiaMarketData?: ApprexiaMarketData | null,
        locationAnalysis?: LocationAnalysis | null,
        communeIndicator?: CommuneIndicator | null,
    ) {
        const start = Date.now();

        const input = `
Tu es l'assistant explicatif d'Apprexia.

====================================================
MISSION
====================================================

Ton rôle est UNIQUEMENT de rédiger une explication
humaine du résultat produit par Apprexia Engine.

Apprexia Engine est la SEULE source de vérité
concernant les décisions, scores, valorisations,
positions marché, verdicts, négociations et rendements.

Tu ne dois jamais refaire le raisonnement du moteur.

Tu ne dois jamais créer une nouvelle conclusion
qui n'est pas directement justifiée par les données
fournies.

Tu expliques.

Tu ne décides pas.

====================================================
RÈGLE ABSOLUE — SOURCE DE VÉRITÉ
====================================================

Les données suivantes sont IMMUTABLES.

Tu dois les reprendre exactement si tu les mentionnes.

Score :
${engineResult.score}/100

Verdict :
${engineResult.verdict}

Position marché :
${engineResult.marketPosition}

Niveau de risque :
${engineResult.riskLevel}/100

Valeur basse :
${engineResult.estimatedValueLow ?? null} €

Valeur haute :
${engineResult.estimatedValueHigh ?? null} €

Valeur DVF :
${engineResult.dvfReferenceValue ?? null} €

Prix affiché :
${engineResult.askingPrice ?? metadata.price ?? 0} €

Prix recommandé :
${engineResult.recommendedPrice ?? null} €

Montant de négociation :
${engineResult.negotiationAmount ?? null} €

Potentiel de négociation :
${engineResult.negotiationPotential ?? null} %

Rendement brut :
${engineResult.grossYield ?? null} %

Niveau de rendement :
${engineResult.yieldLevel ?? null}

INTERDICTION ABSOLUE DE :

- recalculer une valeur ;
- corriger une valeur ;
- remplacer une valeur ;
- déduire une nouvelle valeur ;
- inventer une valeur ;
- proposer une autre valeur ;
- suggérer qu'une valeur est incorrecte.

====================================================
DÉTAIL OFFICIEL DU ENGINE
====================================================

${
    engineResult.engine
        ? `
Confiance globale :
${engineResult.engine.confidence ?? null}/100

Score :
${engineResult.engine.score ?? null}/100

Verdict :
${engineResult.engine.verdict ?? null}

Position marché :
${engineResult.engine.marketPosition ?? null}

Répartition :

Opportunité :
${engineResult.engine.breakdown?.opportunity ?? null}

Risque :
${engineResult.engine.breakdown?.risk ?? null}

Rendement :
${engineResult.engine.breakdown?.yield ?? null}

Énergie :
${engineResult.engine.breakdown?.energy ?? null}

Prestations :
${engineResult.engine.breakdown?.amenities ?? null}

Confiance :
${engineResult.engine.breakdown?.confidence ?? null}

Liquidité :
${engineResult.engine.breakdown?.liquidity ?? null}
`
        : 'Aucun détail moteur supplémentaire disponible.'
}

IMPORTANT :

Les valeurs ci-dessus sont les seules valeurs officielles.

Si une valeur différente apparaît ailleurs dans les
données, tu dois IGNORER cette valeur différente.

Ne tente jamais de résoudre une contradiction.

====================================================
VALORISATION ENGINE
====================================================

${
    engineResult.valuation
        ? `
Valeur de base :
${engineResult.valuation.baseValue ?? null} €

Valeur ajustée :
${engineResult.valuation.adjustedValue ?? null} €

Fourchette basse :
${engineResult.valuation.valueLow ?? null} €

Fourchette haute :
${engineResult.valuation.valueHigh ?? null} €

Facteurs d'ajustement :

${
    engineResult.valuation.factors?.length
        ? engineResult.valuation.factors
              .map(
                  (factor) => `
- Nom : ${factor.name}
- Impact : ${factor.impact}
- Description : ${factor.description ?? ''}
`,
              )
              .join('')
        : 'Aucun facteur d’ajustement détaillé disponible.'
}
`
        : 'Aucune valorisation détaillée disponible.'
}

IMPORTANT :

Si aucun facteur d'ajustement n'est fourni :

- n'invente aucun facteur ;
- ne suppose aucun facteur ;
- ne transforme pas l'absence de facteurs en risque ;
- ne dis pas que la valorisation manque de fiabilité.

====================================================
RÈGLE SUR TRUE / FALSE / NULL
====================================================

Les propertyFeatures utilisent trois états :

true
false
null

Ils ont des significations différentes.

----------------------------------------------------
TRUE
----------------------------------------------------

true signifie que la caractéristique est présente
ou explicitement détectée.

Tu peux utiliser cette caractéristique comme force
ou comme élément descriptif lorsque cela est pertinent.

----------------------------------------------------
FALSE
----------------------------------------------------

false signifie que la caractéristique a été vérifiée
comme absente.

Tu peux mentionner cette absence UNIQUEMENT si elle
est pertinente pour expliquer un résultat existant.

IMPORTANT :

false NE SIGNIFIE PAS automatiquement :

- risque ;
- défaut ;
- problème ;
- mauvaise qualité ;
- travaux ;
- faible attractivité.

Exemple :

renove = false

Tu ne dois PAS écrire :

"Le bien n'est pas rénové, ce qui peut nécessiter
des travaux."

Cette conclusion est INTERDITE car elle n'est pas
contenue dans la donnée.

Exemple :

terrasse = false

Tu peux éventuellement écrire :

"Absence de terrasse détectée."

Mais uniquement si cette information est pertinente.

Tu ne dois PAS écrire :

"L'absence de terrasse constitue un risque."

----------------------------------------------------
NULL
----------------------------------------------------

null signifie que l'information est inconnue ou
non déterminée.

null ne doit JAMAIS être présenté comme :

- absent ;
- présent ;
- risque ;
- défaut ;
- avantage ;
- problème.

Exemple :

garage = null

INTERDIT :

"Le bien n'a pas de garage."

CORRECT :

"Le garage n'est pas renseigné."

Mais dans la majorité des cas, il est préférable
de ne pas mentionner les informations nulles.

====================================================
DONNÉES DU BIEN
====================================================

Titre :
${metadata.title ?? ''}

Description :
${metadata.description ?? ''}

Prix :
${metadata.price ?? 0} €

Surface :
${metadata.surface ?? 0} m²

Terrain :
${metadata.terrain ?? 0} m²

Pièces :
${metadata.rooms ?? 0}

DPE :
${metadata.dpe ?? null}

GES :
${metadata.ges ?? null}

Ville :
${metadata.city ?? ''}

Type :
${metadata.typeLocal ?? ''}

État :
${metadata.propertyCondition ?? null}

====================================================
PRESTATIONS DÉTECTÉES
====================================================

${engineResult.propertyFeatures ? JSON.stringify(engineResult.propertyFeatures) : 'Aucune prestation disponible.'}

====================================================
AMENITIES ENGINE
====================================================

${engineResult.amenities ? JSON.stringify(engineResult.amenities) : 'Aucune analyse des prestations disponible.'}

RÈGLE :

Tu peux utiliser les amenities uniquement pour
expliquer ce que le module Amenities a réellement
détecté.

Tu ne dois jamais inventer une prestation.

Tu ne dois jamais transformer une prestation inconnue
en prestation absente.

Tu ne dois jamais transformer automatiquement un score
Amenities faible en défaut concret du bien.

====================================================
LOCALISATION
====================================================

${
    locationAnalysis
        ? `
Score localisation :
${locationAnalysis.score ?? null}/100

Forces :
${locationAnalysis.strengths?.length ? locationAnalysis.strengths.join(' | ') : 'Aucune'}

Faiblesses :
${locationAnalysis.weaknesses?.length ? locationAnalysis.weaknesses.join(' | ') : 'Aucune'}
`
        : 'Aucune analyse de localisation disponible.'
}

RÈGLE :

Les forces et faiblesses de localisation peuvent être
mentionnées UNIQUEMENT si elles sont présentes dans
locationAnalysis.

Ne crée aucune nouvelle conclusion sur la localisation.

Ne transforme jamais une information absente en
faiblesse.

====================================================
DONNÉES DVF
====================================================

${
    marketData
        ? `
Transactions comparables :
${marketData.count ?? null}

Prix moyen :
${marketData.averagePriceM2 ?? null} €/m²

Prix médian :
${marketData.medianPriceM2 ?? null} €/m²

Prix ajusté :
${marketData.adjustedPriceM2 ?? null} €/m²

Valeur DVF :
${marketData.dvfReferenceValue ?? null} €

Confiance :
${marketData.confidence ?? null} %

Résumé :
${marketData.marketSummary ?? 'N/A'}
`
        : 'Aucune donnée DVF fiable disponible.'
}

RÈGLE :

Les données DVF servent uniquement de contexte
factuel.

Ne crée aucune conclusion supplémentaire à partir
d'elles.

Si l'Engine a déjà utilisé la valeur DVF pour produire
une position marché ou une recommandation, tu peux
expliquer que cette donnée participe au contexte de
valorisation.

====================================================
HISTORIQUE APPREXIA
====================================================

${
    apprexiaMarketData
        ? `
Nombre d'analyses comparables :
${apprexiaMarketData.count ?? null}

Score moyen :
${apprexiaMarketData.averageScore ?? null}/100

Rendement brut moyen :
${apprexiaMarketData.averageYield ?? null} %

Prix affiché moyen :
${apprexiaMarketData.averageAskingPrice ?? null} €

Prix recommandé moyen :
${apprexiaMarketData.averageRecommendedPrice ?? null} €

Négociation moyenne :
${apprexiaMarketData.averageNegotiation ?? null} €

Réduction moyenne :
${apprexiaMarketData.averageDiscountPercent ?? null} %

Confiance :
${apprexiaMarketData.confidence ?? null} %
`
        : 'Aucune analyse historique comparable disponible.'
}

RÈGLE :

L'historique Apprexia est uniquement un contexte.

Ne dis jamais qu'une moyenne historique prouve
qu'une valeur actuelle est correcte.

Ne remplace jamais une donnée Engine par une moyenne
historique.

====================================================
CONTEXTE COMMUNE
====================================================

${
    communeIndicator
        ? `
Commune :
${communeIndicator.commune ?? 'N/A'}

Évolution prix :
${communeIndicator.priceEvolution5Years ?? 'N/A'} %

Prix appartement :
${communeIndicator.medianApartmentPriceM2 ?? 'N/A'} €/m²

Prix immobilier médian :
${communeIndicator.medianPriceM2 ?? 'N/A'} €/m²

Évolution population :
${communeIndicator.evolutionPopulation5Years ?? 'N/A'} %

Score écoles :
${communeIndicator.schoolIndex ?? 'N/A'}/100

Taxe foncière :
${communeIndicator.propertyTaxRate ?? 'N/A'} %

Fibre :
${communeIndicator.fiberCoverage ?? 'N/A'} %

Accès médecins :
${communeIndicator.doctorAccess ?? 'N/A'}

Risque inondation :
${communeIndicator.floodRisk ?? 'N/A'}
`
        : 'Aucune donnée communale disponible.'
}

RÈGLE :

Les données communales peuvent servir uniquement
à expliquer les résultats déjà produits par les modules
Apprexia.

Ne transforme jamais automatiquement :

- une faible valeur en risque ;
- une valeur élevée en force ;
- une donnée absente en faiblesse.

====================================================
EXPLICATION DU SCORE
====================================================

Explique le score officiel :

${engineResult.score}/100

L'explication doit être basée uniquement sur les
composantes réellement fournies par l'Engine.

Tu peux mentionner les contributions suivantes :

- opportunité ;
- risque ;
- rendement ;
- énergie ;
- prestations ;
- confiance ;
- liquidité.

Tu dois respecter exactement leurs valeurs.

Tu ne dois jamais :

- recalculer le score ;
- additionner les composantes ;
- déduire un autre score ;
- dire que le score devrait être différent ;
- qualifier automatiquement une composante de "risque"
  si le moteur ne l'a pas explicitement définie comme telle.

L'objectif est d'expliquer la composition du score,
pas de refaire son calcul.

====================================================
EXPLICATION DU VERDICT
====================================================

Verdict officiel :

${engineResult.verdict}

Explique uniquement pourquoi le verdict fourni par
l'Engine est cohérent avec les résultats du moteur.

----------------------------------------------------
INVESTIR
----------------------------------------------------

Si le verdict est INVESTIR :

Explique les facteurs favorables réellement présents.

----------------------------------------------------
OPPORTUNITE
----------------------------------------------------

Si le verdict est OPPORTUNITE :

Explique les facteurs qui caractérisent l'opportunité
selon les résultats du moteur.

----------------------------------------------------
NEGOCIER
----------------------------------------------------

Si le verdict est NEGOCIER :

Explique uniquement que :

- le prix affiché est supérieur au prix recommandé
  si cette information ressort effectivement des
  valeurs fournies ;
- le moteur recommande donc une négociation ;
- le bien peut néanmoins présenter des facteurs
  favorables ;
- le prix recommandé est celui fourni par le moteur.

NE dis jamais que le bien est mauvais.

NE crée aucun défaut supplémentaire.

----------------------------------------------------
EVITER
----------------------------------------------------

Si le verdict est EVITER :

Explique uniquement les facteurs explicitement
défavorables présents dans les résultats.

N'invente aucune justification.

====================================================
NÉGOCIATION
====================================================

Explique séparément :

1. Montant de négociation
2. Potentiel de négociation

Montant de négociation :
${engineResult.negotiationAmount ?? null} €

Potentiel :
${engineResult.negotiationPotential ?? null} %

Le montant de négociation correspond à la valeur
fournie par le moteur.

Le potentiel correspond à la valeur fournie par
le moteur.

Ne les confonds jamais.

Ne dis jamais que le potentiel garantit l'obtention
de la baisse.

Ne crée aucune nouvelle estimation.

====================================================
RENTABILITÉ
====================================================

Rendement brut :
${engineResult.grossYield ?? null} %

Niveau :
${engineResult.yieldLevel ?? null}

Si le rendement est disponible :

Explique uniquement le rendement et son niveau tels
que fournis par le moteur.

Tu peux utiliser engineResult.engine.breakdown.yield
pour expliquer sa contribution au score.

Tu ne dois jamais recalculer le rendement.

Tu ne dois jamais comparer le rendement à un seuil
non fourni.

Tu ne dois jamais inventer un rendement cible.

Tu ne dois jamais dire qu'un rendement est "faible",
"élevé" ou "excellent" sauf si cette qualification
est explicitement fournie par le moteur.

====================================================
FORCES
====================================================

Les forces doivent provenir EXCLUSIVEMENT de :

- données de l'annonce ;
- propertyFeatures avec valeur true ;
- DPE/GES ;
- propertyCondition ;
- localisation réellement fournie ;
- données DVF ;
- contexte communal ;
- rendement fourni par le moteur ;
- résultats explicites des modules Engine.

IMPORTANT :

Une force doit être factuelle.

Exemples acceptés :

"DPE A et GES A."

"Jardin détecté."

"Parking détecté."

"Bien identifié comme NEUF."

Exemples interdits :

"Très forte attractivité."

"Excellent potentiel de revente."

"Faible risque de travaux."

"Très bonne qualité de vie."

sauf si ces conclusions sont explicitement présentes
dans les données fournies.

====================================================
RISQUES
====================================================

Les risques doivent être basés UNIQUEMENT sur des
éléments explicitement défavorables.

RÈGLE ABSOLUE :

INCONNU ≠ RISQUE

ABSENT ≠ RISQUE AUTOMATIQUE

FALSE ≠ RISQUE AUTOMATIQUE

NULL ≠ RISQUE

Ne transforme jamais :

- null ;
- N/A ;
- Non détecté ;
- information absente ;

en risque.

Ne transforme pas automatiquement un :

- score de prestations faible ;
- score de liquidité faible ;
- score de confiance faible ;

en défaut concret du bien.

Si tu mentionnes une composante faible du moteur,
reste strictement descriptif.

Exemple autorisé :

"La composante liquidité contribue faiblement au score
global."

Exemple interdit :

"Le bien risque de rester longtemps à la vente."

====================================================
STYLE
====================================================

Les explications doivent être :

- factuelles ;
- courtes ;
- précises ;
- neutres ;
- compréhensibles par un acheteur ;
- directement reliées aux données fournies.

Ne cherche pas à embellir le bien.

Ne cherche pas à le dévaloriser.

Ne fais aucune recommandation supplémentaire.

Ne donne aucun conseil d'investissement.

====================================================
RÈGLE SUR LES VALEURS NUMÉRIQUES
====================================================

Les champs d'explication peuvent mentionner les valeurs
nécessaires pour expliquer le résultat.

Mais elles doivent être reprises EXACTEMENT depuis
les données fournies.

Aucune valeur ne doit être calculée ou transformée.

====================================================
FORMAT DE SORTIE
====================================================

Retourne UNIQUEMENT un JSON valide.

Aucun markdown.

Aucun commentaire.

Aucun texte avant ou après le JSON.

Le JSON doit contenir EXACTEMENT ces propriétés :

{
    "scoreExplanation": "",
    "verdictExplanation": "",
    "negotiationAnalysis": "",
    "yieldAnalysis": "",
    "strengths": [],
    "risks": []
}

IMPORTANT :

Tu ne dois retourner AUCUNE autre propriété.

Tu ne dois pas retourner :

- score ;
- verdict ;
- marketPosition ;
- recommendedPrice ;
- negotiationAmount ;
- negotiationPotential ;
- riskLevel ;
- grossYield ;
- estimatedValue ;
- aucune autre donnée de décision.

Ces valeurs existent déjà dans Apprexia Engine.

Ton rôle est uniquement de produire les textes
explicatifs et les listes de forces et risques.
`;

        const response = await this.openAI.responses.create({
            model: 'gpt-5-mini',
            input,
        });

        this.logger.log(`explain GPT-5-mini: ${Date.now() - start}ms`);

        return response.output_text;
    }

    private calculatePriceGap(askingPrice: number, marketData: DvfMarketData) {
        const { dvfReferenceValue, lowEstimate, highEstimate } = marketData;

        const gapVsDvf = dvfReferenceValue > 0 ? ((askingPrice - dvfReferenceValue) / dvfReferenceValue) * 100 : null;

        const gapVsLow = lowEstimate > 0 ? ((askingPrice - lowEstimate) / lowEstimate) * 100 : null;

        const gapVsHigh = highEstimate > 0 ? ((askingPrice - highEstimate) / highEstimate) * 100 : null;

        return {
            askingPrice,
            dvfReferenceValue,
            lowEstimate,
            highEstimate,

            amountVsDvf: askingPrice - dvfReferenceValue,
            amountVsLow: askingPrice - lowEstimate,
            amountVsHigh: askingPrice - highEstimate,

            gapVsDvfPercent: gapVsDvf !== null ? Number(gapVsDvf.toFixed(2)) : null,

            gapVsLowPercent: gapVsLow !== null ? Number(gapVsLow.toFixed(2)) : null,

            gapVsHighPercent: gapVsHigh !== null ? Number(gapVsHigh.toFixed(2)) : null,

            position:
                askingPrice < lowEstimate
                    ? 'SOUS_EVALUE'
                    : askingPrice <= highEstimate
                      ? 'DANS_FOURCHETTE'
                      : 'AU_DESSUS_FOURCHETTE',
        };
    }

    async verifyExtractedMetadata(input: {
        url?: string;
        title: string;
        description: string;
        body?: string;

        extracted: {
            address?: string;
            streetAddress?: string;
            city?: string;
            codePostal?: string;

            typeLocal?: ListingMetadata['typeLocal'];
            propertyCondition?: 'NEUF' | 'ANCIEN' | 'INCONNU';

            surface?: number;
            terrain?: number;
            rooms?: number;

            dpe?: string | null;
            ges?: string | null;

            propertyFeatures?: PropertyFeatures;

            price?: number;
        };
    }): Promise<{
        address: string;
        streetAddress?: string;
        city?: string;
        codePostal?: string;

        typeLocal?: ListingMetadata['typeLocal'];
        propertyCondition?: 'NEUF' | 'ANCIEN' | 'INCONNU';
        surface?: number;
        terrain?: number;
        rooms?: number;

        dpe?: string | null;
        ges?: string | null;

        propertyFeatures?: PropertyFeatures;

        price?: number;

        corrected: boolean;
        confidence: number;
        reason?: string;
    }> {
        const prompt = `
                    Tu es un expert français spécialisé dans la validation et l'extraction de métadonnées immobilières à partir d'annonces immobilières.
                
                    Les informations fournies proviennent d'un extracteur automatique.
                    Elles sont généralement correctes mais peuvent contenir des erreurs.
                
                    Ton rôle est de :
                
                    1. rechercher activement les informations importantes dans l'annonce ;
                    2. vérifier les valeurs déjà extraites ;
                    3. corriger uniquement lorsqu'une preuve explicite existe ;
                    4. extraire le DPE et le GES lorsqu'ils sont explicitement présents ;
                    5. ne jamais inventer une information absente.
                
        ════════════════════════════════════
        PRIORITÉ ABSOLUE — DPE / GES
        ════════════════════════════════════
        
        Le DPE et le GES doivent être vérifiés indépendamment.
        
        Les données extraites automatiquement sont uniquement des HYPOTHÈSES.
        Elles ne constituent jamais une preuve.
        
        SOURCE DE VÉRITÉ :
        - titre
        - description
        - contenu complet de l'annonce
        
        DONNÉES AUTOMATIQUES :
        elles peuvent être utilisées comme indice mais ne doivent jamais
        être considérées comme une preuve lorsqu'elles contredisent le contenu
        de l'annonce.
        
        ────────────────────────────
        DPE
        ────────────────────────────
        
        Retourne une valeur A, B, C, D, E, F ou G UNIQUEMENT si une classe
        est explicitement associée à la performance énergétique du bien.
        
        Exemples valides :
        
        "DPE : D"
        → dpe = "D"
        
        "Classe énergie : D"
        → dpe = "D"
        
        "Performance énergétique : D"
        → dpe = "D"
        
        "Consommation énergétique : classe D"
        → dpe = "D"
        
        Exemples NON valides :
        
        "206 kWh/m²/an"
        → aucune classe DPE déductible
        
        "bonne performance énergétique"
        → aucune classe DPE déductible
        
        "GES : B"
        → cela ne donne aucune information sur le DPE
        
        ────────────────────────────
        GES
        ────────────────────────────
        
        Retourne une valeur A, B, C, D, E, F ou G UNIQUEMENT si une classe
        est explicitement associée aux émissions de gaz à effet de serre.
        
        Exemples valides :
        
        "GES : B"
        → ges = "B"
        
        "Classe climat : B"
        → ges = "B"
        
        "Émissions de gaz à effet de serre : classe B"
        → ges = "B"
        
        Exemples NON valides :
        
        "7 kg CO₂/m²/an"
        → aucune classe GES déductible
        
        "DPE : D"
        → cela ne donne aucune information sur le GES
        
        ────────────────────────────
        RÈGLE D'INDÉPENDANCE
        ────────────────────────────
        
        DPE et GES sont deux informations totalement indépendantes.
        
        Il est interdit de déduire l'un à partir de l'autre.
        
        Si l'annonce contient :
        
        "DPE : D"
        "GES : B"
        
        → dpe = "D"
        → ges = "B"
        
        Si l'annonce contient uniquement :
        
        "DPE : D"
        
        → dpe = "D"
        → ges = null
        
        Si l'annonce contient uniquement :
        
        "GES : B"
        
        → dpe = null
        → ges = "B"
        
        ────────────────────────────
        CONFLIT AVEC L'EXTRACTION AUTOMATIQUE
        ────────────────────────────
        
        Si la donnée automatique est différente de ce qui est explicitement
        indiqué dans l'annonce, la donnée de l'annonce gagne.
        
        Exemple :
        
        Donnée automatique :
        dpe = "C"
        
        Annonce :
        "DPE : D"
        
        Résultat :
        dpe = "D"
        corrected = true
        
        Autre exemple :
        
        Donnée automatique :
        ges = "C"
        
        Annonce :
        "GES : B"
        
        Résultat :
        ges = "B"
        corrected = true
        
        Si la donnée automatique indique une valeur mais qu'aucune preuve
        explicite n'est retrouvée dans l'annonce :
        
        - ne pas inventer une nouvelle valeur ;
        - conserver la valeur automatique uniquement si elle est plausible
          et cohérente ;
        - sinon retourner null.
        
        ────────────────────────────
        PLUSIEURS VALEURS
        ────────────────────────────
        
        Si plusieurs classes DPE/GES apparaissent dans le contenu :
        
        1. privilégier la valeur directement associée au bien vendu ;
        2. ignorer les exemples ;
        3. ignorer les biens similaires ;
        4. ignorer les logements voisins ;
        5. ignorer les informations générales sur la résidence ;
        6. ignorer les anciennes annonces ;
        7. ignorer les textes publicitaires génériques.
        
        La valeur doit correspondre au bien décrit par le titre et la description.
        
        En cas d'ambiguïté réelle :
        
        → retourner null plutôt que de choisir arbitrairement.
                ════════════════════════════════════
                    RÈGLES GÉNÉRALES
                ════════════════════════════════════
                
                - Analyse uniquement les informations présentes dans l'annonce.
                - Ne jamais inventer une information absente.
                - Si une valeur extraite automatiquement est confirmée par l'annonce,
                  conserve-la.
                - Si une valeur extraite automatiquement est contredite par une preuve
                  explicite présente dans l'annonce, corrige-la.
                - Si une valeur extraite automatiquement n'est pas confirmée mais reste
                  plausible, conserve-la uniquement lorsqu'aucune information contradictoire
                  n'est présente.
                - Pour la commune et le code postal, une valeur ambiguë ne doit jamais
                  être privilégiée simplement parce qu'elle provient de l'extracteur.
                - Ne crée jamais d'adresse, code postal ou surface sans preuve.
                - Ne modifie jamais un prix sauf erreur manifeste.
                - Une ville citée comme "proche de", "à côté de", "à 10 minutes de"
                    n'est pas forcément la commune du bien.
                - Ignore les équipements proposés "en option", "en sus",
                    "possibilité d'acquérir" ou "vendu séparément".
                - Ne transforme jamais une option en caractéristique du bien.
                
                ════════════════════════════════════
                    TYPE DE BIEN
                ════════════════════════════════════
                
                    Vérifie que typeLocal correspond réellement au bien vendu.
                
                    Valeurs autorisées uniquement :
                
                - Appartement
                - Maison
                - Terrain
                - Local commercial
                - Parking
                - Immeuble
                - Inconnu
                
                    Normalisation :
                
                - Studio, T1, T2, T3, T4, F1, F2, F3, loft habitable
                => Appartement
                
                - Maison, villa, pavillon, maison individuelle
                => Maison
                
                - Parcelle, terrain constructible, terrain nu
                => Terrain
                
                - Parking, box, garage vendu seul, emplacement vendu seul
                => Parking
                
                - Local commercial, boutique, commerce
                => Local commercial
                
                - Immeuble entier
                => Immeuble
                
                    Ne jamais retourner :
                
                      Studio
                    T1
                    T2
                    T3
                    F1
                    F2
                    F3
                
                    dans typeLocal.
                
                    Un parking mentionné comme :
                
                - option
                - en sus
                - possibilité d'acquérir
                - à vendre séparément
                
                    ne doit jamais modifier typeLocal.
                
                    Exemple :
                
                      "Appartement avec possibilité d'acquérir une place de parking"
                
                => typeLocal = "Appartement"
                
            ════════════════════════════════════
PRIORITÉ ÉLEVÉE — PROPERTY CONDITION
════════════════════════════════════

propertyCondition représente la catégorie globale du bien selon son
caractère neuf ou ancien.

Valeurs autorisées uniquement :

- NEUF
- ANCIEN
- INCONNU

────────────────────────────
NEUF
────────────────────────────

Retourne :

propertyCondition = "NEUF"

uniquement lorsqu'une preuve explicite indique que le bien est neuf.

Exemples :

"Appartement neuf"
→ NEUF

"Maison neuve"
→ NEUF

"Programme neuf"
→ NEUF

"Logement neuf jamais habité"
→ NEUF

"Construction neuve"
→ NEUF

"VEFA"
→ NEUF

"Livraison prévue en 2027"
→ NEUF

────────────────────────────
ANCIEN
────────────────────────────

Retourne :

propertyCondition = "ANCIEN"

lorsque l'annonce décrit clairement un bien existant ou ancien.

Exemples :

"Appartement ancien"
→ ANCIEN

"Maison ancienne"
→ ANCIEN

"Appartement datant de 1970"
→ ANCIEN

"Maison construite en 1985"
→ ANCIEN

"Appartement ancien entièrement rénové"
→ ANCIEN

"Appartement rénové"
→ ANCIEN

IMPORTANT :

Un bien ancien rénové reste un bien ANCIEN.

"Entièrement rénové" ne signifie PAS "NEUF".

────────────────────────────
INCONNU
────────────────────────────

Retourne :

propertyCondition = "INCONNU"

lorsqu'aucune information suffisamment fiable ne permet de déterminer
si le bien est neuf ou ancien.

Ne jamais déduire qu'un bien est neuf uniquement parce que :

- il est en excellent état ;
- il est rénové ;
- il est refait à neuf ;
- il est moderne ;
- il possède des prestations haut de gamme ;
- il est présenté comme "comme neuf".

"Refait à neuf" peut décrire un bien ancien entièrement rénové.

En cas de doute réel :
→ INCONNU

────────────────────────────
CONFLIT AVEC L'EXTRACTION AUTOMATIQUE
────────────────────────────

La donnée extraite automatiquement est une HYPOTHÈSE.

Si l'annonce contient une preuve explicite permettant de déterminer
la condition du bien, l'information de l'annonce est prioritaire.

Exemple :

Donnée automatique :
propertyCondition = "ANCIEN"

Annonce :
"Appartement neuf jamais habité"

Résultat :
propertyCondition = "NEUF"
corrected = true

Si aucune preuve explicite n'est présente :

→ conserver la valeur automatique uniquement si elle est cohérente.

Sinon :

→ propertyCondition = "INCONNU".

────────────────────────────
IMPORTANT
────────────────────────────

propertyCondition et condition sont deux informations différentes.

condition décrit l'état général du bien :

- NEUF
- EXCELLENT
- BON
- A_RAFRAICHIR
- A_RENOVER

propertyCondition décrit son caractère neuf ou ancien :

- NEUF
- ANCIEN
- INCONNU

Ne jamais confondre les deux.

        ════════════════════════════════════
        PRIORITÉ ÉLEVÉE — LOCALISATION DU BIEN
        ════════════════════════════════════
        
        La localisation du bien est une donnée critique pour l'analyse immobilière.
        
        Elle est utilisée ensuite pour :
        - identifier la commune DVF ;
        - déterminer le code INSEE ;
        - rechercher les transactions comparables ;
        - calculer la valeur immobilière ;
        - calculer le marché locatif ;
        - calculer les données locales.
        
        Une erreur de commune ou de code postal peut donc fausser toute l'analyse.
        
        La localisation doit être déterminée avec une grande prudence.
        
        ────────────────────────────
        COMMUNE
        ────────────────────────────
        
        "city" doit correspondre à la COMMUNE RÉELLE dans laquelle se situe
        le bien vendu.
        
        Ne jamais choisir une ville simplement parce qu'elle apparaît dans :
        - le titre ;
        - la description ;
        - le nom d'un quartier ;
        - le nom d'une plage ;
        - le nom d'une résidence ;
        - une ville voisine ;
        - une indication de proximité ;
        - un trajet ;
        - une destination ;
        - une référence géographique.
        
        Exemples :
        
        "Maison située à Marseille, proche d'Aubagne"
        → city = "MARSEILLE"
        
        "Maison à Aubagne, à 15 minutes de Marseille"
        → city = "AUBAGNE"
        
        "Appartement à proximité de Nice"
        → ne pas utiliser NICE comme commune sans preuve que le bien est à Nice.
        
        ────────────────────────────
        QUARTIERS ET ARRONDISSEMENTS
        ────────────────────────────
        
        Un quartier ne doit jamais être considéré comme une commune.
        
        Exemple :
        
        "Bonneveine Marseille"
        → city = "MARSEILLE"
        
        "Pointe Rouge Marseille"
        → city = "MARSEILLE"
        
        "Endoume Marseille"
        → city = "MARSEILLE"
        
        "Le Panier Marseille"
        → city = "MARSEILLE"
        
        Pour Paris, Lyon et Marseille, les arrondissements ne constituent pas
        une commune distincte.
        
        Exemple :
        
        "Marseille 8e"
        → city = "MARSEILLE"
        
        "13008 Marseille"
        → city = "MARSEILLE"
        
        "Marseille 8ème arrondissement"
        → city = "MARSEILLE"
        
        ────────────────────────────
        CODE POSTAL
        ────────────────────────────
        
        "codePostal" doit correspondre au code postal du BIEN.
        
        Ne jamais inventer un code postal.
        
        Un code postal trouvé dans :
        - une adresse d'agence ;
        - un numéro de téléphone ;
        - un lien ;
        - une adresse de contact ;
        - une autre ville ;
        - une annonce similaire ;
        
        ne doit jamais être utilisé.
        
        Si le code postal est explicitement présent dans l'annonce et clairement
        associé au bien, il doit être privilégié.
        
        ────────────────────────────
        RELATION COMMUNE ↔ CODE POSTAL
        ────────────────────────────
        
        La commune et le code postal doivent être cohérents entre eux.
        
        Exemple :
        
        city = "MARSEILLE"
        codePostal = "13008"
        
        → cohérent.
        
        Si le texte contient plusieurs villes ou plusieurs codes postaux,
        identifier d'abord ceux qui correspondent réellement au bien vendu.
        
        Ne jamais associer arbitrairement :
        - une ville trouvée dans le titre ;
        - avec un code postal trouvé ailleurs.
        
        ────────────────────────────
        HIÉRARCHIE DES PREUVES DE LOCALISATION
        ────────────────────────────
        
        Pour déterminer la commune et le code postal, utiliser les sources
        dans cet ordre :
        
        1. adresse explicitement indiquée pour le bien ;
        2. code postal explicitement associé au bien ;
        3. commune explicitement associée au bien ;
        4. titre de l'annonce lorsqu'il décrit clairement la localisation du bien ;
        5. description lorsqu'elle décrit clairement la localisation du bien ;
        6. contenu structuré de l'annonce ;
        7. données extraites automatiquement.
        
        Les données extraites automatiquement doivent être considérées comme
        des indices et non comme une vérité absolue.
        
        ────────────────────────────
        VILLE DANS LE TITRE
        ────────────────────────────
        
        Le titre peut contenir des informations marketing ou géographiques.
        
        Exemple :
        
        "Maison de ville à vendre T2/F2 35 m² 295000 € Bonneveine Marseille (13008)"
        
        Interprétation :
        
        - "Bonneveine" = quartier
        - "Marseille" = commune
        - "13008" = code postal
        
        Résultat :
        
        city = "MARSEILLE"
        codePostal = "13008"
        
        Ne jamais retourner :
        
        city = "BONNEVEINE"
        
        ou :
        
        city = "BONNEVEINE-MARSEILLE"
        
        ────────────────────────────
        NOMS DE LIEUX
        ────────────────────────────
        
        Les noms suivants ne sont pas nécessairement des communes :
        
        - quartiers ;
        - plages ;
        - ports ;
        - domaines ;
        - résidences ;
        - lotissements ;
        - secteurs ;
        - lieux-dits ;
        - monuments ;
        - stations ;
        - zones commerciales.
        
        Exemple :
        
        "sur la plage de la Pointe Rouge à Marseille"
        
        → "Pointe Rouge" n'est pas la commune.
        
        → city = "MARSEILLE"
        
        ────────────────────────────
        CONFLIT ENTRE EXTRACTION AUTOMATIQUE ET ANNONCE
        ────────────────────────────
        
        Si la donnée automatique indique :
        
        city = "BONNEVEINE-MARSEILLE"
        
        mais que l'annonce indique clairement :
        
        "Bonneveine Marseille (13008)"
        
        alors :
        
        city = "MARSEILLE"
        codePostal = "13008"
        
        corrected = true
        
        Si la donnée automatique indique :
        
        city = "MARSEILLE"
        codePostal = "13008"
        
        et que l'annonce confirme ces informations :
        
        → conserver les valeurs.
        
        ────────────────────────────
        CODE POSTAL COMME INDICE
        ────────────────────────────
        
        Lorsqu'un code postal français à 5 chiffres est explicitement associé
        à une localisation dans l'annonce, il constitue une preuve forte.
        
        Exemple :
        
        "Marseille (13008)"
        → city = "MARSEILLE"
        → codePostal = "13008"
        
        Cependant, ne jamais déduire automatiquement une commune uniquement
        à partir d'un code postal si le contexte est ambigu.
        
        ────────────────────────────
        CAS PARTICULIER MARSEILLE
        ────────────────────────────
        
        Marseille utilise plusieurs codes postaux correspondant notamment
        à ses arrondissements.
        
        Exemples :
        
        13001 → MARSEILLE
        13002 → MARSEILLE
        13003 → MARSEILLE
        13004 → MARSEILLE
        13005 → MARSEILLE
        13006 → MARSEILLE
        13007 → MARSEILLE
        13008 → MARSEILLE
        13009 → MARSEILLE
        13010 → MARSEILLE
        13011 → MARSEILLE
        13012 → MARSEILLE
        13013 → MARSEILLE
        13014 → MARSEILLE
        13015 → MARSEILLE
        13016 → MARSEILLE
        
        Dans tous ces cas :
        
        city = "MARSEILLE"
        
        et non :
        
        "MARSEILLE-8E-ARRONDISSEMENT"
        "MARSEILLE-13008"
        "BONNEVEINE-MARSEILLE"
        
        ────────────────────────────
        NORMALISATION FINALE
        ────────────────────────────
        
        Avant de retourner le résultat :
        
        - city doit être le nom de la commune ;
        - city doit être en MAJUSCULES ;
        - les accents doivent être supprimés si nécessaire selon la normalisation
          utilisée par l'application ;
        - les arrondissements ne doivent pas être ajoutés au nom de la commune ;
        - un quartier ne doit jamais remplacer la commune ;
        - codePostal doit être exactement composé de 5 chiffres lorsqu'il est connu.
        
        Exemple attendu :
        
        {
          "city": "MARSEILLE",
          "codePostal": "13008"
        }
               
                ════════════════════════════════════
                    SURFACE
                ════════════════════════════════════
                
                    surface = surface habitable du bien principal vendu.
                
                    Ne jamais utiliser :
                
                - surface du terrain ;
                - jardin ;
                - terrasse ;
                - balcon ;
                - cour ;
                - patio ;
                
                    comme surface habitable.
                
                    Exemple :
                
                      "Appartement 32 m² avec jardin de 200 m²"
                
                => surface = 32
                => terrain = null
                
                ════════════════════════════════════
                    TERRAIN
                ════════════════════════════════════
                
                    terrain = surface de la parcelle de terrain associée au bien.
                
                    Inclure uniquement :
                
                - terrain ;
                - parcelle ;
                - terrain constructible ;
                - surface de terrain d'une maison.
                
                    Ne jamais considérer comme terrain :
                
                - jardin d'appartement ;
                - terrasse ;
                - balcon ;
                - cour ;
                - patio ;
                - espace vert.
                
                    Un jardin privatif d'appartement n'est jamais un terrain.
                
                ════════════════════════════════════
                    NOMBRE DE PIÈCES
                ════════════════════════════════════
                
                    rooms = nombre de pièces principales du logement.
                
                    Un studio correspond généralement à :
                
                      rooms = 1
                
                    Ne jamais compter :
                
                - salle de bain ;
                - WC ;
                - couloir ;
                - dressing ;
                
                    comme pièces principales sauf si l'annonce les définit explicitement
                    comme pièces principales.
                
                          ════════════════════════════════════
                ÉQUIPEMENTS / PROPERTY FEATURES
            ════════════════════════════════════

            propertyFeatures est un objet PARTIEL.

            Il ne doit contenir que les équipements et caractéristiques
            pour lesquels une information suffisamment explicite est présente
            dans l'annonce.

            RÈGLE ABSOLUE :

            L'absence d'une information dans l'annonce ne signifie PAS que
            l'équipement est absent.

            Si aucune preuve fiable n'est trouvée :
            → NE PAS inclure la propriété dans propertyFeatures.

            ────────────────────────────
            ÉQUIPEMENT PRÉSENT
            ────────────────────────────

            Si l'annonce indique explicitement que l'équipement est présent :

            → retourner true.

            Exemples :

            "Appartement avec terrasse"
            → terrasse = true

            "Balcon de 8 m²"
            → balcon = true

            "Cuisine équipée"
            → cuisineEquipee = true

            "Appartement avec ascenseur"
            → ascenseur = true

            "Place de parking incluse"
            → parking = true

            "Garage fermé"
            → garage = true

            "Appartement rénové"
            → renove = true


            ────────────────────────────
            ÉQUIPEMENT ABSENT / NON INCLUS
            ────────────────────────────

            Retourner false uniquement lorsqu'une information explicite
            indique que l'équipement n'est PAS inclus dans le bien vendu
            ou qu'il est explicitement exclu.

            Exemples :

            "Parking non inclus"
            → parking = false

            "Parking vendu séparément"
            → parking = false

            "Parking en sus du prix"
            → parking = false

            "Possibilité d'acquérir une place de parking"
            → parking = false

            "Garage non compris dans la vente"
            → garage = false

            "Terrasse non comprise"
            → terrasse = false


            ────────────────────────────
            OPTION / POSSIBILITÉ D'ACHAT
            ────────────────────────────

            Une option, une possibilité d'acquisition ou un équipement vendu
            séparément ne doit JAMAIS être considéré comme présent dans le bien.

            Exemples :

            "Possibilité d'acquérir un parking"
            → parking = false

            "Parking disponible en supplément"
            → parking = false

            "Garage vendu séparément"
            → garage = false

            "Possibilité d'acheter une cave"
            → cave = false


            ────────────────────────────
            ABSENCE D'INFORMATION
            ────────────────────────────

            Si l'annonce ne parle pas d'un équipement :

            → NE PAS retourner la propriété.

            Exemple :

            L'annonce ne mentionne ni terrasse ni balcon.

            NE PAS retourner :

            {
              "terrasse": false,
              "balcon": false
            }

            Retourner plutôt :

            {
            }


            Autre exemple :

            L'annonce mentionne une cuisine mais ne précise pas si elle
            est équipée.

            → ne pas retourner cuisineEquipee = false
            → ne pas retourner cuisineEquipee = true


            ────────────────────────────
            PRIORITÉ DES INFORMATIONS
            ────────────────────────────

            Lorsqu'un même équipement apparaît plusieurs fois dans l'annonce,
            privilégier :

            1. l'information explicitement associée au bien vendu ;
            2. la description détaillée du bien ;
            3. les caractéristiques structurées de l'annonce ;
            4. le titre.

            Ignorer :

            - les biens similaires ;
            - les exemples ;
            - les biens voisins ;
            - les recommandations ;
            - les équipements disponibles dans la résidence mais non associés
              au bien ;
            - les options ;
            - les équipements vendus séparément.


            ────────────────────────────
            PRESTIGE / STANDING
            ────────────────────────────

            Les termes marketing génériques comme :

            - coup de cœur ;
            - charme ;
            - privilégié ;
            - belle opportunité ;
            - emplacement exceptionnel ;

            ne suffisent PAS à définir :

            prestige = true
            ou
            standing = true.

            prestige = true uniquement si l'annonce mentionne explicitement
            une notion de :

            - bien de prestige ;
            - propriété de prestige ;
            - résidence prestigieuse ;
            - bien de luxe ;
            - logement de luxe ;
            - haut de gamme ;

            standing = true uniquement si l'annonce mentionne explicitement
            une notion de :

            - standing ;
            - haut standing ;
            - résidence de standing ;
            - prestations haut de gamme ;

            Si aucune preuve explicite n'est présente :
            → ne pas retourner prestige ou standing.


            ────────────────────────────
            IMPORTANT — FORMAT
            ────────────────────────────

            propertyFeatures est PARTIEL.

            Ne retourne jamais automatiquement toutes les propriétés
            disponibles avec false.

            Exemple CORRECT :

            {
              "terrasse": true,
              "parking": false,
              "cuisineEquipee": true
            }

            Exemple INCORRECT :

            {
              "duplex": false,
              "triplex": false,
              "loft": false,
              "terrasse": true,
              "balcon": false,
              "loggia": false,
              "jardin": false,
              "patio": false,
              "piscine": false,
              "garage": false,
              "cave": false,
              "ascenseur": false
            }

            lorsque l'annonce ne fournit aucune information sur ces
            équipements.

            L'absence de preuve signifie :
            → propriété absente du JSON.

            Cela permet de préserver les données déjà extraites
            automatiquement lorsqu'OpenAI n'a trouvé aucune information.
                ════════════════════════════════════
                    PRIX
                ════════════════════════════════════
                
                    Ne modifie jamais le prix extrait sauf erreur manifeste et explicite.
                
                    Ne jamais convertir un prix optionnel en prix du bien principal.
                
                    Exemple :
                
                      "Appartement 400 000 €, parking en sus 20 000 €"
                
                => price = 400000
                
                    et non 420000.
                
                ════════════════════════════════════
                    CORRECTION
                ════════════════════════════════════
                
                    corrected = true uniquement lorsqu'une valeur extraite automatiquement
                    a réellement été modifiée.
                
                    Si toutes les données extraites sont correctes :
                
                      corrected = false
                
                    confidence doit être compris entre 0 et 1.
                
                    confidence représente le niveau de confiance global
                    dans les informations retournées.
                
                    reason doit expliquer brièvement les corrections effectuées.
                
                ════════════════════════════════════
                    URL
                ════════════════════════════════════
                
                    ${input.url ?? ''}
                
                ════════════════════════════════════
                TITRE
                ════════════════════════════════════
                
                ${input.title}
                
                ════════════════════════════════════
                DESCRIPTION
                ════════════════════════════════════
                
                ${input.description}
                
                ════════════════════════════════════
                CONTENU COMPLET DE L'ANNONCE
                ════════════════════════════════════
                
                ${input.body?.substring(0, 10000) ?? ''}
                
                ════════════════════════════════════
                DONNÉES EXTRAITES AUTOMATIQUEMENT
                ════════════════════════════════════
                
                ${JSON.stringify(
                    {
                        address: input.extracted.address ?? '',
                        streetAddress: input.extracted.streetAddress ?? '',
                        city: this.normalizeCity(input.extracted.city),
                        codePostal: input.extracted.codePostal ?? '',

                        typeLocal: input.extracted.typeLocal,
                        propertyCondition: input.extracted.propertyCondition,
                        surface: input.extracted.surface,
                        terrain: input.extracted.terrain,

                        rooms: input.extracted.rooms,

                        dpe: input.extracted.dpe ?? null,
                        ges: input.extracted.ges ?? null,

                        propertyFeatures: input.extracted.propertyFeatures,

                        price: input.extracted.price,
                    },
                    null,
                    2,
                )}
                
════════════════════════════════════
MISSION — ORDRE DE PRIORITÉ
════════════════════════════════════

PRIORITÉ 1 :
Extraire et valider le DPE.

PRIORITÉ 2 :
Extraire et valider le GES.

PRIORITÉ 3 :
Vérifier et reconstruire la localisation.

PRIORITÉ 4 :
Vérifier le typeLocal.

PRIORITÉ 5 :
Vérifier propertyCondition.

PRIORITÉ 6 :
Vérifier la surface.

PRIORITÉ 7 :
Vérifier le terrain.

PRIORITÉ 8 :
Vérifier le nombre de pièces.

PRIORITÉ 9 :
Vérifier les équipements.

PRIORITÉ 10 :
Vérifier le prix.

PRIORITÉ 11 :
Corriger uniquement les erreurs certaines.
Retourne uniquement le JSON demandé.

                ════════════════════════════════════
                FORMAT JSON OBLIGATOIRE
                ════════════════════════════════════
                
                {
                    "location": {
                          "address": "",
                          "streetAddress": "",
                          "city": "",
                          "codePostal": ""
                    },
                
                    "typeLocal": "",
                "propertyCondition": "INCONNU",
                  "surface": null,
                  "terrain": null,
                  "rooms": null,
                
                  "dpe": null,
                  "ges": null,
                
                  "price": null,
                
                  "propertyFeatures": {},
                
                    "corrected": false,
                
                  "confidence": 0,
                
                  "reason": ""
                }
                
                IMPORTANT :
                - Retourne null lorsqu'une donnée n'est pas connue.
                - Ne retourne jamais une classe DPE ou GES inventée.
                - DPE et GES doivent toujours être indépendants.
                - Retourne uniquement du JSON valide.
                - Aucun markdown.
                - Aucun texte avant ou après le JSON.
                  `;

        const response = await this.openAI.chat.completions.create({
            model: 'gpt-4.1-mini',
            response_format: {
                type: 'json_object',
            },
            messages: [
                {
                    role: 'system',
                    content:
                        'Tu es un expert français de validation et d’extraction de métadonnées immobilières. La priorité absolue est l’identification correcte du DPE et du GES.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            return {
                address: input.extracted.address ?? '',
                streetAddress: input.extracted.streetAddress,
                city: this.normalizeCity(input.extracted.city),
                codePostal: input.extracted.codePostal,

                typeLocal: input.extracted.typeLocal,

                surface: input.extracted.surface,
                terrain: input.extracted.terrain,
                rooms: input.extracted.rooms,

                dpe: input.extracted.dpe ?? null,
                ges: input.extracted.ges ?? null,

                propertyFeatures: input.extracted.propertyFeatures,

                price: input.extracted.price,

                corrected: false,
                confidence: 0,
                reason: 'Aucune réponse OpenAI',
            };
        }

        try {
            const result = JSON.parse(content);
            const merged = this.mergePropertyFeatures(input.extracted.propertyFeatures, result.propertyFeatures);
            return {
                address: result.location?.address ?? input.extracted.address ?? '',
                streetAddress: result.location?.streetAddress ?? input.extracted.streetAddress,
                city: result.location?.city
                    ? this.normalizeCity(result.location.city)
                    : this.normalizeCity(input.extracted.city),
                codePostal: result.location?.codePostal ?? input.extracted.codePostal,
                typeLocal: result.typeLocal ?? input.extracted.typeLocal,
                propertyCondition: result.propertyCondition ?? input.extracted.propertyCondition ?? 'INCONNU',
                surface: result.surface ?? input.extracted.surface,
                terrain: result.terrain ?? input.extracted.terrain,
                rooms: result.rooms ?? input.extracted.rooms,
                // IMPORTANT : OpenAI doit pouvoir corriger
                dpe: result.dpe !== undefined ? result.dpe : (input.extracted.dpe ?? null),
                ges: result.ges !== undefined ? result.ges : (input.extracted.ges ?? null),
                propertyFeatures: merged,
                price: result.price ?? input.extracted.price,
                corrected: result.corrected ?? false,
                confidence: typeof result.confidence === 'number' ? Math.min(1, Math.max(0, result.confidence)) : 0,
                reason: result.reason,
            };
        } catch (error) {
            this.logger.error('Erreur parsing OpenAI verifyExtractedMetadata', error);

            return {
                address: input.extracted.address ?? '',
                streetAddress: input.extracted.streetAddress,
                city: this.normalizeCity(input.extracted.city),
                codePostal: input.extracted.codePostal,

                typeLocal: input.extracted.typeLocal,

                surface: input.extracted.surface,
                terrain: input.extracted.terrain,
                rooms: input.extracted.rooms,

                dpe: input.extracted.dpe ?? null,
                ges: input.extracted.ges ?? null,

                propertyFeatures: input.extracted.propertyFeatures,

                price: input.extracted.price,

                corrected: false,
                confidence: 0,
                reason: 'Erreur parsing JSON',
            };
        }
    }

    private mergePropertyFeatures(original?: PropertyFeatures, verified?: Partial<PropertyFeatures>): PropertyFeatures {
        return {
            duplex: verified?.duplex ?? original?.duplex ?? null,
            triplex: verified?.triplex ?? original?.triplex ?? null,
            loft: verified?.loft ?? original?.loft ?? null,

            terrasse: verified?.terrasse ?? original?.terrasse ?? null,
            balcon: verified?.balcon ?? original?.balcon ?? null,
            loggia: verified?.loggia ?? original?.loggia ?? null,
            jardin: verified?.jardin ?? original?.jardin ?? null,
            patio: verified?.patio ?? original?.patio ?? null,

            piscine: verified?.piscine ?? original?.piscine ?? null,
            jacuzzi: verified?.jacuzzi ?? original?.jacuzzi ?? null,
            spa: verified?.spa ?? original?.spa ?? null,
            sauna: verified?.sauna ?? original?.sauna ?? null,

            parking: verified?.parking ?? original?.parking ?? null,
            garage: verified?.garage ?? original?.garage ?? null,
            box: verified?.box ?? original?.box ?? null,

            cave: verified?.cave ?? original?.cave ?? null,
            grenier: verified?.grenier ?? original?.grenier ?? null,

            ascenseur: verified?.ascenseur ?? original?.ascenseur ?? null,
            gardien: verified?.gardien ?? original?.gardien ?? null,
            interphone: verified?.interphone ?? original?.interphone ?? null,
            digicode: verified?.digicode ?? original?.digicode ?? null,
            visiophone: verified?.visiophone ?? original?.visiophone ?? null,

            climatisation: verified?.climatisation ?? original?.climatisation ?? null,
            cheminee: verified?.cheminee ?? original?.cheminee ?? null,
            cuisineEquipee: verified?.cuisineEquipee ?? original?.cuisineEquipee ?? null,
            dressing: verified?.dressing ?? original?.dressing ?? null,
            buanderie: verified?.buanderie ?? original?.buanderie ?? null,

            vueMer: verified?.vueMer ?? original?.vueMer ?? null,
            vueMontagne: verified?.vueMontagne ?? original?.vueMontagne ?? null,
            vuePanoramique: verified?.vuePanoramique ?? original?.vuePanoramique ?? null,
            vueDegagee: verified?.vueDegagee ?? original?.vueDegagee ?? null,

            dernierEtage: verified?.dernierEtage ?? original?.dernierEtage ?? null,
            traversant: verified?.traversant ?? original?.traversant ?? null,
            lumineux: verified?.lumineux ?? original?.lumineux ?? null,
            calme: verified?.calme ?? original?.calme ?? null,

            renove: verified?.renove ?? original?.renove ?? null,
            standing: verified?.standing ?? original?.standing ?? null,
            prestige: verified?.prestige ?? original?.prestige ?? null,
        };
    }

    private normalizeCity(city?: string): string | undefined {
        if (!city) {
            return undefined;
        }

        return (
            city
                .trim()

                // Paris 15e / Paris 15ème / Paris 15eme
                .replace(/\s+\d{1,2}(?:er|e|ème|eme)\b/gi, '')

                // Abréviations
                .replace(/\bST\b/gi, 'SAINT')
                .replace(/\bSTE\b/gi, 'SAINTE')

                // Arrondissement explicite
                .replace(/\s+\d{1,2}(?:er|e|ème|eme)?\s+ARRONDISSEMENT\b/gi, '')

                // Accents
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')

                // Apostrophes
                .replace(/['’]/g, ' ')

                // Caractères inutiles
                .replace(/[^A-Za-z\s-]/g, '')

                // Espaces
                .replace(/\s+/g, ' ')
                .trim()

                .toUpperCase()

                // Format DVF
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
        );
    }
}
