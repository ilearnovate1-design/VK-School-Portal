import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, setDoc, query, where, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Student, SchoolClass, Subject, Result, Term } from '../../types';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Input';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { ReportCardModal } from '../../components/results/ReportCardModal';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { calculateGradeAndRemark, logAudit } from '../../utils/formatters';
import { broadcastAnnouncementNotifications } from '../../services/notificationService';
import { Award, Save, CheckCircle2, Send, Printer, Eye, BookOpen } from 'lucide-react';

interface ScoreEntry {
  ca: number;
  exam: number;
  status: 'DRAFT' | 'PUBLISHED';
}

export const ResultsPage: React.FC = () => {
  const { role, currentUser, currentTeacher } = useAuth();
  const { settings } = useSchool();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<Term>(settings.currentTerm);
  const [selectedSession, setSelectedSession] = useState(settings.currentAcademicSession);

  // Scores map: studentId -> ScoreEntry
  const [scoresMap, setScoresMap] = useState<Map<string, ScoreEntry>>(new Map());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Report Card Modal
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  const [studentAllResults, setStudentAllResults] = useState<Result[]>([]);

  // 1. Fetch Classes and Subjects (Scoped to Teacher Assignment)
  useEffect(() => {
    const fetchBase = async () => {
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
        if (cList.length > 0 && !selectedClassId) setSelectedClassId(cList[0].classId);
        else if (cList.length === 0) setSelectedClassId('');

        const subSnap = await getDocs(collection(db, 'subjects'));
        let subList: Subject[] = [];
        subSnap.forEach((d) => subList.push(d.data() as Subject));

        if (role === 'TEACHER' && currentTeacher?.subjects && currentTeacher.subjects.length > 0) {
          const allowedSubjects = new Set(currentTeacher.subjects);
          subList = subList.filter((s) => allowedSubjects.has(s.subjectId) || allowedSubjects.has(s.name));
        }

        setSubjects(subList);
        if (subList.length > 0 && !selectedSubjectId) setSelectedSubjectId(subList[0].subjectId);
        else if (subList.length === 0) setSelectedSubjectId('');
      } catch (err) {
        console.error('Error fetching base data:', err);
      }
    };
    fetchBase();
  }, [role, currentTeacher]);

  // 2. Fetch Students & Existing Scores for selected Class, Subject, Term, Session
  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId) return;

    const fetchScores = async () => {
      setLoading(true);
      setSuccessMsg('');
      setErrorMsg('');
      try {
        // Students
        const sSnap = await getDocs(
          query(collection(db, 'students'), where('classId', '==', selectedClassId), where('status', '==', 'ACTIVE'))
        );
        const sList: Student[] = [];
        sSnap.forEach((d) => sList.push(d.data() as Student));
        sList.sort((a, b) => a.firstName.localeCompare(b.firstName));
        setStudents(sList);

        // Results
        const rSnap = await getDocs(
          query(
            collection(db, 'results'),
            where('classId', '==', selectedClassId),
            where('subjectId', '==', selectedSubjectId),
            where('term', '==', selectedTerm),
            where('academicSession', '==', selectedSession)
          )
        );

        const map = new Map<string, { ca: number; exam: number; status: 'DRAFT' | 'PUBLISHED' }>();
        sList.forEach((s) => {
          map.set(s.studentId, { ca: 0, exam: 0, status: 'DRAFT' });
        });

        rSnap.forEach((d) => {
          const r = d.data() as Result;
          map.set(r.studentId, {
            ca: r.caScore || 0,
            exam: r.examScore || 0,
            status: r.status,
          });
        });

        setScoresMap(map);
      } catch (err) {
        console.error('Error fetching scores:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, [selectedClassId, selectedSubjectId, selectedTerm, selectedSession]);

  const updateScore = (studentId: string, field: 'ca' | 'exam', value: string) => {
    let num = parseInt(value, 10);
    if (isNaN(num)) num = 0;

    // Boundary checks
    if (field === 'ca') {
      if (num < 0) num = 0;
      if (num > 30) num = 30;
    } else {
      if (num < 0) num = 0;
      if (num > 70) num = 70;
    }

    const updated = new Map<string, ScoreEntry>(scoresMap);
    const existing = updated.get(studentId) || { ca: 0, exam: 0, status: 'DRAFT' };
    updated.set(studentId, {
      ...existing,
      [field]: num,
    });
    setScoresMap(updated);
  };

  const saveResults = async (statusToSet: 'DRAFT' | 'PUBLISHED') => {
    if (saving) return;
    if (!selectedClassId || !selectedSubjectId) {
      setErrorMsg('Please select both a valid classroom arm and subject.');
      return;
    }
    if (role === 'TEACHER') {
      const assignedIds = currentTeacher?.assignedClassIds || [];
      const isAuthorized = assignedIds.includes(selectedClassId) || classes.some(c => c.classId === selectedClassId && c.classTeacherId === currentTeacher?.teacherId);
      if (!isAuthorized) {
        setErrorMsg('Security Violation: You are not authorized to enter or modify examination results for this class.');
        return;
      }
    }

    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const batch = writeBatch(db);
      let count = 0;

      students.forEach((s) => {
        const item = scoresMap.get(s.studentId) || { ca: 0, exam: 0, status: 'DRAFT' };
        const total = (item.ca || 0) + (item.exam || 0);
        const { grade, remark } = calculateGradeAndRemark(total);

        // Deterministic ID to avoid duplicates: resultId = res_${studentId}_${subjectId}_${term}_${session}
        const cleanSession = selectedSession.replace(/[^a-zA-Z0-9]/g, '-');
        const cleanTerm = selectedTerm.replace(/\s+/g, '-');
        const resultId = `res_${s.studentId}_${selectedSubjectId}_${cleanTerm}_${cleanSession}`;
        const ref = doc(db, 'results', resultId);

        const payload: Partial<Result> = {
          resultId,
          studentId: s.studentId,
          classId: selectedClassId,
          subjectId: selectedSubjectId,
          academicSession: selectedSession,
          term: selectedTerm,
          caScore: item.ca,
          examScore: item.exam,
          totalScore: total,
          grade,
          remark,
          status: statusToSet,
          teacherId: currentUser?.uid || 'teacher',
          updatedAt: serverTimestamp(),
        };

        batch.set(ref, { ...payload, createdAt: serverTimestamp() }, { merge: true });
        count++;
      });

      await batch.commit();

      // Update local state statuses
      const updated = new Map<string, ScoreEntry>(scoresMap);
      students.forEach((s) => {
        const existing = updated.get(s.studentId);
        if (existing) {
          updated.set(s.studentId, { ...existing, status: statusToSet });
        }
      });
      setScoresMap(updated);

      await logAudit(
        currentUser?.uid || 'teacher',
        statusToSet === 'PUBLISHED' ? 'RESULTS_PUBLISHED' : 'RESULTS_SAVED_DRAFT',
        'results',
        `${selectedClassId}_${selectedSubjectId}`,
        `${statusToSet === 'PUBLISHED' ? 'Published' : 'Saved draft'} scores for ${count} students in ${selectedSubjectId}`
      );
      
      if (statusToSet === 'PUBLISHED') {
        const subName = subjects.find(s => s.subjectId === selectedSubjectId)?.name || 'a subject';
        await broadcastAnnouncementNotifications(
          'CLASS_SPECIFIC',
          'Exam Results Published',
          `Results for ${subName} have just been published and are available in your portal.`,
          selectedClassId
        );
      }

      setSuccessMsg(
        statusToSet === 'PUBLISHED'
          ? `Successfully published scores for ${count} students! Parents can now view these results.`
          : `Saved scores as DRAFT for ${count} students.`
      );
    } catch (err: any) {
      console.error('Error saving results:', err);
      setErrorMsg(err.message || 'Failed to save results.');
    } finally {
      setSaving(false);
    }
  };

  // Open Full Report Card for pupil
  const handleOpenReportCard = async (student: Student) => {
    try {
      const rSnap = await getDocs(
        query(
          collection(db, 'results'),
          where('studentId', '==', student.studentId),
          where('term', '==', selectedTerm),
          where('academicSession', '==', selectedSession)
        )
      );
      const resList: Result[] = [];
      rSnap.forEach((d) => resList.push(d.data() as Result));
      setStudentAllResults(resList);
      setSelectedStudentForReport(student);
    } catch (err) {
      console.error('Error fetching student report:', err);
    }
  };

  const selectedClassName = classes.find((c) => c.classId === selectedClassId)?.name || 'Class';
  const selectedSubjectName = subjects.find((s) => s.subjectId === selectedSubjectId)?.name || 'Subject';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Examinations & Terminal Scores
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Enter CA scores (max 30), Exam marks (max 70), and publish official terminal report cards
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveResults('DRAFT')}
            isLoading={saving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => saveResults('PUBLISHED')}
            isLoading={saving}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Publish Results
          </Button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Class Grade
            </label>
            <select
              id="result-class-select"
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
              Subject
            </label>
            <select
              id="result-subject-select"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600"
            >
              {subjects.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Term
            </label>
            <select
              id="result-term-select"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value as Term)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600"
            >
              <option value="1st Term">1st Term</option>
              <option value="2nd Term">2nd Term</option>
              <option value="3rd Term">3rd Term</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Academic Session
            </label>
            <input
              id="result-session-input"
              type="text"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Scores Table */}
      <Card>
        <CardHeader
          title={`${selectedClassName} • ${selectedSubjectName}`}
          subtitle={`${students.length} pupils • Scores auto-grade with standard Nigerian curriculum scale`}
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading student scores...</div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No active students enrolled in {selectedClassName}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
                  <tr>
                    <th className="px-5 py-3">Student Name</th>
                    <th className="px-4 py-3 text-center">CA (Max 30)</th>
                    <th className="px-4 py-3 text-center">Exam (Max 70)</th>
                    <th className="px-4 py-3 text-center">Total (100)</th>
                    <th className="px-4 py-3 text-center">Grade</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">Report Card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => {
                    const sc = scoresMap.get(student.studentId) || { ca: 0, exam: 0, status: 'DRAFT' };
                    const total = (sc.ca || 0) + (sc.exam || 0);
                    const { grade, remark } = calculateGradeAndRemark(total);

                    return (
                      <tr key={student.studentId} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {student.firstName} {student.lastName}
                          <span className="block text-[11px] text-slate-400 font-mono font-normal">
                            {student.admissionNumber}
                          </span>
                        </td>

                        {/* CA Score Input */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={sc.ca}
                            onChange={(e) => updateScore(student.studentId, 'ca', e.target.value)}
                            className="w-16 text-center font-bold px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-900"
                          />
                        </td>

                        {/* Exam Score Input */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="70"
                            value={sc.exam}
                            onChange={(e) => updateScore(student.studentId, 'exam', e.target.value)}
                            className="w-16 text-center font-bold px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-900"
                          />
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3 text-center font-black text-slate-900 text-base">
                          {total}
                        </td>

                        {/* Grade */}
                        <td className="px-4 py-3 text-center font-black">
                          <span
                            className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                              grade === 'A'
                                ? 'bg-emerald-100 text-emerald-800'
                                : grade === 'B'
                                ? 'bg-blue-100 text-blue-800'
                                : grade === 'C'
                                ? 'bg-amber-100 text-amber-800'
                                : grade === 'D' || grade === 'E'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {grade}
                          </span>
                        </td>

                        {/* Remark */}
                        <td className="px-4 py-3 text-xs text-slate-600 italic">
                          {remark}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sc.status === 'PUBLISHED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {sc.status}
                          </span>
                        </td>

                        {/* View Report Card */}
                        <td className="px-5 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenReportCard(student)}
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                          >
                            Report
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

      {/* Terminal Report Card Modal */}
      <ReportCardModal
        isOpen={!!selectedStudentForReport}
        onClose={() => setSelectedStudentForReport(null)}
        student={selectedStudentForReport}
        schoolClass={selectedStudentForReport ? classes.find((c) => c.classId === selectedStudentForReport.classId) || null : null}
        results={studentAllResults}
      />
    </div>
  );
};
