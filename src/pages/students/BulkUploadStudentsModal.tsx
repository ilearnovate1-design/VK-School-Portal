import React, { useState, useRef } from 'react';
import { 
  writeBatch, doc, collection, getDocs, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Student, SchoolClass, Parent } from '../../types';
import { logAudit } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Upload, FileText, Download, Copy, Check, AlertCircle, AlertTriangle, 
  Trash2, ArrowLeft, CheckCircle2, Users, RefreshCw
} from 'lucide-react';

interface BulkUploadStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  existingParents: Parent[];
  existingStudents: Student[];
  onSuccess: () => void;
}

interface ParsedStudentRow {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  admissionNumber: string;
  gender: 'Male' | 'Female' | 'Other';
  classId: string;
  classNameDisplay: string;
  parentName?: string;
  parentPhone?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContactPhone?: string;
  status: 'VALID' | 'WARNING' | 'ERROR';
  issues: string[];
}

const SAMPLE_CSV = `First Name,Last Name,Middle Name,Admission Number,Class,Gender,Parent Phone,Parent Name,Date of Birth,Address,Emergency Contact Phone
Chinedu,Okonkwo,Emmanuel,,Primary 1,Male,08031234567,Ngozi Okonkwo,2018-04-12,12 Broad Street Ikeja,08039876543
Amina,Bello,Fatima,,Primary 1,Female,08023456789,Ibrahim Bello,2018-08-20,4 Airport Road Ikeja,08023456789
Oluwaseun,Adeyemi,David,,Primary 1,Male,08055566778,Funke Adeyemi,2018-01-15,8 Allen Avenue Ikeja,08055566778
Zainab,Mohammed,Khadijah,,Primary 1,Female,08077788990,Musa Mohammed,2018-11-05,15 Opebi Road Ikeja,08077788990`;

