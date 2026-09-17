import { 
  collection, getDocs, writeBatch, doc, serverTimestamp, setDoc 
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
  { name: 'classes', label: 'Class Arms & Grades', canPurge: true },
  { name: 'subjects', label: 'Curriculum Subjects', canPurge: true },
  { name: 'students', label: 'Students Directory', canPurge: true },
  { name: 'teachers', label: 'Teachers Records', canPurge: true },
  { name: 'parents', label: 'Parent Contacts', canPurge: true },
  { name: 'attendance', label: 'Attendance Records', canPurge: true },
  { name: 'feeStructures', label: 'Fee Tariffs', canPurge: true },
  { name: 'payments', label: 'Payment Receipts', canPurge: true },
  { name: 'results', label: 'Examination Scores', canPurge: true },
  { name: 'assignments', label: 'Homework & Assignments', canPurge: true },
  { name: 'submissions', label: 'Student Submissions', canPurge: true },
  { name: 'announcements', label: 'Announcements', canPurge: true },
  { name: 'auditLogs', label: 'Audit Logs', canPurge: false },
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

  try {
    await logAudit(
      adminUid,
      'SYSTEM_TEST_DATA_PURGED',
      'system',
      'all',
      `Administrator purged test records across collections: ${collectionNames.join(', ')} (${totalDeleted} records deleted)`
    );
  } catch (auditErr) {
    console.warn('Could not record purge audit log:', auditErr);
  }

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

/**
 * Regenerate complete, rich school test records & demo data
 */
export const generateTestRecords = async (
  adminUid: string,
  options?: {
    purgeFirst?: boolean;
    onProgress?: (message: string) => void;
  }
): Promise<{ success: boolean; createdCount: number }> => {
  const updateProgress = (msg: string) => {
    if (options?.onProgress) options.onProgress(msg);
  };

  if (options?.purgeFirst) {
    updateProgress('Purging existing test records...');
    const purgeable = MANAGEABLE_COLLECTIONS.filter(c => c.canPurge).map(c => c.name);
    await purgeCollections(purgeable, adminUid);
  }

  let count = 0;
  const session = '2026/2027';
  const term = 'First Term';
  const today = new Date().toISOString().split('T')[0];

  // 1. Classes
  updateProgress('Seeding classroom arms & grades...');
  const classesData = [
    { classId: 'cls-primary-1', name: 'Primary 1 Gold', level: 'Primary', section: 'Gold', academicSession: session },
    { classId: 'cls-primary-2', name: 'Primary 2 Diamond', level: 'Primary', section: 'Diamond', academicSession: session },
    { classId: 'cls-primary-3', name: 'Primary 3 Emerald', level: 'Primary', section: 'Emerald', academicSession: session },
    { classId: 'cls-primary-4', name: 'Primary 4 Ruby', level: 'Primary', section: 'Ruby', academicSession: session, classTeacherId: 'tch-adeleke' },
    { classId: 'cls-primary-5', name: 'Primary 5 Sapphire', level: 'Primary', section: 'Sapphire', academicSession: session, classTeacherId: 'tch-okonjo' },
    { classId: 'cls-jss-1', name: 'JSS 1 Silver', level: 'Junior Secondary', section: 'Silver', academicSession: session, classTeacherId: 'tch-ibrahim' },
  ];
  for (const c of classesData) {
    await setDoc(doc(db, 'classes', c.classId), {
      ...c,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    count++;
  }

  // 2. Curriculum Subjects
  updateProgress('Seeding standard curriculum subjects...');
  const subjectsData = [
    { subjectId: 'sub-mathematics', name: 'Mathematics', code: 'MTH', category: 'Core', active: true },
    { subjectId: 'sub-english-language', name: 'English Language', code: 'ENG', category: 'Core', active: true },
    { subjectId: 'sub-basic-science-technology', name: 'Basic Science & Technology', code: 'BST', category: 'Sciences', active: true },
    { subjectId: 'sub-social-studies', name: 'Social Studies', code: 'SOS', category: 'Humanities', active: true },
    { subjectId: 'sub-civic-education', name: 'Civic Education', code: 'CIV', category: 'Core', active: true },
    { subjectId: 'sub-agricultural-science', name: 'Agricultural Science', code: 'AGR', category: 'Sciences', active: true },
    { subjectId: 'sub-information-communication-technology', name: 'Information & Communication Technology', code: 'ICT', category: 'Sciences', active: true },
    { subjectId: 'sub-cultural-creative-arts', name: 'Cultural & Creative Arts', code: 'CCA', category: 'Humanities', active: true },
    { subjectId: 'sub-physical-health-education', name: 'Physical & Health Education', code: 'PHE', category: 'General', active: true },
    { subjectId: 'sub-business-studies', name: 'Business Studies', code: 'BUS', category: 'Commercial', active: true },
  ];
  for (const s of subjectsData) {
    await setDoc(doc(db, 'subjects', s.subjectId), {
      ...s,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    count++;
  }

  // 3. Teachers
  updateProgress('Seeding academic teachers...');
  const teachersData = [
    {
      teacherId: 'tch-okonjo',
      firstName: 'Ngozi',
      lastName: 'Okonjo',
      email: 'ngozi.okonjo@school.edu.ng',
      phone: '08031112233',
      employeeId: 'EMP-TCH-001',
      assignedClassIds: ['cls-primary-5', 'cls-primary-4'],
      subjects: ['sub-mathematics', 'sub-basic-science-technology'],
      status: 'ACTIVE',
    },
    {
      teacherId: 'tch-adeleke',
      firstName: 'Babatunde',
      lastName: 'Adeleke',
      email: 'babatunde.adeleke@school.edu.ng',
      phone: '08022223344',
      employeeId: 'EMP-TCH-002',
      assignedClassIds: ['cls-primary-4', 'cls-primary-3'],
      subjects: ['sub-english-language', 'sub-social-studies'],
      status: 'ACTIVE',
    },
    {
      teacherId: 'tch-ibrahim',
      firstName: 'Usman',
      lastName: 'Ibrahim',
      email: 'usman.ibrahim@school.edu.ng',
      phone: '08053334455',
      employeeId: 'EMP-TCH-003',
      assignedClassIds: ['cls-jss-1'],
      subjects: ['sub-civic-education', 'sub-agricultural-science', 'sub-information-communication-technology'],
      status: 'ACTIVE',
    },
  ];
  for (const t of teachersData) {
    await setDoc(doc(db, 'teachers', t.teacherId), {
      ...t,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    count++;
  }

  // 4. Parents
  updateProgress('Seeding parent contact profiles...');
  const parentsData = [
    {
      parentId: 'prt-okafor',
      firstName: 'Emeka',
      lastName: 'Okafor',
      email: 'emeka.okafor@example.com',
      phone: '08031234567',
      relationship: 'Father',
      occupation: 'Civil Engineer',
      address: '12 Victoria Island, Lagos',
    },
    {
      parentId: 'prt-adeleke',
      firstName: 'Folashade',
      lastName: 'Adeleke',
      email: 'folashade.adeleke@example.com',
      phone: '08029876543',
      relationship: 'Mother',
      occupation: 'Chartered Accountant',
      address: '45 Bode Thomas, Surulere, Lagos',
    },
    {
      parentId: 'prt-danjuma',
      firstName: 'Musa',
      lastName: 'Danjuma',
      email: 'musa.danjuma@example.com',
      phone: '08055551234',
      relationship: 'Guardian',
      occupation: 'Legal Practitioner',
      address: '8 Keffi Street, Ikoyi, Lagos',
    },
    {
      parentId: 'prt-eze',
      firstName: 'Chidinma',
      lastName: 'Eze',
      email: 'chidinma.eze@example.com',
      phone: '08064321987',
      relationship: 'Mother',
      occupation: 'Medical Doctor',
      address: '22 Admiralty Way, Lekki Phase 1, Lagos',
    },
  ];
  for (const p of parentsData) {
    await setDoc(doc(db, 'parents', p.parentId), {
      ...p,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    count++;
  }

  // 5. Students
  updateProgress('Seeding enrolled students...');
  const studentsData = [
    {
      studentId: 'stu-2026-001',
      admissionNumber: 'STU-2026-001',
      firstName: 'Somtochukwu',
      middleName: 'Emmanuel',
      lastName: 'Okafor',
      gender: 'Male',
      dateOfBirth: '2015-04-12',
      admissionDate: '2021-09-15',
      classId: 'cls-primary-5',
      status: 'ACTIVE',
      parentIds: ['prt-okafor'],
      parentEmails: ['emeka.okafor@example.com'],
      address: '12 Victoria Island, Lagos',
      emergencyContactName: 'Dr. Emeka Okafor',
      emergencyContactPhone: '08031234567',
    },
    {
      studentId: 'stu-2026-002',
      admissionNumber: 'STU-2026-002',
      firstName: 'Kamsiyochukwu',
      middleName: 'Grace',
      lastName: 'Okafor',
      gender: 'Female',
      dateOfBirth: '2017-08-20',
      admissionDate: '2023-09-10',
      classId: 'cls-primary-3',
      status: 'ACTIVE',
      parentIds: ['prt-okafor'],
      parentEmails: ['emeka.okafor@example.com'],
      address: '12 Victoria Island, Lagos',
      emergencyContactName: 'Dr. Emeka Okafor',
      emergencyContactPhone: '08031234567',
    },
    {
      studentId: 'stu-2026-003',
      admissionNumber: 'STU-2026-003',
      firstName: 'Tunde',
      middleName: 'Olumide',
      lastName: 'Adeleke',
      gender: 'Male',
      dateOfBirth: '2015-02-18',
      admissionDate: '2021-09-15',
      classId: 'cls-primary-5',
      status: 'ACTIVE',
      parentIds: ['prt-adeleke'],
      parentEmails: ['folashade.adeleke@example.com'],
      address: '45 Bode Thomas, Surulere, Lagos',
      emergencyContactName: 'Mrs. Folashade Adeleke',
      emergencyContactPhone: '08029876543',
    },
    {
      studentId: 'stu-2026-004',
      admissionNumber: 'STU-2026-004',
      firstName: 'Zainab',
      middleName: 'Amina',
      lastName: 'Danjuma',
      gender: 'Female',
      dateOfBirth: '2016-11-05',
      admissionDate: '2022-09-12',
      classId: 'cls-primary-4',
      status: 'ACTIVE',
      parentIds: ['prt-danjuma'],
      parentEmails: ['musa.danjuma@example.com'],
      address: '8 Keffi Street, Ikoyi, Lagos',
      emergencyContactName: 'Alhaji Musa Danjuma',
      emergencyContactPhone: '08055551234',
    },
    {
      studentId: 'stu-2026-005',
      admissionNumber: 'STU-2026-005',
      firstName: 'Aminu',
      middleName: 'Shehu',
      lastName: 'Danjuma',
      gender: 'Male',
      dateOfBirth: '2014-06-30',
      admissionDate: '2020-09-14',
      classId: 'cls-jss-1',
      status: 'ACTIVE',
      parentIds: ['prt-danjuma'],
      parentEmails: ['musa.danjuma@example.com'],
      address: '8 Keffi Street, Ikoyi, Lagos',
      emergencyContactName: 'Alhaji Musa Danjuma',
      emergencyContactPhone: '08055551234',
    },
    {
      studentId: 'stu-2026-006',
      admissionNumber: 'STU-2026-006',
      firstName: 'Chioma',
      middleName: 'Blessing',
      lastName: 'Eze',
      gender: 'Female',
      dateOfBirth: '2015-09-14',
      admissionDate: '2021-09-15',
      classId: 'cls-primary-5',
      status: 'ACTIVE',
      parentIds: ['prt-eze'],
      parentEmails: ['chidinma.eze@example.com'],
      address: '22 Admiralty Way, Lekki Phase 1, Lagos',
      emergencyContactName: 'Mrs. Chidinma Eze',
      emergencyContactPhone: '08064321987',
    },
    {
      studentId: 'stu-2026-007',
      admissionNumber: 'STU-2026-007',
      firstName: 'David',
      middleName: 'Ayodele',
      lastName: 'Adeleke',
      gender: 'Male',
      dateOfBirth: '2018-03-25',
      admissionDate: '2024-09-09',
      classId: 'cls-primary-2',
      status: 'ACTIVE',
      parentIds: ['prt-adeleke'],
      parentEmails: ['folashade.adeleke@example.com'],
      address: '45 Bode Thomas, Surulere, Lagos',
      emergencyContactName: 'Mrs. Folashade Adeleke',
      emergencyContactPhone: '08029876543',
    },
    {
      studentId: 'stu-2026-008',
      admissionNumber: 'STU-2026-008',
      firstName: 'Favour',
      middleName: 'Adaobi',
      lastName: 'Eze',
      gender: 'Female',
      dateOfBirth: '2016-07-19',
      admissionDate: '2022-09-12',
      classId: 'cls-primary-4',
      status: 'ACTIVE',
      parentIds: ['prt-eze'],
      parentEmails: ['chidinma.eze@example.com'],
      address: '22 Admiralty Way, Lekki Phase 1, Lagos',
      emergencyContactName: 'Mrs. Chidinma Eze',
      emergencyContactPhone: '08064321987',
    },
  ];
  for (const st of studentsData) {
    await setDoc(doc(db, 'students', st.studentId), {
      ...st,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    count++;
  }

  // 6. Attendance Records (Past 3 days + Today)
  updateProgress('Generating realistic attendance logs...');
  const dates = [
    today,
    // Calculate previous 2 days
    new Date(Date.now() - 86400000).toISOString().split('T')[0],
    new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
  ];

  for (const dt of dates) {
    for (const st of studentsData) {
      const attId = `${dt}_${st.studentId}`;
      // Give realistic varied statuses: mostly PRESENT, occasionally LATE or ABSENT
      let status = 'PRESENT';
      if (st.studentId === 'stu-2026-004' && dt === dates[1]) {
        status = 'LATE';
      } else if (st.studentId === 'stu-2026-007' && dt === dates[2]) {
        status = 'ABSENT';
      }

      await setDoc(doc(db, 'attendance', attId), {
        attendanceId: attId,
        studentId: st.studentId,
        classId: st.classId,
        date: dt,
        status,
        markedBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      count++;
    }
  }

  // 7. Fee Structures
  updateProgress('Seeding tuition and fee structures...');
  const feesData = [
    { feeStructureId: 'fee-p5-tuition', name: 'Primary 5 School Fees', classId: 'cls-primary-5', academicSession: session, term, feeType: 'Tuition', amount: 85000, active: true },
    { feeStructureId: 'fee-p4-tuition', name: 'Primary 4 School Fees', classId: 'cls-primary-4', academicSession: session, term, feeType: 'Tuition', amount: 80000, active: true },
    { feeStructureId: 'fee-p3-tuition', name: 'Primary 3 School Fees', classId: 'cls-primary-3', academicSession: session, term, feeType: 'Tuition', amount: 75000, active: true },
    { feeStructureId: 'fee-p2-tuition', name: 'Primary 2 School Fees', classId: 'cls-primary-2', academicSession: session, term, feeType: 'Tuition', amount: 70000, active: true },
    { feeStructureId: 'fee-p1-tuition', name: 'Primary 1 School Fees', classId: 'cls-primary-1', academicSession: session, term, feeType: 'Tuition', amount: 65000, active: true },
    { feeStructureId: 'fee-jss1-tuition', name: 'JSS 1 School Fees', classId: 'cls-jss-1', academicSession: session, term, feeType: 'Tuition', amount: 95000, active: true },
    { feeStructureId: 'fee-p5-ict', name: 'Primary 5 ICT & Coding Levy', classId: 'cls-primary-5', academicSession: session, term, feeType: 'Dues', amount: 15000, active: true },
    { feeStructureId: 'fee-p5-pta', name: 'Primary 5 PTA Development Levy', classId: 'cls-primary-5', academicSession: session, term, feeType: 'PTA', amount: 5000, active: true },
  ];
  for (const f of feesData) {
    await setDoc(doc(db, 'feeStructures', f.feeStructureId), {
      ...f,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    count++;
  }

  // 8. Payment Receipts
  updateProgress('Logging sample payment receipts...');
  const paymentsData = [
    {
      paymentId: 'pay-001',
      receiptNumber: 'RCP-2026-001',
      studentId: 'stu-2026-001',
      classId: 'cls-primary-5',
      amount: 85000,
      paymentDate: today,
      term,
      academicSession: session,
      paymentMethod: 'BANK_TRANSFER',
      reference: 'ZEN-TXN-88492019',
      notes: 'First Term Full Tuition paid via Zen Bank mobile transfer',
      recordedBy: adminUid,
    },
    {
      paymentId: 'pay-002',
      receiptNumber: 'RCP-2026-002',
      studentId: 'stu-2026-006',
      classId: 'cls-primary-5',
      amount: 105000,
      paymentDate: today,
      term,
      academicSession: session,
      paymentMethod: 'POS',
      reference: 'POS-LEKKI-00492',
      notes: 'Tuition + ICT + PTA levy settled at bursary terminal',
      recordedBy: adminUid,
    },
    {
      paymentId: 'pay-003',
      receiptNumber: 'RCP-2026-003',
      studentId: 'stu-2026-004',
      classId: 'cls-primary-4',
      amount: 50000,
      paymentDate: today,
      term,
      academicSession: session,
      paymentMethod: 'BANK_TRANSFER',
      reference: 'GTB-TRF-39103948',
      notes: 'Part payment for First Term tuition (Balance: ₦30,000)',
      recordedBy: adminUid,
    },
    {
      paymentId: 'pay-004',
      receiptNumber: 'RCP-2026-004',
      studentId: 'stu-2026-005',
      classId: 'cls-jss-1',
      amount: 95000,
      paymentDate: today,
      term,
      academicSession: session,
      paymentMethod: 'BANK_TRANSFER',
      reference: 'FBN-NIP-99201844',
      notes: 'JSS 1 Full tuition payment',
      recordedBy: adminUid,
    },
    {
      paymentId: 'pay-005',
      receiptNumber: 'RCP-2026-005',
      studentId: 'stu-2026-003',
      classId: 'cls-primary-5',
      amount: 85000,
      paymentDate: today,
      term,
      academicSession: session,
      paymentMethod: 'CASH',
      reference: 'CSH-REC-001',
      notes: 'First Term Tuition settled in cash at school accounts',
      recordedBy: adminUid,
    },
  ];
  for (const pay of paymentsData) {
    await setDoc(doc(db, 'payments', pay.paymentId), {
      ...pay,
      createdAt: serverTimestamp(),
    }, { merge: true });
    count++;
  }

  // 9. Examination Results
  updateProgress('Publishing academic terminal assessment scores...');
  const resultsData = [
    // Somtochukwu Okafor (Primary 5)
    { resultId: 'res-001', studentId: 'stu-2026-001', classId: 'cls-primary-5', subjectId: 'sub-mathematics', teacherId: 'tch-okonjo', academicSession: session, term, caScore: 36, examScore: 54, totalScore: 90, grade: 'A', remark: 'Excellent mastery of numeracy and problem solving', status: 'PUBLISHED' },
    { resultId: 'res-002', studentId: 'stu-2026-001', classId: 'cls-primary-5', subjectId: 'sub-english-language', teacherId: 'tch-adeleke', academicSession: session, term, caScore: 32, examScore: 52, totalScore: 84, grade: 'A', remark: 'Commendable creative writing and comprehension', status: 'PUBLISHED' },
    { resultId: 'res-003', studentId: 'stu-2026-001', classId: 'cls-primary-5', subjectId: 'sub-basic-science-technology', teacherId: 'tch-okonjo', academicSession: session, term, caScore: 34, examScore: 51, totalScore: 85, grade: 'A', remark: 'Demonstrates deep curiosity in experimental sciences', status: 'PUBLISHED' },
    { resultId: 'res-004', studentId: 'stu-2026-001', classId: 'cls-primary-5', subjectId: 'sub-civic-education', teacherId: 'tch-ibrahim', academicSession: session, term, caScore: 35, examScore: 53, totalScore: 88, grade: 'A', remark: 'Exemplary conduct and civic responsibility', status: 'PUBLISHED' },

    // Chioma Eze (Primary 5)
    { resultId: 'res-005', studentId: 'stu-2026-006', classId: 'cls-primary-5', subjectId: 'sub-mathematics', teacherId: 'tch-okonjo', academicSession: session, term, caScore: 38, examScore: 56, totalScore: 94, grade: 'A', remark: 'Outstanding analytical capability and precision', status: 'PUBLISHED' },
    { resultId: 'res-006', studentId: 'stu-2026-006', classId: 'cls-primary-5', subjectId: 'sub-english-language', teacherId: 'tch-adeleke', academicSession: session, term, caScore: 35, examScore: 55, totalScore: 90, grade: 'A', remark: 'Fluent vocabulary and neat handwriting', status: 'PUBLISHED' },
    { resultId: 'res-007', studentId: 'stu-2026-006', classId: 'cls-primary-5', subjectId: 'sub-basic-science-technology', teacherId: 'tch-okonjo', academicSession: session, term, caScore: 36, examScore: 53, totalScore: 89, grade: 'A', remark: 'High grasp of scientific principles', status: 'PUBLISHED' },

    // Tunde Adeleke Jr. (Primary 5)
    { resultId: 'res-008', studentId: 'stu-2026-003', classId: 'cls-primary-5', subjectId: 'sub-mathematics', teacherId: 'tch-okonjo', academicSession: session, term, caScore: 28, examScore: 44, totalScore: 72, grade: 'B', remark: 'Good effort, can achieve even higher with practice', status: 'PUBLISHED' },
    { resultId: 'res-009', studentId: 'stu-2026-003', classId: 'cls-primary-5', subjectId: 'sub-english-language', teacherId: 'tch-adeleke', academicSession: session, term, caScore: 30, examScore: 48, totalScore: 78, grade: 'B', remark: 'Very expressive orator and attentive student', status: 'PUBLISHED' },

    // Zainab Danjuma (Primary 4)
    { resultId: 'res-010', studentId: 'stu-2026-004', classId: 'cls-primary-4', subjectId: 'sub-mathematics', teacherId: 'tch-adeleke', academicSession: session, term, caScore: 34, examScore: 50, totalScore: 84, grade: 'A', remark: 'Very strong calculation speed', status: 'PUBLISHED' },
    { resultId: 'res-011', studentId: 'stu-2026-004', classId: 'cls-primary-4', subjectId: 'sub-social-studies', teacherId: 'tch-adeleke', academicSession: session, term, caScore: 33, examScore: 49, totalScore: 82, grade: 'A', remark: 'Great participation in classroom discussions', status: 'PUBLISHED' },

    // Aminu Danjuma (JSS 1)
    { resultId: 'res-012', studentId: 'stu-2026-005', classId: 'cls-jss-1', subjectId: 'sub-mathematics', teacherId: 'tch-ibrahim', academicSession: session, term, caScore: 35, examScore: 52, totalScore: 87, grade: 'A', remark: 'Smooth transition to secondary school mathematics syllabus', status: 'PUBLISHED' },
    { resultId: 'res-013', studentId: 'stu-2026-005', classId: 'cls-jss-1', subjectId: 'sub-civic-education', teacherId: 'tch-ibrahim', academicSession: session, term, caScore: 37, examScore: 54, totalScore: 91, grade: 'A', remark: 'Exceptional knowledge of national values and constitution', status: 'PUBLISHED' },
  ];
  for (const r of resultsData) {
    await setDoc(doc(db, 'results', r.resultId), {
      ...r,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    count++;
  }

  // 10. Homework & Assignments
  updateProgress('Posting homework assignments...');
  const nextWeek = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
  const assignmentsData = [
    {
      assignmentId: 'asg-p5-maths',
      title: 'Weekly Mathematics Assignment - Fractions & Word Problems',
      description: 'Solve exercises 1 through 10 on page 48 of Primary Mathematics Book 5. Show all working steps clearly.',
      classId: 'cls-primary-5',
      subjectId: 'sub-mathematics',
      teacherId: 'tch-okonjo',
      dueDate: nextWeek,
      status: 'PUBLISHED',
    },
    {
      assignmentId: 'asg-p5-english',
      title: 'English Composition: My Memorable Vacation',
      description: 'Write a two-page creative narrative describing a trip or special family event. Focus on descriptive adjectives and punctuation.',
      classId: 'cls-primary-5',
      subjectId: 'sub-english-language',
      teacherId: 'tch-adeleke',
      dueDate: nextWeek,
      status: 'PUBLISHED',
    },
    {
      assignmentId: 'asg-p4-science',
      title: 'Basic Science: Project on the Solar System',
      description: 'Draw and color the 8 planets in our solar system in order from the sun. Write one fact about Mars and Jupiter.',
      classId: 'cls-primary-4',
      subjectId: 'sub-basic-science-technology',
      teacherId: 'tch-okonjo',
      dueDate: nextWeek,
      status: 'PUBLISHED',
    },
  ];
  for (const asg of assignmentsData) {
    await setDoc(doc(db, 'assignments', asg.assignmentId), {
      ...asg,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    count++;
  }

  // 11. Student Submissions
  updateProgress('Seeding homework submissions and teacher grading...');
  const submissionsData = [
    {
      submissionId: 'sub_asg-p5-maths_stu-2026-001',
      assignmentId: 'asg-p5-maths',
      studentId: 'stu-2026-001',
      status: 'SUBMITTED',
      answerText: 'Solution for Page 48 Exercises: 1) 3/4 + 1/8 = 7/8. 2) 2/5 * 10 = 4. 3) 5.5 - 2.25 = 3.25. (Remaining 7 questions completed with full rough work).',
      submittedAt: serverTimestamp(),
    },
    {
      submissionId: 'sub_asg-p5-maths_stu-2026-006',
      assignmentId: 'asg-p5-maths',
      studentId: 'stu-2026-006',
      status: 'GRADED',
      score: 19,
      teacherComment: 'Excellent neatness and accurate workings across all 10 problems. Well done Chioma!',
      answerText: 'Complete solutions for Exercise 1 to 10 on Fractions and Word Problems written in math notebook.',
      submittedAt: serverTimestamp(),
    },
    {
      submissionId: 'sub_asg-p5-maths_stu-2026-003',
      assignmentId: 'asg-p5-maths',
      studentId: 'stu-2026-003',
      status: 'SUBMITTED',
      answerText: 'Attached are my answers for the math homework set on fractions.',
      submittedAt: serverTimestamp(),
    },
  ];
  for (const sub of submissionsData) {
    await setDoc(doc(db, 'submissions', sub.submissionId), {
      ...sub,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    count++;
  }

  // 12. School Announcements
  updateProgress('Broadcasting school announcements...');
  const announcementsData = [
    {
      announcementId: 'ann-001',
      title: 'Welcome to the 2026/2027 Academic Session',
      message: 'The management warmly welcomes all returning and newly admitted pupils, parents, and academic educators. Together we continue our standard of academic excellence and character integrity.',
      audience: 'ALL',
      postedBy: 'School Principal',
      publishedAt: serverTimestamp(),
    },
    {
      announcementId: 'ann-002',
      title: 'First Term General PTA Assembly',
      message: 'Notice is hereby given to all parents and guardians that the general PTA executive briefing will take place on Saturday, 3rd October by 10:00 AM at the Multipurpose Hall.',
      audience: 'PARENTS',
      postedBy: 'PTA Secretariat',
      publishedAt: serverTimestamp(),
    },
    {
      announcementId: 'ann-003',
      title: 'Annual Inter-House Athletics Festival Notice',
      message: 'Inter-house preliminary heats and march-past training will hold every Thursday afternoon. Students should bring their full sports wear and house jerseys.',
      audience: 'ALL',
      postedBy: 'Sports Directorate',
      publishedAt: serverTimestamp(),
    },
  ];
  for (const ann of announcementsData) {
    await setDoc(doc(db, 'announcements', ann.announcementId), {
      ...ann,
    }, { merge: true });
    count++;
  }

  updateProgress('Finalizing audit trails...');
  try {
    await logAudit(
      adminUid,
      'SYSTEM_TEST_DATA_SEEDED',
      'system',
      'all',
      `Regenerated realistic school test records (${count} records created across classes, subjects, students, teachers, parents, attendance, fees, results, assignments, and announcements)`
    );
  } catch (auditErr) {
    console.warn('Could not record seed audit log:', auditErr);
  }

  return { success: true, createdCount: count };
};

