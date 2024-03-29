
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
// const { promisify } = require('util');

app.use(cors());
app.use(express.urlencoded({ extended: true }));
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
// const useAsync = promisify(db.run.bind(db));

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
app.post("/api/users", async (req, res) => {

  const { username } = req.body;

  new Promise((resolve, reject) => {
    db.run('INSERT INTO users (username) VALUES (?)', [username], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  })
    .then(() => {
      return new Promise((resolve, reject) => {
        db.get('SELECT last_insert_rowid() AS lastID', (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    })
    .then(result => {
      const userId = result.lastID;
      console.log(`User ${username} with id ${userId} was added`);
      res.status(200).json({ id: userId, username: username });
    })
    .catch(err => {
      if (err.code === 'SQLITE_CONSTRAINT') {
        console.error('Username is not unique:', err.message);
        res.status(400).json({ err: 'Username is not unique' });
      } else {
        console.error('Error adding User:', err.message);
        res.status(500).json({ err: 'server error' });
      }
    });
});






//handle server
const listener = app.listen(process.env.PORT || 3001, () => {
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