    import { Injectable } from '@nestjs/common';

    import { LocationAnalysis, LocationEngineInput, NearbyPlace } from '../../interfaces/location-analysis.interface';

    @Injectable()
    export class LocationEngineService {
        compute(input: LocationEngineInput): LocationAnalysis {
            let score = 30;

            const strengths: string[] = [];
            const weaknesses: string[] = [];
            const badges = new Set<string>();

            // ======================================================
            // TRANSPORT
            // ======================================================

            score += this.evaluateDistance(
                input.transport.metro,
                10,
                'Métro à proximité',
                strengths,
                weaknesses,
                badges,
                '🚇 Très bien desservi',
            );

            score += this.evaluateDistance(
                input.transport.bus,
                4,
                'Arrêt de bus proche',
                strengths,
                weaknesses,
                badges,
                '🚌 Transports accessibles',
            );

            score += this.evaluateDistance(
                input.transport.trainStation,
                5,
                'Gare à proximité',
                strengths,
                weaknesses,
                badges,
                '🚆 Gare proche',
            );

            // ======================================================
            // COMMERCES
            // ======================================================

            score += this.evaluateDistance(
                input.shopping.supermarket,
                7,
                'Supermarché accessible à pied',
                strengths,
                weaknesses,
                badges,
                '🛒 Quartier commerçant',
            );

            score += this.evaluateDistance(
                input.shopping.bakery,
                4,
                'Boulangerie à proximité',
                strengths,
                weaknesses,
                badges,
                '🥖 Vie de quartier',
            );

            // ======================================================
            // EDUCATION
            // ======================================================

            score += this.evaluateDistance(
                input.education.kindergarten,
                4,
                'Crèche proche',
                strengths,
                weaknesses,
                badges,
                '👶 Adapté aux jeunes familles',
            );

            score += this.evaluateDistance(
                input.education.school,
                8,
                'École proche',
                strengths,
                weaknesses,
                badges,
                '👨‍👩‍👧‍👦 Idéal famille',
            );

            score += this.evaluateDistance(
                input.education.highSchool,
                4,
                'Lycée proche',
                strengths,
                weaknesses,
                badges,
                '🎓 Zone scolaire',
            );

            score += this.evaluateDistance(
                input.education.university,
                6,
                'Université proche',
                strengths,
                weaknesses,
                badges,
                '🎓 Quartier étudiant',
            );

            score += this.evaluateDistance(
                input.education.businessSchool,
                6,
                'École de commerce proche',
                strengths,
                weaknesses,
                badges,
                '💼 Pôle étudiant',
            );

            // ======================================================
            // BONUS QUALITE DE VIE
            // ======================================================

            if (input.transport.metro && input.shopping.supermarket) {
                badges.add('🚶 Tout à pied');
                strengths.push('Commodités accessibles sans voiture');
                score += 5;
            }

            // ======================================================
            // NORMALISATION
            // ======================================================

            score = Math.max(0, Math.min(95, Math.round(score)));

            return {
                score,

                property: input.property,

                transport: input.transport,

                shopping: input.shopping,

                education: input.education,

                badges: [...badges],

                strengths,

                weaknesses,
            };
        }

        // ======================================================
        // EVALUATION DISTANCE
        // ======================================================

        private evaluateDistance(
            place: NearbyPlace | undefined,
            weight: number,
            label: string,
            strengths: string[],
            weaknesses: string[],
            badges: Set<string>,
            badge: string,
        ): number {
            if (!place) {
                return 0;
            }

            // Excellent
            if (place.distance <= 300) {
                strengths.push(`${label} (${place.distance} m)`);
                badges.add(badge);
                return weight;
            }

            // Bon
            if (place.distance <= 800) {
                return Math.round(weight * 0.6);
            }

            // Moyen
            if (place.distance <= 1500) {
                return Math.round(weight * 0.3);
            }

            // Éloigné
            weaknesses.push(`${label} éloigné (${place.distance} m)`);

            return 0;
        }
    }
