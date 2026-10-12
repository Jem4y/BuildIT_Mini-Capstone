// Usage: node make-admin.js user@example.com
// Run the app once first so the users.role column exists.
const db = require('./conn');

(async () => {
    const email = process.argv[2];
    if (!email) {
        console.error('Usage: node make-admin.js <email>');
        process.exit(1);
    }
    try {
        const [result] = await db.execute("UPDATE users SET role = 'admin' WHERE email = ?", [email]);
        console.log(result.affectedRows
            ? `${email} is now an admin.`
            : `No user found with email ${email}. Register that account first.`);
    } catch (err) {
        console.error('Failed:', err.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
})();
