const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

// --- Middleware ---
const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
};

// --- Upload Config ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'src/public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // Append extension
    }
});

const uploadVideo = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'video/mp4' || file.mimetype === 'video/webm' || file.mimetype === 'video/x-matroska') {
            cb(null, true);
        } else {
            cb(new Error('Format video harus MP4 atau WebM!'));
        }
    }
});

const uploadImage = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit for images
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Format file harus gambar!'));
        }
    }
});

// --- Helper: Format Time ---
const formatTime = (dateObj) => {
    if (!dateObj) return null;
    return dateObj.toLocaleTimeString('en-GB', { hour12: false }); // "HH:MM:SS"
};

// --- Helper: Parse Time String to Date ---
// Prisma Time type expects a Date object (defaulting to 1970-01-01)
const parseTime = (timeStr) => {
    if (!timeStr) return undefined;
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const date = new Date('1970-01-01T00:00:00Z');
    date.setUTCHours(hours || 0, minutes || 0, seconds || 0);
    return date;
};


// --- Auth Routes ---
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { username: username }
        });

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        req.session.user = { id: user.id, username: user.username };
        res.json({ message: 'Login successful' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

router.get('/check-auth', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// --- Upload Routes ---
router.post('/upload/video', requireAuth, uploadVideo.single('videoFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or invalid format' });
    }
    const relativePath = '/uploads/' + req.file.filename;
    res.json({ url: relativePath });
});

router.post('/upload/image', requireAuth, uploadImage.single('imageFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or invalid format' });
    }
    const relativePath = '/uploads/' + req.file.filename;
    res.json({ url: relativePath });
});

// --- Schedule Routes ---
// GET all schedules (optionally filter by day)
router.get('/schedules', async (req, res) => {
    const { day } = req.query;
    try {
        const whereClause = day ? { day_of_week: day } : {};
        const schedules = await prisma.schedule.findMany({
            where: whereClause,
            orderBy: [
                { day_of_week: 'asc' },
                { start_time: 'asc' }
            ]
        });

        // Format Date objects back to time strings for frontend
        const formatted = schedules.map(s => ({
            ...s,
            start_time: formatTime(s.start_time),
            end_time: formatTime(s.end_time)
        }));

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST schedule (Protected)
router.post('/schedules', requireAuth, async (req, res) => {
    const { course_name, lecturer, room, day_of_week, start_time, end_time } = req.body;
    try {
        // Convert "HH:MM" to Date object for Prisma
        const result = await prisma.schedule.create({
            data: {
                course_name,
                lecturer,
                room,
                day_of_week,
                start_time: parseTime(start_time), // Assumes "HH:MM" or "HH:MM:SS"
                end_time: parseTime(end_time)
            }
        });
        res.status(201).json({ id: result.id, message: 'Schedule added' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update schedule (Protected)
router.put('/schedules/:id', requireAuth, async (req, res) => {
    const { course_name, lecturer, room, day_of_week, start_time, end_time } = req.body;
    try {
        await prisma.schedule.update({
            where: { id: parseInt(req.params.id) },
            data: {
                course_name,
                lecturer,
                room,
                day_of_week,
                start_time: parseTime(start_time),
                end_time: parseTime(end_time)
            }
        });
        res.json({ message: 'Schedule updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE schedule (Protected)
router.delete('/schedules/:id', requireAuth, async (req, res) => {
    try {
        await prisma.schedule.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Schedule deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- Items Routes (Existing - Protected Write) ---

router.get('/items', async (req, res) => {
    try {
        const items = await prisma.item.findMany({
            orderBy: { created_at: 'desc' }
        });
        res.json(items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/items/:id', async (req, res) => {
    try {
        const item = await prisma.item.findUnique({
            where: { id: parseInt(req.params.id) }
        });
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json(item);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/items', requireAuth, async (req, res) => {
    // image_url is also saved if provided (e.g for slideshow)
    const { title, content, category, start_date, end_date, image_url } = req.body;
    try {
        const result = await prisma.item.create({
            data: {
                title,
                content,
                category: category || 'announcement',
                start_date: start_date ? new Date(start_date) : null,
                end_date: end_date ? new Date(end_date) : null,
                image_url
            }
        });
        res.status(201).json({ id: result.id, message: 'Item created' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/items/:id', requireAuth, async (req, res) => {
    const { title, content, category, start_date, end_date, image_url } = req.body;
    try {
        await prisma.item.update({
            where: { id: parseInt(req.params.id) },
            data: {
                title,
                content,
                category,
                start_date: start_date ? new Date(start_date) : null,
                end_date: end_date ? new Date(end_date) : null,
                image_url
            }
        });
        res.json({ message: 'Item updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/items/:id', requireAuth, async (req, res) => {
    try {
        await prisma.item.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Item deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

module.exports = router;

// --- Settings Routes ---
router.get('/settings', async (req, res) => {
    try {
        const setting = await prisma.setting.findFirst();
        res.json(setting || {});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/settings', requireAuth, async (req, res) => {
    const { school_name, color_bg_page, color_bg_header, color_bg_marquee, color_text_header, color_text_marquee, logo_url } = req.body;
    try {
        const existing = await prisma.setting.findFirst();

        if (!existing) {
            await prisma.setting.create({
                data: {
                    school_name, color_bg_page, color_bg_header, color_bg_marquee, color_text_header, color_text_marquee, logo_url
                }
            });
        } else {
            await prisma.setting.update({
                where: { id: existing.id },
                data: {
                    school_name, color_bg_page, color_bg_header, color_bg_marquee, color_text_header, color_text_marquee, logo_url
                }
            });
        }
        res.json({ message: 'Settings updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/upload/logo', requireAuth, uploadImage.single('logoFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const relativePath = '/uploads/' + req.file.filename;
    res.json({ url: relativePath });
});

router.post('/auth/password', requireAuth, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.session.user.id },
            data: { password: hashedPassword }
        });
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

