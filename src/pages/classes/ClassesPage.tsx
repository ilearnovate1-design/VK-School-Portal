import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, setDoc, serverTimestamp, query, where 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { SchoolClass, Teacher, Student } from '../../types';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { Plus, Edit2, Layers, Users, GraduationCap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { logAudit } from '../../utils/formatters';

export const ClassesPage: React.FC = () => {
  const { role, currentUser, currentTeacher } = useAuth();
  const { settings } = useSchool();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('Primary');
  const [section, setSection] = useState('Gold');
  const [classTeacherId, setClassTeacherId] = useState('');
  const [session, setSession] = useState(settings.currentAcademicSession || '2026/2027');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      let classesList: SchoolClass[] = [];

      if (role === 'TEACHER' && currentTeacher) {
        if (currentTeacher.assignedClassIds && currentTeacher.assignedClassIds.length > 0) {
          // If teacher has assigned classes, query them specifically
          const cSnap = await getDocs(
            query(collection(db, 'classes'), where('classId', 'in', currentTeacher.assignedClassIds))
          );
          cSnap.forEach((d) => classesList.push(d.data() as SchoolClass));
        }
      } else {
        // Admin or other roles get all classes
        const cSnap = await getDocs(collection(db, 'classes'));
        cSnap.forEach((d) => classesList.push(d.data() as SchoolClass));
      }
      setClasses(classesList);

      const tSnap = await getDocs(collection(db, 'teachers'));
      const tList: Teacher[] = [];
      tSnap.forEach((d) => tList.push(d.data() as Teacher));
      setTeachers(tList);

      const sSnap = await getDocs(collection(db, 'students'));
      const sList: Student[] = [];
      sSnap.forEach((d) => sList.push(d.data() as Student));
      setStudents(sList);
    } catch (err) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingClass(null);
    setName('');
    setLevel('Primary');
    setSection('Gold');
    setClassTeacherId('');
    setSession(settings.currentAcademicSession || '2026/2027');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (c: SchoolClass) => {
    setEditingClass(c);
    setName(c.name);
    setLevel(c.level || 'Primary');
    setSection(c.section || '');
    setClassTeacherId(c.classTeacherId || '');
    setSession(c.academicSession);
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Class name is required.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const cId = editingClass?.classId || `class-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      const classDocRef = doc(db, 'classes', cId);

      const payload: any = {
        classId: cId,
        name: name.trim(),
        level,
        section: section.trim() || undefined,
        classTeacherId: classTeacherId || undefined,
        academicSession: session,
        updatedAt: serverTimestamp(),
      };

      if (!editingClass) {
        payload.createdAt = serverTimestamp();
      }

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      await setDoc(classDocRef, payload, { merge: true });

      await logAudit(
        currentUser?.uid || 'admin',
        editingClass ? 'CLASS_UPDATED' : 'CLASS_CREATED',
        'classes',
        cId,
        `${editingClass ? 'Updated' : 'Created'} class ${name}`
      );

      setShowModal(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving class:', err);
      setFormError(err.message || 'Failed to save class.');
    } finally {
      setSaving(false);
    }
  };

  const teachersMap = new Map<string, Teacher>(teachers.map((t) => [t.teacherId, t]));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {role === 'ADMIN' ? 'Class Management' : 'My Assigned Classes'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {classes.length} {role === 'ADMIN' ? 'active classroom grades & arms' : 'classes assigned to you'}
          </p>
        </div>

        {role === 'ADMIN' && (
          <Button
            variant="primary"
            onClick={openAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create New Class
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading classes...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => {
            const classStudents = students.filter((s) => s.classId === cls.classId && s.status === 'ACTIVE');
            const teacher = cls.classTeacherId ? teachersMap.get(cls.classTeacherId) : null;

            return (
              <Card key={cls.classId} className="hover:border-emerald-600 transition-colors">
                <CardBody className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                        {cls.level || 'Class'} {cls.section ? `• ${cls.section}` : ''}
                      </span>
                      <span className="text-xs text-slate-400">{cls.academicSession}</span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mt-2">
                      {cls.name}
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      Class Teacher:{' '}
                      <span className="font-medium text-slate-800">
                        {teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unassigned'}
                      </span>
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Users className="w-4 h-4 text-emerald-700" />
                      <span className="font-semibold text-slate-900">{classStudents.length}</span> pupils enrolled
                    </div>

                    {role === 'ADMIN' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(cls)}
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Class Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingClass ? 'Edit Class' : 'Create New Class'}
        subtitle="Specify class name, level, section, and assign a class teacher"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {formError}
            </div>
          )}

          <Input
            id="class-name"
            label="Class Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Primary 5 or JSS 1"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              id="class-level"
              label="Education Level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              options={[
                { value: 'Creche / Nursery', label: 'Creche / Nursery' },
                { value: 'Primary', label: 'Primary' },
                { value: 'Junior Secondary (JSS)', label: 'Junior Secondary (JSS)' },
                { value: 'Senior Secondary (SSS)', label: 'Senior Secondary (SSS)' },
              ]}
            />
            <Input
              id="class-section"
              label="Section / Arm"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. Gold, Emerald, A, B"
            />
          </div>

          <Select
            id="class-teacher"
            label="Assigned Class Teacher"
            value={classTeacherId}
            onChange={(e) => setClassTeacherId(e.target.value)}
            options={[
              { value: '', label: '— Unassigned —' },
              ...teachers.map((t) => ({
                value: t.teacherId,
                label: `${t.firstName} ${t.lastName} (${t.phone})`,
              })),
            ]}
          />

          <Input
            id="class-session"
            label="Academic Session"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            required
            placeholder="2026/2027"
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {editingClass ? 'Save Changes' : 'Create Class'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
