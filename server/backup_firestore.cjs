const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey: 'AIzaSyDocKeyValueExampleDummyKey',
  authDomain: 'ubkt-bf611.firebaseapp.com',
  projectId: 'ubkt-bf611',
  storageBucket: 'ubkt-bf611.appspot.com',
  messagingSenderId: '1035624707328',
  appId: '1:1035624707328:web:7bc230559eb444cb941e98'
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = [
  'don_vi',
  'chuong_trinh',
  'ho_so_dia_ban_records',
  'ho_so_dia_ban_files',
  'bao_cao_thang',
  'pdf_files',
  'don_thu',
  'users',
  'phan_cong_dia_ban',
  'system_config'
];

async function backup() {
  const backupData = {
    timestamp: new Date().toISOString(),
    collections: {}
  };

  for (const c of collections) {
    try {
      const snap = await getDocs(collection(db, c));
      backupData.collections[c] = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      console.log('Backed up ' + c + ': ' + snap.size + ' items');
    } catch (e) {
      console.log('Error backing up ' + c + ':', e.message);
    }
  }

  const backupPath = path.join(__dirname, 'data', 'backup_firestore_' + Date.now() + '.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log('Backup saved to: ' + backupPath);
}

backup();
