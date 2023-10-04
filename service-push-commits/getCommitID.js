const express = require("express");
const AWS = require("aws-sdk");
/*const bodyParser = require("body-parser");
const jsonParser = bodyParser.json();*/

const path = require("path");
const envPath = path.resolve(__dirname, "../.env");
require("dotenv").config({ path: envPath });

// Initialize AWS DynamoDB client
AWS.config.update({
  region: process.env.AWS_DEFAULT_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const dynamoClient = new AWS.DynamoDB.DocumentClient();

/*Initialize express application
const app = express();
const port = 3001;*/

// Specify table name and column name
const TABLE_NAME = "dev_commits";
const COL_NAME = "commitID";

const getCommit = async () => {
  const params = {
    TableName: TABLE_NAME,
  };
  const commits = await dynamoClient.scan(params).promise();
  console.log(commits);
  return commits;
};

module.exports = {
  dynamoClient,
  getCommit,
};
