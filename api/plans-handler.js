const { sql } = require('./_lib/db');
const { getClerkUserId, resolveUser } = require('./_lib/clerkAuth');

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const getTeamId = async (userId) => {
  const rows = await sql`
    SELECT team_id FROM team_members
    WHERE user_id = ${userId} AND status = 'active'
    LIMIT 1
  `;
  return rows[0]?.team_id || null;
};

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clerkUserId = await getClerkUserId(req);
  if (!clerkUserId) return res.status(401).json({ error: 'Unauthorized' });
  const dbUser = await resolveUser(clerkUserId, sql);

  const action = req.query.action;

  if (action === 'list') {
    try {
      const rows = await sql`
        SELECT sp.id, sp.label, sp.data, sp.created_at
        FROM saved_plans sp
        WHERE sp.user_id = ${dbUser.id}
           OR sp.user_id IN (
             SELECT tm2.user_id
             FROM team_members tm1
             JOIN team_members tm2 ON tm1.team_id = tm2.team_id
             WHERE tm1.user_id = ${dbUser.id}
               AND tm1.status = 'active'
               AND tm2.status = 'active'
               AND tm2.user_id IS NOT NULL
               AND tm2.user_id != ${dbUser.id}
           )
        ORDER BY sp.created_at ASC
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
        VALUES (${id}, ${dbUser.id}, ${label}, ${JSON.stringify(rest)})
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
      await sql`DELETE FROM saved_plans WHERE id = ${id} AND user_id = ${dbUser.id}`;
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Delete plan error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'calendar-list') {
    try {
      const teamId = await getTeamId(dbUser.id);
      let rows;
      if (teamId) {
        rows = await sql`
          SELECT date_key, plan_data FROM calendar_plans
          WHERE team_id = ${teamId}
          ORDER BY date_key ASC
        `;
      } else {
        rows = await sql`
          SELECT date_key, plan_data FROM calendar_plans
          WHERE user_id = ${dbUser.id} AND team_id IS NULL
          ORDER BY date_key ASC
        `;
      }
      const plans = {};
      for (const row of rows) {
        const val = row.plan_data;
        plans[row.date_key] = val.__ref ? val.__ref : val;
      }
      return res.status(200).json({ plans });
    } catch (err) {
      console.error('Calendar list error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'calendar-save') {
    try {
      const { dateKey, planValue } = req.body;
      if (!dateKey) return res.status(400).json({ error: 'dateKey required' });
      const teamId = await getTeamId(dbUser.id);
      const planData = typeof planValue === 'string' ? { __ref: planValue } : planValue;
      const entryId = teamId
        ? `cal_t_${teamId}_${dateKey}`
        : `cal_u_${dbUser.id}_${dateKey}`;
      await sql`
        INSERT INTO calendar_plans (id, team_id, user_id, date_key, plan_data)
        VALUES (${entryId}, ${teamId}, ${dbUser.id}, ${dateKey}, ${JSON.stringify(planData)})
        ON CONFLICT (id) DO UPDATE SET
          plan_data = ${JSON.stringify(planData)},
          updated_at = NOW()
      `;
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Calendar save error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'calendar-remove') {
    try {
      const { dateKey } = req.body;
      if (!dateKey) return res.status(400).json({ error: 'dateKey required' });
      const teamId = await getTeamId(dbUser.id);
      const entryId = teamId
        ? `cal_t_${teamId}_${dateKey}`
        : `cal_u_${dbUser.id}_${dateKey}`;
      await sql`DELETE FROM calendar_plans WHERE id = ${entryId}`;
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Calendar remove error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
