const express = require('express');
const cors = require('cors');
const path = require('path');
const { port } = require('./config/env');
const apiRouter = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRouter);

// Static dashboard
app.use('/', express.static(path.join(__dirname, '../public')));

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});