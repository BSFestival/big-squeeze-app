/* ==========================================================================
   1. CONFIGURATION & CSV ENDPOINTS
   ========================================================================== */
const URL_EVENTS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=0&single=true&output=csv";
const URL_STANDS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=605861319&single=true&output=csv";
const URL_LOCATIONS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=127409386&single=true&output=csv";
const URL_DETAILS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=2086466838&single=true&output=csv";    
const URL_PARAMS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=218585894&single=true&output=csv";    
const URL_NEWS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=2012752905&single=true&output=csv";
const URL_AMENITIES = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=295020352&single=true&output=csv";
const URL_FOOD = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=1305304181&single=true&output=csv";

/* ==========================================================================
   2. GLOBAL STATE & DATABASE STORES
   ========================================================================== */
let dbEvents = [];
let dbStands = [];
let dbLocations = {}; 
let dbDetails = {};
let dbNews = [];
let dbAmenities = [];
let dbFood = [];
let selectedDayString = ""; 
let selectedTownFilter = "ALL";
let scheduleRefreshTimer = null;

// Utility function to escape HTML special characters
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ==========================================================================
   3. APP INITIALIZATION & CSV PARSING
   ========================================================================== */
function fetchAndParseCsv(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,       
            header: true,          
            skipEmptyLines: true,  
            complete: (results) => resolve(results.data),
            error: (error) => reject(error)
        });
    });
}

