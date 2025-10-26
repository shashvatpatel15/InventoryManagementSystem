// --- Import required libraries ---
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

// --- Setup Express App ---
const app = express();
const port = 3001;
app.use(cors());
app.use(express.json());

// --- MySQL Database Connection ---
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Shashvat@9211', // !! UPDATE THIS !!
    database: 'inventory_system'
}).promise();

// Test connection
db.getConnection()
    .then(connection => console.log('✅ Successfully connected to MySQL database!'))
    .catch(err => console.error('❌ Database connection failed: \n', err));

// --- Helper function for Foreign Key Errors ---
function handleDbError(err, res) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({ message: 'Error: Cannot delete: This item is in use by another record.' });
    }
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Error: This ID already exists.' });
    }
    console.error(err); // Log other errors
    res.status(500).json({ message: 'Server error' });
}

// --- 1. PRODUCT Routes (Full CRUD) ---
app.post('/api/products', async (req, res) => {
    try {
        const { product_id, name, qty, price, warehouse_id } = req.body;
        const sql = "INSERT INTO products (product_id, name, qty, price, warehouse_id) VALUES (?, ?, ?, ?, ?)";
        await db.query(sql, [product_id, name, qty, price, warehouse_id]);
        res.status(201).json({ message: 'Product added successfully!' });
    } catch (err) { handleDbError(err, res); }
});
app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM products ORDER BY name");
        res.json(rows);
    } catch (err) { handleDbError(err, res); }
});
app.get('/api/products/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM products WHERE product_id = ?", [req.params.id]);
        res.json(rows[0] || null);
    } catch (err) { handleDbError(err, res); }
});
app.put('/api/products/:id', async (req, res) => {
    try {
        const { name, qty, price, warehouse_id } = req.body;
        const sql = "UPDATE products SET name = ?, qty = ?, price = ?, warehouse_id = ? WHERE product_id = ?";
        await db.query(sql, [name, qty, price, warehouse_id, req.params.id]);
        res.json({ message: 'Product updated successfully!' });
    } catch (err) { handleDbError(err, res); }
});
app.delete('/api/products/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM products WHERE product_id = ?", [req.params.id]);
        res.json({ message: 'Product deleted successfully!' });
    } catch (err) { handleDbError(err, res); }
});

// --- 2. SUPPLIER Routes (Full CRUD) ---
app.post('/api/suppliers', async (req, res) => {
    try {
        const { supplier_id, name, phone_no } = req.body;
        const sql = "INSERT INTO suppliers (supplier_id, name, phone_no) VALUES (?, ?, ?)";
        await db.query(sql, [supplier_id, name, phone_no]);
        res.status(201).json({ message: 'Supplier added successfully!' });
    } catch (err) { handleDbError(err, res); }
});
app.get('/api/suppliers', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM suppliers ORDER BY name");
        res.json(rows);
    } catch (err) { handleDbError(err, res); }
});
app.get('/api/suppliers/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM suppliers WHERE supplier_id = ?", [req.params.id]);
        res.json(rows[0] || null);
    } catch (err) { handleDbError(err, res); }
});
app.put('/api/suppliers/:id', async (req, res) => {
    try {
        const { name, phone_no } = req.body;
        const sql = "UPDATE suppliers SET name = ?, phone_no = ? WHERE supplier_id = ?";
        await db.query(sql, [name, phone_no, req.params.id]);
        res.json({ message: 'Supplier updated successfully!' });
    } catch (err) { handleDbError(err, res); }
});
app.delete('/api/suppliers/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM suppliers WHERE supplier_id = ?", [req.params.id]);
        res.json({ message: 'Supplier deleted successfully!' });
    } catch (err) { handleDbError(err, res); }
});

// --- 3. WAREHOUSE Routes (Full CRUD) ---
app.post('/api/warehouses', async (req, res) => {
    try {
        const { warehouse_id, name, location } = req.body;
        const sql = "INSERT INTO warehouses (warehouse_id, name, location) VALUES (?, ?, ?)";
        await db.query(sql, [warehouse_id, name, location]);
        res.status(201).json({ message: 'Warehouse added successfully!' });
    } catch (err) { handleDbError(err, res); }
});
app.get('/api/warehouses', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM warehouses ORDER BY name");
        res.json(rows);
    } catch (err) { handleDbError(err, res); }
});
app.get('/api/warehouses/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM warehouses WHERE warehouse_id = ?", [req.params.id]);
        res.json(rows[0] || null);
    } catch (err) { handleDbError(err, res); }
});
app.put('/api/warehouses/:id', async (req, res) => {
    try {
        const { name, location } = req.body;
        const sql = "UPDATE warehouses SET name = ?, location = ? WHERE warehouse_id = ?";
        await db.query(sql, [name, location, req.params.id]);
        res.json({ message: 'Warehouse updated successfully!' });
    } catch (err) { handleDbError(err, res); }
});
app.delete('/api/warehouses/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM warehouses WHERE warehouse_id = ?", [req.params.id]);
        res.json({ message: 'Warehouse deleted successfully!' });
    } catch (err) { handleDbError(err, res); }
});

