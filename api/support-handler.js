module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, category, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Name, email, subject, and message are required' });
    }

    const categoryLabels = {
      account: 'Account / Login',
      billing: 'Billing / Subscription',
      bug: 'Bug / Something Broken',
      feature: 'Feature Request',
      drills: 'Drill Database',
      team: 'Team / Invites',
      other: 'Other',
    };
    const categoryLabel = categoryLabels[category] || category || 'General';
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@strikescript.com';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StrikeScript Support <onboarding@resend.dev>',
        to: [supportEmail],
        reply_to: email,
        subject: `[${categoryLabel}] ${subject}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#111;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h2 style="color:#DC2626;margin:0;font-size:18px;">New Support Request</h2>
            </div>
            <div style="background:#f7f5f0;padding:24px;border:1px solid #e5e0d8;border-top:none;border-radius:0 0 8px 8px;">
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <tr><td style="padding:6px 0;font-size:12px;font-weight:700;color:#a9a49b;text-transform:uppercase;letter-spacing:1px;width:100px">From</td><td style="padding:6px 0;font-size:14px;color:#1a1a1a">${name} &lt;${email}&gt;</td></tr>
                <tr><td style="padding:6px 0;font-size:12px;font-weight:700;color:#a9a49b;text-transform:uppercase;letter-spacing:1px">Category</td><td style="padding:6px 0;font-size:14px;color:#1a1a1a">${categoryLabel}</td></tr>
                <tr><td style="padding:6px 0;font-size:12px;font-weight:700;color:#a9a49b;text-transform:uppercase;letter-spacing:1px">Subject</td><td style="padding:6px 0;font-size:14px;color:#1a1a1a">${subject}</td></tr>
              </table>
              <div style="background:#fff;border:1px solid #e5e0d8;border-radius:8px;padding:16px 20px;">
                <div style="font-size:12px;font-weight:700;color:#a9a49b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Message</div>
                <div style="font-size:14px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
              </div>
              <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e0d8;">
                <a href="mailto:${email}" style="display:inline-block;background:#DC2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;">Reply to ${name} →</a>
              </div>
            </div>
          </div>
        `,
      }),
    });

    // Send confirmation to the user
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StrikeScript Support <onboarding@resend.dev>',
        to: [email],
        subject: `We got your message — StrikeScript Support`,
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <div style="background:#111;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h2 style="color:#DC2626;margin:0;font-size:18px;">We received your message</h2>
            </div>
            <div style="background:#f7f5f0;padding:24px;border:1px solid #e5e0d8;border-top:none;border-radius:0 0 8px 8px;">
              <p style="font-size:15px;color:#1a1a1a;margin-bottom:12px;">Hi ${name},</p>
              <p style="font-size:14px;color:#6b665e;line-height:1.7;margin-bottom:12px;">Thanks for reaching out! We've received your support request and will get back to you within <strong>1 business day</strong>.</p>
              <div style="background:#fff;border:1px solid #e5e0d8;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
                <div style="font-size:11px;font-weight:700;color:#a9a49b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Your request</div>
                <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">${subject}</div>
                <div style="font-size:12px;color:#a9a49b;">${categoryLabel}</div>
              </div>
              <p style="font-size:13px;color:#a9a49b;">If you have additional details to add, just reply to this email.</p>
            </div>
          </div>
        `,
      }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Support handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};
