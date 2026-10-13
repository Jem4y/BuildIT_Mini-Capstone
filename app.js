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
                badge VARCHAR(50) DEFAULT NULL,
                description TEXT NULL
            )
        `);

        // Older databases may have a products table missing some columns; add them
        const productColumns = {
            category: "VARCHAR(100) DEFAULT 'Hardware'",
            oldPrice: 'DECIMAL(10, 2) DEFAULT NULL',
            stock: 'INT DEFAULT 0',
            image: "VARCHAR(255) DEFAULT '/images/no-image.png'",
            badge: 'VARCHAR(50) DEFAULT NULL',
            description: 'TEXT NULL'
        };
        const [existingCols] = await db.query('SHOW COLUMNS FROM products');
        const haveCols = new Set(existingCols.map(col => col.Field));
        for (const [colName, definition] of Object.entries(productColumns)) {
            if (!haveCols.has(colName)) {
                await db.query(`ALTER TABLE products ADD COLUMN ${colName} ${definition}`);
                console.log(`Added missing products column: ${colName}`);
            }
        }

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

        // Orders placed at checkout (card numbers / CVV are never stored)
        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                street VARCHAR(255) NOT NULL,
                barangay VARCHAR(150) NOT NULL,
                city VARCHAR(150) NOT NULL,
                province VARCHAR(150) NOT NULL,
                region VARCHAR(20) NOT NULL,
                postal_code VARCHAR(4) NOT NULL,
                payment_method VARCHAR(20) NOT NULL,
                payment_provider VARCHAR(50) DEFAULT NULL,
                payment_reference VARCHAR(100) DEFAULT NULL,
                payment_status VARCHAR(30) NOT NULL,
                subtotal DECIMAL(10, 2) NOT NULL,
                shipping_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
                total DECIMAL(10, 2) NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'Processing',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT NULL,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                quantity INT NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
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

        // Live count of products customers can actually buy (in stock) per category,
        // so the numbers on the home page always match what admins have added
        const [countRows] = await db.query(`
            SELECT category, COUNT(*) AS total
            FROM products
            WHERE stock > 0
            GROUP BY category
        `);
        const countByCategory = new Map(countRows.map(row => [row.category, Number(row.total)]));
        categories.forEach(cat => {
            cat.productCount = countByCategory.get(cat.name) || 0;
        });

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

// 7b. Update Cart Item Quantity POST (increase / decrease)
app.post('/cart/update', requireLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const cartItemId = Number(req.body.cartItemId);
        const action = req.body.action;

        if (!Number.isInteger(cartItemId) || !['increase', 'decrease'].includes(action)) {
            return res.status(400).send('Invalid request.');
        }

        // Only touch rows that belong to the logged-in user
        const [rows] = await db.execute(
            `SELECT cart_items.quantity, products.stock
             FROM cart_items
             INNER JOIN products ON cart_items.product_id = products.id
             WHERE cart_items.id = ? AND cart_items.user_id = ?`,
            [cartItemId, userId]
        );

        if (rows.length === 0) {
            return res.redirect('/cart');
        }

        const { quantity, stock } = rows[0];

        if (action === 'increase') {
            // Never allow more than what is in stock
            if (quantity < stock) {
                await db.execute(
                    'UPDATE cart_items SET quantity = quantity + 1 WHERE id = ? AND user_id = ?',
                    [cartItemId, userId]
                );
            }
        } else if (quantity > 1) {
            await db.execute(
                'UPDATE cart_items SET quantity = quantity - 1 WHERE id = ? AND user_id = ?',
                [cartItemId, userId]
            );
        } else {
            // Decreasing from 1 removes the item
            await db.execute(
                'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
                [cartItemId, userId]
            );
        }

        res.redirect('/cart');

    } catch (error) {
        console.error("Update Cart Error:", error);
        res.status(500).send('Unable to update cart.');
    }
});

// 7c. Remove Item from Cart POST
app.post('/cart/remove', requireLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const cartItemId = Number(req.body.cartItemId);

        if (!Number.isInteger(cartItemId)) {
            return res.status(400).send('Invalid request.');
        }

        await db.execute(
            'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
            [cartItemId, userId]
        );

        res.redirect('/cart');

    } catch (error) {
        console.error("Remove From Cart Error:", error);
        res.status(500).send('Unable to remove item from cart.');
    }
});

//  CHECKOUT & ORDERS (Philippines) 

const PH_REGIONS = [
    ['NCR', 'NCR - National Capital Region (Metro Manila)'],
    ['CAR', 'CAR - Cordillera Administrative Region'],
    ['I', 'Region I - Ilocos Region'],
    ['II', 'Region II - Cagayan Valley'],
    ['III', 'Region III - Central Luzon'],
    ['IV-A', 'Region IV-A - CALABARZON'],
    ['MIMAROPA', 'MIMAROPA Region'],
    ['V', 'Region V - Bicol Region'],
    ['VI', 'Region VI - Western Visayas'],
    ['VII', 'Region VII - Central Visayas'],
    ['VIII', 'Region VIII - Eastern Visayas'],
    ['IX', 'Region IX - Zamboanga Peninsula'],
    ['X', 'Region X - Northern Mindanao'],
    ['XI', 'Region XI - Davao Region'],
    ['XII', 'Region XII - SOCCSKSARGEN'],
    ['XIII', 'Region XIII - Caraga'],
    ['BARMM', 'BARMM - Bangsamoro Autonomous Region']
];
const REGION_CODES = new Set(PH_REGIONS.map(r => r[0]));

const PAYMENT_METHODS = {
    debit: 'Debit Card',
    ewallet: 'E-Wallet',
    cod: 'Cash on Delivery'
};
const EWALLETS = ['GCash', 'Maya', 'GrabPay', 'ShopeePay'];

// Shipping (PHP): Metro Manila vs. everywhere else, free above a threshold
const SHIPPING = { ncr: 150, other: 250, freeAbove: 30000 };

function shippingFor(region, subtotal) {
    if (subtotal >= SHIPPING.freeAbove) return 0;
    return region === 'NCR' ? SHIPPING.ncr : SHIPPING.other;
}

function orderNumber(id) {
    return 'BIT-' + String(id).padStart(6, '0');
}

// Luhn checksum: catches mistyped card numbers
function luhnValid(digits) {
    let sum = 0;
    let double = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let d = Number(digits[i]);
        if (double) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
        double = !double;
    }
    return sum % 10 === 0;
}

function cardBrand(digits) {
    if (/^4/.test(digits)) return 'Visa';
    if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/.test(digits)) return 'Mastercard';
    if (/^35/.test(digits)) return 'JCB';
    return 'Debit';
}

async function loadCart(userId) {
    const [cart] = await db.execute(`
        SELECT cart_items.id, cart_items.quantity,
               products.id AS product_id, products.name, products.price, products.stock,
               (cart_items.quantity * products.price) AS subtotal
        FROM cart_items
        INNER JOIN products ON cart_items.product_id = products.id
        WHERE cart_items.user_id = ?
    `, [userId]);
    return cart;
}

async function renderCheckout(req, res, { error = null, form = {}, status = 200 } = {}) {
    const cart = await loadCart(req.session.userId);
    if (cart.length === 0) {
        return res.redirect('/cart');
    }
    const subtotal = cart.reduce((sum, item) => sum + Number(item.subtotal), 0);

    res.status(status).render('checkout', {
        cart,
        subtotal,
        regions: PH_REGIONS,
        ewallets: EWALLETS,
        shippingRates: SHIPPING,
        error,
        form: { fullName: req.session.userName || '', paymentMethod: 'debit', ...form },
        userName: req.session.userName
    });
}

// Returns { error } or { form, payment }. Card number / CVV are validated here and then discarded.
function validateCheckout(body) {
    const clean = (v, max = 255) => String(v || '').trim().slice(0, max);

    const form = {
        fullName: clean(body.fullName),
        phone: clean(body.phone, 20).replace(/[\s-]/g, ''),
        street: clean(body.street),
        barangay: clean(body.barangay, 150),
        city: clean(body.city, 150),
        province: clean(body.province, 150),
        region: clean(body.region, 20),
        postalCode: clean(body.postalCode, 4),
        paymentMethod: clean(body.paymentMethod, 20),
        ewalletProvider: clean(body.ewalletProvider, 50),
        ewalletNumber: clean(body.ewalletNumber, 20).replace(/[\s-]/g, ''),
        cardName: clean(body.cardName)
    };
    const fail = (error) => ({ error, form });

    if (!form.fullName || !form.street || !form.barangay || !form.city || !form.province) {
        return fail('Please complete your delivery address.');
    }
    if (!REGION_CODES.has(form.region)) {
        return fail('Please choose your region.');
    }
    if (!/^(09\d{9}|\+639\d{9})$/.test(form.phone)) {
        return fail('Enter a valid Philippine mobile number (e.g. 09171234567).');
    }
    form.phone = form.phone.replace(/^\+63/, '0');
    if (!/^\d{4}$/.test(form.postalCode)) {
        return fail('Enter a valid 4-digit Philippine postal code.');
    }
    if (!PAYMENT_METHODS[form.paymentMethod]) {
        return fail('Please choose a payment method.');
    }

    const payment = { method: form.paymentMethod, provider: null, reference: null, status: 'Pay on delivery' };

    if (form.paymentMethod === 'debit') {
        const number = String(body.cardNumber || '').replace(/[\s-]/g, '');
        const cvv = String(body.cardCvv || '').trim();
        const expiry = String(body.cardExpiry || '').trim();
        const match = expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);

        if (!form.cardName) return fail('Enter the name on your debit card.');
        if (!/^\d{16}$/.test(number) || !luhnValid(number)) return fail('That debit card number is not valid.');
        if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) return fail('Enter the card expiry as MM/YY.');

        const now = new Date();
        const expYear = 2000 + Number(match[2]);
        const expMonth = Number(match[1]);
        if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
            return fail('That debit card has expired.');
        }
        if (!/^\d{3,4}$/.test(cvv)) return fail('Enter the 3 or 4-digit security code (CVV).');

        const brand = cardBrand(number);
        payment.provider = brand;
        payment.reference = `${brand} debit ending ${number.slice(-4)}`;
        payment.status = 'Paid';

    } else if (form.paymentMethod === 'ewallet') {
        if (!EWALLETS.includes(form.ewalletProvider)) return fail('Please choose an e-wallet.');
        if (!/^(09\d{9}|\+639\d{9})$/.test(form.ewalletNumber)) {
            return fail('Enter the mobile number linked to your e-wallet (e.g. 09171234567).');
        }
        const wallet = form.ewalletNumber.replace(/^\+63/, '0');
        payment.provider = form.ewalletProvider;
        payment.reference = `${form.ewalletProvider} account ending ${wallet.slice(-4)}`;
        payment.status = 'Paid';
    }

    return { form, payment };
}

// Checkout page
app.get('/checkout', requireLogin, csrfProtect, async (req, res) => {
    try {
        await renderCheckout(req, res);
    } catch (error) {
        console.error("Checkout Load Error:", error);
        res.status(500).send('Unable to load checkout.');
    }
});

// Place order
app.post('/checkout', requireLogin, csrfProtect, async (req, res) => {
    const userId = req.session.userId;

    const result = validateCheckout(req.body);
    if (result.error) {
        try {
            return await renderCheckout(req, res, { error: result.error, form: result.form, status: 400 });
        } catch (error) {
            console.error("Checkout Validation Render Error:", error);
            return res.status(500).send('Unable to load checkout.');
        }
    }
    const { form, payment } = result;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Lock the cart rows and their products so stock can't change mid-order
        const [items] = await conn.execute(`
            SELECT cart_items.quantity, products.id AS product_id, products.name, products.price, products.stock
            FROM cart_items
            INNER JOIN products ON cart_items.product_id = products.id
            WHERE cart_items.user_id = ?
            FOR UPDATE
        `, [userId]);

        if (items.length === 0) {
            await conn.rollback();
            return res.redirect('/cart');
        }

        for (const item of items) {
            if (item.quantity > item.stock) {
                await conn.rollback();
                const msg = item.stock > 0
                    ? `Only ${item.stock} of "${item.name}" left in stock. Please adjust your cart.`
                    : `"${item.name}" just went out of stock. Please remove it from your cart.`;
                return await renderCheckout(req, res, { error: msg, form, status: 409 });
            }
        }

        // Totals are always recalculated from database prices, never from the browser
        const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
        const shippingFee = shippingFor(form.region, subtotal);
        const total = subtotal + shippingFee;

        const [orderResult] = await conn.execute(
            `INSERT INTO orders
                (user_id, full_name, phone, street, barangay, city, province, region, postal_code,
                 payment_method, payment_provider, payment_reference, payment_status,
                 subtotal, shipping_fee, total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, form.fullName, form.phone, form.street, form.barangay, form.city, form.province,
             form.region, form.postalCode, payment.method, payment.provider, payment.reference,
             payment.status, subtotal, shippingFee, total]
        );
        const orderId = orderResult.insertId;

        for (const item of items) {
            await conn.execute(
                'INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)',
                [orderId, item.product_id, item.name, item.price, item.quantity]
            );
            await conn.execute(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        await conn.execute('DELETE FROM cart_items WHERE user_id = ?', [userId]);
        await conn.commit();

        res.redirect(`/orders/${orderId}`);

    } catch (error) {
        await conn.rollback().catch(() => {});
        console.error("Place Order Error:", error);
        res.status(500).send('Unable to place your order. Please try again.');
    } finally {
        conn.release();
    }
});

