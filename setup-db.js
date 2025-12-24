require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
};

async function setupDatabase() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to MySQL server.');

        // Create Database
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
        console.log(`Database '${process.env.DB_NAME}' created or already exists.`);

        // Use Database
        await connection.changeUser({ database: process.env.DB_NAME });

        // Create Items Table (for announcements, events, etc.)
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                category ENUM('announcement', 'event', 'news', 'video') DEFAULT 'announcement',
                image_url VARCHAR(255),
                start_date DATETIME,
                end_date DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `;
        await connection.query(createTableQuery);

        // Update ENUM if it doesn't have 'video' (Idempotent-ish check/alter)
        try {
            await connection.query("ALTER TABLE items MODIFY COLUMN category ENUM('announcement', 'event', 'news', 'video') DEFAULT 'announcement'");
        } catch (e) {
            // Ignore if fails or already exists
            console.log("ENUM modify tried (might already exist)");
        }

        console.log("Table 'items' created or verified.");

        // Create Schedules Table
        const createScheduleTable = `
            CREATE TABLE IF NOT EXISTS schedules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                course_name VARCHAR(255) NOT NULL,
                lecturer VARCHAR(255),
                room VARCHAR(50),
                day_of_week VARCHAR(20) NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await connection.query(createScheduleTable);
        console.log("Table 'schedules' created or verified.");

        // Create Settings Table
        const createSettingsTable = `
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                school_name VARCHAR(255) DEFAULT 'Campus Information Center',
                logo_url VARCHAR(255) DEFAULT NULL,
                color_bg_page VARCHAR(20) DEFAULT '#f4f4f4',
                color_bg_header VARCHAR(20) DEFAULT '#003366',
                color_bg_marquee VARCHAR(20) DEFAULT '#003366',
                color_text_header VARCHAR(20) DEFAULT '#ffffff',
                color_text_marquee VARCHAR(20) DEFAULT '#ffffff',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `;
        await connection.query(createSettingsTable);
        console.log("Table 'settings' created or verified.");

        // Insert Default Settings if empty
        const [settingsCount] = await connection.query('SELECT COUNT(*) as count FROM settings');
        if (settingsCount[0].count === 0) {
            await connection.query('INSERT INTO settings (school_name) VALUES (?)', ['Campus Information Center']);
            console.log('Default settings inserted.');
        }

        // Insert Default Admin
        const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
        if (users[0].count === 0) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await connection.query('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
            console.log('Default admin user created (admin / admin123).');
        }

        // Insert some sample data if empty
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM items');
        if (rows[0].count === 0) {
            const sampleData = `
                INSERT INTO items (title, content, category, start_date, end_date) VALUES
                ('Welcome to Campus', 'Welcome to the new semester!', 'announcement', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY)),
                ('Library Hours', 'The library will be open until 10 PM this week.', 'news', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY));
            `;
            await connection.query(sampleData);
            console.log('Sample data inserted.');
        }

    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        if (connection) await connection.end();
    }
}

setupDatabase();
