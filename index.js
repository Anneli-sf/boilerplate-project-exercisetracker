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

//create tables
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

db.run(`CREATE TABLE IF NOT EXISTS exercises (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  description TEXT NOT NULL,
  duration INTEGER NOT NULL CHECK (duration > 0),
  date TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(_id)
)`, (err) => {
  if (err) {
    console.error('Error creating exercises table:', err.message);
  } else {
    console.log('Exercises table created successfully');
  }
});

//requests
async function addUser(username) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO users (username) VALUES (?)', [username], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function getLastId() {
  return new Promise((resolve, reject) => {
    db.get('SELECT last_insert_rowid() AS lastID', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

app.post("/api/users", async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username cannot be empty' });
  }

  try {

    await addUser(username);

    const result = await getLastId();
    const userId = result.lastID;

    console.log(`User ${username} with id ${userId} was added`);
    res.status(200).json({ id: userId, username: username });

  } catch (err) {

    if (err.code === 'SQLITE_CONSTRAINT') {
      console.error('Username is not unique:', err.message);
      res.status(400).json({ err: 'Username is not unique' });
    } else {
      console.error('Error adding User:', err.message);
      res.status(500).json({ err: 'server error' });
    }
  }
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

//find user by Id
async function findUser(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE _id = ?', [userId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

//post api/users/:_id/exercises
app.post("/api/users/:_id/exercises", async (req, res) => {

  const userId = req.params._id;
  const { description, duration, date } = req.body;

  if (!duration || typeof (+duration) !== 'number' || isNaN(duration)) {
    return res.status(400).json({ error: 'Please, enter valid duration' });
  }

  if (!description) {
    return res.status(400).json({ error: 'Please, enter description' });
  }

  const exerciseDate = date ? new Date(date) : new Date();
  if (isNaN(exerciseDate.getTime())) {
    return res.status(400).json({ error: 'Please, enter valid Date format yyyy-mm-dd' });
  }

  try {
    const user = await findUser(userId);

    if (!user) {
      return res.status(404).json({ error: 'User was not found' });
    }

    const resId = await new Promise((resolve, reject) => {
      db.run('INSERT INTO exercises (userId, description, duration, date) VALUES (?, ?, ?, ?)',
        [userId, description, duration, exerciseDate.toISOString()], function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(userId);
          }
        });
    });

    const exercise = {
      _id: +resId,
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

// get /api/users/:_id/logs
async function countExercises(query, params) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) AS count FROM (${query})`, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.count);
      }
    });
  });
}

async function getExercises(query, params) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

app.get("/api/users/:_id/logs", async (req, res) => {
  const userId = +req.params._id;

  try {
    const user = await findUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User was not founded' });
    }

    const { from, to, limit } = req.query;

    let query = 'SELECT * FROM exercises WHERE userId = ?';
    let params = [userId];

    if (from && to) {
      query += ' AND date BETWEEN ? AND ?';
      params.push(from, to);
    } else if (from) {
      query += ' AND date >= ?';
      params.push(from);
    } else if (to) {
      query += ' AND date <= ?';
      params.push(to);
    }

    const count = await countExercises(query, params);

    query += ' ORDER BY date ASC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const exercises = await getExercises(query, params);

    if (!exercises.length) {
      return res.status(404).json({ error: 'There are no exercises for this user' });
    }

    const logs = exercises.map(exercise => ({
      description: exercise.description,
      duration: exercise.duration,
      date: new Date(exercise.date).toDateString()
    }));

    const userLog = {
      username: user.username,
      count: count,
      _id: +userId,
      log: logs
    };

    res.status(200).json(userLog);

  } catch (err) {
    console.error('Error getting logs:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
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




