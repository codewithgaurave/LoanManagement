const Notification = require('../models/Notification');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');
const LoanApplication = require('../models/LoanApplication');
const jwt = require('jsonwebtoken');
const { sendPushNotification, sendMulticastPushNotification } = require('../services/firebaseService');

// Helper to format friendly relative time
const formatTime = (dateInput) => {
  if (!dateInput) return 'Just Now';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 5) return 'Just Now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

const getNotificationGroup = (dateInput) => {
  if (!dateInput) return 'Today';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Today';
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays <= 7) return 'This Week';
  return 'Earlier';
};

const mapTypeToActionScreen = (type) => {
  switch (type) {
    case 'application': return 'PendingLoanDetailsScreen';
    case 'offer': return 'OfferDetailsScreen';
    case 'document': return 'AdditionalDocumentsScreen';
    case 'overdue': return 'UpcomingEmiScreen';
    case 'approval': return 'NachKycScreen';
    default: return 'AdminRemarksScreen';
  }
};

// @desc    Get all notifications (mostly for Superadmin)
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const adminId = req.user ? req.user._id : null;
    const filter = {
      isDeleted: { $ne: true },
      recipientEmpId: null, // Exclude employee specific notifications
      $or: [
        { recipientId: adminId },
        { recipientId: null, type: { $in: ['system', 'admin', 'broadcast', 'application', 'approval'] } }
      ]
    };

    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    notification.isRead = true;
    await notification.save();
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isDeleted: true });
    await Notification.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear all notifications
