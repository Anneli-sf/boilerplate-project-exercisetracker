
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

app.use(cors());
app.use(express.urlencoded({ extended: true}));
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to database');
  }
});

//USER
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL
)`, (err) => {
  if (err) {
    console.error('Error creating users table:', err.message);
  } else {
    console.log('Users table created successfully');
  }
});


//add User
app.post("/api/users", (req, res) => {
 
  const { username } = req.body;
  
  db.run('INSERT INTO users (username) VALUES (?)', [username], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        console.error('Username is not unique:', err.message);
        res.status(400).json({ error: 'Username is not unique'});
      } else {
        console.error('Error adding User:', err.message);
        res.status(500).json({ error: 'server error' });
      } 
    } else {
      console.log(`User ${username} with id ${this.lastID} was added`);
      res.status(200).json({ id: this.lastID, username: username });
    }
  });
});


//handle server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});

process.on('SIGINT', async () => {
  if (db) {
    await db.close();
  }
  listener.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});