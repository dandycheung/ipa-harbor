const { countryCodeFromStoreFront } = require('./storefront');
const { getIpatoolAccount } = require('./ipatoolAccount');

// 用户手动指定的地区覆盖（email -> region）
global.userRegions = global.userRegions || new Map();

async function getStoreRegionFromAccount() {
    const account = await getIpatoolAccount();
    if (!account) {
        return null;
    }

    const storeFront = account.storeFront || account.storefront;
    return countryCodeFromStoreFront(storeFront);
}

function getManualRegion(email) {
    if (!email) {
        return undefined;
    }

    return global.userRegions.get(email);
}

function setManualRegion(email, region) {
    if (!email) {
        return;
    }

    if (region) {
        global.userRegions.set(email, region);
    } else {
        global.userRegions.delete(email);
    }
}

/**
 * 获取当前有效地区：手动指定优先，否则使用 Apple ID storefront
 */
async function getEffectiveRegion(email) {
    const account = await getIpatoolAccount();
    const resolvedEmail = email || account?.email || null;
    const storeRegion = countryCodeFromStoreFront(account?.storeFront || account?.storefront);
    const manualRegion = getManualRegion(resolvedEmail);

    if (manualRegion) {
        return manualRegion;
    }

    return storeRegion || null;
}

/**
 * 为 auth info / login 响应补充 region、storeRegion、regionSource
 */
async function enrichUserData(userData = {}) {
    const account = await getIpatoolAccount();
    const email = userData.email || account?.email || null;
    const storeRegion = countryCodeFromStoreFront(account?.storeFront || account?.storefront);
    const manualRegion = getManualRegion(email);
    const effectiveRegion = manualRegion || storeRegion || null;

    return {
        ...userData,
        email: email || userData.email,
        name: userData.name || account?.name,
        storeRegion: storeRegion || null,
        region: effectiveRegion,
        regionSource: manualRegion ? 'manual' : (storeRegion ? 'storefront' : null),
    };
}

module.exports = {
    enrichUserData,
    getEffectiveRegion,
    getStoreRegionFromAccount,
    getManualRegion,
    setManualRegion,
};