// Order confirmation (only the owner can view it)
app.get('/orders/:id', requireLogin, async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (!Number.isInteger(orderId)) {
            return res.status(404).send('Order not found.');
        }

        const [orders] = await db.execute(
            'SELECT * FROM orders WHERE id = ? AND user_id = ?',
            [orderId, req.session.userId]
        );
        if (orders.length === 0) {
            return res.status(404).send('Order not found.');
        }

        const [items] = await db.execute(
            'SELECT name, price, quantity FROM order_items WHERE order_id = ?',
            [orderId]
        );

        const regionName = (PH_REGIONS.find(r => r[0] === orders[0].region) || [])[1] || orders[0].region;

        res.render('order-success', {
            order: orders[0],
            items,
            regionName,
            orderNo: orderNumber(orderId),
            paymentLabel: PAYMENT_METHODS[orders[0].payment_method] || orders[0].payment_method,
            userName: req.session.userName
        });

    } catch (error) {
        console.error("Order View Error:", error);
        res.status(500).send('Unable to load order.');
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
    const description = String(body.description || '').replace(/\r\n/g, '\n').trim() || null;
    const image = String(body.image || '').trim() || '/images/no-image.svg';

    if (!name || name.length > 255) return { error: 'Product name is required (max 255 characters).' };

    const [cats] = await db.execute('SELECT id FROM categories WHERE name = ?', [category]);
    if (cats.length === 0) return { error: 'Please choose a valid category.' };

    const MAX_PRICE = 99999999.99; // DECIMAL(10, 2)
    if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) return { error: 'Price must be a number between 0 and 99,999,999.99.' };
    if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0 || oldPrice > MAX_PRICE)) return { error: 'Old price must be a number between 0 and 99,999,999.99.' };
    if (oldPrice !== null && oldPrice <= price) return { error: 'Old price must be higher than the new price for a discount. Leave it blank if there is no discount.' };
    if (!Number.isInteger(stock) || stock < 0 || stock > 2147483647) return { error: 'Stock must be a whole number of 0 or more.' };
    if (badge && badge.length > 50) return { error: 'Badge must be 50 characters or fewer.' };
    if (description && description.length > 2000) return { error: 'Description must be 2,000 characters or fewer.' };
    if (image.length > 255 || !/^(https?:\/\/|\/)/i.test(image)) return { error: 'Image must be an http(s) URL or a path starting with /.' };

    return { data: { name, category, price, oldPrice, stock, badge, image, description } };
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