async function initDatabaseApp() {
    try {
        const [rawLocations, rawDetails, rawEvents, rawStands, rawParams, rawNews, rawAmenities, rawFood] = await Promise.all([
            fetchAndParseCsv(URL_LOCATIONS),
            fetchAndParseCsv(URL_DETAILS),
            fetchAndParseCsv(URL_EVENTS),
            fetchAndParseCsv(URL_STANDS),
            fetchAndParseCsv(URL_PARAMS),
            fetchAndParseCsv(URL_NEWS),
            fetchAndParseCsv(URL_AMENITIES),
            fetchAndParseCsv(URL_FOOD)
        ]);

        // Load parameters into key-value map
        const params = {};
        rawParams.forEach(row => {
            if (row.Param_Key) {
                params[row.Param_Key.trim()] = row.Param_Value ? row.Param_Value.trim() : "";
            }
        });

        // Date Tracking Logic
        if (params["Festival_Start_Date"]) {
            selectedDayString = params["Festival_Start_Date"];
    
            const day1Date = new Date(selectedDayString + "T00:00:00");
            const day2Date = new Date(day1Date);
            day2Date.setDate(day1Date.getDate() + 1);
    
            const day2String = day2Date.toISOString().split('T')[0];

            const btnDay1 = document.getElementById('btn-day1');
            const btnDay2 = document.getElementById('btn-day2');
    
            if (btnDay1) btnDay1.setAttribute('onclick', `switchDay('${selectedDayString}', event)`);
            if (btnDay2) btnDay2.setAttribute('onclick', `switchDay('${day2String}', event)`);
        } else {
            selectedDayString = "2026-07-10"; 
        }

        // DOM Parameter Overrides
        if (params["App_Title"]) {
            const headerH1 = document.querySelector("#header h1");
            if (headerH1) headerH1.innerText = params["App_Title"];
            document.title = params["App_Title"];
        }

        if (params["Welcome_Hero"]) {
            const heroOptions = params["Welcome_Hero"].split('|').map(opt => opt.trim()).filter(Boolean);
            if (heroOptions.length > 0) {
                const selectedHeroText = heroOptions[Math.floor(Math.random() * heroOptions.length)];
                const heroElem = document.querySelector("#home-screen .hero-text");
                if (heroElem) heroElem.innerText = selectedHeroText;
            }
        }

        if (params["Default_Map_URL"]) {
            const mainMapIframe = document.getElementById("default-map");
            if (mainMapIframe) mainMapIframe.src = params["Default_Map_URL"];
        }

        // Cache Refresh Timer Setup
        let refreshRate = 300000; // 5 minute default fallback
        if (params["Refresh_Interval_MS"]) {
            const parsedRate = parseInt(params["Refresh_Interval_MS"].trim(), 10);
            if (!isNaN(parsedRate) && parsedRate > 0) refreshRate = parsedRate;
        }

        if (scheduleRefreshTimer) clearInterval(scheduleRefreshTimer);
        scheduleRefreshTimer = setInterval(() => {
            console.log(`Recalculating timelines every ${refreshRate}ms...`);
            processAllSchedules();
        }, refreshRate);
        
        const baseMapUrl = params["Loc_Map_URL"] ? params["Loc_Map_URL"].trim() : "https://maps.google.com/maps?q=";        

        // Build Location Records
        rawLocations.forEach(row => {
            if (row.Loc_ID) {
                const lat = row.Loc_Lat ? row.Loc_Lat.trim() : "";
                const long = row.Loc_Long ? row.Loc_Long.trim() : "";
                const zoom = row.Zoom_Level ? row.Zoom_Level.trim() : "15";

                let constructedMapUrl = "#";
                if (lat !== "" && long !== "") {
                    constructedMapUrl = `${baseMapUrl}&ll=${lat}%2C${long}&z=${zoom}&q=${lat},${long}`;
                }

                dbLocations[row.Loc_ID.trim()] = {
                    name: row.Loc_Name ? row.Loc_Name.trim() : "To Be Determined",
                    town: row.Loc_Town ? row.Loc_Town.trim() : "Unknown",
                    latitude: lat,
                    longitude: long,
                    zoom: zoom,
                    mapUrl: constructedMapUrl 
                };
            }
        });
        
        // Build Detail Records
        rawDetails.forEach(row => {
            if (row.Detail_ID) {
                let processedDesc = row.Detail_Descrip ? row.Detail_Descrip.trim() : "";
                processedDesc = processedDesc.replace(/\n/g, "<br>");
                
                dbDetails[row.Detail_ID.trim()] = {
                    name: row.Detail_Name ? row.Detail_Name.trim() : "",
                    image: row.Detail_Image ? row.Detail_Image.trim() : "",
                    desc: processedDesc,
                    shareDtl: row.Detail_Sharable ? row.Detail_Sharable.trim() : ""
                };
            }
        });

        // Build Events Array
        dbEvents = rawEvents.map(row => {
            const locId = row.Event_Loc_ID ? row.Event_Loc_ID.trim() : "";
            const DtlId = row.Event_Details_ID ? row.Event_Details_ID.trim() : "";
            return {
                id: row.Event_ID ? row.Event_ID.trim() : "",
                name: row.Event_Name ? row.Event_Name.trim() : "Unnamed Event",
                start: row.Event_Start ? row.Event_Start.trim() : "",
                end: row.Event_End ? row.Event_End.trim() : "",
                coverImage: row.Event_Card_Image ? row.Event_Card_Image.trim() : "",
                locationName: dbLocations[locId]?.name || "To Be Determined",
                town: dbLocations[locId]?.town || "Unknown",
                mapUrl: dbLocations[locId]?.mapUrl || "#",
                dname: dbDetails[DtlId]?.name || "",
                image: dbDetails[DtlId]?.image || "",
                details: dbDetails[DtlId]?.desc || "",
                shareEvt: dbDetails[DtlId]?.shareDtl || ""
            };
        });

        // Build Stands Array
        dbStands = rawStands.map(row => {
            const locId = row.Stand_Loc_ID ? row.Stand_Loc_ID.trim() : "";
            return {
                id: row.Stand_ID ? row.Stand_ID.trim() : "",
                name: row.Stand_Name ? row.Stand_Name.trim() : "Unnamed Stand",
                locationName: dbLocations[locId]?.name || "To Be Determined",
                town: dbLocations[locId]?.town || "Unknown",
                mapUrl: dbLocations[locId]?.mapUrl || "#"
            };
        });

        // Build News Feed Array
        dbNews = rawNews.map(row => {
            let processedContent = row.News_Content ? row.News_Content.trim() : "";
            processedContent = processedContent.replace(/\n/g, "<br>"); 

            return {
                date: row.News_Date ? row.News_Date.trim() : "",
                title: row.News_Title ? row.News_Title.trim() : "Announcement",
                content: processedContent,
                image: row.News_Image ? row.News_Image.trim() : "",
                imageLoc: row.News_Image_Loc ? row.News_Image_Loc.trim().toUpperCase() : "L"
            };
        });

        // Build Amenities Array
        dbAmenities = rawAmenities.map(row => {
            const locId = row.Amenity_Loc_ID ? row.Amenity_Loc_ID.trim() : "";
            let processedContent = row.Amenity_Desc ? row.Amenity_Desc.trim() : "";
            processedContent = processedContent.replace(/\n/g, "<br>"); 

            return {
                title: row.Amenity_Title ? row.Amenity_Title.trim() : "",
                content: processedContent,
                image: row.Amenity_Image ? row.Amenity_Image.trim() : "",
                imageLoc: row.Amenity_Image_Loc ? row.Amenity_Image_Loc.trim().toUpperCase() : "L",
                locationName: dbLocations[locId]?.name || "To Be Determined",
                town: dbLocations[locId]?.town || "Unknown",
                mapUrl: dbLocations[locId]?.mapUrl || "#"
            };
        });

        // Build Food Vendor Array
        dbFood = rawFood.map(row => {
            let processedContent = row.Food_Desc ? row.Food_Desc.trim() : "";
            processedContent = processedContent.replace(/\n/g, "<br>"); 

            return {
                name: row.Food_Name ? row.Food_Name.trim() : "",
                descrip: processedContent,
                image: row.Food_Image ? row.Food_Image.trim() : "",
                imageLoc: row.Food_Img_Loc ? row.Food_Img_Loc.trim().toUpperCase() : "L"
            };
        });

        // Initial Render Execution
        processAllSchedules();
        renderNewsFeed();
        renderInformation();
        switchTab('home');

        // Hide Loading Screen
        const loadingElem = document.getElementById("loading-screen") || document.querySelector(".spinner");
        if (loadingElem) loadingElem.classList.add("hidden");

    } catch (err) {
        console.error("Database initialization processing crash failure:", err);
        const allEvents = document.getElementById("all-events");
        if (allEvents) allEvents.innerText = "Failed to sync remote database entries.";
    }
}

