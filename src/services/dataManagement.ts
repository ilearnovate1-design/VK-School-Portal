import { 
  collection, getDocs, writeBatch, doc, serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { logAudit } from '../utils/formatters';

export interface CollectionStat {
  name: string;
  label: string;
  count: number;
  canPurge: boolean;
}

const MANAGEABLE_COLLECTIONS: { name: string; label: string; canPurge: boolean }[] = [
  { name: 'students', label: 'Students Directory', canPurge: true },
  { name: 'classes', label: 'Class Arms & Grades', canPurge: true },
  { name: 'teachers', label: 'Teachers Records', canPurge: true },
  { name: 'parents', label: 'Parent Contacts', canPurge: true },
  { name: 'attendance', label: 'Attendance Records', canPurge: true },
  { name: 'feeStructures', label: 'Fee Tariffs', canPurge: true },
  { name: 'payments', label: 'Payment Receipts', canPurge: true },
  { name: 'results', label: 'Examination Scores', canPurge: true },
  { name: 'assignments', label: 'Homework & Assignments', canPurge: true },
  { name: 'announcements', label: 'Announcements', canPurge: true },
  { name: 'auditLogs', label: 'Audit Logs', canPurge: true },
  { name: 'schoolSettings', label: 'School Configuration', canPurge: false },
  { name: 'users', label: 'User Authentication Records', canPurge: false },
];

/**
 * Fetch document counts for collections to display to administrator
 */
export const getDatabaseStats = async (): Promise<CollectionStat[]> => {
  const stats: CollectionStat[] = [];
  for (const item of MANAGEABLE_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, item.name));
      stats.push({
        name: item.name,
        label: item.label,
        count: snap.size,
        canPurge: item.canPurge,
      });
    } catch (e) {
      stats.push({
        name: item.name,
        label: item.label,
        count: 0,
        canPurge: item.canPurge,
      });
    }
  }
  return stats;
};

/**
 * Purge specified collections in batches of 400.
 * Useful when transitioning from testing/demo to a clean launch slate.
 */
export const purgeCollections = async (
  collectionNames: string[], 
  adminUid: string
): Promise<{ success: boolean; deletedCount: number }> => {
  let totalDeleted = 0;

  for (const colName of collectionNames) {
    // Only allow purgeable collections
    const meta = MANAGEABLE_COLLECTIONS.find(c => c.name === colName);
    if (!meta || !meta.canPurge) continue;

    try {
      const snap = await getDocs(collection(db, colName));
      const docs = snap.docs;
      
      const BATCH_SIZE = 400;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const slice = docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        slice.forEach(d => {
          batch.delete(d.ref);
          totalDeleted++;
        });
        await batch.commit();
      }
    } catch (err) {
      console.error(`Error purging collection ${colName}:`, err);
      throw err;
    }
  }

  await logAudit(
    adminUid,
    'SYSTEM_TEST_DATA_PURGED',
    'system',
    'all',
    `Administrator purged test records across collections: ${collectionNames.join(', ')} (${totalDeleted} records deleted)`
  );

  return { success: true, deletedCount: totalDeleted };
};

/**
 * Export all school data as a downloadable JSON backup
 */
export const exportSchoolDataBackup = async (): Promise<void> => {
  const backupData: Record<string, any[]> = {
    exportedAt: [new Date().toISOString()],
  };

  for (const item of MANAGEABLE_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, item.name));
      const records: any[] = [];
      snap.forEach(d => records.push({ _id: d.id, ...d.data() }));
      backupData[item.name] = records;
    } catch (e) {
      console.warn(`Could not export ${item.name}`, e);
    }
  }

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(backupData, null, 2)
  )}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute(
    'download',
    `school_portal_backup_${new Date().toISOString().split('T')[0]}.json`
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};
