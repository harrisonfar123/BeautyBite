import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const designSpecificationSchema = new mongoose.Schema({
    material: {
        type: String,
        required: [true, 'Material is required'],
        trim: true
    },
    materialGrade: {
        type: String,
        enum: ['standard', 'premium', 'medical_grade', 'food_grade', 'surgical_grade'],
        default: 'standard'
    },
    thickness: {
        value: {
            type: Number,
            required: true,
            min: 0
        },
        unit: {
            type: String,
            enum: ['mm', 'cm', 'inch'],
            default: 'mm'
        },
        tolerance: {
            type: Number,
            default: 0.1
        }
    },
    color: {
        name: String,
        hexCode: String,
        pantone: String,
        finish: {
            type: String,
            enum: ['matte', 'glossy', 'satin', 'textured'],
            default: 'matte'
        }
    },
    dimensions: {
        length: {
            type: Number,
            min: 0
        },
        width: {
            type: Number,
            min: 0
        },
        height: {
            type: Number,
            min: 0
        },
        unit: {
            type: String,
            enum: ['mm', 'cm', 'inch'],
            default: 'mm'
        },
        tolerance: {
            type: Number,
            default: 0.1
        }
    },
    weight: {
        value: {
            type: Number,
            min: 0
        },
        unit: {
            type: String,
            enum: ['g', 'kg', 'oz', 'lb'],
            default: 'g'
        }
    },
    customizations: {
        text: [{
            content: String,
            font: String,
            size: Number,
            position: {
                x: Number,
                y: Number,
                z: Number
            },
            color: String
        }],
        images: [{
            url: String,
            position: {
                x: Number,
                y: Number,
                z: Number
            },
            scale: Number,
            rotation: Number
        }],
        modifications: mongoose.Schema.Types.Mixed
    },
    physicalProperties: {
        density: Number,
        hardness: String,
        flexibility: {
            type: String,
            enum: ['rigid', 'semi_flexible', 'flexible', 'very_flexible']
        },
        temperatureResistance: {
            min: Number,
            max: Number,
            unit: { type: String, default: 'celsius' }
        }
    },
    safetyStandards: [String],
    certifications: [{
        name: String,
        authority: String,
        certificateNumber: String
    }]
}, {
    _id: false
});

const fileInfoSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true,
        min: 0
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    checksum: String,
    storageLocation: {
        type: String,
        enum: ['local', 's3', 'cloud_storage', 'cdn'],
        default: 'local'
    },
    bucket: String,
    key: String
}, {
    _id: false
});

const compressionInfoSchema = new mongoose.Schema({
    originalSize: {
        type: Number,
        required: true,
        min: 0
    },
    compressedSize: {
        type: Number,
        required: true,
        min: 0
    },
    compressionRatio: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    algorithm: {
        type: String,
        enum: ['deflate', 'gzip', 'lz4', 'zstd', 'brotli'],
        default: 'deflate'
    },
    quality: {
        type: Number,
        min: 0,
        max: 100,
        default: 85
    },
    compressionTime: Number // milliseconds
}, {
    _id: false
});

const renderingInfoSchema = new mongoose.Schema({
    resolution: {
        width: Number,
        height: Number
    },
    format: {
        type: String,
        enum: ['jpg', 'png', 'webp', 'gif', 'svg'],
        default: 'png'
    },
    quality: {
        type: Number,
        min: 0,
        max: 100,
        default: 90
    },
    backgroundColor: String,
    lighting: {
        type: String,
        enum: ['natural', 'studio', 'ambient', 'custom'],
        default: 'studio'
    },
    cameraAngle: {
        type: String,
        enum: ['front', 'back', 'left', 'right', 'top', 'bottom', 'isometric'],
        default: 'isometric'
    },
    renderTime: Number // milliseconds
}, {
    _id: false
});

const versionHistorySchema = new mongoose.Schema({
    version: {
        type: Number,
        required: true
    },
    designData: mongoose.Schema.Types.Mixed,
    specifications: designSpecificationSchema,
    previewImages: [String],
    savedAt: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        maxlength: 500
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    changeType: {
        type: String,
        enum: ['create', 'update', 'restore', 'auto_save'],
        default: 'update'
    },
    fileSize: Number,
    compressionRatio: Number
}, {
    _id: true
});

const sharingPermissionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    permission: {
        type: String,
        enum: ['view', 'edit', 'comment', 'download'],
        default: 'view'
    },
    sharedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: Date,
    sharedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: {
        type: String,
        maxlength: 200
    }
}, {
    _id: true
});

