import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import puppeteer from 'puppeteer';
import { join } from 'path';

@Injectable()
export class ReportService {
    async generateAnalysisPdf(data: any): Promise<Buffer> {
        const logoPath = join(process.cwd(), 'src/report/assets/logo.png');

        const logoBase64 = readFileSync(logoPath).toString('base64');
        const reportDate = new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        }).format(new Date());
        const html = `
<html>

<head>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
    <style>
        @page {
            margin: 0px;
        }


        body {
            font-family: 'DM Sans', Arial, sans-serif;
            background: #0a0e1a;
            color: #ffffffb3;
            margin: 0;
            padding: 40px;
            -webkit-font-smoothing: antialiased;
        }


        .header {
            border-radius: 18px;
            padding: 35px 0 0;

            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            width: 120px;
            border-radius: 20px;
        }

        .brand {
            font-size: 52px;
            font-weight: 800;
            background: linear-gradient(135deg,
                    #fff 0%,
                    #a5b4fc 50%,
                    #ec4899 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }

        .subtitle {
            opacity: 0.7;
            font-size: 14px;
        }

        .generated {
            margin-top: 15px;
            font-size: 12px;
            opacity: 0.7;

        }

        .section {
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .with-2-cards {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
        }

        .with-2-cards .card {
            width: 50%;
            min-height: 420px;
        }

        .card {
            margin-top: 20px;
            background: #111827;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 18px;
            padding: 25px;
            /* break-inside: avoid;
            page-break-inside: avoid; */
        }

        .card h2 {
            margin-top: 0;
        }



        .score {

            width: 120px;
            height: 120px;

            border-radius: 50%;

            background:
                linear-gradient(135deg,
                    #6366f1,
                    #ec4899);


            display: flex;
            align-items: center;
            justify-content: center;

            font-size: 38px;
            font-weight: bold;

        }

        .image-container {
            position: relative;
        }

        .property-image {
            width: 100%;
            height: 300px;
            object-fit: cover;
            border-radius: 18px;
        }


        .image-overlay {

            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;

            padding: 25px;

            background:
                linear-gradient(transparent,
                    rgba(0, 0, 0, .85));

        }


        .overlay-title {
            background: linear-gradient(135deg,
                    #fff 0%,
                    #a5b4fc 50%,
                    #ec4899 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            font-size: 30px;
            font-weight: 700;

        }


        .overlay-info {

            margin-top: 8px;
            opacity: .8;

        }

        .grid {
            display: grid;
            grid-template-columns:
                repeat(2, 1fr);
            gap: 15px;
        }


        .stat {
            background: #0f172a;
            padding: 18px;
            border-radius: 12px;
        }

        ul {
            padding: 0;
        }


        .label {
            font-size: 12px;
            color: #94a3b8;
        }


        .value {
            font-size: 22px;
            font-weight: bold;
            margin-top: 8px;
            background: linear-gradient(135deg,
                    #fff 0%,
                    #a5b4fc 50%,
                    #ec4899 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }



        .verdict {
            font-size: 40px;
            font-weight: 800;
            background: linear-gradient(135deg,
                    #fff 0%,
                    #a5b4fc 50%,
                    #ec4899 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }



        .footer {
            margin-top: 40px;
            text-align: center;
            color: #64748b;
            font-size: 12px;
        }
    </style>

</head>

<body>
    <div class="header">
        <div>
            <div class="brand">
                Rapport d'analyse
            </div>

            <div class="subtitle">
                Analyse immobilière intelligente assistée par IA
            </div>

            <div class="generated">
                Rapport généré le ${reportDate}
            </div>

        </div>

        <img class="logo" src="data:image/png;base64,${logoBase64}" />
    </div>

    <div class="section">
        <div class="card property-image-card" style="padding: 0;">

            <div class="image-container">

                <img src="${data.imageUrl}" class="property-image" alt="Photo du bien" />

                <div class="image-overlay">

                    <div class="overlay-title">
                        ${data.title}
                    </div>

                    <div class="overlay-info">
                        ${data.city}
                        · ${data.surface} m²
                        · ${data.askingPrice} €
                    </div>

                </div>

            </div>

        </div>
    </div>

    <div class="section">
        <div class="card">

            <h2 style="color: #a5b4fc">Résumé exécutif</h2>


            <p>
                Ce bien obtient un <strong>score Apprexia de ${data.score}/100</strong>
                avec un verdict <strong>${data.verdict}</strong>.
            </p>

            <p>
                Le prix affiché est de <strong>${data.askingPrice} €</strong>,
                alors que notre estimation se situe autour de
                <strong>${data.recommendedPrice} €</strong>.
            </p>

            <p>
                ${
                    data.negotiationAmount > 0
                        ? `Une négociation d'environ ${data.negotiationAmount} € est recommandée.`
                        : `Le prix semble cohérent avec le marché actuel.`
                }
            </p>

        </div>
    </div>
    <div class="section">
        <div class="card">
            <h2 style="color: #a5b4fc">
                ${data.title}
            </h2>



            <div class="grid">


                <div class="stat">

                    <div class="label">
                        LOCALISATION
                    </div>

                    <div class="value">
                        ${data.city}
                    </div>

                </div>



                <div class="stat">

                    <div class="label">
                        SURFACE
                    </div>

                    <div class="value">
                        ${data.surface} m²
                    </div>

                </div>



                <div class="stat">

                    <div class="label">
                        PRIX DEMANDÉ
                    </div>

                    <div class="value">
                        ${data.askingPrice} €
                    </div>

                </div>



                <div class="stat">

                    <div class="label">
                        VALEUR APPREXIA
                    </div>

                    <div class="value">
                        ${data.recommendedPrice} €
                    </div>

                </div>


            </div>


        </div>
    </div>
    <div class="section with-2-cards">
        <div class="card" style="margin-right: 20px; min-height: 400px;">
            <h2 style="color: #ec4899">
                Apprexia Score™
            </h2>


            <div class="verdict">
                ${data.score}<span style="font-size: 16px;">/100</span>
            </div>

            <p>
                ${data.scoreExplanation}
            </p>
        </div>
        <div class="card" style="min-height: 400px;">
            <h2 style="color: #4ade80;">
                Verdict
            </h2>



            <div class="verdict">
                ${data.verdict}
            </div>


            <p>
                ${data.verdictExplanation}
            </p>


        </div>
    </div>
    <div class="section">
        <div class="card">


            <h2 style="color: #a5b4fc">
                Négociation recommandée
            </h2>



            <div class="grid">


                <div class="stat">

                    <div class="label">
                        NÉGOCIATION POSSIBLE
                    </div>

                    <div class="value">
                        ${data.negotiationAmount} €
                    </div>


                </div>



                <div class="stat">

                    <div class="label">
                        ÉCART AU MARCHÉ
                    </div>

                    <div class="value">
                        ${data.negotiationPotential} %
                    </div>


                </div>


            </div>


        </div>
    </div>
    <div class="section">
        <div class="card">

            <h2 style="color: #a5b4fc">Position sur le marché</h2>


            <div class="grid">

                <div class="stat">
                    <div class="label">
                        POSITION
                    </div>

                    <div class="value">
                        ${data.marketPosition}
                    </div>
                </div>


                <div class="stat">
                    <div class="label">
                        RISQUE
                    </div>

                    <div class="value" style="font-size: 28px;">
                        ${data.riskLevel}<span style="font-size: 16px;">/100</span>
                    </div>
                </div>

            </div>

            <p>
                ${
                    data.marketPosition === 'SOUS_PRIX'
                        ? 'Le bien semble proposé sous les références du marché.'
                        : data.marketPosition === 'PRIX_MARCHE'
                          ? 'Le prix est cohérent avec les références observées.'
                          : 'Le prix affiché apparaît supérieur aux références disponibles.'
                }
            </p>

        </div>
    </div>

    <div class="section">
        <div class="card">

            <h2 style="color: #ec4899">Estimation Apprexia</h2>


            <div class="grid">

                <div class="stat">

                    <div class="label">
                        FOURCHETTE BASSE
                    </div>

                    <div class="value">
                        ${data.estimatedValueLow} €
                    </div>

                </div>

                <div class="stat">

                    <div class="label">
                        FOURCHETTE HAUTE
                    </div>

                    <div class="value">
                        ${data.estimatedValueHigh} €
                    </div>

                </div>

            </div>

            <p>

                Notre estimation repose sur les ventes DVF,
                les annonces comparables
                et les caractéristiques du bien.

            </p>

        </div>
    </div>

    <div class="section">
        <div class="card">

            <h2 style="color: #f9a8d4">Potentiel locatif</h2>


            <div class="grid">

                <div class="stat">

                    <div class="label">
                        LOYER ESTIMÉ
                    </div>

                    <div class="value">
                        ${data.estimatedRentMonthly ?? '-'} €
                    </div>

                </div>


                <div class="stat">

                    <div class="label">
                        RENDEMENT
                    </div>

                    <div class="value">
                        ${data.grossYield ?? '-'} %
                    </div>

                </div>

            </div>

            <p>

                ${data.yieldAnalysis}

            </p>

        </div>
    </div>

    <div class="section with-2-cards">
        <div class="card" style="margin-right: 20px;">

            <h2 style="color: #4ade80">Points forts</h2>


            <ul>

                ${data.strengths
                    .map(
                        (item) => `
                <li style="margin-bottom:10px; list-style-type: none;">
                    ✅ ${item}
                </li>`,
                    )
                    .join('')}

            </ul>

        </div>
        <div class="card">

            <h2 style="color: #fbbf24">Points de vigilance</h2>


            <ul>

                ${data.risks
                    .map(
                        (item) => `
                <li style="margin-bottom:10px; list-style-type: none;">
                    ⚠️ ${item}
                </li>`,
                    )
                    .join('')}

            </ul>

        </div>
    </div>

    <div class="section">

        <div class="card">

            <h2 style="color: #ec4899">Conclusion Apprexia</h2>


            <p>

                ${data.verdictExplanation}

            </p>

            <p>

                Notre estimation situe la valeur du bien autour de
                <strong>${data.recommendedPrice} €</strong>.

                ${
                    data.negotiationAmount > 0
                        ? `Une offre comprise entre
                ${data.recommendedPrice} € et
                ${data.askingPrice} €
                semble cohérente au regard des données du marché.`
                        : `Le prix apparaît cohérent avec les références disponibles.`
                }

            </p>

        </div>

    </div>

    <div class="card">

        <h2 style="color: #a5b4fc">À propos de cette analyse</h2>


        <p>

            Cette analyse est générée automatiquement par Apprexia à partir des données publiques DVF, des annonces
            immobilières comparables, des estimations locatives et d'un modèle d'intelligence artificielle. Elle
            constitue une aide à la décision et ne remplace pas l'expertise d'un professionnel de l'immobilier.

        </p>

    </div>

    <div class="footer">
        Rapport généré automatiquement par Apprexia • L'intelligence artificielle au service de l'investissement
        immobilier
    </div>
</body>

</html>
`;

        const browser = await puppeteer.launch({
            executablePath: '/ms-playwright/chromium-*/chrome-linux/chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();

        await page.setContent(html);
        await page.emulateMediaType('screen');
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
        });

        await browser.close();

        return Buffer.from(pdf);
    }
}
