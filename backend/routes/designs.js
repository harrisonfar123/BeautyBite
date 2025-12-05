import express from 'express';
import multer from 'multer';
import path from 'path';
import CustomDesign from '../models/CustomDesign.js';
import { authenticate, checkOwnership } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/octet-stream',
            'model/gltf-binary',
            'model/gltf+json',
            'application/json'
        ];

        if (allowedTypes.includes(file.mimetype) ||
            file.originalname.toLowerCase().endsWith('.glb') ||
            file.originalname.toLowerCase().endsWith('.gltf')) {
            cb(null, true);
        } else {
            cb(new Error('Only GLB and GLTF files are allowed'), false);
        }
    }
});

// All routes are protected
router.use(authenticate);

// @desc    Get user's designs
// @route   GET /api/designs
// @access  Private
router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const { status } = req.query;

        const designs = await CustomDesign.getByUser(req.user.id, {
            status,
            limit,
            skip
        });

        const total = await CustomDesign.countDocuments({ userId: req.user.id });

        res.status(200).json({
            success: true,
            count: designs.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            designs
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get single design
// @route   GET /api/designs/:id
// @access  Private
router.get('/:id', checkOwnership(CustomDesign), async (req, res, next) => {
    try {
        const design = await CustomDesign.findById(req.params.id)
            .populate('productId', 'name images pricing specifications')
            .populate('order', 'orderNumber status');

        res.status(200).json({
            success: true,
            design
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Create new design
// @route   POST /api/designs
// @access  Private
router.post('/', validateRequest('customDesign'), async (req, res, next) => {
    try {
        const { productId, name, description, specifications, notes, isPublic } = req.body;

        const design = await CustomDesign.create({
            userId: req.user.id,
            productId,
            name,
            description,
            designData: {
                specifications,
                notes
            },
            isPublic
        });

        res.status(201).json({
            success: true,
            design
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Update design
// @route   PUT /api/designs/:id
// @access  Private
router.put('/:id', checkOwnership(CustomDesign), validateRequest('customDesign'), async (req, res, next) => {
    try {
        const { name, description, specifications, notes, isPublic } = req.body;

        const design = await CustomDesign.findByIdAndUpdate(
            req.params.id,
            {
                name,
                description,
                'designData.specifications': specifications,
                'designData.notes': notes,
                isPublic
            },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            design
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Delete design
// @route   DELETE /api/designs/:id
// @access  Private
router.delete('/:id', checkOwnership(CustomDesign), async (req, res, next) => {
    try {
        await CustomDesign.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Design deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Upload design file
// @route   POST /api/designs/:id/upload
// @access  Private
router.post('/:id/upload', checkOwnership(CustomDesign), upload.single('designFile'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const design = await CustomDesign.findById(req.params.id);

        // Store file information
        design.designData.originalFile = {
            filename: req.file.originalname,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size
        };

        // Compress the design (placeholder implementation)
        await design.compressDesign();

        // Update status to submitted if it was a draft
        if (design.status === 'draft') {
            await design.updateStatus('submitted', 'Design file uploaded');
        }

        res.status(200).json({
            success: true,
            message: 'Design file uploaded successfully',
            design
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Duplicate design
// @route   POST /api/designs/:id/duplicate
// @access  Private
router.post('/:id/duplicate', checkOwnership(CustomDesign), async (req, res, next) => {
    try {
        const originalDesign = await CustomDesign.findById(req.params.id);

        // Create a copy without the _id and other auto-generated fields
        const designData = originalDesign.toObject();
        delete designData._id;
        delete designData.designId;
        delete designData.order;
        delete designData.statusHistory;
        delete designData.createdAt;
        delete designData.updatedAt;

        // Modify the name to indicate it's a copy
        designData.name = `${designData.name} (Copy)`;
        designData.status = 'draft';

        const newDesign = await CustomDesign.create(designData);

        res.status(201).json({
            success: true,
            design: newDesign
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Update design status
// @route   PUT /api/designs/:id/status
// @access  Private
router.put('/:id/status', checkOwnership(CustomDesign), async (req, res, next) => {
    try {
        const { status, notes } = req.body;

        const design = await CustomDesign.findById(req.params.id);

        await design.updateStatus(status, notes, req.user.id);

        res.status(200).json({
            success: true,
            design
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Render design preview
// @route   GET /api/designs/:id/render
// @access  Private
router.get('/:id/render', checkOwnership(CustomDesign), async (req, res, next) => {
    try {
        const design = await CustomDesign.findById(req.params.id);

        if (!design.designData.compressedDesign) {
            return res.status(400).json({
                success: false,
                error: 'No design file available for rendering'
            });
        }

        // In a real implementation, this would generate a preview image
        // For now, return a placeholder response
        res.status(200).json({
            success: true,
            message: 'Design render endpoint - preview generation would happen here',
            designId: design._id,
            status: 'rendering_queued'
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get design file
// @route   GET /api/designs/:id/file
// @access  Private
router.get('/:id/file', checkOwnership(CustomDesign), async (req, res, next) => {
    try {
        const design = await CustomDesign.findById(req.params.id);

        if (!design.designData.compressedDesign) {
            return res.status(404).json({
                success: false,
                error: 'Design file not found'
            });
        }

        // Set appropriate headers for file download
        res.setHeader('Content-Type', design.designData.originalFile.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${design.designData.originalFile.originalName}"`);
        res.setHeader('Content-Length', design.designData.compressedDesign.size);

        // Send the compressed design data
        // In a real implementation, you might want to decompress it first
        res.send(design.designData.compressedDesign.data);
    } catch (error) {
        next(error);
    }
});

// @desc    Create new version of design
// @route   POST /api/designs/:id/version
// @access  Private
router.post('/:id/version', checkOwnership(CustomDesign), async (req, res, next) => {
    try {
        const { notes } = req.body;

        const design = await CustomDesign.findById(req.params.id);
        await design.createVersion(notes);

        res.status(201).json({
            success: true,
            message: 'New version created successfully',
            design
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get public designs
// @route   GET /api/designs/public/featured
// @access  Public
router.get('/public/featured', async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        const skip = parseInt(req.query.skip) || 0;

        const designs = await CustomDesign.getPublicDesigns(limit, skip);

        res.status(200).json({
            success: true,
            count: designs.length,
            designs
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Like a design
// @route   POST /api/designs/:id/like
// @access  Private
router.post('/:id/like', authenticate, async (req, res, next) => {
    try {
        const design = await CustomDesign.findById(req.params.id);

        if (!design) {
            return res.status(404).json({
                success: false,
                error: 'Design not found'
            });
        }

        // Check if user already liked this design
        // This is a simplified implementation
        design.likeCount += 1;
        await design.save();

        res.status(200).json({
            success: true,
            message: 'Design liked successfully',
            likeCount: design.likeCount
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Share design with another user
// @route   POST /api/designs/:id/share
// @access  Private
router.post('/:id/share', checkOwnership(CustomDesign), async (req, res, next) => {
    try {
        const { userId, permission = 'view' } = req.body;

        const design = await CustomDesign.findById(req.params.id);

        // Check if already shared with this user
        const existingShare = design.sharedWith.find(
            share => share.user.toString() === userId
        );

        if (existingShare) {
            return res.status(400).json({
                success: false,
                error: 'Design already shared with this user'
            });
        }

        design.sharedWith.push({
            user: userId,
            permission
        });

        await design.save();

        res.status(200).json({
            success: true,
            message: 'Design shared successfully'
        });
    } catch (error) {
        next(error);
    }
});

export default router;