const DOCKER_HUB_TAGS_URL = 'https://hub.docker.com/v2/repositories/uuphy/ipa-harbor/tags?page_size=100';

/** 解析 x.y.z 语义化版本 */
function parseSemver(version) {
    const match = String(version).trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        return null;
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a, b) {
    const versionA = parseSemver(a);
    const versionB = parseSemver(b);

    if (!versionA || !versionB) {
        return 0;
    }

    for (let i = 0; i < 3; i += 1) {
        if (versionA[i] !== versionB[i]) {
            return versionA[i] > versionB[i] ? 1 : -1;
        }
    }

    return 0;
}

async function fetchDockerHubTags() {
    const response = await fetch(DOCKER_HUB_TAGS_URL, {
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Docker Hub 请求失败 (${response.status})`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.results)) {
        throw new Error('Docker Hub 响应格式异常');
    }

    return payload.results;
}

function getLatestReleaseTag(tags) {
    const releaseTags = tags
        .map((item) => item?.name)
        .filter((name) => name && name !== 'latest' && parseSemver(name));

    releaseTags.sort((a, b) => compareSemver(b, a));

    return releaseTags[0] || null;
}

module.exports = {
    DOCKER_HUB_TAGS_URL,
    parseSemver,
    compareSemver,
    fetchDockerHubTags,
    getLatestReleaseTag,
};
