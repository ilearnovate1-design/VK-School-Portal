import React, { useState, useEffect } from 'react';
import { 
  collection, doc, setDoc, getDocs, query, where, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Student, SchoolClass, Parent, StudentStatus } from '../../types';
import { logAudit } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

interface AddEditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: Student | null;
  onSuccess: () => void;
}

export const AddEditStudentModal: React.FC<AddEditStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);

  // Form State
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [classId, setClassId] = useState('');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<StudentStatus>('ACTIVE');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const cSnap = await getDocs(collection(db, 'classes'));
        const cList: SchoolClass[] = [];
        cSnap.forEach((d) => cList.push(d.data() as SchoolClass));
        setClasses(cList);
        if (!classId && cList.length > 0) setClassId(cList[0].classId);

        const pSnap = await getDocs(collection(db, 'parents'));
        const pList: Parent[] = [];
        pSnap.forEach((d) => pList.push(d.data() as Parent));
        setParents(pList);
        if (!selectedParentId && pList.length > 0) setSelectedParentId(pList[0].parentId);
      } catch (err) {
        console.error('Error fetching dropdowns:', err);
      }
    };

    if (isOpen) {
      fetchDropdowns();
    }
  }, [isOpen]);

  useEffect(() => {
    if (student) {
      setAdmissionNumber(student.admissionNumber || '');
      setFirstName(student.firstName || '');
      setMiddleName(student.middleName || '');
      setLastName(student.lastName || '');
      setGender(student.gender || 'Male');
      setDateOfBirth(student.dateOfBirth || '');
      setClassId(student.classId || '');
      setAdmissionDate(student.admissionDate || '');
      setStatus(student.status || 'ACTIVE');
      setSelectedParentId(student.parentIds?.[0] || '');
      setAddress(student.address || '');
      setEmergencyContactName(student.emergencyContactName || '');
      setEmergencyContactPhone(student.emergencyContactPhone || '');
      setNotes(student.notes || '');
      setPhotoUrl(student.photoUrl || '');
    } else {
      // Auto-generate next admission number
      const year = new Date().getFullYear();
      const randomId = Math.floor(100 + Math.random() * 900);
      setAdmissionNumber(`STU-${year}-${randomId}`);
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setGender('Male');
      setDateOfBirth('2018-05-15');
      setAdmissionDate(new Date().toISOString().split('T')[0]);
      setStatus('ACTIVE');
      setAddress('');
      setEmergencyContactName('');
      setEmergencyContactPhone('');
      setNotes('');
      setPhotoUrl('');
    }
    setError('');
  }, [student, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Student first and last names are required.');
      return;
    }
    if (!admissionNumber.trim()) {
      setError('Admission number is required.');
      return;
    }
    if (!classId) {
      setError('Please assign a class to the student.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Check duplicate admission number if creating new student
      if (!student) {
        const dupCheck = await getDocs(
          query(collection(db, 'students'), where('admissionNumber', '==', admissionNumber.trim()))
        );
        if (!dupCheck.empty) {
          setError('A student with this admission number already exists. Please use a unique number.');
          setLoading(false);
          return;
        }
      }

      const sId = student?.studentId || admissionNumber.trim().replace(/\s+/g, '-');
      const studentDocRef = doc(db, 'students', sId);

      const payload: any = {
        studentId: sId,
        admissionNumber: admissionNumber.trim(),
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        gender,
        dateOfBirth: dateOfBirth || undefined,
        classId,
        admissionDate,
        photoUrl: photoUrl.trim() || undefined,
        status,
        parentIds: selectedParentId ? [selectedParentId] : [],
        address: address.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        updatedAt: serverTimestamp(),
      };

      if (!student) {
        payload.createdAt = serverTimestamp();
      }
      
      // Remove undefined values to prevent Firestore error
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      await setDoc(studentDocRef, payload, { merge: true });

      await logAudit(
        currentUser?.uid || 'admin',
        student ? 'STUDENT_UPDATED' : 'STUDENT_CREATED',
        'students',
        sId,
        `${student ? 'Updated' : 'Enrolled'} student ${firstName} ${lastName} (${admissionNumber})`
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving student:', err);
      setError(err.message || 'Failed to save student record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={student ? 'Edit Student Record' : 'Enroll New Student'}
      subtitle="Fill in student academic and biographical details"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="student-admission-no"
            label="Admission Number *"
            value={admissionNumber}
            onChange={(e) => setAdmissionNumber(e.target.value)}
            required
            placeholder="e.g. STU-2026-001"
          />
          <Select
            id="student-class"
            label="Enrolled Class *"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            options={classes.map((c) => ({ value: c.classId, label: c.name }))}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="student-first-name"
            label="First Name *"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            placeholder="e.g. John"
          />
          <Input
            id="student-middle-name"
            label="Middle Name"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            placeholder="e.g. Adebayo"
          />
          <Input
            id="student-last-name"
            label="Last Name *"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            placeholder="e.g. Adeleke"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            id="student-gender"
            label="Gender *"
            value={gender}
            onChange={(e) => setGender(e.target.value as any)}
            options={[
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
            ]}
          />
          <Input
            id="student-dob"
            type="date"
            label="Date of Birth"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
          <Input
            id="student-admission-date"
            type="date"
            label="Admission Date"
            value={admissionDate}
            onChange={(e) => setAdmissionDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            id="student-parent"
            label="Linked Parent / Guardian"
            value={selectedParentId}
            onChange={(e) => setSelectedParentId(e.target.value)}
            options={[
              { value: '', label: '— Select or Link Later —' },
              ...parents.map((p) => ({
                value: p.parentId,
                label: `${p.firstName} ${p.lastName} (${p.phone})`,
              })),
            ]}
          />
          <Select
            id="student-status"
            label="Enrollment Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StudentStatus)}
            options={[
              { value: 'ACTIVE', label: 'Active Pupil' },
              { value: 'INACTIVE', label: 'Inactive / Archived' },
              { value: 'GRADUATED', label: 'Graduated' },
              { value: 'TRANSFERRED', label: 'Transferred' },
            ]}
          />
        </div>

        <Input
          id="student-address"
          label="Home Residential Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 14 Unity Road, Ikeja"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="student-emergency-name"
            label="Emergency Contact Name"
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            placeholder="e.g. Mrs. Jane Ade (Aunt)"
          />
          <Input
            id="student-emergency-phone"
            label="Emergency Contact Phone"
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            placeholder="080XXXXXXXX"
          />
        </div>

        <Input
          id="student-notes"
          label="Medical or Special Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Allergic to peanuts; wearing prescription eyeglasses"
        />

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            {student ? 'Save Changes' : 'Enroll Student'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
