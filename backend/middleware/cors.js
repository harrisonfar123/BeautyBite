// Lightweight CORS middleware without external dependencies (ESM)
export default function cors(allowedOrigins = []) {
    // Normalize allowed origins to a Set for O(1) lookups
    const allowAll = Array.isArray(allowedOrigins) && allowedOrigins.includes('*');
    const allowSet = new Set(Array.isArray(allowedOrigins) ? allowedOrigins : []);

    function isAllowed(origin) {
        if (!origin) return false; // tolerate missing origin; treat as not a browser CORS request
        if (allowAll) return true;
        return allowSet.has(origin);
    }

    function appendVary(res, field) {
        try {
            const prev = res.getHeader('Vary');
            if (!prev) {
                res.setHeader('Vary', field);
                return;
            }
            const value = Array.isArray(prev) ? prev.join(', ') : String(prev);
            if (!value.toLowerCase().split(',').map(s => s.trim()).includes(field.toLowerCase())) {
                res.setHeader('Vary', value + ', ' + field);
            }
        } catch {
            // never throw
        }
    }

    return function corsMiddleware(req, res, next) {
        try {
            const reqOrigin = req?.headers?.origin;

            // Always advertise allowed methods and headers (safe defaults for dev)
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');

            if (reqOrigin && isAllowed(reqOrigin)) {
                // Reflect the requesting origin to support credentials
                res.setHeader('Access-Control-Allow-Origin', reqOrigin);
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                appendVary(res, 'Origin');
            }

            // Short-circuit preflight when origin is allowed
            if (req.method === 'OPTIONS') {
                if (reqOrigin && isAllowed(reqOrigin)) {
                    // No body for preflight success
                    res.statusCode = 204;
                    return res.end();
                }
                // If origin not allowed, fall through (dev-friendly)
                return next();
            }

            return next();
        } catch {
            // Be tolerant and never throw
            return next();
        }
    };
}