const approvalWorkflowSchema = new mongoose.Schema({
    step: {
        type: Number,
        required: true,
        min: 1
    },
    name: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'needs_revision'],
        default: 'pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    notes: {
        type: String,
        maxlength: 1000
    },
    required: {
        type: Boolean,
        default: true
    },
    autoApprove: {
        type: Boolean,
        default: false
    }
}, {
    _id: false
});

const productionDetailsSchema = new mongoose.Schema({
    startDate: Date,
    completionDate: Date,
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    productionNotes: {
        type: String,
        maxlength: 2000
    },
    machine: {
        type: String,
        enum: ['3d_printer', 'cnc', 'laser_cutter', 'injection_molding', 'manual'],
        default: '3d_printer'
    },
    materialUsed: {
        type: String,
        trim: true
    },
    materialBatch: String,
    productionTime: Number, // minutes
    qualityMetrics: {
        dimensionalAccuracy: Number, // percentage
        surfaceFinish: {
            type: String,
            enum: ['excellent', 'good', 'fair', 'poor']
        },
        structuralIntegrity: {
            type: String,
            enum: ['excellent', 'good', 'fair', 'poor']
        }
    },
    issues: [{
        description: String,
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical']
        },
        resolved: { type: Boolean, default: false },
        resolvedAt: Date,
        resolutionNotes: String
    }]
}, {
    _id: false
});

