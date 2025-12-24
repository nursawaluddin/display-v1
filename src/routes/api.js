const express = require('express');
const router = express.Router();
const db = require('../config/db');
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

// --- Auth Routes ---
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = users[0];
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
        let query = 'SELECT * FROM schedules ORDER BY day_of_week, start_time';
        let params = [];
        if (day) {
            query = 'SELECT * FROM schedules WHERE day_of_week = ? ORDER BY start_time';
            params = [day];
        }
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST schedule (Protected)
router.post('/schedules', requireAuth, async (req, res) => {
    const { course_name, lecturer, room, day_of_week, start_time, end_time } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO schedules (course_name, lecturer, room, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
            [course_name, lecturer, room, day_of_week, start_time, end_time]
        );
        res.status(201).json({ id: result.insertId, message: 'Schedule added' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update schedule (Protected)
router.put('/schedules/:id', requireAuth, async (req, res) => {
    const { course_name, lecturer, room, day_of_week, start_time, end_time } = req.body;
    try {
        await db.query(
            'UPDATE schedules SET course_name = ?, lecturer = ?, room = ?, day_of_week = ?, start_time = ?, end_time = ? WHERE id = ?',
            [course_name, lecturer, room, day_of_week, start_time, end_time, req.params.id]
        );
        res.json({ message: 'Schedule updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE schedule (Protected)
router.delete('/schedules/:id', requireAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM schedules WHERE id = ?', [req.params.id]);
        res.json({ message: 'Schedule deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- Items Routes (Existing - Protected Write) ---

router.get('/items', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM items ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/items/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM items WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/items', requireAuth, async (req, res) => {
    // image_url is also saved if provided (e.g for slideshow)
    const { title, content, category, start_date, end_date, image_url } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO items (title, content, category, start_date, end_date, image_url) VALUES (?, ?, ?, ?, ?, ?)',
            [title, content, category || 'announcement', start_date, end_date, image_url]
        );
        res.status(201).json({ id: result.insertId, message: 'Item created' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/items/:id', requireAuth, async (req, res) => {
    const { title, content, category, start_date, end_date, image_url } = req.body;
    try {
        // Dynamic update to keep previous values if undefined is tricky in simple SQL, 
        // but let's assume client sends all data.
        await db.query(
            'UPDATE items SET title = ?, content = ?, category = ?, start_date = ?, end_date = ?, image_url = ? WHERE id = ?',
            [title, content, category, start_date, end_date, image_url, req.params.id]
        );
        res.json({ message: 'Item updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/items/:id', requireAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM items WHERE id = ?', [req.params.id]);
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
        const [rows] = await db.query('SELECT * FROM settings LIMIT 1');
        res.json(rows[0] || {});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/settings', requireAuth, async (req, res) => {
    const { school_name, color_bg_page, color_bg_header, color_bg_marquee, color_text_header, color_text_marquee, logo_url } = req.body;
    try {
        const [rows] = await db.query('SELECT id FROM settings LIMIT 1');
        if (rows.length === 0) {
            await db.query(
                'INSERT INTO settings (school_name, color_bg_page, color_bg_header, color_bg_marquee, color_text_header, color_text_marquee, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [school_name, color_bg_page, color_bg_header, color_bg_marquee, color_text_header, color_text_marquee, logo_url]
            );
        } else {
            await db.query(
                'UPDATE settings SET school_name = ?, color_bg_page = ?, color_bg_header = ?, color_bg_marquee = ?, color_text_header = ?, color_text_marquee = ?, logo_url = ? WHERE id = ?',
                [school_name, color_bg_page, color_bg_header, color_bg_marquee, color_text_header, color_text_marquee, logo_url, rows[0].id]
            );
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
        // Assumes current user is who they say they are defined in session
        // For higher security, verify old password first, but for this quick app:
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.session.user.id]);
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});
