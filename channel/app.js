/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2023-2025 Toha <tohenk@yahoo.com>
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

    tvLiveUrl = 'https://www.indihometv.com/tv/live'
    tvOndemandUrl = 'https://www.indihometv.com/tvod'
    tvLogoMaps = {'logogrey/grey_': '', 'grey': '', 'small': 'big'}
    tvLogoVariants = [
        {'HD-BW': 'HD'},
        {'-BW': '-HD'},
        {'-BW': '-WARNA'},
    ]

    fetch(url) {
        return new Promise((resolve, reject) => {
            let done = false;
            const f = () => {
                /** @type {Buffer} buff */
                let buff, err, code;
                const parsedUrl = new URL(url);
                const http = require('https:' == parsedUrl.protocol ? 'https' : 'http');
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

    fetchLogo(logo) {
        return new Promise((resolve, reject) => {
            const r = url => {
                this.logos[logo] = url;
                resolve(url);
            }
            if (!this.logos) {
                this.logos = {};
            }
            if (this.logos[logo]) {
                return r(this.logos[logo]);
            }
            const variants = this.getVariants(logo);
            Promise.allSettled(
                variants.map(v => new Promise((resolve, reject) => {
                    this.fetch(v)
                        .then(res => resolve(res ? v : null))
                        .catch(err => reject(err));
                }))
            ).then(res => {
                const urls = res.filter(i => i.value !== null);
                if (urls.length) {
                    r(urls[0].value);
                } else {
                    r(logo);
                }
            });
        });
    }

    getVariants(logo) {
        const result = [];
        const r = (s, m) => {
            for (const k of Object.keys(m)) {
                s = s.replace(k, m[k]);
            }
            return s;
        }
        const baselogo = r(logo, this.tvLogoMaps);
        for (let variant of this.tvLogoVariants) {
            const newlogo = r(baselogo, variant);
            if (newlogo !== logo && result.indexOf(newlogo) < 0) {
                result.push(newlogo);
            }
        }
        return result;
    }

    async parse(content) {
        const res = [];
        const cheerio = require('cheerio');
        const $ = cheerio.load(content);
        const channels = $('#channelContainer a.channel-item');
        const categories = {};
        for (const channel of channels) {
            const ch = $(channel);
            const info = {};
            // channel code
            if (ch.data('code')) {
                info.id = ch.data('code');
            } else if (ch.data('url')) {
                const path = ch.data('url').split('/');
                info.id = path[path.length - 1];
            }
            // channel name
            info.name = ch.data('name');
            if (info.name) {
                // channel category
                const classes = ch.parent().attr('class').split(' ');
                const category = classes[classes.length - 1];
                if (!categories[category]) {
                    const cat = $(`#category a[data-filter=".${category}"]`);
                    if (cat.length > 0) {
                        categories[category] = cat.text().trim();
                    }
                }
                if (categories[category]) {
                    info.category = categories[category];
                }
                // channel logo
                let logo = ch.find('img').data('src');
                if (logo.indexOf('?') > 0) {
                    logo = logo.substr(0, logo.indexOf('?'));
                }
                info.logo = await this.fetchLogo(logo);
                res.push(info);
            }
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
        const urls = [this.tvLiveUrl, this.tvOndemandUrl];
        for (const url of urls) {
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