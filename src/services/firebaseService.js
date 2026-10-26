const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;
let messaging = null;

try {
  const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    if (!admin.getApps().length) {
      admin.initializeApp({
        credential: admin.cert(serviceAccount)
      });
    }
    messaging = getMessaging();
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK & FCM initialized successfully');
  } else {
    console.warn('⚠️ Firebase Service Account file not found, push notifications will be skipped');
  }
} catch (err) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', err.message);
}

/**
 * Send FCM push notification to a specific device token
 */
const sendPushNotification = async (fcmToken, { title, body, data = {} }) => {
  if (!firebaseInitialized || !messaging || !fcmToken) {
    return { success: false, reason: 'Firebase not initialized or missing FCM token' };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: title || 'Notification',
        body: body || ''
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'high_importance_channel',
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public',
        }
      },
      data: Object.keys(data).reduce((acc, key) => {
        acc[key] = String(data[key]);
        return acc;
      }, {})
    };

    const response = await messaging.send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending FCM notification:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to multiple device tokens
 */
const sendMulticastPushNotification = async (tokens, { title, body, data = {} }) => {
  if (!firebaseInitialized || !messaging || !tokens || tokens.length === 0) {
    return { success: false, reason: 'Firebase not initialized or no tokens' };
  }

  try {
    const message = {
      tokens,
      notification: {
        title: title || 'Notification',
        body: body || ''
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'high_importance_channel',
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public',
        }
      },
      data: Object.keys(data).reduce((acc, key) => {
        acc[key] = String(data[key]);
        return acc;
      }, {})
    };

    const response = await messaging.sendEachForMulticast(message);
    return { success: true, successCount: response.successCount, failureCount: response.failureCount };
  } catch (error) {
    console.error('Error sending multicast FCM notification:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Dispatch Push Notification & DB Notification to targeted Employee or Customer
 */
const notifyEmployeeOrZone = async ({ empId, recipientId, zone, title, body, data = {} }) => {
  try {
    const Employee = require('../models/Employee');
    const Notification = require('../models/Notification');

    // 1. Create DB notification
    await Notification.create({
      title,
      detail: body || title,
      type: data.type || 'info',
      recipientEmpId: empId || null,
      recipientId: recipientId || null,
      zone: zone || null,
      leadId: data.leadId || null,
      customerName: data.customerName || null,
      actionScreen: data.actionScreen || null
    }).catch(e => console.warn('[NOTIF-DB] error:', e.message));

    // 2. Resolve FCM Tokens
    let tokens = [];
    if (empId) {
      const emp = await Employee.findOne({ empId });
      if (emp && emp.fcmToken) tokens.push(emp.fcmToken);
    } else if (recipientId) {
      const emp = await Employee.findById(recipientId);
      if (emp && emp.fcmToken) tokens.push(emp.fcmToken);
    } else if (zone && zone !== 'ALL') {
      const empsInZone = await Employee.find({ zone: zone.toUpperCase(), fcmToken: { $exists: true, $ne: '' } });
      tokens = empsInZone.map(e => e.fcmToken).filter(Boolean);
    }

    // 3. Send FCM Push
    if (tokens.length === 1) {
      await sendPushNotification(tokens[0], { title, body, data });
    } else if (tokens.length > 1) {
      await sendMulticastPushNotification(tokens, { title, body, data });
    }
  } catch (err) {
    console.error('[notifyEmployeeOrZone] error:', err.message);
  }
};

/**
 * Dispatch Push Notification & DB Notification to Customer
 */
const notifyCustomer = async ({ userId, phone, email, title, body, data = {} }) => {
  try {
    const User = require('../models/User');
    const Notification = require('../models/Notification');

    let user = null;
    if (userId) user = await User.findOne({ userId });
    if (!user && phone) user = await User.findOne({ phone });
    if (!user && email) user = await User.findOne({ email: email.toLowerCase() });

    // 1. Create DB notification
    await Notification.create({
      title,
      detail: body || title,
      type: data.type || 'application',
      recipientId: user ? user._id : null,
      customerPhone: phone || (user ? user.phone : null),
      customerEmail: email || (user ? user.email : null),
      customerName: user ? user.name : null,
      leadId: data.leadId || null,
      enquiryId: data.enquiryId || null,
      actionScreen: data.actionScreen || null
    }).catch(e => console.warn('[NOTIF-CUSTOMER-DB] error:', e.message));

    // 2. Send Push Notification if FCM token available
    if (user && user.fcmToken) {
      await sendPushNotification(user.fcmToken, { title, body, data });
    }
  } catch (err) {
    console.error('[notifyCustomer] error:', err.message);
  }
};

module.exports = {
  admin,
  firebaseInitialized: () => firebaseInitialized,
  sendPushNotification,
  sendMulticastPushNotification,
  notifyEmployeeOrZone,
  notifyCustomer
};
