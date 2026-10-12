// Usage: node create-admin.js
// Creates (or resets nothing) an administrator in the `admins` table.
// Start the app once first so the table exists, or run admin-table.sql.
const readline = require('readline');
const bcrypt = require('bcrypt');
const db = require('./conn');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
rl._writeToOutput = (text) => { if (!muted) rl.output.write(text); };

function ask(question, { hidden = false } = {}) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            muted = false;
            if (hidden) console.log();
            resolve(answer.trim());
        });
        muted = hidden; // hide typing only after the prompt text has been printed
    });
}

(async () => {
    try {
        const fullName = await ask('Full name: ');
        const email = (await ask('Email: ')).toLowerCase();
        const password = await ask('Password (min 8 characters): ', { hidden: true });

        if (!fullName || !email.includes('@')) {
            throw new Error('A name and a valid email are required.');
        }
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters.');
        }

        const hash = await bcrypt.hash(password, 12);
        await db.execute(
            'INSERT INTO admins (full_name, email, password) VALUES (?, ?, ?)',
            [fullName, email, hash]
        );
        console.log(`Admin created. Sign in at /admin/login with ${email}`);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            console.error('An admin with that email already exists.');
        } else if (err.code === 'ER_NO_SUCH_TABLE') {
            console.error('The admins table does not exist yet. Start the app once (npm start) or run admin-table.sql.');
        } else {
            console.error('Failed:', err.message);
        }
        process.exitCode = 1;
    } finally {
        rl.close();
        await db.end();
    }
})();
