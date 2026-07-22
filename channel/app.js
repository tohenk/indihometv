/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2023-2026 Toha <tohenk@yahoo.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Application to scrape IndoHome TV channels.
 *
 * @author Toha <tohenk@yahoo.com>
 */
class App {

    /**
     * Constructor.
     */
    constructor() {
        this.tvChannelsUrl = 'https://api.maxstream.tv/v1/videos?filters%5BcontentType%5D=channel';
        this.imagesBaseUrl = 'https://images.maxstream.tv';
        this.imagesPath = 'images.landscapecarousel.hdpi';
        this.headers = {
            'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 OPR/132.0.0.0',
            'channelid': 'VMPWEB',
            'webplatform': '878a6db06e0cd079b3b02408d246801d217c018f',
            'x-data-centre': btoa([crypto.randomUUID(), crypto.randomUUID()].join('|')),
            'x-localization': 'EN',
            'x-maxstream-version': '3.2.6'
        }
        this.filename = path.join(__dirname, 'channel.csv');
    }

    /**
     * Fetch the content of URL.
     *
     * @param {string} url Url
     * @returns {Promise<string|object|Buffer|Error>}
     */
    fetch(url) {
        return new Promise((resolve, reject) => {
            let done = false;
            const f = () => {
                /** @type {Buffer} buff */
                let buff, err, code;
                const parsedUrl = new URL(url);
                const http = require('https:' === parsedUrl.protocol ? 'https' : 'http');
                const req = http.request(url, {method: 'GET', headers: this.headers}, res => {
                    code = res.statusCode;
                    res.on('data', chunk => {
                        if (typeof chunk === 'string') {
                            chunk = Buffer.from(chunk, 'utf8');
                        }
                        if (buff) {
                            buff = Buffer.concat([buff, chunk]);
                        } else {
                            buff = chunk;
                        }
                    });
                    res.on('end', () => {
                        if (code === 301 || code === 302) {
                            if (res.headers.location) {
                                url = res.headers.location;
                            } else {
                                reject('No redirection to follow!');
                            }
                        } else {
                            if (
                                res.headers &&
                                typeof res.headers['content-type'] === 'string' &&
                                res.headers['content-type'].toLowerCase().includes('application/json')
                            ) {
                                buff = JSON.parse(buff);
                            }
                            done = true;
                        }
                    });
                });
                req.on('error', e => {
                    err = e;
                });
                req.on('close', () => {
                    if (err) {
                        return reject(err);
                    }
                    if (done) {
                        resolve(code === 200 ? buff : null);
                    } else {
                        f();
                    }
                });
                req.end();
            }
            f();
        });
    }

    /**
     * Parse channels.
     *
     * @param {object} content Content
     * @returns {object[]}
     */
    async parse(content) {
        const res = [];
        if (Array.isArray(content?.data?.items)) {
            const f = (o, p) => {
                let res;
                if (p) {
                    let c = o;
                    for (const a of p.split('.')) {
                        if (c && c[a] !== undefined) {
                            c = c[a];
                        } else {
                            c = undefined;
                        }
                    }
                    if (c !== undefined) {
                        res = c;
                    }
                }
                return res;
            }
            res.push(...content.data.items
                .filter(a => a?.contentType === 'Channel')
                .map(a => ({
                    id: (a.translations.id.title || a.translations.en.title).toLowerCase().replace(/\s+/g, ''),
                    name: a.translations.id.title || a.translations.en.title,
                    category: a.genreNames[0],
                    logo: `${this.imagesBaseUrl}${f(a, this.imagesPath)}`,
                })));
        }
        return res;
    }

    /**
     * Load channels.
     *
     * @returns {Promise<object>}
     */
    load() {
        const res = {};
        if (fs.existsSync(this.filename)) {
            return new Promise((resolve, reject) => {
                let headers;
                const csv = require('@fast-csv/parse');
                const stream = csv.parse()
                    .on('error', err => reject(err))
                    .on('data', row => {
                        if (headers === undefined) {
                            headers = row.map(header => header.toLowerCase());
                            if (!headers.includes('updated')) {
                                headers.push('updated');
                            }
                        } else {
                            const channel = {};
                            for (let i = 0; i < headers.length; i++) {
                                channel[headers[i]] = row[i];
                            }
                            res[channel.id] = channel;
                        }
                    })
                    .on('end', () => {
                        if (Object.keys(res).length) {
                            console.log(`Loaded ${Object.keys(res).length} existing channels...`);
                        }
                        resolve(res);
                    });
                stream.write(fs.readFileSync(this.filename));
                stream.end();
            });
        } else {
            return Promise.resolve({});
        }
    }

    /**
     * Save channels.
     *
     * @param {object} data Channels data
     * @returns {Promise<undefined>}
     */
    async save(data) {
        if (Object.keys(data).length) {
            return new Promise((resolve, reject) => {
                let header = true;
                const csv = require('@fast-csv/format');
                const stream = csv.format();
                stream.pipe(fs.createWriteStream(this.filename)
                    .on('error', err => reject(err))
                    .on('finish', () => {
                        console.log(`Channels saved to ${this.filename}...`);
                        resolve();
                    }));
                Object.values(data)
                    .sort((a, b) => a.id.localeCompare(b.id))
                    .forEach(ch => {
                        if (header) {
                            header = false;
                            stream.write(Object.keys(ch).map(s => s.toUpperCase()));
                        }
                        stream.write(Object.values(ch));
                    });
                stream.end();
            });
        } else {
            return Promise.resolve();
        }
    }

    /**
     * Run the application.
     *
     * @returns {Promise<undefined>}
     */
    async run() {
        let count = 0;
        const time = new Date().toJSON();
        const channels = await this.load();
        for (const url of [this.tvChannelsUrl]) {
            console.log(`Fetching ${url}...`)
            const body = await this.fetch(url);
            if (!(body instanceof Error)) {
                const items = await this.parse(body);
                for (const item of items) {
                    let updated = false;
                    if (channels[item.id] === undefined) {
                        channels[item.id] = item;
                        updated = true;
                    } else {
                        for (const k of ['name', 'category', 'logo']) {
                            if (!item[k] || item[k] === channels[item.id][k]) {
                                continue;
                            }
                            channels[item.id][k] = item[k];
                            if (!updated) {
                                updated = true;
                            }
                        }
                    }
                    if (updated) {
                        channels[item.id].updated = time;
                        count++;
                    }
                }
            } else {
                console.error(body);
            }
        }
        if (count) {
            await this.save(channels);
        } else {
            console.log('No new channels...');
        }
    }
}

(new App()).run();