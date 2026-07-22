# Tonton Siaran TV IndiHome Tanpa STB

Repositori ini menyediakan beberapa alat untuk dapat menonton siaran TV IndiHome tanpa perlu
menggunakan STB. Jika anda berlangganan TV IndiHome dan ingin menonton siaran tv tersebut di
perangkat lain semisal di komputer/laptop atau Android TV.

## Syarat

Beberapa hal yang perlu dipersiapkan salah satunya yaitu menyediakan perangkat router yang
akan difungsikan sebagai proxy IGMP. Setelah semua langkah-langkah berikut ini dipenuhi,
penggunaan STB tidak disarankan lagi karena mac address perangkat tersebut telah dipakai
di perangkat router, _dan jika ingin menggunakan STB kembali maka perlu menonaktifkan mac
address di perangkat router terlebih dahulu_.

Hal-hal yang harus disiapkan:

* Dana yang cukup untuk membeli router MikroTik semisal Hex.
* Catat mac address perangkat STB, biasanya tercetak pada label di bawah STB.

## Langkah-Langkah

1. Konfigurasi awal jaringan

    Sebagai langkah awal yaitu mengkonfigurasi router MikroTik, diperlukan setidaknya 2 (dua)
    bridge yaitu bridge lan dan tv. Bridge lan nantinya difungsikan sebagai akses internet maupun
    perangkat yang akan digunakan menonton siaran tv, sedangkan bridge tv dihubungkan dengan port
    tv router IndiHome agar router MikroTik bisa mendapatkan ip address melalui DHCP.

    Berikut ini tipikal konfigurasi MikroTik, perlu diingat pada konfigurasi awal ini mac address
    STB belum diperlukan. Dalam contoh ini digunakan router dengan 5 port ethernet dengan `ether1`
    sebagai wan, `ether2`-`ether3` sebagai port bridge tv, dan `ether4`-`ether5` sebagai port bridge
    lan.

    *Update: 23 Mei 2025*

    Port TV IndiHome saat ini tidak otomatis terdeteksi sebagai edge port STP, sehingga menyebabkan
    port menjadi `non-forwarding`. Bila diasumsikan port yang terhubung dengan port TV IndiHome adalah
    port `ether2` maka port tersebut dapat difungsikan sebagai edge port dengan `edge=yes`.

    ```
    # setup bridge
    /interface bridge
    add igmp-snooping=yes name=br-lan port-cost-mode=short priority=0x4000
    add name=br-tv port-cost-mode=short priority=0x5000
    /interface bridge port
    add bridge=br-tv edge=yes interface=ether2 internal-path-cost=10 path-cost=10
    add bridge=br-tv interface=ether3 internal-path-cost=10 path-cost=10
    add bridge=br-lan interface=ether4 internal-path-cost=10 path-cost=10
    add bridge=br-lan interface=ether5 internal-path-cost=10 path-cost=10
    # setup ip address
    /ip address
    add address=10.0.0.1/24 interface=br-lan network=10.0.0.0
    # dhcp client untuk wan dan bridge tv
    /ip dhcp-client
    add interface=ether1 use-peer-dns=no use-peer-ntp=no
    add add-default-route=no interface=br-tv use-peer-dns=no use-peer-ntp=no
    # setup server dhcp
    /ip pool
    add name=dhcp-1 ranges=10.0.0.2-10.0.0.254
    /ip dhcp-server
    add address-pool=dhcp-1 interface=br-lan name=dhcp-1
    /ip dhcp-server network
    add address=10.0.0.0/24 dns-server=10.0.0.1 gateway=10.0.0.1
    # setup dns
    /ip dns
    set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8
    # setup nat
    /ip firewall nat
    add action=masquerade chain=srcnat out-interface=ether1
    add action=masquerade chain=srcnat out-interface=br-tv
    # igmp proxy
    /routing igmp-proxy
    set quick-leave=yes
    /routing igmp-proxy interface
    add alternative-subnets=0.0.0.0/0 interface=br-tv upstream=yes
    add interface=br-lan
    ```

    Selanjutnya hubungkan router tadi dengan router IndiHome baik untuk port wan maupun port tv,
    sehingga melalui MikroTik dapat dipantau lalu lintas jaringan di bridge tv dengan `torch`.

