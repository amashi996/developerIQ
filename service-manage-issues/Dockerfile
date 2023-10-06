# Use an official Node.js runtime as the base image
FROM node:14

# Copy the package.json and package-lock.json to the working directory
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code into the container
COPY . .

# Expose the port your application will run on
EXPOSE 3001

# Define the command to run your application
CMD ["node", "mainIssuesService.js"]