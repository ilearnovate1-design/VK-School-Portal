import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, setDoc, query, where, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Student, SchoolClass, AttendanceRecord, AttendanceStatus } from '../../types';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Input';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { AttendanceBadge } from '../../components/common/Badge';
import { 
  CalendarCheck2, CheckCircle2, XCircle, Clock, Save, RotateCcw, 
  Printer, LogOut, FileText, CheckCheck, Users 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTodayDateString, formatDate, formatTime, logAudit } from '../../utils/formatters';

interface StudentAttendanceEntry {
  status: AttendanceStatus | 'UNMARKED';
  timeIn?: any;
  timeOut?: any;
}

export const AttendancePage: React.FC = () => {
  const { role, currentUser, currentTeacher } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, StudentAttendanceEntry>>(new Map());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Mode: Daily Entry vs Report
  const [viewMode, setViewMode] = useState<'entry' | 'report'>('entry');
  const [reportStudentId, setReportStudentId] = useState<string>('ALL');
  const [reportRecords, setReportRecords] = useState<AttendanceRecord[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  // 1. Fetch Classes (Scoped strictly to teacher assignments if role === TEACHER)
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const cSnap = await getDocs(collection(db, 'classes'));
        let cList: SchoolClass[] = [];
        cSnap.forEach((d) => cList.push(d.data() as SchoolClass));

        if (role === 'TEACHER') {
          const assignedIds = currentTeacher?.assignedClassIds || [];
          cList = cList.filter(
            (c) => assignedIds.includes(c.classId) || c.classTeacherId === currentTeacher?.teacherId
          );
        }

        setClasses(cList);
        if (cList.length > 0 && !selectedClassId) {
          setSelectedClassId(cList[0].classId);
        } else if (cList.length === 0) {
          setSelectedClassId('');
        }
      } catch (err) {
        console.error('Error loading classes:', err);
      }
    };

    fetchClasses();
  }, [role, currentTeacher]);

  // 2. Fetch Students and Attendance for selected class & date
  useEffect(() => {
    if (!selectedClassId) return;

    const fetchAttendanceSheet = async () => {
      setLoading(true);
      setSuccessMessage('');
      setErrorMessage('');
      try {
        // Fetch active students in this class
        const sQuery = query(
          collection(db, 'students'),
          where('classId', '==', selectedClassId),
          where('status', '==', 'ACTIVE')
        );
        const sSnap = await getDocs(sQuery);
        const sList: Student[] = [];
        sSnap.forEach((d) => sList.push(d.data() as Student));
        // Sort students alphabetically by first name
        sList.sort((a, b) => a.firstName.localeCompare(b.firstName));
        setStudents(sList);

        // Fetch existing attendance records for this date & class
        const attQuery = query(
          collection(db, 'attendance'),
          where('classId', '==', selectedClassId),
          where('date', '==', selectedDate)
        );
        const attSnap = await getDocs(attQuery);
        const aMap = new Map<string, { status: AttendanceStatus | 'UNMARKED'; timeIn?: any; timeOut?: any }>();

        // Pre-fill UNMARKED
        sList.forEach((s) => {
          aMap.set(s.studentId, { status: 'UNMARKED' });
        });

        // Overlay existing
        attSnap.forEach((d) => {
          const rec = d.data() as AttendanceRecord;
          aMap.set(rec.studentId, {
            status: rec.status,
            timeIn: rec.timeIn,
            timeOut: rec.timeOut,
          });
        });

        setAttendanceMap(aMap);
      } catch (err) {
        console.error('Error fetching attendance sheet:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceSheet();
  }, [selectedClassId, selectedDate]);

  // Mark status for a specific pupil
  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    const updated = new Map<string, StudentAttendanceEntry>(attendanceMap);
    const existing = updated.get(studentId) || { status: 'UNMARKED' };

    let newTimeIn = existing.timeIn;
    // When marking PRESENT or LATE for the first time, record timeIn
    if ((status === 'PRESENT' || status === 'LATE') && !newTimeIn) {
      newTimeIn = new Date();
    } else if (status === 'ABSENT') {
      newTimeIn = null;
    }

    updated.set(studentId, {
      ...existing,
      status,
      timeIn: newTimeIn,
    });
    setAttendanceMap(updated);
  };

  // Clock Out a specific pupil
  const handleClockOut = async (studentId: string) => {
    const updated = new Map<string, StudentAttendanceEntry>(attendanceMap);
    const existing = updated.get(studentId);
    if (!existing) return;

    updated.set(studentId, {
      ...existing,
      timeOut: new Date(),
    });
    setAttendanceMap(updated);

    // Save out time immediately
    try {
      const attendanceId = `${selectedDate}_${studentId}`;
      const docRef = doc(db, 'attendance', attendanceId);
      await setDoc(docRef, {
        timeOut: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch(err) {
      console.error(err);
    }
  };

  // Mark all present
  const handleMarkAllPresent = () => {
    const updated = new Map<string, StudentAttendanceEntry>(attendanceMap);
    const now = new Date();
    students.forEach((s) => {
      const existing = updated.get(s.studentId);
      updated.set(s.studentId, {
        status: 'PRESENT',
        timeIn: existing?.timeIn || now,
        timeOut: existing?.timeOut || null,
      });
    });
    setAttendanceMap(updated);
  };

  // Reset attendance state
  const handleReset = () => {
    const updated = new Map(attendanceMap);
    students.forEach((s) => {
      updated.set(s.studentId, {
        status: 'UNMARKED',
        timeIn: null,
        timeOut: null,
      });
    });
    setAttendanceMap(updated);
  };

  // Save Attendance to Firestore
  const handleSaveAttendance = async () => {
    if (saving) return;
    if (!selectedClassId) {
      setErrorMessage('Please select a valid classroom arm.');
      return;
    }
    if (role === 'TEACHER') {
      const assignedIds = currentTeacher?.assignedClassIds || [];
      const isAuthorized = assignedIds.includes(selectedClassId) || classes.some(c => c.classId === selectedClassId && c.classTeacherId === currentTeacher?.teacherId);
      if (!isAuthorized) {
        setErrorMessage('Security Violation: You are not authorized to record attendance for this class.');
        return;
      }
    }

    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const batch = writeBatch(db);
      let markedCount = 0;

      students.forEach((student) => {
        const item = attendanceMap.get(student.studentId);
        if (item && item.status !== 'UNMARKED') {
          // Deterministic ID: YYYY-MM-DD_studentId
          const attendanceId = `${selectedDate}_${student.studentId}`;
          const docRef = doc(db, 'attendance', attendanceId);

          const payload: any = {
            attendanceId,
            studentId: student.studentId,
            classId: selectedClassId,
            date: selectedDate,
            status: item.status as AttendanceStatus,
            markedBy: currentUser?.displayName || currentUser?.email || 'Teacher',
            updatedAt: serverTimestamp(),
          };

          // Use serverTimestamp for new entries, keep existing if already a Firestore timestamp
          if (item.timeIn && !item.timeIn.seconds) {
            payload.timeIn = serverTimestamp();
          } else if (item.timeIn) {
            payload.timeIn = item.timeIn;
          } else {
            payload.timeIn = null;
          }

          if (item.timeOut && !item.timeOut.seconds) {
            payload.timeOut = serverTimestamp();
          } else if (item.timeOut) {
            payload.timeOut = item.timeOut;
          } else {
            payload.timeOut = null;
          }

          batch.set(docRef, payload, { merge: true });
          markedCount++;
        }
      });

      await batch.commit();

      await logAudit(
        currentUser?.uid || 'user',
        'ATTENDANCE_RECORDED',
        'attendance',
        `${selectedDate}_${selectedClassId}`,
        `Saved attendance for ${markedCount} pupils on ${selectedDate}`
      );

      setSuccessMessage(`Attendance saved successfully! ${markedCount} pupils logged for ${formatDate(selectedDate)}.`);
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      setErrorMessage(err.message || 'Unable to save attendance. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  // Load Attendance Reports
  const generateReport = async () => {
    setLoadingReport(true);
    try {
      let q = query(
        collection(db, 'attendance'),
        where('classId', '==', selectedClassId)
      );

      if (reportStudentId !== 'ALL') {
        q = query(
          collection(db, 'attendance'),
          where('studentId', '==', reportStudentId)
        );
      }

      const snap = await getDocs(q);
      const list: AttendanceRecord[] = [];
      snap.forEach((d) => list.push(d.data() as AttendanceRecord));
      list.sort((a, b) => (b.date > a.date ? 1 : -1));
      setReportRecords(list);
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  const selectedClassName = classes.find((c) => c.classId === selectedClassId)?.name || 'Selected Class';

  // Stats for today
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let unmarkedCount = 0;

  attendanceMap.forEach((val) => {
    if (val.status === 'PRESENT') presentCount++;
    else if (val.status === 'ABSENT') absentCount++;
    else if (val.status === 'LATE') lateCount++;
    else unmarkedCount++;
  });

  return (
    <div className="space-y-5">
      {/* Header with Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Attendance & Clock-In
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Daily roll call, automated arrival timestamps, and terminal reports
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('entry')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[38px] cursor-pointer ${
              viewMode === 'entry' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
            }`}
          >
            Daily Sheet
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('report');
              generateReport();
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[38px] cursor-pointer ${
              viewMode === 'report' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
            }`}
          >
            Attendance Reports
          </button>
        </div>
      </div>

      {/* Selector Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Class
            </label>
            <select
              id="attendance-class-select"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600"
            >
              {classes.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date
            </label>
            <input
              id="attendance-date-select"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-end">
            <div className="flex items-center gap-2 w-full text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <CalendarCheck2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-semibold text-slate-800">
                {formatDate(selectedDate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-xl">
          {errorMessage}
        </div>
      )}

      {/* VIEW 1: DAILY ATTENDANCE ENTRY */}
      {viewMode === 'entry' && (
        <div className="space-y-4">
          {/* Summary pill counters & actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200/60">
                ✓ Present: {presentCount}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 font-semibold border border-rose-200/60">
                ✕ Absent: {absentCount}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200/60">
                ◷ Late: {lateCount}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-medium">
                ○ Unmarked: {unmarkedCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllPresent}
                leftIcon={<CheckCheck className="w-4 h-4" />}
              >
                Mark All Present
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Student List Sheet */}
          <Card>
            <CardHeader
              title={`${selectedClassName} Attendance Sheet`}
              subtitle={`${students.length} pupils enrolled • Tap status to mark`}
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAttendance}
                  isLoading={saving}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Save Attendance
                </Button>
              }
            />
            <CardBody className="p-0">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-500">Loading student roll...</div>
              ) : students.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No active students found in {selectedClassName}. Please enroll students in this class first.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {students.map((student) => {
                    const current = attendanceMap.get(student.studentId) || { status: 'UNMARKED' };
                    const isPresent = current.status === 'PRESENT';
                    const isAbsent = current.status === 'ABSENT';
                    const isLate = current.status === 'LATE';

                    return (
                      <div
                        key={student.studentId}
                        className="p-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50"
                      >
                        {/* Student Name & Timestamps */}
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {student.firstName} {student.lastName}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              ({student.admissionNumber})
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>
                              Time In:{' '}
                              <strong className="text-slate-700">
                                {current.timeIn ? formatTime(current.timeIn) : '—'}
                              </strong>
                            </span>
                            <span>
                              Time Out:{' '}
                              <strong className="text-slate-700">
                                {current.timeOut ? formatTime(current.timeOut) : '—'}
                              </strong>
                            </span>
                          </div>
                        </div>

                        {/* Status Buttons & Clock Out Action */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Present Button */}
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.studentId, 'PRESENT')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all min-h-[42px] cursor-pointer flex items-center gap-1.5 ${
                              isPresent
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-emerald-100/60'
                            }`}
                          >
                            <span>✓</span> Present
                          </button>

                          {/* Absent Button */}
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.studentId, 'ABSENT')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all min-h-[42px] cursor-pointer flex items-center gap-1.5 ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-rose-100/60'
                            }`}
                          >
                            <span>✕</span> Absent
                          </button>

                          {/* Late Button */}
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.studentId, 'LATE')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all min-h-[42px] cursor-pointer flex items-center gap-1.5 ${
                              isLate
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-amber-100/60'
                            }`}
                          >
                            <span>◷</span> Late
                          </button>

                          {/* Clock Out Button */}
                          {(isPresent || isLate) && (
                            <button
                              type="button"
                              onClick={() => handleClockOut(student.studentId)}
                              title="Record dismissal / departure time"
                              className={`px-3 py-2 rounded-lg text-xs font-medium border min-h-[42px] transition-colors cursor-pointer flex items-center gap-1 ${
                                current.timeOut
                                  ? 'bg-slate-50 border-slate-300 text-slate-600'
                                  : 'bg-white border-emerald-600 text-emerald-800 hover:bg-emerald-50'
                              }`}
                            >
                              <LogOut className="w-3.5 h-3.5 text-emerald-700" />
                              <span>{current.timeOut ? 'Dismissed' : 'Clock Out'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Bottom Sticky Save button for mobile */}
          <div className="sm:hidden sticky bottom-18 left-0 right-0 z-20">
            <Button
              className="w-full shadow-lg"
              size="lg"
              variant="primary"
              onClick={handleSaveAttendance}
              isLoading={saving}
              leftIcon={<Save className="w-5 h-5" />}
            >
              Save Attendance ({students.length} Pupils)
            </Button>
          </div>
        </div>
      )}

      {/* VIEW 2: ATTENDANCE REPORTS */}
      {viewMode === 'report' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={`${selectedClassName} Attendance Report`}
              subtitle="Aggregated school days, presence count, and punctuality rate"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                  leftIcon={<Printer className="w-4 h-4" />}
                >
                  Print Report
                </Button>
              }
            />
            <CardBody className="p-0">
              {loadingReport ? (
                <div className="py-12 text-center text-xs text-slate-500">Generating report...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="px-5 py-3">Pupil Name</th>
                        <th className="px-5 py-3 text-center">School Days</th>
                        <th className="px-5 py-3 text-center">Present</th>
                        <th className="px-5 py-3 text-center">Absent</th>
                        <th className="px-5 py-3 text-center">Late</th>
                        <th className="px-5 py-3 text-center">Rate (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((st) => {
                        const studentRecs = reportRecords.filter((r) => r.studentId === st.studentId);
                        const totalDays = studentRecs.length;
                        const present = studentRecs.filter((r) => r.status === 'PRESENT').length;
                        const absent = studentRecs.filter((r) => r.status === 'ABSENT').length;
                        const late = studentRecs.filter((r) => r.status === 'LATE').length;
                        const rate = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 100;

                        return (
                          <tr key={st.studentId} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3 font-semibold text-slate-900">
                              {st.firstName} {st.lastName}
                              <span className="block text-[11px] text-slate-400 font-normal">
                                {st.admissionNumber}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center font-medium text-slate-700">
                              {totalDays || '—'}
                            </td>
                            <td className="px-5 py-3 text-center font-bold text-emerald-700">
                              {present}
                            </td>
                            <td className="px-5 py-3 text-center font-bold text-rose-600">
                              {absent}
                            </td>
                            <td className="px-5 py-3 text-center font-bold text-amber-700">
                              {late}
                            </td>
                            <td className="px-5 py-3 text-center font-bold">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  rate >= 90
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : rate >= 75
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'bg-rose-50 text-rose-800'
                                }`}
                              >
                                {rate}%
                              </span>
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
        </div>
      )}
    </div>
  );
};
