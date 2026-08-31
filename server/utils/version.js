const pkg = require('../package.json');

function getAppVersion() {
    const envVersion = process.env.APP_VERSION?.trim();
    if (envVersion) {
        return envVersion;
    }
    return pkg.version || 'dev';
}

module.exports = { getAppVersion };
