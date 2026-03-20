/* ================================================================
   BusTrack Dashboard — script.js
   OSRM road-snapped routing + requestAnimationFrame animation
   All 5 buses animate along real roads simultaneously on dashboard.
   Selected route animates on the track view map independently.
   ================================================================ */

document.addEventListener("DOMContentLoaded", () => {

    /* ──────────────────────────────────────────────────────────────
       0. ROLE CHECK
    ────────────────────────────────────────────────────────────── */
    const role = sessionStorage.getItem('bt_role') || 'student';
    if (role === 'admin') {
        document.body.classList.add('role-admin');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    /* ──────────────────────────────────────────────────────────────
       1. ROUTE DEFINITIONS  (named stops; OSRM road-snaps between them)
    ────────────────────────────────────────────────────────────── */
    const COLLEGE = [15.8765, 74.5198];

    const routeDefs = {
        rto: {
            name: 'R.T.O', busId: 'CB-101', color: '#4F6FFF', duration: 35,
            stops: [[15.8497,74.4977],[15.8558,74.5008],[15.8635,74.5055],[15.8702,74.5140],COLLEGE]
        },
        sambra: {
            name: 'Sambra', busId: 'CB-102', color: '#22C55E', duration: 42,
            stops: [[15.8590,74.6189],[15.8620,74.5800],[15.8650,74.5500],[15.8710,74.5300],COLLEGE]
        },
        mahantesh: {
            name: 'Mahantesh Nagar', busId: 'CB-103', color: '#F59E0B', duration: 28,
            stops: [[15.8672,74.5060],[15.8700,74.5100],[15.8730,74.5150],COLLEGE]
        },
        vadagaon: {
            name: 'Vadagaon', busId: 'CB-104', color: '#A78BFA', duration: 32,
            stops: [[15.8950,74.5250],[15.8870,74.5220],[15.8810,74.5205],COLLEGE]
        },
        hanuman: {
            name: 'Hanuman Nagar', busId: 'CB-105', color: '#22D3EE', duration: 50,
            stops: [[15.8720,74.4900],[15.8730,74.5000],[15.8745,74.5100],COLLEGE]
        }
    };

    let selectedRoute = 'rto';

    /* ──────────────────────────────────────────────────────────────
       2. SHARED UTILITIES
    ────────────────────────────────────────────────────────────── */

    function calcBearing(a, b) {
        const toRad = d => d * Math.PI / 180;
        const toDeg = r => r * 180 / Math.PI;
        const dL = toRad(b[1] - a[1]);
        const l1 = toRad(a[0]), l2 = toRad(b[0]);
        const y  = Math.sin(dL) * Math.cos(l2);
        const x  = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dL);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

    function lerpCoords(coords, segIdx, t) {
        const a = coords[segIdx];
        const b = coords[Math.min(segIdx + 1, coords.length - 1)];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }

    // Animation speed: complete the route in `durationMins` minutes (per frame ms)
    function routeSpeed(durationMins) {
        return 1 / (durationMins * 60 * 1000);
    }

    function makeBusIcon(color, bearing) {
        return L.divIcon({
            className: '',
            html: `<div style="width:34px;height:34px;display:flex;align-items:center;
                       justify-content:center;filter:drop-shadow(0 3px 10px ${color}90);
                       transform:rotate(${bearing || 0}deg);transition:transform 0.5s ease;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"
                     style="width:34px;height:34px;fill:${color}">
                  <path d="M184,24H72A32,32,0,0,0,40,56V208a16,16,0,0,0,16,16H56
                           a16,16,0,0,0,16-16V192h112v16a16,16,0,0,0,16,16h0
                           a16,16,0,0,0,16-16V56A32,32,0,0,0,184,24ZM56,168V120H200v48Z
                           M200,104H56V56a16,16,0,0,1,16-16H184a16,16,0,0,1,16,16Z
                           M88,84a12,12,0,1,1-12-12A12,12,0,0,1,88,84Zm92,0
                           a12,12,0,1,1-12-12A12,12,0,0,1,180,84Zm-8,92
                           a12,12,0,1,1-12-12A12,12,0,0,1,172,176Zm-80,0
                           a12,12,0,1,1-12-12A12,12,0,0,1,92,176Z"/>
                </svg></div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });
    }

    function makeCollegeIcon() {
        return L.divIcon({
            className: '',
            html: `<div style="width:28px;height:28px;background:#4F6FFF;border-radius:50%;
                       display:flex;align-items:center;justify-content:center;
                       box-shadow:0 3px 10px rgba(79,111,255,0.55);border:2px solid #0D0F14;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"
                     style="width:16px;height:16px;fill:#fff">
                  <path d="M240,208H224V96a16,16,0,0,0-16-16H144V48a16,16,0,0,0-16-16H48
                           A16,16,0,0,0,32,48V208H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16Z
                           M208,96V208H144V96ZM48,48h80V208H48ZM64,88a8,8,0,0,1,8-8H104
                           a8,8,0,0,1,0,16H72A8,8,0,0,1,64,88Zm0,40a8,8,0,0,1,8-8H104
                           a8,8,0,0,1,0,16H72A8,8,0,0,1,64,128Z"/>
                </svg></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
    }

    async function fetchOSRMRoute(stops) {
        const coordStr = stops.map(s => `${s[1]},${s[0]}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}` +
                    `?overview=full&geometries=geojson&steps=false`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(7000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data.routes?.[0]) throw new Error('No route returned');
        return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
    }

    function densifyStops(stops, steps = 60) {
        const out = [];
        for (let i = 0; i < stops.length - 1; i++) {
            for (let t = 0; t < steps; t++) {
                out.push([
                    stops[i][0] + (stops[i+1][0] - stops[i][0]) * (t / steps),
                    stops[i][1] + (stops[i+1][1] - stops[i][1]) * (t / steps),
                ]);
            }
        }
        out.push(stops[stops.length - 1]);
        return out;
    }

    /* ──────────────────────────────────────────────────────────────
       3. DASHBOARD MAP  — all 5 buses, each with own rAF loop
    ────────────────────────────────────────────────────────────── */

    let dashboardMap      = null;
    let dashboardMapReady = false;

    // Per-route state for dashboard
    const ds = {};
    Object.keys(routeDefs).forEach(k => {
        ds[k] = { coords:[], segIdx:0, segT:Math.random()*0.3, lastTs:null,
                  rafId:null, marker:null, covLine:null, baseLine:null, ready:false };
    });

    function runDashAnim(key) {
        const st  = ds[key];
        const def = routeDefs[key];

        function frame(ts) {
            if (st.lastTs === null) st.lastTs = ts;
            const dt = Math.min(ts - st.lastTs, 200);
            st.lastTs = ts;

            const coords = st.coords;
            const speed  = routeSpeed(def.duration);

            st.segT += speed * dt * (coords.length - 1);
            while (st.segT >= 1 && st.segIdx < coords.length - 2) {
                st.segT -= 1;
                st.segIdx++;
            }
            if (st.segIdx >= coords.length - 1) { st.segIdx = 0; st.segT = 0; }
            st.segT = Math.min(st.segT, 1);

            const pos  = lerpCoords(coords, st.segIdx, st.segT);
            const hdg  = calcBearing(coords[st.segIdx], coords[Math.min(st.segIdx+1, coords.length-1)]);

            st.marker?.setLatLng(pos);
            st.marker?.setIcon(makeBusIcon(def.color, hdg));

            const covered = coords.slice(0, st.segIdx + 1).concat([pos]);
            st.covLine?.setLatLngs(covered);

            st.rafId = requestAnimationFrame(frame);
        }

        cancelAnimationFrame(st.rafId);
        st.rafId = requestAnimationFrame(frame);
    }

    async function loadDashRoute(key) {
        const st  = ds[key];
        const def = routeDefs[key];
        const map = dashboardMap;

        // Skeleton
        st.baseLine = L.polyline(def.stops, { color:'#2D344F', weight:4, opacity:0.6 }).addTo(map);

        // Marker at start
        st.marker = L.marker(def.stops[0], { icon: makeBusIcon(def.color, 0) }).addTo(map);
        st.marker.bindPopup(`<b>${def.name}</b><br>Bus ${def.busId}`);

        // Fetch OSRM
        let coords;
        try {
            coords = await fetchOSRMRoute(def.stops);
        } catch(e) {
            console.warn(`OSRM [${key}]:`, e.message);
            coords = densifyStops(def.stops);
        }
        st.coords = coords;

        map.removeLayer(st.baseLine);
        st.baseLine = L.polyline(coords, { color:'#2D344F', weight:4, opacity:0.6 }).addTo(map);
        st.covLine  = L.polyline([coords[0]], { color:def.color, weight:4, opacity:0.9 }).addTo(map);
        st.covLine.bringToFront();

        // Start segIdx partway through based on initial segT
        st.segIdx = Math.min(Math.floor(st.segT * (coords.length - 1)), coords.length - 2);
        st.segT   = (st.segT * (coords.length - 1)) - st.segIdx;
        st.ready  = true;

        runDashAnim(key);
    }

    function initDashboardMap() {
        if (dashboardMapReady) {
            setTimeout(() => dashboardMap?.invalidateSize(), 250);
            return;
        }
        dashboardMap = L.map('dashboard-map', { zoomControl:true }).setView([15.8600, 74.5200], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(dashboardMap);

        L.marker(COLLEGE, { icon: makeCollegeIcon() })
         .addTo(dashboardMap)
         .bindPopup('<b>JCER</b><br>Destination');

        Object.keys(routeDefs).forEach(key => loadDashRoute(key));

        dashboardMapReady = true;
        setTimeout(() => dashboardMap?.invalidateSize(), 250);
    }

    initDashboardMap();

    /* ──────────────────────────────────────────────────────────────
       4. TRACK MAP  — single selected route with follow-cam
    ────────────────────────────────────────────────────────────── */

    const trackMap = L.map('map', { zoomControl:true }).setView([15.8600, 74.5200], 14);

    // Listen for live bus location from socket (injected by index.html)
    window.addEventListener("liveBusLocation", (e) => {
        const data = e.detail;
        const pos = [data.lat, data.lng];
        if (tr.marker) tr.marker.setLatLng(pos);
        if (!trackMap._mapFollowPaused) {
            trackMap.panTo(pos, { animate:true, duration:0.5 });
        }
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(trackMap);

    trackMap.on('dragstart', () => { trackMap._mapFollowPaused = true; });
    trackMap.on('dblclick',  () => { trackMap._mapFollowPaused = false; });

    const tr = {
        baseLine:null, covLine:null, marker:null, stopMarkers:[],
        coords:[], segIdx:0, segT:0, lastTs:null, rafId:null, routeKey:null
    };

    function clearTrackLayers() {
        cancelAnimationFrame(tr.rafId);
        tr.rafId = null; tr.lastTs = null;
        if (tr.baseLine) { trackMap.removeLayer(tr.baseLine); tr.baseLine = null; }
        if (tr.covLine)  { trackMap.removeLayer(tr.covLine);  tr.covLine  = null; }
        if (tr.marker)   { trackMap.removeLayer(tr.marker);   tr.marker   = null; }
        tr.stopMarkers.forEach(m => trackMap.removeLayer(m));
        tr.stopMarkers = [];
    }

    function runTrackAnim() {
        const def = routeDefs[tr.routeKey];

        function frame(ts) {
            if (tr.lastTs === null) tr.lastTs = ts;
            const dt = Math.min(ts - tr.lastTs, 200);
            tr.lastTs = ts;

            const coords = tr.coords;
            const speed  = routeSpeed(def.duration);

            tr.segT += speed * dt * (coords.length - 1);
            while (tr.segT >= 1 && tr.segIdx < coords.length - 2) {
                tr.segT -= 1;
                tr.segIdx++;
            }
            if (tr.segIdx >= coords.length - 1) { tr.segIdx = 0; tr.segT = 0; }
            tr.segT = Math.min(tr.segT, 1);

            const pos  = lerpCoords(coords, tr.segIdx, tr.segT);
            const hdg  = calcBearing(coords[tr.segIdx], coords[Math.min(tr.segIdx+1, coords.length-1)]);

            tr.marker?.setLatLng(pos);
            tr.marker?.setIcon(makeBusIcon(def.color, hdg));

            const covered = coords.slice(0, tr.segIdx + 1).concat([pos]);
            tr.covLine?.setLatLngs(covered);

            // ETA HUD update
            const pct = (tr.segIdx + tr.segT) / (coords.length - 1);
            const eta = Math.max(0, Math.round((1 - pct) * def.duration));
            const etaEl = document.getElementById('etaDisplay');
            if (etaEl) etaEl.textContent = eta > 0 ? `~${eta} mins` : 'Arriving…';

            if (!trackMap._mapFollowPaused) {
                trackMap.panTo(pos, { animate:true, duration:0.6, easeLinearity:0.5 });
            }

            tr.rafId = requestAnimationFrame(frame);
        }

        cancelAnimationFrame(tr.rafId);
        tr.rafId = requestAnimationFrame(frame);
    }

    async function loadRouteOnTrackMap(routeKey) {
        clearTrackLayers();
        tr.routeKey = routeKey;
        const def = routeDefs[routeKey];

        // Update track header
        const badge  = document.getElementById('trackRouteBadge');
        const busLbl = document.getElementById('trackBusLabel');
        if (badge) {
            badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"
              style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:5px">
              <path d="M184,24H72A32,32,0,0,0,40,56V208a16,16,0,0,0,16,16H56a16,16,0,0,0,16-16V192
              h112v16a16,16,0,0,0,16,16h0a16,16,0,0,0,16-16V56A32,32,0,0,0,184,24ZM56,168V120H200v48Z
              M200,104H56V56a16,16,0,0,1,16-16H184a16,16,0,0,1,16,16ZM88,84a12,12,0,1,1-12-12A12,12,0,0,1,88,84Z
              m92,0a12,12,0,1,1-12-12A12,12,0,0,1,180,84Zm-8,92a12,12,0,1,1-12-12A12,12,0,0,1,172,176Z
              m-80,0a12,12,0,1,1-12-12A12,12,0,0,1,92,176Z"/></svg>${def.name}`;
            badge.style.cssText += `;color:${def.color};border-color:${def.color}44;background:${def.color}18`;
        }
        if (busLbl) busLbl.innerHTML = `Bus <span>${def.busId}</span>`;

        // Skeleton line while OSRM loads
        tr.baseLine = L.polyline(def.stops, { color:'#2D344F', weight:6, opacity:0.65 }).addTo(trackMap);

        // Stop circle markers
        def.stops.forEach((stop, i) => {
            const isFirst = i === 0, isLast = i === def.stops.length - 1;
            const col = isFirst ? def.color : isLast ? '#22C55E' : '#6B7280';
            const m = L.circleMarker(stop, {
                radius: isFirst || isLast ? 9 : 6,
                fillColor: col, color:'#0D0F14', weight:2.5, fillOpacity:1
            }).addTo(trackMap);
            if (isFirst) m.bindPopup(`<b>${def.name} (Start)</b>`);
            if (isLast)  m.bindPopup('<b>JCER (Destination)</b>');
            tr.stopMarkers.push(m);
        });

        // College icon
        const cm = L.marker(COLLEGE, { icon: makeCollegeIcon() }).addTo(trackMap);
        cm.bindPopup('<b>JCER</b><br>Destination');
        tr.stopMarkers.push(cm);

        // Bus placeholder
        tr.marker = L.marker(def.stops[0], { icon: makeBusIcon(def.color, 0) }).addTo(trackMap);
        tr.marker.bindPopup(`<b>${def.name}</b><br>Bus ${def.busId}`).openPopup();

        trackMap.fitBounds(L.latLngBounds(def.stops), { padding:[50,50] });
        setTimeout(() => trackMap.invalidateSize(), 200);

        // Fetch OSRM
        let coords;
        try {
            coords = await fetchOSRMRoute(def.stops);
        } catch(e) {
            console.warn(`OSRM [${routeKey}]:`, e.message);
            coords = densifyStops(def.stops);
        }
        tr.coords = coords;

        trackMap.removeLayer(tr.baseLine);
        tr.baseLine = L.polyline(coords, { color:'#2D344F', weight:6, opacity:0.65 }).addTo(trackMap);
        tr.covLine  = L.polyline([coords[0]], { color:def.color, weight:6, opacity:0.95 }).addTo(trackMap);
        tr.covLine.bringToFront();

        tr.segIdx = 0; tr.segT = 0; tr.lastTs = null;
        trackMap.fitBounds(L.latLngBounds(coords), { padding:[50,50] });

        runTrackAnim();
    }

    loadRouteOnTrackMap(selectedRoute);

    /* ──────────────────────────────────────────────────────────────
       5. VIEW SWITCHING
    ────────────────────────────────────────────────────────────── */

    const topBackBtn       = document.getElementById('topBackBtn');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');

    function showView(viewId) {
        document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + viewId)?.classList.add('active');
        if (viewId === 'track') {
            if (topBackBtn)       topBackBtn.style.display = 'flex';
            if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
            setTimeout(() => trackMap.invalidateSize(), 200);
        } else {
            if (topBackBtn)       topBackBtn.style.display = 'none';
            if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
            if (viewId === 'routes') initDashboardMap();
        }
    }

    document.querySelectorAll('#main-nav a[data-view]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('#main-nav li').forEach(li => {
                li.classList.remove('active');
                li.querySelector('.dot')?.remove();
            });
            link.parentElement.classList.add('active');
            const dot = document.createElement('div');
            dot.className = 'dot';
            link.appendChild(dot);
            showView(link.dataset.view);
        });
    });

    topBackBtn?.addEventListener('click', () => {
        showView('routes');
        document.querySelectorAll('#main-nav li').forEach(li => li.classList.remove('active'));
        document.querySelector('#main-nav a[data-view="routes"]')?.parentElement.classList.add('active');
    });

    /* ──────────────────────────────────────────────────────────────
       6. ROUTE SELECTION
    ────────────────────────────────────────────────────────────── */

    document.querySelectorAll('.route-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            const routeKey = item.dataset.route;
            if (!routeDefs[routeKey]) return;
            selectedRoute = routeKey;
            document.querySelectorAll('.route-item').forEach(r => r.classList.remove('active'));
            item.classList.add('active');
            const ind = document.getElementById('routeIndicator');
            if (ind) ind.style.transform = `translateY(${index * 72}px)`;
            loadRouteOnTrackMap(routeKey);
            showView('track');
        });
    });

    document.getElementById('confirmRouteBtn')?.addEventListener('click', () => {
        document.querySelector('.route-item.active')?.click();
    });

    /* ──────────────────────────────────────────────────────────────
       7. SEARCH
    ────────────────────────────────────────────────────────────── */

    document.querySelector('.search-bar input')?.addEventListener('input', function () {
        const q = this.value.toLowerCase().trim();
        document.querySelectorAll('.route-item').forEach(item => {
            item.style.display = (!q || item.textContent.toLowerCase().includes(q)) ? '' : 'none';
        });
    });

    /* ──────────────────────────────────────────────────────────────
       8. NOTIFICATION DRAWER
    ────────────────────────────────────────────────────────────── */

    const notificationDrawer = document.getElementById('notificationDrawer');
    const toggleDrawer = e => { e?.preventDefault(); notificationDrawer?.classList.toggle('open'); };
    document.getElementById('topNotificationBtn')?.addEventListener('click', toggleDrawer);
    document.getElementById('nav-notifications')?.addEventListener('click', toggleDrawer);
    document.getElementById('closeDrawer')?.addEventListener('click',
        () => notificationDrawer?.classList.remove('open'));

    /* ──────────────────────────────────────────────────────────────
       9. SIDEBAR
    ────────────────────────────────────────────────────────────── */

    const sidebar            = document.getElementById('sidebar');
    const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
    const sidebarOverlay     = document.getElementById('sidebarOverlay');

    function setSidebarCollapsed(collapsed) {
        sidebar?.classList.toggle('collapsed', collapsed);
        closeProfileDropdown();
        setTimeout(() => { dashboardMap?.invalidateSize(); trackMap.invalidateSize(); }, 340);
    }

    sidebarCollapseBtn?.addEventListener('click',
        () => setSidebarCollapsed(!sidebar.classList.contains('collapsed')));
    sidebarToggleBtn?.addEventListener('click',
        () => setSidebarCollapsed(!sidebar.classList.contains('collapsed')));
    sidebarOverlay?.addEventListener('click', () => {
        setSidebarCollapsed(false);
        sidebarOverlay.classList.remove('visible');
    });

    /* ──────────────────────────────────────────────────────────────
       10. PROFILE DROPDOWN
    ────────────────────────────────────────────────────────────── */

    const userProfileBtn  = document.getElementById('userProfileBtn');
    const profileDropdown = document.getElementById('profileDropdown');

    function openProfileDropdown() {
        const rect = userProfileBtn.getBoundingClientRect();
        profileDropdown.style.left   = rect.left + 'px';
        profileDropdown.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
        profileDropdown.style.top    = 'auto';
        profileDropdown.classList.add('open');
        userProfileBtn.setAttribute('aria-expanded', 'true');
    }
    function closeProfileDropdown() {
        profileDropdown?.classList.remove('open');
        userProfileBtn?.setAttribute('aria-expanded', 'false');
    }
    function toggleProfileDropdown(e) {
        e.stopPropagation();
        profileDropdown?.classList.contains('open') ? closeProfileDropdown() : openProfileDropdown();
    }

    userProfileBtn?.addEventListener('click', toggleProfileDropdown);
    userProfileBtn?.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleProfileDropdown(e); }
    });
    profileDropdown?.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', closeProfileDropdown);

    /* ──────────────────────────────────────────────────────────────
       11. MODALS
    ────────────────────────────────────────────────────────────── */

    const profileModal      = document.getElementById('profileModal');
    const profileModalClose = document.getElementById('profileModalClose');
    const helpModal         = document.getElementById('helpModal');
    const helpModalClose    = document.getElementById('helpModalClose');

    const openModal  = el => el?.classList.add('open');
    const closeModal = el => el?.classList.remove('open');

    [profileModal, helpModal].forEach(m => m?.addEventListener('click', e => {
        if (e.target === m) closeModal(m);
    }));
    profileModalClose?.addEventListener('click', () => closeModal(profileModal));
    helpModalClose?.addEventListener('click',    () => closeModal(helpModal));

    document.getElementById('menuYourDetails')?.addEventListener('click', () => {
        closeProfileDropdown(); openModal(profileModal);
    });
    document.getElementById('menuSettings')?.addEventListener('click', () => {
        closeProfileDropdown(); alert('Settings coming soon!');
    });
    document.getElementById('menuHelp')?.addEventListener('click', () => {
        closeProfileDropdown(); openModal(helpModal);
    });
    document.getElementById('menuLogout')?.addEventListener('click', () => {
        closeProfileDropdown();
        if (confirm('Log out?')) { sessionStorage.clear(); window.location.href = 'login.html'; }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeModal(profileModal); closeModal(helpModal);
            closeProfileDropdown();
            notificationDrawer?.classList.remove('open');
        }
    });

}); // end DOMContentLoaded


// Live tracking handled via Socket.IO in index.html