// @route   DELETE /api/notifications/clear-all
// @access  Private
const clearAllNotifications = async (req, res) => {
  try {
    await Notification.updateMany({}, { isDeleted: true });
    await Notification.deleteMany({});
    res.status(200).json({ success: true, message: 'All notifications cleared successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to create notification from anywhere in the backend
const createNotification = async (title, type = 'system', recipientId = null, detail = '') => {
  try {
    const notification = new Notification({
      title,
      detail: detail || title,
      type,
      recipientId
    });
    await notification.save();

    // Trigger FCM Push if recipient has an FCM token
    if (recipientId) {
      const user = await User.findById(recipientId);
      if (user && user.fcmToken) {
        sendPushNotification(user.fcmToken, {
          title: title,
          body: detail || title,
          data: { type, screen: mapTypeToActionScreen(type) }
        }).catch(err => console.error('FCM Push failed:', err));
      }
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
  }
};

// @desc    Send broadcast or targeted notification (all_employees, specific_employee, all_customers, specific_customer, all)
// @route   POST /api/notifications
// @access  Private (Admin / SuperAdmin)
const sendBroadcast = async (req, res) => {
  try {
    const { 
      title, 
      message, 
      detail,
      type = 'system', 
      targetAudience = 'all', 
      targetId = null,
      targetEmail = null,
      targetPhone = null
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Notification title is required' });
    }

    const notificationBody = message || detail || title;
    let pushTokens = [];
    const createdNotifications = [];

    // Map targetAudience to standard keys
    // supported: 'all', 'all_employees', 'employees', 'specific_employee', 'employee', 'all_customers', 'customers', 'specific_customer', 'customer'
    const cleanAudience = String(targetAudience).toLowerCase().trim();

    if (cleanAudience === 'specific_employee' || cleanAudience === 'employee') {
      // 1. Send to Single / Specific Employee
      let emp = null;
      if (targetId) {
        emp = await Employee.findOne({ 
          $or: [
            { _id: targetId.match(/^[0-9a-fA-F]{24}$/) ? targetId : null },
            { empId: targetId }
          ].filter(Boolean)
        });
        // Fallback: If targetId was an Admin ID from /api/admin/all, find matching Employee by Admin document
        if (!emp && targetId.match(/^[0-9a-fA-F]{24}$/)) {
          const adminDoc = await Admin.findById(targetId);
          if (adminDoc && adminDoc.email) {
            emp = await Employee.findOne({ email: adminDoc.email.toLowerCase() });
          }
        }
      }
      if (!emp && targetEmail) {
        emp = await Employee.findOne({ email: targetEmail.toLowerCase() });
      }
      if (!emp && targetPhone) {
        emp = await Employee.findOne({ mobile: targetPhone });
      }

      if (!emp) {
        return res.status(404).json({ success: false, message: 'Target employee not found' });
      }

      const notif = await Notification.create({
        title,
        detail: notificationBody,
        type: type || 'info',
        audience: 'specific_employee',
        recipientId: emp._id,
        recipientEmpId: emp.empId,
        customerName: emp.name,
        actionScreen: 'EmployeeDashboardScreen'
      });
      createdNotifications.push(notif);

      if (emp.fcmToken) {
        pushTokens.push(emp.fcmToken);
      }
    } else if (cleanAudience === 'specific_customer' || cleanAudience === 'customer') {
      // 2. Send to Single / Specific Customer
      let cust = null;
      if (targetId) {
        cust = await User.findOne({
          $or: [
            { _id: targetId.match(/^[0-9a-fA-F]{24}$/) ? targetId : null },
            { userId: targetId }
          ].filter(Boolean)
        });
      }
      if (!cust && targetEmail) {
        cust = await User.findOne({ email: targetEmail.toLowerCase() });
      }
      if (!cust && targetPhone) {
        cust = await User.findOne({ phone: targetPhone });
      }

      if (!cust) {
        return res.status(404).json({ success: false, message: 'Target customer not found' });
      }

      const notif = await Notification.create({
        title,
        detail: notificationBody,
        type: type || 'system',
        audience: 'specific_customer',
        recipientId: cust._id,
        recipientUserId: cust.userId,
        customerPhone: cust.phone,
        customerEmail: cust.email,
        customerName: cust.name,
        actionScreen: 'NotificationsScreen'
      });
      createdNotifications.push(notif);

      if (cust.fcmToken) {
        pushTokens.push(cust.fcmToken);
      }
    } else if (cleanAudience === 'all_employees' || cleanAudience === 'employees') {
      // 3. Send to All Employees
      const notif = await Notification.create({
        title,
        detail: notificationBody,
        type: type || 'info',
        audience: 'all_employees',
        recipientId: null,
        recipientEmpId: null,
        actionScreen: 'EmployeeDashboardScreen'
      });
      createdNotifications.push(notif);

      const empsWithTokens = await Employee.find({ fcmToken: { $exists: true, $ne: null, $nin: ['', 'null'] } }).select('fcmToken');
      empsWithTokens.forEach(e => {
        if (e.fcmToken) pushTokens.push(e.fcmToken);
      });
    } else if (cleanAudience === 'all_customers' || cleanAudience === 'customers') {
      // 4. Send to All Customers
      const notif = await Notification.create({
        title,
        detail: notificationBody,
        type: type || 'system',
        audience: 'all_customers',
        recipientId: null,
        actionScreen: 'NotificationsScreen'
      });
      createdNotifications.push(notif);

      const usersWithTokens = await User.find({ fcmToken: { $exists: true, $ne: null, $nin: ['', 'null'] } }).select('fcmToken');
      usersWithTokens.forEach(u => {
        if (u.fcmToken) pushTokens.push(u.fcmToken);
      });
    } else {
      // 5. Broadcast to Everyone (All Users & All Employees)
      const notif = await Notification.create({
        title,
        detail: notificationBody,
        type: type || 'system',
        audience: 'all',
        recipientId: null
      });
      createdNotifications.push(notif);

      const [empsWithTokens, usersWithTokens] = await Promise.all([
        Employee.find({ fcmToken: { $exists: true, $ne: null, $nin: ['', 'null'] } }).select('fcmToken'),
        User.find({ fcmToken: { $exists: true, $ne: null, $nin: ['', 'null'] } }).select('fcmToken')
      ]);

      empsWithTokens.forEach(e => { if (e.fcmToken) pushTokens.push(e.fcmToken); });
      usersWithTokens.forEach(u => { if (u.fcmToken) pushTokens.push(u.fcmToken); });
    }

    // Deduplicate FCM tokens
    pushTokens = Array.from(new Set(pushTokens.filter(t => t && typeof t === 'string' && t.trim().length > 10)));

    console.log(`[Notification Dispatch] Target: ${cleanAudience}, Tokens Found: ${pushTokens.length}`);

    // Trigger instant FCM Push notifications
    if (pushTokens.length === 1) {
      sendPushNotification(pushTokens[0], {
        title,
        body: notificationBody,
        data: {
          title,
          body: notificationBody,
          type: type || 'system',
          audience: cleanAudience,
          timestamp: new Date().toISOString()
        }
      }).catch(err => console.error('[FCM Single Dispatch] Error:', err.message));
    } else if (pushTokens.length > 1) {
      sendMulticastPushNotification(pushTokens, {
        title,
        body: notificationBody,
        data: {
          title,
          body: notificationBody,
          type: type || 'system',
          audience: cleanAudience,
          timestamp: new Date().toISOString()
        }
      }).catch(err => console.error('[FCM Multicast Dispatch] Error:', err.message));
    }

    return res.status(201).json({
      success: true,
      message: `Notification sent successfully to ${cleanAudience} (${pushTokens.length} device tokens notified)`,
      tokensNotifiedCount: pushTokens.length,
      notification: createdNotifications[0] || null
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dynamic customer notifications strictly tailored to the logged-in customer & their activities
// @route   GET /api/notifications/customer
// @access  Public / Customer
const getCustomerNotifications = async (req, res) => {
  try {
    let user = null;
    const phone = req.query.phone ? req.query.phone.trim() : '';
    const userId = req.query.userId ? req.query.userId.trim() : '';
    const email = req.query.email ? req.query.email.trim() : '';

    // 1. Try finding by query parameters
    if (phone) {
      user = await User.findOne({ phone });
    }
    if (!user && userId && userId !== 'NUOGCUST10001' && userId !== 'USR-00001') {
      user = await User.findOne({ userId });
    }
    if (!user && email) {
      user = await User.findOne({ email });
    }

    // 2. Try resolving via Bearer token
    if (!user && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        if (decoded.id) user = await User.findById(decoded.id);
        else if (decoded.userId) user = await User.findOne({ userId: decoded.userId });
        else if (decoded.phone) user = await User.findOne({ phone: decoded.phone });
      } catch (_) {}
    }

    // Fallback if still not found
    if (!user) {
      if (phone) user = await User.findOne({ phone });
      if (!user) user = await User.findOne({ status: 'Active' });
    }

    const notificationsList = [];

    if (user) {
      // A. Fetch direct Notification entries from MongoDB strictly matching this customer
      const directMatches = [
        { recipientId: user._id },
        { audience: 'all' },
        { audience: 'all_customers' }
      ];
      if (user.userId) directMatches.push({ recipientUserId: user.userId });
      if (user.phone) directMatches.push({ customerPhone: user.phone });
      if (user.email) directMatches.push({ customerEmail: user.email.toLowerCase() });
      if (user.name) directMatches.push({ customerName: user.name });

      const rawDbNotifs = await Notification.find({
        $or: directMatches
      }).sort({ createdAt: -1 }).limit(20);

      rawDbNotifs.forEach(n => {
        notificationsList.push({
          id: n._id.toString(),
          title: n.title,
          subtitle: n.detail || n.title,
          time: formatTime(n.createdAt),
          date: n.createdAt ? n.createdAt.toISOString() : new Date().toISOString(),
          type: n.type || 'system',
          group: getNotificationGroup(n.createdAt),
          isUnread: !n.isRead,
          isImportant: n.type === 'offer' || n.type === 'overdue' || n.type === 'application',
          actionScreen: n.actionScreen || mapTypeToActionScreen(n.type)
        });
      });

      // B. Fetch user's real Loan Applications from MongoDB & create activity notifications
      const userApplications = await LoanApplication.find({
        $or: [
          { mobile: user.phone },
          { email: user.email },
          { customer: user.name },
          { userId: user.userId }
        ].filter(cond => Object.values(cond)[0])
      }).sort({ createdAt: -1 });

      userApplications.forEach(app => {
        const appId = app.applicationId || 'APP-' + app._id.toString().slice(-6).toUpperCase();

        // 1. Sanctioned Offer Notification
        if (app.status === 'Approved' || app.trackingStatus >= 3) {
          notificationsList.push({
            id: `loan_offer_${app._id}`,
            title: 'Sanctioned Loan Offer Ready 🎉',
            subtitle: `Congratulations ${user.name}! Your ${app.loanType || 'Personal Loan'} of ₹ ${app.amount || '5,00,000'} has been sanctioned. Check details & accept now.`,
            time: formatTime(app.updatedAt || app.createdAt),
            date: (app.updatedAt || app.createdAt).toISOString(),
            type: 'offer',
            group: getNotificationGroup(app.updatedAt || app.createdAt),
            isUnread: true,
            isImportant: true,
            actionScreen: 'OfferDetailsScreen'
          });
        }

        // 2. Evaluation / Verification Notification
        if (app.trackingStatus === 2 || app.status === 'Under Review' || app.status === 'Pending') {
          notificationsList.push({
            id: `loan_eval_${app._id}`,
            title: 'Credit Evaluation in Progress',
            subtitle: `Your loan application ${appId} for ₹ ${app.amount} is currently being verified by our credit evaluation desk.`,
            time: formatTime(app.createdAt),
            date: app.createdAt.toISOString(),
            type: 'application',
            group: getNotificationGroup(app.createdAt),
            isUnread: true,
            isImportant: true,
            actionScreen: 'PendingLoanDetailsScreen'
          });
        }

        // 3. Document upload requirement
        if (app.trackingStatus === 4) {
          notificationsList.push({
            id: `doc_req_${app._id}`,
            title: 'Upload Additional Documents',
            subtitle: `Additional verification documents are required for application ${appId}. Please upload your latest bank statement.`,
            time: formatTime(app.updatedAt || app.createdAt),
            date: (app.updatedAt || app.createdAt).toISOString(),
            type: 'document',
            group: getNotificationGroup(app.updatedAt || app.createdAt),
            isUnread: true,
            isImportant: true,
            actionScreen: 'AdditionalDocumentsScreen'
          });
        }

        // 4. NACH & KYC requirement
        if (app.trackingStatus === 5) {
          notificationsList.push({
            id: `nach_kyc_${app._id}`,
            title: 'E-Sign Agreement & NACH Pending',
            subtitle: `Complete e-Sign & auto-debit NACH mandate for application ${appId} to proceed with disbursal.`,
            time: formatTime(app.updatedAt || app.createdAt),
            date: (app.updatedAt || app.createdAt).toISOString(),
            type: 'approval',
            group: getNotificationGroup(app.updatedAt || app.createdAt),
            isUnread: true,
            isImportant: true,
            actionScreen: 'NachKycScreen'
          });
        }

        // 5. Active Loan / EMI Schedule
        if (app.status === 'Disbursed' || (app.emiAmount && app.emiAmount > 0)) {
          notificationsList.push({
            id: `emi_due_${app._id}`,
            title: 'Upcoming Monthly EMI Reminder',
            subtitle: `Your Monthly EMI of ₹ ${app.emiAmount || '12,650'} for active loan is scheduled. Next due date: ${app.nextEmiDate || '10th of this month'}.`,
            time: formatTime(app.updatedAt || app.createdAt),
            date: (app.updatedAt || app.createdAt).toISOString(),
            type: 'overdue',
            group: getNotificationGroup(app.updatedAt || app.createdAt),
            isUnread: false,
            isImportant: true,
            actionScreen: 'UpcomingEmiScreen'
          });
        }
      });

      // C. Customer Support Enquiries / Complaints Updates
      const Complaint = require('../models/Complaint');
      const userComplaints = await Complaint.find({
        $or: [
          { phone: user.phone },
          { email: user.email },
          { userId: user.userId }
        ].filter(cond => Object.values(cond)[0])
      }).sort({ updatedAt: -1 }).limit(10);

      userComplaints.forEach(ticket => {
        const ticketId = ticket.complaintId || 'TKT-' + ticket._id.toString().slice(-4).toUpperCase();
        if (ticket.status === 'Resolved' || ticket.adminReply) {
          notificationsList.push({
            id: `ticket_reply_${ticket._id}`,
            title: `Enquiry Update: ${ticket.subject || ticketId}`,
            subtitle: ticket.adminReply 
              ? `Support Response: "${ticket.adminReply}"` 
              : `Your support enquiry [${ticketId}] has been resolved by our support team.`,
            time: formatTime(ticket.updatedAt || ticket.createdAt),
            date: (ticket.updatedAt || ticket.createdAt).toISOString(),
            type: 'info',
            group: getNotificationGroup(ticket.updatedAt || ticket.createdAt),
            isUnread: true,
            isImportant: true,
            actionScreen: 'CustomerSupportScreen'
          });
        }
      });

      // C. User Activities from MongoDB user.activities
      if (Array.isArray(user.activities) && user.activities.length > 0) {
        user.activities.forEach((act, idx) => {
          notificationsList.push({
            id: `act_${idx}_${act.title || idx}`,
            title: act.title || 'Account Activity',
            subtitle: act.description || act.title,
            time: act.date || 'Recent',
            date: new Date().toISOString(),
            type: act.type || 'system',
            group: 'Today',
            isUnread: false,
            isImportant: false,
            actionScreen: 'ApplicationTimelineScreen'
          });
        });
      }

      // D. User KYC Status notification
      if (user.kycStatus === 'Verified') {
        notificationsList.push({
          id: `kyc_verified_${user._id}`,
          title: 'KYC Verified Successfully',
          subtitle: `Congratulations ${user.name}! Your Aadhaar & PAN verification has been approved by the compliance team.`,
          time: '1 Day Ago',
          date: new Date(Date.now() - 86400000).toISOString(),
          type: 'approval',
          group: 'This Week',
          isUnread: false,
          isImportant: false,
          actionScreen: 'NachKycScreen'
        });
      } else {
        notificationsList.push({
          id: `kyc_pending_${user._id}`,
          title: 'Complete Your KYC Verification',
          subtitle: 'Please upload your PAN & Aadhaar details to unlock higher loan amounts and instant approvals.',
          time: 'Today',
          date: new Date().toISOString(),
          type: 'document',
          group: 'Today',
          isUnread: true,
          isImportant: true,
          actionScreen: 'NachKycScreen'
        });
      }

      // E. Welcome Registration Alert
      notificationsList.push({
        id: `welcome_${user._id}`,
        title: `Welcome to NUOGM Housing & Payments, ${user.name}!`,
        subtitle: 'Your customer account is active. Explore custom loan solutions and track applications in real-time.',
        time: user.registeredOn || 'Earlier',
        date: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
        type: 'system',
        group: 'This Week',
        isUnread: false,
        isImportant: false,
        actionScreen: null
      });
    }

    // Deduplicate notifications by ID
    const uniqueMap = new Map();
    notificationsList.forEach(item => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });
    const finalNotifications = Array.from(uniqueMap.values());

    res.status(200).json({
      success: true,
      unreadCount: finalNotifications.filter(n => n.isUnread).length,
      notifications: finalNotifications
    });
  } catch (error) {
    console.error('Error fetching customer notifications:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  deleteNotification,
  clearAllNotifications,
  createNotification,
  sendBroadcast,
  getCustomerNotifications
};

