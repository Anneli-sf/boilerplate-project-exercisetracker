
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

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

//USER
db.run(`CREATE TABLE IF NOT EXISTS users (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  if (!username) {
    return res.status(400).json({ error: 'Username cannot be empty' });
  }

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


//get users (User[])
app.get("/api/users", (req, res) => {
  new Promise((resolve, reject) => {
    db.all(`SELECT * FROM users`, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  })
    .then(users => {
      res.status(200).json(users);
    })
    .catch(err => {
      console.error('Error getting users', err.message);
      res.status(500).json({ err: 'server error' });
    });
});

db.run(`CREATE TABLE IF NOT EXISTS exercises (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  description TEXT NOT NULL,
  duration INTEGER NOT NULL,
  date TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(_id)
)`, (err) => {
  if (err) {
    console.error('Error creating exercises table:', err.message);
  } else {
    console.log('Exercises table created successfully');
  }
});

//post /api/users/:_id/exercises
app.post("/api/users/:_id/exercises", async (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  if (!description || !duration) {
    return res.status(400).json({ error: 'Description and duration are required' });
  }

  const exerciseDate = date ? new Date(date) : new Date();

  try {
    const result = await new Promise((resolve, reject) => {
      db.run('INSERT INTO exercises (userId, description, duration, date) VALUES (?, ?, ?, ?)',
        [userId, description, duration, exerciseDate.toISOString()], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        });
    });

    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE _id = ?', [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    const exercise = {
      _id: result,
      username: user.username,
      description,
      duration: parseInt(duration),
      date: exerciseDate.toDateString()
    };

    res.status(200).json(exercise);
  } catch (err) {
    console.error('Error adding exercise:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
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