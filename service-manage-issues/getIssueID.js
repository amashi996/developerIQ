const express = require("express");
const AWS = require("aws-sdk");

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

//Specify table name and column name
const TABLE_NAME = "dev_issues_update";

const getIssues = async () => {
    const params = {
        TableName: TABLE_NAME,
    };
    const issues = await dynamoClient.scan(params).promise();
    console.log(issues);
    return issues;
};

module.exports = {
    dynamoClient,
    getIssues
};