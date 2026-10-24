const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
  'deleted_records'
];

async function inspectAll() {
  for (const c of collections) {
    try {
      const snap = await getDocs(collection(db, c));
      console.log('Collection [' + c + ']: ' + snap.size + ' documents');
      if (snap.size > 0 && snap.size <= 5) {
        snap.forEach(d => console.log('   - ID: ' + d.id));
      }
    } catch (e) {
      console.log('Collection [' + c + '] error: ' + e.message);
    }
  }
}
inspectAll();
