const { sql } = require('./_lib/db');
const { verifyToken, getTokenFromReq } = require('./_lib/auth');

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = verifyToken(getTokenFromReq(req));
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const action = req.query.action;

  if (action === 'list') {
    try {
      const rows = await sql`
        SELECT id, label, data, created_at FROM saved_plans
        WHERE user_id = ${decoded.userId}
        ORDER BY created_at ASC
      `;
      const plans = rows.map(r => ({ ...r.data, id: r.id, label: r.label }));
      return res.status(200).json({ plans });
    } catch (err) {
      console.error('List plans error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'save') {
    try {
      const { plan } = req.body;
      if (!plan || !plan.id || !plan.label) return res.status(400).json({ error: 'Invalid plan' });
      const { id, label, ...rest } = plan;
      await sql`
        INSERT INTO saved_plans (id, user_id, label, data)
        VALUES (${id}, ${decoded.userId}, ${label}, ${JSON.stringify(rest)})
        ON CONFLICT (id) DO UPDATE SET label = ${label}, data = ${JSON.stringify(rest)}
      `;
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Save plan error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'delete') {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Plan id required' });
      await sql`DELETE FROM saved_plans WHERE id = ${id} AND user_id = ${decoded.userId}`;
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Delete plan error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
