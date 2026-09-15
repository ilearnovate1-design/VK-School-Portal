import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, setDoc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Parent, Student } from '../../types';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { Plus, Search, Edit2, Phone, Mail, MapPin, Users, HeartHandshake } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../utils/formatters';

export const ParentsPage: React.FC = () => {
  const { role, currentUser } = useAuth();
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit Parent Modal
  const [showModal, setShowModal] = useState(false);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('Mother');
  const [occupation, setOccupation] = useState('');
  const [address, setAddress] = useState('');
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const pSnap = await getDocs(collection(db, 'parents'));
      const pList: Parent[] = [];
      pSnap.forEach((d) => pList.push(d.data() as Parent));
      setParents(pList);

      const sSnap = await getDocs(collection(db, 'students'));
      const sList: Student[] = [];
      sSnap.forEach((d) => sList.push(d.data() as Student));
      setStudents(sList);
    } catch (err) {
      console.error('Error fetching parents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingParent(null);
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setRelationship('Mother');
    setOccupation('');
    setAddress('');
    setSelectedChildIds([]);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (parent: Parent) => {
    setEditingParent(parent);
    setFirstName(parent.firstName);
    setLastName(parent.lastName);
    setPhone(parent.phone);
    setEmail(parent.email);
    setRelationship(parent.relationship || 'Mother');
    setOccupation(parent.occupation || '');
    setAddress(parent.address || '');

    // find all students that currently have this parentId
    const linked = students
      .filter((s) => s.parentIds?.includes(parent.parentId))
      .map((s) => s.studentId);
    setSelectedChildIds(linked);
    setFormError('');
    setShowModal(true);
  };

  const handleSaveParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim()) {
      setFormError('First name, last name, phone and email are required.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const pId = editingParent?.parentId || `parent-${Date.now()}`;
      const parentDocRef = doc(db, 'parents', pId);

      const payload: any = {
        parentId: pId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        relationship,
        occupation: occupation.trim() || undefined,
        address: address.trim() || undefined,
        updatedAt: serverTimestamp(),
      };

      if (!editingParent) {
        payload.createdAt = serverTimestamp();
      }

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      await setDoc(parentDocRef, payload, { merge: true });

      // Link / unlink selected children
      for (const student of students) {
        const isSelected = selectedChildIds.includes(student.studentId);
        const currentParents = student.parentIds || [];
        const hasParent = currentParents.includes(pId);

        if (isSelected && !hasParent) {
          // link
          await updateDoc(doc(db, 'students', student.studentId), {
            parentIds: [...currentParents, pId],
            updatedAt: serverTimestamp(),
          });
        } else if (!isSelected && hasParent) {
          // unlink
          await updateDoc(doc(db, 'students', student.studentId), {
            parentIds: currentParents.filter((id) => id !== pId),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await logAudit(
        currentUser?.uid || 'admin',
        editingParent ? 'PARENT_UPDATED' : 'PARENT_CREATED',
        'parents',
        pId,
        `${editingParent ? 'Updated' : 'Added'} parent ${firstName} ${lastName}`
      );

      setShowModal(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving parent:', err);
      setFormError(err.message || 'Failed to save parent record.');
    } finally {
      setSaving(false);
    }
  };

  const filteredParents = parents.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(q) || p.phone.includes(q) || p.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Parent / Guardian Directory</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {parents.length} registered parents & guardians
          </p>
        </div>

        {role === 'ADMIN' && (
          <Button
            variant="primary"
            onClick={openAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add New Parent
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
            placeholder="Search by parent name, phone, or email..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Parents List */}
      <Card>
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading parents...</div>
        ) : filteredParents.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No parents found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredParents.map((parent) => {
              const linkedStudents = students.filter((s) => s.parentIds?.includes(parent.parentId));

              return (
                <div key={parent.parentId} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {parent.firstName} {parent.lastName}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                        {parent.relationship || 'Guardian'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {parent.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {parent.email}
                      </span>
                      {parent.occupation && (
                        <span className="text-slate-400">• {parent.occupation}</span>
                      )}
                    </div>

                    {/* Linked Children */}
                    <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-medium">Children:</span>
                      {linkedStudents.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">No pupils linked</span>
                      ) : (
                        linkedStudents.map((child) => (
                          <span
                            key={child.studentId}
                            className="inline-flex items-center text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                          >
                            {child.firstName} {child.lastName} ({child.admissionNumber})
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {role === 'ADMIN' && (
                    <div className="shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(parent)}
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      >
                        Edit & Link Children
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add / Edit Parent Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingParent ? 'Edit Parent & Link Pupils' : 'Add New Parent'}
        subtitle="Record guardian details and connect to children enrolled in school"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveParent} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="parent-first-name"
              label="First Name *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="e.g. Babajide"
            />
            <Input
              id="parent-last-name"
              label="Last Name *"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="e.g. Bello"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="parent-phone"
              label="Phone Number *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="080XXXXXXXX"
            />
            <Input
              id="parent-email"
              type="email"
              label="Email Address *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="parent@gmail.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              id="parent-relationship"
              label="Relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              options={[
                { value: 'Father', label: 'Father' },
                { value: 'Mother', label: 'Mother' },
                { value: 'Guardian', label: 'Legal Guardian' },
                { value: 'Aunt / Uncle', label: 'Aunt / Uncle' },
              ]}
            />
            <Input
              id="parent-occupation"
              label="Occupation"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              placeholder="e.g. Civil Engineer"
            />
          </div>

          <Input
            id="parent-address"
            label="Residential Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 7 Johnson Close, Ikeja"
          />

          {/* Link Children Checklist */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Link Enrolled Pupils (Support Multiple Children)
            </label>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1.5 bg-slate-50">
              {students.length === 0 ? (
                <p className="text-xs text-slate-400 p-2">No students registered yet.</p>
              ) : (
                students.map((st) => {
                  const isChecked = selectedChildIds.includes(st.studentId);
                  return (
                    <label
                      key={st.studentId}
                      className="flex items-center gap-2 p-2 rounded bg-white border border-slate-200/80 text-xs cursor-pointer hover:bg-emerald-50/50"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedChildIds([...selectedChildIds, st.studentId]);
                          } else {
                            setSelectedChildIds(selectedChildIds.filter((id) => id !== st.studentId));
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-slate-900">
                        {st.firstName} {st.lastName}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        ({st.admissionNumber})
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {editingParent ? 'Save Changes' : 'Add Parent'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
