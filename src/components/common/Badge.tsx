import React from 'react';
import { AttendanceStatus, StudentStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'neutral' | 'info' | 'purple';
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
  size = 'md',
}) => {
  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200/80',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    info: 'bg-sky-50 text-sky-700 border border-sky-200/80',
    purple: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-md whitespace-nowrap ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export const AttendanceBadge: React.FC<{ status: AttendanceStatus | 'UNMARKED' }> = ({ status }) => {
  switch (status) {
    case 'PRESENT':
      return (
        <Badge variant="success">
          <span className="font-bold">✓</span> Present
        </Badge>
      );
    case 'ABSENT':
      return (
        <Badge variant="danger">
          <span className="font-bold">✕</span> Absent
        </Badge>
      );
    case 'LATE':
      return (
        <Badge variant="warning">
          <span className="font-bold">◷</span> Late
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral">
          <span>○</span> Unmarked
        </Badge>
      );
  }
};

export const StudentStatusBadge: React.FC<{ status: StudentStatus }> = ({ status }) => {
  switch (status) {
    case 'ACTIVE':
      return <Badge variant="success">Active</Badge>;
    case 'INACTIVE':
      return <Badge variant="danger">Inactive</Badge>;
    case 'GRADUATED':
      return <Badge variant="info">Graduated</Badge>;
    case 'TRANSFERRED':
      return <Badge variant="warning">Transferred</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};

export const PaymentStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'PAID':
      return <Badge variant="success">Fully Paid</Badge>;
    case 'PARTIAL':
      return <Badge variant="warning">Partially Paid</Badge>;
    case 'UNPAID':
      return <Badge variant="danger">Unpaid</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};

