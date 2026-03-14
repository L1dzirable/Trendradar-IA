import { Router, Request, Response } from "express";
import puppeteer                      from "puppeteer";
import { requireAuth }                from "../middleware/requireAuth";
import { requirePlan } from "../middleware/requirePlan";
import { getCachedOpportunities }     from "../services/opportunityEngine";
import type { EnrichedOpportunity } from "../../shared/signals";

const router = Router();

// POST /api/export/pdf
// Body : { indices: number[], reportTitle?: string }
router.post(
  "/pdf",
  requireAuth,
  requirePlan(["pro", "agency"]),
  async (req: Request, res: Response): Promise<void> => {
    const { indices, reportTitle } = req.body as {
      indices:      number[];
      reportTitle?: string;
    };

    if (!indices?.length || indices.length > 20) {
      res.status(400).json({ error: "Entre 1 et 20 indices requis" });
      return;
    }

    const all  = await getCachedOpportunities();
    const opps = indices
      .map((i) => all[i])
      .filter(Boolean) as EnrichedOpportunity[];

    if (!opps.length) {
      res.status(404).json({ error: "Aucune opportunité trouvée" });
      return;
    }

    const html = buildReportHTML({
      title:       reportTitle ?? "Rapport d'Opportunités Marché",
      opps,
      generatedAt: new Date(),
      isAgency:    req.user!.plan === "agency",
    });

    const browser = await puppeteer.launch({
      headless: true,
      args:     ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format:          "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });

    await browser.close();

    // await logUsage(req.user!.id, "pdfExportsPerMonth");

    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="trendradar-${Date.now()}.pdf"`,
      "Content-Length":      pdf.length,
    });

    res.send(Buffer.from(pdf));
  }
);

export default router;

// ── Template HTML ────────────────────────────────────────────────────────────

function buildReportHTML(opts: {
  title:       string;
  opps:        EnrichedOpportunity[];
  generatedAt: Date;
  isAgency:    boolean;
}): string {
  const { title, opps, generatedAt, isAgency } = opts;

  const rows = opps.map((opp, i) => `
    <div class="opp">
      <div class="opp-header">
        <span class="num">${i + 1}</span>
        <h2>${esc(opp.trendName)}</h2>
        <span class="score">${opp.opportunityLabel} · ${opp.opportunityScore}/100</span>
      </div>
      <span class="category">${esc(opp.topic ?? "")}</span>
      <p class="desc">${esc(opp.explanation)}</p>
      <p class="idea"><strong>Idée business :</strong> ${esc(opp.businessIdea)}</p>
      <p class="mono"><strong>Monétisation :</strong> ${esc(opp.monetization)}</p>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; }

  .cover {
    height: 100vh;
    display: flex; flex-direction: column; justify-content: center;
    padding: 60px;
    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
    color: white;
    page-break-after: always;
  }
  .cover .label  { font-size:13px; letter-spacing:4px; opacity:.6; margin-bottom:32px; }
  .cover h1      { font-size:40px; font-weight:700; line-height:1.2; margin-bottom:16px; }
  .cover .meta   { font-size:13px; opacity:.5; margin-top:48px; }
  .cover .powered { font-size:11px; opacity:.3; margin-top:6px; }

  .content { padding: 40px 60px; }

  .opp {
    padding: 28px 0;
    border-bottom: 1px solid #eee;
    page-break-inside: avoid;
  }
  .opp-header { display:flex; align-items:center; gap:14px; margin-bottom:10px; }
  .num {
    width:30px; height:30px; border-radius:50%;
    background:#302b63; color:#fff;
    display:flex; align-items:center; justify-content:center;
    font-size:12px; font-weight:700; flex-shrink:0;
  }
  .opp-header h2 { font-size:17px; font-weight:600; flex:1; }
  .score {
    background:#f0fdf4; color:#16a34a;
    padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600;
  }
  .category {
    display:inline-block;
    background:#ede9fe; color:#6d28d9;
    padding:2px 10px; border-radius:20px;
    font-size:11px; font-weight:500; margin-bottom:10px;
  }
  .desc { font-size:13px; line-height:1.7; color:#444; margin-bottom:8px; }
  .idea, .mono { font-size:12px; color:#555; line-height:1.6; margin-bottom:4px; }

  .footer {
    text-align:center; padding:30px;
    font-size:11px; color:#aaa;
    border-top:1px solid #eee; margin-top:40px;
  }
</style>
</head>
<body>

<div class="cover">
  <div class="label">TRENDRADAR</div>
  <h1>${esc(title)}</h1>
  <div class="meta">
    ${opps.length} opportunité${opps.length > 1 ? "s" : ""} analysée${opps.length > 1 ? "s" : ""}
    · ${generatedAt.toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" })}
  </div>
  ${isAgency ? `<div class="powered">Powered by TrendRadar</div>` : ""}
</div>

<div class="content">${rows}</div>

<div class="footer">
  Rapport généré par TrendRadar · Intelligence de marché · trendradar.io
</div>

</body>
</html>`;
}

function esc(str: unknown): string {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}