const admin = require('firebase-admin');

function serviceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('firebase_admin_env_missing');
  }
  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, '\n'),
  };
}

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const sa = serviceAccountFromEnv();
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: sa.project_id || sa.projectId,
      clientEmail: sa.client_email || sa.clientEmail,
      privateKey: sa.private_key || sa.privateKey,
    }),
    projectId: sa.project_id || sa.projectId,
  });
}

module.exports = { admin, getAdminApp };