const customDesignSchema = new mongoose.Schema({
    designId: {
        type: String,
        unique: true,
        default: () => `DESIGN_${uuidv4().substring(0, 8).toUpperCase()}`,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product ID is required'],
        index: true
    },
    name: {
        type: String,
        required: [true, 'Design name is required'],
        trim: true,
        maxlength: [100, 'Design name cannot exceed 100 characters']
    },
    description: {
        type: String,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    designData: {
        originalFile: fileInfoSchema,
        processedFiles: [{
            type: {
                type: String,
                enum: ['stl', 'obj', 'step', 'iges', 'fbx'],
                required: true
            },
            file: fileInfoSchema,
            processingTime: Number,
            errors: [String],
            warnings: [String]
        }],
        compressedDesign: {
            data: Buffer,
            size: Number,
            compressionInfo: compressionInfoSchema
        },
        previewImages: [{
            url: String,
            size: {
                width: Number,
                height: Number
            },
            format: {
                type: String,
                enum: ['jpg', 'png', 'webp', 'gif'],
                default: 'png'
            },
            renderingInfo: renderingInfoSchema,
            generatedAt: {
                type: Date,
                default: Date.now
            },
            isPrimary: { type: Boolean, default: false }
        }],
        specifications: designSpecificationSchema,
        notes: {
            type: String,
            maxlength: [2000, 'Notes cannot exceed 2000 characters']
        },
        customOptions: mongoose.Schema.Types.Mixed,
        metadata: {
            vertexCount: Number,
            faceCount: Number,
            volume: Number,
            boundingBox: {
                min: { x: Number, y: Number, z: Number },
                max: { x: Number, y: Number, z: Number }
            },
            units: {
                type: String,
                enum: ['mm', 'cm', 'inch'],
                default: 'mm'
            }
        }
    },
    status: {
        type: String,
        enum: {
            values: [
                'draft',
                'submitted',
                'under_review',
                'needs_revision',
                'approved',
                'rejected',
                'queued_for_production',
                'in_production',
                'quality_check',
                'completed',
                'cancelled',
                'archived'
            ],
            message: '{VALUE} is not a valid design status'
        },
        default: 'draft',
        index: true
    },
    statusHistory: [{
        status: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        notes: {
            type: String,
            maxlength: 500
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        system: { type: Boolean, default: false }
    }],
    approvalWorkflow: [approvalWorkflowSchema],
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        sparse: true,
        index: true
    },
    pricing: {
        basePrice: {
            type: Number,
            min: 0
        },
        customizationFee: {
            type: Number,
            default: 0,
            min: 0
        },
        complexityFee: {
            type: Number,
            default: 0,
            min: 0
        },
        rushFee: {
            type: Number,
            default: 0,
            min: 0
        },
        totalPrice: {
            type: Number,
            min: 0
        },
        currency: {
            type: String,
            default: 'USD',
            enum: ['USD', 'EUR', 'GBP', 'CAD']
        },
        costBreakdown: mongoose.Schema.Types.Mixed
    },
    estimatedProductionTime: {
        min: {
            type: Number,
            default: 3,
            min: 0
        }, // days
        max: {
            type: Number,
            default: 7,
            min: 0
        }  // days
    },
    productionDetails: productionDetailsSchema,
    qualityCheck: {
        passed: Boolean,
        checkedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        checkedAt: Date,
        notes: {
            type: String,
            maxlength: 1000
        },
        issues: [{
            description: String,
            severity: {
                type: String,
                enum: ['minor', 'moderate', 'major', 'critical']
            },
            image: String,
            resolved: { type: Boolean, default: false },
            resolution: String
        }],
        metrics: {
            dimensionalAccuracy: Number, // percentage
            weightAccuracy: Number, // percentage
            surfaceQuality: {
                type: String,
                enum: ['excellent', 'good', 'fair', 'poor']
            },
            fit: {
                type: String,
                enum: ['perfect', 'good', 'tight', 'loose']
            }
        }
    },
    tags: [{
        name: String,
        type: {
            type: String,
            enum: ['material', 'purpose', 'complexity', 'custom'],
            default: 'custom'
        }
    }],
    privacy: {
        isPublic: {
            type: Boolean,
            default: false
        },
        visibility: {
            type: String,
            enum: ['private', 'shared', 'public', 'unlisted'],
            default: 'private'
        },
        allowDownload: {
            type: Boolean,
            default: false
        },
        allowRemix: {
            type: Boolean,
            default: false
        },
        watermark: {
            enabled: { type: Boolean, default: true },
            text: String,
            position: {
                type: String,
                enum: ['top_left', 'top_right', 'bottom_left', 'bottom_right', 'center'],
                default: 'bottom_right'
            }
        }
    },
    analytics: {
        viewCount: {
            type: Number,
            default: 0
        },
        likeCount: {
            type: Number,
            default: 0
        },
        downloadCount: {
            type: Number,
            default: 0
        },
        remixCount: {
            type: Number,
            default: 0
        },
        lastViewed: Date,
        popularScore: {
            type: Number,
            default: 0
        }
    },
    sharedWith: [sharingPermissionSchema],
    version: {
        current: {
            type: Number,
            default: 1
        },
        history: [versionHistorySchema],
        autoSave: {
            enabled: { type: Boolean, default: true },
            interval: { type: Number, default: 300 } // seconds
        }
    },
    audit: {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        ipAddress: String,
        userAgent: String,
        source: {
            type: String,
            enum: ['web', 'mobile', 'api', 'import'],
            default: 'web'
        }
    },
    metadata: {
        complexity: {
            type: String,
            enum: ['simple', 'moderate', 'complex', 'very_complex'],
            default: 'simple'
        },
        printability: {
            type: String,
            enum: ['easy', 'moderate', 'difficult', 'expert'],
            default: 'easy'
        },
        estimatedPrintTime: Number, // minutes
        materialUsage: Number, // grams or ml
        supportRequired: { type: Boolean, default: false },
        orientation: {
            type: String,
            enum: ['landscape', 'portrait', 'custom'],
            default: 'landscape'
        }
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            // Remove sensitive data
            delete ret.designData.compressedDesign;
            delete ret.audit;
            delete ret.version.history;
            return ret;
        }
    },
    toObject: {
        virtuals: true
    }
});

// Compound indexes for better query performance
customDesignSchema.index({ userId: 1, status: 1 });
customDesignSchema.index({ productId: 1, status: 1 });
customDesignSchema.index({ status: 1, createdAt: -1 });
customDesignSchema.index({ 'privacy.visibility': 1, 'analytics.popularScore': -1 });
customDesignSchema.index({ 'designData.originalFile.mimeType': 1 });
customDesignSchema.index({ 'metadata.complexity': 1, status: 1 });
customDesignSchema.index({ 'tags.name': 1 });
customDesignSchema.index({ createdAt: -1 });
customDesignSchema.index({ 'analytics.popularScore': -1 });

// Text search index
customDesignSchema.index({
    name: 'text',
    description: 'text',
    'tags.name': 'text'
});

// Virtual for compression ratio
customDesignSchema.virtual('compressionRatio').get(function () {
    if (!this.designData.compressedDesign || !this.designData.originalFile) return 0;
    const original = this.designData.originalFile.size;
    const compressed = this.designData.compressedDesign.size;
    return ((original - compressed) / original) * 100;
});

