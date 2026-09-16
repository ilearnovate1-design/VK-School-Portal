import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Student, SchoolClass, Payment, FeeStructure } from '../../types';
import { useSchool } from '../../contexts/SchoolContext';
import { formatDate, formatNaira } from '../../utils/formatters';
import { printDocumentElement, downloadDocumentAsFile } from '../../utils/documentGenerator';
import { Printer, Download, CheckCircle2, AlertCircle } from 'lucide-react';

interface FeeStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  schoolClass?: SchoolClass | null;
  payments: Payment[];
  expectedFee: number;
}

export const FeeStatementModal: React.FC<FeeStatementModalProps> = ({
  isOpen,
  onClose,
  student,
  schoolClass,
  payments,
  expectedFee,
}) => {
  const { settings } = useSchool();

  if (!student) return null;

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balanceRemaining = Math.max(0, expectedFee - totalPaid);
  const isFullyPaid = balanceRemaining <= 0 && expectedFee > 0;

  const docTitle = `Fee_Statement_${student.admissionNumber}_${student.firstName}_${student.lastName}`;
  const filename = `${docTitle}.html`;

  const handlePrint = () => {
    printDocumentElement('official-statement-print-area', `Fee Statement - ${student.firstName} ${student.lastName}`);
  };

  const handleDownload = () => {
    downloadDocumentAsFile(
      'official-statement-print-area',
      filename,
      `Official Fee Statement - ${student.firstName} ${student.lastName}`
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official School Fee Statement of Account"
      subtitle={`${student.firstName} ${student.lastName} • ${settings.currentTerm} (${settings.currentAcademicSession})`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Printable & Downloadable Statement */}
        <div
          id="official-statement-print-area"
          className="bg-white border-2 border-emerald-900 rounded-xl p-6 sm:p-8 space-y-5 text-slate-900 shadow-xs"
        >
          {/* Header */}
          <div className="text-center border-b-2 border-emerald-900 pb-4">
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
              Tel: {settings.phone} • Email: {settings.email} • Bursary & Accounts Division
            </p>
            <div className="inline-block mt-2.5 px-6 py-1 bg-emerald-900 text-white text-xs font-black uppercase tracking-widest rounded-sm shadow-xs">
              Official Terminal Statement of Account & Clearance Ledger
            </div>
          </div>

          {/* Student Particulars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Pupil Full Name</span>
              <span className="font-bold text-slate-900 text-sm">
                {student.firstName} {student.middleName ? student.middleName + ' ' : ''}{student.lastName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Admission Number</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{student.admissionNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Class Grade</span>
              <span className="font-bold text-slate-900 text-sm">{schoolClass?.name || 'Class'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Session & Term</span>
              <span className="font-bold text-slate-900 text-sm">
                {settings.currentTerm}, {settings.currentAcademicSession}
              </span>
            </div>
          </div>

          {/* Financial Overview Cards */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block uppercase font-bold text-[10px]">Total Assessed Tariff</span>
              <span className="text-sm sm:text-base font-black text-slate-900">{formatNaira(expectedFee)}</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 block uppercase font-bold text-[10px]">Total Cleared</span>
              <span className="text-sm sm:text-base font-black text-emerald-800">{formatNaira(totalPaid)}</span>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
              <span className="text-rose-700 block uppercase font-bold text-[10px]">Outstanding Balance</span>
              <span className="text-sm sm:text-base font-black text-rose-700">{formatNaira(balanceRemaining)}</span>
            </div>
          </div>

          {/* Itemized Payments History */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Payments Received & Receipt References
            </h4>
            <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-emerald-900 text-white font-bold">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Receipt No</th>
                    <th className="px-3 py-2.5">Method</th>
                    <th className="px-3 py-2.5">Reference</th>
                    <th className="px-4 py-2.5 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        No payments recorded for this terminal billing cycle.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.paymentId} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700">{formatDate(p.paymentDate)}</td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">{p.receiptNumber}</td>
                        <td className="px-3 py-2 text-slate-600">{p.paymentMethod ? p.paymentMethod.replace('_', ' ') : 'TRANSFER'}</td>
                        <td className="px-3 py-2 font-mono text-slate-500 text-[11px]">{p.reference || '—'}</td>
                        <td className="px-4 py-2 text-right font-black text-emerald-800">{formatNaira(p.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-slate-700 text-right uppercase">
                      Cumulative Total Remitted:
                    </td>
                    <td className="px-4 py-2 text-right font-black text-emerald-900">
                      {formatNaira(totalPaid)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Clearance Status Stamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Financial Clearance Verdict</span>
              <div className="flex items-center gap-2 mt-1">
                {isFullyPaid ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-emerald-800 text-sm">
                      Full Financial Clearance Granted
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span className="font-bold text-rose-700 text-sm">
                      Pending Clearance • Balance Outstanding
                    </span>
                  </>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Generated from the institutional bursary ledger database on {formatDate(new Date())}.
              </p>
            </div>

            <div className="text-right sm:text-right space-y-1">
              <div className="inline-block p-2 border-2 border-dashed border-emerald-800 rounded bg-white text-center">
                <span className="text-[9px] font-black uppercase text-emerald-900 block">BURSAR AUDIT DESK</span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 block">AUTHENTICATED</span>
              </div>
              <p className="text-[10px] text-slate-500">Authorized Bursar Sign-off</p>
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
              Download Statement
            </Button>
            <Button
              variant="primary"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4" />}
              className="flex-1 sm:flex-none"
            >
              Print Statement
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