// Turns a MySQL error into a message the admin can act on
function describeDbError(err) {
    switch (err.code) {
        case 'ER_BAD_FIELD_ERROR':
        case 'ER_NO_SUCH_TABLE':
            return 'The products table in the database is out of date. Restart the app so it can update it, then try again.';
        case 'ER_DATA_TOO_LONG':
            return 'One of the values is too long for its database column (name 255, badge 50, image 255 characters, description 2,000).';
        case 'ER_WARN_DATA_OUT_OF_RANGE':
        case 'ER_DATA_OUT_OF_RANGE':
            return 'A number is too large for its database column.';
        case 'ECONNREFUSED':
        case 'PROTOCOL_CONNECTION_LOST':
            return 'Could not reach the database. Check that MySQL is running.';
        default:
            return 'Could not save to the database. Check the server console for details.';
    }
}

// Runs an admin action; any database error is logged and shown as a flash message
function dbAction(action) {
    return async (req, res) => {
        try {
            await action(req, res);
        } catch (err) {
            console.error('[admin] database error:', err.code || '', err.message);
            setFlash(req, 'error', describeDbError(err));
            res.redirect('/admin#products');
        }
    };
}

// Add product
adminRouter.post('/products', dbAction(async (req, res) => {
    const { error, data } = await parseProductForm(req.body);
    if (error) {
        setFlash(req, 'error', error);
        return res.redirect('/admin#products');
    }

    const [result] = await db.execute(
        `INSERT INTO products (name, category, price, oldPrice, stock, image, badge, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.name, data.category, data.price, data.oldPrice, data.stock, data.image, data.badge, data.description]
    );

    // Read the row back so the success message only appears if it is really in the database
    const [saved] = await db.execute('SELECT id FROM products WHERE id = ?', [result.insertId]);
    if (saved.length === 0) {
        throw new Error(`Row ${result.insertId} was not found after INSERT`);
    }

    setFlash(req, 'success', `Saved "${data.name}" to the database in ${data.category} (product #${result.insertId}).`);
    res.redirect('/admin#products');
}));

// Edit product
adminRouter.post('/products/:id', dbAction(async (req, res) => {
    const { error, data } = await parseProductForm(req.body);
    if (error) {
        setFlash(req, 'error', error);
        return res.redirect('/admin#products');
    }

    await db.execute(
        `UPDATE products
         SET name = ?, category = ?, price = ?, oldPrice = ?, stock = ?, image = ?, badge = ?, description = ?
         WHERE id = ?`,
        [data.name, data.category, data.price, data.oldPrice, data.stock, data.image, data.badge, data.description, req.params.id]
    );

    // An UPDATE that changes nothing reports 0 rows, so check the row exists instead
    const [saved] = await db.execute('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (saved.length === 0) {
        setFlash(req, 'error', 'Product not found. It may have been deleted.');
    } else {
        setFlash(req, 'success', `Updated "${data.name}" in the database (product #${req.params.id}).`);
    }
    res.redirect('/admin#products');
}));

// Delete product (cart_items rows cascade)
adminRouter.post('/products/:id/delete', dbAction(async (req, res) => {
    const [result] = await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    setFlash(req, result.affectedRows ? 'success' : 'error',
        result.affectedRows ? 'Product deleted from the database.' : 'Product not found.');
    res.redirect('/admin#products');
}));

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