/* ==========================================================================
   4. DATA PROCESSORS & SCHEDULE ENGINE
   ========================================================================== */
function processAllSchedules() {
    const [targetYear, targetMonth, targetDay] = selectedDayString.split('-').map(Number);

    const isSelectedDay = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth && d.getDate() === targetDay;
    };

    const filteredEvents = dbEvents
        .filter(e => isSelectedDay(e.start))
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    renderCards(filteredEvents, "all-events", "No events scheduled for this day.", false);

    let filteredStands = [...dbStands];
    if (selectedTownFilter !== "ALL") {
        filteredStands = filteredStands.filter(s => s.town.toLowerCase() === selectedTownFilter.toLowerCase());
    }

    const sortedStands = filteredStands.sort((a, b) => a.name.localeCompare(b.name));
    
    const standsHeader = document.getElementById("stands-header-title");
    if (standsHeader) {
        standsHeader.innerText = `${sortedStands.length} Lemonade Stands`;
    }
    
    renderCards(sortedStands, "all-stands", `No lemonade stands found in ${selectedTownFilter}.`, false);
}

const TOWN_SLIDER_MAP = {
    "0": "Parsons",
    "1": "ALL",
    "2": "Decaturville"
};

function handleTownSliderChange(val) {
    selectedTownFilter = TOWN_SLIDER_MAP[val] || "ALL";

    const labelParsons = document.getElementById("label-parsons");
    const labelAll = document.getElementById("label-all");
    const labelDecaturville = document.getElementById("label-decaturville");

    if (labelParsons) labelParsons.classList.toggle("active", val == 0);
    if (labelAll) labelAll.classList.toggle("active", val == 1);
    if (labelDecaturville) labelDecaturville.classList.toggle("active", val == 2);

    processAllSchedules();
}

function setTownSlider(val) {
    const slider = document.getElementById("town-range-slider");
    if (slider) {
        slider.value = val;
        handleTownSliderChange(val);
    }
}

/* ==========================================================================
   5. UI RENDERING ENGINES
   ========================================================================== */
