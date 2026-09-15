import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, setDoc, updateDoc, query, where, orderBy, serverTimestamp, limit
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Assignment, SchoolClass, Subject, Student } from '../../types';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { SubmissionsModal } from '../../components/assignments/SubmissionsModal';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, logAudit } from '../../utils/formatters';
import { ClipboardList, Plus, Calendar, BookOpen, Clock, CheckCircle2 } from 'lucide-react';

export const AssignmentsPage: React.FC = () => {
  const { role, currentUser, currentTeacher } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [classFilter, setClassFilter] = useState('ALL');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'CLOSED'>('PUBLISHED');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  
  // Submissions Modal
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [assignmentForSubmissions, setAssignmentForSubmissions] = useState<Assignment | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  
  const handleViewSubmissions = async (assignment: Assignment) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'students'),
        where('classId', '==', assignment.classId),
        where('status', '==', 'ACTIVE')
      );
      const snap = await getDocs(q);
      const sList: Student[] = [];
      snap.forEach(d => sList.push(d.data() as Student));
      sList.sort((a, b) => a.firstName.localeCompare(b.firstName));
      
      setClassStudents(sList);
      setAssignmentForSubmissions(assignment);
      setShowSubmissionsModal(true);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
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
      if (cList.length > 0 && !classId) setClassId(cList[0].classId);
      else if (cList.length === 0) setClassId('');

      const subSnap = await getDocs(collection(db, 'subjects'));
      const subList: Subject[] = [];
      subSnap.forEach((d) => subList.push(d.data() as Subject));
      setSubjects(subList);
      if (subList.length > 0 && !subjectId) setSubjectId(subList[0].subjectId);

      const aSnap = await getDocs(query(collection(db, 'assignments'), orderBy('createdAt', 'desc'), limit(100)));
      let aList: Assignment[] = [];
      aSnap.forEach((d) => aList.push(d.data() as Assignment));

      if (role === 'TEACHER') {
        const assignedIds = new Set(currentTeacher?.assignedClassIds || []);
        aList = aList.filter(
          (a) => assignedIds.has(a.classId) || a.teacherId === currentUser?.uid
        );
      }

      aList.sort((a, b) => (b.dueDate > a.dueDate ? 1 : -1));
      setAssignments(aList);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [role, currentTeacher]);

  const openAddModal = () => {
    setEditingAssignment(null);
    setTitle('');
    setDescription('');
    setDueDate(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
    setStatus('PUBLISHED');
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !classId || !subjectId) {
      setFormError('Please fill in title, instructions, class, and subject.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const aId = editingAssignment?.assignmentId || `assign-${Date.now()}`;
      const payload: Partial<Assignment> = {
        assignmentId: aId,
        title: title.trim(),
        description: description.trim(),
        classId,
        subjectId,
        teacherId: currentUser?.uid || 'teacher',
        dueDate,
        status,
        updatedAt: serverTimestamp(),
      };

      if (!editingAssignment) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(doc(db, 'assignments', aId), payload, { merge: true });

      await logAudit(
        currentUser?.uid || 'user',
        editingAssignment ? 'ASSIGNMENT_UPDATED' : 'ASSIGNMENT_CREATED',
        'assignments',
        aId,
        `Created homework: "${title}" for ${classId}`
      );

      setShowModal(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving assignment:', err);
      setFormError(err.message || 'Failed to save homework.');
    } finally {
      setSaving(false);
    }
  };

  const classesMap = new Map<string, SchoolClass>(classes.map((c) => [c.classId, c]));
  const subjectsMap = new Map<string, Subject>(subjects.map((s) => [s.subjectId, s]));

  const filteredAssignments = assignments.filter((a) => {
    if (classFilter !== 'ALL' && a.classId !== classFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Homework & Classroom Tasks
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Post weekly homework, class projects, and track completion
          </p>
        </div>

        {(role === 'ADMIN' || role === 'TEACHER') && (
          <Button
            variant="primary"
            onClick={openAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Assignment
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-700">Filter by Class:</label>
        <select
          id="assignment-class-filter"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
        >
          <option value="ALL">All Classes</option>
          {classes.map((c) => (
            <option key={c.classId} value={c.classId}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid of Assignments */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading assignments...</div>
      ) : filteredAssignments.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-xs text-slate-500">
            No homework assignments found. Tap "Create Assignment" to post homework.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssignments.map((a) => {
            const cls = classesMap.get(a.classId);
            const sub = subjectsMap.get(a.subjectId);

            return (
              <Card key={a.assignmentId} className="flex flex-col justify-between h-full">
                <CardBody className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                        {cls?.name || 'Class'} • {sub?.name || 'Subject'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        a.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {a.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mt-2.5">
                      {a.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      {a.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-rose-600 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      Due: {formatDate(a.dueDate)}
                    </span>
                    <div className="flex gap-3">
                      {(role === 'ADMIN' || role === 'TEACHER') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleViewSubmissions(a)}
                            className="text-emerald-700 hover:text-emerald-900 font-semibold text-xs cursor-pointer"
                          >
                            Submissions
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAssignment(a);
                              setTitle(a.title);
                              setDescription(a.description);
                              setClassId(a.classId);
                              setSubjectId(a.subjectId);
                              setDueDate(a.dueDate);
                              setStatus(a.status);
                              setShowModal(true);
                            }}
                            className="text-emerald-800 hover:text-emerald-950 font-semibold text-xs cursor-pointer"
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}
        subtitle="Give students homework instructions and submission deadlines"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {formError}
            </div>
          )}

          <Input
            id="assign-title"
            label="Assignment Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Fractions and Decimals Problem Set"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              id="assign-class"
              label="Target Class *"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              options={classes.map((c) => ({ value: c.classId, label: c.name }))}
              required
            />
            <Select
              id="assign-subject"
              label="Subject *"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              options={subjects.map((s) => ({ value: s.subjectId, label: s.name }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="assign-due-date"
              type="date"
              label="Submission Due Date *"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
            <Select
              id="assign-status"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              options={[
                { value: 'PUBLISHED', label: 'Published (Pupils & Parents see)' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'CLOSED', label: 'Closed / Past Due' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instructions & Questions *
            </label>
            <textarea
              id="assign-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="e.g. Solve exercises 1 to 10 on page 42 of New General Mathematics textbook. Show all working in your homework exercise book."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {editingAssignment ? 'Save Changes' : 'Post Assignment'}
            </Button>
          </div>
        </form>
      </Modal>

      <SubmissionsModal
        isOpen={showSubmissionsModal}
        onClose={() => setShowSubmissionsModal(false)}
        assignment={assignmentForSubmissions}
        students={classStudents}
      />
    </div>
  );
};
