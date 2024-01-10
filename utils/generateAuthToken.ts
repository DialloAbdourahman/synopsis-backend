const jwt = require('jsonwebtoken');

const generateAccessToken = (data: any, secrete: string) => {
  const token = jwt.sign({ data }, secrete, {
    expiresIn: '10m',
  });
  return token;
};

module.exports = { generateAccessToken };
