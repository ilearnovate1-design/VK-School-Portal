import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { AttendanceBadge } from '../../components/common/Badge';
import { 
  Layers, CalendarCheck2, ClipboardList, Award, Megaphone, Clock, CheckCircle2 
} from 'lucide-react';
import { SchoolClass, Student, AttendanceRecord, Assignment, Announcement } from '../../types';
import { getTodayDateString, formatTime, formatDate } from '../../utils/formatters';

interface TeacherDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onNavigate }) => {
  const { currentTeacher, currentUser } = useAuth();
  const { settings } = useSchool();
  const [assignedClasses, setAssignedClasses] = useState<SchoolClass[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<{ student: Student; att?: AttendanceRecord }[]>([]);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeacherData = async () => {
      setLoading(true);
      try {
        const today = getTodayDateString();

        // 1. Fetch Assigned Classes
        let classIds = currentTeacher?.assignedClassIds || [];
        const classesSnap = await getDocs(collection(db, 'classes'));
        const allClasses: SchoolClass[] = [];
        classesSnap.forEach((doc) => allClasses.push(doc.data() as SchoolClass));

        let relevantClasses: SchoolClass[] = [];
        if (classIds.length > 0) {
          relevantClasses = allClasses.filter((c) => classIds.includes(c.classId));
        } else if (currentTeacher?.teacherId) {
          relevantClasses = allClasses.filter((c) => c.classTeacherId === currentTeacher.teacherId);
        }
        setAssignedClasses(relevantClasses);

        // 2. Fetch Students for the first assigned class or all
        const targetClassId = relevantClasses[0]?.classId;
        if (targetClassId) {
          const sSnap = await getDocs(
            query(collection(db, 'students'), where('classId', '==', targetClassId), where('status', '==', 'ACTIVE'))
          );
          const students: Student[] = [];
          sSnap.forEach((d) => students.push(d.data() as Student));

          // Fetch attendance for these students today
          const attSnap = await getDocs(
            query(collection(db, 'attendance'), where('classId', '==', targetClassId), where('date', '==', today))
          );
          const attMap = new Map<string, AttendanceRecord>();
          attSnap.forEach((d) => {
            const a = d.data() as AttendanceRecord;
            attMap.set(a.studentId, a);
          });

          setTodayAttendance(
            students.map((s) => ({
              student: s,
              att: attMap.get(s.studentId),
            }))
          );
        }

        // 3. Assignments
        const aSnap = await getDocs(
          query(collection(db, 'assignments'), limit(5))
        );
        const aList: Assignment[] = [];
        aSnap.forEach((d) => aList.push(d.data() as Assignment));
        setMyAssignments(aList);

        // 4. Announcements for teachers or all
        const annSnap = await getDocs(
          query(collection(db, 'announcements'), where('audience', 'in', ['ALL', 'TEACHERS']), limit(4))
        );
        const annList: Announcement[] = [];
        annSnap.forEach((d) => annList.push(d.data() as Announcement));
        setAnnouncements(annList);

      } catch (err) {
        console.error('Error loading teacher dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeacherData();
  }, [currentTeacher]);

  return (
    <div className="space-y-6">
      {/* Teacher Welcome Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
            Teacher Portal • {settings.currentAcademicSession}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            Welcome back, {currentTeacher ? `${currentTeacher.firstName} ${currentTeacher.lastName}` : currentUser?.displayName || 'Teacher'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your classroom attendance, assign homework, and enter term examination scores.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            leftIcon={<CalendarCheck2 className="w-4 h-4" />}
            onClick={() => onNavigate('attendance')}
          >
            Mark Attendance
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Award className="w-4 h-4" />}
            onClick={() => onNavigate('results')}
          >
            Enter Results
          </Button>
        </div>
      </div>

      {/* 4 Cards: Classes, Present, Absent, Assignments */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigate('classes')}
          className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-emerald-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase text-slate-500">My Classes</span>
            <Layers className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {assignedClasses.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {assignedClasses.map((c) => c.name).join(', ') || 'Classroom assigned'}
          </p>
        </div>

        <div 
          onClick={() => onNavigate('attendance')}
          className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-emerald-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase text-emerald-700">Present</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">
            {todayAttendance.filter((i) => i.att?.status === 'PRESENT').length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">In class today</p>
        </div>

        <div 
          onClick={() => onNavigate('attendance')}
          className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-amber-400 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase text-amber-700">Late / Absent</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-700">
            {todayAttendance.filter((i) => i.att?.status === 'ABSENT' || i.att?.status === 'LATE').length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Needs attention</p>
        </div>

        <div 
          onClick={() => onNavigate('assignments')}
          className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-emerald-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase text-slate-500">Homework</span>
            <ClipboardList className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {myAssignments.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Active assignments</p>
        </div>
      </div>

      {/* Today's Attendance Quick-View */}
      <Card>
        <CardHeader
          title={`Today's Attendance — ${assignedClasses[0]?.name || 'My Class'}`}
          subtitle="Quick check on pupils marked for today"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate('attendance')}
            >
              Open Full Attendance Sheet
            </Button>
          }
        />
        <CardBody className="p-0">
          {todayAttendance.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No attendance marked yet. Tap "Open Full Attendance Sheet" to take attendance for your class.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {todayAttendance.slice(0, 6).map(({ student, att }) => (
                <div key={student.studentId} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold text-slate-900">
                      {student.firstName} {student.lastName}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">
                      ({student.admissionNumber})
                    </span>
                    {att?.timeIn && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Time In: {formatTime(att.timeIn)}
                      </p>
                    )}
                  </div>
                  <AttendanceBadge status={att?.status || 'UNMARKED'} />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Announcements */}
      <Card>
        <CardHeader
          title="Staff Notices & Announcements"
          subtitle="Updates from school administration"
        />
        <CardBody className="p-0">
          {announcements.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No notices at this time.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {announcements.map((ann) => (
                <div key={ann.announcementId} className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-900 text-sm">{ann.title}</h4>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                      {ann.audience}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ann.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
