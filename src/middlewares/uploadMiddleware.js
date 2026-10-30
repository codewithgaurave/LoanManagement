const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Base uploads directory
const baseUploadDir = path.join(__dirname, '../../uploads');

/**
 * Categorize uploads into dedicated directory structures:
 * - Customer:
 *    - uploads/customer/profilepic/
 *    - uploads/customer/doc/
 * - Employee:
 *    - uploads/employee/profilepic/
 *    - uploads/employee/doc/
 */
const resolveSubdir = (req, file) => {
  const url = (req.originalUrl || req.baseUrl || req.url || '').toLowerCase();
  const field = (file.fieldname || '').toLowerCase();

  const isProfilePic = field.includes('avatar') || 
                       field.includes('photo') || 
                       field.includes('profile') || 
                       field === 'borrowerphoto' || 
                       field === 'guarantorphoto';

  // 1. Explicit Customer Routes
  if (url.includes('/users') || url.includes('/apply') || url.includes('customer')) {
    if (isProfilePic) {
      return 'customer/profilepic';
    }
    return 'customer/doc';
  }

  // 2. Explicit Employee & Admin Routes
  if (url.includes('/employees') || url.includes('/admin') || url.includes('/recruitment')) {
    if (isProfilePic) {
      return 'employee/profilepic';
    }
    return 'employee/doc';
  }

  // 3. Fallback based on field name or lead context
  if (isProfilePic) {
    if (field.includes('emp') || field.includes('staff')) {
      return 'employee/profilepic';
    }
    return 'customer/profilepic';
  }

  // Default documents
  return 'customer/doc';
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const subDir = resolveSubdir(req, file);
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
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit per file
});

module.exports = upload;
