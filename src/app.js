const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const followRoutes = require('./routes/follow.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/follows', followRoutes);

app.get('/', (req, res) => {
  res.send('Instagram Backend API Running 🚀');
});

module.exports = app;
