const express = require("express");
const AWS = require("aws-sdk");
const bodyParser = require("body-parser");
const jsonParser = bodyParser.json();

const path = require("path");
const envPath = path.resolve(__dirname, "../.env");
require("dotenv").config({ path: envPath });

// Initialize AWS DynamoDB client
AWS.config.update({
  region: process.env.AWS_DEFAULT_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const docClient = new AWS.DynamoDB.DocumentClient();

// Initialize express application
const app = express();
const port = 3001;

// Specify table name and column name
const tableName = "dev_commits";
const colName = "commitID";

// Define route to retrieve the max value of commitID
app.get("/getMaxCommitID", async (req, res) => {
  try {
    console.log("Hello");
    const params = {
      TableName: tableName,
    };

    const commitData = await docClient.scan(params).promise();

    if (commitData.Items && commitData.Items.length > 0) {
      const maxVal = Math.max(...commitData.Items.map((item) => item[colName]));
      console.log(`The maximum value for ${colName} is: ${maxVal}`);
      res.json({ maxVal: maxVal + 1 });
    } else {
      console.log("No items found in the table");
      res.status(404).json({ message: "No items found in the table" });
    }
  } catch (error) {
    console.error("Error in scanning the table: ", error);
    res.status(500).json({
      error: "Error in scanning the table",
    });
  }
});

// Define a route to get the GitHub token from AWS Secrets Manager
app.get("/getGHToken", async (req, res) => {
  const secretName = "GITHUB_PAT";
  const regionName = "ap-south-1";
  const secretsManager = new AWS.SecretsManager({ region: regionName });

  try {
    const data = await secretsManager
      .getSecretValue({ SecretId: secretName })
      .promise();
    const secret = JSON.parse(data.SecretString);
    console.log(typeof secret.github_token);
    res.json({ github_token: secret.github_token });
  } catch (error) {
    console.error("Error retrieving GitHub token from Secrets Manager:", error);
    res
      .status(500)
      .json({ error: "Error retrieving GitHub token from Secrets Manager" });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
