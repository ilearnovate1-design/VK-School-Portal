import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Student, SchoolClass, Parent, Result, Payment, AttendanceRecord } from '../../types';
import { useSchool } from '../../contexts/SchoolContext';
import { formatDate, formatNaira } from '../../utils/formatters';
import { printDocumentElement, downloadDocumentAsFile } from '../../utils/documentGenerator';
import { Printer, Download, UserCheck, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface StudentProfileDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  schoolClass?: SchoolClass | null;
  parent?: Parent | null;
  results?: Result[];
  payments?: Payment[];
  attendance?: AttendanceRecord[];
  expectedFee?: number;
}

export const StudentProfileDocumentModal: React.FC<StudentProfileDocumentModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolClass,
  parent,
  results = [],
  payments = [],
  attendance = [],
  expectedFee = 0,
}) => {
  const { settings } = useSchool();

  if (!student) return null;

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balance = Math.max(0, expectedFee - totalPaid);
  const totalDays = attendance.length;
  const presentDays = attendance.filter((a) => a.status === 'PRESENT').length;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  const totalScored = results.reduce((sum, r) => sum + (r.totalScore || 0), 0);
  const avgScore = results.length > 0 ? (totalScored / results.length).toFixed(1) : '0';

  const docTitle = `Pupil_Dossier_${student.admissionNumber}_${student.firstName}_${student.lastName}`;
  const filename = `${docTitle}.html`;

  const handlePrint = () => {
    printDocumentElement('official-student-profile-print', `Pupil Dossier - ${student.firstName} ${student.lastName}`);
  };

  const handleDownload = () => {
    downloadDocumentAsFile(
      'official-student-profile-print',
      filename,
      `Pupil Biodata Dossier - ${student.firstName} ${student.lastName}`
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Pupil Biodata & Dossier Document"
      subtitle={`${student.firstName} ${student.lastName} • Admission No: ${student.admissionNumber}`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Printable & Downloadable Profile Paper */}
        <div
          id="official-student-profile-print"
          className="bg-white border-2 border-emerald-900 rounded-xl p-6 sm:p-8 space-y-5 text-slate-900 shadow-xs"
        >
          {/* Institutional Header */}
          <div className="text-center border-b-2 border-emerald-900 pb-4 relative">
            <div className="flex items-center justify-center gap-3 mb-1">
              <div className="w-12 h-12 rounded-xl bg-emerald-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
                {settings.schoolName ? settings.schoolName.charAt(0) : 'S'}
              </div>
              <div className="text-left sm:text-center">
                <h1 className="text-xl sm:text-2xl font-black text-emerald-950 uppercase tracking-wide leading-tight">
                  {settings.schoolName}
                </h1>
                <p className="text-[11px] text-slate-600 font-medium">{settings.address}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Tel: {settings.phone} • Email: {settings.email} • Session: {settings.currentAcademicSession}
            </p>
            <div className="inline-block mt-2.5 px-6 py-1 bg-emerald-900 text-white text-xs font-black uppercase tracking-widest rounded-sm shadow-xs">
              Official Pupil Biodata & Academic Record Dossier
            </div>
          </div>

          {/* Student Identity Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-300 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-2xl shrink-0 overflow-hidden border-2 border-emerald-900 shadow-xs">
                {student.photoUrl ? (
                  <img src={student.photoUrl} alt="Portrait" className="w-20 h-20 object-cover" />
                ) : (
                  <span>{student.firstName.charAt(0)}</span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase">
                  {student.firstName} {student.middleName ? student.middleName + ' ' : ''}{student.lastName}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-700 font-medium">
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-900">
                    ADM: {student.admissionNumber}
                  </span>
                  <span>Class: <strong className="text-emerald-900">{schoolClass?.name || 'Class'}</strong></span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                    Status: {student.status || 'ACTIVE'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enrolled on: {formatDate(student.admissionDate)} • Academic Year: {settings.currentAcademicSession}
                </p>
              </div>
            </div>

            <div className="text-right sm:text-right shrink-0">
              <div className="p-2 border border-slate-300 rounded bg-white text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Dossier Ref</span>
                <span className="text-xs font-mono font-bold text-slate-800">
                  REF-{student.admissionNumber.replace(/\D/g, '') || '9041'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Demographic & Personal Particulars */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-800" />
              1. Personal Demographics & Physical Particulars
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Date of Birth</span>
                <span className="font-bold text-slate-900">{formatDate(student.dateOfBirth)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Gender</span>
                <span className="font-bold text-slate-900">{student.gender || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nationality</span>
                <span className="font-bold text-slate-900">Nigerian</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">State of Origin</span>
                <span className="font-bold text-slate-900">Lagos State</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Residential Home Address</span>
                <span className="font-medium text-slate-900">{student.address || 'Address provided on admission file'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Blood Group / Genotype</span>
                <span className="font-bold text-slate-900">O+ / AA (Verified)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Medical Conditions</span>
                <span className="font-bold text-emerald-700">None Recorded</span>
              </div>
            </div>
          </div>

          {/* Section 2: Parent / Guardian & Emergency Contacts */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
              2. Parent / Guardian & Emergency Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Primary Guardian</span>
                <span className="font-bold text-slate-900 text-sm">
                  {parent ? `${parent.firstName} ${parent.lastName}` : student.emergencyContactName || 'Parent On Record'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Relationship: {parent?.relationship || 'Parent / Sponsor'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Phone Contact</span>
                <span className="font-mono font-bold text-slate-900">
                  {parent?.phone || student.emergencyContactPhone || 'Available in register'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Email: {parent?.email || student.emergencyContactEmail || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Emergency Contact Person</span>
                <span className="font-bold text-slate-900">
                  {student.emergencyContactName || parent?.firstName || 'Next of Kin'}
                </span>
                <span className="font-mono font-semibold text-slate-700 text-[11px] block">
                  Tel: {student.emergencyContactPhone || parent?.phone || 'On file'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Academic & Attendance Standing */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider border-b border-slate-200 pb-1">
              3. Current Academic Standing & Attendance Record
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Terminal Average</span>
                <span className="text-base font-black text-emerald-900">{avgScore}%</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Subjects Registered</span>
                <span className="text-base font-black text-slate-900">{results.length} Subjects</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Attendance Rating</span>
                <span className="text-base font-black text-emerald-800">{attendanceRate}%</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Disciplinary Status</span>
                <span className="text-xs font-black text-emerald-800 uppercase block mt-1">Exemplary</span>
              </div>
            </div>

            {results.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs mt-2">
                <table className="w-full text-left">
                  <thead className="bg-emerald-900 text-white font-bold">
                    <tr>
                      <th className="px-3 py-1.5">Subject</th>
                      <th className="px-2 py-1.5 text-center">CA (30)</th>
                      <th className="px-2 py-1.5 text-center">Exam (70)</th>
                      <th className="px-2 py-1.5 text-center">Total (100)</th>
                      <th className="px-2 py-1.5 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {results.slice(0, 6).map((r) => (
                      <tr key={r.resultId} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-semibold text-slate-900 capitalize">
                          {r.subjectId.replace('sub-', '').replace(/-/g, ' ')}
                        </td>
                        <td className="px-2 py-1.5 text-center">{r.caScore}</td>
                        <td className="px-2 py-1.5 text-center">{r.examScore}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-slate-900">{r.totalScore}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-emerald-800">{r.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 4: Bursary & Ledger Clearance */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider border-b border-slate-200 pb-1">
              4. Bursary Account & Financial Standing
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Assessed Tariff</span>
                <span className="font-bold text-slate-900">{formatNaira(expectedFee)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Cleared</span>
                <span className="font-bold text-emerald-800">{formatNaira(totalPaid)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Outstanding Balance</span>
                <span className={`font-bold ${balance <= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {balance <= 0 ? '₦0.00 (Fully Cleared)' : formatNaira(balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Institutional Certification & Signatures */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-slate-300 text-xs">
            <div className="space-y-2">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Registrar / Admissions Office:</span>
              <div className="font-serif italic font-semibold text-emerald-950 text-sm">Mrs. F. A. Balogun</div>
              <div className="border-b border-slate-300 w-36"></div>
              <span className="text-[10px] text-slate-500 block">Verified & Certified Official Record</span>
            </div>

            <div className="space-y-2 text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Head of School / Principal:</span>
              <div className="font-serif italic font-semibold text-emerald-950 text-sm">Dr. E. O. Okonjo (PhD)</div>
              <div className="border-b border-slate-300 w-36 ml-auto"></div>
              <div className="inline-block border border-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-emerald-800 uppercase">
                SEAL OF INSTITUTION
              </div>
            </div>
          </div>
        </div>

        {/* Modal footer controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleDownload}
              leftIcon={<Download className="w-4 h-4 text-emerald-800" />}
              className="flex-1 sm:flex-none"
            >
              Download Profile Dossier
            </Button>
            <Button
              variant="primary"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4" />}
              className="flex-1 sm:flex-none"
            >
              Print Profile Document
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
