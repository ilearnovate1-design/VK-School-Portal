import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, setDoc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Teacher, SchoolClass, Subject } from '../../types';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { Plus, Search, Edit2, Phone, Mail, BookOpen, Layers, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../utils/formatters';

export const TeachersPage: React.FC = () => {
  const { role, currentUser } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const tSnap = await getDocs(collection(db, 'teachers'));
      const tList: Teacher[] = [];
      tSnap.forEach((d) => tList.push(d.data() as Teacher));
      setTeachers(tList);

      const cSnap = await getDocs(collection(db, 'classes'));
      const cList: SchoolClass[] = [];
      cSnap.forEach((d) => cList.push(d.data() as SchoolClass));
      setClasses(cList);

      const subSnap = await getDocs(collection(db, 'subjects'));
      const subList: Subject[] = [];
      subSnap.forEach((d) => subList.push(d.data() as Subject));
      setSubjects(subList);
    } catch (err) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingTeacher(null);
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setEmployeeId(`EMP-00${teachers.length + 1}`);
    setAssignedClassIds([]);
    setAssignedSubjects([]);
    setStatus('ACTIVE');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFirstName(teacher.firstName);
    setLastName(teacher.lastName);
    setPhone(teacher.phone);
    setEmail(teacher.email);
    setEmployeeId(teacher.employeeId || '');
    setAssignedClassIds(teacher.assignedClassIds || []);
    setAssignedSubjects(teacher.subjects || []);
    setStatus(teacher.status || 'ACTIVE');
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim()) {
      setFormError('Please enter teacher full name, phone number, and email.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const tId = editingTeacher?.teacherId || `teacher-${Date.now()}`;
      const teacherDocRef = doc(db, 'teachers', tId);

      const payload: any = {
        teacherId: tId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        employeeId: employeeId.trim() || undefined,
        assignedClassIds,
        subjects: assignedSubjects,
        status,
        updatedAt: serverTimestamp(),
      };

      if (!editingTeacher) {
        payload.createdAt = serverTimestamp();
      }

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      await setDoc(teacherDocRef, payload, { merge: true });

      await logAudit(
        currentUser?.uid || 'admin',
        editingTeacher ? 'TEACHER_UPDATED' : 'TEACHER_CREATED',
        'teachers',
        tId,
        `${editingTeacher ? 'Updated' : 'Added'} teacher ${firstName} ${lastName}`
      );

      setShowModal(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving teacher:', err);
      setFormError(err.message || 'Failed to save teacher.');
    } finally {
      setSaving(false);
    }
  };

  const classesMap = new Map<string, SchoolClass>(classes.map((c) => [c.classId, c]));

  const filteredTeachers = teachers.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
    return fullName.includes(q) || t.phone.includes(q) || t.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Teaching Staff Directory</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {teachers.length} teachers and class instructors
          </p>
        </div>

        {role === 'ADMIN' && (
          <Button
            variant="primary"
            onClick={openAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add New Teacher
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by teacher name, phone, or email..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Teachers Grid/List */}
      <Card>
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading teaching staff...</div>
        ) : filteredTeachers.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No teachers found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTeachers.map((teacher) => (
              <div key={teacher.teacherId} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                      {teacher.firstName} {teacher.lastName}
                    </span>
                    {teacher.employeeId && (
                      <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {teacher.employeeId}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      teacher.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {teacher.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {teacher.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {teacher.email}
                    </span>
                  </div>

                  {/* Assigned classes & subjects */}
                  <div className="pt-1 flex flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-medium text-[11px]">Classes:</span>
                      {teacher.assignedClassIds?.length > 0 ? (
                        teacher.assignedClassIds.map((cid) => (
                          <span key={cid} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium text-[11px]">
                            {classesMap.get(cid)?.name || cid}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">None assigned</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      <span className="text-slate-400 font-medium text-[11px]">Subjects:</span>
                      {teacher.subjects?.length > 0 ? (
                        teacher.subjects.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">General</span>
                      )}
                    </div>
                  </div>
                </div>

                {role === 'ADMIN' && (
                  <div className="shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(teacher)}
                      leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                    >
                      Edit & Assign
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add / Edit Teacher Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTeacher ? 'Edit Teacher Record' : 'Register New Teacher'}
        subtitle="Manage teacher profile and classroom teaching assignments"
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="teacher-first-name"
              label="First Name *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="e.g. Blessing"
            />
            <Input
              id="teacher-last-name"
              label="Last Name *"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="e.g. Musa"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              id="teacher-phone"
              label="Phone Number *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="080XXXXXXXX"
            />
            <Input
              id="teacher-email"
              type="email"
              label="Email Address *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="teacher@school.ng"
            />
            <Input
              id="teacher-emp-id"
              label="Employee ID"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="EMP-001"
            />
          </div>

          <Select
            id="teacher-status"
            label="Employment Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            options={[
              { value: 'ACTIVE', label: 'Active Staff' },
              { value: 'INACTIVE', label: 'Inactive / On Leave' },
            ]}
          />

          {/* Assigned Classes Multi-check */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Assigned Classes
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
              {classes.map((cls) => {
                const isSelected = assignedClassIds.includes(cls.classId);
                return (
                  <label key={cls.classId} className="flex items-center gap-2 text-xs cursor-pointer p-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignedClassIds([...assignedClassIds, cls.classId]);
                        } else {
                          setAssignedClassIds(assignedClassIds.filter((id) => id !== cls.classId));
                        }
                      }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-800 font-medium">{cls.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Assigned Subjects Multi-check */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Teaching Subjects
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
              {subjects.map((sub) => {
                const isSelected = assignedSubjects.includes(sub.name);
                return (
                  <label key={sub.subjectId} className="flex items-center gap-2 text-xs cursor-pointer p-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignedSubjects([...assignedSubjects, sub.name]);
                        } else {
                          setAssignedSubjects(assignedSubjects.filter((name) => name !== sub.name));
                        }
                      }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-800 font-medium">{sub.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {editingTeacher ? 'Save Changes' : 'Add Teacher'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
