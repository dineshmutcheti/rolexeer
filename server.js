const express = require('express');
const mysql = require('mysql2');
const axios = require('axios');
const app = express();

// Create a connection to the MySQL database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',       // Replace with your MySQL username
    password: 'Dinesh@4592',       // Replace with your MySQL password
    database: 'transactions_db'
});

// Connect to MySQL
db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Middleware to parse JSON
app.use(express.json());

// Fetch data from the third-party API and seed the database
app.get('/initialize', async (req, res) => {
    try {
        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
        const transactions = response.data;

        const query = `
            INSERT INTO transactions (title, description, price, category, dateOfSale, sold)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        // Insert each transaction into the MySQL table
        transactions.forEach(transaction => {
            db.query(query, [
                transaction.title,
                transaction.description,
                transaction.price,
                transaction.category,
                new Date(transaction.dateOfSale), // Convert dateOfSale to a Date object
                transaction.sold
            ], (err, result) => {
                if (err) {
                    console.error('Error inserting data:', err);
                }
            });
        });

        res.send('Database initialized with seed data');
    } catch (error) {
        res.status(500).send('Error fetching or inserting data');
    }
});

// API to list all transactions with search and pagination
app.get('/transactions', (req, res) => {
    const { search, page = 1, perPage = 10, month } = req.query;

    const offset = (page - 1) * perPage;
    let query = `SELECT * FROM transactions WHERE MONTH(dateOfSale) = ? `;
    const params = [month];

    if (search) {
        query += `AND (title LIKE ? OR description LIKE ? OR price LIKE ?) `;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += `LIMIT ?, ?`;
    params.push(offset, parseInt(perPage));

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error fetching transactions:', err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

// API to get statistics for a given month
app.get('/statistics', (req, res) => {
    const { month } = req.query;

    const totalSalesQuery = `SELECT SUM(price) AS totalSales FROM transactions WHERE MONTH(dateOfSale) = ? AND sold = true`;
    const soldItemsQuery = `SELECT COUNT(*) AS soldItems FROM transactions WHERE MONTH(dateOfSale) = ? AND sold = true`;
    const notSoldItemsQuery = `SELECT COUNT(*) AS notSoldItems FROM transactions WHERE MONTH(dateOfSale) = ? AND sold = false`;

    const params = [month];

    db.query(totalSalesQuery, params, (err, totalSalesResult) => {
        if (err) return res.status(500).send('Error fetching total sales');

        db.query(soldItemsQuery, params, (err, soldItemsResult) => {
            if (err) return res.status(500).send('Error fetching sold items');

            db.query(notSoldItemsQuery, params, (err, notSoldItemsResult) => {
                if (err) return res.status(500).send('Error fetching not sold items');

                res.json({
                    totalSales: totalSalesResult[0].totalSales,
                    soldItems: soldItemsResult[0].soldItems,
                    notSoldItems: notSoldItemsResult[0].notSoldItems
                });
            });
        });
    });
});

// API for bar chart data
app.get('/bar-chart', (req, res) => {
    const { month } = req.query;

    const query = `
        SELECT
            CASE
                WHEN price BETWEEN 0 AND 100 THEN '0-100'
                WHEN price BETWEEN 101 AND 200 THEN '101-200'
                WHEN price BETWEEN 201 AND 300 THEN '201-300'
                WHEN price BETWEEN 301 AND 400 THEN '301-400'
                WHEN price BETWEEN 401 AND 500 THEN '401-500'
                WHEN price BETWEEN 501 AND 600 THEN '501-600'
                WHEN price BETWEEN 601 AND 700 THEN '601-700'
                WHEN price BETWEEN 701 AND 800 THEN '701-800'
                WHEN price BETWEEN 801 AND 900 THEN '801-900'
                ELSE '901-above'
            END AS priceRange,
            COUNT(*) AS itemCount
        FROM transactions
        WHERE MONTH(dateOfSale) = ?
        GROUP BY priceRange
    `;

    db.query(query, [month], (err, results) => {
        if (err) {
            console.error('Error fetching bar chart data:', err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

// API for pie chart data
app.get('/pie-chart', (req, res) => {
    const { month } = req.query;

    const query = `
        SELECT category, COUNT(*) AS itemCount
        FROM transactions
        WHERE MONTH(dateOfSale) = ?
        GROUP BY category
    `;

    db.query(query, [month], (err, results) => {
        if (err) {
            console.error('Error fetching pie chart data:', err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

// Start the server
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
