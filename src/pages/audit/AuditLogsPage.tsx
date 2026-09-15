import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { AuditLog } from '../../types';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { formatDate, formatTime } from '../../utils/formatters';
import { ShieldCheck, Search, Filter, Clock } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'auditLogs'), limit(100))
      );
      const list: AuditLog[] = [];
      snap.forEach((d) => list.push({ ...d.data(), auditId: d.id } as AuditLog));
      // Sort by timestamp desc
      list.sort((a, b) => {
        const tA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
        const tB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
        return tB - tA;
      });
      setLogs(list);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        log.action.toLowerCase().includes(q) ||
        (log.description || '').toLowerCase().includes(q) ||
        (log.userId || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Security & Audit Trails
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Immutable audit records of all administrative modifications, financial payments, and score entries
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 sm:p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action, user ID, or detail..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-700"
          >
            <option value="ALL">All Actions</option>
            <option value="FEE_PAYMENT_RECORDED">FEE_PAYMENT_RECORDED</option>
            <option value="RESULTS_PUBLISHED">RESULTS_PUBLISHED</option>
            <option value="ATTENDANCE_RECORDED">ATTENDANCE_RECORDED</option>
            <option value="STUDENT_CREATED">STUDENT_CREATED</option>
            <option value="STUDENT_UPDATED">STUDENT_UPDATED</option>
            <option value="STUDENT_ARCHIVED">STUDENT_ARCHIVED</option>
            <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
            <option value="ANNOUNCEMENT_POSTED">ANNOUNCEMENT_POSTED</option>
          </select>
        </div>
      </div>

      <Card>
        <CardHeader
          title="System Audit Log History"
          subtitle={`${filteredLogs.length} events retrieved`}
          action={
            <Button size="sm" variant="outline" onClick={fetchLogs}>
              Refresh Logs
            </Button>
          }
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading audit trail...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No audit events matched your filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Collection</th>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => {
                    const dateObj = log.createdAt?.toDate ? log.createdAt.toDate() : new Date();
                    return (
                      <tr key={log.auditId || Math.random().toString()} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(dateObj)} {formatTime(dateObj)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">
                          {log.entityType || log.collectionName || '—'}
                        </td>
                        <td className="px-5 py-3 text-xs font-medium text-slate-800">
                          {log.userId}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600 max-w-xs truncate">
                          {log.description || log.details || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