export const BulkUploadStudentsModal: React.FC<BulkUploadStudentsModalProps> = ({
  isOpen,
  onClose,
  classes,
  existingParents,
  existingStudents,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'complete'>('input');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [defaultClassId, setDefaultClassId] = useState<string>(classes[0]?.classId || '');
  const [autoCreateParents, setAutoCreateParents] = useState(true);

  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Progress tracking
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadResultCount, setUploadResultCount] = useState({ students: 0, parents: 0 });
  const [uploadError, setUploadError] = useState('');

  const resetState = () => {
    setStep('input');
    setRawText('');
    setFileName('');
    setParsedRows([]);
    setUploadProgress(0);
    setUploadTotal(0);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'students_bulk_upload_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy Template
  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(SAMPLE_CSV);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  // File Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      readFile(file);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text || '');
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setFileName(file.name);
      readFile(file);
    }
  };

  // CSV/TSV Parser with smart header mapping
  const parseData = () => {
    if (!rawText.trim()) return;

    // Split lines handling \r\n or \n
    const rawLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) return;

    // Check separator of first line (comma or tab or semicolon)
    const firstLine = rawLines[0];
    let separator = ',';
    if (firstLine.includes('\t')) separator = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) separator = ';';

    const parseLine = (line: string): string[] => {
      if (separator === '\t') {
        return line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
      }
      // Handle comma/semicolon with potential quotes
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
          result.push(cur.trim().replace(/^["']|["']$/g, ''));
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const rows = rawLines.map(parseLine);
    if (rows.length === 0) return;

    // Determine if first row is header
    const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const isHeaderRow = headers.some(h => 
      h.includes('first') || h.includes('name') || h.includes('student') || h.includes('admission') || h.includes('class')
    );

    const dataRows = isHeaderRow ? rows.slice(1) : rows;

    // Header index mapping
    let colIdx = {
      firstName: -1,
      lastName: -1,
      middleName: -1,
      admissionNumber: -1,
      class: -1,
      gender: -1,
      parentPhone: -1,
      parentName: -1,
      dateOfBirth: -1,
      address: -1,
      emergencyPhone: -1,
    };

    if (isHeaderRow) {
      headers.forEach((h, idx) => {
        if (h.includes('first') || (h.includes('fname') && !h.includes('parent'))) colIdx.firstName = idx;
        else if (h.includes('last') || h.includes('surname') || (h.includes('lname') && !h.includes('parent'))) colIdx.lastName = idx;
        else if (h.includes('middle') || h.includes('othername')) colIdx.middleName = idx;
        else if (h.includes('admission') || h.includes('admno') || h.includes('regno') || h.includes('idnumber')) colIdx.admissionNumber = idx;
        else if (h.includes('class') || h.includes('grade') || h.includes('arm')) colIdx.class = idx;
        else if (h.includes('gender') || h.includes('sex')) colIdx.gender = idx;
        else if (h.includes('parentphone') || (h.includes('phone') && !h.includes('emergency')) || h.includes('guardianphone')) colIdx.parentPhone = idx;
        else if (h.includes('parent') || h.includes('guardian')) colIdx.parentName = idx;
        else if (h.includes('dob') || h.includes('birth') || h.includes('dateofbirth')) colIdx.dateOfBirth = idx;
        else if (h.includes('address') || h.includes('residence')) colIdx.address = idx;
        else if (h.includes('emergency') || h.includes('altphone')) colIdx.emergencyPhone = idx;
      });
    } else {
      // Fallback column order: First, Last, Middle, Admission, Class, Gender, ParentPhone, ParentName...
      colIdx = {
        firstName: 0,
        lastName: 1,
        middleName: 2,
        admissionNumber: 3,
        class: 4,
        gender: 5,
        parentPhone: 6,
        parentName: 7,
        dateOfBirth: 8,
        address: 9,
        emergencyPhone: 10,
      };
    }

    const currentYear = new Date().getFullYear();
    let generatedAdmCounter = 101;
    const existingAdmissionNumbers = new Set(existingStudents.map(s => (s.admissionNumber || '').trim().toLowerCase()));
    const batchAdmissionNumbers = new Set<string>();

    const parsed: ParsedStudentRow[] = [];

    dataRows.forEach((cols, index) => {
      if (cols.length === 0 || cols.every(c => c === '')) return;

      const firstName = (colIdx.firstName !== -1 ? cols[colIdx.firstName] : cols[0]) || '';
      const lastName = (colIdx.lastName !== -1 ? cols[colIdx.lastName] : cols[1]) || '';
      const middleName = colIdx.middleName !== -1 ? cols[colIdx.middleName] : (cols[2] || '');
      let rawAdmissionNumber = colIdx.admissionNumber !== -1 ? cols[colIdx.admissionNumber] : '';
      const rawClass = colIdx.class !== -1 ? cols[colIdx.class] : '';
      const rawGender = colIdx.gender !== -1 ? cols[colIdx.gender] : '';
      const parentPhone = colIdx.parentPhone !== -1 ? cols[colIdx.parentPhone] : '';
      const parentName = colIdx.parentName !== -1 ? cols[colIdx.parentName] : '';
      const dateOfBirth = colIdx.dateOfBirth !== -1 ? cols[colIdx.dateOfBirth] : '';
      const address = colIdx.address !== -1 ? cols[colIdx.address] : '';
      const emergencyContactPhone = colIdx.emergencyPhone !== -1 ? cols[colIdx.emergencyPhone] : '';

      const issues: string[] = [];
      let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';

      // 1. Name validation
      if (!firstName.trim()) {
        issues.push('Missing First Name');
        status = 'ERROR';
      }
      if (!lastName.trim()) {
        issues.push('Missing Last Name');
        status = 'ERROR';
      }

      // 2. Class Resolution
      let matchedClassId = defaultClassId;
      let matchedClassName = classes.find(c => c.classId === defaultClassId)?.name || 'Default Class';

      if (rawClass && rawClass.trim()) {
        const queryClass = rawClass.trim().toLowerCase();
        const found = classes.find(c => 
          c.name.toLowerCase() === queryClass || 
          c.name.toLowerCase().replace(/\s+/g, '') === queryClass.replace(/\s+/g, '') ||
          c.classId.toLowerCase() === queryClass
        );

        if (found) {
          matchedClassId = found.classId;
          matchedClassName = found.name;
        } else if (defaultClassId) {
          issues.push(`Class "${rawClass}" not recognized. Using default: ${matchedClassName}`);
          if (status !== 'ERROR') status = 'WARNING';
        } else {
          issues.push(`Class "${rawClass}" does not exist in school`);
          status = 'ERROR';
        }
      } else if (!matchedClassId) {
        issues.push('No class specified and no default class selected');
        status = 'ERROR';
      }

      // 3. Gender normalization
      let normalizedGender: 'Male' | 'Female' | 'Other' = 'Male';
      const gLower = rawGender.trim().toLowerCase();
      if (gLower.startsWith('f') || gLower === 'female' || gLower === 'girl') {
        normalizedGender = 'Female';
      } else if (gLower.startsWith('m') || gLower === 'male' || gLower === 'boy') {
        normalizedGender = 'Male';
      } else if (rawGender.trim()) {
        normalizedGender = 'Other';
      } else {
        issues.push('Gender not specified (defaulted to Male)');
        if (status !== 'ERROR') status = 'WARNING';
      }

      // 4. Admission Number Resolution & Duplicate check
      let finalAdmissionNumber = rawAdmissionNumber.trim();
      if (!finalAdmissionNumber) {
        // Auto-generate
        while (
          existingAdmissionNumbers.has(`stu-${currentYear}-${generatedAdmCounter}`.toLowerCase()) ||
          batchAdmissionNumbers.has(`stu-${currentYear}-${generatedAdmCounter}`.toLowerCase())
        ) {
          generatedAdmCounter++;
        }
        finalAdmissionNumber = `STU-${currentYear}-${generatedAdmCounter}`;
        generatedAdmCounter++;
        issues.push(`Auto-assigned Admission No: ${finalAdmissionNumber}`);
        if (status !== 'ERROR') status = 'WARNING';
      } else {
        const lowerAdm = finalAdmissionNumber.toLowerCase();
        if (existingAdmissionNumbers.has(lowerAdm)) {
          issues.push(`Admission No "${finalAdmissionNumber}" already exists in system`);
          status = 'ERROR';
        } else if (batchAdmissionNumbers.has(lowerAdm)) {
          issues.push(`Duplicate Admission No "${finalAdmissionNumber}" within this file`);
          status = 'ERROR';
        }
      }

      batchAdmissionNumbers.add(finalAdmissionNumber.toLowerCase());

      parsed.push({
        id: `row-${index}-${Date.now()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || undefined,
        admissionNumber: finalAdmissionNumber,
        gender: normalizedGender,
        classId: matchedClassId,
        classNameDisplay: matchedClassName,
        parentName: parentName.trim() || undefined,
        parentPhone: parentPhone.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        address: address.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        status,
        issues,
      });
    });

    setParsedRows(parsed);
    setStep('preview');
  };

  // Remove a row from preview
  const handleRemoveRow = (id: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  // Change class for a specific row in preview
  const handleChangeRowClass = (id: string, newClassId: string) => {
    const c = classes.find(cl => cl.classId === newClassId);
    if (!c) return;

    setParsedRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      const filteredIssues = row.issues.filter(i => !i.includes('Class'));
      return {
        ...row,
        classId: newClassId,
        classNameDisplay: c.name,
        issues: filteredIssues,
        status: row.status === 'ERROR' && filteredIssues.length === 0 ? 'VALID' : row.status,
      };
    }));
  };

  // Execute Batch Import to Firestore
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter(r => r.status !== 'ERROR');
    if (validRows.length === 0) {
      setUploadError('No valid rows available to import. Please resolve the errors or add valid records.');
      return;
    }

    setStep('importing');
    setUploadTotal(validRows.length);
    setUploadProgress(0);
    setUploadError('');

    try {
      // Map of existing parents by phone for quick lookup
      const parentsPhoneMap = new Map<string, Parent>();
      existingParents.forEach(p => {
        if (p.phone) parentsPhoneMap.set(p.phone.replace(/\D/g, ''), p);
      });

      // Prepare writes in batches (Firestore supports up to 500 per batch)
      const BATCH_SIZE = 300;
      let studentsCreatedCount = 0;
      let parentsCreatedCount = 0;

      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const slice = validRows.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const row of slice) {
          const studentDocId = row.admissionNumber.replace(/\s+/g, '-').toUpperCase();
          const studentDocRef = doc(db, 'students', studentDocId);

          let linkedParentIds: string[] = [];

          // Handle Parent creation / linking
          if (autoCreateParents && row.parentPhone) {
            const cleanPhone = row.parentPhone.replace(/\D/g, '');
            const existingP = parentsPhoneMap.get(cleanPhone);

            if (existingP) {
              linkedParentIds.push(existingP.parentId);
            } else if (cleanPhone.length >= 7) {
              // Create parent record
              const newParentId = `PAR-${cleanPhone.slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
              const parentDocRef = doc(db, 'parents', newParentId);

              // Parse parent first & last name
              const pNames = (row.parentName || 'Parent').trim().split(' ');
              const pFirst = pNames[0] || 'Guardian';
              const pLast = pNames.slice(1).join(' ') || row.lastName;

              const parentPayload: any = {
                parentId: newParentId,
                firstName: pFirst,
                lastName: pLast,
                phone: row.parentPhone,
                email: `${cleanPhone}@schoolparent.internal`,
                address: row.address || undefined,
                relationship: 'Guardian',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              // Strip undefined
              Object.keys(parentPayload).forEach(k => {
                if (parentPayload[k] === undefined) delete parentPayload[k];
              });

              batch.set(parentDocRef, parentPayload);
              parentsPhoneMap.set(cleanPhone, { ...parentPayload, parentId: newParentId } as Parent);
              linkedParentIds.push(newParentId);
              parentsCreatedCount++;
            }
          }

          const studentPayload: any = {
            studentId: studentDocId,
            admissionNumber: row.admissionNumber,
            firstName: row.firstName,
            middleName: row.middleName || undefined,
            lastName: row.lastName,
            gender: row.gender,
            classId: row.classId,
            dateOfBirth: row.dateOfBirth || '2018-01-01',
            admissionDate: new Date().toISOString().split('T')[0],
            status: 'ACTIVE',
            parentIds: linkedParentIds,
            address: row.address || undefined,
            emergencyContactPhone: row.emergencyContactPhone || row.parentPhone || undefined,
            emergencyContactName: row.parentName || undefined,
            notes: 'Enrolled via Bulk Import',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          // Clean undefined keys
          Object.keys(studentPayload).forEach(k => {
            if (studentPayload[k] === undefined) delete studentPayload[k];
          });

          batch.set(studentDocRef, studentPayload);
          studentsCreatedCount++;
        }

        await batch.commit();
        setUploadProgress(Math.min(i + slice.length, validRows.length));
      }

      // Log audit
      await logAudit(
        currentUser?.uid || 'admin',
        'STUDENTS_BULK_UPLOADED',
        'students',
        'batch',
        `Bulk uploaded ${studentsCreatedCount} students and created ${parentsCreatedCount} parent contacts`
      );

      setUploadResultCount({ students: studentsCreatedCount, parents: parentsCreatedCount });
      setStep('complete');
      onSuccess();
    } catch (err: any) {
      console.error('Error executing bulk student upload:', err);
      setUploadError(err?.message || 'Failed to complete student import. Please try again.');
      setStep('preview');
    }
  };

  const validCount = parsedRows.filter(r => r.status === 'VALID').length;
  const warningCount = parsedRows.filter(r => r.status === 'WARNING').length;
  const errorCount = parsedRows.filter(r => r.status === 'ERROR').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Upload Students"
      subtitle="Enroll multiple pupils in seconds using CSV or spreadsheet copy-paste"
      maxWidth="4xl"
    >
      <div className="p-1 sm:p-2 space-y-4">
        {/* STEP 1: INPUT & UPLOAD */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* Quick Template Download Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-emerald-950">
                    Need the formatted student template?
                  </h4>
                  <p className="text-[11px] sm:text-xs text-emerald-800">
                    Includes columns for Names, Admission Number, Class Arm, Gender, and Parent phone.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyTemplate}
                  leftIcon={copiedTemplate ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  className="bg-white border-emerald-300 text-emerald-900 flex-1 sm:flex-initial"
                >
                  {copiedTemplate ? 'Copied!' : 'Copy Template'}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleDownloadTemplate}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                  className="flex-1 sm:flex-initial"
                >
                  Download CSV
                </Button>
              </div>
            </div>

            {/* Default Class Fallback & Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Class (for rows missing Class):
                </label>
                <select
                  value={defaultClassId}
                  onChange={(e) => setDefaultClassId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="">-- Select Default Class --</option>
                  {classes.map((c) => (
                    <option key={c.classId} value={c.classId}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  If the file doesn't have a class column, all rows will be assigned here.
                </p>
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoCreateParents}
                    onChange={(e) => setAutoCreateParents(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Auto-link / create Parent records
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                  Links existing parent profile if phone matches, or generates a new parent contact.
                </p>
              </div>
            </div>

            {/* Upload Method Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setInputMode('file')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  inputMode === 'file'
                    ? 'border-emerald-700 text-emerald-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload CSV File
              </button>
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  inputMode === 'paste'
                    ? 'border-emerald-700 text-emerald-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                Paste from Excel / Sheets
              </button>
            </div>

            {/* File Upload Zone */}
            {inputMode === 'file' ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-emerald-600 bg-emerald-50/50'
                    : 'border-slate-200 hover:border-emerald-500 hover:bg-slate-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                {fileName ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{fileName}</p>
                    <p className="text-xs text-emerald-700 font-medium">File selected. Click Preview below to continue.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      Click to choose or drag & drop a .CSV file
                    </p>
                    <p className="text-xs text-slate-500">
                      Supported formats: CSV, TSV or text exported from Excel or Google Sheets
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Paste rows directly from Excel or Google Sheets (comma or tab separated):
                </label>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="First Name, Last Name, Middle Name, Admission No, Class, Gender, Parent Phone, Parent Name..."
                  className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
                />
                <p className="text-[11px] text-slate-400">
                  {rawText.trim() ? `${rawText.split(/\r?\n/).filter(l => l.trim()).length} lines detected` : 'No data pasted yet'}
                </p>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={parseData}
                disabled={!rawText.trim()}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Parse & Preview Records
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & VALIDATION */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* Header summary badge counts */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                <span className="font-semibold text-slate-900">
                  {parsedRows.length} Pupils Parsed
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {validCount} Valid
                </span>
                {warningCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" /> {warningCount} Warnings
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-semibold text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5" /> {errorCount} Errors (will be skipped)
                  </span>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Responsive Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Student Name</th>
                    <th className="px-3 py-2.5">Admission No</th>
                    <th className="px-3 py-2.5">Class</th>
                    <th className="px-3 py-2.5">Gender</th>
                    <th className="px-3 py-2.5">Parent / Contact</th>
                    <th className="px-3 py-2.5">Status & Notes</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {parsedRows.map((row, idx) => (
                    <tr 
                      key={row.id} 
                      className={
                        row.status === 'ERROR' 
                          ? 'bg-rose-50/40' 
                          : row.status === 'WARNING' 
                          ? 'bg-amber-50/30' 
                          : 'hover:bg-slate-50/70'
                      }
                    >
                      <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {row.firstName} {row.middleName ? `${row.middleName} ` : ''}{row.lastName}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-600">
                        {row.admissionNumber}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.classId}
                          onChange={(e) => handleChangeRowClass(row.id, e.target.value)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-600"
                        >
                          {classes.map(c => (
                            <option key={c.classId} value={c.classId}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.gender}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {row.parentName || row.parentPhone ? (
                          <div>
                            <p className="font-medium text-slate-800">{row.parentName || 'Parent'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{row.parentPhone || 'No phone'}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === 'VALID' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <Check className="w-3 h-3" /> Ready
                          </span>
                        )}
                        {row.status !== 'VALID' && (
                          <div className="space-y-0.5">
                            {row.issues.map((iss, iIdx) => (
                              <p 
                                key={iIdx} 
                                className={`text-[10px] leading-tight ${row.status === 'ERROR' ? 'text-rose-600 font-medium' : 'text-amber-700'}`}
                              >
                                • {iss}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          title="Remove this student from import"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('input')}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back / Re-upload
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleExecuteImport}
                  disabled={validCount + warningCount === 0}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  Confirm & Import {validCount + warningCount} Students
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: IMPORTING PROGRESS */}
        {step === 'importing' && (
          <div className="py-12 px-4 text-center space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto animate-pulse">
              <RefreshCw className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Enrolling Pupils into Portal...</h3>
              <p className="text-xs text-slate-500 mt-1">
                Creating student profiles, generating admission IDs, and linking parent records.
              </p>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadTotal > 0 ? (uploadProgress / uploadTotal) * 100 : 10}%` }}
              />
            </div>
            <p className="text-xs font-mono font-medium text-slate-600">
              {uploadProgress} of {uploadTotal} processed
            </p>
          </div>
        )}

        {/* STEP 4: COMPLETE */}
        {step === 'complete' && (
          <div className="py-8 px-4 text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Bulk Enrollment Complete!</h3>
              <p className="text-xs text-slate-600 mt-1">
                Successfully enrolled <strong className="text-emerald-800">{uploadResultCount.students} pupils</strong>.
                {uploadResultCount.parents > 0 && (
                  <span> Associated and generated <strong className="text-emerald-800">{uploadResultCount.parents} parent contact profiles</strong>.</span>
                )}
              </p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 text-left space-y-1">
              <p className="font-semibold">What's next:</p>
              <p>• Students are now visible in the Student Directory and their assigned class rosters.</p>
              <p>• Teachers can mark their daily attendance and input CA / examination scores.</p>
              <p>• Bursars can issue terminal fee structures and generate payment receipts.</p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                onClick={handleClose}
                className="w-full"
              >
                Close & View Student Directory
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