// Virtual for design file URL (if stored externally)
customDesignSchema.virtual('designFileUrl').get(function () {
    if (this.designData.originalFile && this.designData.originalFile.filename) {
        return `/api/designs/${this._id}/file`;
    }
    return null;
});

// Virtual for estimated completion date
customDesignSchema.virtual('estimatedCompletionDate').get(function () {
    if (this.status === 'in_production' && this.productionDetails.startDate) {
        const completion = new Date(this.productionDetails.startDate);
        completion.setDate(completion.getDate() + this.estimatedProductionTime.max);
        return completion;
    }
    return null;
});

// Virtual for days in current status
customDesignSchema.virtual('daysInCurrentStatus').get(function () {
    if (this.statusHistory.length === 0) return 0;

    const currentStatus = this.statusHistory[this.statusHistory.length - 1];
    const now = new Date();
    const statusDate = new Date(currentStatus.timestamp);
    return Math.floor((now - statusDate) / (1000 * 60 * 60 * 24));
});

// Virtual for isOverdue
customDesignSchema.virtual('isOverdue').get(function () {
    if (this.status === 'completed' || this.status === 'cancelled') return false;

    const expectedDays = this.estimatedProductionTime.max;
    const actualDays = this.daysInCurrentStatus;

    return actualDays > expectedDays;
});

// Virtual for canBeEdited
customDesignSchema.virtual('canBeEdited').get(function () {
    const editableStatuses = ['draft', 'needs_revision'];
    return editableStatuses.includes(this.status);
});

// Virtual for primary preview image
customDesignSchema.virtual('primaryPreview').get(function () {
    const primary = this.designData.previewImages.find(img => img.isPrimary);
    return primary || this.designData.previewImages[0];
});

// Pre-save middleware to initialize status history
customDesignSchema.pre('save', function (next) {
    if (this.isNew) {
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date(),
            system: true,
            notes: 'Design created'
        });
    }
    next();
});

// Pre-save middleware to update popular score
customDesignSchema.pre('save', function (next) {
    this.analytics.popularScore =
        (this.analytics.viewCount * 1) +
        (this.analytics.likeCount * 5) +
        (this.analytics.downloadCount * 10) +
        (this.analytics.remixCount * 15);
    next();
});

// Method to update status with history
customDesignSchema.methods.updateStatus = function (newStatus, notes = '', changedBy = null, system = false) {
    const oldStatus = this.status;
    this.status = newStatus;

    this.statusHistory.push({
        status: newStatus,
        notes: notes || `Status changed from ${oldStatus} to ${newStatus}`,
        changedBy,
        timestamp: new Date(),
        system
    });

    return this.save();
};

// Method to add approval workflow step
customDesignSchema.methods.addApprovalStep = function (stepName, required = true, autoApprove = false) {
    const stepNumber = this.approvalWorkflow.length + 1;
    this.approvalWorkflow.push({
        step: stepNumber,
        name: stepName,
        required,
        autoApprove
    });
    return this.save();
};

// Method to approve workflow step
customDesignSchema.methods.approveStep = function (stepNumber, approvedBy, notes = '') {
    const step = this.approvalWorkflow.find(s => s.step === stepNumber);
    if (step) {
        step.status = 'approved';
        step.approvedBy = approvedBy;
        step.approvedAt = new Date();
        step.notes = notes;
    }
    return this.save();
};

// Method to share design with user
customDesignSchema.methods.shareWithUser = function (userId, permission = 'view', expiresAt = null, sharedBy = null, notes = '') {
    // Remove existing sharing for this user
    this.sharedWith = this.sharedWith.filter(share => share.user.toString() !== userId.toString());

    this.sharedWith.push({
        user: userId,
        permission,
        expiresAt,
        sharedBy: sharedBy || this.userId,
        notes
    });

    return this.save();
};

// Method to revoke sharing
customDesignSchema.methods.revokeSharing = function (userId) {
    this.sharedWith = this.sharedWith.filter(share => share.user.toString() !== userId.toString());
    return this.save();
};

