// --- Auth Check ---
async function checkAuth() {
    const res = await fetch('/api/check-auth');
    const data = await res.json();
    if (!data.authenticated) {
        window.location.href = 'login.html';
    }
}
checkAuth();

document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = 'login.html';
});

// --- Sidebar Navigation ---
const navLinks = document.querySelectorAll('.nav-links a[data-target]');
const sections = document.querySelectorAll('.section');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const targetId = link.getAttribute('data-target');
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === targetId) section.classList.add('active');
        });
    });
});

const API = '/api';

// --- Dashboard Stats & Data Loading ---
async function loadData() {
    // Load Items (Announcements, Slideshow, Video)
    const itemsRes = await fetch(`${API}/items`);
    const items = await itemsRes.json();

    // Load Schedules
    const scheduleRes = await fetch(`${API}/schedules`);
    const schedules = await scheduleRes.json();

    updateDashboardStats(items, schedules);
    renderAnnouncements(items);
    renderSlideshowList(items);
    renderVideoInfo(items);
}

function updateDashboardStats(items, schedules) {
    // Schedule Stats
    document.getElementById('statScheduleTotal').innerText = schedules.length;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const todayCount = schedules.filter(s => s.day_of_week === today).length;
    document.getElementById('statScheduleToday').innerText = todayCount;

    // Slideshow Stats
    const slideCount = items.filter(i => i.category === 'slideshow').length;
    document.getElementById('statSlideshow').innerText = slideCount;

    // Video Stats
    const hasVideo = items.some(i => i.category === 'video');
    document.getElementById('statVideo').innerText = hasVideo ? "Set" : "Not Set";
}

function renderAnnouncements(items) {
    const tbody = document.querySelector('#itemsTable tbody');
    tbody.innerHTML = '';
    items.filter(i => i.category === 'announcement' || i.category === 'news').forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td>${item.title}</td>
                <td>${item.category}</td>
                <td><button class="btn btn-warning" onclick="editItem(${item.id})">Edit</button> <button class="btn btn-danger" onclick="deleteItem(${item.id})">Delete</button></td>
            </tr>
        `;
    });
}

function renderSlideshowList(items) {
    const slideshowContainer = document.getElementById('slideshowList');
    slideshowContainer.innerHTML = '';
    items.filter(i => i.category === 'slideshow').forEach(item => {
        slideshowContainer.innerHTML += `
            <div style="border: 1px solid #ddd; padding: 0.5rem; width: 150px; text-align: center;">
                <img src="${item.image_url}" style="width: 100%; height: 120px; object-fit: cover; margin-bottom: 0.5rem;">
                <p style="font-size: 0.8rem; height: 1.2em; overflow: hidden;">${item.title}</p>
                <button class="btn btn-danger" onclick="deleteItem(${item.id})" style="width:100%; padding: 0.3rem;">Delete</button>
            </div>
        `;
    });
}

function renderVideoInfo(items) {
    const videoItem = items.find(i => i.category === 'video');
    if (videoItem) {
        document.getElementById('currentVideoUrl').innerText = videoItem.content;
        document.getElementById('videoId').value = videoItem.id;
    } else {
        document.getElementById('currentVideoUrl').innerText = "None";
    }
}

loadData();

// --- Item Form Logic (Announcements) ---
const itemForm = document.getElementById('itemForm');
const btnShowAnnounceForm = document.getElementById('btnShowAnnounceForm');
const cancelItemEdit = document.getElementById('cancelItemEdit');

btnShowAnnounceForm.onclick = () => {
    itemForm.style.display = 'block';
    btnShowAnnounceForm.style.display = 'none';
};

cancelItemEdit.onclick = () => {
    itemForm.style.display = 'none';
    btnShowAnnounceForm.style.display = 'block';
    itemForm.reset();
    document.getElementById('itemId').value = '';
};

itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('itemId').value;
    const body = {
        title: document.getElementById('itemTitle').value,
        content: document.getElementById('itemContent').value,
        category: document.getElementById('itemCategory').value
    };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API}/items/${id}` : `${API}/items`;

    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    // Hide Form and Reset
    itemForm.reset();
    document.getElementById('itemId').value = '';
    itemForm.style.display = 'none';
    btnShowAnnounceForm.style.display = 'block';
    loadData();
});

window.editItem = async (id) => {
    const res = await fetch(`${API}/items/${id}`);
    const item = await res.json();
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemTitle').value = item.title;
    document.getElementById('itemContent').value = item.content;
    document.getElementById('itemCategory').value = item.category;

    // Switch to Announcements tab & Show Form
    document.querySelector('a[data-target="section-announcements"]').click();
    itemForm.style.display = 'block';
    btnShowAnnounceForm.style.display = 'none';
};

