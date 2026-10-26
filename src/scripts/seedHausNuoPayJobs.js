require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Job = require('../models/Job');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { execSync } = require('child_process');

const COMMON_COMPANY_FOOTER = `
Life at NUO-Pay:
Life So Good, you’d think We’re Kidding:
- Competitive Salaries. Period.
- An Extensive Medical Insurance that Looks Out for Our Employees & Their Dependents. We’ll Love You and Take Care of You, Our Promise.
- Flexible Working Hours. Just Don’t Call Us at 03:00 AM, We Like Our Sleep Schedule.
- Tailored Vacation & Leave Policies So that You Enjoy Every Important Moment in Your Life.
- A Reward System that Celebrates Hard Work and Milestones Throughout the Year. Expect a Gift Coming Your Way Anytime You Kill it Here.
- Learning and Upskilling Opportunities. Seriously, Not Kidding.
- Good Food, Games, and a Cool Office to Make You Feel Like Home. An Environment So Good, You’ll Forget the Term “Colleagues Can’t be Your Friends”.
- We Believe in Equality. Period.

At HAUS NUO-Pay, We are Committed to Building a Diverse and Talented Workforce. We Never Discriminate on the Basis of Race, Sex, Religion, Colour, National Origin, Gender, Gender Identity, Sexual Orientation, Age, Marital Status, Veteran Status, Medical Condition, Disability, or Any Other Class or Characteristic Protected by the Applicable law.
We Consider All Qualified Job-Seekers with Criminal Histories in a Manner Consistent with the Applicable Law. Additionally, We are Committed to Providing Reasonable Accommodations to Qualified Individuals with Physical or Mental Disabilities in Order to Participate in the Job Application or Interview Process, Perform Essential Job Functions, and Receive other Benefits and Privileges of Employment.

Come Join Our Crew!
About NUO-Pay: https://slice.bank.in/
HAUS NUO-Pay - A New Financial for a New India
HAUS NUO-Pay’s Purpose is to Make the World Better at Using Money and Time, with a Major Focus on Building the Best Consumer Experience for Your Money. We’ve All Felt How Slow, Confusing, and Complicated Financial Services Can be. So, We’re Reimagining it. We’re Building Every Product from Scratch to be Fast, Transparent, and Feel Good, Because We Believe that the Best Products Transcend Demographics, Like How Great Music Touches Most of Us.
Our Cornerstone Products and Services: HAUS NUO-Pay Loans, Insurance, Investment, and Grow Your Business are Designed to be Simple, Rewarding, and Completely in Your Control. At HAUS NUO-Pay, you’ll get to Build things You’d Use Yourself and Shape the Future of Financial Services in India. We Tailor Our Working Experience with the Belief that the Present Moment is the Only Real thing in Life. And We have Harmony in the Present the Most when We feel Happy and Successful Together.
We’re Backed by Some of the World’s Leading Investors, Including Tiger Global and Insight Partners.`.trim();

