export type UserRole = 'ADMIN' | 'TEACHER' | 'PARENT';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  active: boolean;
  parentId?: string;
  teacherId?: string;
  assignedClassIds?: string[];
  createdAt: any;
  updatedAt: any;
}

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED';

export interface Student {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth?: string; // YYYY-MM-DD
  classId: string;
  admissionDate: string; // YYYY-MM-DD
  photoUrl?: string;
  status: StudentStatus;
  parentIds: string[];
  parentEmails?: string[];
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Parent {
  parentId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address?: string;
  relationship?: string; // Father, Mother, Guardian
  occupation?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Teacher {
  teacherId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  employeeId?: string;
  assignedClassIds: string[];
  subjects: string[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: any;
  updatedAt: any;
}

export interface SchoolClass {
  classId: string;
  name: string; // e.g. "Primary 5"
  level?: string; // e.g. "Primary"
  section?: string; // e.g. "A" or "Gold"
  classTeacherId?: string;
  academicSession: string;
  createdAt: any;
  updatedAt: any;
}

export interface Subject {
  subjectId: string;
  name: string; // e.g. "Mathematics"
  code?: string; // e.g. "MTH"
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';
export type Term = '1st Term' | '2nd Term' | '3rd Term' | 'First Term' | 'Second Term' | 'Third Term' | string;

export interface AttendanceRecord {
  attendanceId: string; // YYYY-MM-DD_studentId
  studentId: string;
  classId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  timeIn?: any;
  timeOut?: any;
  markedBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface FeeStructure {
  feeStructureId: string;
  name?: string;
  classId: string;
  academicSession: string;
  term: string;
  feeType: string;
  amount: number;
  description?: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'POS' | 'OTHER';

export interface Payment {
  paymentId: string;
  receiptNumber?: string;
  studentId: string;
  classId?: string;
  amount: number;
  paymentDate: string; // YYYY-MM-DD
  term: string;
  academicSession: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  recordedBy: string;
  createdAt: any;
}

export interface Result {
  resultId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  teacherId?: string;
  academicSession: string;
  term: string;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  remark?: string;
  teacherComment?: string;
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: any;
  updatedAt: any;
}

export interface Assignment {
  assignmentId: string;
  title: string;
  description: string;
  classId: string;
  subjectId?: string;
  teacherId: string;
  dueDate: string; // YYYY-MM-DD
  attachmentUrl?: string;
  attachmentName?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  createdAt: any;
  updatedAt: any;
}

export interface Submission {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  answerText?: string;
  fileUrl?: string;
  fileName?: string;
  submittedAt?: any;
  status: 'NOT_SUBMITTED' | 'SUBMITTED' | 'GRADED';
  teacherComment?: string;
  score?: number;
  createdAt: any;
  updatedAt: any;
}

export type AudienceType = 'ALL' | 'TEACHERS' | 'PARENTS' | 'CLASS_SPECIFIC';
export type AnnouncementAudience = AudienceType;

export interface Announcement {
  announcementId: string;
  title: string;
  message: string;
  audience: AnnouncementAudience;
  classId?: string;
  postedBy?: string;
  publishedAt?: any;
  expiresAt?: any;
  createdBy?: string;
  createdAt: any;
}

export interface AppNotification {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: any;
}

export interface GradingScaleItem {
  min: number;
  max: number;
  grade: string;
  remark: string;
}

export interface SchoolSettings {
  schoolName: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  website?: string;
  currentAcademicSession: string; // e.g. "2026/2027"
  currentTerm: string; // e.g. "First Term"
  nextTermResumptionDate?: string;
  timeZone?: string;
  currency?: string;
  gradingScale: GradingScaleItem[];
  createdAt?: any;
  updatedAt?: any;
}

export interface AuditLog {
  auditId?: string;
  logId?: string;
  userId: string;
  action: string;
  entityType?: string;
  collectionName?: string;
  entityId?: string;
  documentId?: string;
  description?: string;
  details?: string;
  timestamp?: any;
  createdAt?: any;
}

