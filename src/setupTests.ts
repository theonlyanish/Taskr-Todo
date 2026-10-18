// Runs before every test file (Create React App picks this file up by name)

// toBeInTheDocument(), toHaveAttribute() and friends
import '@testing-library/jest-dom';

// Browsers have crypto.randomUUID (the app uses it for task ids); the test
// browser (jsdom) doesn't, so borrow Node's
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', {
    value: require('crypto').webcrypto,
    configurable: true
  });
}

// jsdom doesn't lay pages out, so it has no scrollIntoView; rows call it to
// keep a task in view after moving it with the keyboard
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Placeholder Supabase settings: services/supabaseClient refuses to load
// without them. No test talks to a server; the ones that would mock it.
process.env.REACT_APP_SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'http://localhost:54321';
process.env.REACT_APP_SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'test-anon-key';
