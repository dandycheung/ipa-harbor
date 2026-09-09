const yauzl = require('yauzl');
const plist = require('plist');
const bplist = require('bplist-parser');
const fs = require('fs');
const path = require('path');
const { resolveItemId } = require('../../utils/ipaFileName');
const { normalizePlistMetadata, normalizeStoredMetadata } = require('../../utils/ipaMetadata');

function applyItemIdFromFileName(metadata, fileName) {
    const itemId = resolveItemId(metadata, fileName);
    if (itemId) {
        metadata.itemId = itemId;
    }

    return metadata;
}

function writeSidecarMetadata(fileName, metadata) {
    const dataDir = path.join(__dirname, '../../data');
    const jsonPath = path.join(dataDir, fileName.replace('.ipa', '.json'));
    fs.writeFileSync(jsonPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    return jsonPath;
}

/**
 * 解析IPA文件中的 iTunesMetadata.plist
 * @param {string} fileName - IPA文件名
 * @param {{ forceReparse?: boolean, skipWrite?: boolean }} options
 * @returns {Promise} 返回解析结果
 */
function parseIpaMetadata(fileName, options = {}) {
    const { forceReparse = false, skipWrite = false } = options;

    return new Promise((resolve, reject) => {
        const dataDir = path.join(__dirname, '../../data');
        const ipaPath = path.join(dataDir, fileName);
        const jsonPath = path.join(dataDir, fileName.replace('.ipa', '.json'));

        if (!fs.existsSync(ipaPath)) {
            return reject(new Error(`IPA文件不存在: ${fileName}`));
        }

        if (!forceReparse && fs.existsSync(jsonPath)) {
            try {
                const existingJson = normalizeStoredMetadata(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
                return resolve(applyItemIdFromFileName(existingJson, fileName));
            } catch (error) {
                console.log('读取现有JSON文件失败，重新解析IPA');
            }
        }

        yauzl.open(ipaPath, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                return reject(new Error(`无法打开IPA文件: ${err.message}`));
            }

            let metadataFound = false;

            zipfile.readEntry();

            zipfile.on('entry', (entry) => {
                if (entry.fileName === 'iTunesMetadata.plist') {
                    metadataFound = true;

                    zipfile.openReadStream(entry, (streamErr, readStream) => {
                        if (streamErr) {
                            return reject(new Error(`无法读取iTunesMetadata.plist: ${streamErr.message}`));
                        }

                        const chunks = [];

                        readStream.on('data', (chunk) => {
                            chunks.push(chunk);
                        });

                        readStream.on('end', () => {
                            try {
                                const buffer = Buffer.concat(chunks);
                                let metadata;

                                if (buffer.length > 6 && buffer.toString('ascii', 0, 6) === 'bplist') {
                                    const result = bplist.parseBuffer(buffer);
                                    metadata = result[0];
                                } else {
                                    const xmlString = buffer.toString('utf8');
                                    metadata = plist.parse(xmlString);
                                }

                                applyItemIdFromFileName(metadata, fileName);
                                const normalized = normalizePlistMetadata(metadata);

                                if (!skipWrite) {
                                    writeSidecarMetadata(fileName, normalized);
                                    console.log(`成功解析并保存: ${path.basename(jsonPath)}`);
                                }

                                resolve(normalized);
                            } catch (parseError) {
                                reject(new Error(`解析plist文件失败: ${parseError.message}`));
                            }
                        });

                        readStream.on('error', (streamError) => {
                            reject(new Error(`读取流错误: ${streamError.message}`));
                        });
                    });
                } else {
                    zipfile.readEntry();
                }
            });

            zipfile.on('end', () => {
                if (!metadataFound) {
                    reject(new Error('在IPA文件中未找到iTunesMetadata.plist'));
                }
            });

            zipfile.on('error', (zipError) => {
                reject(new Error(`ZIP文件错误: ${zipError.message}`));
            });
        });
    });
}

/**
 * 获取IPA元数据的HTTP
 */
async function metadataHandler(req, res) {
    try {
        const { fileName } = req.body;

        if (!fileName) {
            return res.status(400).json({
                success: false,
                message: '文件名是必需的参数',
                error: '请在请求体中提供fileName参数'
            });
        }

        if (!fileName.endsWith('.ipa')) {
            return res.status(400).json({
                success: false,
                message: '无效的文件格式',
                error: '文件名必须以.ipa结尾'
            });
        }

        console.log(`开始解析IPA文件: ${fileName}`);

        try {
            const metadata = await parseIpaMetadata(fileName);
            return res.json(metadata);
        } catch (parseError) {
            console.error('解析IPA文件时出错:', parseError);

            return res.status(500).json({
                success: false,
                message: '解析IPA文件失败',
                error: parseError.message
            });
        }

    } catch (error) {
        console.error('IPA元数据错误:', error);
        return res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
}

module.exports = {
    metadataHandler,
    parseIpaMetadata,
    writeSidecarMetadata,
};
