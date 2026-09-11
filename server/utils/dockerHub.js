const DOCKER_HUB_TAGS_URL = 'https://hub.docker.com/v2/repositories/uuphy/ipa-harbor/tags?page_size=100';

const RELEASE_TAG_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/i;

function isReleaseTag(version) {
    return RELEASE_TAG_PATTERN.test(String(version).trim());
}

function parseSemver(version) {
    const match = String(version).trim().match(RELEASE_TAG_PATTERN);
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
        .filter((name) => name && name !== 'latest' && isReleaseTag(name));

    releaseTags.sort((a, b) => compareSemver(b, a));

    return releaseTags[0] || null;
}

module.exports = {
    DOCKER_HUB_TAGS_URL,
    isReleaseTag,
    parseSemver,
    compareSemver,
    fetchDockerHubTags,
    getLatestReleaseTag,
};
