import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/super-admin';
import { paymentSettingsController } from '../controllers/payment-settings.controller';

const router = Router();

// === Admin: Bank Account CRUD ===
router.get('/banks', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.listBanks(req, res, next));
router.post('/banks', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.createBank(req, res, next));
router.patch('/banks/:id', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.updateBank(req, res, next));
router.delete('/banks/:id', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.deleteBank(req, res, next));

// === Admin: Midtrans Config ===
router.get('/midtrans', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.getMidtransConfig(req, res, next));
router.put('/midtrans', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.saveMidtransConfig(req, res, next));

// === Admin: Flip Config ===
router.get('/flip', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.getFlipConfig(req, res, next));
router.put('/flip', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.saveFlipConfig(req, res, next));

// === Public: Payment info (bank accounts + midtrans/flip status) — for tenant billing page ===
router.get('/public', authenticate,
  (req, res, next) => paymentSettingsController.getPublicPaymentInfo(req, res, next));

// === Admin: Follow-Up WA Template ===
router.get('/followup-template', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.getFollowUpTemplate(req, res, next));
router.put('/followup-template', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.saveFollowUpTemplate(req, res, next));

// === Admin: Verified WA Template ===
router.get('/verified-template', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.getVerifiedTemplate(req, res, next));
router.put('/verified-template', authenticate, requireSuperAdmin,
  (req, res, next) => paymentSettingsController.saveVerifiedTemplate(req, res, next));

export default router;
