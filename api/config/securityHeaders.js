const helmet = require('helmet');

// Security headers for every API response.
//
// The API only ever returns JSON, so it never needs to load scripts, styles,
// images, fonts or frames. The Content Security Policy therefore denies
// everything by default. If an attacker manages to get HTML or a script into
// a response, the browser will refuse to run or load any of it.
const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      // Block every resource type unless a directive below allows it
      defaultSrc: ["'none'"],
      // No <script> may run, inline or external (protects against XSS)
      scriptSrc: ["'none'"],
      // No plugins such as Flash or Java applets
      objectSrc: ["'none'"],
      // Stop injected <base> tags from changing where relative URLs point
      baseUri: ["'none'"],
      // Stop injected forms from posting data anywhere
      formAction: ["'none'"],
      // No site may show the API inside a frame (protects against clickjacking)
      frameAncestors: ["'none'"],
      // Ask the browser to upgrade any http:// request to https://
      upgradeInsecureRequests: []
    }
  },

  // Strict-Transport-Security: once a browser has seen the API over HTTPS,
  // it must only use HTTPS for the next year
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true
  },

  // X-Frame-Options: DENY (older browsers' version of frame-ancestors)
  xFrameOptions: { action: 'deny' },

  // Do not send the page URL to other sites in the Referer header
  referrerPolicy: { policy: 'no-referrer' },

  // Only pages from the same site may read API responses as resources
  crossOriginResourcePolicy: { policy: 'same-origin' }
});

module.exports = securityHeaders;
