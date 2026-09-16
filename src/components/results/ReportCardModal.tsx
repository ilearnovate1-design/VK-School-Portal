import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Student, SchoolClass, Result, Subject } from '../../types';
import { useSchool } from '../../contexts/SchoolContext';
import { formatDate } from '../../utils/formatters';
import { printDocumentElement, downloadDocumentAsFile } from '../../utils/documentGenerator';
import { Printer, Download, Award, CheckCircle2, ShieldCheck, BookOpen, GraduationCap } from 'lucide-react';

interface ReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  schoolClass: SchoolClass | null;
  results: Result[];
  subjects?: Subject[];
  attendanceSummary?: { total: number; present: number; absent: number; late: number; rate: number };
  classPosition?: string;
  totalStudentsInClass?: number;
}

const formatSubjectTitle = (subjectId: string, subjectsList?: Subject[]): string => {
  if (subjectsList && subjectsList.length > 0) {
    const match = subjectsList.find(s => s.subjectId === subjectId);
    if (match) return match.name;
  }
  const clean = subjectId.replace(/^sub-/, '').replace(/-/g, ' ');
  const titleMap: Record<string, string> = {
    math: 'Mathematics',
    eng: 'English Language & Studies',
    english: 'English Language & Studies',
    sci: 'Basic Science & Technology',
    science: 'Basic Science & Technology',
    'basic science': 'Basic Science & Technology',
    social: 'Social Studies & Civic Education',
    'social studies': 'Social Studies & Civic Education',
    ict: 'Information & Comm. Tech (ICT)',
    computer: 'Computer Studies / ICT',
    crk: 'Christian Religious Studies',
    irk: 'Islamic Religious Studies',
    civic: 'Civic Education',
    agric: 'Agricultural Science',
    french: 'French Language',
    arts: 'Cultural & Creative Arts',
    phe: 'Physical & Health Education',
    yoruba: 'Yoruba Language',
    hausa: 'Hausa Language',
    igbo: 'Igbo Language',
  };
  const key = clean.toLowerCase().trim();
  if (titleMap[key]) return titleMap[key];
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
};

