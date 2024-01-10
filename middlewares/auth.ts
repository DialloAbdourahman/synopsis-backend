import { Request, Response, NextFunction } from 'express';
const jwt = require('jsonwebtoken');

const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the token and decode it.
    const accessToken: any = req
      .header('Authorization')
      ?.replace('Bearer ', '');
    const decoded = jwt.verify(
      accessToken,
      process.env.JWT_ACCESS_TOKEN_SECRET
    );

    // Attach the user's data to the request object.
    req.user = { ...decoded.data };

    // Run the next funtions so that the next function can be executed.
    next();
  } catch (error: any) {
    if (
      error?.name === 'TokenExpiredError' &&
      error?.message === 'jwt expired'
    ) {
      res
        .status(401)
        .json({ message: 'Token has expired, login again', error });
      return;
    }
    res.status(401).json({ message: 'Please authenticate.', error });
  }
};

module.exports = {
  auth,
};
