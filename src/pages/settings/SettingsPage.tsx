import React, { useState, useEffect } from 'react';
import { useSchool } from '../../contexts/SchoolContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Term, SchoolSettings } from '../../types';
import { 
  CheckCircle2, 
  Save, 
  Database, 
  Download, 
  Trash2, 
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { logAudit } from '../../utils/formatters';
import { 
  getDatabaseStats, 
  purgeCollections, 
  generateTestRecords,
  exportSchoolDataBackup,
  CollectionStat 
} from '../../services/dataManagement';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useSchool();
  const { currentUser, role } = useAuth();

  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [email, setEmail] = useState(settings.email);
  const [currentAcademicSession, setCurrentAcademicSession] = useState(settings.currentAcademicSession);
  const [currentTerm, setCurrentTerm] = useState<Term>(settings.currentTerm);
  const [nextTermResumptionDate, setNextTermResumptionDate] = useState(settings.nextTermResumptionDate || '2026-09-21');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Database Management & Stats
  const [dbStats, setDbStats] = useState<CollectionStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Purge Modal
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmationText, setPurgeConfirmationText] = useState('');
  const [selectedCollectionsToPurge, setSelectedCollectionsToPurge] = useState<string[]>([
    'students', 'classes', 'teachers', 'parents', 'attendance', 'feeStructures', 'payments', 'results', 'assignments', 'announcements'
  ]);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeSuccessMessage, setPurgeSuccessMessage] = useState('');
  const [purgeErrorMessage, setPurgeErrorMessage] = useState('');

  // Regenerate Test Data Modal
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateProgress, setRegenerateProgress] = useState('');
  const [regenerateSuccessMessage, setRegenerateSuccessMessage] = useState('');
  const [regenerateErrorMessage, setRegenerateErrorMessage] = useState('');
  const [purgeFirst, setPurgeFirst] = useState(true);

  const loadStats = async () => {
    if (role !== 'ADMIN') return;
    setLoadingStats(true);
    try {
      const stats = await getDatabaseStats();
      setDbStats(stats);
    } catch (e) {
      console.error('Error loading db stats:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [role]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const payload: Partial<SchoolSettings> = {
        schoolName: schoolName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        currentAcademicSession: currentAcademicSession.trim(),
        currentTerm,
        nextTermResumptionDate,
        timeZone: 'Africa/Lagos',
        currency: 'NGN',
      };

      await updateSettings(payload);

      await logAudit(
        currentUser?.uid || 'admin',
        'SETTINGS_UPDATED',
        'schoolSettings',
        'default',
        `Updated school settings for ${schoolName}`
      );

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Error updating settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      await exportSchoolDataBackup();
    } catch (e) {
      console.error('Error exporting backup:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExecutePurge = async () => {
    if (purgeConfirmationText.trim().toUpperCase() !== 'PURGE') {
      setPurgeErrorMessage('Please type PURGE to confirm.');
      return;
    }

    setIsPurging(true);
    setPurgeErrorMessage('');
    setPurgeSuccessMessage('');

    try {
      const res = await purgeCollections(selectedCollectionsToPurge, currentUser?.uid || 'admin');
      setPurgeSuccessMessage(`Successfully wiped ${res.deletedCount} test records. Database reset to clean state.`);
      setPurgeConfirmationText('');
      await loadStats();
      setTimeout(() => {
        setShowPurgeModal(false);
        setPurgeSuccessMessage('');
      }, 2500);
    } catch (err: any) {
      setPurgeErrorMessage(err.message || 'Failed to purge records');
    } finally {
      setIsPurging(false);
    }
  };

  const togglePurgeCollection = (colName: string) => {
    if (selectedCollectionsToPurge.includes(colName)) {
      setSelectedCollectionsToPurge(selectedCollectionsToPurge.filter(c => c !== colName));
    } else {
      setSelectedCollectionsToPurge([...selectedCollectionsToPurge, colName]);
    }
  };

  const handleExecuteRegenerate = async () => {
    setIsRegenerating(true);
    setRegenerateProgress('Initializing demo records engine...');
    setRegenerateErrorMessage('');
    setRegenerateSuccessMessage('');

    try {
      const res = await generateTestRecords(currentUser?.uid || 'admin', {
        purgeFirst,
        onProgress: (msg) => setRegenerateProgress(msg),
      });
      setRegenerateSuccessMessage(`Successfully regenerated ${res.createdCount} realistic school records across all collections!`);
      await loadStats();
      setTimeout(() => {
        setShowRegenerateModal(false);
        setRegenerateSuccessMessage('');
        setRegenerateProgress('');
      }, 3000);
    } catch (err: any) {
      console.error('Error generating test records:', err);
      setRegenerateErrorMessage(err.message || 'Failed to generate test records');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          School Settings & Configuration
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Official Nigerian school profile, academic term cycles, and system database maintenance
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>School settings updated successfully.</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader
            title="Institutional Information"
            subtitle="Official identity shown on receipts, report cards, and communications"
          />
          <CardBody className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="settings-school-name"
                label="School Full Name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                disabled={role !== 'ADMIN'}
                required
                placeholder="e.g. Gracefield International College"
              />

              <Input
                id="settings-school-email"
                type="email"
                label="Administrative Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={role !== 'ADMIN'}
                required
                placeholder="admin@school.edu.ng"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="settings-school-phone"
                label="Contact Telephone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={role !== 'ADMIN'}
                placeholder="+234 803 123 4567"
              />

              <Input
                id="settings-school-address"
                label="Physical Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={role !== 'ADMIN'}
                required
                placeholder="e.g. Plot 15, Unity Crescent, Ikeja, Lagos"
              />
            </div>
          </CardBody>
        </Card>

        {/* Academic Calendar */}
        <Card>
          <CardHeader
            title="Academic Term & Session"
            subtitle="Current calendar active across student attendance, billing, and report cards"
          />
          <CardBody className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                id="settings-academic-session"
                label="Academic Session"
                value={currentAcademicSession}
                onChange={(e) => setCurrentAcademicSession(e.target.value)}
                disabled={role !== 'ADMIN'}
                required
                placeholder="e.g. 2026/2027"
              />

              <Select
                id="settings-academic-term"
                label="Current Term"
                value={currentTerm}
                onChange={(e) => setCurrentTerm(e.target.value as Term)}
                disabled={role !== 'ADMIN'}
                options={[
                  { value: 'First Term', label: 'First Term' },
                  { value: 'Second Term', label: 'Second Term' },
                  { value: 'Third Term', label: 'Third Term' },
                ]}
              />

              <Input
                id="settings-next-term-date"
                type="date"
                label="Next Term Resumption Date"
                value={nextTermResumptionDate}
                onChange={(e) => setNextTermResumptionDate(e.target.value)}
                disabled={role !== 'ADMIN'}
                placeholder="YYYY-MM-DD"
              />
            </div>
          </CardBody>
        </Card>

        {role === 'ADMIN' && (
          <div className="flex justify-end">
            <Button
              id="save-settings-btn"
              type="submit"
              size="lg"
              isLoading={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Configuration
            </Button>
          </div>
        )}
      </form>

      {/* Database Maintenance & Launch Readiness */}
      {role === 'ADMIN' && (
        <Card>
          <CardHeader
            title="System & Database Maintenance"
            subtitle="Database record statistics, complete JSON backups, and launch cleanup tools"
          />
          <CardBody className="p-6 space-y-6">
            {/* Live Database Statistics */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-700" />
                  <h4 className="text-sm font-bold text-slate-800">Current Database Records</h4>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={loadStats}
                  isLoading={loadingStats}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Refresh Counts
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {dbStats.map((stat) => (
                  <div 
                    key={stat.name}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl"
                  >
                    <span className="text-xs text-slate-500 block truncate">{stat.label}</span>
                    <span className="text-lg font-bold text-slate-900 mt-0.5 block">{stat.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-slate-900">Download School Data Backup</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Export complete JSON snapshot of classes, students, fees, results, and staff records for offline archiving.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleExportBackup}
                isLoading={isExporting}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Export Backup (JSON)
              </Button>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Regenerate Test Records & Demo Data
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Populate realistic Nigerian school demo records (Classes, Curriculum Subjects, Teachers, Parents, Students, Attendance logs, Fee structures, Payment receipts, Exam scores, and Homework).
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setRegenerateErrorMessage('');
                  setRegenerateSuccessMessage('');
                  setRegenerateProgress('');
                  setShowRegenerateModal(true);
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                Regenerate Test Records
              </Button>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-rose-900">Launch Readiness: Clear Test Records</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Used when preparing to launch the school. Allows purging dummy or test students, fee invoices, scores, and attendance so the school starts with a pristine database.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setPurgeConfirmationText('');
                  setPurgeErrorMessage('');
                  setPurgeSuccessMessage('');
                  setShowPurgeModal(true);
                }}
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
                leftIcon={<Trash2 className="w-4 h-4 text-rose-600" />}
              >
                Purge Test Records
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Regenerate Test Records Modal */}
      <Modal
        isOpen={showRegenerateModal}
        onClose={() => !isRegenerating && setShowRegenerateModal(false)}
        title="Regenerate School Test Records"
        subtitle="Seed realistic demo data for classes, curriculum, students, fees, scores, and homework"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
            <p className="font-bold text-sm text-emerald-950 flex items-center gap-1.5 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              Complete School Demonstration Dataset
            </p>
            <p className="text-xs text-emerald-800 leading-relaxed">
              This utility automatically seeds structured, authentic Nigerian school demo records across every module:
            </p>
            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-emerald-900 font-medium">
              <li className="flex items-center gap-1.5">✓ 6 Classes & Arms (Primary 1-5, JSS 1)</li>
              <li className="flex items-center gap-1.5">✓ 10 Curriculum Subjects (Maths, English, etc.)</li>
              <li className="flex items-center gap-1.5">✓ 3 Qualified Subject & Class Teachers</li>
              <li className="flex items-center gap-1.5">✓ 4 Parent profiles with phone contacts</li>
              <li className="flex items-center gap-1.5">✓ 8 Enrolled Pupils with admission IDs</li>
              <li className="flex items-center gap-1.5">✓ 24+ Attendance logs (Present / Late / Absent)</li>
              <li className="flex items-center gap-1.5">✓ 8 Tuition & Fee structures</li>
              <li className="flex items-center gap-1.5">✓ 5 Verified Payment Receipts</li>
              <li className="flex items-center gap-1.5">✓ 13 Published Terminal Exam Scores</li>
              <li className="flex items-center gap-1.5">✓ 3 Homework & 3 Pupil Submissions</li>
            </ul>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={purgeFirst}
                disabled={isRegenerating}
                onChange={(e) => setPurgeFirst(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-slate-900 block text-xs">
                  Clean existing test records before seeding (Recommended)
                </span>
                <span className="text-slate-500 text-[11px]">
                  Wipes prior test records from manageable collections first so you get an organized, duplication-free dataset. Admin accounts and school settings are safely preserved.
                </span>
              </div>
            </label>
          </div>

          {isRegenerating && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-700 shrink-0" />
              <div className="text-xs font-medium">
                {regenerateProgress || 'Processing test data generation...'}
              </div>
            </div>
          )}

          {regenerateErrorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {regenerateErrorMessage}
            </div>
          )}

          {regenerateSuccessMessage && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{regenerateSuccessMessage}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              disabled={isRegenerating}
              onClick={() => setShowRegenerateModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={isRegenerating}
              isLoading={isRegenerating}
              onClick={handleExecuteRegenerate}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              {isRegenerating ? 'Generating...' : 'Start Record Generation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Purge Test Data Confirmation Modal */}
      <Modal
        isOpen={showPurgeModal}
        onClose={() => !isPurging && setShowPurgeModal(false)}
        title="Purge Test Records for Launch"
        subtitle="Permanent cleanup of selected test records before real deployment"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Caution: Irreversible Action</p>
              <p className="mt-0.5">
                This will delete test records from the checked categories below. Your administrator account and institutional settings will NOT be deleted.
              </p>
            </div>
          </div>

          <div>
            <span className="font-semibold text-slate-800 block mb-2">Select Collections to Wipe:</span>
            <div className="grid grid-cols-2 gap-2">
              {dbStats.filter(s => s.canPurge).map((col) => (
                <label 
                  key={col.name}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCollectionsToPurge.includes(col.name)}
                    onChange={() => togglePurgeCollection(col.name)}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="truncate">{col.label} ({col.count})</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-800 block mb-1">
              Type <span className="font-mono text-rose-700 font-bold">PURGE</span> to confirm:
            </label>
            <Input
              id="purge-confirm-input"
              value={purgeConfirmationText}
              onChange={(e) => setPurgeConfirmationText(e.target.value)}
              placeholder="PURGE"
            />
          </div>

          {purgeErrorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {purgeErrorMessage}
            </div>
          )}

          {purgeSuccessMessage && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
              {purgeSuccessMessage}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              disabled={isPurging}
              onClick={() => setShowPurgeModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="button"
              disabled={purgeConfirmationText.trim().toUpperCase() !== 'PURGE' || isPurging || selectedCollectionsToPurge.length === 0}
              isLoading={isPurging}
              onClick={handleExecutePurge}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Confirm & Purge Selected
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
