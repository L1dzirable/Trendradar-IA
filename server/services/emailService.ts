import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendConfirmationEmail(email: string, trendSlug?: string): Promise<boolean> {
  try {
    const subject = trendSlug
      ? `Confirm your alert for ${trendSlug}`
      : "Confirm your weekly digest subscription";

    const message = trendSlug
      ? `You've subscribed to alerts for trend: ${trendSlug}. You'll receive notifications when this trend changes lifecycle stage.`
      : "You've subscribed to the weekly digest. You'll receive the top opportunities and lifecycle changes every week.";

    await resend.emails.send({
      from: "TrendRadar <alerts@trendradar.app>",
      to: email,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #0a0f1a; font-size: 24px; margin-bottom: 16px;">Subscription Confirmed</h1>
          <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            ${message}
          </p>
          <p style="color: #64748b; font-size: 14px;">
            Thank you for subscribing to TrendRadar alerts.
          </p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
    return false;
  }
}

export async function sendWeeklyDigest(
  email: string,
  topOpportunities: any[],
  lifecycleChanges: any[]
): Promise<boolean> {
  try {
    const opportunitiesHtml = topOpportunities.length > 0
      ? topOpportunities.map((opp, i) => `
          <div style="margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 8px;">
            <div style="font-size: 18px; font-weight: 600; color: #0a0f1a; margin-bottom: 8px;">
              ${i + 1}. ${opp.title}
            </div>
            <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 8px;">
              ${opp.description}
            </p>
            <div style="color: #64748b; font-size: 12px;">
              Score: ${opp.score} | Lifecycle: ${opp.lifecycle || 'Unknown'}
            </div>
          </div>
        `).join('')
      : '<p style="color: #64748b;">No new opportunities this week.</p>';

    const changesHtml = lifecycleChanges.length > 0
      ? lifecycleChanges.map(change => `
          <div style="margin-bottom: 12px; padding: 12px; background: #f0fdf4; border-left: 3px solid #4ade80; border-radius: 4px;">
            <div style="font-weight: 600; color: #0a0f1a; margin-bottom: 4px;">
              ${change.trendSlug}
            </div>
            <div style="color: #475569; font-size: 14px;">
              ${change.fromLifecycle || 'New'} → ${change.toLifecycle}
            </div>
          </div>
        `).join('')
      : '<p style="color: #64748b;">No lifecycle changes this week.</p>';

    await resend.emails.send({
      from: "TrendRadar <digest@trendradar.app>",
      to: email,
      subject: "Weekly TrendRadar Digest",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #0a0f1a; font-size: 28px; margin-bottom: 24px;">Weekly TrendRadar Digest</h1>

          <h2 style="color: #0f172a; font-size: 20px; margin-bottom: 16px; margin-top: 32px;">Top Opportunities</h2>
          ${opportunitiesHtml}

          <h2 style="color: #0f172a; font-size: 20px; margin-bottom: 16px; margin-top: 32px;">Lifecycle Changes</h2>
          ${changesHtml}

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
            You're receiving this because you subscribed to the TrendRadar weekly digest.
          </div>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error("Failed to send weekly digest:", error);
    return false;
  }
}

export async function sendLifecycleChangeAlert(
  email: string,
  trendSlug: string,
  fromLifecycle: string | null,
  toLifecycle: string
): Promise<boolean> {
  try {
    const changeText = fromLifecycle
      ? `${fromLifecycle} → ${toLifecycle}`
      : `New trend detected: ${toLifecycle}`;

    await resend.emails.send({
      from: "TrendRadar <alerts@trendradar.app>",
      to: email,
      subject: `Alert: ${trendSlug} lifecycle changed`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #0a0f1a; font-size: 24px; margin-bottom: 16px;">Lifecycle Change Alert</h1>
          <div style="padding: 20px; background: #f0fdf4; border-left: 4px solid #4ade80; border-radius: 8px; margin-bottom: 20px;">
            <div style="font-size: 18px; font-weight: 600; color: #0a0f1a; margin-bottom: 8px;">
              ${trendSlug}
            </div>
            <div style="color: #475569; font-size: 16px;">
              ${changeText}
            </div>
          </div>
          <p style="color: #64748b; font-size: 14px;">
            This trend you're tracking has changed its lifecycle stage.
          </p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error("Failed to send lifecycle change alert:", error);
    return false;
  }
}
