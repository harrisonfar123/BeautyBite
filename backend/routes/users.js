import express from 'express';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';

const router = express.Router();

// All routes are protected
router.use(authenticate);

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', validateRequest('updateProfile'), async (req, res, next) => {
    try {
        const { firstName, lastName, phone, preferences } = req.body;

        const updateFields = {};
        if (firstName) updateFields.firstName = firstName;
        if (lastName) updateFields.lastName = lastName;
        if (phone !== undefined) updateFields.phone = phone;
        if (preferences) updateFields.preferences = { ...req.user.preferences, ...preferences };

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateFields,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get user addresses
// @route   GET /api/users/addresses
// @access  Private
router.get('/addresses', async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('addresses');

        res.status(200).json({
            success: true,
            addresses: user.addresses
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Add user address
// @route   POST /api/users/addresses
// @access  Private
router.post('/addresses', validateRequest('address'), async (req, res, next) => {
    try {
        const { street, city, state, zipCode, country, isDefault } = req.body;

        const user = await User.findById(req.user.id);

        const newAddress = {
            street,
            city,
            state,
            zipCode,
            country: country || 'United States',
            isDefault: isDefault || false
        };

        // If setting as default, unset other defaults
        if (newAddress.isDefault) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }

        user.addresses.push(newAddress);
        await user.save();

        res.status(201).json({
            success: true,
            address: user.addresses[user.addresses.length - 1]
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Update user address
// @route   PUT /api/users/addresses/:id
// @access  Private
router.put('/addresses/:id', validateRequest('address'), async (req, res, next) => {
    try {
        const { street, city, state, zipCode, country, isDefault } = req.body;
        const addressId = req.params.id;

        const user = await User.findById(req.user.id);

        const address = user.addresses.id(addressId);
        if (!address) {
            return res.status(404).json({
                success: false,
                error: 'Address not found'
            });
        }

        address.street = street;
        address.city = city;
        address.state = state;
        address.zipCode = zipCode;
        address.country = country || 'United States';

        // If setting as default, unset other defaults
        if (isDefault && !address.isDefault) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }
        address.isDefault = isDefault || false;

        await user.save();

        res.status(200).json({
            success: true,
            address
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Delete user address
// @route   DELETE /api/users/addresses/:id
// @access  Private
router.delete('/addresses/:id', async (req, res, next) => {
    try {
        const addressId = req.params.id;

        const user = await User.findById(req.user.id);

        const address = user.addresses.id(addressId);
        if (!address) {
            return res.status(404).json({
                success: false,
                error: 'Address not found'
            });
        }

        user.addresses.pull(addressId);
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Address deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Set default address
// @route   PUT /api/users/addresses/:id/default
// @access  Private
router.put('/addresses/:id/default', async (req, res, next) => {
    try {
        const addressId = req.params.id;

        const user = await User.findById(req.user.id);

        const address = user.addresses.id(addressId);
        if (!address) {
            return res.status(404).json({
                success: false,
                error: 'Address not found'
            });
        }

        // Unset all other defaults
        user.addresses.forEach(addr => {
            addr.isDefault = false;
        });

        // Set this address as default
        address.isDefault = true;

        await user.save();

        res.status(200).json({
            success: true,
            address
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get user orders (placeholder - will be implemented in order routes)
// @route   GET /api/users/orders
// @access  Private
router.get('/orders', async (req, res, next) => {
    try {
        // This will be handled by the order routes
        res.status(200).json({
            success: true,
            message: 'User orders endpoint - to be implemented in order routes'
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get user subscriptions (placeholder - will be implemented in subscription routes)
// @route   GET /api/users/subscriptions
// @access  Private
router.get('/subscriptions', async (req, res, next) => {
    try {
        // This will be handled by the subscription routes
        res.status(200).json({
            success: true,
            message: 'User subscriptions endpoint - to be implemented in subscription routes'
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get user designs (placeholder - will be implemented in design routes)
// @route   GET /api/users/designs
// @access  Private
router.get('/designs', async (req, res, next) => {
    try {
        // This will be handled by the design routes
        res.status(200).json({
            success: true,
            message: 'User designs endpoint - to be implemented in design routes'
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Deactivate user account
// @route   PUT /api/users/deactivate
// @access  Private
router.put('/deactivate', async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { isActive: false },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: 'Account deactivated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Reactivate user account
// @route   PUT /api/users/reactivate
// @access  Public (requires email verification)
router.put('/reactivate', async (req, res, next) => {
    try {
        // In production, this would require email verification
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        user.isActive = true;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Account reactivated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// Admin only routes
// @desc    Get all users (admin only)
// @route   GET /api/users
// @access  Private/Admin
router.get('/', authorize('admin'), async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments();

        res.status(200).json({
            success: true,
            count: users.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            users
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get user by ID (admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
router.get('/:id', authorize('admin'), async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Update user by ID (admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
router.put('/:id', authorize('admin'), async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Delete user by ID (admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
router.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

export default router;