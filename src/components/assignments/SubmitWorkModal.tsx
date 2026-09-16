import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Assignment, Submission, Student } from '../../types';
import { doc, getDocs, collection, query, where, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/formatters';
import { Paperclip } from 'lucide-react';

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
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [formError, setFormError] = useState('');
  
  useEffect(() => {
    if (!isOpen || !assignment || !student) return;
    
    const fetchSubmission = async () => {
      setLoading(true);
      setFormError('');
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
          setFileUrl(sub.fileUrl || '');
          setFileName(sub.fileName || '');
        } else {
          setSubmission(null);
          setAnswerText('');
          setFileUrl('');
          setFileName('');
        }
      } catch (error) {
        console.error('Error fetching submission:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubmission();
  }, [isOpen, assignment, student]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 700 * 1024) {
      setFormError('File size must be under 700KB. Please choose a smaller file.');
      return;
    }
    setFormError('');
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setFileUrl(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment || !student || !currentUser) return;
    
    if (!answerText.trim() && !fileUrl) {
      setFormError('Please provide an answer or attach a file.');
      return;
    }
    
    setSaving(true);
    try {
      const submissionId = submission?.submissionId || `sub_${assignment.assignmentId}_${student.studentId}`;
      const docRef = doc(db, 'submissions', submissionId);
      
      const payload: Partial<Submission> = {
        submissionId,
        assignmentId: assignment.assignmentId,
        studentId: student.studentId,
        answerText,
        fileUrl,
        fileName,
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
            {assignment.attachmentUrl && (
              <div className="mt-3">
                <a 
                  href={assignment.attachmentUrl}
                  download={assignment.attachmentName || 'assignment-attachment'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors text-xs font-semibold"
                >
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate max-w-[200px]">{assignment.attachmentName || 'Download Attachment'}</span>
                </a>
              </div>
            )}
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
                {submission.fileUrl && (
                  <div className="mt-2">
                    <a 
                      href={submission.fileUrl}
                      download={submission.fileName || 'submission-attachment'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors text-[10px] font-semibold"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[150px]">{submission.fileName || 'View Attachment'}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Answer
                </label>
                <textarea
                  rows={5}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Type the answer here..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attach File (Max 700KB PDF/Doc/Image)
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  disabled={saving}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-50"
                />
                {fileName && (
                  <p className="mt-1 text-[10px] text-emerald-700 font-medium">Attached: {fileName}</p>
                )}
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
