const jwt = require('jsonwebtoken');

function getUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }
  req.userId = userId;
  next();
}

function optionalAuth(req, res, next) {
  req.userId = getUserId(req);
  next();
}

module.exports = { getUserId, requireAuth, optionalAuth };
