import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma: PrismaClient = require('../utils/prismaClient');
const bcrypt = require('bcrypt');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const { generateAccessToken } = require('../utils/generateAuthToken');

const createAccount = async (req: Request, res: Response) => {
  try {
    // Get all the user's information
    let { name, email, password, login, dob } = req.body;

    // Check if all fields are present
    if (!name || !email || !password || !login || !dob) {
      return res
        .status(400)
        .json({ message: 'Please provide name, email, login, dob password' });
    }

    // Validate the email
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid Email' });
    }

    // Check if user email exists already
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { login }],
      },
    });
    if (user) {
      return res.status(400).json({ message: 'Email or login already used' });
    }

    // Hash the password
    password = await bcrypt.hash(password, 8);

    // Create a user
    await prisma.user.create({
      data: {
        name,
        email,
        password,
        dob,
        login,
      },
    });

    // Send back response
    return res
      .status(201)
      .json({ message: 'user has been created successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong.', error });
  }
};

const login = async (req: Request, res: Response) => {
  try {
    // Get all the user's information.
    let { login, password } = req.body;

    // Check if all fields are present.
    if (!login || !password) {
      return res
        .status(400)
        .json({ message: 'Please provide login and password' });
    }

    // Check if the login matches.
    const user = await prisma.user.findUnique({
      where: {
        login,
      },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        dob: true,
        login: true,
      },
    });
    if (!user) {
      return res.status(400).json({ message: 'Unable to login' });
    }

    // Check the login history.
    const loginHistory = await prisma.loginHistory.findMany({
      where: { userId: user.id },
      orderBy: {
        time: 'desc',
      },
    });

    if (loginHistory.length > 0) {
      if (
        loginHistory[0]?.success === false &&
        loginHistory[1]?.success === false &&
        loginHistory[2]?.success === false
      ) {
        var toTime = new Date();
        let differenceTime = toTime.getTime() - loginHistory[0]?.time.getTime();
        let seconds = Math.floor(differenceTime / 1000);
        if (seconds < 60) {
          return res.status(400).json({
            message: 'Your account has been blocked for 1 min',
            blocked: true,
            time: 60 - seconds,
          });
        }
      }
    }

    // Now compare the passwords.
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Create a login history
      await prisma.loginHistory.create({
        data: {
          userId: user.id,
          success: false,
        },
      });

      // Check the login history.
      const loginHistory = await prisma.loginHistory.findMany({
        where: { userId: user.id },
        orderBy: {
          time: 'desc',
        },
      });
      if (loginHistory.length > 0) {
        if (
          loginHistory[0]?.success === false &&
          loginHistory[1]?.success === false &&
          loginHistory[2]?.success === false &&
          !isMatch
        ) {
          var toTime = new Date();
          let differenceTime =
            toTime.getTime() - loginHistory[0]?.time.getTime();
          let seconds = Math.floor(differenceTime / 1000);
          if (seconds < 60) {
            return res.status(400).json({
              message: 'Your account has been blocked for 1 min',
              blocked: true,
              time: 60 - seconds,
            });
          }
        }
      }
      return res.status(400).json({ message: 'Unable to login' });
    }

    // Generate access token
    let dataToGenerateAuthToken: any = {
      ...user,
      password: undefined,
    };
    const accessToken = generateAccessToken(
      dataToGenerateAuthToken,
      process.env.JWT_ACCESS_TOKEN_SECRET
    );

    // Create a login history
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        success: true,
      },
    });

    // Send back response.
    res.status(200).json({
      name: user.name,
      email: user.email,
      dob: user.dob,
      login: user.login,
      accessToken,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong.', error });
  }
};

const updateAccount = async (req: Request, res: Response) => {
  try {
    // Get the enteries and create a valid enteries array
    const enteries = Object.keys(req.body);

    if (enteries.length < 1) {
      return res.status(400).json({ message: 'Please provide data to us.' });
    }

    const allowedEntery = ['name', 'email', 'password', 'dob', 'oldPassword'];

    // Check if the enteries are valid
    const isValidOperation = enteries.every((entery) => {
      return allowedEntery.includes(entery);
    });

    // Send negative response if the enteries are not allowed.
    if (!isValidOperation) {
      res.status(400).send({
        message: 'You are trying to update data you are not allowed to',
      });
      return;
    }

    // Check if the email is to be updated.
    const emailUpdate = enteries.find((entery) => entery === 'email');
    if (emailUpdate) {
      if (!validator.isEmail(req.body.email)) {
        return res.status(400).json({ message: 'Invalid Email' });
      }
    }

    // Check if the password is to be updated.
    const passwordUpdate = enteries.find((entery) => entery === 'password');
    const oldPassword = enteries.find((entery) => entery === 'oldPassword');
    if (passwordUpdate) {
      // Check if the old password has been provided.
      if (!oldPassword) {
        return res.status(400).json({
          message:
            'To update the password, you need to provide the old password.',
        });
      }

      // Get the db password.
      const dbPassword = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          password: true,
        },
      });

      // Check if the old password is equal to the db password
      const isMatch = await bcrypt.compare(
        req.body.oldPassword,
        dbPassword?.password
      );
      if (!isMatch) {
        return res
          .status(400)
          .json({ message: 'The old password does not match' });
      }

      // Remove the old password field
      req.body.oldPassword = undefined;

      // Set the hash new password
      req.body.password = await bcrypt.hash(req.body.password, 8);
    }

    // Make sure that the old password field is not there when a password is not updated.
    if (!passwordUpdate && oldPassword) {
      req.body.oldPassword = undefined;
    }

    // Update the user's information.
    const user = await prisma.user.update({
      where: {
        id: req.user.id,
      },
      data: {
        ...req.body,
      },
      select: {
        name: true,
        email: true,
        dob: true,
      },
    });

    // Send back a positive response
    res.status(200).json({
      message: 'Your credentials have been updated successfully.',
      user,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong.', error });
  }
};

const deleteAccount = async (req: Request, res: Response) => {
  try {
    await prisma.user.delete({
      where: {
        id: req.user.id,
      },
    });

    // Send back a positive response
    res.status(200).json({
      message: 'Your account has been deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong.', error });
  }
};

const seeLoginHistory = async (req: Request, res: Response) => {
  try {
    let page: number = Number(req.query.page);

    const itemPerPage = 10;
    page = page - 1;

    const history = await prisma.loginHistory.findMany({
      take: itemPerPage,
      skip: itemPerPage * page,
      where: {
        userId: req.user.id,
      },
      select: {
        id: true,
        success: true,
        time: true,
      },
      orderBy: {
        time: 'desc',
      },
    });

    // Count the number of pages
    let count = await prisma.loginHistory.count({
      where: {
        userId: req.user.id,
      },
    });
    count = Math.ceil(count / itemPerPage);

    // Send back a positive response
    res.status(200).json({
      history,
      count,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong.', error });
  }
};

module.exports = {
  createAccount,
  login,
  updateAccount,
  deleteAccount,
  seeLoginHistory,
};
