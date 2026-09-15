import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Payment, Student, SchoolClass } from '../../types';
import { useSchool } from '../../contexts/SchoolContext';
import { formatNaira, formatDate, numberToWordsNaira } from '../../utils/formatters';
import { Printer, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  student: Student | null;
  schoolClass?: SchoolClass | null;
  balanceRemaining?: number;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  student,
  schoolClass,
  balanceRemaining = 0,
}) => {
  const { settings } = useSchool();

  if (!payment || !student) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official School Fee Receipt"
      subtitle={`Receipt No: ${payment.receiptNumber}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Printable Receipt Paper */}
        <div 
          id="official-receipt-print-area" 
          className="bg-white border-2 border-slate-300 rounded-xl p-6 sm:p-8 space-y-6 text-slate-800 shadow-xs"
        >
          {/* Header */}
          <div className="text-center border-b-2 border-emerald-900 pb-4">
            <h1 className="text-xl sm:text-2xl font-black text-emerald-900 tracking-wide uppercase">
              {settings.schoolName}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">{settings.address}</p>
            <p className="text-xs text-slate-500">
              Tel: {settings.phone} • Email: {settings.email}
            </p>
            <div className="inline-block mt-3 px-4 py-1 bg-emerald-900 text-white text-xs font-bold uppercase tracking-wider rounded-sm">
              Official Payment Receipt
            </div>
          </div>

          {/* Meta Info */}
          <div className="grid grid-cols-2 text-xs gap-3">
            <div>
              <p className="text-slate-500">Receipt Number:</p>
              <p className="font-mono font-bold text-slate-900 text-sm">{payment.receiptNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Date of Payment:</p>
              <p className="font-bold text-slate-900">{formatDate(payment.paymentDate)}</p>
            </div>
          </div>

          {/* Student Info Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500 block">Received From Pupil:</span>
              <span className="font-bold text-slate-900 text-sm">
                {student.firstName} {student.middleName || ''} {student.lastName}
              </span>
              <span className="text-slate-500 block">
                Admission No: <strong className="text-slate-800">{student.admissionNumber}</strong>
              </span>
            </div>
            <div className="sm:text-right">
              <span className="text-slate-500 block">Class & Term:</span>
              <span className="font-bold text-slate-900">
                {schoolClass?.name || 'Class'}
              </span>
              <span className="text-slate-500 block">
                {payment.term} • {payment.academicSession}
              </span>
            </div>
          </div>

          {/* Amount breakdown */}
          <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-emerald-900 text-white font-bold">
                <tr>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Payment Method</th>
                  <th className="px-4 py-2 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    School Fees Payment {payment.reference ? `(Ref: ${payment.reference})` : ''}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{payment.paymentMethod}</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-800 text-base">
                    {formatNaira(payment.amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount in words */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-xs">
            <span className="text-emerald-900 font-bold uppercase text-[10px] block">Amount in Words:</span>
            <p className="font-semibold text-slate-800 italic mt-0.5">
              {numberToWordsNaira(payment.amount)}
            </p>
          </div>

          {/* Balance & Signoff */}
          <div className="grid grid-cols-2 items-end pt-2 text-xs">
            <div>
              <p className="text-slate-500">Outstanding Balance Remaining:</p>
              <p className={`font-bold text-sm ${balanceRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {balanceRemaining > 0 ? formatNaira(balanceRemaining) : '₦0 (Fully Paid ✓)'}
              </p>
              {payment.notes && (
                <p className="text-[11px] text-slate-400 mt-1 italic">Note: {payment.notes}</p>
              )}
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block border-b border-slate-400 w-36 mb-1"></div>
              <p className="font-bold text-slate-900">Authorized Bursar</p>
              <p className="text-slate-400 text-[10px]">Received by: {payment.receivedBy}</p>
            </div>
          </div>
        </div>

        {/* Modal footer controls */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handlePrint} leftIcon={<Printer className="w-4 h-4" />}>
            Print Official Receipt
          </Button>
        </div>
      </div>
    </Modal>
  );
};
