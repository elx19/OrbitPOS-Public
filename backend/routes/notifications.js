const express = require('express');
const { getDb } = require('../database');
const { clearRuntimeCache, withRuntimeCache } = require('../helpers/runtimeCache');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let notificationStatements = null;

function getNotificationStatements() {
  const db = getDb();

  if (notificationStatements?.db === db) {
    return notificationStatements;
  }

  notificationStatements = {
    db,
    summary: db.prepare(`
      SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END), 0) AS unread
      FROM notifications
    `),
    listAll: db.prepare(`
      SELECT *
      FROM notifications
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `),
    listUnread: db.prepare(`
      SELECT *
      FROM notifications
      WHERE read = 0
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `),
    markRead: db.prepare(`
      UPDATE notifications
      SET read = 1
      WHERE id = ?
    `),
    markAllRead: db.prepare(`
      UPDATE notifications
      SET read = 1
      WHERE read = 0
    `)
  };

  return notificationStatements;
}

router.use(authenticateToken);

router.get('/', (request, response) => {
  const summaryOnly = request.query.summaryOnly === '1';
  const unreadOnly = request.query.unread === '1';
  const statements = getNotificationStatements();
  const summary = summaryOnly
    ? withRuntimeCache('notifications:summary', 4000, () => statements.summary.get())
    : statements.summary.get();

  if (summaryOnly) {
    return response.json({
      items: [],
      summary
    });
  }

  const notifications = unreadOnly ? statements.listUnread.all() : statements.listAll.all();

  response.json({
    items: notifications,
    summary
  });
});

router.patch('/:id/read', (request, response) => {
  getNotificationStatements().markRead.run(request.params.id);
  clearRuntimeCache('notifications:summary');

  response.json({ ok: true });
});

router.post('/mark-all-read', (request, response) => {
  getNotificationStatements().markAllRead.run();
  clearRuntimeCache('notifications:summary');

  response.json({ ok: true });
});

module.exports = router;
