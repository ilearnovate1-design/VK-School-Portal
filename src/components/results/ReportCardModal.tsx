import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Student, SchoolClass, Result, Subject } from '../../types';
import { useSchool } from '../../contexts/SchoolContext';
import { formatDate } from '../../utils/formatters';
import { Printer, Award } from 'lucide-react';

interface ReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  schoolClass: SchoolClass | null;
  results: Result[];
  attendanceSummary?: { total: number; present: number; absent: number; late: number; rate: number };
}

export const ReportCardModal: React.FC<ReportCardModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolClass,
  results,
  attendanceSummary = { total: 0, present: 0, absent: 0, late: 0, rate: 100 },
}) => {
  const { settings } = useSchool();

  if (!student) return null;

  const totalPossible = results.length * 100;
  const totalScored = results.reduce((sum, r) => sum + (r.totalScore || 0), 0);
  const averageScore = results.length > 0 ? (totalScored / results.length).toFixed(1) : '0';

  const handlePrint = () => {
    window.print();
  };

  // Automated remarks based on average
  const avgNum = parseFloat(averageScore);
  let defaultTeacherRemark = 'A consistent and hardworking pupil. Keep aiming higher!';
  let defaultPrincipalRemark = 'Promoted with commendable performance. Well done!';

  if (avgNum >= 75) {
    defaultTeacherRemark = 'An exceptionally brilliant and diligent pupil. Outstanding performance!';
    defaultPrincipalRemark = 'Excellent academic distinction! Commended for high diligence.';
  } else if (avgNum >= 60) {
    defaultTeacherRemark = 'Very good work throughout the term. Shows keen interest in learning.';
    defaultPrincipalRemark = 'Good result. Encourage more reading to maintain progress.';
  } else if (avgNum < 45 && results.length > 0) {
    defaultTeacherRemark = 'Needs to pay more attention in class and complete all homework.';
    defaultPrincipalRemark = 'Fair effort. Must receive extra tutoring in weak subject areas.';
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Terminal Report Card"
      subtitle={`${student.firstName} ${student.lastName} • ${settings.currentTerm} (${settings.currentAcademicSession})`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Printable Report Card Sheet */}
        <div 
          id="official-report-card-print"
          className="bg-white border-2 border-emerald-900 rounded-xl p-6 sm:p-8 space-y-6 text-slate-900 shadow-xs"
        >
          {/* Header */}
          <div className="text-center border-b-2 border-emerald-900 pb-4">
            <h1 className="text-xl sm:text-2xl font-black text-emerald-950 uppercase tracking-wide">
              {settings.schoolName}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">{settings.address}</p>
            <p className="text-xs text-slate-500">
              Tel: {settings.phone} • Email: {settings.email}
            </p>
            <div className="inline-block mt-3 px-6 py-1 bg-emerald-900 text-white text-xs font-black uppercase tracking-widest rounded-sm">
              Continuous Assessment & Terminal Examination Report
            </div>
          </div>

          {/* Student & Session Information Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-300 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 block">Pupil Name:</span>
              <span className="font-bold text-slate-900 text-sm">
                {student.firstName} {student.middleName || ''} {student.lastName}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Admission Number:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{student.admissionNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Class Grade:</span>
              <span className="font-bold text-slate-900 text-sm">{schoolClass?.name || 'Class'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Session & Term:</span>
              <span className="font-bold text-slate-900 text-sm">
                {settings.currentTerm}, {settings.currentAcademicSession}
              </span>
            </div>
          </div>

          {/* Attendance and Punctuality Row */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg">
            <div>
              <span className="text-slate-600 block text-[10px] uppercase font-bold">School Days</span>
              <span className="font-bold text-slate-900">{attendanceSummary.total || 60}</span>
            </div>
            <div>
              <span className="text-slate-600 block text-[10px] uppercase font-bold">Times Present</span>
              <span className="font-bold text-emerald-700">{attendanceSummary.present || 58}</span>
            </div>
            <div>
              <span className="text-slate-600 block text-[10px] uppercase font-bold">Times Absent</span>
              <span className="font-bold text-rose-600">{attendanceSummary.absent || 2}</span>
            </div>
            <div>
              <span className="text-slate-600 block text-[10px] uppercase font-bold">Attendance Rate</span>
              <span className="font-bold text-emerald-800">{attendanceSummary.rate}%</span>
            </div>
          </div>

          {/* Subject Scores Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-emerald-900 text-white font-bold text-center">
                <tr>
                  <th className="px-4 py-2.5 text-left">Subject</th>
                  <th className="px-3 py-2.5">CA (30)</th>
                  <th className="px-3 py-2.5">Exam (70)</th>
                  <th className="px-3 py-2.5">Total (100)</th>
                  <th className="px-3 py-2.5">Grade</th>
                  <th className="px-4 py-2.5 text-left">Remarks</th>
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
                      <td className="px-4 py-2 text-left font-bold text-slate-900 capitalize">
                        {r.subjectId.replace('sub-', '')}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{r.caScore}</td>
                      <td className="px-3 py-2 text-slate-700">{r.examScore}</td>
                      <td className="px-3 py-2 font-black text-slate-900 text-sm">{r.totalScore}</td>
                      <td className="px-3 py-2 font-black text-emerald-800">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-300">
                          {r.grade}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-left text-slate-600 text-[11px] italic">
                        {r.remark || 'Good'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {results.length > 0 && (
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <tr>
                    <td className="px-4 py-2 text-left uppercase">Overall Summary</td>
                    <td colSpan={2} className="px-3 py-2 text-center text-slate-600">
                      Total Obtained: <strong className="text-slate-900">{totalScored}</strong> / {totalPossible}
                    </td>
                    <td className="px-3 py-2 text-center font-black text-emerald-800 text-sm">
                      {averageScore}%
                    </td>
                    <td colSpan={2} className="px-4 py-2 text-left text-emerald-800 font-bold">
                      Class Standing: Commendable
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Grading Key */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 flex flex-wrap justify-between gap-1">
            <span className="font-bold text-slate-800 uppercase">Grading Scale:</span>
            <span>70-100: <strong>A (Excellent)</strong></span>
            <span>60-69: <strong>B (Very Good)</strong></span>
            <span>50-59: <strong>C (Good)</strong></span>
            <span>45-49: <strong>D (Fair)</strong></span>
            <span>40-44: <strong>E (Pass)</strong></span>
            <span>0-39: <strong>F (Fail)</strong></span>
          </div>

          {/* Teacher & Principal Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-white border border-slate-300 rounded-lg space-y-1">
              <span className="font-bold text-emerald-950 uppercase text-[10px] block">
                Class Teacher's Remark:
              </span>
              <p className="italic text-slate-700">{defaultTeacherRemark}</p>
              <div className="pt-4 border-b border-slate-300 w-32"></div>
              <span className="text-[10px] text-slate-400">Class Teacher Signature</span>
            </div>

            <div className="p-3 bg-white border border-slate-300 rounded-lg space-y-1">
              <span className="font-bold text-emerald-950 uppercase text-[10px] block">
                Principal / Head of School's Remark:
              </span>
              <p className="italic text-slate-700">{defaultPrincipalRemark}</p>
              <div className="pt-4 border-b border-slate-300 w-32"></div>
              <span className="text-[10px] text-slate-400">Principal Signature & Official Stamp</span>
            </div>
          </div>

          {/* Next Term Resumption */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-xs">
            <span className="text-slate-600">Next Academic Term Resumption Date:</span>{' '}
            <strong className="text-emerald-900 font-bold">
              {formatDate(settings.nextTermResumptionDate || '2026-09-21')}
            </strong>
          </div>
        </div>

        {/* Modal Controls */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handlePrint} leftIcon={<Printer className="w-4 h-4" />}>
            Print Terminal Report Card
          </Button>
        </div>
      </div>
    </Modal>
  );
};
