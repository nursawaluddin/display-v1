const API_URL = '/api';

// Clock Info
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour12: false });
    document.getElementById('clock').innerText = `${timeString}`;
}
setInterval(updateClock, 1000);
updateClock();

async function fetchData() {
    try {
        const itemsRes = await fetch(`${API_URL}/items`);
        const items = await itemsRes.json();

        updateVideo(items);
        updateTicker(items);
        updateSlideshow(items);

        // Fetch & Apply Settings
        try {
            const settingsRes = await fetch(`${API_URL}/settings`);
            const settings = await settingsRes.json();
            applySettings(settings);
        } catch (e) {
            console.error("Error loading settings:", e);
        }

        const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const daysEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayIndex = new Date().getDay();
        const todayIndo = daysIndo[todayIndex];
        const todayEng = daysEng[todayIndex];

        document.getElementById('schedule-title').innerText = `Jadwal Perkuliahan - ${todayIndo}`;

        const scheduleRes = await fetch(`${API_URL}/schedules?day=${todayEng}`);

        const schedules = await scheduleRes.json();

        renderSchedule(schedules);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function applySettings(s) {
    if (!s) return;

    // Colors
    // Colors
    if (s.color_bg_page) document.body.style.backgroundColor = s.color_bg_page;

    // Header removed, skipping header colors
    // const header = document.querySelector('.header');

    // Ticker Colors
    const ticker = document.querySelector('.ticker-container');
    if (s.color_bg_marquee) ticker.style.backgroundColor = s.color_bg_marquee;
    if (s.color_text_marquee) ticker.style.color = s.color_text_marquee;

    // Logo (Overlay)
    const logoContainer = document.getElementById('overlay-logo');
    if (s.logo_url) {
        logoContainer.innerHTML = `<img src="${s.logo_url}" alt="Logo">`;
    } else {
        logoContainer.innerHTML = '';
    }
    // School Name is ignored as per request ("jangan pakai judul")

    // Clock Color (optional, maybe use text header color setting if still relevant for clock?)
    if (s.color_text_header) {
        document.getElementById('clock').style.color = s.color_text_header;
    }


}

function updateVideo(items) {
    const videoItem = items.find(item => item.category === 'video');
    const videoElement = document.getElementById('mainVideo');
    if (videoItem && videoItem.content) {
        const currentSrc = videoElement.querySelector('source').src;
        // Avoid reloading if same source (check path)
        if (!currentSrc.endsWith(videoItem.content)) {
            videoElement.src = videoItem.content;
            videoElement.load();
            videoElement.play().catch(e => console.log("Autoplay policy blocked:", e));
        }
    }
}

function updateTicker(items) {
    const tickerText = document.getElementById('ticker-text');
    const announcements = items.filter(i => i.category === 'announcement' || i.category === 'news');
    const headlines = announcements.map(item => item.title).join('   |   ');
    if (headlines) {
        tickerText.innerText = headlines + '   |   ' + headlines;
    }
}

// Slideshow Logic
let slideInterval;
let currentSlideIndex = 0;

function updateSlideshow(items) {
    const slides = items.filter(i => i.category === 'slideshow');
    const container = document.getElementById('slideshow-container');

    const existingImgs = container.querySelectorAll('img');
    if (existingImgs.length === slides.length && slides.length > 0) {
        if (existingImgs[0].src.endsWith(slides[0].image_url)) return; // Assume same
    }

    container.innerHTML = '';
    if (slides.length === 0) {
        container.innerHTML = '<div style="padding: 1rem; text-align:center;">No Images</div>';
        return;
    }

    slides.forEach((s, index) => {
        const img = document.createElement('img');
        img.src = s.image_url;
        if (index === 0) img.classList.add('active'); // Start with first
        container.appendChild(img);
    });

    // Restart logic
    currentSlideIndex = 0;
    if (slideInterval) clearInterval(slideInterval);
    if (slides.length > 1) {
        slideInterval = setInterval(() => {
            const images = container.querySelectorAll('img');
            images[currentSlideIndex].classList.remove('active');
            currentSlideIndex = (currentSlideIndex + 1) % images.length;
            images[currentSlideIndex].classList.add('active');
        }, 5000);
    }
}

// Schedule Pagination Logic
let scheduleInterval;
const ITEMS_PER_PAGE = 5; // Adjust based on screen size

function renderSchedule(schedules) {
    const tbody = document.getElementById('schedule-body');

    // Clear existing interval if any
    if (scheduleInterval) clearInterval(scheduleInterval);

    if (schedules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada jadwal kuliah hari ini.</td></tr>';
        return;
    }

    if (schedules.length <= ITEMS_PER_PAGE) {
        // Fit in one page
        renderPage(schedules, tbody);
    } else {
        // Pagination needed
        let currentPage = 0;
        const totalPages = Math.ceil(schedules.length / ITEMS_PER_PAGE);

        const showNextPage = () => {
            // Fade out
            tbody.classList.add('fade-exit');

            setTimeout(() => {
                const start = currentPage * ITEMS_PER_PAGE;
                const end = start + ITEMS_PER_PAGE;
                const pageItems = schedules.slice(start, end);

                renderPage(pageItems, tbody);

                // Fade in
                tbody.classList.remove('fade-exit');
                tbody.classList.add('fade-enter');

                // Remove fade-enter class after animation (clean up)
                setTimeout(() => tbody.classList.remove('fade-enter'), 500);

                currentPage = (currentPage + 1) % totalPages;
            }, 500); // Wait for fade out
        };

        showNextPage(); // Show first page immediately
        scheduleInterval = setInterval(showNextPage, 8000); // Rotate every 8 seconds
    }
}

function renderPage(items, tbody) {
    tbody.innerHTML = '';
    items.forEach(s => {
        const row = `
            <tr>
                <td>${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}</td>
                <td>${s.course_name}</td>
                <td>${s.lecturer}</td>
                <td>${s.room}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

fetchData();
setInterval(fetchData, 60000);
