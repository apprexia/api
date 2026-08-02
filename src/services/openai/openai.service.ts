import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ListingMetadata } from '../meta-data-scrapper/meta-data-scrapper.service';
import { ApprexiaMarketData } from '../../analyses/interfaces/apprexia-market-data.interface';
import { DvfMarketData } from '../../analyses/interfaces/dvf-market-data.interface';
import { RentalResult } from '../../analyses/interfaces/rental-result.interface';
import { LocationAnalysis } from '../../apprexia-engine/interfaces/location-analysis.interface';
import { CommuneIndicator } from '@prisma/client';

@Injectable()
export class OpenaiService {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async analyze(
    metadata: ListingMetadata,
    marketData?: DvfMarketData | null,
    apprexiaMarketData?: ApprexiaMarketData | null,
    rentalData?: RentalResult | null,
    locationAnalysis?: LocationAnalysis | null,
    communeIndicator?: CommuneIndicator | null,
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
- la probabilité d'obtenir la négociation
- le rendement
- le score
- le verdict final

Apprexia complète la DVF mais ne la remplace pas.

`
      : `
DONNÉES APPREXIA :

Aucune analyse historique disponible.
`;
    const priceAnalysis = marketData
      ? this.calculatePriceGap(Number(metadata.price), marketData)
      : null;
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

──────────────────────────────
CALCUL AUTOMATIQUE DES ÉCARTS DE PRIX
──────────────────────────────


Les valeurs suivantes ont été calculées par Apprexia.

Tu ne dois jamais recalculer ces pourcentages.


Prix demandé :

${priceAnalysis?.askingPrice} €


Écart avec valeur centrale DVF :

${priceAnalysis?.amountVsDvf} €

${priceAnalysis?.gapVsDvfPercent}%


Écart avec borne basse DVF :

${priceAnalysis?.amountVsLow} €

${priceAnalysis?.gapVsLowPercent}%


Écart avec borne haute DVF :

${priceAnalysis?.amountVsHigh} €

${priceAnalysis?.gapVsHighPercent}%


Position calculée :

${priceAnalysis?.position}


INTERPRÉTATION OBLIGATOIRE :

- gapVsDvfPercent négatif = prix inférieur à la valeur centrale DVF
- gapVsDvfPercent positif = prix supérieur à la valeur centrale DVF

Utilise ces valeurs pour déterminer :

- marketPosition
- verdict
- score
- negotiationAmount

Ne fais aucun nouveau calcul.

INTERPRÉTATION DVF :

La DVF constitue la référence principale pour déterminer la valeur réelle du marché.

La hiérarchie des valeurs DVF est obligatoire :

1. adjustedPriceM2 × surface = estimation centrale du marché
2. medianPriceM2 = contrôle de cohérence
3. lowEstimate / highEstimate = intervalle de variation possible

IMPORTANT :

highEstimate représente une limite haute de valorisation du marché.

Ce n'est PAS automatiquement un prix conseillé d'achat.

Un acheteur doit rechercher un prix proche de la valeur centrale DVF,
sauf si des prestations exceptionnelles présentes dans l'annonce justifient une valorisation supérieure.

La DVF ne prend pas en compte :

- la vue
- la qualité de la résidence
- les prestations
- les rénovations
- la rareté du bien

Ces éléments peuvent ajuster la valeur à l'intérieur de la fourchette DVF.

Un bien peut se rapprocher de highEstimate uniquement si l'annonce mentionne explicitement :

- emplacement exceptionnel
- vue exceptionnelle
- terrasse importante
- piscine
- résidence premium
- rénovation complète récente
- prestations rares

Un dépassement de highEstimate doit rester exceptionnel et être justifié précisément.

Lorsque DVF et Apprexia sont disponibles :

La DVF représente la valeur réelle issue des transactions réalisées.

Apprexia représente les comportements observés sur des annonces similaires :
- prix affichés
- négociations obtenues
- prix recommandés historiques
- verdicts précédents

La DVF définit la valeur.
Apprexia aide à définir la stratégie d'achat.

Le verdict final doit utiliser les deux.

Si elles conduisent à des conclusions différentes,
explique pourquoi.

Analyse obligatoirement :

1. L'écart entre prix demandé et adjustedPriceM2 × surface.

2. L'écart entre prix demandé et dvfReferenceValue.

3. Le positionnement dans la fourchette DVF.

4. Si les prestations réelles justifient un positionnement proche de highEstimate.

5. Le montant de négociation nécessaire pour revenir vers une valeur cohérente.

La probabilité d'obtenir cette baisse est un élément différent.

Une négociation importante peut être nécessaire mais difficile à obtenir.

Explique cette différence dans negotiationAnalysis.
`
      : `

DONNÉES DVF :

Aucune donnée DVF disponible.

IMPORTANT :

- Tu ne disposes d'aucune vente comparable réelle.
- Tu ne dois PAS inventer de valeur DVF.
- Tu ne dois PAS estimer un prix à partir de ta connaissance générale du marché.
- Tu ne dois PAS produire de référence chiffrée qui semble provenir de la DVF.

Dans ce cas :

- dvfReferenceValue = null
- estimatedValueLow = null
- estimatedValueHigh = null

Explique simplement que l'estimation est impossible faute de données de marché fiables.

`;

    const rentalInfo = rentalData
      ? `

DONNÉES RENTAL ENGINE
(Estimation locative)


Loyer mensuel estimé :
${rentalData.estimatedRentMonthly} €


Fourchette basse :
${rentalData.estimatedRentLow} €


Fourchette haute :
${rentalData.estimatedRentHigh} €


Prix au m² locatif :
${
  rentalData?.rentPerSquareMeter != null
    ? rentalData.rentPerSquareMeter.toFixed(2)
    : 'N/A'
} €/m²


Confiance estimation :
${
  rentalData.rentConfidence !== null
    ? Math.round(rentalData.rentConfidence)
    : 'N/A'
} %


Rendement brut calculé :
${rentalData.grossYield} %


Niveau rendement :
${rentalData.yieldLevel}


IMPORTANT :

Utilise ces données pour expliquer la rentabilité.

Ne recalcule jamais le loyer.

Ne modifie jamais grossYield.

`
      : `
DONNÉES RENTAL :

Aucune estimation locative disponible.
`;

    const locationInfo = locationAnalysis
      ? `
DONNÉES LOCATION ENGINE
(Analyse automatique de l'environnement)

Score localisation :
${locationAnalysis.score}/100

Points forts localisation :
${locationAnalysis.strengths?.join(', ') ?? 'Aucun'}

Points faibles localisation :
${locationAnalysis.weaknesses?.join(', ') ?? 'Aucun'}

IMPORTANT :

Un score de localisation moyen ne doit pas automatiquement devenir un risque.

Utilise uniquement les faiblesses explicites du Location Engine.

Ne transforme pas un score global en risque.

Ces données servent à évaluer l'attractivité de la localisation.

Elles peuvent influencer :

- le score localisation (20%)
- les forces
- les risques
- l'explication du verdict

Elles ne modifient jamais :

- la valeur DVF
- estimatedValueLow
- estimatedValueHigh
- dvfReferenceValue

`
      : `
DONNÉES LOCATION ENGINE :

Aucune analyse de localisation disponible.
`;

    const communeInfo = communeIndicator
      ? `
DONNÉES COMMUNE
(Contexte démographique et économique local)

Ville :
${communeIndicator.commune ?? ''}

Evolution prix immobilier 5 ans :
${
  communeIndicator.priceEvolution5Years !== null
    ? `${communeIndicator.priceEvolution5Years}%`
    : 'N/A'
}

Prix appartement :
${
  communeIndicator.medianApartmentPriceM2 !== null
    ? `${communeIndicator.medianApartmentPriceM2} €/m²`
    : 'N/A'
}

Prix immobilier médian :
${
  communeIndicator.medianPriceM2 !== null
    ? `${communeIndicator.medianPriceM2} €/m²`
    : 'N/A'
}

Evolution population 5 ans :
${
  communeIndicator.evolutionPopulation5Years !== null
    ? `${communeIndicator.evolutionPopulation5Years}%`
    : 'N/A'
}

Score écoles :
${
  communeIndicator.schoolIndex !== null
    ? `${communeIndicator.schoolIndex}/100`
    : 'N/A'
}

Fiscalité taxe foncière :
${
  communeIndicator.propertyTaxRate !== null
    ? `${communeIndicator.propertyTaxRate}%`
    : 'N/A'
}

IMPORTANT :

Ces données servent uniquement à comprendre le contexte général de la commune :

- attractivité locale
- dynamique démographique
- niveau de prix
- évolution du marché
- qualité des services publics

Elles ne remplacent jamais :

- DVF pour l'estimation du prix ;
- Rental Engine pour le rendement ;
- Location Engine pour l'environnement immédiat.

Elles peuvent influencer :

- l'explication du potentiel du secteur ;
- les forces ou risques liés au contexte local.

Elles ne doivent jamais créer une information absente de l'annonce.
`
      : `
DONNÉES COMMUNE :

Aucune donnée locale disponible.
`;

    const response = await this.client.responses.create({
      model: 'gpt-4.1-mini',

      input: `
Tu es un expert immobilier spécialisé dans l'investissement locatif en France.

Ton rôle est de produire une analyse immobilière professionnelle comparable à celle d'un expert immobilier.

Tu dois toujours raisonner dans cet ordre :

1. Comprendre le bien.
2. Estimer sa valeur de marché.
3. Comparer cette valeur au prix demandé.
4. Évaluer les prestations.
5. Évaluer les risques.
6. Calculer le score.
7. Déterminer le verdict.

  

──────────────────────────────
ANNONCE
──────────────────────────────

Titre :
${metadata.title ?? ''}

Description :
${metadata.description ?? ''}

Prix affiché :
${metadata.price ?? 0} €

Surface :
${metadata.surface ?? 0} m²

Surface du terrain :
${metadata.terrain ?? 0} m²

──────────────────────────────
PRESTATIONS DÉTECTÉES
──────────────────────────────

${
  metadata.propertyFeatures
    ? `
Les éléments ci-dessous correspondent uniquement aux prestations détectées explicitement dans l'annonce.

IMPORTANT :
"Non détecté" signifie que l'information n'a pas été trouvée dans l'annonce.
Cela ne signifie jamais que l'équipement est absent.

Duplex : ${metadata.propertyFeatures.duplex ? 'Oui' : 'Non détecté'}
Triplex : ${metadata.propertyFeatures.triplex ? 'Oui' : 'Non détecté'}
Loft : ${metadata.propertyFeatures.loft ? 'Oui' : 'Non détecté'}

Terrasse : ${metadata.propertyFeatures.terrasse ? 'Oui' : 'Non détecté'}
Balcon : ${metadata.propertyFeatures.balcon ? 'Oui' : 'Non détecté'}
Loggia : ${metadata.propertyFeatures.loggia ? 'Oui' : 'Non détecté'}
Jardin : ${metadata.propertyFeatures.jardin ? 'Oui' : 'Non détecté'}
Patio : ${metadata.propertyFeatures.patio ? 'Oui' : 'Non détecté'}

Piscine : ${metadata.propertyFeatures.piscine ? 'Oui' : 'Non détecté'}
Jacuzzi : ${metadata.propertyFeatures.jacuzzi ? 'Oui' : 'Non détecté'}
Spa : ${metadata.propertyFeatures.spa ? 'Oui' : 'Non détecté'}
Sauna : ${metadata.propertyFeatures.sauna ? 'Oui' : 'Non détecté'}

Parking : ${metadata.propertyFeatures.parking ? 'Oui' : 'Non détecté'}
Garage : ${metadata.propertyFeatures.garage ? 'Oui' : 'Non détecté'}
Box : ${metadata.propertyFeatures.box ? 'Oui' : 'Non détecté'}

Cave : ${metadata.propertyFeatures.cave ? 'Oui' : 'Non détecté'}
Grenier : ${metadata.propertyFeatures.grenier ? 'Oui' : 'Non détecté'}

Ascenseur : ${metadata.propertyFeatures.ascenseur ? 'Oui' : 'Non détecté'}
Gardien : ${metadata.propertyFeatures.gardien ? 'Oui' : 'Non détecté'}
Interphone : ${metadata.propertyFeatures.interphone ? 'Oui' : 'Non détecté'}
Digicode : ${metadata.propertyFeatures.digicode ? 'Oui' : 'Non détecté'}
Visiophone : ${metadata.propertyFeatures.visiophone ? 'Oui' : 'Non détecté'}

Climatisation : ${metadata.propertyFeatures.climatisation ? 'Oui' : 'Non détecté'}
Cheminée : ${metadata.propertyFeatures.cheminee ? 'Oui' : 'Non détecté'}
Cuisine équipée : ${metadata.propertyFeatures.cuisineEquipee ? 'Oui' : 'Non détecté'}
Dressing : ${metadata.propertyFeatures.dressing ? 'Oui' : 'Non détecté'}
Buanderie : ${metadata.propertyFeatures.buanderie ? 'Oui' : 'Non détecté'}

Vue mer : ${metadata.propertyFeatures.vueMer ? 'Oui' : 'Non détecté'}
Vue montagne : ${metadata.propertyFeatures.vueMontagne ? 'Oui' : 'Non détecté'}
Vue panoramique : ${metadata.propertyFeatures.vuePanoramique ? 'Oui' : 'Non détecté'}
Vue dégagée : ${metadata.propertyFeatures.vueDegagee ? 'Oui' : 'Non détecté'}

Dernier étage : ${metadata.propertyFeatures.dernierEtage ? 'Oui' : 'Non détecté'}
Traversant : ${metadata.propertyFeatures.traversant ? 'Oui' : 'Non détecté'}
Lumineux : ${metadata.propertyFeatures.lumineux ? 'Oui' : 'Non détecté'}
Calme : ${metadata.propertyFeatures.calme ? 'Oui' : 'Non détecté'}
Rénové : ${metadata.propertyFeatures.renove ? 'Oui' : 'Non détecté'}
Standing : ${metadata.propertyFeatures.standing ? 'Oui' : 'Non détecté'}
Prestige : ${metadata.propertyFeatures.prestige ? 'Oui' : 'Non détecté'}
`
    : 'Aucune prestation détectée'
}

Les prestations détectées ci-dessus représentent uniquement
les éléments explicitement identifiés dans l'annonce.

IMPORTANT :

"Non détecté" signifie uniquement :
"l'information n'a pas été trouvée".

Cela ne signifie jamais :
"l'équipement est absent".

Tu ne peux transformer "Non détecté" en risque,
faiblesse ou défaut.

Tu dois les utiliser pour :

- ajuster la valeur du bien dans la fourchette DVF ;
- expliquer la valorisation du bien ;
- calculer le score ;
- justifier le verdict ;
- expliquer le prix conseillé.

N'invente jamais une prestation qui n'apparaît pas dans cette liste ou dans la description de l'annonce.

Nombre de pièces :
${metadata.rooms ?? 0}

Adresse rue :
${metadata.streetAddress ?? ''}

Adresse complète :
${metadata.address ?? ''}

Ville :
${metadata.city ?? ''}

Type :
${metadata.typeLocal ?? ''}

Photos :
${metadata.images?.join(', ') ?? ''}

${marketInfo}

${apprexiaInfo}

${rentalInfo}

${locationInfo}

${communeInfo}

──────────────────────────────
RÈGLES IMPORTANTES
──────────────────────────────
La description doit être un résumé fidèle de l'annonce.

Ne jamais ajouter une information qui n'est pas présente dans l'annonce.

Si aucune description n'est disponible, retourner une chaîne vide.

Ne jamais supposer :

- vue mer
- piscine
- résidence haut de gamme
- terrasse
- garage
- ascenseur
- rénovation récente
- bon état
- excellent état
- bien entretenu
- maison familiale
- quartier recherché
- fort potentiel locatif
- emplacement exceptionnel
- proximité des commerces
- proximité des transports

si cela n'est pas explicitement indiqué dans l'annonce.

En cas d'absence d'information, indique simplement que ces éléments sont inconnus.

──────────────────────────────
ESTIMATION DU BIEN
──────────────────────────────

Retourne obligatoirement :

estimatedValueLow

estimatedValueHigh

Ces deux valeurs correspondent à la fourchette de valeur du bien.

Si des données DVF sont fournies, utilise obligatoirement :

estimatedValueLow = lowEstimate
estimatedValueHigh = highEstimate

Ne recalcule jamais ces valeurs.

Si aucune donnée DVF n'est disponible, retourne null pour ces champs.

──────────────────────────────
UTILISATION DE LA DVF
──────────────────────────────

Lorsque des données DVF sont disponibles, elles constituent la référence officielle de prix.

Les valeurs suivantes doivent être considérées comme exactes :

- dvfReferenceValue
- lowEstimate
- highEstimate
- adjustedPriceM2

RÈGLES OBLIGATOIRES :

- estimatedValueLow = lowEstimate
- estimatedValueHigh = highEstimate
- dvfReferenceValue = dvfReferenceValue fourni

Tu ne dois jamais recalculer, modifier ou remplacer ces valeurs.

Tu peux uniquement expliquer pourquoi le bien mérite d'être évalué plutôt vers la borne basse ou vers la borne haute de cette fourchette en fonction de ses prestations.

Tu ne peux dépasser la fourchette DVF que si l'annonce décrit explicitement des éléments exceptionnels (vue mer, emplacement unique, prestations haut de gamme, rénovation complète, etc.), et tu dois alors expliquer précisément pourquoi dans marketAdjustment.

──────────────────────────────
RÈGLE PRIORITAIRE PRIX CONSEILLÉ
──────────────────────────────

Lorsque DVF est disponible :

La hiérarchie obligatoire est :

1. dvfReferenceValue = valeur centrale du marché
2. lowEstimate / highEstimate = fourchette de variation
3. askingPrice = prix vendeur

estimatedValueHigh ne représente PAS le prix conseillé.

Un acheteur ne doit pas payer automatiquement la borne haute.

Si le prix affiché est supérieur à dvfReferenceValue :

recommendedPrice doit généralement être inférieur au prix affiché.

L'écart entre askingPrice et dvfReferenceValue représente le potentiel de négociation.

──────────────────────────────
UTILISATION DES DONNÉES APPREXIA
──────────────────────────────

Les analyses Apprexia servent à vérifier :

- la cohérence du prix
- la cohérence du score
- la cohérence du rendement
- la cohérence du verdict

Les données Apprexia complètent la DVF mais ne remplacent jamais la DVF.

Si aucune donnée Apprexia n'est disponible, ne fais aucune supposition à partir d'Apprexia et n'y fais pas référence dans les explications.

──────────────────────────────
CALCUL DU SCORE
──────────────────────────────

Le score représente l'intérêt d'acheter ce bien aujourd'hui.

Il ne mesure PAS uniquement la qualité du logement.

Le score est calculé selon :

Prix / Opportunité : 40 %

Localisation : 20 %

Prestations : 15 %

Potentiel locatif : 10 %

Probabilité d'obtenir la négociation : 10 %

Risques : 5 %

LOCALISATION :

Le critère localisation doit utiliser prioritairement les données LOCATION ENGINE.

Si Location Engine est disponible :

- utilise son score localisation ;
- utilise ses forces et faiblesses ;
- explique son impact sur l'attractivité du bien.

Ne pénalise jamais une localisation uniquement parce qu'une information est inconnue.

Une donnée inconnue ≠ un défaut.

Le critère le plus important est toujours le rapport entre le prix demandé et la valeur estimée.

RÈGLES OBLIGATOIRES

Si askingPrice est inférieur à estimatedValueLow de plus de 30 % :
→ score minimum = 90

Si askingPrice est inférieur à estimatedValueLow de 20 à 30 % :
→ score minimum = 85

Si askingPrice est inférieur de plus de 40 % à estimatedValueLow
→ score minimum = 90

Si askingPrice est inférieur à estimatedValueLow :
→ score minimum = 80

askingPrice = prix affiché fourni dans l'annonce.

Ne jamais modifier cette valeur.

L'absence d'ascenseur, de terrasse, de balcon ou de vue mer ne peut jamais faire perdre plus de 10 points au total.

Le rendement locatif ne peut jamais faire perdre plus de 5 points.

Un bien très sous-évalué doit toujours obtenir un score élevé, même si ses prestations sont simples.

Le score doit être cohérent avec le verdict :

- INVESTIR → généralement entre 80 et 100
- NEGOCIER → généralement entre 60 et 79
- EVITER → généralement entre 0 et 59

Lorsque askingPrice dépasse estimatedValueHigh :

Si la surcote est inférieure à 5 % :
→ score généralement compris entre 65 et 80.

Si la surcote est comprise entre 5 % et 15 % :
→ score généralement compris entre 50 et 70.

Si la surcote est comprise entre 15 % et 30 % :
→ score généralement compris entre 30 et 55.

Si la surcote dépasse 30 % :
→ score généralement compris entre 0 et 40.

Les prestations réellement présentes peuvent déplacer le score à l'intérieur de cette plage mais ne doivent généralement pas en sortir.

──────────────────────────────
RISQUE
──────────────────────────────

riskLevel est compris entre 0 et 100.

Plus il est élevé, plus le risque est important.

Les risques doivent être justifiés par les données de l'annonce, la DVF ou Apprexia.

Ne jamais inventer un risque.

Un risque ne peut jamais être basé sur une information absente.

L'absence d'information ne constitue pas un risque.

Exemples interdits :

- absence de parking
- absence de balcon
- absence de piscine
- absence d'ascenseur

si ces éléments ne sont pas explicitement indiqués dans l'annonce.

Les risques doivent être démontrés par :

- une surcote importante
- des données DVF
- des données Apprexia
- une caractéristique explicitement mentionnée dans l'annonce.

IMPORTANT :

Les éléments inconnus ne doivent JAMAIS apparaître dans risks.

Exemples interdits :

"absence d'information sur la luminosité"
"absence d'information sur la rénovation"
"pas d'information sur l'état intérieur"

Ces éléments peuvent uniquement apparaître dans description ou marketAdjustment.

──────────────────────────────
NÉGOCIATION
──────────────────────────────

recommendedPrice représente le prix d'achat conseillé permettant de réaliser une bonne opération.

Ce n'est pas la valeur maximale théorique du marché.

Il doit refléter :
- la valeur DVF centrale
- le prix affiché
- les prestations réelles
- la marge de négociation réaliste.

recommendedPrice ne doit jamais être choisi arbitrairement.

Il doit toujours être déterminé à partir :

- de estimatedValueLow
- de estimatedValueHigh
- des prestations réellement présentes dans l'annonce
- des risques réellement identifiés

Tu ne dois jamais inventer une décote.

Explique toujours dans negotiationAnalysis pourquoi ce prix est retenu.

RÈGLE ABSOLUE

recommendedPrice ne peut jamais être supérieur à askingPrice.

Si le prix affiché est déjà inférieur ou égal au prix maximum conseillé,
alors :

recommendedPrice = askingPrice

negotiationAmount = 0

negotiationPotential = 0

La recommandation consiste à acheter au prix affiché.

recommendedPrice ne peut jamais être supérieur à askingPrice.

Si askingPrice est déjà cohérent avec la valeur du bien, alors :

- recommendedPrice = askingPrice
- negotiationAmount = 0
- negotiationPotential = 0

Explique toujours dans negotiationAnalysis pourquoi ce prix est retenu.

Si askingPrice est déjà inférieur à estimatedValueLow :

- recommendedPrice doit être très proche du prix affiché.
- La négociation recommandée ne peut jamais dépasser 5 % du prix affiché.
- L'objectif est de sécuriser l'achat, pas de rechercher un prix irréaliste.

Si recommendedPrice = askingPrice :

- negotiationAmount = 0
- negotiationPotential = 0

Une négociation ne doit pas être proposée lorsqu'aucune baisse de prix n'est recommandée.

Règles :

Exception unique :

Si askingPrice < estimatedValueLow avec un écart supérieur à 20 % :

recommendedPrice peut être supérieur à askingPrice afin d'indiquer la valeur maximale acceptable.

Dans tous les autres cas :

recommendedPrice <= askingPrice

Si verdict = NEGOCIER

Si askingPrice est compris entre estimatedValueLow et estimatedValueHigh :

- recommendedPrice est égal à askingPrice lorsque le prix est déjà cohérent.
- Une négociation n'est recommandée que si le prix est situé vers la borne haute de la fourchette ou si certaines prestations sont insuffisantes.
- recommendedPrice ne peut jamais être supérieur à askingPrice.

ATTENTION :

Être dans la fourchette DVF ne signifie pas automatiquement que le prix est attractif.

Un bien proche de highEstimate mais éloigné de dvfReferenceValue doit être considéré comme un achat au prix fort.

Dans ce cas :

- verdict = NEGOCIER
- score généralement inférieur à 75
- recommendedPrice doit se rapprocher de dvfReferenceValue

RÈGLES OBLIGATOIRES :

Si verdict = EVITER :

recommendedPrice représente le prix maximum conseillé pour acheter ce bien.

En règle générale :

- recommendedPrice doit être proche de estimatedValueHigh.
- Une décote maximale de 5 % sous estimatedValueHigh est autorisée lorsque la surcote est importante mais qu'aucun risque majeur supplémentaire n'est identifié.

Tu ne peux proposer un prix inférieur à 95 % de estimatedValueHigh que si l'annonce mentionne explicitement :

- des travaux importants
- un immeuble dégradé
- une procédure en cours
- un risque juridique
- un défaut majeur du bien

Dans ce cas, explique précisément cette décote dans negotiationAnalysis.

negotiationAmount = askingPrice - recommendedPrice.

CALCUL PRIORITAIRE DE LA NÉGOCIATION :

Lorsque askingPrice > dvfReferenceValue :

recommendedPrice doit généralement être proche de dvfReferenceValue.

negotiationAmount représente l'écart entre le prix vendeur et la valeur centrale DVF.

Exemple :

askingPrice = 425000 €
dvfReferenceValue = 405000 €

recommendedPrice doit être proche de 405000 €
negotiationAmount environ 20000 €

Cette valeur peut être :

positive :
si une négociation est recommandée.

égale à zéro :
si le prix est cohérent.

négative :
si le bien est très fortement sous-évalué.

──────────────────────────────
POSITION MARCHÉ
──────────────────────────────

marketPosition doit obligatoirement être :

SOUS_EVALUE

PRIX MARCHE

LEGEREMENT_SURCOTE

SURCOTE


La position marché doit être déterminée principalement par :

1. La comparaison entre askingPrice et dvfReferenceValue.
2. La position du prix dans la fourchette DVF (estimatedValueLow / estimatedValueHigh).


RÈGLES OBLIGATOIRES :


CAS 1 :

Si :

askingPrice < estimatedValueLow

Alors :

marketPosition = SOUS_EVALUE


Le bien est significativement inférieur à la valeur minimale estimée du marché.

Cela indique une opportunité potentielle.


──────────────────────────────


CAS 2 :

Si :

askingPrice est inférieur ou égal à dvfReferenceValue

ET

askingPrice est supérieur ou égal à estimatedValueLow

Alors :

marketPosition = PRIX_MARCHE


Le prix est cohérent avec le marché.

Si l'écart avec dvfReferenceValue est supérieur à 10 % en dessous :

marketPosition peut être SOUS_EVALUE.


──────────────────────────────


CAS 3 :

Si :

askingPrice est supérieur à dvfReferenceValue

ET

askingPrice est inférieur ou égal à estimatedValueHigh

Alors :

marketPosition = PRIX_MARCHE


Cependant :

Si :

(askingPrice - dvfReferenceValue) / dvfReferenceValue × 100

est supérieur à 10 %

Alors :

marketPosition = LEGEREMENT_SURCOTE


Un bien situé dans la fourchette DVF mais proche de estimatedValueHigh
doit être considéré comme un prix haut du marché.


──────────────────────────────


CAS 4 :

Si :

askingPrice est supérieur à estimatedValueHigh

Calculer :

surcote =

((askingPrice - estimatedValueHigh)
/ estimatedValueHigh) × 100


Si :

surcote <= 5 %

Alors :

marketPosition = LEGEREMENT_SURCOTE


Le dépassement reste dans une tolérance normale du marché.


Si :

surcote > 5 %

Alors :

marketPosition = SURCOTE


──────────────────────────────


RÈGLE IMPORTANTE :

estimatedValueHigh représente une limite haute de valorisation.

Ce n'est pas une valeur cible d'achat.


Un bien proche de estimatedValueHigh mais éloigné de dvfReferenceValue
doit être considéré comme un achat au prix fort.


La position marché doit toujours refléter la réalité économique :

- SOUS_EVALUE :
prix inférieur de manière significative au marché.

- PRIX_MARCHE :
prix cohérent avec les transactions observées.

- LEGEREMENT_SURCOTE :
prix légèrement supérieur au marché mais pouvant rester défendable.

- SURCOTE :
prix trop élevé par rapport aux transactions réelles.


Ne jamais dégrader la position uniquement parce qu'une information est inconnue.

"Inconnu" ≠ "défavorable".

──────────────────────────────
TOLÉRANCE DE MARCHÉ
──────────────────────────────

Une différence comprise entre 0 % et 5 % au-dessus de estimatedValueHigh
est considérée comme une variation normale du marché.

Dans cette situation :

- le bien reste proche du prix du marché ;
- marketPosition = LEGEREMENT_SURCOTE ;
- le verdict est généralement NEGOCIER ;
- recommendedPrice doit rester proche de estimatedValueHigh ;
- la négociation recommandée reste faible (0 à 5 % du prix affiché).

Ne classe pas automatiquement un bien en EVITER uniquement parce que askingPrice dépasse légèrement estimatedValueHigh.

──────────────────────────────
VERDICT
──────────────────────────────

Le verdict doit être déterminé principalement par :

1. L'écart entre askingPrice et dvfReferenceValue.
2. La position dans la fourchette DVF.
3. Les prestations réellement présentes.
4. Les risques identifiés.


Calcul obligatoire :

écartDVF =
((askingPrice - dvfReferenceValue)
/ dvfReferenceValue) × 100


──────────────────────────────
CAS 1 : OPPORTUNITÉ
──────────────────────────────

Si :

écartDVF <= -10 %

Alors :

verdict = INVESTIR


Le prix est significativement inférieur à la valeur réelle du marché.


──────────────────────────────
CAS 2 : PRIX ATTRACTIF OU COHÉRENT
──────────────────────────────

Si :

écartDVF > -10 %

ET

écartDVF <= +5 %

Alors :

verdict = PRIX_MARCHE


Le prix est cohérent avec le marché.

Aucune négociation obligatoire.

Si le prix affiché est inférieur ou égal à dvfReferenceValue :

recommendedPrice = askingPrice

negotiationAmount = 0

negotiationPotential = 0


──────────────────────────────
CAS 3 : PRIX HAUT DU MARCHÉ
──────────────────────────────

Si :

écartDVF > +5 %

ET

écartDVF <= +15 %

Alors :

verdict = NEGOCIER


Le prix reste acceptable mais une négociation est nécessaire
pour revenir vers la valeur centrale DVF.


──────────────────────────────
CAS 4 : SURCOTE
──────────────────────────────

Si :

écartDVF > +15 %

Alors :

verdict = EVITER


Exception :

Si l'annonce contient explicitement plusieurs éléments exceptionnels :

- vue exceptionnelle
- emplacement rare
- rénovation complète récente
- prestations premium

Alors :

verdict maximum = NEGOCIER


──────────────────────────────
RÈGLE IMPORTANTE

Un bien situé dans la fourchette DVF n'est pas automatiquement à négocier.

La fourchette DVF représente la dispersion normale des prix observés.

La valeur centrale DVF représente la référence d'achat.

Un prix inférieur ou égal à dvfReferenceValue
ne nécessite pas de négociation sauf élément particulier.

──────────────────────────────
COHÉRENCE OBLIGATOIRE
──────────────────────────────

Le verdict doit rester cohérent avec score :

INVESTIR :
score généralement >= 80

PRIX_MARCHE :
score généralement entre 60 et 80

NEGOCIER :
score généralement entre 50 et 75

EVITER :
score généralement < 60


Une information inconnue ne doit jamais être considérée comme négative.

"Inconnu" ≠ "défavorable".

L'absence d'information sur un équipement ne constitue jamais un risque.

Seules les informations présentes dans l'annonce ou démontrées par les données DVF/Apprexia peuvent influencer le verdict.

──────────────────────────────
RÈGLE ABSOLUE RECOMMENDED PRICE
──────────────────────────────

RÈGLE PRIORITAIRE :

recommendedPrice ne doit jamais être supérieur à askingPrice.

Exception unique :

Si :

askingPrice < estimatedValueLow avec un écart supérieur à 20 %

alors :

recommendedPrice peut être supérieur à askingPrice afin d'indiquer la valeur maximale acceptable.

Dans tous les autres cas :

recommendedPrice <= askingPrice


CAS 1 :

Si :
Si askingPrice est compris entre estimatedValueLow et estimatedValueHigh :
Ne considère pas automatiquement que le prix affiché est le prix conseillé.
recommendedPrice doit être basé sur la valeur centrale DVF :
recommendedPrice ≈ dvfReferenceValue
avec une tolérance liée aux prestations réelles.

Règles :

- Si askingPrice <= dvfReferenceValue :
    recommendedPrice = askingPrice
- Si askingPrice > dvfReferenceValue :
    recommendedPrice doit être inférieur ou égal à askingPrice.

La négociation correspond à l'écart entre askingPrice et recommendedPrice.


CAS 2 :

Si :
askingPrice > estimatedValueHigh
Alors :
recommendedPrice doit être inférieur à askingPrice.

Si verdict = EVITER :
recommendedPrice représente uniquement un prix théorique maximum acceptable.

Il ne constitue pas une recommandation d'achat.

Si l'écart entre askingPrice et estimatedValueHigh est supérieur à 30 %,
recommendedPrice peut être égal à estimatedValueHigh.

negotiationAmount = askingPrice - recommendedPrice


CAS 3 :

Si :

askingPrice < estimatedValueLow

Alors :

Le bien est sous-évalué.

recommendedPrice doit rester proche de la valeur de marché centrale
(dvfReferenceValue ou adjustedPriceM2 x surface),
sauf justification exceptionnelle présente dans l'annonce.

La négociation recommandée ne doit jamais dépasser 5 % du prix affiché.

IMPORTANT :

Un bien situé sous estimatedValueHigh n'est pas automatiquement considéré comme une bonne affaire.
La comparaison principale doit toujours être faite avec dvfReferenceValue.
Un prix proche de highEstimate correspond à un positionnement haut du marché et nécessite une justification par les prestations.

Dans ce cas :
marketPosition = PRIX_MARCHE
ou
SOUS_EVALUE
et jamais SURCOTE.

──────────────────────────────
RENDEMENT
──────────────────────────────

grossYield représente le rendement locatif brut.
Ne jamais inventer un rendement.
S'il n'existe aucune estimation fiable du loyer ou aucune donnée permettant son calcul :
grossYield = null
yieldLevel = null
yieldAnalysis doit expliquer qu'aucune estimation fiable n'est possible.
yieldLevel doit être :
FAIBLE
MOYEN
BON
EXCELLENT

──────────────────────────────
FORCES ET FAIBLESSES
──────────────────────────────

Les points forts et les points faibles doivent uniquement provenir :

- des informations explicitement présentes dans l'annonce ;
- des données DVF ;
- des données Apprexia.

IMPORTANT :

Une information non mentionnée dans l'annonce signifie :

"inconnue"

et jamais :

"absente".

Ne transforme jamais une absence d'information en point faible.

Tu peux uniquement citer comme point faible :

- un équipement explicitement indiqué comme absent dans l'annonce ;
- une caractéristique objectivement défavorable mentionnée dans l'annonce ;
- une surcote démontrée par rapport aux données DVF ;
- un risque identifié grâce aux données DVF ou Apprexia.

Exemples interdits si l'annonce ne le précise pas :

- absence de parking ;
- absence de balcon ;
- absence de piscine ;
- absence d'ascenseur.

Ne jamais inventer un point fort ou un point faible.

Ne jamais supposer :

- bon état ;
- excellent état ;
- rénovation récente ;
- quartier recherché ;
- luminosité ;
- calme ;
- qualité des matériaux ;
- potentiel locatif ;
- prestations exceptionnelles ;
- vue mer ;
- terrasse ;
- garage ;
- cave ;
- piscine ;
- parking ;
- ascenseur.

Si une information importante n'est pas connue, indique simplement :

"L'annonce ne précise pas ..."

──────────────────────────────
COHÉRENCE GLOBALE
──────────────────────────────

Toutes les valeurs numériques, le score et le verdict doivent être cohérents entre eux.

Par exemple :

- Une surcote très importante (>30 %) conduit généralement à un score faible.
- Un bien au-dessus de estimatedValueHigh ne peut généralement pas obtenir un score élevé.
- Une forte négociation nécessaire implique généralement une faible probabilité d'obtenir cette négociation.
- Les explications doivent toujours être cohérentes avec les valeurs retournées.

Ne transforme jamais une information inconnue en information négative.

"Inconnu" ≠ "Absent".

Si une caractéristique n'est pas mentionnée dans l'annonce, elle ne doit pas être utilisée pour diminuer :

- le score
- le verdict
- les risques
- les points faibles.

──────────────────────────────
VALIDATION FINALE DES RISQUES
──────────────────────────────

Avant de retourner risks, vérifie chaque élément.

Un risque est valide uniquement si :

1. Il est explicitement présent dans l'annonce.
OU
2. Il provient d'une donnée DVF.
OU
3. Il provient d'une faiblesse Location Engine.
OU
4. Il provient d'une donnée Apprexia.

Sinon il doit être supprimé.

Les phrases suivantes sont toujours interdites dans risks :

- absence d'information
- pas d'information
- non renseigné
- non détecté
- absence de
- manque de

sauf si l'annonce indique explicitement cette absence.

──────────────────────────────
FORMAT JSON OBLIGATOIRE
──────────────────────────────

{
"title": "",
"description": "",
"imageUrl": "",
"city": "",
"rooms": 0,
"surface": 0,

"score": 0,
"scoreExplanation": "",

"verdict": "",
"verdictExplanation": "",

"estimatedValueLow": null,
"estimatedValueHigh": null,
"dvfReferenceValue": null,

"askingPrice": 0,

"recommendedPrice": 0,

"negotiationAmount": 0,
"negotiationPotential": 0,
"negotiationAnalysis": "",

"marketPosition": "",
"marketAdjustment": "",

"riskLevel": 0,

"estimatedRentMonthly": null,
"estimatedRentLow": null,
"estimatedRentHigh": null,
"rentPerSquareMeter": null,
"rentConfidence": null,

"grossYield": null,
"yieldLevel": null,
"yieldAnalysis": ""

"strengths": [],

"risks": []
}

Retourne uniquement ce JSON.

Ne retourne jamais de markdown.

Ne retourne jamais de texte avant ou après le JSON.
`,
    });
    console.log('OPENAI RAW RESPONSE');
    console.log(response.output_text);
    return response.output_text;
  }

  private calculatePriceGap(askingPrice: number, marketData: DvfMarketData) {
    const { dvfReferenceValue, lowEstimate, highEstimate } = marketData;

    const gapVsDvf =
      ((askingPrice - dvfReferenceValue) / dvfReferenceValue) * 100;

    const gapVsLow = ((askingPrice - lowEstimate) / lowEstimate) * 100;

    const gapVsHigh = ((askingPrice - highEstimate) / highEstimate) * 100;

    return {
      askingPrice,

      dvfReferenceValue,

      lowEstimate,

      highEstimate,

      // écart absolu
      amountVsDvf: askingPrice - dvfReferenceValue,

      amountVsLow: askingPrice - lowEstimate,

      amountVsHigh: askingPrice - highEstimate,

      // écart %
      gapVsDvfPercent: Number(gapVsDvf.toFixed(2)),

      gapVsLowPercent: Number(gapVsLow.toFixed(2)),

      gapVsHighPercent: Number(gapVsHigh.toFixed(2)),

      position:
        askingPrice < lowEstimate
          ? 'SOUS_EVALUE'
          : askingPrice <= highEstimate
            ? 'DANS_FOURCHETTE'
            : 'AU_DESSUS_FOURCHETTE',
    };
  }
}
