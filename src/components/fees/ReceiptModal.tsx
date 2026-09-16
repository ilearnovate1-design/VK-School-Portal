import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Payment, Student, SchoolClass, Parent } from '../../types';
import { useSchool } from '../../contexts/SchoolContext';
import { formatNaira, formatDate, numberToWordsNaira } from '../../utils/formatters';
import { printDocumentElement, downloadDocumentAsFile } from '../../utils/documentGenerator';
import { Printer, Download, CheckCircle2, ShieldCheck, FileCheck } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  student: Student | null;
  schoolClass?: SchoolClass | null;
  parent?: Parent | null;
  balanceRemaining?: number;
  totalTariff?: number;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  student,
  schoolClass,
  parent,
  balanceRemaining = 0,
  totalTariff,
}) => {
  const { settings } = useSchool();

  if (!payment || !student) return null;

  const receiptNo = payment.receiptNumber || 'REC-2026-0000';
  const documentTitle = `Official_Receipt_${receiptNo}_${student.firstName}_${student.lastName}`;
  const filename = `${documentTitle}.html`;

  const handlePrint = () => {
    printDocumentElement('official-receipt-print-area', `Fee Receipt - ${receiptNo}`);
  };

  const handleDownload = () => {
    downloadDocumentAsFile('official-receipt-print-area', filename, `Official Payment Receipt - ${receiptNo}`);
  };

  const isFullyPaid = balanceRemaining <= 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official School Fee Receipt"
      subtitle={`Receipt No: ${receiptNo} • ${student.firstName} ${student.lastName}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Printable & Downloadable Receipt Paper */}
        <div 
          id="official-receipt-print-area" 
          className="bg-white border-2 border-slate-300 rounded-xl p-6 sm:p-8 space-y-5 text-slate-800 shadow-xs relative"
        >
          {/* Watermark badge on right top */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-emerald-900 pb-4 gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-900 text-white flex items-center justify-center font-black text-xl shrink-0">
                {settings.schoolName ? settings.schoolName.charAt(0) : 'S'}
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-emerald-950 tracking-wide uppercase leading-tight">
                  {settings.schoolName}
                </h1>
                <p className="text-[11px] text-slate-600 mt-0.5">{settings.address}</p>
                <p className="text-[10px] text-slate-500">
                  Tel: {settings.phone} • Email: {settings.email}
                </p>
              </div>
            </div>

            <div className="text-center sm:text-right shrink-0">
              <div className="inline-block px-3 py-1 bg-emerald-900 text-white text-[11px] font-black uppercase tracking-wider rounded-sm">
                Official Payment Receipt
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                Issued: {formatDate(payment.paymentDate || new Date())}
              </p>
            </div>
          </div>

          {/* Receipt Header Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Receipt Number</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{receiptNo}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Payment Date</span>
              <span className="font-bold text-slate-900">{formatDate(payment.paymentDate)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Session & Term</span>
              <span className="font-bold text-slate-900">
                {payment.term || settings.currentTerm}, {payment.academicSession || settings.currentAcademicSession}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Status</span>
              <span className={`inline-block font-black text-[10px] uppercase px-2 py-0.5 rounded border ${
                isFullyPaid ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {isFullyPaid ? 'Fully Cleared' : 'Part Payment'}
              </span>
            </div>
          </div>

          {/* Student & Payer Info Box */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-3 text-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Received From Pupil:</span>
              <span className="font-bold text-slate-900 text-sm block">
                {student.firstName} {student.middleName ? student.middleName + ' ' : ''}{student.lastName}
              </span>
              <div className="flex items-center gap-3 text-slate-600 mt-0.5">
                <span>Admission No: <strong className="text-slate-900 font-mono">{student.admissionNumber}</strong></span>
                <span>Class: <strong className="text-slate-900">{schoolClass?.name || 'Class'}</strong></span>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Parent / Guardian:</span>
              <span className="font-bold text-slate-900 block">
                {parent ? `${parent.firstName} ${parent.lastName}` : student.emergencyContactName || 'Parent / Sponsor'}
              </span>
              <span className="text-slate-600 text-[11px] block mt-0.5">
                Contact: {parent?.phone || student.emergencyContactPhone || 'On file'}
              </span>
            </div>
          </div>

          {/* Payment Itemized Breakdown */}
          <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-emerald-900 text-white font-bold">
                <tr>
                  <th className="px-4 py-2.5">Item Description</th>
                  <th className="px-3 py-2.5">Payment Method</th>
                  <th className="px-3 py-2.5">Transaction Ref</th>
                  <th className="px-4 py-2.5 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div>
                      <span className="font-bold text-slate-900">School Terminal Fee Payment</span>
                      <p className="text-[11px] text-slate-500">
                        Tuition, ICT levy, educational development, and continuous assessment
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-700">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                      {payment.paymentMethod ? payment.paymentMethod.replace('_', ' ') : 'BANK TRANSFER'}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-600 text-[11px]">
                    {payment.reference || 'REF-DIRECT'}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-emerald-900 text-base">
                    {formatNaira(payment.amount)}
                  </td>
                </tr>
              </tbody>
              {totalTariff !== undefined && totalTariff > 0 && (
                <tfoot className="bg-slate-50 text-[11px] border-t border-slate-200 font-medium">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-slate-600 text-right">
                      Total Assessed Term Fee:
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-slate-900">
                      {formatNaira(totalTariff)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Amount in words */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-xs">
            <span className="text-emerald-900 font-bold uppercase text-[10px] block">Amount Received in Words:</span>
            <p className="font-semibold text-slate-800 italic mt-0.5">
              {numberToWordsNaira(payment.amount)}
            </p>
          </div>

          {/* Balance & Bursary Signoff */}
          <div className="grid grid-cols-1 sm:grid-cols-2 items-end pt-1 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Outstanding Balance Remaining:</span>
              <p className={`font-black text-base ${isFullyPaid ? 'text-emerald-700' : 'text-rose-600'}`}>
                {isFullyPaid ? '₦0.00 (Fully Cleared ✓)' : formatNaira(balanceRemaining)}
              </p>
              {payment.notes && (
                <p className="text-[11px] text-slate-500 italic mt-0.5">Note: {payment.notes}</p>
              )}
              <p className="text-[10px] text-slate-400 mt-2">
                * Note: School fees once paid are non-refundable and non-transferable.
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="inline-block p-2 border-2 border-dashed border-emerald-700 rounded-lg bg-emerald-50/50 text-center mb-1">
                <span className="text-[9px] font-black uppercase text-emerald-900 tracking-wider block">
                  BURSAR CASH OFFICE
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-800 block">
                  PAID & VERIFIED
                </span>
                <span className="text-[9px] text-emerald-700 block">
                  {formatDate(payment.paymentDate)}
                </span>
              </div>
              <div className="border-b border-slate-400 w-36 ml-auto"></div>
              <p className="font-bold text-slate-900 text-xs">Authorized School Bursar</p>
              <p className="text-slate-400 text-[10px]">Staff ID: {payment.recordedBy || 'Accounts'}</p>
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
              Download Receipt
            </Button>
            <Button 
              variant="primary" 
              onClick={handlePrint} 
              leftIcon={<Printer className="w-4 h-4" />}
              className="flex-1 sm:flex-none"
            >
              Print Official Receipt
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
