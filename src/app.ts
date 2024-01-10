// Imports
import express from 'express';
const app = express();
const cors = require('cors');

// Express configurations.
app.use(
  cors({
    origin: ['http://localhost:3000'],
    method: ['POST', 'GET', 'PUT', 'DELETE'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Adding user and token on the request object.
declare global {
  namespace Express {
    interface Request {
      user: any;
    }
  }
}

// All the routers import
const userRouter = require('../routers/userRouter');

// Routes to routers mapping.
app.use('/api/user', userRouter);

// Exporting the app module
module.exports = app;

// check the .length rather than the optional chaining and test.
