const express = require('express');
const router = express.Router();
const { 
  getNotifications, 
  markAsRead, 
  deleteNotification, 
  clearAllNotifications, 
  sendBroadcast, 
  getCustomerNotifications 
} = require('../controllers/notificationController');
const { protectAdmin, checkPermission } = require('../middlewares/authMiddleware');

const { sendPushNotification } = require('../services/firebaseService');

router.get('/customer', getCustomerNotifications);
router.get('/', protectAdmin, getNotifications);
router.post('/test-push', async (req, res) => {
  try {
    const { token, title, body, data } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM device token is required' });
    }
    const result = await sendPushNotification(token, {
      title: title || 'Test Push Notification',
      body: body || 'Hello from HAUS NUO-Pay Backend!',
      data: data || { type: 'test' }
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
router.post('/', protectAdmin, sendBroadcast);
router.put('/:id/read', protectAdmin, markAsRead);
router.delete('/clear-all', protectAdmin, clearAllNotifications);
router.delete('/:id', protectAdmin, deleteNotification);

module.exports = router;
