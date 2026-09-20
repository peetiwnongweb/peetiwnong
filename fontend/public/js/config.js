// Global API Configuration
// This file intercepts all fetch() calls in the frontend to route /api/... to the correct Backend domain.

const API_BASE_URL = 'https://api.peetiwnong.site'; // Render backend URL (via custom domain)

const originalFetch = window.fetch;

window.fetch = async function () {
    let [resource, config] = arguments;

    if (typeof resource === 'string' && resource.startsWith('/api/')) {
        // Change /api/... to https://api.peetiwnong.site/api/...
        resource = API_BASE_URL + resource;
        
        // Ensure cookies are sent with cross-origin requests
        if (!config) {
            config = {};
        }
        config.credentials = 'include';
    }

    return originalFetch(resource, config);
};
