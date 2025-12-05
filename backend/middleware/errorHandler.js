// Global error handling middleware
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error for development
    if (process.env.NODE_ENV !== 'production') {
        console.error('Error Stack:', err.stack);
    }

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = {
            message,
            statusCode: 404,
            details: `Invalid ID: ${err.value}`
        };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const value = err.keyValue[field];
        const message = `Duplicate field value: ${field} '${value}' already exists`;
        error = {
            message,
            statusCode: 400,
            details: `Please use a different ${field}`
        };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        const message = 'Validation failed';
        error = {
            message,
            statusCode: 400,
            details: messages
        };
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = {
            message,
            statusCode: 401,
            details: 'Please provide a valid token'
        };
    }

    // JWT expired
    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = {
            message,
            statusCode: 401,
            details: 'Please login again'
        };
    }

    // Multer errors (file upload)
    if (err.name === 'MulterError') {
        let message = 'File upload error';
        let statusCode = 400;

        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File too large';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected file field';
                break;
            default:
                message = err.message;
        }

        error = {
            message,
            statusCode,
            details: err.message
        };
    }

    // Default to 500 server error
    const statusCode = error.statusCode || 500;
    const response = {
        success: false,
        error: error.message || 'Server Error',
        ...(error.details && { details: error.details }),
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    };

    // Remove stack trace in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        response.error = 'Server Error';
        delete response.details;
    }

    res.status(statusCode).json(response);
};

export { errorHandler };