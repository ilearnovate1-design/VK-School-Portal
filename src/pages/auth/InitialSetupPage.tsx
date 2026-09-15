import React, { useState } from 'react';
import { useSchool } from '../../contexts/SchoolContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Input';
import { School, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const InitialSetupPage: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { updateSettings, reloadSettings } = useSchool();
  const { currentUser } = useAuth();

  const [schoolName, setSchoolName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [session, setSession] = useState('2026/2027');
  const [term, setTerm] = useState('First Term');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSettings({
        schoolName,
        address,
        phone,
        email,
        currentAcademicSession: session,
        currentTerm: term,
      });

      await reloadSettings();
      onComplete();
    } catch (err) {
      console.error('Setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto w-full bg-white rounded-2xl shadow-lg border border-slate-200/90 p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white mx-auto flex items-center justify-center mb-3 shadow-xs">
            <School className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome. Configure Your School
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Enter your institution's official details and academic calendar session.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="setup-school-name"
            label="School Name"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            required
            placeholder="e.g. Gracefield Model College"
          />

          <Input
            id="setup-school-address"
            label="School Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="e.g. 14 Unity Road, Ikeja, Lagos State"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="setup-school-phone"
              label="Contact Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="0803XXXXXXX"
            />
            <Input
              id="setup-school-email"
              type="email"
              label="Official Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@school.edu.ng"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="setup-academic-session"
              label="Academic Session"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              required
              placeholder="e.g. 2026/2027"
            />
            <Select
              id="setup-academic-term"
              label="Current Term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              options={[
                { value: 'First Term', label: 'First Term' },
                { value: 'Second Term', label: 'Second Term' },
                { value: 'Third Term', label: 'Third Term' },
              ]}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full mt-4"
            isLoading={loading}
            leftIcon={<CheckCircle2 className="w-5 h-5" />}
          >
            Save & Enter School Portal
          </Button>
        </form>
      </div>
    </div>
  );
};