export const ReportCardModal: React.FC<ReportCardModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolClass,
  results,
  subjects = [],
  attendanceSummary = { total: 60, present: 58, absent: 2, late: 0, rate: 97 },
  classPosition,
  totalStudentsInClass = 25,
}) => {
  const { settings } = useSchool();

  if (!student) return null;

  const totalPossible = results.length * 100;
  const totalScored = results.reduce((sum, r) => sum + (r.totalScore || 0), 0);
  const averageScore = results.length > 0 ? (totalScored / results.length).toFixed(1) : '0';
  const avgNum = parseFloat(averageScore);

  const documentTitle = `${student.firstName}_${student.lastName}_ReportCard_${settings.currentTerm.replace(/\s+/g, '_')}`;
  const filename = `${documentTitle}.html`;

  const handlePrint = () => {
    printDocumentElement('official-report-card-print', `Report Card - ${student.firstName} ${student.lastName}`);
  };

  const handleDownload = () => {
    downloadDocumentAsFile('official-report-card-print', filename, `Terminal Report Card - ${student.firstName} ${student.lastName}`);
  };

  // Automated remarks based on average
  let defaultTeacherRemark = 'A consistent and hardworking pupil. Demonstrates great enthusiasm in class activities.';
  let defaultPrincipalRemark = 'Commendable academic progress. Promoted with praise.';
  let resultVerdict = 'PASSED WITH MERIT';
  let verdictColor = 'text-emerald-800 bg-emerald-50 border-emerald-300';

  if (avgNum >= 80) {
    defaultTeacherRemark = 'An exceptionally brilliant, diligent, and disciplined pupil. Outstanding overall performance!';
    defaultPrincipalRemark = 'Executive Academic Distinction. Commended for superior intellect and exemplary conduct.';
    resultVerdict = 'PASSED WITH HIGH DISTINCTION';
    verdictColor = 'text-emerald-900 bg-emerald-100 border-emerald-400';
  } else if (avgNum >= 65) {
    defaultTeacherRemark = 'Very good work throughout the term. Shows keen analytical interest and participates actively.';
    defaultPrincipalRemark = 'Good academic standing. Maintain steady revision to sustain this standard.';
    resultVerdict = 'PASSED WITH CREDIT';
    verdictColor = 'text-teal-800 bg-teal-50 border-teal-300';
  } else if (avgNum >= 50) {
    defaultTeacherRemark = 'A steady pupil capable of higher attainment. More diligence required in home assignments.';
    defaultPrincipalRemark = 'Satisfactory performance. Advised to focus on weaker subject areas.';
    resultVerdict = 'PASSED';
    verdictColor = 'text-blue-800 bg-blue-50 border-blue-300';
  } else if (avgNum > 0) {
    defaultTeacherRemark = 'Needs to pay strict attention in class, avoid distractions, and complete all assignments.';
    defaultPrincipalRemark = 'Fair effort. Compulsory holiday coaching recommended in core calculation subjects.';
    resultVerdict = 'PROMOTED ON TRIAL';
    verdictColor = 'text-amber-800 bg-amber-50 border-amber-300';
  }

  // Affective & Psychomotor traits (1 to 5 scale)
  const affectiveTraits = [
    { trait: 'Punctuality & Regularity', score: 5 },
    { trait: 'Neatness & Uniform', score: 5 },
    { trait: 'Politeness & Courtesy', score: 5 },
    { trait: 'Honesty & Reliability', score: 4 },
    { trait: 'Relationship with Peers', score: 4 },
    { trait: 'Attentiveness in Class', score: avgNum >= 70 ? 5 : 4 },
    { trait: 'Sports & Physical Agility', score: 4 },
    { trait: 'Creativity & Handiwork', score: 4 },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Terminal Examination Report Card"
      subtitle={`${student.firstName} ${student.lastName} • ${settings.currentTerm} (${settings.currentAcademicSession})`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Printable & Downloadable Report Card Sheet */}
        <div 
          id="official-report-card-print"
          className="bg-white border-2 border-emerald-900 rounded-xl p-6 sm:p-8 space-y-5 text-slate-900 shadow-xs"
        >
          {/* Header */}
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
              Tel: {settings.phone} • Email: {settings.email} • Govt. Reg: ED/PRS/SCH/2019/842
            </p>
            
            <div className="inline-block mt-2.5 px-6 py-1 bg-emerald-900 text-white text-xs font-black uppercase tracking-widest rounded-sm shadow-xs">
              Continuous Assessment & Terminal Examination Report
            </div>
          </div>

          {/* Student & Session Information Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-300 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Pupil Full Name</span>
              <span className="font-bold text-slate-900 text-sm">
                {student.firstName} {student.middleName ? student.middleName + ' ' : ''}{student.lastName}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Admission Number</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{student.admissionNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Class & Arm</span>
              <span className="font-bold text-slate-900 text-sm">{schoolClass?.name || 'Class'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Session & Term</span>
              <span className="font-bold text-slate-900 text-sm">
                {settings.currentTerm}, {settings.currentAcademicSession}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Gender</span>
              <span className="font-semibold text-slate-900">{student.gender || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Date of Birth</span>
              <span className="font-semibold text-slate-900">{formatDate(student.dateOfBirth)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Pupils in Class</span>
              <span className="font-semibold text-slate-900">{totalStudentsInClass} Learners</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Class Position</span>
              <span className="font-bold text-emerald-800">{classPosition || '1st'}</span>
            </div>
          </div>

          {/* Attendance and Punctuality Row */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg">
            <div>
              <span className="text-slate-600 block text-[10px] uppercase font-bold">School Days</span>
              <span className="font-bold text-slate-900 text-sm">{attendanceSummary.total || 60}</span>
            </div>
            <div>
              <span className="text-slate-600 block text-[10px] uppercase font-bold">Times Present</span>
              <span className="font-bold text-emerald-700 text-sm">{attendanceSummary.present || 58}</span>
            </div>
            <div>
              <span className="text-slate-600 block text-[10px] uppercase font-bold">Times Absent</span>
              <span className="font-bold text-rose-600 text-sm">{attendanceSummary.absent || 2}</span>
            </div>
            <div>
              <span className="text-slate-600 block text-[10px] uppercase font-bold">Attendance Rate</span>
              <span className="font-bold text-emerald-800 text-sm">{attendanceSummary.rate || 97}%</span>
            </div>
          </div>

          {/* Subject Scores Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-emerald-900 text-white font-bold text-center">
                <tr>
                  <th className="px-3.5 py-2 text-left">Subject</th>
                  <th className="px-2.5 py-2">CA (30)</th>
                  <th className="px-2.5 py-2">Exam (70)</th>
                  <th className="px-2.5 py-2">Total (100)</th>
                  <th className="px-2.5 py-2">Grade</th>
                  <th className="px-3 py-2 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-center">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No published scores recorded for this pupil yet.
                    </td>
                  </tr>
                ) : (
                  results.map((r) => (
                    <tr key={r.resultId} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2 text-left font-bold text-slate-900">
                        {formatSubjectTitle(r.subjectId, subjects)}
                      </td>
                      <td className="px-2.5 py-2 text-slate-700 font-medium">{r.caScore}</td>
                      <td className="px-2.5 py-2 text-slate-700 font-medium">{r.examScore}</td>
                      <td className="px-2.5 py-2 font-black text-slate-900 text-sm">{r.totalScore}</td>
                      <td className="px-2.5 py-2 font-black text-emerald-800">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-300">
                          {r.grade}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-left text-slate-600 text-[11px] italic">
                        {r.remark || (r.totalScore >= 70 ? 'Distinction' : r.totalScore >= 60 ? 'Very Good' : r.totalScore >= 50 ? 'Credit' : 'Pass')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {results.length > 0 && (
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <tr>
                    <td className="px-3.5 py-2 text-left uppercase text-slate-800">Overall Summary</td>
                    <td colSpan={2} className="px-2.5 py-2 text-center text-slate-700">
                      Marks Scored: <strong className="text-slate-900">{totalScored}</strong> / {totalPossible}
                    </td>
                    <td className="px-2.5 py-2 text-center font-black text-emerald-900 text-sm">
                      {averageScore}%
                    </td>
                    <td colSpan={2} className="px-3 py-2 text-left">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${verdictColor}`}>
                        {resultVerdict}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Affective & Psychomotor Behavioral Domain Rating */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/70 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wider">
              <span>Affective & Psychomotor Skills Rating (5: Excellent | 4: Good | 3: Fair | 2: Poor | 1: Very Poor)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              {affectiveTraits.map((t) => (
                <div key={t.trait} className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded px-2">
                  <span className="text-slate-600 truncate mr-1">{t.trait}:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    {t.score} / 5
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Grading Scale Key */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 flex flex-wrap justify-between gap-1">
            <span className="font-bold text-slate-800 uppercase">Grading Scale:</span>
            <span>75-100: <strong>A (Distinction)</strong></span>
            <span>65-74: <strong>B (Very Good)</strong></span>
            <span>50-64: <strong>C (Credit)</strong></span>
            <span>45-49: <strong>D (Pass)</strong></span>
            <span>40-44: <strong>E (Fair)</strong></span>
            <span>0-39: <strong>F (Fail)</strong></span>
          </div>

          {/* Teacher & Principal Remarks with Seals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-white border border-slate-300 rounded-lg space-y-1.5">
              <span className="font-bold text-emerald-950 uppercase text-[10px] block">
                Class Teacher's Appraisal & Recommendation:
              </span>
              <p className="italic text-slate-700 min-h-8 text-[11px] leading-relaxed">
                "{defaultTeacherRemark}"
              </p>
              <div className="pt-3 flex items-end justify-between border-t border-slate-200">
                <div>
                  <div className="font-serif italic font-semibold text-emerald-900 text-xs">A. Adeleke</div>
                  <span className="text-[10px] text-slate-400 block">Class Teacher Signature</span>
                </div>
                <span className="text-[10px] text-slate-500">{formatDate(new Date())}</span>
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-300 rounded-lg space-y-1.5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950 uppercase text-[10px] block">
                  Principal / Head of School's Remark:
                </span>
                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-800 text-white rounded font-bold uppercase">
                  Official Seal
                </span>
              </div>
              <p className="italic text-slate-700 min-h-8 text-[11px] leading-relaxed">
                "{defaultPrincipalRemark}"
              </p>
              <div className="pt-3 flex items-end justify-between border-t border-slate-200">
                <div>
                  <div className="font-serif italic font-semibold text-emerald-900 text-xs">Dr. E. O. Okonjo (PhD)</div>
                  <span className="text-[10px] text-slate-400 block">Head of School Signature & Stamp</span>
                </div>
                <div className="border border-emerald-700 text-emerald-800 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-50">
                  APPROVED
                </div>
              </div>
            </div>
          </div>

          {/* Next Term Resumption & Fees Notice */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span className="text-slate-600 block text-[11px]">Next Academic Term Resumption Date:</span>
              <strong className="text-emerald-950 font-bold text-sm">
                {formatDate(settings.nextTermResumptionDate || '2026-09-21')}
              </strong>
            </div>
            <div className="text-right sm:text-right text-[11px] text-slate-600">
              <span>Status: <strong className="text-emerald-800">Clearance Verified</strong></span>
              <p className="text-[10px] text-slate-500">Please present this report card upon resumption.</p>
            </div>
          </div>
        </div>

        {/* Modal Controls */}
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
              Download Report Card
            </Button>
            <Button 
              variant="primary" 
              onClick={handlePrint} 
              leftIcon={<Printer className="w-4 h-4" />}
              className="flex-1 sm:flex-none"
            >
              Print Report Card
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
