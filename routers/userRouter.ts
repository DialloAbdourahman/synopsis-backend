import express from 'express';
const router = express.Router();

const { auth } = require('../middlewares/auth');

const {
  createAccount,
  login,
  updateAccount,
  deleteAccount,
  seeLoginHistory,
} = require('../controllers/userController');

router.post('/create_account', createAccount);
router.post('/login', login);
router.get('/login_history', auth, seeLoginHistory);
router.put('/update_account', auth, updateAccount);
router.delete('/delete_account', auth, deleteAccount);

module.exports = router;
