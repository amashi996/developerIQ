const fs = require("fs");
const AWS = require("aws-sdk");
require("dotenv").config();

const token = fs.readFileSync("token.txt", "utf-8").trim();

AWS.config.update({
  region: process.env.AWS_DEFAULT_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

console.log("AWS Access Key ID:", process.env.AWS_ACCESS_KEY_ID);
console.log("AWS Secret Access Key ID:", process.env.AWS_SECRET_ACCESS_KEY);
console.log("AWS Region:", process.env.AWS_DEFAULT_REGION);
console.log("GitHub Token:", token);
