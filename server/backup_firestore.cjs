const fs = require('fs');
const path = require('path');

const COLLECTIONS = [
  'don_vi',
  'chuong_trinh',
  'ho_so_dia_ban_records',
  'ho_so_dia_ban_files',
  'bao_cao_thang',
  'pdf_files',
  'don_thu',
  'users',
  'phan_cong_dia_ban',
  'system_config',
];

const SENSITIVE_KEYS = new Set([
  'mat_khau',
  'mat_khau_hash',
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'secret',
  'clientSecret',
  'client_secret',
  'privateKey',
  'private_key',
]);

function stripSensitive(input) {
  if (Array.isArray(input)) {
    return input.map(stripSensitive);
  }
  if (input && typeof input === 'object') {
    const cleaned = {};
    for (const [k, v] of Object.entries(input)) {
      if (SENSITIVE_KEYS.has(k)) continue;
      cleaned[k] = stripSensitive(v);
    }
    return cleaned;
  }
  return input;
}

async function backup() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      'Missing FIREBASE_SERVICE_ACCOUNT secret or GOOGLE_APPLICATION_CREDENTIALS file path.'
    );
    process.exit(1);
  }

  // Hỗ trợ cả firebase-admin (khi cài trong node_modules gốc hoặc functions/node_modules)
  let admin;
  try {
    admin = require('firebase-admin');
  } catch {
    admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
  }

  if (!admin.apps.length) {
    if (serviceAccountJson) {
      const credentialObj = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(credentialObj),
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
  }

  const db = admin.firestore();
  const backupData = {
    format: 'UBKT_FULL_BACKUP_V1',
    timestamp: new Date().toISOString(),
    collections: {},
  };

  for (const c of COLLECTIONS) {
    try {
      const snap = await db.collection(c).get();
      backupData.collections[c] = snap.docs.map((d) =>
        stripSensitive({ _id: d.id, ...d.data() })
      );
      console.log('Backed up ' + c + ': ' + snap.size + ' items');
    } catch (e) {
      console.error('Error backing up ' + c + ':', e.message);
      throw e;
    }
  }

  const outputPath =
    process.env.BACKUP_OUTPUT_PATH ||
    path.join(__dirname, 'data', 'backup_firestore_' + Date.now() + '.json');

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log('Backup saved to: ' + outputPath);
}

backup().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
