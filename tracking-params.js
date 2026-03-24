// OneTake AI - URL Tracking Parameter Capture
// Extracts UTM and ad-platform params from the URL and provides helpers
// to include them in Paddle custom data and success URLs.

(function() {
    'use strict';

    // ==========================================
    // CONFIGURATION
    // ==========================================

    // Standard UTM params — always captured
    const UTM_PARAMS = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term'
    ];

    // Ad-platform params — only captured when INCLUDE_AD_PARAMS is true
    const AD_PARAMS = [
        'ad_id', 'adset_id', 'placement', 'site_source_name'
    ];

    // Set to true to also capture ad-platform params (ad_id, adset_id, etc.)
    const INCLUDE_AD_PARAMS = true;

    // Set to true to forward tracking params to the success/onboarding URL
    const FORWARD_TO_SUCCESS_URL = true;

    // ==========================================
    // HELPERS
    // ==========================================

    function getActiveParamKeys() {
        return INCLUDE_AD_PARAMS ? UTM_PARAMS.concat(AD_PARAMS) : UTM_PARAMS;
    }

    // ==========================================
    // PARSING
    // ==========================================

    // Parse tracking params from a URLSearchParams instance.
    // Returns a plain object — string values for single occurrences,
    // array of strings if a key appears more than once.
    function parseTrackingParams(urlSearchParams) {
        const result = {};
        const keys = getActiveParamKeys();

        keys.forEach(function(key) {
            const values = urlSearchParams.getAll(key);
            if (values.length === 1) {
                result[key] = values[0];
            } else if (values.length > 1) {
                result[key] = values;
            }
        });

        if (Object.keys(result).length > 0) {
            console.log('Tracking params captured:', result);
        }

        return result;
    }

    // ==========================================
    // PADDLE CUSTOM DATA
    // ==========================================

    // Merge tracking params into a Paddle custom-data object.
    // Only UTM params are included — ad-platform params are not needed in Paddle custom data.
    // Paddle custom data values must be strings, so arrays are JSON-encoded.
    function addTrackingToCustomData(customData, trackingParams) {
        const keys = UTM_PARAMS;

        keys.forEach(function(key) {
            if (trackingParams[key] !== undefined) {
                const val = trackingParams[key];
                customData[key] = Array.isArray(val) ? JSON.stringify(val) : val;
            }
        });

        return customData;
    }

    // ==========================================
    // SUCCESS URL
    // ==========================================

    // Append tracking params to a URLSearchParams instance (for success/onboarding URL).
    // Gated behind FORWARD_TO_SUCCESS_URL — returns early if disabled.
    function addTrackingToSuccessUrl(urlSearchParams, trackingParams) {
        if (!FORWARD_TO_SUCCESS_URL) return urlSearchParams;

        const keys = getActiveParamKeys();

        keys.forEach(function(key) {
            if (trackingParams[key] !== undefined) {
                const val = trackingParams[key];
                if (Array.isArray(val)) {
                    val.forEach(function(v) { urlSearchParams.append(key, v); });
                } else {
                    urlSearchParams.set(key, val);
                }
            }
        });

        return urlSearchParams;
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    window.oneTakeTracking = {
        parseTrackingParams: parseTrackingParams,
        addTrackingToCustomData: addTrackingToCustomData,
        addTrackingToSuccessUrl: addTrackingToSuccessUrl
    };

})();
