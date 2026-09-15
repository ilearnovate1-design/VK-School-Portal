import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, updateDoc, query, where, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Student, SchoolClass, Parent, StudentStatus } from '../../types';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { StudentStatusBadge } from '../../components/common/Badge';
import { AddEditStudentModal } from './AddEditStudentModal';
import { BulkUploadStudentsModal } from './BulkUploadStudentsModal';
import { StudentProfileModal } from './StudentProfileModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { 
  Plus, Upload, Search, Filter, Eye, Edit2, Archive, UserX, Phone, GraduationCap 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../utils/formatters';

export const StudentsPage: React.FC = () => {
  const { role, currentUser } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [studentToArchive, setStudentToArchive] = useState<Student | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Classes
      const cSnap = await getDocs(collection(db, 'classes'));
      const cList: SchoolClass[] = [];
      cSnap.forEach((d) => cList.push(d.data() as SchoolClass));
      setClasses(cList);

      // 2. Parents
      const pSnap = await getDocs(collection(db, 'parents'));
      const pList: Parent[] = [];
      pSnap.forEach((d) => pList.push(d.data() as Parent));
      setParents(pList);

      // 3. Students
      const sSnap = await getDocs(collection(db, 'students'));
      const sList: Student[] = [];
      sSnap.forEach((d) => sList.push(d.data() as Student));
      setStudents(sList);
    } catch (err) {
      console.error('Error fetching students page data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleArchiveStudent = async () => {
    if (!studentToArchive) return;
    setArchiveLoading(true);
    try {
      await updateDoc(doc(db, 'students', studentToArchive.studentId), {
        status: 'INACTIVE',
        updatedAt: serverTimestamp(),
      });
      await logAudit(
        currentUser?.uid || 'admin',
        'STUDENT_ARCHIVED',
        'students',
        studentToArchive.studentId,
        `Archived student ${studentToArchive.firstName} ${studentToArchive.lastName}`
      );
      setStudentToArchive(null);
      await fetchAllData();
    } catch (err) {
      console.error('Error archiving student:', err);
    } finally {
      setArchiveLoading(false);
    }
  };

  const parentsMap = new Map<string, Parent>(parents.map((p) => [p.parentId, p]));
  const classesMap = new Map<string, SchoolClass>(classes.map((c) => [c.classId, c]));

  // Filtering
  const filteredStudents = students.filter((s) => {
    // Status filter
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;

    // Class filter
    if (classFilter !== 'ALL' && s.classId !== classFilter) return false;

    // Search query (name, admission number, parent phone)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const fullName = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
      const adm = (s.admissionNumber || '').toLowerCase();
      const parentPhone = s.parentIds?.[0] ? (parentsMap.get(s.parentIds[0])?.phone || '').toLowerCase() : '';
      const emergencyPhone = (s.emergencyContactPhone || '').toLowerCase();

      return fullName.includes(q) || adm.includes(q) || parentPhone.includes(q) || emergencyPhone.includes(q);
    }

    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Student Directory</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Total {filteredStudents.length} of {students.length} pupils enrolled
          </p>
        </div>

        {role === 'ADMIN' && (
          <div className="flex items-center gap-2">
            <Button
              id="bulk-upload-student-btn"
              variant="outline"
              onClick={() => setShowBulkModal(true)}
              leftIcon={<Upload className="w-4 h-4 text-emerald-700" />}
              className="bg-white hover:bg-emerald-50 border-slate-200 text-slate-800"
            >
              Bulk Upload
            </Button>
            <Button
              id="add-student-btn"
              variant="primary"
              onClick={() => {
                setEditingStudent(null);
                setShowAddModal(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Enroll New Student
            </Button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 sm:p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="student-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, admission no, parent phone..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
          </div>

          {/* Class Filter */}
          <select
            id="student-class-filter"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-700"
          >
            <option value="ALL">All Classes</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            id="student-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-700"
          >
            <option value="ACTIVE">Status: Active</option>
            <option value="INACTIVE">Status: Inactive / Archived</option>
            <option value="GRADUATED">Status: Graduated</option>
            <option value="TRANSFERRED">Status: Transferred</option>
            <option value="ALL">All Statuses</option>
          </select>
        </div>
      </div>

      {/* Students List: Responsive Table / Mobile Cards */}
      <Card>
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Loading student records...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No pupils matched your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Admission No</th>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Parent / Contact</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => {
                  const p = student.parentIds?.[0] ? parentsMap.get(student.parentIds[0]) : null;
                  const c = classesMap.get(student.classId);

                  return (
                    <tr key={student.studentId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                            {student.firstName.charAt(0)}
                          </div>
                          <div>
                            <span>{student.firstName} {student.middleName || ''} {student.lastName}</span>
                            <span className="block text-[11px] text-slate-400 font-normal sm:hidden">
                              {student.admissionNumber}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">
                        {student.admissionNumber}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {c?.name || '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        {p ? (
                          <div>
                            <span className="font-semibold text-slate-800 block">{p.firstName} {p.lastName}</span>
                            <span className="text-slate-500">{p.phone}</span>
                          </div>
                        ) : student.emergencyContactPhone ? (
                          <span className="text-slate-500">{student.emergencyContactPhone}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unlinked</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StudentStatusBadge status={student.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingStudent(student)}
                            title="View Full Profile"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {role === 'ADMIN' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStudent(student);
                                  setShowAddModal(true);
                                }}
                                title="Edit Student"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {student.status === 'ACTIVE' && (
                                <button
                                  type="button"
                                  onClick={() => setStudentToArchive(student)}
                                  title="Archive Student (Soft Delete)"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Student Modal */}
      <AddEditStudentModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingStudent(null);
        }}
        student={editingStudent}
        onSuccess={fetchAllData}
      />

      {/* Bulk Upload Students Modal */}
      <BulkUploadStudentsModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        classes={classes}
        existingParents={parents}
        existingStudents={students}
        onSuccess={fetchAllData}
      />

      {/* Student Full Profile Modal */}
      <StudentProfileModal
        isOpen={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
        student={viewingStudent}
        onEdit={role === 'ADMIN' ? (s) => {
          setViewingStudent(null);
          setEditingStudent(s);
          setShowAddModal(true);
        } : undefined}
      />

      {/* Confirm Archive Student Dialog */}
      <ConfirmDialog
        isOpen={!!studentToArchive}
        onClose={() => setStudentToArchive(null)}
        onConfirm={handleArchiveStudent}
        title="Archive Student Record"
        message={`Are you sure you want to archive ${studentToArchive?.firstName} ${studentToArchive?.lastName}? Their historical attendance, results, and fee records will be preserved safely.`}
        confirmText="Archive Student"
        variant="danger"
        isLoading={archiveLoading}
      />
    </div>
  );
};
