import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

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
        const propertyImage = await this.getPropertyImage(data.imageUrl);

        const html = `

<style>
    /* =========================================================
   A4 — FULL BLEED DARK
========================================================= */

    @page {
        size: A4;
        margin: 0;
    }

    * {
        box-sizing: border-box;
    }

    html,
    body {
        margin: 0;
        padding: 0;
        width: 100%;
        min-height: 100%;
    }

    body {
        font-family: 'DM Sans', Arial, sans-serif;

        background: #0a0e1a;
        color: #f8fafc;

        font-size: 15px;
        line-height: 1.5;

        -webkit-font-smoothing: antialiased;

        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
    }


    /* =========================================================
   DESIGN TOKENS
========================================================= */

    :root {
        --bg: #171d3f;

        --surface: rgba(255, 255, 255, 0.045);
        --surface-2: rgba(255, 255, 255, 0.07);

        --border: rgba(255, 255, 255, 0.10);
        --border-soft: rgba(255, 255, 255, 0.065);

        --text: #f8fafc;
        --text-soft: #c2c8da;
        --text-muted: #858eaa;

        --accent: #a5b4fc;
        --accent-strong: #818cf8;

        --pink: #ec4899;

        --green: #86efac;
        --orange: #fbbf24;
    }


    /* =========================================================
   PAGE
========================================================= */

    .page {
        position: relative;

        width: 100%;
        min-height: 297mm;

        padding: 14mm 17mm 11mm;

        overflow: hidden;

        background: radial-gradient(circle at 92% 4%, rgba(129, 140, 248, 0.12), transparent 25%), radial-gradient(circle at 5% 48%, rgba(236, 72, 153, 0.045), transparent 22%), #121932
    }


    /* =========================================================
   HEADER
========================================================= */

    .header {
        display: flex;

        justify-content: space-between;
        align-items: flex-start;

        padding-bottom: 13px;

        border-bottom: 1px solid var(--border);
    }

    .brand-wrapper {
        display: flex;
        flex-direction: column;
    }

    .brand {
        font-size: 24px;
        line-height: 1;
        font-weight: 600;
        letter-spacing: 3.6px;
        color: var(--accent);
        font-family: "Inconsolata", monospace;
    }

    .brand span {
        color: #ec4899;
    }

    .subtitle {
        margin-top: 5px;

        color: var(--text-soft);

        font-size: 11px;
    }

    .generated {
        margin-top: 3px;

        color: var(--text-muted);

        font-size: 9px;
    }

    .logo {
        width: 78px;
        height: auto;
    }


    /* =========================================================
   REPORT TAG
========================================================= */

    .report-tag {
        display: inline-flex;

        align-items: center;

        margin-top: 13px;

        padding: 5px 9px;

        border: 1px solid var(--border);

        border-radius: 20px;

        background: rgba(255, 255, 255, .035);

        color: var(--text-muted);

        font-size: 9px;

        text-transform: uppercase;

        letter-spacing: 1px;
    }


    /* =========================================================
   PROPERTY HERO
========================================================= */

    .property-hero {
        position: relative;

        display: grid;

        grid-template-columns: 44% 56%;

        height: 154px;

        margin-top: 13px;

        overflow: hidden;

        border: 1px solid var(--border);

        border-radius: 10px;

        background: rgba(255, 255, 255, .035);
    }

    .property-image-wrapper {
        position: relative;

        min-height: 154px;

        overflow: hidden;
    }

    .property-image-wrapper::after {
        content: "";

        position: absolute;

        inset: 0;

        background:
            linear-gradient(90deg,
                transparent 55%,
                rgba(23, 29, 63, .35) 100%);
    }

    .property-image {
        width: 100%;
        height: 100%;

        object-fit: cover;
    }

    .property-info {
        position: relative;

        display: flex;

        flex-direction: column;

        justify-content: center;

        padding: 0px 24px;
    }

    .property-kicker {
        margin-bottom: 6px;

        color: var(--accent);

        font-size: 9px;

        font-weight: 700;

        text-transform: uppercase;

        letter-spacing: 1.5px;
    }

    .property-title {
        margin: 0;

        color: var(--text);

        font-size: 18px;

        line-height: 1.15;

        font-weight: 750;

        letter-spacing: -.5px;
    }

    .property-location {
        margin-top: 6px;

        color: var(--text-soft);

        font-size: 11px;
    }

    .property-meta {
        display: flex;

        gap: 20px;

        margin-top: 16px;

        padding-top: 12px;

        border-top: 1px solid var(--border-soft);
    }

    .meta-item {
        display: flex;

        flex-direction: column;
    }

    .meta-label {
        color: var(--text-muted);

        font-size: 9.5px;

        font-weight: 600;

        text-transform: uppercase;

        letter-spacing: 1px;
    }

    .meta-value {
        margin-top: 3px;

        color: var(--text);

        font-size: 12px;

        font-weight: 700;
    }


    /* =========================================================
   SECTION
========================================================= */

    .section {
        margin-top: 15px;

        break-inside: avoid;
        page-break-inside: avoid;
    }

    .section-heading {
        display: flex;

        align-items: center;

        gap: 8px;

        margin-bottom: 8px;
    }

    .section-number {
        display: flex;

        align-items: center;
        justify-content: center;

        width: 18px;
        height: 18px;

        border-radius: 5px;

        background: rgba(129, 140, 248, .14);

        color: var(--pink);

        font-size: 9px;

        font-weight: 700;
    }

    .section-title {
        margin: 0;

        color: var(--text);

        font-size: 12px;

        font-weight: 700;

        text-transform: uppercase;

        letter-spacing: 1.3px;
    }

    .section-line {
        flex: 1;

        height: 1px;

        background: var(--border-soft);
    }


    /* =========================================================
   SUMMARY
========================================================= */

    .summary {
        overflow: hidden;
        position: relative;

        padding: 12px 16px;

        border: 1px solid var(--border);

        border-radius: 8px;

        background:
            linear-gradient(110deg,
                rgba(129, 140, 248, .08),
                rgba(255, 255, 255, .025));
    }

    .summary::before {
        content: "";

        position: absolute;

        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;

        background: linear-gradient(180deg,
                #818cf8,
                #ec4899);

        border-radius: 3px;
    }

    .summary-text {
        margin: 0;
        padding-left: 4px;
        font-family: "Inconsolata", monospace;
        color: var(--text-soft);

        font-size: 10px;

        line-height: 1.55;
    }

    .summary strong {
        color: var(--text);
    }


    /* =========================================================
   KEY METRICS
========================================================= */

    .decision {
        display: grid;

        grid-template-columns:
            1fr 1fr 1fr 1fr;

        overflow: hidden;

        border: 1px solid var(--border);

        border-radius: 9px;

        background: rgba(255, 255, 255, .025);
    }

    .decision-item {
        position: relative;

        padding: 12px 14px;

        border-right: 1px solid var(--border-soft);
    }

    .decision-item:last-child {
        border-right: none;
    }

    .decision-item:first-child::before {
        content: "";

        position: absolute;

        left: 0;
        top: 0;
        bottom: 0;

        width: 3px;

        background: linear-gradient(180deg,
                #818cf8,
                #ec4899);
    }

    .decision-label {
        color: var(--text-muted);

        font-size: 8.5px;

        font-weight: 600;

        text-transform: uppercase;

        letter-spacing: 1px;
    }

    .decision-value {
        margin-top: 5px;

        color: var(--text);

        font-size: 17px;

        line-height: 1;

        font-weight: 800;

        letter-spacing: -.3px;
    }

    .decision-value.accent {
        color: var(--accent);
    }

    .decision-value.verdict {
        font-size: 13px;

        letter-spacing: .2px;
    }

    .decision-sub {
        margin-top: 4px;

        color: var(--text-muted);

        font-size: 9px;
    }


    /* =========================================================
   TWO COLUMNS
========================================================= */

    .two-columns {
        display: grid;

        grid-template-columns: 1fr 1fr;

        gap: 34px;
    }

    .column {
        min-width: 0;
    }


    /* =========================================================
   DATA TABLE
========================================================= */

    .data-table {
        width: 100%;

        border-collapse: collapse;
    }

    .data-table tr {
        border-bottom: 1px solid var(--border-soft);
    }

    .data-table tr:last-child {
        border-bottom: none;
    }

    .data-table td {
        padding: 6px 2px;
        font-size: 12px;
    }

    .data-label {
        color: var(--text-muted);

        font-size: 10.5px;
    }

    .data-value {
        text-align: right;

        color: var(--text);

        font-size: 10.5px;

        font-weight: 700;
    }

    .data-value.accent {
        color: var(--accent);
    }


    /* =========================================================
   SCORE
========================================================= */

    .score-panel {
        display: flex;

        align-items: center;

        gap: 16px;

        padding: 12px 14px;

        border: 1px solid var(--border);

        border-radius: 8px;

        background: var(--surface);
    }

    .score-ring {
        display: flex;

        align-items: center;
        justify-content: center;

        width: 62px;
        height: 62px;

        flex-shrink: 0;

        border-radius: 50%;

        background: radial-gradient(circle at center,
            #171d3f 62%,
            transparent 63%),
        conic-gradient(#818cf8 0deg,
            #a5b4fc $ {
                data.score * 3.6
            }

            deg,
            rgba(255, 255, 255, .08) $ {
                data.score * 3.6
            }

            deg,
            rgba(255, 255, 255, .08) 360deg);
    }

    .score-ring-value {
        font-size: 17px;

        font-weight: 800;

        color: var(--text);
    }

    .score-ring-value span {
        font-size: 9px;

        color: var(--text-muted);
    }

    .score-description {
        color: var(--text-soft);

        font-size: 9px;
        font-family: "Inconsolata", monospace;
        line-height: 1.5;
    }


    /* =========================================================
   VERDICT
========================================================= */

    .verdict-panel {
        position: relative;

        padding: 12px 15px;

        overflow: hidden;

        border: 1px solid var(--border);

        border-radius: 8px;

        background:
            linear-gradient(120deg,
                rgba(129, 140, 248, .10),
                rgba(236, 72, 153, .045));
    }

    .verdict-panel::after {
        content: "";

        position: absolute;

        width: 100px;
        height: 100px;

        right: -45px;
        top: -55px;

        border-radius: 50%;

        background: rgba(129, 140, 248, .08);
    }

    .verdict-label {
        color: var(--text-muted);

        font-size: 8.5px;

        text-transform: uppercase;

        letter-spacing: 1px;
    }

    .verdict-value {
        margin-top: 3px;

        color: var(--text);

        font-size: 21px;

        line-height: 1.1;

        font-weight: 800;
    }

    .verdict-description {
        margin: 5px 0 0;
        font-family: "Inconsolata", monospace;
        color: var(--text-soft);

        font-size: 9px;

        line-height: 1.45;
    }


    /* =========================================================
   ESTIMATE
========================================================= */

    .estimate {
        padding: 13px 16px;

        border: 1px solid var(--border);

        border-radius: 8px;

        background: var(--surface);
    }

    .estimate-main {
        display: flex;

        justify-content: space-between;

        align-items: flex-end;
    }

    .estimate-value {
        margin-top: 3px;

        color: var(--text);

        font-size: 25px;

        line-height: 1;

        font-weight: 800;
    }

    .estimate-range {
        color: var(--text-soft);

        font-size: 10px;
    }

    .range {
        position: relative;

        height: 5px;

        margin: 13px 0 8px;

        overflow: hidden;

        border-radius: 20px;

        background: rgba(255, 255, 255, .08);
    }

    .range-fill {
        position: absolute;

        left: 18%;
        right: 18%;

        height: 100%;

        border-radius: 20px;

        background: linear-gradient(90deg,
                #6366f1,
                #a5b4fc,
                #ec4899);
    }

    .estimate-description {
        margin: 0;

        color: var(--text-muted);

        font-size: 9.5px;
    }


    /* =========================================================
   LISTS
========================================================= */

    .clean-list {
        margin: 0;

        padding: 0;

        list-style: none;
    }

    .clean-list li {
        display: flex;

        align-items: flex-start;

        gap: 7px;

        padding: 5px 0;

        border-bottom: 1px solid var(--border-soft);

        color: var(--text-soft);

        font-size: 10.5px;

        line-height: 1.45;
    }

    .clean-list li:last-child {
        border-bottom: none;
    }

    .check {
        display: inline-flex;

        align-items: center;
        justify-content: center;

        width: 16px;
        height: 16px;

        flex-shrink: 0;

        border-radius: 50%;

        background: rgba(134, 239, 172, .10);

        color: var(--green);

        font-size: 9px;

        font-weight: 800;
    }

    .warning {
        display: inline-flex;

        align-items: center;
        justify-content: center;

        width: 16px;
        height: 16px;

        flex-shrink: 0;

        border-radius: 50%;

        background: rgba(251, 191, 36, .10);

        color: var(--orange);

        font-size: 9px;

        font-weight: 800;
    }


    /* =========================================================
   CONCLUSION
========================================================= */

    .conclusion {
        position: relative;

        margin-top: 15px;

        padding: 14px 17px;

        overflow: hidden;

        border: 1px solid rgba(165, 180, 252, .18);

        border-radius: 9px;

        background:
            linear-gradient(115deg,
                rgba(99, 102, 241, .13),
                rgba(236, 72, 153, .055));
    }

    .conclusion::before {
        content: "";

        position: absolute;

        top: -55px;
        right: -35px;

        width: 140px;
        height: 140px;

        border-radius: 50%;

        background: rgba(165, 180, 252, .08);
    }

    .conclusion-title {
        position: relative;

        margin: 0 0 6px;

        color: var(--text);

        font-size: 13px;

        font-weight: 750;
    }

    .conclusion p {
        position: relative;
        font-family: "Inconsolata", monospace;
        margin: 5px 0;

        color: var(--text-soft);

        font-size: 10.5px;

        line-height: 1.5;
    }

    .conclusion strong {
        color: var(--text);
    }


    /* =========================================================
   METHODOLOGY
========================================================= */

    .methodology {
        margin-top: 12px;

        padding-top: 9px;

        border-top: 1px solid var(--border);

        color: var(--text-muted);

        font-size: 9px;

        line-height: 1.45;
    }

    .methodology strong {
        color: var(--text-soft);
    }


    /* =========================================================
   FOOTER
========================================================= */

    .footer {
        display: flex;

        justify-content: space-between;

        margin-top: 9px;

        padding-top: 7px;

        border-top: 1px solid var(--border);

        color: var(--text-muted);

        font-size: 9px;
    }


    /* =========================================================
   PAGE BREAK
========================================================= */

    .page-break {
        page-break-before: always;
    }
</style>


<!-- =====================================================
     PAGE 1
===================================================== -->

<div class="page">


    <div class="header">

        <div class="brand-wrapper">

            <div class="brand">
                RAPPORT D'ANALYSE
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


    <div class="report-tag">
        Analyse immobilière · Intelligence décisionnelle
    </div>


    <!-- PROPERTY -->

    <div class="property-hero">

        <div class="property-image-wrapper">

            <img src="${propertyImage}" class="property-image"
                alt="Photo du bien" />

        </div>


        <div class="property-info">

            <div class="property-kicker">
                Bien analysé
            </div>

            <h1 class="property-title">
                ${data.title}
            </h1>

            <div class="property-location">
                ${data.city}
            </div>


            <div class="property-meta">

                <div class="meta-item">

                    <span class="meta-label">
                        Type
                    </span>

                    <span class="meta-value">
                        ${data.typeLocal ?? '—'}
                    </span>

                </div>


                <div class="meta-item">

                    <span class="meta-label">
                        Surface
                    </span>

                    <span class="meta-value">
                        ${data.surface} m²
                    </span>

                </div>


                <div class="meta-item">

                    <span class="meta-label">
                        Prix affiché
                    </span>

                    <span class="meta-value">
                        ${data.askingPrice} €
                    </span>

                </div>

            </div>

        </div>

    </div>


    <!-- SUMMARY -->

    <div class="section">

        <div class="section-heading">

            <div class="section-number">
                01
            </div>

            <h2 class="section-title">
                Synthèse décisionnelle
            </h2>

            <div class="section-line"></div>

        </div>


        <div class="summary">

            <p class="summary-text">

                Ce bien obtient un
                <strong>score Apprexia de ${data.score}/100</strong>
                et un verdict
                <strong>${data.verdict}</strong>.

                Le prix affiché de
                <strong>${data.askingPrice} €</strong>
                est comparé à une valeur estimée de
                <strong>${data.recommendedPrice} €</strong>.

                ${
          data.negotiationAmount > 0

            ? `L'analyse identifie un potentiel de négociation
                d'environ <strong>${data.negotiationAmount} €</strong>.`

            : `Le prix apparaît cohérent avec les références
                de marché disponibles.`
        }

            </p>

        </div>

    </div>


    <!-- KEY METRICS -->

    <div class="section">

        <div class="decision">


            <div class="decision-item">

                <div class="decision-label">
                    Score Apprexia
                </div>

                <div class="decision-value accent">
                    ${data.score}
                    <span style="font-size:10px;color:#858eaa;">
                        /100
                    </span>
                </div>

                <div class="decision-sub">
                    Niveau global
                </div>

            </div>


            <div class="decision-item">

                <div class="decision-label">
                    Verdict
                </div>

                <div class="decision-value verdict">
                    ${data.verdict}
                </div>

                <div class="decision-sub">
                    Décision Apprexia
                </div>

            </div>


            <div class="decision-item">

                <div class="decision-label">
                    Valeur estimée
                </div>

                <div class="decision-value">
                    ${data.recommendedPrice} €
                </div>

                <div class="decision-sub">
                    Estimation centrale
                </div>

            </div>


            <div class="decision-item">

                <div class="decision-label">
                    Écart au marché
                </div>

                <div class="decision-value">
                    ${data.negotiationPotential} %
                </div>

                <div class="decision-sub">
                    Potentiel identifié
                </div>

            </div>

        </div>

    </div>


    <!-- MARKET -->

    <div class="section">

        <div class="two-columns">


            <div class="column">

                <div class="section-heading">

                    <div class="section-number">
                        02
                    </div>

                    <h2 class="section-title">
                        Position sur le marché
                    </h2>

                    <div class="section-line"></div>

                </div>


                <table class="data-table">

                    <tr>

                        <td class="data-label">
                            Position
                        </td>

                        <td class="data-value accent">
                            ${data.marketPosition}
                        </td>

                    </tr>


                    <tr>

                        <td class="data-label">
                            Prix demandé
                        </td>

                        <td class="data-value">
                            ${data.askingPrice} €
                        </td>

                    </tr>


                    <tr>

                        <td class="data-label">
                            Valeur Apprexia
                        </td>

                        <td class="data-value">
                            ${data.recommendedPrice} €
                        </td>

                    </tr>


                    <tr>

                        <td class="data-label">
                            Écart identifié
                        </td>

                        <td class="data-value">
                            ${data.negotiationPotential} %
                        </td>

                    </tr>

                </table>

            </div>


            <div class="column">

                <div class="section-heading">

                    <div class="section-number">
                        03
                    </div>

                    <h2 class="section-title">
                        Négociation
                    </h2>

                    <div class="section-line"></div>

                </div>


                <table class="data-table">

                    <tr>

                        <td class="data-label">
                            Offre indicative
                        </td>

                        <td class="data-value">
                            ${data.recommendedPrice} €
                        </td>

                    </tr>


                    <tr>

                        <td class="data-label">
                            Négociation estimée
                        </td>

                        <td class="data-value accent">

                            ${
          data.negotiationAmount > 0
            ? `${data.negotiationAmount} €`
            : 'Aucune'
        }

                        </td>

                    </tr>


                    <tr>

                        <td class="data-label">
                            Prix affiché
                        </td>

                        <td class="data-value">
                            ${data.askingPrice} €
                        </td>

                    </tr>

                </table>

            </div>

        </div>

    </div>


    <!-- SCORE / VERDICT -->

    <div class="section">

        <div class="two-columns">


            <div class="column">

                <div class="section-heading">

                    <div class="section-number">
                        04
                    </div>

                    <h2 class="section-title">
                        Score Apprexia™
                    </h2>

                    <div class="section-line"></div>

                </div>


                <div class="score-panel">

                    <div class="score-ring">

                        <div class="score-ring-value">

                            ${data.score}

                            <span>
                                /100
                            </span>

                        </div>

                    </div>


                    <div class="score-description">
                        ${data.scoreExplanation}
                    </div>

                </div>

            </div>


            <div class="column">

                <div class="section-heading">

                    <div class="section-number">
                        05
                    </div>

                    <h2 class="section-title">
                        Verdict
                    </h2>

                    <div class="section-line"></div>

                </div>


                <div class="verdict-panel">

                    <div class="verdict-label">
                        Décision Apprexia
                    </div>

                    <div class="verdict-value">
                        ${data.verdict}
                    </div>

                    <p class="verdict-description">
                        ${data.verdictExplanation}
                    </p>

                </div>

            </div>

        </div>

    </div>


    <div class="footer">

        <span>
            APPREXIA — Intelligence décisionnelle immobilière
        </span>

        <span>
            Analyse confidentielle
        </span>

    </div>

