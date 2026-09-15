import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, setDoc, query, where, orderBy, serverTimestamp, limit 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { 
  FeeStructure, Payment, Student, SchoolClass, Parent, PaymentMethod, Term 
} from '../../types';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { PaymentStatusBadge } from '../../components/common/Badge';
import { ReceiptModal } from '../../components/fees/ReceiptModal';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { 
  formatNaira, formatDate, formatTime, generateReceiptNumber, logAudit 
} from '../../utils/formatters';
import { 
  Receipt, Plus, Search, Printer, Copy, Check, AlertCircle, 
  CreditCard, Send, Layers, UserCheck 
} from 'lucide-react';

export const FeesPage: React.FC = () => {
  const { role, currentUser } = useAuth();
  const { settings } = useSchool();

  const [activeTab, setActiveTab] = useState<'payments' | 'structures' | 'statements' | 'debtors'>('payments');

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);

  // Record Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payStudentId, setPayStudentId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Receipt Modal
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);
  const [receiptStudent, setReceiptStudent] = useState<Student | null>(null);

  // Add Fee Structure Modal
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [structClassId, setStructClassId] = useState('');
  const [structName, setStructName] = useState('');
  const [structAmount, setStructAmount] = useState('');
  const [structTerm, setStructTerm] = useState<Term>(settings.currentTerm);
  const [isSavingStructure, setIsSavingStructure] = useState(false);

  // Search & Filter
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [copiedSmsStudentId, setCopiedSmsStudentId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const cSnap = await getDocs(collection(db, 'classes'));
      const cList: SchoolClass[] = [];
      cSnap.forEach((d) => cList.push(d.data() as SchoolClass));
      setClasses(cList);
      if (cList.length > 0 && !structClassId) setStructClassId(cList[0].classId);

      const sSnap = await getDocs(collection(db, 'students'));
      const sList: Student[] = [];
      sSnap.forEach((d) => sList.push(d.data() as Student));
      setStudents(sList);
      if (sList.length > 0 && !payStudentId) setPayStudentId(sList[0].studentId);

      const pSnap = await getDocs(collection(db, 'parents'));
      const pList: Parent[] = [];
      pSnap.forEach((d) => pList.push(d.data() as Parent));
      setParents(pList);

      const paySnap = await getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(100)));
      const payList: Payment[] = [];
      paySnap.forEach((d) => payList.push(d.data() as Payment));
      payList.sort((a, b) => (b.paymentDate > a.paymentDate ? 1 : -1));
      setPayments(payList);

      const structSnap = await getDocs(collection(db, 'feeStructures'));
      const stList: FeeStructure[] = [];
      structSnap.forEach((d) => stList.push(d.data() as FeeStructure));
      setStructures(stList);
    } catch (err) {
      console.error('Error fetching fees data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const studentsMap = new Map<string, Student>(students.map((s) => [s.studentId, s]));
  const classesMap = new Map<string, SchoolClass>(classes.map((c) => [c.classId, c]));
  const parentsMap = new Map<string, Parent>(parents.map((p) => [p.parentId, p]));

  // Calculate expected fee for a student based on their class
  const getStudentExpectedFee = (student: Student) => {
    return structures
      .filter((s) => s.classId === student.classId && s.term === settings.currentTerm)
      .reduce((sum, item) => sum + item.amount, 0);
  };

  // Calculate total paid by student for current term
  const getStudentTotalPaid = (studentId: string) => {
    return payments
      .filter(
        (p) =>
          p.studentId === studentId &&
          p.academicSession === settings.currentAcademicSession &&
          p.term === settings.currentTerm
      )
      .reduce((sum, item) => sum + item.amount, 0);
  };

  // Handle Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPayment) return;

    const amountNum = parseFloat(payAmount);
    if (!payStudentId || isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Please enter a valid amount.');
      return;
    }

    const trimmedRef = payRef.trim();

    // 1. Duplicate Reference Check
    if (trimmedRef) {
      const isDuplicateRef = payments.some(
        (p) => p.reference && p.reference.toLowerCase() === trimmedRef.toLowerCase()
      );
      if (isDuplicateRef) {
        setPaymentError(`Duplicate Transaction: A payment with reference "${trimmedRef}" has already been logged.`);
        return;
      }
    }

    // 2. Rapid Duplicate Click Check (same student, same amount, same date)
    const recentDuplicate = payments.find(
      (p) =>
        p.studentId === payStudentId &&
        p.amount === amountNum &&
        p.paymentDate === payDate &&
        p.term === settings.currentTerm
    );
    if (recentDuplicate) {
      const isRecent = recentDuplicate.createdAt && (Date.now() - new Date(recentDuplicate.createdAt.seconds ? recentDuplicate.createdAt.seconds * 1000 : recentDuplicate.createdAt).getTime() < 120000);
      if (isRecent) {
        setPaymentError(`Duplicate Warning: An identical payment of ₦${amountNum.toLocaleString()} for this pupil was just recorded a moment ago (Receipt: ${recentDuplicate.receiptNumber}). If this is a distinct payment, please provide a unique transaction reference or note.`);
        return;
      }
    }

    setIsSubmittingPayment(true);
    setPaymentError('');
    try {
      const selectedStudent = studentsMap.get(payStudentId);
      if (!selectedStudent) throw new Error('Student not found');

      const receiptNumber = generateReceiptNumber();
      const paymentId = `pay-${Date.now()}`;

      const payload: any = {
        paymentId,
        receiptNumber,
        studentId: payStudentId,
        classId: selectedStudent.classId,
        amount: amountNum,
        paymentMethod: payMethod,
        paymentDate: payDate,
        academicSession: settings.currentAcademicSession,
        term: settings.currentTerm,
        recordedBy: currentUser?.displayName || currentUser?.email || 'Bursar',
        reference: trimmedRef || undefined,
        notes: payNotes.trim() || undefined,
      };

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      const newPayment: Payment = {
        ...payload,
        createdAt: new Date(),
      };

      await setDoc(doc(db, 'payments', paymentId), {
        ...payload,
        createdAt: serverTimestamp(),
      });

      await logAudit(
        currentUser?.uid || 'admin',
        'FEE_PAYMENT_RECORDED',
        'payments',
        paymentId,
        `Recorded ₦${amountNum.toLocaleString()} payment for ${selectedStudent.firstName} ${selectedStudent.lastName} (${receiptNumber})`
      );

      // Open receipt immediately
      setReceiptStudent(selectedStudent);
      setViewingReceipt(newPayment);

      setShowPaymentModal(false);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      await fetchData();
    } catch (err: any) {
      console.error('Error recording payment:', err);
      setPaymentError(err.message || 'Failed to save payment record.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handle Create Fee Structure
  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(structAmount);
    if (!structClassId || !structName.trim() || isNaN(amt) || amt <= 0) {
      alert('Please fill all structure fields with a positive amount.');
      return;
    }

    setIsSavingStructure(true);
    try {
      const structId = `fee-${structClassId}-${structName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      const payload: FeeStructure = {
        feeStructureId: structId,
        classId: structClassId,
        academicSession: settings.currentAcademicSession,
        term: structTerm,
        name: structName.trim(),
        feeType: structName.trim(),
        amount: amt,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'feeStructures', structId), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setShowStructureModal(false);
      setStructName('');
      setStructAmount('');
      await fetchData();
    } catch (err) {
      console.error('Error saving structure:', err);
    } finally {
      setIsSavingStructure(false);
    }
  };

  // Copy SMS Debt reminder template
  const copySmsReminder = (student: Student, balance: number) => {
    const p = student.parentIds?.[0] ? parentsMap.get(student.parentIds[0]) : null;
    const parentName = p ? `${p.relationship || 'Parent'} ${p.lastName}` : 'Parent';
    const message = `Dear ${parentName}, this is a gentle reminder that ${student.firstName} ${student.lastName} has an outstanding fee balance of ${formatNaira(balance)} for ${settings.currentTerm} (${settings.currentAcademicSession}). Kindly make payment soon to avoid disruptions. Thank you. — ${settings.schoolName}`;

    navigator.clipboard.writeText(message);
    setCopiedSmsStudentId(student.studentId);
    setTimeout(() => setCopiedSmsStudentId(null), 3000);
  };

  // Total collected calculation
  const totalRevenue = payments
    .filter((p) => p.academicSession === settings.currentAcademicSession)
    .reduce((sum, p) => sum + p.amount, 0);

  if (role !== 'ADMIN') {
    return (
      <div className="p-8 text-center max-w-md mx-auto bg-white rounded-2xl border border-slate-200 mt-12 shadow-sm">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Bursary Access Restricted</h3>
        <p className="text-xs text-slate-500 mt-1">School fee collection and financial ledgers are restricted to authorized administrators and bursars.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            School Fees & Bursary
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {settings.currentAcademicSession} • {settings.currentTerm} • Total Collected:{' '}
            <strong className="text-emerald-700 font-bold">{formatNaira(totalRevenue)}</strong>
          </p>
        </div>

        {role === 'ADMIN' && (
          <div className="flex items-center gap-2">
            <Button
              id="record-payment-btn"
              variant="primary"
              onClick={() => {
                setShowPaymentModal(true);
                setPaymentError('');
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Record Payment
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto bg-white rounded-t-xl px-3">
        {[
          { id: 'payments', label: 'Payment Receipts' },
          { id: 'structures', label: 'Fee Structures' },
          { id: 'statements', label: 'Pupil Fee Statements' },
          { id: 'debtors', label: 'Debtors List (SMS Alerts)' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
              activeTab === t.id
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PAYMENTS & RECEIPTS */}
      {activeTab === 'payments' && (
        <Card>
          <CardHeader
            title="Recent Fee Payments"
            subtitle={`${payments.length} transactions recorded`}
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print Ledger
              </Button>
            }
          />
          <CardBody className="p-0">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading payment ledger...</div>
            ) : payments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No fee payments recorded yet. Click "Record Payment" above to log a transaction.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
                    <tr>
                      <th className="px-5 py-3">Receipt No</th>
                      <th className="px-5 py-3">Student Name</th>
                      <th className="px-5 py-3">Class</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Method</th>
                      <th className="px-5 py-3 text-right">Amount (₦)</th>
                      <th className="px-5 py-3 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((payment) => {
                      const student = studentsMap.get(payment.studentId);
                      const cls = classesMap.get(payment.classId);

                      return (
                        <tr key={payment.paymentId} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 font-mono font-bold text-slate-800">
                            {payment.receiptNumber}
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-900">
                            {student ? `${student.firstName} ${student.lastName}` : 'Pupil'}
                            <span className="block text-[11px] text-slate-400 font-mono font-normal">
                              {student?.admissionNumber}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-700">{cls?.name || 'Class'}</td>
                          <td className="px-5 py-3 text-slate-600">{formatDate(payment.paymentDate)}</td>
                          <td className="px-5 py-3 font-medium text-slate-700">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                              {payment.paymentMethod}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-emerald-800 text-base">
                            {formatNaira(payment.amount)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setReceiptStudent(student || null);
                                setViewingReceipt(payment);
                              }}
                              leftIcon={<Receipt className="w-3.5 h-3.5" />}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* TAB 2: FEE STRUCTURES */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Class Fee Tariffs & Levies
              </h3>
              <p className="text-xs text-slate-500">
                Define required tuition, developmental levies, and examination dues per classroom grade
              </p>
            </div>
            {role === 'ADMIN' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowStructureModal(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Fee Item
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => {
              const classItems = structures.filter((s) => s.classId === cls.classId);
              const totalClassFee = classItems.reduce((sum, item) => sum + item.amount, 0);

              return (
                <Card key={cls.classId}>
                  <CardHeader
                    title={cls.name}
                    subtitle={`Total: ${formatNaira(totalClassFee)} per pupil`}
                  />
                  <CardBody className="p-0">
                    {classItems.length === 0 ? (
                      <p className="p-5 text-xs text-slate-400 italic">No fee items defined yet.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {classItems.map((item) => (
                          <div key={item.feeStructureId} className="px-5 py-3 flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-800">{item.name}</span>
                            <span className="font-bold text-slate-900">{formatNaira(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: STATEMENTS */}
      {activeTab === 'statements' && (
        <Card>
          <CardHeader
            title="Individual Pupil Fee Statements"
            subtitle="Look up account balance, payments ledger, and print terminal clearing statements"
          />
          <CardBody className="p-5 space-y-4">
            <div className="max-w-md">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Pupil to View Statement
              </label>
              <select
                id="statement-student-select"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600"
              >
                <option value="">— Select Pupil —</option>
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.firstName} {s.lastName} ({s.admissionNumber}) • {classesMap.get(s.classId)?.name}
                  </option>
                ))}
              </select>
            </div>

            {searchStudent && (() => {
              const student = studentsMap.get(searchStudent);
              if (!student) return null;
              const expected = getStudentExpectedFee(student);
              const studentPayments = payments.filter((p) => p.studentId === student.studentId);
              const paid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
              const balance = Math.max(0, expected - paid);
              const status = paid >= expected && expected > 0 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

              return (
                <div className="mt-4 p-5 bg-white border border-slate-200 rounded-xl space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">
                        {student.firstName} {student.lastName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Admission: {student.admissionNumber} • Class: {classesMap.get(student.classId)?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PaymentStatusBadge status={status} />
                      <Button size="sm" variant="outline" onClick={() => window.print()} leftIcon={<Printer className="w-4 h-4" />}>
                        Print Statement
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block uppercase font-bold text-[10px]">Expected Tariff</span>
                      <span className="text-sm sm:text-base font-bold text-slate-900">{formatNaira(expected)}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="text-emerald-700 block uppercase font-bold text-[10px]">Total Paid</span>
                      <span className="text-sm sm:text-base font-bold text-emerald-800">{formatNaira(paid)}</span>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                      <span className="text-rose-700 block uppercase font-bold text-[10px]">Balance Due</span>
                      <span className="text-sm sm:text-base font-bold text-rose-700">{formatNaira(balance)}</span>
                    </div>
                  </div>

                  <h5 className="font-bold text-slate-800 text-xs uppercase pt-2">Payments Received</h5>
                  <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                        <tr>
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Receipt No</th>
                          <th className="px-4 py-2">Method</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentPayments.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                              No payments made yet.
                            </td>
                          </tr>
                        ) : (
                          studentPayments.map((p) => (
                            <tr key={p.paymentId}>
                              <td className="px-4 py-2 text-slate-700">{formatDate(p.paymentDate)}</td>
                              <td className="px-4 py-2 font-mono font-bold text-slate-800">{p.receiptNumber}</td>
                              <td className="px-4 py-2 text-slate-600">{p.paymentMethod}</td>
                              <td className="px-4 py-2 text-right font-bold text-emerald-800">{formatNaira(p.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </CardBody>
        </Card>
      )}

      {/* TAB 4: DEBTORS LIST */}
      {activeTab === 'debtors' && (
        <Card>
          <CardHeader
            title="Debtors Directory & Fee Defaulters"
            subtitle="Pupils with outstanding fees • Click SMS to copy reminder text"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print Debtors List
              </Button>
            }
          />
          <CardBody className="p-0">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700">Filter by Class:</label>
              <select
                id="debtor-class-filter"
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              >
                <option value="ALL">All Classes</option>
                {classes.map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
                  <tr>
                    <th className="px-5 py-3">Student Name</th>
                    <th className="px-5 py-3">Class</th>
                    <th className="px-5 py-3 text-right">Expected</th>
                    <th className="px-5 py-3 text-right">Paid</th>
                    <th className="px-5 py-3 text-right">Balance Due</th>
                    <th className="px-5 py-3">Parent Phone</th>
                    <th className="px-5 py-3 text-right">SMS Reminder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students
                    .filter((s) => s.status === 'ACTIVE')
                    .filter((s) => selectedClassFilter === 'ALL' || s.classId === selectedClassFilter)
                    .map((student) => {
                      const expected = getStudentExpectedFee(student);
                      const paid = getStudentTotalPaid(student.studentId);
                      const balance = Math.max(0, expected - paid);
                      if (balance <= 0) return null; // Not a debtor

                      const p = student.parentIds?.[0] ? parentsMap.get(student.parentIds[0]) : null;
                      const parentPhone = p?.phone || student.emergencyContactPhone || 'No Phone';
                      const isCopied = copiedSmsStudentId === student.studentId;

                      return (
                        <tr key={student.studentId} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-semibold text-slate-900">
                            {student.firstName} {student.lastName}
                            <span className="block text-[11px] text-slate-400 font-normal">
                              {student.admissionNumber}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-700">
                            {classesMap.get(student.classId)?.name || 'Class'}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-slate-700">
                            {formatNaira(expected)}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                            {formatNaira(paid)}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-rose-600 text-sm">
                            {formatNaira(balance)}
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-600">
                            {parentPhone}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button
                              size="sm"
                              variant={isCopied ? 'primary' : 'outline'}
                              onClick={() => copySmsReminder(student, balance)}
                              leftIcon={isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            >
                              {isCopied ? 'Copied!' : 'Copy SMS'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Fee Payment"
        subtitle="Log student tuition / dues and generate an official receipt"
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {paymentError && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {paymentError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Pupil *
            </label>
            <select
              id="pay-student-select"
              value={payStudentId}
              onChange={(e) => setPayStudentId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600"
            >
              {students
                .filter((s) => s.status === 'ACTIVE')
                .map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.firstName} {s.lastName} ({s.admissionNumber}) • {classesMap.get(s.classId)?.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="pay-amount-input"
              type="number"
              label="Amount Paid (₦) *"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              required
              placeholder="e.g. 50000"
            />
            <Select
              id="pay-method-select"
              label="Payment Channel *"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              options={[
                { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                { value: 'POS', label: 'POS Terminal' },
                { value: 'CASH', label: 'Cash Payment' },
                { value: 'ONLINE', label: 'Online / Card' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="pay-date-input"
              type="date"
              label="Payment Date *"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              required
            />
            <Input
              id="pay-ref-input"
              label="Bank / POS Reference"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="e.g. GTB-TRF-982123"
            />
          </div>

          <Input
            id="pay-notes-input"
            label="Additional Notes / Remarks"
            value={payNotes}
            onChange={(e) => setPayNotes(e.target.value)}
            placeholder="e.g. 1st installment for 1st term"
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setShowPaymentModal(false)} disabled={isSubmittingPayment}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingPayment}>
              Confirm & Generate Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADD FEE STRUCTURE ITEM MODAL */}
      <Modal
        isOpen={showStructureModal}
        onClose={() => setShowStructureModal(false)}
        title="Add Fee Structure Item"
        subtitle="Set standard term fees per classroom grade"
        maxWidth="md"
      >
        <form onSubmit={handleSaveStructure} className="space-y-4">
          <Select
            id="struct-class-select"
            label="Class Grade *"
            value={structClassId}
            onChange={(e) => setStructClassId(e.target.value)}
            options={classes.map((c) => ({ value: c.classId, label: c.name }))}
            required
          />

          <Input
            id="struct-name-input"
            label="Fee Item Name *"
            value={structName}
            onChange={(e) => setStructName(e.target.value)}
            required
            placeholder="e.g. Tuition Fee, Development Levy, ICT Fee"
          />

          <Input
            id="struct-amount-input"
            type="number"
            label="Amount (₦) *"
            value={structAmount}
            onChange={(e) => setStructAmount(e.target.value)}
            required
            placeholder="e.g. 85000"
          />

          <Select
            id="struct-term-select"
            label="Term Applicable"
            value={structTerm}
            onChange={(e) => setStructTerm(e.target.value as Term)}
            options={[
              { value: '1st Term', label: '1st Term' },
              { value: '2nd Term', label: '2nd Term' },
              { value: '3rd Term', label: '3rd Term' },
            ]}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setShowStructureModal(false)} disabled={isSavingStructure}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSavingStructure}>
              Save Fee Tariff
            </Button>
          </div>
        </form>
      </Modal>

      {/* OFFICIAL RECEIPT VIEW MODAL */}
      <ReceiptModal
        isOpen={!!viewingReceipt}
        onClose={() => {
          setViewingReceipt(null);
          setReceiptStudent(null);
        }}
        payment={viewingReceipt}
        student={receiptStudent}
        schoolClass={receiptStudent ? classesMap.get(receiptStudent.classId) : null}
        balanceRemaining={
          receiptStudent
            ? Math.max(0, getStudentExpectedFee(receiptStudent) - getStudentTotalPaid(receiptStudent.studentId))
            : 0
        }
      />
    </div>
  );
};
