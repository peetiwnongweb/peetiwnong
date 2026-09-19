const { getPrisma } = require('./prisma');

async function logActivity({ actorEmail, actorRole, action, entityType, entityId, summary }) {
  const prisma = await getPrisma();
  await prisma.activityLog.create({
    data: { actorEmail, actorRole, action, entityType, entityId, summary },
  });
}

module.exports = { logActivity };
