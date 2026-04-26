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

const fs = require('fs');
const path = require('path');

class App {

    tvChannelsUrl = 'https://vmp.maxstream.tv/api/v3/videos/list?contentType=channel'
    imagesBaseUrl = 'https://images.maxstream.tv'
    imagesPath = 'images.landscapecarousel.hdpi'

    fetch(url) {
        return new Promise((resolve, reject) => {
            let done = false;
            const f = () => {
                /** @type {Buffer} buff */
                let buff, err, code;
                const parsedUrl = new URL(url);
                const http = require('https:' === parsedUrl.protocol ? 'https' : 'http');
                const req = http.request(url, {method: 'GET'}, res => {
                    code = res.statusCode;
                    res.setEncoding('utf8');
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

    async parse(content) {
        const res = [];
        if (Array.isArray(content?.videos)) {
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
            res.push(...content.videos
                .filter(a => a?.contentType === 'Channel')
                .map(a => ({
                    id: a.translations.id.title.toLowerCase().replace(/\s+/g, ''),
                    name: a.translations.id.title,
                    category: a.genreNames[0],
                    logo: `${this.imagesBaseUrl}${f(a, this.imagesPath)}`,
                })));
        }
        return res;
    }

    async save(data) {
        if (Object.keys(data).length) {
            const csv = require('@fast-csv/format');
            const stream = csv.format();
            const filename = path.join(__dirname, 'channel.csv');
            stream.pipe(fs.createWriteStream(filename));
            let header = true;
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
            console.log(`Channels saved to ${filename}...`);
        }
    }

    async run() {
        const infos = {};
        for (const url of [this.tvChannelsUrl]) {
            const body = await this.fetch(url);
            if (!(body instanceof Error)) {
                const res = await this.parse(body);
                res.forEach(info => {
                    if (!infos[info.id]) {
                        infos[info.id] = info;
                    }
                });
            } else {
                console.error(body);
            }
        }
        await this.save(infos);
    }
}

(new App()).run();