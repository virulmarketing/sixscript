const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

const signToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });

const verifyToken = (token) => {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
};

const getTokenFromReq = (req) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
};

module.exports = { signToken, verifyToken, getTokenFromReq };