</div>


<!-- =====================================================
     PAGE 2
===================================================== -->

<div class="page page-break">


    <!-- ESTIMATION -->

    <div class="section" style="margin-top:0;">

        <div class="section-heading">

            <div class="section-number">
                06
            </div>

            <h2 class="section-title">
                Estimation Apprexia
            </h2>

            <div class="section-line"></div>

        </div>


        <div class="estimate">

            <div class="estimate-main">

                <div>

                    <div class="meta-label">
                        Valeur estimée
                    </div>

                    <div class="estimate-value">
                        ${data.recommendedPrice} €
                    </div>

                </div>


                <div class="estimate-range">

                    ${data.estimatedValueLow}
                    €
                    &nbsp;—&nbsp;
                    ${data.estimatedValueHigh}
                    €

                </div>

            </div>


            <div class="range">

                <div class="range-fill"></div>

            </div>


            <p class="estimate-description">

                Estimation construite à partir des références DVF,
                des annonces comparables et des caractéristiques
                du bien analysé.

            </p>

        </div>

    </div>


    <!-- RENTAL -->

    <div class="section">

        <div class="two-columns">


            <div class="column">

                <div class="section-heading">

                    <div class="section-number">
                        07
                    </div>

                    <h2 class="section-title">
                        Potentiel locatif
                    </h2>

                    <div class="section-line"></div>

                </div>


                <table class="data-table">

                    <tr>

                        <td class="data-label">
                            Loyer mensuel estimé
                        </td>

                        <td class="data-value">
                            ${data.estimatedRentMonthly ?? '—'} €
                        </td>

                    </tr>


                    <tr>

                        <td class="data-label">
                            Rendement brut
                        </td>

                        <td class="data-value accent">
                            ${data.grossYield ?? '—'} %
                        </td>

                    </tr>

                </table>


                <p style="
                        margin:8px 0 0;
                        color:#858eaa;
                        font-size:10.5px;
                        line-height:1.5;
                    ">
                    ${data.yieldAnalysis}
                </p>

            </div>


            <div class="column">

                <div class="section-heading">

                    <div class="section-number">
                        08
                    </div>

                    <h2 class="section-title">
                        Lecture du marché
                    </h2>

                    <div class="section-line"></div>

                </div>


                <p style="
                        margin:0;
                        color:#c2c8da;
                        font-size:11px;
                        line-height:1.55;
                    ">

                    ${
          data.marketPosition === 'SOUS_PRIX'

            ? 'Le bien semble proposé sous les références du marché observées.'

            : data.marketPosition === 'PRIX_MARCHE'

              ? 'Le prix apparaît cohérent avec les références de marché disponibles.'

              : 'Le prix affiché apparaît supérieur aux références disponibles.'
        }

                </p>

            </div>

        </div>

    </div>


    <!-- STRENGTHS / RISKS -->

    <div class="section">

        <div class="two-columns">


            <div class="column">

                <div class="section-heading">

                    <div class="section-number">
                        09
                    </div>

                    <h2 class="section-title">
                        Points forts
                    </h2>

                    <div class="section-line"></div>

                </div>


                <ul class="clean-list">

                    ${data.strengths

          .map(

            (item) => `

                    <li>

                        <span class="check">
                            ✓
                        </span>

                        <span>
                            ${item}
                        </span>

                    </li>

                    `

          )

          .join('')}

                </ul>

            </div>


            <div class="column">

                <div class="section-heading">

                    <div class="section-number">
                        10
                    </div>

                    <h2 class="section-title">
                        Points de vigilance
                    </h2>

                    <div class="section-line"></div>

                </div>


                <ul class="clean-list">

                    ${data.risks

          .map(

            (item) => `

                    <li>

                        <span class="warning">
                            !
                        </span>

                        <span>
                            ${item}
                        </span>

                    </li>

                    `

          )

          .join('')}

                </ul>

            </div>

        </div>

    </div>


    <!-- CONCLUSION -->

    <div class="section">

        <div class="section-heading">

            <div class="section-number">
                11
            </div>

            <h2 class="section-title">
                Conclusion
            </h2>

            <div class="section-line"></div>

        </div>


        <div class="conclusion">

            <h2 class="conclusion-title">
                Conclusion Apprexia
            </h2>


            <p>
                ${data.verdictExplanation}
            </p>


            <p>

                La valeur centrale estimée par Apprexia est de
                <strong>${data.recommendedPrice} €</strong>.

                ${
          data.negotiationAmount > 0

            ? `Une offre autour de
                <strong>${data.recommendedPrice} €</strong>
                apparaît cohérente au regard des références
                analysées, avec un potentiel de négociation
                estimé à
                <strong>${data.negotiationAmount} €</strong>.`

            : `Le prix affiché apparaît cohérent avec les
                références disponibles sur le marché.`
        }

            </p>

        </div>

    </div>


    <!-- METHODOLOGY -->

    <div class="methodology">

        <strong>À propos de cette analyse</strong><br>

        Cette analyse est générée automatiquement par Apprexia à partir
        de données publiques DVF, de références immobilières comparables,
        d'estimations locatives et de modèles d'intelligence artificielle.

        Les résultats constituent une aide à la décision et ne remplacent
        pas l'expertise ou l'avis d'un professionnel de l'immobilier.

    </div>


    <!-- FOOTER -->

    <div class="footer">

        <span>
            APPREXIA — Intelligence décisionnelle immobilière
        </span>

        <span>
            Rapport confidentiel
        </span>

    </div>