function generateFullDescription(roleTitle) {
  return `Join our rapidly growing team and shape the future of financial services.

About the Role:
As a ${roleTitle}, You will be Responsible for Acquiring and Managing Customer Relationships, Driving Financial Growth, and Ensuring High-quality Service Delivery. You will Work Closely with Branch Teams, Customers, and Internal Stakeholders to Meet Business Targets and Enhance Customer Satisfaction.

What you will do:
- Build and Manage a Portfolio of Retail Customers for Loans, Insurance, and Investment Products
- Drive Financial Acquisition and Achieve Assigned Business Targets
- Provide Personalized Financial Solutions Based on Customer Needs
- Maintain Strong Relationships with Customers and Act as the First Point of Contact for Queries
- Collaborate with Nearest Branch and Product Teams to Ensure Smooth Onboarding and Service Delivery
- Ensure Compliance with Regulatory Guidelines, Internal Policies, and Operational Standards
- Prepare Reports and MIS on Portfolio Growth, Customer Engagement, and Target Achievement

What You will Need:
- Bachelor’s Degree in any Discipline; Relevant Certifications in Banking/Finance are a Plus
- 2–5 Years of Experience in Retail Banking and Financial, Liability Sales, or Relationship Management
- Strong Interpersonal, Communication, and Customer Engagement Skills
- Knowledge of Deposit Products, Financial Operations, and Regulatory Guidelines
- Target-Oriented Mindset with Ability to Drive Results Independently
- Ability to Multitask, Solve Problems, and Work in a Fast-Paced Environment
- Proficiency in MS Office and Financial Systems

Additional Role Responsibilities:
- Good Communication in Hindi,English Purely sales guy in finance sector
- Understand the entire Loan process journey Field Visit Mandatory
- Good Negotiation skills Basic knowledge of Excel
- Primary & Key Responsibility is to Negotiate the Terms & Conditions of the Loan Details Shared with the Customers (ROI, Charges etc)
- Outbound Calling of About 200 -250 Calls Per Day to the Interested Customers
- To Ensure Conversion of the Loan Applications at the Highest Rates Possible.
- Ensure Loans are Processed as Per Established Company Procedures and Policies
- Process, Close, Present, Service and Record Loan Related Notes and Disbursements etc.
- Explaining Product Benefits to Customer and Informed Him in Detail All Benefits and Convince for Loan Processing.

${COMMON_COMPANY_FOOTER}`;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/loan_management');
  console.log('MongoDB Connected');

  let admin = await Admin.findOne({ role: { $regex: /superadmin|super admin/i } });
  if (!admin) {
    admin = await Admin.findOne({});
  }

  const token = jwt.sign(
    { id: admin._id, role: admin.role, email: admin.email },
    process.env.JWT_SECRET || 'your_jwt_secret_here',
    { expiresIn: '7d' }
  );

  console.log(`Generated Admin Token for ${admin.name}`);

  // List of major locations
  const locationsByDept = [
    { department: 'BRANCH SALES', location: 'Lucknow, UTTAR PRADESH' },
    { department: 'BRANCH SALES', location: 'Kanpur, UTTAR PRADESH' },
    { department: 'BRANCH SALES', location: 'Noida, DELHI-NCR' },
    { department: 'BRANCH SALES', location: 'New Delhi, DELHI-NCR' },
    { department: 'BRANCH SALES', location: 'Mumbai, MAHARASHTRA' },
    { department: 'BRANCH SALES', location: 'Pune, MAHARASHTRA' },
    { department: 'BRANCH SALES', location: 'Ahmedabad, GUJARAT' },
    { department: 'BRANCH SALES', location: 'Jaipur, RAJASTHAN' },
    { department: 'BRANCH SALES', location: 'Bengaluru, KARNATAKA' },
    { department: 'BRANCH SALES', location: 'Chennai, TAMIL NADU' },
    { department: 'BRANCH SALES', location: 'Hyderabad, TELANGANA' },
    { department: 'BRANCH SALES', location: 'Kolkata, WEST BENGAL' },
    { department: 'BRANCH SALES', location: 'Patna, BIHAR' },
    { department: 'BRANCH SALES', location: 'Ranchi, JHARKHAND' },
    { department: 'BRANCH SALES', location: 'Indore, MADHYA PRADESH' },
    { department: 'BRANCH SALES', location: 'Chandigarh, CHANDIGARH' },

    { department: 'FIELD-SALES', location: 'Lucknow, UTTAR PRADESH' },
    { department: 'FIELD-SALES', location: 'Varanasi, UTTAR PRADESH' },
    { department: 'FIELD-SALES', location: 'Agra, UTTAR PRADESH' },
    { department: 'FIELD-SALES', location: 'Gurugram, DELHI-NCR' },
    { department: 'FIELD-SALES', location: 'Surat, GUJARAT' },
    { department: 'FIELD-SALES', location: 'Nagpur, MAHARASHTRA' },
    { department: 'FIELD-SALES', location: 'Visakhapatnam, ANDHRA PRADESH' },
    { department: 'FIELD-SALES', location: 'Ludhiana, PUNJAB' },
    { department: 'FIELD-SALES', location: 'Raipur, CHHATTISGARH' },

    { department: 'OPERATIONAL', location: 'Lucknow, UTTAR PRADESH' },
    { department: 'OPERATIONAL', location: 'Noida, DELHI-NCR' },
    { department: 'OPERATIONAL', location: 'Mumbai, MAHARASHTRA' },
    { department: 'OPERATIONAL', location: 'Bengaluru, KARNATAKA' },
    { department: 'OPERATIONAL', location: 'Kolkata, WEST BENGAL' },
    { department: 'OPERATIONAL', location: 'Patna, BIHAR' },

    { department: 'COLLECTIONS', location: 'Lucknow, UTTAR PRADESH' },
    { department: 'COLLECTIONS', location: 'Delhi, DELHI-NCR' },
    { department: 'COLLECTIONS', location: 'Mumbai, MAHARASHTRA' },
    { department: 'COLLECTIONS', location: 'Hyderabad, TELANGANA' },
    { department: 'COLLECTIONS', location: 'Chennai, TAMIL NADU' },

    { department: 'OFFICIAL WORK', location: 'New Delhi, DELHI-NCR' },
    { department: 'OFFICIAL WORK', location: 'Bengaluru, KARNATAKA' },
    { department: 'OFFICIAL WORK', location: 'Lucknow, UTTAR PRADESH' },
    { department: 'OFFICIAL WORK', location: 'Kolkata, WEST BENGAL' }
  ];

  console.log('\n--- Seeding/Updating HAUS NUO-Pay Offer- Liability Jobs via cURL ---');

  const path = require('path');

  let addedCount = 0;
  for (let i = 0; i < locationsByDept.length; i++) {
    const item = locationsByDept[i];
    const uniqueFile = path.join(__dirname, `temp_job_${Date.now()}_${i}.json`);
    const jobPayload = {
      title: 'HAUS NUO-Pay Offer- Liability',
      type: 'Full Time',
      department: item.department,
      location: item.location,
      description: generateFullDescription('HAUS NUO-Pay Offer – Liability'),
      status: 'Open',
      publishStatus: 'Published',
      openings: 5,
      skills: 'Liability Sales, Relationship Management, Retail Banking, Customer Acquisition, Negotiation, Excel'
    };

    fs.writeFileSync(uniqueFile, JSON.stringify(jobPayload), 'utf8');

    try {
      const curlCmd = `curl.exe -s -X POST "http://localhost:5000/api/recruitment/jobs" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" --data-binary "@${path.basename(uniqueFile)}"`;
      const res = execSync(curlCmd, { encoding: 'utf8', cwd: __dirname });
      try {
        const parsed = JSON.parse(res);
        if (parsed.success || parsed._id || parsed.title || parsed.data) {
          process.stdout.write(`✔ Added: [${item.department}] ${item.location}\n`);
          addedCount++;
        } else {
          console.error(`✖ Response for ${item.location}:`, res);
        }
      } catch (parseErr) {
        console.error(`✖ Parse error for ${item.location}:`, res);
      }
    } catch (err) {
      console.error(`Error on ${item.location}:`, err.message);
    } finally {
      if (fs.existsSync(uniqueFile)) {
        try { fs.unlinkSync(uniqueFile); } catch(e) {}
      }
    }
  }

  // Also update any existing jobs to have the full standard format footer if not already present
  console.log('\n--- Updating all other existing jobs to contain standard HAUS NUO-Pay description & footer ---');
  const existingJobs = await Job.find({});
  let updatedCount = 0;
  for (const job of existingJobs) {
    if (!job.description.includes('Life at NUO-Pay:')) {
      const updatedDescription = `${job.description}\n\n${generateFullDescription(job.title)}`;
      job.description = updatedDescription;
      await job.save();
      updatedCount++;
    }
  }



  console.log(`\n=============================================`);
  console.log(`Total HAUS NUO-Pay Offer- Liability added: ${addedCount}`);
  console.log(`Total existing jobs updated with common description template: ${updatedCount}`);
  const totalLive = await Job.countDocuments({ status: 'Open' });
  console.log(`Total active live jobs in database: ${totalLive}`);
  console.log(`=============================================`);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
