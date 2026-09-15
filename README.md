# Nigerian School Management System (SMS) Portal

An enterprise-ready, mobile-first School Management & Bursary Portal designed specifically for Nigerian Primary and Secondary institutions (Nursery, Primary, JSS, and SSS). 

Built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Google Firebase** (Firestore & Authentication), this portal provides an end-to-end administration system that connects school leadership, educators, and parents.

---

## 🌟 Key Features

### 1. 🎓 Student Enrollment & Bulk Onboarding
- **Single & Bulk Registration**: Register individual pupils with passport photos, blood group, genotype, date of birth, and home address.
- **Bulk CSV / Spreadsheet Import**: Upload entire classroom cohorts in seconds via CSV/TSV file or direct copy-paste, featuring real-time validation, header mapping, and duplicate detection.
- **Parent & Guardian Linking**: Automatically attach parents to their wards via Nigerian telephone numbers or email addresses.

### 2. 🏫 Classroom Arms & Grade Hierarchy
- Supports Nigerian academic cycles: Creche, Nursery, Primary 1–6, JSS 1–3, and SSS 1–3 (Arts, Commercial, Science).
- Custom arm identifiers (e.g., *Primary 5 Gold*, *JSS 2 Diamond*).
- Class teacher assignments and arm-level statistics.

### 3. 📊 Terminal Examination & Continuous Assessment (CA)
- **Standard Nigerian Grading Scale**: 
  - 1st Continuous Assessment (20 marks)
  - 2nd Continuous Assessment (20 marks)
  - Terminal Examination (60 marks)
  - Automatic computation: Total (100%), Grade (A1, B2, B3, C4, C5, C6, D7, E8, F9), and automated teacher remarks.
- **Printable Terminal Report Cards**: Formal report sheet generation with school crest, student biodata, attendance record, grading breakdown, teacher comments, and principal sign-off.

### 4. 💰 School Fees, Bursary & Receipts
- **Custom Fee Tariffs**: Class-specific fee structures (Tuition, PTA levy, Computer laboratory, Exam fees, Development levy).
- **Payment Processing**: Record full and installment payments with auto-generated receipt serial numbers.
- **Debtors Roster & Tracking**: Real-time identification of outstanding fee balances per student and per classroom arm.

### 5. 📅 Attendance Register & Roll Call
- Fast, mobile-optimized daily morning roll call (Present, Late, Absent, Excused).
- Historical attendance tracking and automated percentage calculations for term report cards.

### 6. 📝 Homework & Assignments
- Teachers can publish assignments with subject categorizations, descriptions, and submission deadlines.
- Students and parents can review tasks and submit completed work online.

### 7. 📢 Announcements & Bulletins
- Targeted circulars and broadcast notices for administrative staff, teachers, or PTA / parents.

### 8. 🔒 Security, Audit Trails & Multi-Role Portals
- **Role-Based Access Control (RBAC)**:
  - **Administrator**: Full system authority, school profile configuration, staff provisioning, bursary tariffs, audit logs, and data management.
  - **Teacher**: Classroom attendance marking, Continuous Assessment entry, and homework distribution.
  - **Parent / Guardian**: Private portal showing only their registered children's attendance, term results, fees balance, and assignments.
- **Audit Logging**: Comprehensive chronological logging of security-critical actions (fee payments, result publications, settings updates).

### 9. 🗄️ System Maintenance & Backup
- **JSON Data Backup**: Instant export of all school records (students, results, payments, classes) for offline archival.
- **Launch Cleanup Tools**: Admin-controlled purge utility to clean test records and prepare the portal for active deployment.

---

## 🚀 Quick Start & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or later)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A [Firebase](https://firebase.google.com/) project with **Firestore** and **Firebase Authentication** (Email/Password) enabled.

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/school-management-system.git
cd school-management-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your Firebase project configuration:
```env
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-app-id"
```

*(Note: If running within an AI Studio applet, `firebase-applet-config.json` is automatically recognized).*

### 4. Deploy Firestore Security Rules
Ensure your Firestore security rules are applied from `firestore.rules`:
```bash
firebase deploy --only firestore:rules
```

### 5. Start Development Server
```bash
npm run dev
```
The portal will be available at `http://localhost:3000`.

---

## 🛠️ Production Build & Deployment

To create an optimized production build:
```bash
npm run build
```
The static assets will be output to the `dist/` directory, ready to be hosted on **Vercel**, **Netlify**, **Firebase Hosting**, **Cloud Run**, or **GitHub Pages**.

---

## 📋 First-Time School Setup Guide

1. Navigate to the login page and click **Register School Admin**.
2. Create the primary administrative account (Principal or Administrator).
3. Follow the initial wizard to set your school's official name, contact telephone, address, and current academic calendar session (e.g. `2026/2027 First Term`).
4. In the **Classes** section, create your classroom arms (e.g. Primary 1 Gold, JSS 1 Silver).
5. In the **Students** section, use the **Bulk Upload** button to import your students via CSV or Excel copy-paste.
6. In the **Teachers** and **Parents** sections, invite your educators and link guardians to their wards.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