</div>

`;
        let browser;

        if (process.env.PDF_BROWSER === 'playwright') {
            const chromiumDir = readdirSync('/ms-playwright').find((dir) => dir.startsWith('chromium-'));

            if (!chromiumDir) {
                throw new Error('Chromium Playwright introuvable');
            }

            const executablePath = `/ms-playwright/${chromiumDir}/chrome-linux64/chrome`;

            if (!existsSync(executablePath)) {
                throw new Error(`Chromium introuvable : ${executablePath}`);
            }

            browser = await puppeteer.launch({
                executablePath,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        } else if (process.env.PDF_BROWSER === 'puppeteer') {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        } else {
            throw new Error(`PDF_BROWSER invalide : ${process.env.PDF_BROWSER}`);
        }

        try {
            const page = await browser.newPage();

            await page.setContent(html, {
                waitUntil: 'networkidle0',
            });

            await page.emulateMediaType('screen');

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
            });

            return Buffer.from(pdf);
        } finally {
            await browser.close();
        }
    }

    private async getPropertyImage(imageUrl: string | null | undefined): Promise<string> {
        const placeholderUrl = `${process.env.FRONTEND_URL}/images/placeholder.png`;

        try {
            if (!imageUrl) {
                return placeholderUrl;
            }

            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 5000,
            });

            const contentType = String(
              response.headers['content-type'] ?? '',
            );

            if (!contentType.startsWith('image/')) {
                return placeholderUrl;
            }

            const base64 = Buffer.from(response.data).toString('base64');

            return `data:${contentType};base64,${base64}`;
        } catch (error) {
            console.warn('Impossible de charger image annonce, utilisation du placeholder', imageUrl);

            return placeholderUrl;
        }
    }
}
