import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, setDoc, deleteDoc, query, where, orderBy, serverTimestamp, limit
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Announcement, SchoolClass, AnnouncementAudience } from '../../types';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatTime, logAudit } from '../../utils/formatters';
import { broadcastAnnouncementNotifications } from '../../services/notificationService';
import { Megaphone, Plus, Trash2, Users, Bell } from 'lucide-react';

export const AnnouncementsPage: React.FC = () => {
  const { role, currentUser } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('ALL');
  const [classId, setClassId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const cSnap = await getDocs(collection(db, 'classes'));
      const cList: SchoolClass[] = [];
      cSnap.forEach((d) => cList.push(d.data() as SchoolClass));
      setClasses(cList);

      const aSnap = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50)));
      const aList: Announcement[] = [];
      aSnap.forEach((d) => aList.push(d.data() as Announcement));
      aList.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
        return timeB - timeA;
      });
      setAnnouncements(aList);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFormError('Please fill in title and notice message.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const aId = `ann-${Date.now()}`;
      const payload: any = {
        announcementId: aId,
        title: title.trim(),
        message: message.trim(),
        audience,
        classId: audience === 'CLASS_SPECIFIC' ? classId : undefined,
        postedBy: currentUser?.displayName || currentUser?.email || 'Administration',
        createdAt: serverTimestamp(),
      };

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      await setDoc(doc(db, 'announcements', aId), payload);

      await logAudit(
        currentUser?.uid || 'user',
        'ANNOUNCEMENT_POSTED',
        'announcements',
        aId,
        `Posted bulletin "${title}" to audience ${audience}`
      );
      
      // Dispatch in-app notifications to targeted users
      await broadcastAnnouncementNotifications(audience, title, message, audience === 'CLASS_SPECIFIC' ? classId : undefined);

      setShowModal(false);
      setTitle('');
      setMessage('');
      setAudience('ALL');
      await fetchData();
    } catch (err: any) {
      console.error('Error posting announcement:', err);
      setFormError(err.message || 'Failed to publish announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (annId: string) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', annId));
      await fetchData();
    } catch (err) {
      console.error('Error deleting announcement:', err);
    }
  };

  const classesMap = new Map<string, SchoolClass>(classes.map((c) => [c.classId, c]));

  // Role based filtering
  const visibleAnnouncements = announcements.filter((ann) => {
    if (role === 'ADMIN') return true;
    if (role === 'TEACHER') return ann.audience === 'ALL' || ann.audience === 'TEACHERS';
    if (role === 'PARENT') return ann.audience === 'ALL' || ann.audience === 'PARENTS';
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Announcements & School Bulletins
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Broadcast notices to parents, teachers, or the entire school community
          </p>
        </div>

        {role === 'ADMIN' && (
          <Button
            variant="primary"
            onClick={() => setShowModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Post Notice
          </Button>
        )}
      </div>

      <Card>
        <CardHeader
          title="School Notice Board"
          subtitle={`${visibleAnnouncements.length} official bulletins published`}
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading notices...</div>
          ) : visibleAnnouncements.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No bulletins posted at this time.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleAnnouncements.map((ann) => (
                <div key={ann.announcementId} className="p-5 flex flex-col sm:flex-row justify-between items-start gap-4 hover:bg-slate-50/50">
                  <div className="space-y-2 max-w-3xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {ann.audience === 'CLASS_SPECIFIC'
                          ? `Class: ${classesMap.get(ann.classId || '')?.name || 'Class'}`
                          : `Audience: ${ann.audience}`}
                      </span>
                      <span className="text-xs text-slate-400">
                        Posted by {ann.postedBy}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      {ann.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {ann.message}
                    </p>
                  </div>

                  {role === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(ann.announcementId)}
                      title="Delete Notice"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Post Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Broadcast Announcement"
        subtitle="Share important school dates, PTA meetings, and notices"
        maxWidth="md"
      >
        <form onSubmit={handlePost} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {formError}
            </div>
          )}

          <Input
            id="ann-title"
            label="Notice Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. End of Term PTA General Meeting"
          />

          <Select
            id="ann-audience"
            label="Target Audience *"
            value={audience}
            onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
            options={[
              { value: 'ALL', label: 'Entire School (Parents & Staff)' },
              { value: 'PARENTS', label: 'Parents / Guardians Only' },
              { value: 'TEACHERS', label: 'Teaching Staff Only' },
              { value: 'CLASS_SPECIFIC', label: 'Specific Class Arms' },
            ]}
          />

          {audience === 'CLASS_SPECIFIC' && (
            <Select
              id="ann-class"
              label="Select Target Class *"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              options={classes.map((c) => ({ value: c.classId, label: c.name }))}
            />
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notice Content *
            </label>
            <textarea
              id="ann-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              placeholder="e.g. This is to remind all parents that the 1st Term PTA General Meeting is scheduled for Saturday, 26th September at 10:00 AM prompt in the school hall..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Publish Announcement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
