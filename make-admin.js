// Usage: node make-admin.js user@example.com
//
// Promotes an EXISTING customer to an admin. Admin login (requireAdmin in
// app.js) checks the `admins` table — not any column on `users` — so this
// script copies the account over. The person keeps their current password
// because the same bcrypt hash works in both tables.
//
// Creating a brand-new admin that has no customer account? Use create-admin.js.
const db = require('./conn');

(async () => {
    const email = String(process.argv[2] || '').trim().toLowerCase();
    if (!email) {
        console.error('Usage: node make-admin.js <email>');
        process.exit(1);
    }

    try {
        const [users] = await db.execute(
            'SELECT full_name, email, password FROM users WHERE email = ?',
            [email]
        );
        if (users.length === 0) {
            console.error(`No user found with email ${email}.`);
            console.error('Register that account on the website first, or run "node create-admin.js" to create a brand-new admin account.');
            process.exitCode = 1;
            return;
        }

        const [existing] = await db.execute('SELECT id FROM admins WHERE email = ?', [email]);
        if (existing.length > 0) {
            console.log(`${email} is already an admin. Sign in at /admin/login`);
            return;
        }

        const user = users[0];
        await db.execute(
            'INSERT INTO admins (full_name, email, password) VALUES (?, ?, ?)',
            [user.full_name, user.email, user.password]
        );
        console.log(`${email} is now an admin. Sign in at /admin/login with the same password.`);
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            console.error('The admins table does not exist yet. Start the app once (npm start) or run admin-table.sql.');
        } else {
            console.error('Failed:', err.message);
        }
        process.exitCode = 1;
    } finally {
        await db.end();
    }
})();
