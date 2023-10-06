const express = require("express");
const app = express();
const axios = require("axios");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const { getIssues } = require("./getIssueID");

const COL_NAME = "issueID";
const TOKEN_FILE_PATH = path.resolve(__dirname, "../token.txt");
require("dotenv").config({ path: TOKEN_FILE_PATH });

//Define a function to get the GitHub token
function getGitHubToken() {
    try {
        const token = fs.readFileSync(TOKEN_FILE_PATH, "utf8");
        console.log(token);
        return token;
    } catch (error) {
        console.error("Error reading GitHub token from file:", error);
        return null;
    }
}

//Define a function to get the maximum issue ID from data source
async function getMaxIssueID() {
    try {
        AWS.config.update({
            region: process.env.AWS_DEFAULT_REGION,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });

        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const tableName = "dev_issues_update";

        const scanIssueResults = await dynamodb.scan({
            TableName: tableName,
            ProjectionExpression: COL_NAME,
        }).promise();

        if (scanIssueResults.Items && scanIssueResults.Items.length > 0) {
            const maxIssueVal = Math.max(
                ...scanIssueResults.Items.map((item) => item[COL_NAME])
            );
            return maxIssueVal;
        } else {
            return 0;
        }
    } catch (error) {
        console.error("Error in getting the maximum issue ID: ", error);
        throw error;
    }
}

app.use(express.json());

//Welcome issue route
app.get("/", (req, res) => {
    res.send("Welcome issue route handler")
});

// Get issues
app.get("/getIssues", async (req, res) => {
    try {
        const issues = await getIssues();
        res.json(issues);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Something went wrong",
        });
    }
});

//Get max issue id
app.get("/getMaxIssueID", async (req, res) => {
    try {
        const maxIssueID = await getMaxIssueID();

        console.log(`The maximum value for ${COL_NAME} is: ${maxIssueID}`);
        res.json({ maxIssueVal: maxIssueID });
    } catch (error) {
        console.error("Error in the scanning table: ", error);
        res.status(500).json({
            error: "Error in the scanning table"
        })
    }
})

//Get Github token
app.get("/getGitHubToken", (req, res) => {
    const token = getGitHubToken();

    if (token) {
        res.json({ github_token: token });
    } else {
        res.status(500).json({ error: "GitHub token is not available" });
    }
});

// Route to fetch issues and store them in DynamoDB
app.get('/fetchGitHubIssues/:username', async (req, res) => {
    const username = req.params.username;
    const token = getGitHubToken();

    if (!token) {
        return res.status(500).json({
            error: "GitHub token is not available"
        });
    } else {
        try {
            const issue_url = `https://api.github.com/search/issues?q=author:${username}`;
            
            // Initialize DynamoDB DocumentClient
            const dynamodb = new AWS.DynamoDB.DocumentClient();
            const tableName = "dev_issues_update";

            const issue_responses = await axios.get(issue_url, {
                headers: { Authorization: `token ${token}` },
            });

            if (issue_responses.status === 200) {
                const exist_issues = issue_responses.data.items;

                console.log(`Issues created by ${username}:`);
                let maxIssId = await getMaxIssueID(); // Initialize maxIssId once

                for (const issue of exist_issues) {
                    // Increment the maxIssId for each issue
                    maxIssId++;

                    await dynamodb
                        .put({
                            TableName: tableName,
                            Item: {
                                issueID: maxIssId,
                                username: username,
                                issue_title: issue.title,
                                issue_url: issue.html_url,
                                type: 'CREATED',
                            },
                        })
                        .promise();

                    console.log(`- ${issue.title} (${issue.html_url})`);
                }

                res.json({ message: `Stored ${exist_issues.length} issues created by ${username}` });
            } else {
                console.error(`Error: ${issue_responses.status}`);
                res.status(issue_responses.status).json({ error: 'Error fetching created issues' });
            }
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

const port = process.env.port || 3002;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