window.deleteItem = async (id) => {
    if (!confirm('Delete this item?')) return;
    await fetch(`${API}/items/${id}`, { method: 'DELETE' });
    loadData();
};

// --- Slideshow Upload Logic ---
const uploadSlideshowForm = document.getElementById('uploadSlideshowForm');
const btnShowSlideForm = document.getElementById('btnShowSlideForm');
const cancelSlideUpload = document.getElementById('cancelSlideUpload');

btnShowSlideForm.onclick = () => {
    uploadSlideshowForm.style.display = 'block';
    btnShowSlideForm.style.display = 'none';
};

cancelSlideUpload.onclick = () => {
    uploadSlideshowForm.style.display = 'none';
    btnShowSlideForm.style.display = 'block';
    uploadSlideshowForm.reset();
};

uploadSlideshowForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('slideTitle').value;
    const fileInput = document.getElementById('slideFile');

    if (fileInput.files.length === 0) return alert("Select a file!");

    // Check file size (2MB limit)
    const file = fileInput.files[0];
    if (file.size > 2 * 1024 * 1024) {
        return alert("File image too large! Max 2MB.");
    }

    const formData = new FormData();
    formData.append('imageFile', fileInput.files[0]);

    try {
        const uploadRes = await fetch(`${API}/upload/image`, { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

        const body = {
            title: title,
            content: 'Slideshow Image',
            category: 'slideshow',
            image_url: uploadData.url
        };

        await fetch(`${API}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        alert("Image uploaded!");
        uploadSlideshowForm.reset();
        uploadSlideshowForm.style.display = 'none';
        btnShowSlideForm.style.display = 'block';
        loadData();
    } catch (err) {
        alert("Error: " + err.message);
    }
});

// --- Video Upload Logic ---
const uploadVideoForm = document.getElementById('uploadVideoForm');
const btnShowVideoForm = document.getElementById('btnShowVideoForm');
const cancelVideoUpload = document.getElementById('cancelVideoUpload');

btnShowVideoForm.onclick = () => {
    uploadVideoForm.style.display = 'block';
    btnShowVideoForm.style.display = 'none';
};

cancelVideoUpload.onclick = () => {
    uploadVideoForm.style.display = 'none';
    btnShowVideoForm.style.display = 'block';
    uploadVideoForm.reset();
    document.getElementById('uploadProgress').style.display = 'none';
};

uploadVideoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('videoFile');
    const progressDiv = document.getElementById('uploadProgress');

    if (fileInput.files.length === 0) return alert("Select a file!");

    const formData = new FormData();
    formData.append('videoFile', fileInput.files[0]);

    progressDiv.style.display = 'block';

    try {
        const uploadRes = await fetch(`${API}/upload/video`, { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

        const id = document.getElementById('videoId').value;
        const body = {
            title: 'Main Video',
            content: uploadData.url,
            category: 'video'
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API}/items/${id}` : `${API}/items`;

        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        alert("Video uploaded and updated!");
        uploadVideoForm.reset();
        uploadVideoForm.style.display = 'none';
        btnShowVideoForm.style.display = 'block';
        loadData();
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        progressDiv.style.display = 'none';
    }
});


// --- Schedule Logic ---
const scheduleForm = document.getElementById('scheduleForm');
const filterDay = document.getElementById('filterDay');
const btnShowScheduleForm = document.getElementById('btnShowScheduleForm');
const cancelScheduleEdit = document.getElementById('cancelScheduleEdit');

btnShowScheduleForm.onclick = () => {
    scheduleForm.style.display = 'block';
    btnShowScheduleForm.style.display = 'none';
};

cancelScheduleEdit.onclick = () => {
    scheduleForm.style.display = 'none';
    btnShowScheduleForm.style.display = 'block';
    scheduleForm.reset();
    document.getElementById('scheduleId').value = '';
};

async function loadSchedule() {
    const day = filterDay.value;
    const url = day ? `${API}/schedules?day=${day}` : `${API}/schedules`;
    const res = await fetch(url);
    const schedules = await res.json();
    const tbody = document.querySelector('#scheduleTable tbody');
    tbody.innerHTML = '';
    schedules.forEach(s => {
        tbody.innerHTML += `
            <tr>
                <td>${s.day_of_week}</td>
                <td>${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}</td>
                <td>${s.course_name}</td>
                <td>${s.lecturer}</td>
                <td>
                    <button class="btn btn-warning" onclick="editSchedule(${s.id}, '${s.course_name}', '${s.lecturer}', '${s.room}', '${s.day_of_week}', '${s.start_time}', '${s.end_time}')">Edit</button>
                    <button class="btn btn-danger" onclick="deleteSchedule(${s.id})">Delete</button>
                </td>
            </tr>
        `;
    });
}
loadSchedule();
filterDay.onchange = loadSchedule;

scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        course_name: document.getElementById('courseName').value,
        lecturer: document.getElementById('lecturer').value,
        room: document.getElementById('room').value,
        day_of_week: document.getElementById('dayOfWeek').value,
        start_time: document.getElementById('startTime').value,
        end_time: document.getElementById('endTime').value
    };
    const id = document.getElementById('scheduleId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API}/schedules/${id}` : `${API}/schedules`;

    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    // Hide Form & Reset
    scheduleForm.reset();
    document.getElementById('scheduleId').value = '';
    scheduleForm.style.display = 'none';
    btnShowScheduleForm.style.display = 'block';

    loadSchedule();
    // Also reload stats as they might depend on schedule count
    loadData();
});

