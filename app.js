const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is not set. Add it to your .env file.');
}
const SESSION_SECRET = process.env.SESSION_SECRET;

// EJS View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve Static Assets from Public Directory
app.use(express.static(path.join(__dirname, 'public')));

// Express Session Setup
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// MySQL Pool Database Connection
const db = require('./conn');

// Auto Database Schema Creator & Initial Seed Data
async function initDB() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                icon VARCHAR(100) DEFAULT 'bi-box',
                badge VARCHAR(50) DEFAULT NULL,
                itemCount VARCHAR(50) DEFAULT '0 Products'
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) DEFAULT 'Hardware',
                price DECIMAL(10, 2) NOT NULL,
                oldPrice DECIMAL(10, 2) DEFAULT NULL,
                stock INT DEFAULT 0,
                image VARCHAR(255) DEFAULT '/images/no-image.png',
                badge VARCHAR(50) DEFAULT NULL
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS cart_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY user_product_unique (user_id, product_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        `);

        // Administrators live in their own table, separate from customers
        await db.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed Sample Categories
        const [categories] = await db.query('SELECT COUNT(*) AS count FROM categories');
        if (categories[0].count === 0) {
            await db.query(`
                INSERT INTO categories (name, icon, badge, itemCount) VALUES
                ('Processors', 'bi-cpu', 'HOT', '12 Products'),
                ('Graphics Cards', 'bi-gpu-card', 'POPULAR', '8 Products'),
                ('Motherboards', 'bi-motherboard', NULL, '15 Products'),
                ('RAM Memory', 'bi-memory', 'SALE', '20 Products')
            `);
        }

        // Seed Sample Products
        const [products] = await db.query('SELECT COUNT(*) AS count FROM products');
        if (products[0].count === 0) {
            await db.query(`
                INSERT INTO products (name, category, price, oldPrice, stock, image, badge) VALUES
                ('AMD Ryzen 7 7800X3D Processor', 'Processors', 24990.00, 26990.00, 15, 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=600&q=80', 'BESTSELLER'),
                ('NVIDIA GeForce RTX 4070 Super', 'Graphics Cards', 38500.00, 41000.00, 8, 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80', 'NEW'),
                ('ASUS ROG Strix B650-F Gaming WiFi', 'Motherboards', 16200.00, NULL, 12, 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', NULL),
                ('G.SKILL Trident Z5 RGB 32GB DDR5', 'RAM Memory', 8900.00, 9500.00, 25, 'https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=600&q=80', 'DEAL')
            `);
        }

        console.log('Database schema and initial seed data verified successfully.');
    } catch (err) {
        console.error('Database setup error:', err.message);
    }
}

// Session Authentication Check Middleware
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

//  APP ROUTES 

// 1. Home Catalog View
app.get('/', async (req, res) => {
    try {
        const sort = req.query.sort === 'low' || req.query.sort === 'high' ? req.query.sort : '';
        let orderByClause = 'ORDER BY id DESC';

        if (sort === 'low') {
            orderByClause = 'ORDER BY price ASC';
        } else if (sort === 'high') {
            orderByClause = 'ORDER BY price DESC';
        }

        const [categories] = await db.query(`
            SELECT *
            FROM categories
            ORDER BY name ASC
        `);

        // Only accept a category that really exists; anything else is ignored
        const selectedCategory = categories.some(c => c.name === req.query.category)
            ? req.query.category
            : null;

        let where = 'WHERE stock > 0';
        const params = [];
        if (selectedCategory) {
            where += ' AND category = ?';
            params.push(selectedCategory);
        }

        const [products] = await db.query(`
            SELECT *
            FROM products
            ${where}
            ${orderByClause}
        `, params);

        const hero = {
            title: "LEVEL UP YOUR GEAR",
            subtitle: "Your premier source for high-performance PC components, gaming laptops, console gear, and gaming peripherals in the Philippines.",
            ctaText: "EXPLORE CATALOG",
            ctaLink: "#products"
        };

        res.render('index', {
            hero,
            categories,
            products,
            selectedCategory,
            sort,
            user: req.session.userName || null
        });

    } catch (error) {
        console.error("Home Page Error:", error);
        res.status(500).send("Unable to load store.");
    }
});

// 2. Login Page View
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('login', { error: null });
});

// 3. User Login POST
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await db.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.render('login', { error: 'Invalid email or password.' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.render('login', { error: 'Invalid email or password.' });
        }

        req.session.userId = user.id;
        req.session.userName = user.full_name;

        res.redirect('/');

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).send('Login failed.');
    }
});

// 4. Registration Page View
app.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('register', { error: null });
});

// 5. User Registration POST
app.post('/register', async (req, res) => {
    try {
        const { name, email, password, confirmPassword, terms } = req.body;

        if (!terms) {
            return res.render('register', { error: 'You must accept the Terms of Service.' });
        }

        if (password !== confirmPassword) {
            return res.render('register', { error: 'Passwords do not match.' });
        }

        const [existing] = await db.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.render('register', { error: 'Email address is already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await db.execute(
            `INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)`,
            [name, email, hashedPassword]
        );

        res.redirect('/login');

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).send('Registration failed.');
    }
});

// 6. Shopping Cart View
app.get('/cart', requireLogin, async (req, res) => {
    try {
        const userId = req.session.userId;

        const [cart] = await db.execute(`
            SELECT
                cart_items.id,
                cart_items.quantity,
                products.id AS product_id,
                products.name,
                products.price,
                products.image,
                products.stock,
                (cart_items.quantity * products.price) AS subtotal
            FROM cart_items
            INNER JOIN products ON cart_items.product_id = products.id
            WHERE cart_items.user_id = ?
        `, [userId]);

        let total = 0;
        for (const item of cart) {
            total += Number(item.subtotal);
        }

        res.render('cart', {
            cart,
            total,
            userName: req.session.userName
        });

    } catch (error) {
        console.error("Cart Rendering Error:", error);
        res.status(500).send('Unable to load cart.');
    }
});

// 7. Add Item to Cart POST
app.post('/cart/add', requireLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const productId = req.body.productId;

        const [products] = await db.execute(
            'SELECT stock FROM products WHERE id = ?',
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).send('Product not found.');
        }

        if (products[0].stock <= 0) {
            return res.status(400).send('This product is out of stock.');
        }

        await db.execute(
            `INSERT INTO cart_items (user_id, product_id, quantity)
            VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
            [userId, productId]
        );

        res.redirect('/cart');

    } catch (error) {
        console.error("Add to Cart Error:", error);
        res.status(500).send('Unable to add product to cart.');
    }
});

