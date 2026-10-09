
        // ==================== GLOBAL AUTO-LINK ASSET CONFIG ====================
        const ASSET_CONFIG = Object.freeze({
            base_url: "https://cdn.jsdelivr.net/gh/CIDHARIOM/ANDOS-VS-0.172.1919@main/assets/"
        });

        /** Builds every repository asset URL from one configurable base path. */
        function getAsset(folder, fileName) {
            return ASSET_CONFIG.base_url
                + folder.replace(/^\/+|\/+$/g, '')
                + '/'
                + fileName.replace(/^\/+/, '');
        }

        window.ASSET_CONFIG = ASSET_CONFIG;
        window.getAsset = getAsset;

        const PHOTO_BASE = 'https://cdn.jsdelivr.net/gh/CIDHARIOM/ANDOS-VS-0.172.1919@main/assets/photos/';
        function photo(fileName) { return PHOTO_BASE + String(fileName||'').replace(/^\/+/, ''); }
        window.PHOTO_BASE = PHOTO_BASE;
        window.photo = photo;
        const FF_DEALS_BANNER = 'assets/img-00.webp';
        window.FF_DEALS_BANNER = FF_DEALS_BANNER;


        // Permanent white theme: manual and device dark-mode switching are disabled.
        (function () {
            try { localStorage.removeItem('andos_dark_pref'); } catch (e) {}
            document.documentElement.classList.remove('dark');
            document.documentElement.style.colorScheme = 'light';
        })();
    