window.editSchedule = (id, c, l, r, d, s, e) => {
    document.getElementById('scheduleId').value = id;
    document.getElementById('courseName').value = c;
    document.getElementById('lecturer').value = l;
    document.getElementById('room').value = r;
    document.getElementById('dayOfWeek').value = d;
    document.getElementById('startTime').value = s;
    document.getElementById('endTime').value = e;

    // Show Form
    scheduleForm.style.display = 'block';
    btnShowScheduleForm.style.display = 'none';

    // Ensure we are on toggle view if needed (already on same page)
    window.scrollTo(0, scheduleForm.offsetTop - 100);
}

window.deleteSchedule = async (id) => {
    if (!confirm('Delete?')) return;
    await fetch(`${API}/schedules/${id}`, { method: 'DELETE' });
    loadSchedule();
    loadData();
}


// --- GENERAL SETTINGS ---
const generalForm = document.getElementById('generalSettingsForm');
const passForm = document.getElementById('changePasswordForm');

async function loadSettings() {
    try {
        const res = await fetch(`${API}/settings`);
        const s = await res.json();

        if (s.school_name) document.getElementById('schoolName').value = s.school_name;
        if (s.color_bg_page) document.getElementById('colorBgPage').value = s.color_bg_page;
        if (s.color_bg_header) document.getElementById('colorBgHeader').value = s.color_bg_header;
        if (s.color_bg_marquee) document.getElementById('colorBgMarquee').value = s.color_bg_marquee;
        if (s.color_text_header) document.getElementById('colorTextHeader').value = s.color_text_header;
        if (s.color_text_marquee) document.getElementById('colorTextMarquee').value = s.color_text_marquee;

        if (s.logo_url) {
            document.getElementById('logoUrl').value = s.logo_url;
            document.getElementById('currentLogoPreview').src = s.logo_url;
            document.getElementById('currentLogoPreview').style.display = 'inline-block';
            document.getElementById('noLogoText').style.display = 'none';
        }
    } catch (e) {
        console.error("Error loading settings", e);
    }
}
loadSettings();

generalForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check if new logo uploaded
    const logoFile = document.getElementById('logoFile').files[0];
    let logoUrl = document.getElementById('logoUrl').value;

    if (logoFile) {
        if (logoFile.size > 2 * 1024 * 1024) {
            return alert("Logo image too large! Max 2MB.");
        }

        const formData = new FormData();
        formData.append('logoFile', logoFile);

        try {
            const upRes = await fetch(`${API}/upload/logo`, { method: 'POST', body: formData });
            if (!upRes.ok) throw new Error('Logo upload failed');
            const upData = await upRes.json();
            logoUrl = upData.url;
            document.getElementById('logoUrl').value = logoUrl; // Update hidden input
        } catch (err) {
            alert(err.message);
            return;
        }
    }

    // Save Settings
    const body = {
        school_name: document.getElementById('schoolName').value,
        color_bg_page: document.getElementById('colorBgPage').value,
        color_bg_header: document.getElementById('colorBgHeader').value,
        color_bg_marquee: document.getElementById('colorBgMarquee').value,
        color_text_header: document.getElementById('colorTextHeader').value,
        color_text_marquee: document.getElementById('colorTextMarquee').value,
        logo_url: logoUrl
    };

    await fetch(`${API}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    alert('Settings Saved! Refresh public display to see changes.');
    loadSettings();
});

passForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;

    const res = await fetch(`${API}/auth/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
    });

    const data = await res.json();
    if (res.ok) {
        alert(data.message);
        document.getElementById('newPassword').value = '';
    } else {
        alert(data.error);
    }
});
