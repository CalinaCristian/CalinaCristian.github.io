'use strict';
// Configure the installed browser without modifying the repository harness.
const { chromium } = require('playwright');
const launch = chromium.launch.bind(chromium);
chromium.launch = (options = {}) => launch({
  ...options,
  executablePath: options.executablePath || '/usr/bin/chromium',
});
