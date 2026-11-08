// jsdom (the browser simulation Jest uses) does not provide TextEncoder/TextDecoder,
// but React Router needs them. Node has them built in, so borrow Node's versions.
// This file runs before the test environment loads.
const { TextEncoder, TextDecoder } = require('node:util');

Object.assign(globalThis, { TextEncoder, TextDecoder });