// 8. Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

//  PC BUILDER ROUTES 

// PC Builder View
app.get('/pcbuild', async (req, res) => {
    try {
        // Fetch products grouped by hardware category
        const [cpus] = await db.query("SELECT * FROM products WHERE category = 'Processors' AND stock > 0");
        const [gpus] = await db.query("SELECT * FROM products WHERE category = 'Graphics Cards' AND stock > 0");
        const [motherboards] = await db.query("SELECT * FROM products WHERE category = 'Motherboards' AND stock > 0");
        const [rams] = await db.query("SELECT * FROM products WHERE category = 'RAM Memory' AND stock > 0");

        res.render('pcbuilder', {
            cpus,
            gpus,
            motherboards,
            rams,
            user: req.session.userName || null
        });
    } catch (error) {
        console.error("PC Builder View Error:", error);
        res.status(500).send("Unable to load PC Builder.");
    }
});

// PC Builder Batch Add-To-Cart POST
app.post('/pcbuild/add-all', requireLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { cpuId, gpuId, moboId, ramId } = req.body;

        const selectedProductIds = [cpuId, gpuId, moboId, ramId].filter(id => id && id !== "");

        if (selectedProductIds.length === 0) {
            return res.send("Please select at least one component to add to your build.");
        }

        for (const productId of selectedProductIds) {
            await db.execute(
                `INSERT INTO cart_items (user_id, product_id, quantity)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
                [userId, productId]
            );
        }

        res.redirect('/cart');
    } catch (error) {
        console.error("PC Builder Batch Add Error:", error);
        res.status(500).send("Unable to save rig configuration to cart.");
    }
});

//  ADMIN ROUTES

// The admin is re-checked in the admins table on every request, not trusted from the session
async function requireAdmin(req, res, next) {
    if (!req.session.adminId) {
        return res.redirect('/admin/login');
    }
    const [rows] = await db.execute(
        'SELECT id, full_name, email FROM admins WHERE id = ?',
        [req.session.adminId]
    );
    if (rows.length === 0) {
        delete req.session.adminId;
        return res.redirect('/admin/login');
    }
    req.admin = { name: rows[0].full_name, email: rows[0].email };
    next();
}

// Per-session CSRF token, required on every admin POST
function csrfProtect(req, res, next) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;

    if (req.method === 'POST') {
        const sent = Buffer.from(String(req.body._csrf || ''));
        const real = Buffer.from(req.session.csrfToken);
        if (sent.length !== real.length || !crypto.timingSafeEqual(sent, real)) {
            return res.status(403).send('Invalid or missing CSRF token. Reload the page and try again.');
        }
    }
    next();
}

function setFlash(req, type, text) {
    req.session.flash = { type, text };
}

// Validates the add/edit product form. Returns { error } or { data }.
async function parseProductForm(body) {
    const name = String(body.name || '').trim();
    const category = String(body.category || '').trim();
    const price = Number(body.price);
    const oldPrice = body.oldPrice === '' || body.oldPrice == null ? null : Number(body.oldPrice);
    const stock = Number(body.stock);
    const badge = String(body.badge || '').trim() || null;
    const image = String(body.image || '').trim() || '/images/no-image.png';

    if (!name || name.length > 255) return { error: 'Product name is required (max 255 characters).' };

    const [cats] = await db.execute('SELECT id FROM categories WHERE name = ?', [category]);
    if (cats.length === 0) return { error: 'Please choose a valid category.' };

    if (!Number.isFinite(price) || price < 0) return { error: 'Price must be a number of 0 or more.' };
    if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) return { error: 'Old price must be a number of 0 or more.' };
    if (!Number.isInteger(stock) || stock < 0) return { error: 'Stock must be a whole number of 0 or more.' };
    if (badge && badge.length > 50) return { error: 'Badge must be 50 characters or fewer.' };
    if (image.length > 255 || !/^(https?:\/\/|\/)/i.test(image)) return { error: 'Image must be an http(s) URL or a path starting with /.' };

    return { data: { name, category, price, oldPrice, stock, badge, image } };
}

const adminRouter = express.Router();
adminRouter.use(requireAdmin, csrfProtect);

// Dashboard: stats, products, categories, users
adminRouter.get('/', async (req, res) => {
    const flash = req.session.flash || null;
    delete req.session.flash;

    const [[counts]] = await db.query(`
        SELECT
            (SELECT COUNT(*) FROM products) AS products,
            (SELECT COUNT(*) FROM users) AS customers,
            (SELECT COUNT(*) FROM products WHERE stock <= 5) AS lowStock,
            (SELECT COALESCE(SUM(ci.quantity * p.price), 0)
               FROM cart_items ci JOIN products p ON p.id = ci.product_id) AS cartValue
    `);

    const [products] = await db.query('SELECT * FROM products ORDER BY id DESC');
    const [categories] = await db.query('SELECT name FROM categories ORDER BY name ASC');
    const [customers] = await db.query(`
        SELECT u.id, u.full_name, u.email, u.created_at,
               COALESCE(SUM(ci.quantity), 0) AS cart_items
        FROM users u
        LEFT JOIN cart_items ci ON ci.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 100
    `);

    res.render('admin', {
        admin: req.admin,
        flash,
        stats: {
            products: Number(counts.products),
            customers: Number(counts.customers),
            lowStock: Number(counts.lowStock),
            cartValue: Number(counts.cartValue)
        },
        products,
        categories,
        customers
    });
});

// Add product
adminRouter.post('/products', async (req, res) => {
    const { error, data } = await parseProductForm(req.body);
    if (error) {
        setFlash(req, 'error', error);
        return res.redirect('/admin#products');
    }
    await db.execute(
        `INSERT INTO products (name, category, price, oldPrice, stock, image, badge)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.name, data.category, data.price, data.oldPrice, data.stock, data.image, data.badge]
    );
    setFlash(req, 'success', `Added "${data.name}" to ${data.category}.`);
    res.redirect('/admin#products');
});

