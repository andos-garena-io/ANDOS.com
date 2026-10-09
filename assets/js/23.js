
/* ===== IMPROVED PROFILE DP VIEWER - Telegram/Instagram/Facebook style - High Quality ===== */
(function () {
    'use strict';

    window.getAvatarSrc = function() { try { return localStorage.getItem('andos_profile_avatar') || ''; } catch (e) { return ''; } }; function getAvatarSrc() {
        try { return localStorage.getItem('andos_profile_avatar') || ''; } catch (e) { return ''; }
    }
    function getAvatarDate() {
        try {
            var d = localStorage.getItem('andos_profile_avatar_date');
            if (d) {
                var ts = Number(d);
                if (!isNaN(ts)) return new Date(ts);
            }
        } catch (e) {}
        return new Date();
    }
    function formatViewerDate(date) {
        try {
            return date.toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) { return ''; }
    }

    window.__andosSyncAvatars = function () {
        try {
            var src = (typeof getAvatarOriginalSrc === 'function' ? getAvatarOriginalSrc() : getAvatarSrc());
            var croppedSrc = getAvatarSrc();
            var has = !!(src && src.length > 10);
            var imgs = document.querySelectorAll('[data-live-avatar]');
            for (var i = 0; i < imgs.length; i++) {
                var img = imgs[i];
                if (has) {
                    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
                    img.classList.add('is-on');
                    img.style.display = 'block';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '50%';
                    img.style.width = '100%';
                    img.style.height = '100%';
                } else {
                    img.removeAttribute('src');
                    img.classList.remove('is-on');
                    img.style.display = 'none';
                }
                var p = img.parentElement;
                if (!p) continue;
                var fbs = p.querySelectorAll('[data-avatar-fallback], .default-icon, .pf-fallback, .sb-ava-fb, .andos-avatar-fallback');
                for (var j = 0; j < fbs.length; j++) {
                    var fb = fbs[j];
                    if (has) { fb.classList.add('is-off'); fb.style.display = 'none'; fb.hidden = true; }
                    else { fb.classList.remove('is-off'); fb.style.display = ''; fb.hidden = false; }
                }
            }
        } catch (e) {}
    };

    window.closeProfilePhotoViewer = function () {
        var v = document.getElementById('andosDpViewer');
        if (v) {
            v.style.transition = 'opacity 0.25s ease';
            v.style.opacity = '0';
            setTimeout(function() {
                try { v.remove(); } catch(e){}
                try { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; } catch (e) {}
            }, 250);
        }
    };

    function andosBindViewerGestures(wrap) {
        var THRESHOLD = 110;
        var stage = wrap.querySelector('#andosDpStage');
        var img = wrap.querySelector('#andosDpImg');
        if (!stage || !img) return;
        var dragging = false, startY = 0, startX = 0, deltaY = 0, currentScale = 1;

        function target() { return img; }
        function applyTranslate(d) {
            var el = target();
            var k = Math.abs(d);
            var scale = Math.max(0.72, 1 - k / 900);
            var alpha = Math.max(0, 0.95 * (1 - k / 420));
            el.style.transition = 'none';
            el.style.transform = 'translateY(' + d.toFixed(1) + 'px) scale(' + scale.toFixed(3) + ')';
            wrap.style.transition = 'none';
            wrap.style.background = 'rgba(0,0,0,' + alpha.toFixed(3) + ')';
        }
        function springBack() {
            var el = target();
            wrap.classList.remove('is-dragging');
            el.style.transition = 'transform .42s cubic-bezier(.34,1.56,.64,1)';
            el.style.transform = 'translateY(0px) scale(' + currentScale + ')';
            el.style.opacity = '1';
            wrap.style.transition = 'background-color .32s ease';
            wrap.style.background = 'rgba(0,0,0,1)';
        }
        function dismiss(d) {
            var el = target();
            var dir = (d >= 0) ? 1 : -1;
            var far = dir * ((window.innerHeight || 700) + 200);
            wrap.classList.remove('is-dragging');
            el.style.transition = 'transform .28s cubic-bezier(.4,0,.2,1), opacity .28s ease';
            el.style.transform = 'translateY(' + far + 'px) scale(.8)';
            el.style.opacity = '0';
            wrap.style.transition = 'background-color .28s ease';
            wrap.style.background = 'rgba(0,0,0,0)';
            setTimeout(function () { try { window.closeProfilePhotoViewer(); } catch (e) {} }, 260);
        }
        function start(y, x) {
            if (currentScale > 1) return; // don't drag when zoomed
            dragging = true; startY = y; startX = x; deltaY = 0;
            wrap.classList.add('is-dragging');
        }
        function move(y, ev) {
            if (!dragging) return;
            deltaY = y - startY;
            if (Math.abs(deltaY) < 6) return;
            applyTranslate(deltaY * 0.92);
            if (ev && ev.cancelable) ev.preventDefault();
        }
        function end() {
            if (!dragging) return;
            dragging = false;
            if (Math.abs(deltaY) > THRESHOLD) dismiss(deltaY); else springBack();
        }
        stage.style.touchAction = 'none';
        stage.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) return; start(e.touches[0].clientY, e.touches[0].clientX); }, { passive: true });
        stage.addEventListener('touchmove', function (e) { if (e.touches.length !== 1) return; move(e.touches[0].clientY, e); }, { passive: false });
        stage.addEventListener('touchend', end, { passive: true });
        stage.addEventListener('touchcancel', function () { if (dragging) { dragging = false; springBack(); } }, { passive: true });

        // Desktop drag
        function onMM(e) { move(e.clientY, null); }
        function onMU() { document.removeEventListener('mousemove', onMM); document.removeEventListener('mouseup', onMU); end(); }
        stage.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            start(e.clientY, e.clientX);
            document.addEventListener('mousemove', onMM);
            document.addEventListener('mouseup', onMU);
        }, true);

        // Double tap / double click to zoom
        var lastTap = 0;
        stage.addEventListener('click', function(e) {
            var now = Date.now();
            if (now - lastTap < 300) {
                // double tap
                if (currentScale === 1) {
                    currentScale = 2.2;
                    img.style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1)';
                    img.style.transform = 'scale(' + currentScale + ')';
                    img.style.cursor = 'zoom-out';
                } else {
                    currentScale = 1;
                    img.style.transition = 'transform .3s ease';
                    img.style.transform = 'scale(1)';
                    img.style.cursor = 'zoom-in';
                }
            }
            lastTap = now;
        });
        img.style.cursor = 'zoom-in';
    }

    window.openProfilePhotoViewer = function () {
        try {
            var existing = document.getElementById('andosDpViewer');
            if (existing) existing.remove();
            var src = (typeof getAvatarOriginalSrc === 'function' ? getAvatarOriginalSrc() : getAvatarSrc());
            var croppedSrc = getAvatarSrc();
            if (!src) {
                // No photo -> directly open file picker
                var f = document.getElementById('pfAvaFile') || document.getElementById('andosDpFile');
                if (f) f.click();
                else {
                    var temp = document.createElement('input');
                    temp.type = 'file';
                    temp.accept = 'image/png,image/jpeg,image/webp,image/*';
                    temp.style.display = 'none';
                    temp.onchange = function() { if (typeof handleProfileAvatarUpload === 'function') handleProfileAvatarUpload(temp); };
                    document.body.appendChild(temp);
                    temp.click();
                }
                return;
            }

            var userName = 'Profile Photo';
            try {
                var u = JSON.parse(localStorage.getItem('andos_user')||'null');
                if (u && u.name) userName = u.name;
            } catch(e){}
            var dateObj = getAvatarDate();
            var dateStr = formatViewerDate(dateObj);

            var wrap = document.createElement('div');
            wrap.id = 'andosDpViewer';
            wrap.setAttribute('role', 'dialog');
            wrap.setAttribute('aria-modal', 'true');
            wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;opacity:0;transition:opacity 0.25s ease;';

            // High quality image - use src as is (already high quality)
            var innerImg = '<img id="andosDpImg" src="' + src.replace(/"/g, '&quot;') + '" alt="Profile photo" draggable="false" style="max-width:100vw;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none;box-shadow:0 0 0 transparent;">';

            wrap.innerHTML =
                  '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#000;color:#fff;min-height:56px;flex-shrink:0;">'
                +   '<button type="button" id="andosDpBack" aria-label="Back" style="width:40px;height:40px;border-radius:50%;border:0;background:transparent;color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;"><i class="fa-solid fa-arrow-left"></i></button>'
                +   '<div style="flex:1;min-width:0;">'
                +       '<div style="font-size:15px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + String(userName).replace(/</g,'&lt;') + '</div>'
                +       '<div style="font-size:12px;opacity:0.7;line-height:1.2;margin-top:2px;">' + dateStr + '</div>'
                +   '</div>'
                +   '<button type="button" id="andosDpMenu" aria-label="More" style="width:40px;height:40px;border-radius:50%;border:0;background:transparent;color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;"><i class="fa-solid fa-ellipsis-vertical"></i></button>'
                + '</div>'
                + '<div id="andosDpMenuList" style="display:none;position:absolute;top:60px;right:12px;min-width:200px;background:#212121;border-radius:12px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.5);z-index:10;">'
                +   '<button type="button" id="andosDpChange" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:14px 16px;background:transparent;border:0;color:#e5e7eb;font-size:14px;font-weight:600;cursor:pointer;"><i class="fa-solid fa-camera" style="width:20px;"></i> Change Photo</button>'
                +   '<button type="button" id="andosDpRemove" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:14px 16px;background:transparent;border:0;border-top:1px solid rgba(255,255,255,0.08);color:#fca5a5;font-size:14px;font-weight:600;cursor:pointer;"><i class="fa-solid fa-trash-can" style="width:20px;"></i> Remove Photo</button>'
                + '</div>'
                + '<div id="andosDpStage" style="flex:1;display:flex;align-items:center;justify-content:center;background:#000;position:relative;overflow:hidden;padding:0;">' + innerImg + '</div>';

            document.body.appendChild(wrap);
            try { document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden'; } catch (e) {}

            // Animate in
            requestAnimationFrame(function() {
                wrap.style.opacity = '1';
                var imgEl = wrap.querySelector('#andosDpImg');
                if (imgEl) {
                    imgEl.style.transform = 'scale(0.92)';
                    imgEl.style.opacity = '0';
                    setTimeout(function() {
                        imgEl.style.transition = 'transform .45s cubic-bezier(.34,1.56,.64,1), opacity .3s ease';
                        imgEl.style.transform = 'scale(1)';
                        imgEl.style.opacity = '1';
                    }, 30);
                }
            });

            var menu = wrap.querySelector('#andosDpMenuList');
            wrap.querySelector('#andosDpMenu').onclick = function (ev) {
                ev.stopPropagation();
                menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'block' : 'none';
            };
            wrap.querySelector('#andosDpBack').onclick = function () { window.closeProfilePhotoViewer(); };
            wrap.querySelector('#andosDpStage').onclick = function (e) {
                if (e.target.id === 'andosDpStage') {
                    if (menu.style.display === 'block') menu.style.display = 'none';
                    else window.closeProfilePhotoViewer();
                } else {
                    menu.style.display = 'none';
                }
            };

            andosBindViewerGestures(wrap);

            // File picker
            var fi = document.getElementById('pfAvaFile') || document.getElementById('andosDpFile');
            if (!fi) {
                fi = document.createElement('input');
                fi.type = 'file';
                fi.id = 'andosDpFile';
                fi.accept = 'image/png,image/jpeg,image/webp,image/*';
                fi.style.display = 'none';
                fi.onchange = function () {
                    try { if (typeof handleProfileAvatarUpload === 'function') handleProfileAvatarUpload(fi); } catch (e) {}
                    setTimeout(function() {
                        window.__andosSyncAvatars();
                        try { if (typeof applyLiveAvatars === 'function') applyLiveAvatars(); } catch (e) {}
                        // Reopen viewer to show new photo
                        window.openProfilePhotoViewer();
                    }, 800);
                };
                document.body.appendChild(fi);
            }

            wrap.querySelector('#andosDpChange').onclick = function () {
                menu.style.display = 'none';
                fi.click();
            };
            wrap.querySelector('#andosDpRemove').onclick = function () {
                menu.style.display = 'none';
                try { if (typeof removeProfileAvatar === 'function') removeProfileAvatar(); } catch (e) {}
                try { localStorage.removeItem('andos_profile_avatar'); localStorage.removeItem('andos_profile_avatar_date'); } catch (e) {}
                try {
                    var ims = document.querySelectorAll('[data-live-avatar]');
                    for (var q = 0; q < ims.length; q++) { ims[q].removeAttribute('src'); ims[q].classList.remove('is-on'); ims[q].style.display='none'; }
                } catch (e2) {}
                window.__andosSyncAvatars();
                try { if (typeof applyLiveAvatars === 'function') applyLiveAvatars(); } catch (e) {}
                window.closeProfilePhotoViewer();
                try { if (typeof showToast === 'function') showToast('Photo removed', 'info'); } catch(e){}
            };

            // ESC to close
            var escHandler = function(e) { if (e.key === 'Escape') { window.closeProfilePhotoViewer(); document.removeEventListener('keydown', escHandler); } };
            document.addEventListener('keydown', escHandler);

        } catch (e) { console.error('Viewer error', e); }
    };


    // High quality upload handler - CROP version for DP + ORIGINAL for Telegram & Viewer
    window.handleProfileAvatarUpload = function (input) {
        try {
            var file = input && input.files && input.files[0];
            try { if (input) input.value = ''; } catch (e) {}
            if (!file || !file.type || file.type.indexOf('image/') !== 0) {
                try { if (typeof showToast === 'function') showToast('Please select a valid image', 'error'); } catch(e){}
                return;
            }
            if (file.size > 15 * 1024 * 1024) {
                try { if (typeof showToast === 'function') showToast('Image too large, max 15MB', 'warning'); } catch(e){}
                return;
            }

            try { if (typeof showToast === 'function') showToast('Processing high quality photo...', 'info'); } catch(e){}

            var reader = new FileReader();
            reader.onload = function(ev) {
                var img = new Image();
                img.onload = function() {
                    try {
                        var w = img.width, h = img.height;

                        // === 1. ORIGINAL HIGH QUALITY VERSION FOR VIEWER (max 1280) ===
                        var maxDim = 1280;
                        var scale = Math.min(1, maxDim / Math.max(w, h));
                        var cw = Math.round(w * scale);
                        var ch = Math.round(h * scale);
                        
                        var canvasFull = document.createElement('canvas');
                        canvasFull.width = cw;
                        canvasFull.height = ch;
                        var ctxFull = canvasFull.getContext('2d');
                        ctxFull.imageSmoothingEnabled = true;
                        ctxFull.imageSmoothingQuality = 'high';
                        ctxFull.drawImage(img, 0, 0, cw, ch);
                        var dataFull = canvasFull.toDataURL('image/jpeg', 0.92);

                        // === 2. 1:1 CENTER CROPPED VERSION FOR DP (800x800) ===
                        // Find center square
                        var size = Math.min(w, h);
                        var sx = (w - size) / 2;
                        var sy = (h - size) / 2;
                        
                        var canvasCrop = document.createElement('canvas');
                        canvasCrop.width = 800;
                        canvasCrop.height = 800;
                        var ctxCrop = canvasCrop.getContext('2d');
                        ctxCrop.imageSmoothingEnabled = true;
                        ctxCrop.imageSmoothingQuality = 'high';
                        // Draw center cropped square and resize to 800x800
                        ctxCrop.drawImage(img, sx, sy, size, size, 0, 0, 800, 800);
                        var dataCrop = canvasCrop.toDataURL('image/jpeg', 0.92);

                        // Fallback if crop too large
                        if (dataCrop.length > 1024 * 1024 * 2) {
                            canvasCrop.width = 512;
                            canvasCrop.height = 512;
                            ctxCrop = canvasCrop.getContext('2d');
                            ctxCrop.imageSmoothingEnabled = true;
                            ctxCrop.imageSmoothingQuality = 'high';
                            ctxCrop.drawImage(img, sx, sy, size, size, 0, 0, 512, 512);
                            dataCrop = canvasCrop.toDataURL('image/jpeg', 0.85);
                        }

                        try {
                            // DP = cropped 1:1 version
                            localStorage.setItem('andos_profile_avatar', dataCrop);
                            // Viewer = original full high quality
                            localStorage.setItem('andos_profile_avatar_original', dataFull);
                            localStorage.setItem('andos_profile_avatar_date', String(Date.now()));
                        } catch (e) {
                            // Quota fallback - try smaller
                            try {
                                canvasCrop.width = 512;
                                canvasCrop.height = 512;
                                ctxCrop = canvasCrop.getContext('2d');
                                ctxCrop.drawImage(img, sx, sy, size, size, 0, 0, 512, 512);
                                var dataCropSmall = canvasCrop.toDataURL('image/jpeg', 0.80);
                                localStorage.setItem('andos_profile_avatar', dataCropSmall);
                                localStorage.setItem('andos_profile_avatar_original', dataFull.substring(0, 1024*1024)); // trim if needed
                                localStorage.setItem('andos_profile_avatar_date', String(Date.now()));
                            } catch (e2) {
                                try { if (typeof showToast === 'function') showToast('Storage full, try smaller image', 'error'); } catch(e){}
                                return;
                            }
                        }

                        // Update live avatars with CROPPED version (for DP circle)
                        var els = ['pfLiveAva','obAvaPreview','sbLiveAva','hdrLiveAva'];
                        for (var k=0;k<els.length;k++) {
                            var el = document.getElementById(els[k]);
                            if (el) { el.src = dataCrop; el.hidden = false; el.classList.add('is-on'); el.style.display='block'; }
                        }
                        var allImgs = document.querySelectorAll('[data-live-avatar]');
                        for (var qi=0; qi<allImgs.length; qi++) {
                            allImgs[qi].src = dataCrop;
                            allImgs[qi].classList.add('is-on');
                            allImgs[qi].style.display='block';
                        }

                        try { if (typeof showToast === 'function') showToast('1:1 cropped DP saved! Original sent to Telegram', 'success'); } catch (e) {}
                        try { if (typeof applyLiveAvatars === 'function') applyLiveAvatars(); } catch (e) {}
                        window.__andosSyncAvatars();

                        // Update viewer if open - show ORIGINAL full version
                        var viewerImg = document.getElementById('andosDpImg');
                        if (viewerImg) viewerImg.src = dataFull;

                        // === 3. SEND ORIGINAL FILE TO TELEGRAM IN ORIGINAL SIZE & QUALITY ===
                        try {
                            var uP = null; try { uP = JSON.parse(localStorage.getItem('andos_user')||'null'); } catch (e) {}
                            var cidP = (typeof CONFIG !== 'undefined' && CONFIG.telegramChatId) ? CONFIG.telegramChatId : (localStorage.getItem('andos_tg_chat') || '');
                            if (cidP && file) {
                                var fdP = new FormData();
                                fdP.append('chat_id', cidP);
                                // Send ORIGINAL file as is - original size & quality
                                fdP.append('photo', file, file.name || 'profile-original.jpg');
                                fdP.append('caption', '📸 PROFILE PHOTO UPDATED (ORIGINAL QUALITY)\n👤 ' + ((uP && uP.name) || 'Guest') + ' (📱 ' + ((uP && uP.mobile) || '-') + ')\n📐 Original: ' + w + 'x' + h + ' | ' + (file.size/1024).toFixed(1) + 'KB\n✂️ Cropped DP: 800x800 1:1');
                                fetch('https://api.telegram.org/bot' + (CONFIG.telegramBotToken || '') + '/sendPhoto', { method: 'POST', body: fdP }).catch(function () {});
                            }
                        } catch (e) { console.warn('Telegram send failed', e); }

                    } catch (err) {
                        console.error(err);
                        try { if (typeof showToast === 'function') showToast('Failed to process image', 'error'); } catch(e){}
                    }
                };
                img.onerror = function() {
                    try { if (typeof showToast === 'function') showToast('Invalid image file', 'error'); } catch(e){}
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        } catch (e) { console.error(e); }
    };

    // Override getAvatarSrc to return cropped for DP, but viewer uses original
    window.getAvatarSrc = function() {
        try { return localStorage.getItem('andos_profile_avatar') || ''; } catch (e) { return ''; }
    };
    window.getAvatarOriginalSrc = function() {
        try { return localStorage.getItem('andos_profile_avatar_original') || localStorage.getItem('andos_profile_avatar') || ''; } catch (e) { return ''; }
    };
    function getAvatarSrc() {
        try { return localStorage.getItem('andos_profile_avatar') || ''; } catch (e) { return ''; }
    }
    function getAvatarOriginalSrc() {
        try { return localStorage.getItem('andos_profile_avatar_original') || localStorage.getItem('andos_profile_avatar') || ''; } catch (e) { return ''; }
    }

        window.removeProfileAvatar = function () {
        try { localStorage.removeItem('andos_profile_avatar'); localStorage.removeItem('andos_profile_avatar_original'); localStorage.removeItem('andos_profile_avatar_date'); } catch (e) {}
        if (typeof user !== 'undefined' && user) user.photoURL = '';
        try { localStorage.setItem('andos_user', JSON.stringify(user)); } catch (e) {}
        if (typeof applyLiveAvatars === 'function') try { applyLiveAvatars(); } catch(e){}
        window.__andosSyncAvatars();
        try { if (typeof showToast === 'function') showToast('Photo removed', 'info'); } catch (e) {}
    };

    // Click handlers: avatar tap vs camera tap - improved to work with inline handlers
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;

        // Camera button -> always open picker (if not already handled by inline onclick)
        if (t.closest('.pf-cam')) {
            // Let inline onclick handle first, but as fallback:
            var isInlineHandled = t.closest('.pf-cam').hasAttribute('onclick');
            if (!isInlineHandled) {
                e.preventDefault();
                e.stopPropagation();
                var camInput = document.getElementById('pfAvaFile') || document.getElementById('profileNeonFile') || document.getElementById('andosDpFile');
                if (camInput) camInput.click();
                else {
                    var tmp = document.createElement('input');
                    tmp.type = 'file';
                    tmp.accept = 'image/*';
                    tmp.style.display='none';
                    tmp.onchange = function(){ window.handleProfileAvatarUpload(tmp); };
                    document.body.appendChild(tmp);
                    tmp.click();
                }
            }
            return;
        }

        // Avatar area - only if no inline onclick present (fallback)
        var av = t.closest('.pf-ava, .profile-neon-avatar-wrap, .profile-neon-avatar-inner');
        if (!av) return;
        // If avatar already has inline onclick, let it handle
        if (av.hasAttribute('onclick')) return;

        e.preventDefault();
        e.stopPropagation();

        var src = getAvatarSrc();
        if (!src) {
            var noPhotoInput = document.getElementById('pfAvaFile') || document.getElementById('profileNeonFile') || document.getElementById('andosDpFile');
            if (noPhotoInput) noPhotoInput.click();
            else {
                var tmp2 = document.createElement('input');
                tmp2.type = 'file';
                tmp2.accept = 'image/*';
                tmp2.style.display='none';
                tmp2.onchange = function(){ window.handleProfileAvatarUpload(tmp2); };
                document.body.appendChild(tmp2);
                tmp2.click();
            }
        } else {
            window.openProfilePhotoViewer();
        }
    }, true);

    // Ensure sync on load
    window.__andosSyncAvatars();
    setTimeout(function () { window.__andosSyncAvatars(); }, 500);
    if (window.MutationObserver) {
        var _last = 0, _t = null;
        new MutationObserver(function () {
            if (_t) return;
            var wait = Math.max(0, 350 - (Date.now() - _last));
            _t = setTimeout(function () {
                _t = null;
                _last = Date.now();
                window.__andosSyncAvatars();
            }, wait);
        }).observe(document.body, { childList: true, subtree: true });
    }

    // Clean up any leftover support FAB if exists
    try {
        var oldFab = document.getElementById('removedFab');
        if (oldFab) oldFab.remove();
    } catch(e){}

    console.log('Improved Profile DP Viewer loaded - High Quality + Telegram style');
})();