// Method to check user permissions
customDesignSchema.methods.hasPermission = function (userId, requiredPermission) {
    // Owner has all permissions
    if (this.userId.toString() === userId.toString()) {
        return true;
    }

    // Check shared permissions
    const share = this.sharedWith.find(s => s.user.toString() === userId.toString());
    if (!share) return false;

    // Check if permission has expired
    if (share.expiresAt && new Date() > share.expiresAt) {
        return false;
    }

    // Check permission hierarchy
    const permissionHierarchy = ['view', 'comment', 'download', 'edit'];
    const userPermissionLevel = permissionHierarchy.indexOf(share.permission);
    const requiredPermissionLevel = permissionHierarchy.indexOf(requiredPermission);

    return userPermissionLevel >= requiredPermissionLevel;
};

// Method to compress design data (placeholder for actual compression logic)
customDesignSchema.methods.compressDesign = async function () {
    if (!this.designData.originalFile) {
        throw new Error('No original file to compress');
    }

    // Placeholder for actual compression logic
    // In a real implementation, this would use a compression library
    const originalSize = this.designData.originalFile.size;
    const compressedSize = Math.round(originalSize * 0.6); // 40% compression
    const startTime = Date.now();

    this.designData.compressedDesign = {
        data: Buffer.from('compressed_data_placeholder'), // Replace with actual compressed data
        size: compressedSize,
        compressionInfo: {
            originalSize,
            compressedSize,
            compressionRatio: ((originalSize - compressedSize) / originalSize) * 100,
            algorithm: 'deflate',
            quality: 85,
            compressionTime: Date.now() - startTime
        }
    };

    return this.save();
};

// Method to create a new version
customDesignSchema.methods.createVersion = function (notes = '', changedBy = null, changeType = 'update') {
    this.version.history.push({
        version: this.version.current,
        designData: JSON.parse(JSON.stringify(this.designData)),
        specifications: JSON.parse(JSON.stringify(this.designData.specifications)),
        previewImages: this.designData.previewImages.map(img => img.url),
        savedAt: new Date(),
        notes,
        changedBy,
        changeType,
        fileSize: this.designData.originalFile.size,
        compressionRatio: this.compressionRatio
    });

    this.version.current += 1;
    return this.save();
};

// Method to restore a previous version
customDesignSchema.methods.restoreVersion = function (versionNumber) {
    const version = this.version.history.find(v => v.version === versionNumber);
    if (!version) {
        throw new Error(`Version ${versionNumber} not found`);
    }

    this.designData = JSON.parse(JSON.stringify(version.designData));
    this.designData.specifications = version.specifications;
    this.createVersion(`Restored from version ${versionNumber}`, null, 'restore');
    return this.save();
};

// Method to generate preview images
customDesignSchema.methods.generatePreview = function (renderingOptions = {}) {
    // Placeholder for actual rendering logic
    // In a real implementation, this would use a 3D rendering service
    const preview = {
        url: `/api/designs/${this._id}/preview/${Date.now()}.png`,
        size: {
            width: renderingOptions.width || 800,
            height: renderingOptions.height || 600
        },
        format: renderingOptions.format || 'png',
        renderingInfo: {
            resolution: {
                width: renderingOptions.width || 800,
                height: renderingOptions.height || 600
            },
            format: renderingOptions.format || 'png',
            quality: renderingOptions.quality || 90,
            backgroundColor: renderingOptions.backgroundColor || '#ffffff',
            lighting: renderingOptions.lighting || 'studio',
            cameraAngle: renderingOptions.cameraAngle || 'isometric',
            renderTime: 0 // Would be set by actual rendering process
        },
        generatedAt: new Date(),
        isPrimary: this.designData.previewImages.length === 0
    };

    this.designData.previewImages.push(preview);
    return this.save();
};

// Method to start production
customDesignSchema.methods.startProduction = function (assignedTo = null, machine = '3d_printer') {
    this.status = 'in_production';
    this.productionDetails.startDate = new Date();
    this.productionDetails.assignedTo = assignedTo;
    this.productionDetails.machine = machine;

    this.statusHistory.push({
        status: 'in_production',
        notes: 'Production started',
        timestamp: new Date(),
        system: true
    });

    return this.save();
};

// Method to complete production
customDesignSchema.methods.completeProduction = function (productionNotes = '', materialUsed = '') {
    this.status = 'quality_check';
    this.productionDetails.completionDate = new Date();
    this.productionDetails.productionNotes = productionNotes;
    this.productionDetails.materialUsed = materialUsed;

    // Calculate production time in minutes
    if (this.productionDetails.startDate) {
        const start = new Date(this.productionDetails.startDate);
        const end = new Date();
        this.productionDetails.productionTime = Math.round((end - start) / (1000 * 60));
    }

    this.statusHistory.push({
        status: 'quality_check',
        notes: 'Production completed, awaiting quality check',
        timestamp: new Date(),
        system: true
    });

    return this.save();
};

