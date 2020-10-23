// Import all required dependencies
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const request = require("request");
const config = require("./config.json");
const mongoose = require("mongoose");

// Start the express app
const app = express();

// Enable the server to receive requests from clients in a different domain/origin
app.use(cors());
app.options("*", cors());

// Body parser is used to parse incominng requests as required
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Morgan allows us to log and debug every request coming into the server file
app.use(morgan("combined"));

// Default route which can be viewed on a browser just to check if the app is live
app.get("/", (req, res) => {
  res.status(200).send("This is the Webex bot for Concur. It is live.");
});

// Require all routes
require("./routes/webhookRoutes")(app); // Route all reminder related API calls

// Default error message when no route is matched
app.use((req, res, next) => {
  const error = new Error("Not Found");
  error.status = 400;
  next(error);
});

// Error handler for all errors
app.use((error, req, res, next) => {
  res.json({
    error: {
      message: error.message,
      status: error.status
    }
  });
});

// Run the server and log the port it is running on
app.listen(config.port || 1337, () => {
  const listAllWebhooks = {
    method: "GET",
    url: "https://api.ciscospark.com/v1/webhooks",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + config.token
    },
    json: true
  };

  request(listAllWebhooks, function(error, response, body) {
    if (error) throw new Error(error);
    body.items.forEach(webhook => {
      const deleteRequest = constructDeleteWebhooksRequest(webhook.id);
      request(deleteRequest, function(err, response, body) {
        if (err) throw new Error(error);
      });
    });
    const allEventsWebhookPayload = {
      method: "POST",
      url: "https://api.ciscospark.com/v1/webhooks",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.token
      },
      body: {
        name: "all-events-webhooks",
        targetUrl: config.webhookUrl + `/api/v1/allMessages`,
        resource: "all",
        event: "all"
      },
      json: true
    };

    const attachmentActionsWebhookPayload = {
      method: "POST",
      url: "https://api.ciscospark.com/v1/webhooks",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.token
      },
      body: {
        name: "attachment-action-webhook",
        targetUrl: config.webhookUrl + `/api/v1/attachmentActions`,
        resource: "attachmentActions",
        event: "created"
      },
      json: true
    };

    request(allEventsWebhookPayload, function(error, response, body) {
      if (error) throw new Error(error);
      request(attachmentActionsWebhookPayload, function(error, response, body) {
        if (error) throw new Error(error);
      });
    });

  });

  console.log("Listening on port:", config.port || 1337);
});

function constructDeleteWebhooksRequest(webhookId) {
  return {
    method: "DELETE",
    url: `https://api.ciscospark.com/v1/webhooks/${webhookId}`,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + config.token
    },
    json: true
  };
}

//Mongoose
mongoose.connect('mongodb+srv://riag:charitybot@charity-sr7nb.mongodb.net/charity?retryWrites=true&w=majority')
.then(result => {
  app.listen(27017);
})
.catch(err => {
  console.log(err);
})