// Edit product
adminRouter.post('/products/:id', async (req, res) => {
    const { error, data } = await parseProductForm(req.body);
    if (error) {
        setFlash(req, 'error', error);
        return res.redirect('/admin#products');
    }
    const [result] = await db.execute(
        `UPDATE products
         SET name = ?, category = ?, price = ?, oldPrice = ?, stock = ?, image = ?, badge = ?
         WHERE id = ?`,
        [data.name, data.category, data.price, data.oldPrice, data.stock, data.image, data.badge, req.params.id]
    );
    setFlash(req, result.affectedRows ? 'success' : 'error',
        result.affectedRows ? `Updated "${data.name}".` : 'Product not found.');
    res.redirect('/admin#products');
});

// Delete product (cart_items rows cascade)
adminRouter.post('/products/:id/delete', async (req, res) => {
    const [result] = await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    setFlash(req, result.affectedRows ? 'success' : 'error',
        result.affectedRows ? 'Product deleted.' : 'Product not found.');
    res.redirect('/admin#products');
});

// Separate admin sign-in (customers use /login)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

app.get('/admin/login', csrfProtect, async (req, res) => {
    if (req.session.adminId) {
        const [rows] = await db.execute('SELECT id FROM admins WHERE id = ?', [req.session.adminId]);
        if (rows.length) {
            return res.redirect('/admin');
        }
    }
    res.render('admin-login', { error: null });
});

app.post('/admin/login', csrfProtect, async (req, res) => {
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');

    const [admins] = await db.execute('SELECT * FROM admins WHERE email = ?', [email]);
    const adminUser = admins[0];

    // Always run bcrypt so response time doesn't reveal whether the email exists
    const valid = await bcrypt.compare(password, adminUser ? adminUser.password : DUMMY_HASH);

    if (!adminUser || !valid) {
        return res.status(401).render('admin-login', { error: 'Invalid email or password.' });
    }

    // New session ID on privilege change
    req.session.regenerate((err) => {
        if (err) throw err;
        req.session.adminId = adminUser.id;
        req.session.save(() => res.redirect('/admin'));
    });
});

app.get('/admin/logout', (req, res) => {
    delete req.session.adminId;
    res.redirect('/admin/login');
});

app.use('/admin', adminRouter);

// Start Server after Database Initialization
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`BuildIT running on http://localhost:${PORT}`);
    });
});