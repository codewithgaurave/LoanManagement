const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Base uploads directory
const baseUploadDir = path.join(__dirname, '../../uploads');

// Subdirectories mapped by field name category
const CATEGORY_SUBDIRS = {
  // Photos / Avatars
  profilePhoto: 'photos',
  avatar: 'photos',
  photo: 'photos',

  // Resumes
  resume: 'resumes',
  cv: 'resumes',

  // Identity / Gov ID documents
  aadhaar: 'documents/aadhaar',
  aadhar: 'documents/aadhaar',
  pan: 'documents/pan',

  // Education documents
  degree: 'documents/education',
  marksheet: 'documents/education',

  // Banking documents
  bankPassbook: 'documents/banking',
  cheque: 'documents/banking',

  // Experience / Job documents
  offerLetter: 'documents/experience',
  experienceLetter: 'documents/experience',
  relievingLetter: 'documents/experience',
  salarySlip: 'documents/salary_slips',
  coverLetter: 'documents/cover_letters',

  // Loan Documents
  loanDoc: 'loans/documents',
  borrowerPhoto: 'loans/photos',
  guarantorPhoto: 'loans/photos',
  itr: 'loans/financials',
  bankStatement: 'loans/financials'
};

const getTargetSubdir = (fieldname) => {
  if (!fieldname) return 'others';
  if (CATEGORY_SUBDIRS[fieldname]) return CATEGORY_SUBDIRS[fieldname];
  
  // Pattern matching fallbacks
  const lower = fieldname.toLowerCase();
  if (lower.includes('photo') || lower.includes('avatar') || lower.includes('image')) return 'photos';
  if (lower.includes('resume') || lower.includes('cv')) return 'resumes';
  if (lower.includes('salary')) return 'documents/salary_slips';
  if (lower.includes('letter')) return 'documents/letters';
  if (lower.includes('passbook') || lower.includes('bank')) return 'documents/banking';
  if (lower.includes('doc') || lower.includes('proof') || lower.includes('cert')) return 'documents/general';
  
  return 'others';
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const subDir = getTargetSubdir(file.fieldname);
    const targetFolder = path.join(baseUploadDir, subDir);

    // Ensure category subdirectory exists
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    // Attach relative category folder path to file object for DB url creation
    file.categorySubdir = subDir.replace(/\\/g, '/');
    cb(null, targetFolder);
  },
  filename: function (req, file, cb) {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + sanitizedName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit per file
});

module.exports = upload;
