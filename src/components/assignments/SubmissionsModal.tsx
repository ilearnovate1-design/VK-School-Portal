import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Assignment, Submission, Student } from '../../types';
import { doc, getDocs, collection, query, where, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatDate } from '../../utils/formatters';

interface SubmissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  students: Student[];
}

export const SubmissionsModal: React.FC<SubmissionsModalProps> = ({
  isOpen,
  onClose,
  assignment,
  students,
}) => {
  const [submissionsMap, setSubmissionsMap] = useState<Map<string, Submission>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Grading State
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [teacherComment, setTeacherComment] = useState('');

  useEffect(() => {
    if (!isOpen || !assignment) return;
    
    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'submissions'),
          where('assignmentId', '==', assignment.assignmentId)
        );
        const snap = await getDocs(q);
        const sMap = new Map<string, Submission>();
        snap.forEach((d) => {
          const sub = d.data() as Submission;
          sMap.set(sub.studentId, sub);
        });
        setSubmissionsMap(sMap);
      } catch (error) {
        console.error('Error fetching submissions:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubmissions();
  }, [isOpen, assignment]);

  const handleSaveGrade = async (studentId: string) => {
    if (!assignment) return;
    setSaving(true);
    try {
      const existingSub = submissionsMap.get(studentId);
      const submissionId = existingSub?.submissionId || `sub_${assignment.assignmentId}_${studentId}`;
      const docRef = doc(db, 'submissions', submissionId);
      
      const payload: Partial<Submission> = {
        submissionId,
        assignmentId: assignment.assignmentId,
        studentId,
        status: 'GRADED',
        score,
        teacherComment,
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(docRef, { ...payload, createdAt: existingSub ? undefined : serverTimestamp() }, { merge: true });
      
      // Update local state
      const updatedMap = new Map(submissionsMap);
      updatedMap.set(studentId, {
        ...(existingSub as Submission),
        ...payload,
        status: 'GRADED'
      });
      setSubmissionsMap(updatedMap);
      setEditingStudentId(null);
      
    } catch (error) {
      console.error('Error grading submission:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!assignment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Homework Submissions"
      subtitle={`Review and grade: ${assignment.title}`}
      maxWidth="3xl"
    >
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading submissions...</div>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Pupil Name</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const sub = submissionsMap.get(student.studentId);
                  const isEditing = editingStudentId === student.studentId;
                  
                  return (
                    <React.Fragment key={student.studentId}>
                      <tr className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!sub || sub.status === 'NOT_SUBMITTED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              PENDING
                            </span>
                          ) : sub.status === 'SUBMITTED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/50">
                              NEEDS GRADING
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                              GRADED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700">
                          {sub?.score !== undefined ? `${sub.score}/100` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditing) {
                                setEditingStudentId(null);
                              } else {
                                setEditingStudentId(student.studentId);
                                setScore(sub?.score || 0);
                                setTeacherComment(sub?.teacherComment || '');
                              }
                            }}
                            className="text-emerald-700 hover:text-emerald-900 font-semibold text-xs transition-colors"
                          >
                            {isEditing ? 'Cancel' : 'Review & Grade'}
                          </button>
                        </td>
                      </tr>
                      
                      {isEditing && (
                        <tr className="bg-slate-50/80 border-b-2 border-emerald-100">
                          <td colSpan={4} className="p-4">
                            <div className="space-y-4 max-w-xl mx-auto">
                              {/* View Submission */}
                              {sub?.answerText ? (
                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                                  <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                                    Pupil's Submission ({sub.submittedAt ? formatDate(sub.submittedAt) : 'Recent'})
                                  </span>
                                  <p className="text-xs text-slate-800 whitespace-pre-wrap">
                                    {sub.answerText}
                                  </p>
                                </div>
                              ) : (
                                <div className="bg-white p-3 rounded-lg border border-slate-200 text-center text-xs text-slate-500 italic">
                                  No work submitted online yet. Grade can still be entered manually.
                                </div>
                              )}
                              
                              {/* Grading Form */}
                              <div className="flex flex-col sm:flex-row gap-3">
                                <div className="w-full sm:w-24">
                                  <label className="block text-[10px] font-bold text-slate-700 mb-1">Score / 100</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={score}
                                    onChange={(e) => setScore(Number(e.target.value))}
                                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-600"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[10px] font-bold text-slate-700 mb-1">Teacher's Remark</label>
                                  <input
                                    type="text"
                                    value={teacherComment}
                                    onChange={(e) => setTeacherComment(e.target.value)}
                                    placeholder="e.g. Excellent work on problem #3."
                                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-600"
                                  />
                                </div>
                                <div className="flex items-end pb-0.5">
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleSaveGrade(student.studentId)}
                                    isLoading={saving}
                                  >
                                    Save Grade
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-slate-500">
                      No pupils found in this class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
};
