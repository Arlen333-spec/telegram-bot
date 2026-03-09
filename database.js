const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
        this.init();
    }

    init() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id TEXT UNIQUE,
                full_name TEXT,
                age INTEGER,
                school TEXT,
                class TEXT,
                region TEXT,
                poem TEXT,
                language TEXT,
                subscribed BOOLEAN DEFAULT 0,
                registration_complete BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    async createUser(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR IGNORE INTO users (telegram_id) VALUES (?)',
                [telegramId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    async updateUserData(telegramId, field, value) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE users SET ${field} = ? WHERE telegram_id = ?`,
                [value, telegramId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    }

    async getUserData(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE telegram_id = ?',
                [telegramId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    async completeRegistration(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET registration_complete = 1 WHERE telegram_id = ?',
                [telegramId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    }
}

module.exports = new Database();