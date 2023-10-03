const fs = require("fs");

// Read the token from the token.txt file
const token = fs.readFileSync("token.txt", "utf-8").trim();

// Now you can use the 'token' variable for authentication with GitHub API or other services.
console.log("GitHub Token:", token);
