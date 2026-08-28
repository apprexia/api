import { VisitCategory } from '@prisma/client';

export interface VisitQuestion {
    key: string;
    category: VisitCategory;
    step: number;
    title: string;
    question: string;
    helpText?: string;
    order: number;
    allowCost?: boolean;
}

export const VISIT_QUESTIONS: VisitQuestion[] = [
    // =========================================================
    // 1 — ÉTAT GÉNÉRAL
    // =========================================================

    {
        key: 'GENERAL_CONDITION',
        category: VisitCategory.PROPERTY_CONDITION,
        step: 1,
        title: 'État général',
        question: "Le logement correspond-il à l'état présenté dans l'annonce ?",
        helpText: 'Vérifiez notamment l’état général des pièces, murs, sols et plafonds.',
        order: 1,
    },

    {
        key: 'HUMIDITY',
        category: VisitCategory.PROPERTY_CONDITION,
        step: 1,
        title: 'Humidité',
        question: "Présence de traces d'humidité, moisissures ou infiltrations ?",
        helpText: 'Regardez les murs, plafonds, angles et autour des fenêtres.',
        order: 2,
        allowCost: true,
    },

    {
        key: 'WINDOWS_DOORS',
        category: VisitCategory.PROPERTY_CONDITION,
        step: 1,
        title: 'Fenêtres et portes',
        question: 'Les fenêtres et portes sont-elles en bon état ?',
        helpText: 'Vérifiez leur ouverture, fermeture, état des joints et vitrages.',
        order: 3,
        allowCost: true,
    },

    // =========================================================
    // 2 — TRAVAUX
    // =========================================================

    {
        key: 'VISIBLE_WORKS',
        category: VisitCategory.WORKS,
        step: 2,
        title: 'Travaux visibles',
        question: 'Des travaux importants semblent-ils nécessaires ?',
        helpText: 'Notez les travaux qui n’étaient pas prévus ou annoncés.',
        order: 4,
        allowCost: true,
    },

    {
        key: 'PLUMBING',
        category: VisitCategory.WORKS,
        step: 2,
        title: 'Plomberie',
        question: "L'installation de plomberie semble-t-elle en bon état ?",
        helpText: 'Testez les robinets, évacuations et recherchez d’éventuelles fuites.',
        order: 5,
        allowCost: true,
    },

    {
        key: 'ELECTRICITY',
        category: VisitCategory.WORKS,
        step: 2,
        title: 'Électricité',
        question: "L'installation électrique semble-t-elle en bon état ?",
        helpText: 'Regardez le tableau électrique et l’état général des installations.',
        order: 6,
        allowCost: true,
    },

    {
        key: 'HEATING',
        category: VisitCategory.WORKS,
        step: 2,
        title: 'Chauffage',
        question: 'Le système de chauffage fonctionne-t-il correctement ?',
        helpText: 'Demandez son âge, son entretien et vérifiez son fonctionnement si possible.',
        order: 7,
        allowCost: true,
    },

    // =========================================================
    // 3 — ÉNERGIE
    // =========================================================

    {
        key: 'DPE_COHERENCE',
        category: VisitCategory.PROPERTY_CONDITION,
        step: 3,
        title: 'Cohérence du DPE',
        question: "L'état constaté semble-t-il cohérent avec le DPE annoncé ?",
        helpText: 'Comparez l’état du logement avec les informations énergétiques disponibles.',
        order: 8,
    },

    {
        key: 'INSULATION',
        category: VisitCategory.PROPERTY_CONDITION,
        step: 3,
        title: 'Isolation',
        question: 'Des signes de mauvaise isolation sont-ils visibles ?',
        helpText: 'Soyez attentif aux murs froids, fenêtres, combles et sensations de courant d’air.',
        order: 9,
        allowCost: true,
    },

    {
        key: 'VENTILATION',
        category: VisitCategory.PROPERTY_CONDITION,
        step: 3,
        title: 'Ventilation',
        question: 'La ventilation ou VMC semble-t-elle fonctionner correctement ?',
        helpText: 'Vérifiez les bouches de ventilation et recherchez condensation ou odeurs persistantes.',
        order: 10,
        allowCost: true,
    },

    // =========================================================
    // 4 — DOCUMENTS
    // =========================================================

    {
        key: 'DIAGNOSTICS',
        category: VisitCategory.DOCUMENTS,
        step: 4,
        title: 'Diagnostics',
        question: 'Les diagnostics obligatoires ont-ils été présentés ?',
        helpText: 'Demandez à consulter les diagnostics disponibles.',
        order: 11,
    },

    {
        key: 'WORK_DOCUMENTS',
        category: VisitCategory.DOCUMENTS,
        step: 4,
        title: 'Justificatifs des travaux',
        question: 'Les travaux importants disposent-ils de justificatifs ?',
        helpText: 'Demandez les factures, garanties et éventuelles attestations.',
        order: 12,
    },

    {
        key: 'CHARGES_DOCUMENTS',
        category: VisitCategory.DOCUMENTS,
        step: 4,
        title: 'Charges',
        question: 'Les charges annoncées correspondent-elles aux documents présentés ?',
        helpText: 'Comparez les informations de l’annonce avec les documents disponibles.',
        order: 13,
    },

    // =========================================================
    // 5 — COPROPRIÉTÉ
    // =========================================================

    {
        key: 'COPROPERTY_CONDITION',
        category: VisitCategory.COPROPERTY,
        step: 5,
        title: 'État de la copropriété',
        question: "L'immeuble et les parties communes sont-ils correctement entretenus ?",
        helpText: 'Observez façade, toiture, hall, escaliers, ascenseur et parties communes.',
        order: 14,
        allowCost: true,
    },

    {
        key: 'COPROPERTY_WORKS',
        category: VisitCategory.COPROPERTY,
        step: 5,
        title: 'Travaux de copropriété',
        question: 'Des travaux importants sont-ils prévus ou déjà votés ?',
        helpText: 'Demandez les derniers procès-verbaux d’assemblée générale.',
        order: 15,
        allowCost: true,
    },

    {
        key: 'COPROPERTY_CHARGES',
        category: VisitCategory.COPROPERTY,
        step: 5,
        title: 'Charges et impayés',
        question: 'Des charges importantes ou des impayés sont-ils signalés ?',
        helpText: 'Vérifiez les charges courantes et les éventuelles difficultés de copropriété.',
        order: 16,
    },

    // =========================================================
    // 6 — INVESTISSEMENT
    // =========================================================

    {
        key: 'RENTAL_APPEAL',
        category: VisitCategory.INVESTMENT,
        step: 6,
        title: 'Attractivité locative',
        question: 'Le logement semble-t-il facilement louable dans son état actuel ?',
        helpText: 'Tenez compte de la configuration, de l’état, de la luminosité et des prestations.',
        order: 17,
    },

    {
        key: 'RENTAL_IMPACT',
        category: VisitCategory.INVESTMENT,
        step: 6,
        title: 'Impact sur la rentabilité',
        question: 'Un élément découvert pendant la visite peut-il réduire la rentabilité ?',
        helpText: 'Pensez notamment aux travaux, charges, loyer potentiel ou contraintes découvertes.',
        order: 18,
        allowCost: true,
    },
];