2. Membuat playlist M3U

    Untuk mengetahui ip address dan port yang digunakan oleh kanal TV IndiHome, terlebih dahulu
    putar kanal tv tersebut di STB IndiHome, kemudian lakukan _torch_ pada bridge tv dan catat nama
    kanal, ip address dan port yang digunakan. Untuk mengetahui ip address dan port yang digunakan,
    amati pada jendela _torch_ untuk lalu lintas dengan `Rx Rate` ±2.0Mbps (kanal SD) atau `Rx Rate`
    ±5.7Mbps (kanal HD) seperti ditunjukkan pada gambar berikut.

    ![Torch](/assets/mikrotik-torch.png)

    Dari contoh _torch_ di atas – ip address dan port dapat diambil dari kolom `Dst.` – sehingga dapat
    dituliskan data kanal sebagai berikut.

    | Nama kanal  | Ip address  | Port |
    |-------------|-------------|------|
    | MAXReels    | 239.1.1.252 | 9486 |

    Ulangi langkah-langkah di atas untuk semua kanal yang tersedia pada langganan TV IndiHome anda.

    Setelah semua kanal terdata, selanjutnya gunakan tool [IndiHomeTV](/IndiHomeTV.xlsm) dan masukkan
    semua data tersebut pada lembar `STREAM`. Ketika membuka tool tersebut pertama kali, pastikan
    _macro_ diaktifkan seperti terlihat pada gambar berikut.

    ![Enable macro](/assets/enable-macro.png)

    Pengisian data kanal pada lembar `STREAM` dijabarkan sebagai berikut:

    | Kolom   | Deskripsi                                                                     |
    |---------|-------------------------------------------------------------------------------|
    | ID      | Identitas kanal yang dapat dilihat pada lembar `CHANNEL` maupun `CHANNEL EXT` |
    | Q       | Isi dengan kualitas kanal `SD`, `HD`, atau `Dolby HD`                         |
    | ADDRESS | Ip address kanal                                                              |
    | PORT    | Port kanal                                                                    |

    Contoh pengisian stream playlist M3U dari data kanal tv dapat dilihat pada gambar berikut.

    ![Playlist M3U](/assets/playlist-m3u.png)

    Agar playlist yang dibuat nantinya dilengkapi dengan Electronic Program Guide (EPG), aktifkan koleksi
    EPG yang terdapat pada lembar `EPG` dengan mengubah kolom `ENABLED` menjadi `TRUE` dan untuk menonaktifkan
    ubah menjadi `FALSE`. Cotoh pengisian seperti ditunjukkan pada gambar berikut ini.

    ![Playlist EPG](/assets/playlist-epg.png)

    Langkah selanjutnya yaitu mengekspor playlist dan EPG yang telah dibuat agar dapat digunakan di Kodi.
    Untuk menjalankan _macro_, gunakan menu `View > Macros > View Macros`.

    ![View macros](/assets/view-macros.png)

    ![Run macro](/assets/run-macro.png)

    Untuk mengekspor playlist aktifkan _macro_ `ExportPlaylist` dan klik `Run` untuk mengeksekusinya.
    Hasil ekspor playlist dapat ditemukan dengan mencari berkas bernama `IndiHomeTV.m3u`.

    ![Playlist exported](/assets/playlist-exported.png)

    Untuk mengekspor EPG aktifkan _macro_ `ExportGuide` dan klik `Run` untuk mengeksekusinya.
    Hasil ekspor EPG dapat ditemukan dengan mencari berkas bernama `indihometv1-channels.xml`
    dan `indihometv2-channels.xml`.

    ![EPG exported](/assets/epg-exported.png)

    Selanjutnya umpankan kedua data kanal EPG tersebut pada Docker EPG dengan mengikuti langkah-langkah
    [ini](https://github.com/tohenk/docker-epg).

3. Mengaktifkan mac address STB di router MikroTik

    Matikan STB IndiHome, kemudian ganti mac address bridge tv dengan mac address STB sehingga router
    mendapatkan ip address melalui DHCP. Setelah langkah ini, penggunaan STB IndiHome sudah tidak disarankan
    lagi.

    ![Set bridge mac](/assets/bridge-mac.png)

    Dan pastikan bridge tv mendapatkan ip address.

    ![Bridge dhcp](/assets/bridge-dhcp.png)

4. Menyiapkan Kodi

    Setelah Kodi terpasang, diperlukan add-on [IPTV Merge](https://www.matthuisman.nz/2019/02/iptv-merge-kodi-add-on.html)
    dari repositori [SlyGuy](https://www.matthuisman.nz/2020/02/slyguy-kodi-repository.html). Tambahkan repositori
    SlyGuy terlebih dahulu kemudian pasang add-on `IPTV Merge`. Untuk memainkan playlist yang telah dibuat pada langkah
    sebelumnya, ikuti langkah-langkah berikut ini.

    Aktifkan IPTV Merge melalui menu `Add-ons`.

    ![IPTV Merge](/assets/iptv-merge-addon.png)

    Pilih `Setup IPTV Simple Client` dan tunggu hingga proses selesai, pada proses ini jika add-on `IPTV Simple Client`
    belum terpasang maka IPTV Merge akan menawarkan untuk memasang add-on ini.

    ![IPTV Merge setup](/assets/iptv-merge-setup.png)

    Pilih `Playlists`.

    ![IPTV Merge playlist](/assets/iptv-merge-playlist.png)

    Pilih `Add Playlist` dan pilih file `m3u` dari hasil ekspor playlist sebelumnya.

    ![IPTV Merge add playlist](/assets/iptv-merge-playlist-add.png)

    Jawab `No` pada konfirmasi `Add EPG`.

    ![IPTV Merge playlist no epg](/assets/iptv-merge-playlist-noepg.png)

    Kembali ke menu awal dan pilih `Run Merge`.

    ![IPTV Merge run](/assets/iptv-merge-run.png)

    Agar nomor kanal tv sesuai dengan nomor kanal TV IndiHome, maka perlu penyesuaian di pengaturan Kodi,
    dari pengaturan Kodi pilih `PVR & Live TV`.

    ![Kodi pvr](/assets/kodi-pvr.png)

    Aktifkan modus `Advanced`.

    ![Kodi pvr switch to advanced](/assets/kodi-pvr-switch.png)

    Aktifkan `Use channel numbers from backend` pada tab `Channels`.

    ![Kodi pvr channel from backend](/assets/kodi-pvr-channel-backend.png)

    Siaran tv dapat dilihat pada menu `TV`.

    ![IndiHome channels](/assets/indihome-channels.png)

    Jika EPG tidak otomatis diperbarui, lakukan langkah `IPTV Merge > Run Merge` lalu kosongkan guide
    melalui `Settings > PVR & Live TV > Guide > Clear data`.

    ![Kodi guide clear](/assets/kodi-guide-clear.png)

    Selamat menonton siaran tv IndiHome.

    ![Kodi guide clear](/assets/tonton-channel.png)
