/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2023 Toha <tohenk@yahoo.com>
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

    fetch(url) {
        return new Promise((resolve, reject) => {
            let buff, result, err;
            const parsedUrl = require('url').parse(url);
            const http = require('https:' == parsedUrl.protocol ? 'https' : 'http');
            const options = {method: 'GET'}
            const req = http.request(url, options, res => {
                res.setEncoding('utf8');
                res.on('data', chunk => {
                    if (buff) {
                        buff += chunk;
                    } else {
                        buff = chunk;
                    }
                });
                res.on('end', () => {
                    result = buff;
                });
            });
            req.on('error', e => {
                err = e;
            });
            req.on('close', () => {
                if (result) {
                    resolve(buff);
                } else {
                    reject(err);
                }
            });
            req.end();
        });
    }

    async parse(content) {
        const res = [];
        const cheerio = require('cheerio');
        const $ = cheerio.load(content);
        const channels = $('#channelContainer a.channel-item');
        const categories = {};
        channels.each(async (_, ch) => {
            ch = $(ch);
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
                let src = ch.find('img').data('src')
                    .replace(/logogrey\/grey_/, '')
                    .replace('small', 'big');
                if (src.indexOf('?') > 0) {
                    src = src.substr(0, src.indexOf('?'));
                }
                info.logo = src;
                res.push(info);
            }
        });
        return res;
    }

    async save(data) {
        if (Object.keys(data).length) {
            const csv = require('@fast-csv/format');
            const stream = csv.format({delimiter: ';'});
            const filename = path.join(__dirname, 'channel.csv');
            stream.pipe(fs.createWriteStream(filename));
            let header = true;
            Object.keys(data).forEach(ch => {
                if (header) {
                    header = false;
                    stream.write(Object.keys(data[ch]).map(s => s.toUpperCase()));
                }
                stream.write(Object.values(data[ch]));
            });
            stream.end();
            console.log(`Channels saved to ${filename}...`);
        }
    }

    async run() {
        const infos = {};
        const urls = [this.tvLiveUrl, this.tvOndemandUrl];
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
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