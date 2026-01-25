/**
 * Script de migración: Normalizar status a minúsculas
 * 
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./credentials/serviceAccountKey.json node scripts/migrate-status-lowercase.mjs
 * 
 * Este script:
 * 1. Lee todos los documentos de companies
 * 2. Si status está en mayúsculas, lo convierte a minúsculas
 * 3. Actualiza el documento
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const app = initializeApp();
const db = getFirestore(app);

const STATUS_MAP = {
  'Active': 'active',
  'Pending': 'pending',
  'Suspended': 'suspended',
  'Overdue': 'overdue',
  'Inactive': 'inactive',
};

async function migrateCompanyStatus() {
  console.log('🔄 Starting status migration...\n');
  
  const companiesRef = db.collection('companies');
  const snapshot = await companiesRef.get();
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const currentStatus = data.status;
    
    if (!currentStatus) {
      console.log(`⚠️  ${doc.id}: No status field, setting to 'active'`);
      try {
        await doc.ref.update({ status: 'active' });
        updated++;
      } catch (e) {
        console.error(`❌ ${doc.id}: Failed to update - ${e.message}`);
        errors++;
      }
      continue;
    }
    
    const normalizedStatus = STATUS_MAP[currentStatus];
    
    if (normalizedStatus) {
      console.log(`✅ ${doc.id}: '${currentStatus}' → '${normalizedStatus}'`);
      try {
        await doc.ref.update({ status: normalizedStatus });
        updated++;
      } catch (e) {
        console.error(`❌ ${doc.id}: Failed to update - ${e.message}`);
        errors++;
      }
    } else if (currentStatus === currentStatus.toLowerCase()) {
      console.log(`⏭️  ${doc.id}: Already lowercase ('${currentStatus}')`);
      skipped++;
    } else {
      console.log(`⚠️  ${doc.id}: Unknown status '${currentStatus}', setting to 'active'`);
      try {
        await doc.ref.update({ status: 'active' });
        updated++;
      } catch (e) {
        console.error(`❌ ${doc.id}: Failed to update - ${e.message}`);
        errors++;
      }
    }
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);
  console.log(`   Total:   ${snapshot.size}`);
}

migrateCompanyStatus()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