function renderCards(list, elementId, emptyMsg, isLive) {
    const container = document.getElementById(elementId);
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<p class="no-events">${escapeHtml(emptyMsg)}</p>`;
        return;
    }

    const cardsHtml = list.map((item, index) => {
        const hasDates = Boolean(item.start && item.start.trim() !== "");
        const startD = hasDates ? new Date(item.start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : "??";
        const startT = hasDates ? new Date(item.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : "??";
        const endT = item.end ? new Date(item.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : "??";
        
        const itemDetails = item.details ? item.details.trim() : (item.content ? item.content.trim() : "");
        const itemImage = item.image ? item.image.trim() : "";
        const hasDetailsButton = (itemDetails !== "") || (itemImage !== "");
        const isEventsScreen = elementId === "all-events";
        const isSharable = isEventsScreen && item.shareEvt && item.shareEvt.trim().toUpperCase() === "Y";
        const uniqueId = `${elementId}-details-${index}`;
        
        const cardTitle = item.name || item.title || 'Unnamed';
        const safeDetailsAttr = escapeHtml(itemDetails.replace(/<br\s*\/?>/gi, ' '));
        const safeTitleAttr = escapeHtml(cardTitle);

        const isStandsScreen = elementId === "all-stands" || elementId.includes("stands");
        const inlineClass = isStandsScreen ? "ca-inline" : "";

        const hasCover = Boolean(item.coverImage && item.coverImage.trim() !== "");
        const coverStyle = hasCover ? `style="--card-cover: url('${encodeURI(item.coverImage.trim())}');"` : '';
        const coverClass = hasCover ? 'has-cover-image' : '';

        let cardInnerHtml = "";

        if (isStandsScreen) {
            cardInnerHtml = `
                <div class="card-content-split">
                    <div class="card-text-block">
                        <div class="card-title">${escapeHtml(cardTitle)}</div>
                        <div class="location">${escapeHtml(item.locationName || 'Festival Grounds')}${item.town && item.town !== 'Unknown' ? `, ${escapeHtml(item.town)}` : ''}</div>
                    </div>

                    <div class="card-actions ca-inline">
                        ${(item.mapUrl && item.mapUrl !== '#') ? `<button onclick="openLocationInAppMap('${encodeURI(item.mapUrl)}'); event.stopPropagation();" class="g-btn" aria-label="Show on Map"><img src="images/buttons/show-on-map.webp" alt="Map" /></button>` : ''}
                        ${hasDetailsButton ? `<button onclick="toggleCardDetails('${uniqueId}'); event.stopPropagation();" class="g-btn plus-btn" id="${uniqueId}-btn" aria-label="Toggle Details"></button>` : ''}                       
                    </div>
                </div>`;
        } else {
            cardInnerHtml = `
                <div class="card-content-stack">
                    <div class="card-text-block">
                        <div class="card-title">${escapeHtml(cardTitle)}</div>
                        ${(hasDates) ? `<span class="time">${startD} ${startT} - ${endT}</span>` : ''}
                        <div class="location">${escapeHtml(item.locationName || 'Festival Grounds')}${item.town && item.town !== 'Unknown' ? `, ${escapeHtml(item.town)}` : ''}</div>
                    </div>

                    <div class="card-bottom-row">
                        <div class="card-actions ${inlineClass}">
                            ${(item.mapUrl && item.mapUrl !== '#') ? `<button onclick="openLocationInAppMap('${encodeURI(item.mapUrl)}'); event.stopPropagation();" class="g-btn" aria-label="Show on Map"><img src="images/buttons/show-on-map.webp" alt="Map" /></button>` : ''}
                            ${hasDetailsButton ? `<button onclick="toggleCardDetails('${uniqueId}'); event.stopPropagation();" class="g-btn plus-btn" id="${uniqueId}-btn" aria-label="Toggle Details"></button>` : ''}                       
                        </div>
                    </div>
                </div>`;
        }

        return `
            <div class="card highlight-shadow-box ${coverClass}" ${coverStyle}>
                ${cardInnerHtml}
                ${hasDetailsButton ? `
                    <div id="${uniqueId}" class="expanded-details">
                        ${item.dname ? `<h3>${escapeHtml(item.dname)}</h3>` : ''}
                        <div id="${uniqueId}-image" class="dtl-image">
                            ${itemImage ? `<img src="${encodeURI(itemImage)}" alt="${escapeHtml(item.dname || 'Details')}" />` : ''}
                        </div>
                        <p class="dtl-desc">${itemDetails || 'No detailed description provided.'}</p>
                        ${isSharable ? `
                        <div class="details-share-wrapper">
                            <button onclick="shareDetails(this, event)" 
                                    data-title="${safeTitleAttr}" 
                                    data-details="${safeDetailsAttr}" 
                                    class="g-btn" 
                                    aria-label="Share Event">
                                <img src="images/buttons/share.webp" alt="Share" />
                            </button>
                        </div>` : ''}
                    </div>
                ` : ''}
          </div>`;
    });

    container.innerHTML = cardsHtml.join('');
}

function renderNewsFeed() {
    const newsContainer = document.getElementById("news-feed");
    if (!newsContainer) return;

    if (dbNews.length === 0) {
        newsContainer.innerHTML = `<p class="no-events">No news announcements posted yet.</p>`;
        return;
    }

    const sortedNews = [...dbNews].sort((a, b) => new Date(b.date) - new Date(a.date));

    const newsHtml = sortedNews.map(item => {
        const alignmentClass = item.imageLoc === "R" ? "news-float-r" : "news-float-l";
        const imageHtml = item.image 
            ? `<img src="${encodeURI(item.image)}" class="news-thumb ${alignmentClass}" alt="News graphic" />` 
            : "";

        return `
            <div class="card news-card">
                <div class="card-title news-card-title">${escapeHtml(item.title)}</div>
                ${imageHtml}
                <p class="dtl-desc news-card-desc">${item.content}</p>
            </div>`;
    });

    newsContainer.innerHTML = newsHtml.join('');
}

function renderInformation() {
    // 1. Render Amenities
    const amenitiesContainer = document.getElementById("panel-amenities");
    if (amenitiesContainer) {
        if (dbAmenities.length === 0) {
            amenitiesContainer.innerHTML = `<p class="no-events">No general information posted yet.</p>`;
        } else {
            const sortedAmenities = [...dbAmenities].sort((a, b) => a.title.localeCompare(b.title));
            const amenitiesHtml = sortedAmenities.map(item => {
                const alignmentClass = item.imageLoc === "R" ? "news-float-r" : "news-float-l";
                const imageHtml = item.image 
                    ? `<img src="${encodeURI(item.image)}" class="news-thumb ${alignmentClass}" alt="Amenity image" />` 
                    : "";

                return `
                    <div class="card news-card">
                        <div class="card-title news-card-title">${escapeHtml(item.title)}</div>
                        ${imageHtml}
                        <p class="dtl-desc news-card-desc">${item.content}</p>
                    </div>`;
            });
            amenitiesContainer.innerHTML = amenitiesHtml.join('');
        }

        setTimeout(() => {
            const activeItem = document.querySelector('.accordion-item.active');
            if (activeItem) {
                const activePanel = activeItem.querySelector('.accordion-panel');
                if (activePanel && activePanel.scrollHeight > 0) {
                    activePanel.style.maxHeight = activePanel.scrollHeight + "px";
                }
            }
        }, 100);
    }

    // 2. Render Food Options
    const foodContainer = document.getElementById("panel-food");
    if (foodContainer) {
        if (dbFood.length === 0) {
            foodContainer.innerHTML = `<p class="no-events">No food vendor options available yet.</p>`;
        } else {
            const sortedFood = [...dbFood].sort((a, b) => a.name.localeCompare(b.name));
            const foodHtml = sortedFood.map(item => {
                const alignmentClass = item.imageLoc === "R" ? "news-float-r" : "news-float-l";
                const imageHtml = item.image 
                    ? `<img src="${encodeURI(item.image)}" class="news-thumb ${alignmentClass}" alt="Food image" />` 
                    : "";

                return `
                    <div class="card news-card">
                        <div class="card-title news-card-title">${escapeHtml(item.name)}</div>
                        ${imageHtml}
                        <p class="dtl-desc news-card-desc">${item.descrip}</p>
                    </div>`;
            });
            foodContainer.innerHTML = foodHtml.join('');
        }
    }
}

function toggleAccordion(headerBtn) {
    const accordionItem = headerBtn.parentElement;
    const panel = accordionItem.querySelector('.accordion-panel');
    const isActive = accordionItem.classList.contains('active');

    document.querySelectorAll('.accordion-item').forEach(item => {
        item.classList.remove('active');
        const p = item.querySelector('.accordion-panel');
        if (p) p.style.maxHeight = null;
    });

    if (!isActive) {
        accordionItem.classList.add('active');
        panel.style.maxHeight = panel.scrollHeight + "px";
    }
}

/* ==========================================================================
   6. UI EVENT HANDLERS & INTERACTIVITY
   ========================================================================== */
function toggleCardDetails(targetDivId) {
    const targetDiv = document.getElementById(targetDivId);
    if (targetDiv) {
        targetDiv.classList.toggle('show');
        
        const toggleBtn = document.getElementById(`${targetDivId}-btn`);
        if (toggleBtn) toggleBtn.classList.toggle('active');

        if (targetDiv.classList.contains('show')) {
            setTimeout(() => {
                targetDiv.parentElement?.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }, 250); 
        }
    }
}

function shareDetails(buttonEl, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const title = buttonEl.getAttribute('data-title') || 'Big Squeeze Event';
    const description = buttonEl.getAttribute('data-details') || '';

    if (navigator.share) {
        navigator.share({
            title: title,
            text: `Check out ${title} at the Big Squeeze Festival!\n\n${description}`,
            url: window.location.href
        }).catch(err => {
            if (err.name !== 'AbortError') {
                console.error('Share failure:', err);
            }
        });
    } else {
        const shareText = `${title} - ${description}\n${window.location.href}`;
        navigator.clipboard.writeText(shareText).then(() => {
            alert("Event details copied to clipboard!");
        }).catch(() => {
            alert(`Share: ${title}`);
        });
    }
}

/* ==========================================================================
   7. NAVIGATION & SCREEN SWITCHING
   ========================================================================== */
function openLocationInAppMap(mapUrl) {
    if (!mapUrl || mapUrl === '#') return;

    const mapIframe = document.getElementById('default-map');
    if (mapIframe) mapIframe.src = mapUrl;

    switchTab('map');
}

function switchTab(target) {
    document.querySelectorAll('.tab-content').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('animate-fade');
    });
    
    document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
    
    const targetScreen = document.getElementById(`${target}-screen`);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        void targetScreen.offsetWidth; 
        targetScreen.classList.add('animate-fade');
        window.scrollTo({ top: 0, behavior: 'instant' }); 
    }
    
    if (target === 'info') {
        setTimeout(() => {
            const activeItem = document.querySelector('.accordion-item.active');
            if (activeItem) {
                const activePanel = activeItem.querySelector('.accordion-panel');
                if (activePanel) {
                    activePanel.style.maxHeight = activePanel.scrollHeight + "px";
                }
            }
        }, 50);
    }    

    const navBtn = document.getElementById(`nav-${target}`);
    if (navBtn) navBtn.classList.add('active');

    const indicator = document.getElementById('nav-indicator');
    if (indicator) {
        const tabPositions = {
            'home': 0,
            'events': 1,
            'stands': 2,
            'map': 3,
            'info': 4
        };
        
        const positionIndex = tabPositions[target] !== undefined ? tabPositions[target] : 0;
        indicator.style.transform = `translateY(-50%) translateX(${positionIndex * 100}%)`;
    }
}

function switchDay(dateStr, event) {
    selectedDayString = dateStr;
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    processAllSchedules();
}

/* ==========================================================================
   8. APPLICATION BOOTSTRAPPER & EVENT LISTENERS
   ========================================================================== */
initDatabaseApp();

let lastScrollY = window.scrollY;
const navBar = document.querySelector('.bottom-nav');

window.addEventListener('scroll', () => {
    if (!navBar) return;
    const currentScrollY = window.scrollY;

    if (currentScrollY <= 0) {
        navBar.classList.remove('nav-hidden');
        lastScrollY = currentScrollY;
        return;
    }

    if (currentScrollY > lastScrollY + 10) {
        navBar.classList.add('nav-hidden');
    } else if (currentScrollY < lastScrollY - 10) {
        navBar.classList.remove('nav-hidden');
    }

    lastScrollY = currentScrollY;
}, { passive: true });