// Method to pass quality check
customDesignSchema.methods.passQualityCheck = function (checkedBy, metrics = {}, notes = '') {
    this.status = 'completed';
    this.qualityCheck.passed = true;
    this.qualityCheck.checkedBy = checkedBy;
    this.qualityCheck.checkedAt = new Date();
    this.qualityCheck.notes = notes;
    this.qualityCheck.metrics = metrics;

    this.statusHistory.push({
        status: 'completed',
        notes: 'Quality check passed',
        timestamp: new Date(),
        system: true
    });

    return this.save();
};

// Method to increment view count
customDesignSchema.methods.incrementViewCount = function () {
    this.analytics.viewCount += 1;
    this.analytics.lastViewed = new Date();
    return this.save();
};

// Method to like design
customDesignSchema.methods.like = function () {
    this.analytics.likeCount += 1;
    return this.save();
};

// Method to unlike design
customDesignSchema.methods.unlike = function () {
    this.analytics.likeCount = Math.max(0, this.analytics.likeCount - 1);
    return this.save();
};

// Static method to get designs by user
customDesignSchema.statics.getByUser = function (userId, options = {}) {
    const { status, limit = 20, skip = 0, includeShared = false } = options;

    let query = { userId };

    if (includeShared) {
        query = {
            $or: [
                { userId },
                { 'sharedWith.user': userId }
            ]
        };
    }

    if (status) query.status = status;

    return this.find(query)
        .populate('productId', 'name images pricing')
        .populate('userId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
};

// Static method to get public designs
customDesignSchema.statics.getPublicDesigns = function (limit = 20, skip = 0) {
    return this.find({
        'privacy.visibility': 'public',
        status: 'completed'
    })
        .populate('userId', 'firstName lastName')
        .populate('productId', 'name images category')
        .sort({ 'analytics.popularScore': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit);
};

// Static method to get designs requiring approval
customDesignSchema.statics.getPendingApproval = function () {
    return this.find({
        status: { $in: ['submitted', 'under_review'] }
    })
        .populate('userId', 'firstName lastName email')
        .populate('productId', 'name category')
        .sort({ createdAt: 1 });
};

// Static method to get production queue
customDesignSchema.statics.getProductionQueue = function () {
    return this.find({
        status: { $in: ['approved', 'queued_for_production'] }
    })
        .populate('userId', 'firstName lastName email')
        .populate('productId', 'name specifications')
        .sort({ 'metadata.complexity': 1, createdAt: 1 });
};

// Static method to get design statistics
customDesignSchema.statics.getDesignStats = function () {
    return this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalFileSize: { $sum: '$designData.originalFile.size' },
                averageComplexity: { $avg: { $indexOfArray: [['simple', 'moderate', 'complex', 'very_complex'], '$metadata.complexity'] } }
            }
        },
        {
            $group: {
                _id: null,
                totalDesigns: { $sum: '$count' },
                statusBreakdown: { $push: { status: '$_id', count: '$count' } },
                totalStorageUsed: { $sum: '$totalFileSize' },
                averageComplexityScore: { $avg: '$averageComplexity' }
            }
        }
    ]);
};

// Query helper to exclude private designs
customDesignSchema.query.public = function () {
    return this.where({
        'privacy.visibility': 'public',
        status: 'completed'
    });
};

// Query helper for active designs (not archived or cancelled)
customDesignSchema.query.active = function () {
    return this.where({
        status: { $nin: ['archived', 'cancelled'] }
    });
};

// Transform output
customDesignSchema.methods.toJSON = function () {
    const design = this.toObject();

    // Remove compressed data from JSON output for security
    if (design.designData && design.designData.compressedDesign) {
        delete design.designData.compressedDesign.data;
    }

    // Add virtuals
    design.compressionRatio = this.compressionRatio;
    design.designFileUrl = this.designFileUrl;
    design.estimatedCompletionDate = this.estimatedCompletionDate;
    design.daysInCurrentStatus = this.daysInCurrentStatus;
    design.isOverdue = this.isOverdue;
    design.canBeEdited = this.canBeEdited;
    design.primaryPreview = this.primaryPreview;

    return design;
};

const CustomDesign = mongoose.model('CustomDesign', customDesignSchema);

export default CustomDesign;