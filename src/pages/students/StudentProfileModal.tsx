import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { StudentStatusBadge, AttendanceBadge } from '../../components/common/Badge';
import { Student, Parent, SchoolClass, AttendanceRecord, Result, Payment, Assignment, FeeStructure } from '../../types';
import { formatNaira, formatDate, formatTime } from '../../utils/formatters';
import { useSchool } from '../../contexts/SchoolContext';
import { Printer, User, Phone, MapPin, Calendar, Heart, ShieldAlert, FileText, Download } from 'lucide-react';
import { StudentProfileDocumentModal } from '../../components/students/StudentProfileDocumentModal';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onEdit?: (student: Student) => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  onEdit,
}) => {
  const { settings } = useSchool();
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'results' | 'assignments' | 'fees'>('overview');
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  const [parent, setParent] = useState<Parent | null>(null);
  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(null);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [resultsList, setResultsList] = useState<Result[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [expectedFee, setExpectedFee] = useState<number>(0);
  const [assignmentsList, setAssignmentsList] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!student || !isOpen) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        // 1. Fetch Class
        if (student.classId) {
          const cDoc = await getDoc(doc(db, 'classes', student.classId));
          if (cDoc.exists()) setSchoolClass(cDoc.data() as SchoolClass);
        }

        // 2. Fetch Parent
        const pId = student.parentIds?.[0];
        if (pId) {
          const pDoc = await getDoc(doc(db, 'parents', pId));
          if (pDoc.exists()) setParent(pDoc.data() as Parent);
        }

        // 3. Attendance
        const attSnap = await getDocs(
          query(collection(db, 'attendance'), where('studentId', '==', student.studentId))
        );
        const atts: AttendanceRecord[] = [];
        attSnap.forEach((d) => atts.push(d.data() as AttendanceRecord));
        atts.sort((a, b) => (b.date > a.date ? 1 : -1));
        setAttendanceList(atts);

        // 4. Results
        const resSnap = await getDocs(
          query(collection(db, 'results'), where('studentId', '==', student.studentId))
        );
        const res: Result[] = [];
        resSnap.forEach((d) => res.push(d.data() as Result));
        setResultsList(res);

        // 5. Fees and Payments
        const paySnap = await getDocs(
          query(collection(db, 'payments'), where('studentId', '==', student.studentId))
        );
        const pays: Payment[] = [];
        paySnap.forEach((d) => pays.push(d.data() as Payment));
        pays.sort((a, b) => (b.paymentDate > a.paymentDate ? 1 : -1));
        setPaymentsList(pays);

        if (student.classId) {
          const feeSnap = await getDocs(
            query(collection(db, 'feeStructures'), where('classId', '==', student.classId))
          );
          let totalExpected = 0;
          feeSnap.forEach((d) => {
            totalExpected += (d.data() as FeeStructure).amount || 0;
          });
          setExpectedFee(totalExpected);
        }

        // 6. Assignments
        if (student.classId) {
          const aSnap = await getDocs(
            query(collection(db, 'assignments'), where('classId', '==', student.classId))
          );
          const assigns: Assignment[] = [];
          aSnap.forEach((d) => assigns.push(d.data() as Assignment));
          setAssignmentsList(assigns);
        }

      } catch (err) {
        console.error('Error loading student profile tabs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [student, isOpen]);

  if (!student) return null;

  const totalPaid = paymentsList.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const outstandingBalance = Math.max(0, expectedFee - totalPaid);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`}
      subtitle={`Admission No: ${student.admissionNumber} • Class: ${schoolClass?.name || 'Class'}`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Profile Card Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xl shrink-0">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="Photo" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                student.firstName.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {student.firstName} {student.middleName || ''} {student.lastName}
                </h3>
                <StudentStatusBadge status={student.status} />
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Class: <span className="font-semibold text-slate-800">{schoolClass?.name || 'Assigned'}</span> • Gender: {student.gender}
              </p>
              <p className="text-xs text-slate-500">
                Date of Birth: {formatDate(student.dateOfBirth)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDocumentModal(true)}
              leftIcon={<FileText className="w-4 h-4 text-emerald-800" />}
            >
              Official Dossier (Print / Download)
            </Button>
            {onEdit && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose();
                  onEdit(student);
                }}
              >
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {(['overview', 'attendance', 'results', 'assignments', 'fees'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Biographical Details */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Academic & Bio Details
                </h4>
                <div className="grid grid-cols-2 gap-1 text-slate-600">
                  <span className="text-slate-400">Admission No:</span>
                  <span className="font-semibold text-slate-900">{student.admissionNumber}</span>
                  <span className="text-slate-400">Class:</span>
                  <span className="font-semibold text-slate-900">{schoolClass?.name || 'Class'}</span>
                  <span className="text-slate-400">Admission Date:</span>
                  <span>{formatDate(student.admissionDate)}</span>
                  <span className="text-slate-400">Gender:</span>
                  <span>{student.gender}</span>
                  <span className="text-slate-400">DOB:</span>
                  <span>{formatDate(student.dateOfBirth)}</span>
                </div>
              </div>

              {/* Parent Details */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Parent / Guardian Information
                </h4>
                {parent ? (
                  <div className="space-y-1.5 text-slate-700">
                    <p className="font-bold text-slate-900">{parent.firstName} {parent.lastName}</p>
                    <p className="flex items-center gap-1.5 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {parent.phone}
                    </p>
                    <p className="text-slate-500">{parent.email}</p>
                    <p className="text-slate-500">Relationship: {parent.relationship || 'Guardian'}</p>
                    {parent.address && (
                      <p className="flex items-center gap-1 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {parent.address}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No parent linked to this student yet.</p>
                )}
              </div>
            </div>

            {/* Emergency Contact & Medical */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1">
                Emergency & Health Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block">Emergency Contact:</span>
                  <span className="font-medium text-slate-800">
                    {student.emergencyContactName || 'None listed'} ({student.emergencyContactPhone || 'No phone'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Residential Address:</span>
                  <span className="text-slate-700">{student.address || 'None listed'}</span>
                </div>
              </div>
              {student.notes && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block font-medium">Notes:</span>
                  <p className="text-slate-700 mt-0.5">{student.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs text-slate-600 px-1">
              <span>Total days recorded: <strong>{attendanceList.length}</strong></span>
              <span>
                Present: <strong className="text-emerald-700">{attendanceList.filter((a) => a.status === 'PRESENT').length}</strong> • 
                Absent: <strong className="text-rose-600">{attendanceList.filter((a) => a.status === 'ABSENT').length}</strong> • 
                Late: <strong className="text-amber-700">{attendanceList.filter((a) => a.status === 'LATE').length}</strong>
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Time In</th>
                    <th className="px-4 py-2.5">Time Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                        No attendance recorded yet.
                      </td>
                    </tr>
                  ) : (
                    attendanceList.map((a) => (
                      <tr key={a.attendanceId}>
                        <td className="px-4 py-2 font-medium text-slate-900">{formatDate(a.date)}</td>
                        <td className="px-4 py-2">
                          <AttendanceBadge status={a.status} />
                        </td>
                        <td className="px-4 py-2 text-slate-600">{a.timeIn ? formatTime(a.timeIn) : '—'}</td>
                        <td className="px-4 py-2 text-slate-600">{a.timeOut ? formatTime(a.timeOut) : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: RESULTS */}
        {activeTab === 'results' && (
          <div className="space-y-3 py-2">
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Subject</th>
                    <th className="px-4 py-2.5 text-center">CA</th>
                    <th className="px-4 py-2.5 text-center">Exam</th>
                    <th className="px-4 py-2.5 text-center">Total</th>
                    <th className="px-4 py-2.5 text-center">Grade</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                        No scores recorded for this pupil yet.
                      </td>
                    </tr>
                  ) : (
                    resultsList.map((r) => (
                      <tr key={r.resultId}>
                        <td className="px-4 py-2 font-semibold text-slate-900 capitalize">
                          {r.subjectId.replace('sub-', '')}
                        </td>
                        <td className="px-4 py-2 text-center text-slate-600">{r.caScore}</td>
                        <td className="px-4 py-2 text-center text-slate-600">{r.examScore}</td>
                        <td className="px-4 py-2 text-center font-bold text-slate-900">{r.totalScore}</td>
                        <td className="px-4 py-2 text-center font-bold text-emerald-800">{r.grade}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ASSIGNMENTS */}
        {activeTab === 'assignments' && (
          <div className="space-y-2 py-2">
            {assignmentsList.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-400">
                No assignments posted for {schoolClass?.name || 'this class'}.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
                {assignmentsList.map((a) => (
                  <div key={a.assignmentId} className="p-3 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span>{a.title}</span>
                      <span className="text-slate-500 font-normal">Due: {formatDate(a.dueDate)}</span>
                    </div>
                    <p className="text-slate-600 mt-1">{a.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: FEES */}
        {activeTab === 'fees' && (
          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Expected</span>
                <span className="text-sm font-bold text-slate-900">{formatNaira(expectedFee)}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-emerald-700 block text-[10px] uppercase font-bold">Total Paid</span>
                <span className="text-sm font-bold text-emerald-800">{formatNaira(totalPaid)}</span>
              </div>
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                <span className="text-rose-700 block text-[10px] uppercase font-bold">Balance Due</span>
                <span className="text-sm font-bold text-rose-700">{formatNaira(outstandingBalance)}</span>
              </div>
            </div>

            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] pt-2">
              Payment Receipts History
            </h4>
            <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Ref</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentsList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    paymentsList.map((p) => (
                      <tr key={p.paymentId}>
                        <td className="px-3 py-2 text-slate-800">{formatDate(p.paymentDate)}</td>
                        <td className="px-3 py-2 text-slate-600">{p.paymentMethod}</td>
                        <td className="px-3 py-2 text-slate-500">{p.reference || '—'}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-800">{formatNaira(p.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Official Pupil Dossier Document Modal */}
      <StudentProfileDocumentModal
        isOpen={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        student={student}
        schoolClass={schoolClass}
        parent={parent}
        results={resultsList}
        payments={paymentsList}
        attendance={attendanceList}
        expectedFee={expectedFee}
      />
    </Modal>
  );
};
