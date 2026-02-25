import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/super-admin';
import { tenantGuard } from '../middleware/tenant';
import { adminInvoiceController } from '../controllers/admin-invoice.controller';

const router = Router();

// Multer for payment proof image upload — store in uploads/payment-proofs/
const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'payment-proofs');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `proof-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, name);
  },
});
const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPG, PNG, WEBP) yang diperbolehkan'));
    }
  },
});

// === Admin routes (SUPER_ADMIN only) ===
router.get('/admin', authenticate, requireSuperAdmin,
  (req, res, next) => adminInvoiceController.listAll(req, res, next));
router.get('/admin/:id', authenticate, requireSuperAdmin,
  (req, res, next) => adminInvoiceController.getById(req, res, next));
router.post('/admin', authenticate, requireSuperAdmin,
  (req, res, next) => adminInvoiceController.create(req, res, next));
router.patch('/admin/:id/verify', authenticate, requireSuperAdmin,
  (req, res, next) => adminInvoiceController.verifyPayment(req, res, next));
router.patch('/admin/:id/cancel', authenticate, requireSuperAdmin,
  (req, res, next) => adminInvoiceController.cancel(req, res, next));

// === Tenant routes (own organization) ===
router.get('/', authenticate, tenantGuard,
  (req, res, next) => adminInvoiceController.listOwn(req, res, next));
router.post('/request-upgrade', authenticate, tenantGuard,
  async (req, res, next) => {
    try {
      const { invoiceService } = await import('../services/invoice.service');
      const invoice = await invoiceService.requestUpgrade(
        req.user!.organizationId,
        req.body.plan_id,
        { userId: req.user!.userId, phone: req.body.phone },
      );
      res.status(201).json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  });
router.patch('/:id/proof', authenticate, tenantGuard, proofUpload.single('file'),
  (req, res, next) => {
    // Support both file upload and URL
    if ((req as any).file) {
      const file = (req as any).file as Express.Multer.File;
      req.body.payment_proof_url = `/uploads/payment-proofs/${file.filename}`;
    }
    adminInvoiceController.uploadProof(req, res, next);
  });
router.patch('/:id/cancel', authenticate, tenantGuard,
  async (req, res, next) => {
    try {
      const { invoiceService } = await import('../services/invoice.service');
      const invoice = await invoiceService.cancelOwn(
        req.params.id as string,
        req.user!.organizationId,
      );
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  });
router.patch('/:id/change-plan', authenticate, tenantGuard,
  async (req, res, next) => {
    try {
      const { invoiceService } = await import('../services/invoice.service');
      const invoice = await invoiceService.changePlan(
        req.params.id as string,
        req.user!.organizationId,
        req.body.plan_id,
      );
      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  });

export default router;
