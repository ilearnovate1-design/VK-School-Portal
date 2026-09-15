import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Assignment, Submission, Student } from '../../types';
import { doc, getDocs, collection, query, where, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/formatters';

interface SubmitWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  student: Student | null;
}

export const SubmitWorkModal: React.FC<SubmitWorkModalProps> = ({
  isOpen,
  onClose,
  assignment,
  student,
}) => {
  const { currentUser } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [answerText, setAnswerText] = useState('');
  
  useEffect(() => {
    if (!isOpen || !assignment || !student) return;
    
    const fetchSubmission = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'submissions'),
          where('assignmentId', '==', assignment.assignmentId),
          where('studentId', '==', student.studentId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const sub = snap.docs[0].data() as Submission;
          setSubmission(sub);
          setAnswerText(sub.answerText || '');
        } else {
          setSubmission(null);
          setAnswerText('');
        }
      } catch (error) {
        console.error('Error fetching submission:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubmission();
  }, [isOpen, assignment, student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment || !student || !currentUser) return;
    
    setSaving(true);
    try {
      const submissionId = submission?.submissionId || `sub_${assignment.assignmentId}_${student.studentId}`;
      const docRef = doc(db, 'submissions', submissionId);
      
      const payload: Partial<Submission> = {
        submissionId,
        assignmentId: assignment.assignmentId,
        studentId: student.studentId,
        answerText,
        status: 'SUBMITTED',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(docRef, { ...payload, createdAt: submission ? undefined : serverTimestamp() }, { merge: true });
      
      // Update local state
      setSubmission({
        ...(submission as Submission),
        ...payload,
        status: 'SUBMITTED'
      });
      
    } catch (error) {
      console.error('Error submitting work:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!assignment || !student) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Homework Submission"
      subtitle={`Submit work for ${student.firstName} ${student.lastName}`}
      maxWidth="md"
    >
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500">Loading details...</div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-sm">{assignment.title}</h4>
            <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">{assignment.description}</p>
            <div className="mt-3 pt-3 border-t border-slate-200 text-xs font-semibold text-rose-600">
              Due: {formatDate(assignment.dueDate)}
            </div>
          </div>

          {submission?.status === 'GRADED' ? (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-900">Graded</span>
                <span className="text-lg font-black text-emerald-700">{submission.score}/100</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-emerald-600 mb-1">Teacher's Remark</span>
                <p className="text-xs text-emerald-800 italic">
                  "{submission.teacherComment || 'No comment provided.'}"
                </p>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-emerald-600 mb-1">Your Submission</span>
                <p className="text-xs text-slate-700 bg-white p-3 rounded border border-emerald-100 whitespace-pre-wrap">
                  {submission.answerText}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Answer
                </label>
                <textarea
                  rows={5}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  required
                  placeholder="Type the answer here..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  disabled={saving}
                />
              </div>
              
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saving}>
                  {submission?.status === 'SUBMITTED' ? 'Update Submission' : 'Submit Homework'}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
};