// --- 4. PURCHASE ORDER Routes (With Transaction Logic) ---
app.post('/api/purchase-orders', async (req, res) => {
    const { product_id, supplier_id, qty_req, price } = req.body;
    if (!product_id || !supplier_id || !qty_req || !price) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Step 1: Insert the Purchase Order
        const poSql = "INSERT INTO purchase_orders (product_id, supplier_id, qty_req, price) VALUES (?, ?, ?, ?)";
        await connection.query(poSql, [product_id, supplier_id, qty_req, price]);

        // Step 2: Update the product quantity (add to stock)
        const updateSql = "UPDATE products SET qty = qty + ? WHERE product_id = ?";
        const [updateResult] = await connection.query(updateSql, [qty_req, product_id]);

        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Error: Product ID not found. PO was not created.' });
        }

        await connection.commit();
        res.status(201).json({ message: 'Purchase Order created and stock updated!' });

    } catch (err) {
        if (connection) await connection.rollback();
        handleDbError(err, res);
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/purchase-orders', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM purchase_orders ORDER BY order_date DESC");
        res.json(rows);
    } catch (err) { handleDbError(err, res); }
});
app.get('/api/purchase-orders/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM purchase_orders WHERE po_id = ?", [req.params.id]);
        res.json(rows[0] || null);
    } catch (err) { handleDbError(err, res); }
});
app.put('/api/purchase-orders/:id', async (req, res) => {
    // Note: This edit logic does NOT adjust stock. 
    // A true enterprise app would require complex logic to reverse the old qty and add the new one.
    try {
        const { product_id, supplier_id, qty_req, price } = req.body;
        const sql = "UPDATE purchase_orders SET product_id = ?, supplier_id = ?, qty_req = ?, price = ? WHERE po_id = ?";
        await db.query(sql, [product_id, supplier_id, qty_req, price, req.params.id]);
        res.json({ message: 'PO updated successfully!' });
    } catch (err) { handleDbError(err, res); }
});
app.delete('/api/purchase-orders/:id', async (req, res) => {
    // Note: This does NOT "return" the stock. It just deletes the record.
    try {
        await db.query("DELETE FROM purchase_orders WHERE po_id = ?", [req.params.id]);
        res.json({ message: 'PO deleted successfully!' });
    } catch (err) { handleDbError(err, res); }
});

// --- 5. SALES ORDER Routes (With Transaction Logic) ---
app.post('/api/sales-orders', async (req, res) => {
    const { product_id, supplier_id, qty, price } = req.body;
    const qty_sold = parseInt(qty, 10);
    
    if (!product_id || !supplier_id || !qty_sold || !price) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Step 1: Check stock and lock the product row
        const checkSql = "SELECT qty FROM products WHERE product_id = ? FOR UPDATE";
        const [rows] = await connection.query(checkSql, [product_id]);

        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Error: Product ID not found.' });
        }

        const currentStock = rows[0].qty;

        // Step 2: If stock is insufficient, abort
        if (currentStock < qty_sold) {
            await connection.rollback();
            return res.status(400).json({ message: `Error: Not enough stock. Only ${currentStock} remaining.` });
        }

        // Step 3: Insert the Sales Order
        const soSql = "INSERT INTO sales_orders (product_id, supplier_id, qty, price) VALUES (?, ?, ?, ?)";
        await connection.query(soSql, [product_id, supplier_id, qty_sold, price]);

        // Step 4: Update the product quantity (subtract from stock)
        const updateSql = "UPDATE products SET qty = qty - ? WHERE product_id = ?";
        await connection.query(updateSql, [qty_sold, product_id]);

        // Step 5: Commit
        await connection.commit();
        res.status(201).json({ message: 'Sales Order created and stock updated!' });

    } catch (err) {
        if (connection) await connection.rollback();
        handleDbError(err, res);
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/sales-orders', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM sales_orders ORDER BY sale_date DESC");
        res.json(rows);
    } catch (err) { handleDbError(err, res); }
});
app.get('/api/sales-orders/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM sales_orders WHERE so_id = ?", [req.params.id]);
        res.json(rows[0] || null);
    } catch (err) { handleDbError(err, res); }
});
app.put('/api/sales-orders/:id', async (req, res) => {
    try {
        const { product_id, supplier_id, qty, price } = req.body;
        const sql = "UPDATE sales_orders SET product_id = ?, supplier_id = ?, qty = ?, price = ? WHERE so_id = ?";
        await db.query(sql, [product_id, supplier_id, qty, price, req.params.id]);
        res.json({ message: 'SO updated successfully!' });
    } catch (err) { handleDbError(err, res); }
});
app.delete('/api/sales-orders/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM sales_orders WHERE so_id = ?", [req.params.id]);
        res.json({ message: 'SO deleted successfully!' });
    } catch (err) { handleDbError(err, res); }
});

// --- Start the Server ---
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});