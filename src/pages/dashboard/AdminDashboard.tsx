import React, { useEffect, useState } from 'react';
import { 
  collection, getDocs, query, where, orderBy, limit 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useSchool } from '../../contexts/SchoolContext';
import { 
  Users, UserCheck, UserX, Clock, Wallet, Plus, CalendarCheck2, 
  Receipt, Award, ClipboardList, Megaphone, ArrowRight 
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { AttendanceBadge } from '../../components/common/Badge';
import { formatNaira, formatDate, formatTime, getTodayDateString } from '../../utils/formatters';
import { Student, AttendanceRecord, Payment, Announcement, Assignment } from '../../types';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
  onOpenQuickAction: (action: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigate,
  onOpenQuickAction,
}) => {
  const { settings } = useSchool();
  const [loading, setLoading] = useState(true);

  // Metrics
  const [totalStudents, setTotalStudents] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);
  const [lateToday, setLateToday] = useState(0);
  const [feesOutstanding, setFeesOutstanding] = useState(0);

  // Lists
  const [todayAttendanceList, setTodayAttendanceList] = useState<{ record: AttendanceRecord; studentName: string }[]>([]);
  const [recentPayments, setRecentPayments] = useState<{ payment: Payment; studentName: string }[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<Assignment[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const today = getTodayDateString();
        const studentsMap = new Map<string, Student>();

        // 1. Fetch Students
        try {
          const studentsSnap = await getDocs(query(collection(db, 'students'), where('status', '==', 'ACTIVE')));
          studentsSnap.forEach((doc) => {
            const s = doc.data() as Student;
            studentsMap.set(s.studentId, s);
          });
          setTotalStudents(studentsMap.size);
        } catch (sErr) {
          console.warn('Dashboard students load warning:', sErr);
        }

        // 2. Fetch Today's Attendance
        try {
          const attSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', today)));
          let present = 0;
          let absent = 0;
          let late = 0;
          const attList: { record: AttendanceRecord; studentName: string }[] = [];

          attSnap.forEach((doc) => {
            const a = doc.data() as AttendanceRecord;
            if (a.status === 'PRESENT') present++;
            else if (a.status === 'ABSENT') absent++;
            else if (a.status === 'LATE') late++;

            const student = studentsMap.get(a.studentId);
            attList.push({
              record: a,
              studentName: student ? `${student.firstName} ${student.lastName}` : a.studentId,
            });
          });

          setPresentToday(present);
          setAbsentToday(absent);
          setLateToday(late);
          setTodayAttendanceList(attList.slice(0, 5));
        } catch (attErr) {
          console.warn('Dashboard attendance load warning:', attErr);
        }

        // 3. Calculate Fees Outstanding
        try {
          const feeStructSnap = await getDocs(query(
            collection(db, 'feeStructures'), 
            where('academicSession', '==', settings.currentAcademicSession),
            where('term', '==', settings.currentTerm)
          ));
          
          let expectedTotal = 0;
          feeStructSnap.forEach((fDoc) => {
            const fee = fDoc.data();
            let classCount = 0;
            studentsMap.forEach((s) => {
              if (s.classId === fee.classId) classCount++;
            });
            expectedTotal += (fee.amount || 0) * classCount;
          });

          const paySnap = await getDocs(query(
            collection(db, 'payments'),
            where('academicSession', '==', settings.currentAcademicSession),
            where('term', '==', settings.currentTerm)
          ));

          let paidTotal = 0;
          const payList: { payment: Payment; studentName: string }[] = [];
          paySnap.forEach((pDoc) => {
            const p = pDoc.data() as Payment;
            paidTotal += p.amount || 0;
            const s = studentsMap.get(p.studentId);
            payList.push({
              payment: p,
              studentName: s ? `${s.firstName} ${s.lastName}` : p.studentId,
            });
          });

          const balance = Math.max(0, expectedTotal - paidTotal);
          setFeesOutstanding(balance);

          payList.sort((a, b) => (b.payment.paymentDate > a.payment.paymentDate ? 1 : -1));
          setRecentPayments(payList.slice(0, 5));
        } catch (fErr) {
          console.warn('Dashboard fees load warning:', fErr);
        }

        // 4. Assignments
        try {
          const assignSnap = await getDocs(query(
            collection(db, 'assignments'),
            where('status', '==', 'PUBLISHED'),
            limit(5)
          ));
          const aList: Assignment[] = [];
          assignSnap.forEach((doc) => aList.push(doc.data() as Assignment));
          setUpcomingAssignments(aList);
        } catch (aErr) {
          console.warn('Dashboard assignments load warning:', aErr);
        }

        // 5. Announcements
        try {
          const annSnap = await getDocs(query(collection(db, 'announcements'), limit(4)));
          const annList: Announcement[] = [];
          annSnap.forEach((doc) => annList.push(doc.data() as Announcement));
          setRecentAnnouncements(annList);
        } catch (annErr) {
          console.warn('Dashboard announcements load warning:', annErr);
        }

      } catch (err) {
        console.error('Error loading admin dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [settings]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
            {settings.currentAcademicSession} • {settings.currentTerm}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            School Administrative Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor real-time student attendance, collection of school fees, and daily operations.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1 md:pt-0">
          <Button
            size="sm"
            variant="primary"
            leftIcon={<CalendarCheck2 className="w-4 h-4" />}
            onClick={() => onNavigate('attendance')}
          >
            Take Attendance
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Receipt className="w-4 h-4" />}
            onClick={() => onNavigate('fees')}
          >
            Record Payment
          </Button>
        </div>
      </div>

      {/* 5 Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Students */}
        <div 
          onClick={() => onNavigate('students')}
          className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-emerald-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Students</span>
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {loading ? '—' : totalStudents}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Enrolled pupils</p>
        </div>

        {/* Present Today */}
        <div 
          onClick={() => onNavigate('attendance')}
          className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-emerald-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Present</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
            {loading ? '—' : presentToday}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Today in class</p>
        </div>

        {/* Absent Today */}
        <div 
          onClick={() => onNavigate('attendance')}
          className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-rose-400 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Absent</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-700">
            {loading ? '—' : absentToday}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Not marked present</p>
        </div>

        {/* Late Today */}
        <div 
          onClick={() => onNavigate('attendance')}
          className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-amber-400 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Late</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-700">
            {loading ? '—' : lateToday}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Arrived past bell</p>
        </div>

        {/* Fees Outstanding */}
        <div 
          onClick={() => onNavigate('fees')}
          className="col-span-2 sm:col-span-1 bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-emerald-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Fees Due</span>
            <Wallet className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">
            {loading ? '—' : formatNaira(feesOutstanding)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Term balance due</p>
        </div>
      </div>

      {/* Quick Action Buttons Grid */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => onOpenQuickAction('add-student')}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-slate-800 text-xs font-medium transition-colors cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>+ Add Student</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-slate-800 text-xs font-medium transition-colors cursor-pointer min-h-[44px]"
          >
            <CalendarCheck2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>✓ Take Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenQuickAction('record-payment')}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-slate-800 text-xs font-medium transition-colors cursor-pointer min-h-[44px]"
          >
            <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>₦ Record Payment</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('results')}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-slate-800 text-xs font-medium transition-colors cursor-pointer min-h-[44px]"
          >
            <Award className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>📊 Enter Results</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenQuickAction('create-assignment')}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-slate-800 text-xs font-medium transition-colors cursor-pointer min-h-[44px]"
          >
            <ClipboardList className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>📝 Assignment</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenQuickAction('new-announcement')}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-slate-800 text-xs font-medium transition-colors cursor-pointer min-h-[44px]"
          >
            <Megaphone className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>📢 Announcement</span>
          </button>
        </div>
      </div>

      {/* 2x2 Grid: Today's Attendance & Recent Fee Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Attendance Box */}
        <Card>
          <CardHeader
            title="Today's Attendance"
            subtitle={`${todayAttendanceList.length} pupils logged today`}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('attendance')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                View Sheet
              </Button>
            }
          />
          <CardBody className="p-0">
            {todayAttendanceList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No attendance marked for today yet. Tap "Take Attendance" to begin.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayAttendanceList.map(({ record, studentName }) => (
                  <div key={record.attendanceId} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{studentName}</p>
                      <p className="text-xs text-slate-500">
                        In: {record.timeIn ? formatTime(record.timeIn) : '—'} 
                        {record.timeOut ? ` • Out: ${formatTime(record.timeOut)}` : ''}
                      </p>
                    </div>
                    <AttendanceBadge status={record.status} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Recent Fee Payments */}
        <Card>
          <CardHeader
            title="Recent Fee Payments"
            subtitle="Latest receipts recorded"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('fees')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Fee Ledger
              </Button>
            }
          />
          <CardBody className="p-0">
            {recentPayments.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No payments recorded for this term yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPayments.map(({ payment, studentName }) => (
                  <div key={payment.paymentId} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{studentName}</p>
                      <p className="text-xs text-slate-500">
                        {payment.paymentMethod} • {formatDate(payment.paymentDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-800">
                        {formatNaira(payment.amount)}
                      </span>
                      {payment.reference && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {payment.reference}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* 2x2 Grid: Upcoming Assignments & School Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignments */}
        <Card>
          <CardHeader
            title="Active Class Assignments"
            subtitle="Homework & tasks due"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('assignments')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Manage
              </Button>
            }
          />
          <CardBody className="p-0">
            {upcomingAssignments.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No active homework or assignments posted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingAssignments.map((a) => (
                  <div key={a.assignmentId} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{a.title}</p>
                      <span className="text-xs text-slate-500">Due: {formatDate(a.dueDate)}</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">{a.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Announcements */}
        <Card>
          <CardHeader
            title="School Announcements"
            subtitle="Notices for staff & parents"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('announcements')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                All Notices
              </Button>
            }
          />
          <CardBody className="p-0">
            {recentAnnouncements.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No school announcements posted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentAnnouncements.map((ann) => (
                  <div key={ann.announcementId} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{ann.title}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {ann.audience}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">{ann.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
